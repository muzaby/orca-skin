import { randomUUID } from 'node:crypto'
import type {
  ArtifactRef,
  ArtifactPreviewResult,
  ArtifactStatusItem,
  ArtifactTrashResult
} from '../../../shared/artifacts'
import type { ArtifactFileRecord, ArtifactQueries } from '../../infra/db/artifact-queries'
import {
  ArtifactFiles,
  inspectOutputFile,
  prepareOutputDirectory,
  readArtifactInput,
  readOutputInput,
  readStableFile
} from './files'
import { artifactError, artifactInput, classifyFileError } from './validation'
import {
  artifactPreview,
  MAX_ARTIFACT_BYTES,
  MAX_OUTPUT_BYTES,
  validateArtifactBytes
} from './formats'

export interface ArtifactPublishContext {
  sessionId: string
  cwd: string
  extraDirs: readonly string[]
  signal: AbortSignal
  isCurrent(): boolean
}
export interface ArtifactReceipt {
  type: 'orca.artifact.published'
  version: 1
  publicationId: string
}
type Queries = Pick<
  ArtifactQueries,
  'createPublication' | 'listLatest' | 'getOwnedFile' | 'markTrashed'
>

export class ArtifactService {
  private readonly files: ArtifactFiles
  private readonly lifetime = new AbortController()
  private closing = false
  private publishing = 0
  private readonly active = new Set<Promise<unknown>>()
  private readonly fileQueues = new Map<string, Promise<unknown>>()
  private readonly pendingStatus = new Map<string, Promise<ArtifactStatusItem['availability']>>()
  private statCount = 0
  private readonly statWaiters: Array<() => void> = []

  constructor(
    private readonly options: {
      queries: Queries
      rootDir: string
      trashItem(path: string): Promise<void>
      isInputFile?: (sessionId: string, inputSource: string, hash: string) => boolean
    }
  ) {
    this.files = new ArtifactFiles(options.rootDir)
  }
  private assertOpen(): void {
    if (this.closing) throw new Error('closed')
  }
  private own(sessionId: string, publicationId: string): ArtifactFileRecord {
    this.assertOpen()
    const row = this.options.queries.getOwnedFile(sessionId, publicationId)
    if (!row) throw new Error('forbidden')
    return row
  }
  private track<T>(operation: Promise<T>): Promise<T> {
    this.active.add(operation)
    void operation.then(
      () => this.active.delete(operation),
      () => this.active.delete(operation)
    )
    return operation
  }
  private withFile<T>(fileId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.fileQueues.get(fileId) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(operation)
    this.fileQueues.set(fileId, next)
    void next.then(
      () => {
        if (this.fileQueues.get(fileId) === next) this.fileQueues.delete(fileId)
      },
      () => {
        if (this.fileQueues.get(fileId) === next) this.fileQueues.delete(fileId)
      }
    )
    return next
  }

  publish(input: unknown, context: ArtifactPublishContext): Promise<ArtifactReceipt> {
    return this.track(this.publishOne(input, context))
  }

  captureOutput(
    path: string,
    directory: string,
    context: ArtifactPublishContext,
    expectedContent?: string
  ): Promise<ArtifactRef | undefined> {
    return this.track(
      this.withFile(`output:${context.sessionId}:${directory}`, async () => {
        this.assertOpen()
        const signal = AbortSignal.any([context.signal, this.lifetime.signal])
        const check = (): void => {
          if (signal.aborted || !context.isCurrent()) throw new Error('cancelled')
        }
        check()
        const temporaryRoot = await prepareOutputDirectory(context.cwd)
        // The injected path must still resolve to the app's OS Temp policy.
        const source = await readOutputInput(path, temporaryRoot, signal)
        if (!source) return undefined
        check()
        if (this.options.isInputFile?.(context.sessionId, source.inputSource, source.hash))
          return undefined
        if (
          expectedContent !== undefined &&
          source.bytes.toString('utf8').replace(/\r\n/g, '\n') !==
            expectedContent.replace(/\r\n/g, '\n')
        )
          throw new Error('file-changed')
        const existing = this.listLatest(context.sessionId).find((ref) => {
          if (ref.category !== 'file' || ref.filename !== source.filename) return false
          const row = this.own(context.sessionId, ref.publicationId)
          return (
            row.inputSource === source.inputSource &&
            row.hash === source.hash &&
            row.lastTrashedAt === null
          )
        })
        if (existing) {
          try {
            const saved = await this.readForExport(context.sessionId, existing.publicationId)
            check()
            if (saved.bytes.equals(source.bytes)) return existing
          } catch {
            // 원본이 바뀌었으면 이번에 확인한 메타데이터로 새 버전을 만든다.
          }
        }
        check()
        let kind: ArtifactRef['kind'] = 'file'
        try {
          kind = validateArtifactBytes(source.filename, source.bytes).format
        } catch {
          // Office·PDF·대용량 또는 UTF-8 이외 파일도 원본 다운로드를 보존한다.
        }
        const artifactFileId = randomUUID()
        const publicationId = randomUUID()
        check()
        this.options.queries.createPublication({
          publicationId,
          artifactFileId,
          sessionId: context.sessionId,
          // A unique registry key only; ordinary reads resolve inputSource in OS Temp.
          relativePath: `temporary/${artifactFileId}/${source.filename}`,
          filename: source.filename,
          title: source.filename.slice(0, 160),
          kind,
          category: 'file',
          sizeBytes: source.bytes.length,
          hash: source.hash,
          inputSource: source.inputSource,
          publishedAt: this.nextPublicationTime(context.sessionId, source.inputSource, 'file')
        })
        return this.getRef(context.sessionId, publicationId)
      })
    )
  }
  private nextPublicationTime(
    sessionId: string,
    inputSource: string,
    category: 'file' | 'artifact'
  ): number {
    let at = Date.now()
    for (const ref of this.listLatest(sessionId)) {
      if ((ref.category ?? 'artifact') !== category) continue
      const row = this.own(sessionId, ref.publicationId)
      if (row.inputSource === inputSource) at = Math.max(at, row.publishedAt + 1)
    }
    return at
  }
  private async publishOne(
    input: unknown,
    context: ArtifactPublishContext
  ): Promise<ArtifactReceipt> {
    this.assertOpen()
    if (this.publishing >= 2) throw new Error('busy')
    const signal = AbortSignal.any([context.signal, this.lifetime.signal])
    const check = (): void => {
      if (signal.aborted || !context.isCurrent()) throw new Error('cancelled')
    }
    check()
    const parsed = artifactInput(input)
    this.publishing++
    let prepared: Awaited<ReturnType<ArtifactFiles['prepare']>> | undefined
    let committed = false
    try {
      const source = await readArtifactInput(parsed.path, context.cwd, context.extraDirs, signal)
      const artifactFileId = randomUUID()
      const publicationId = randomUUID()
      prepared = await this.files.prepare(artifactFileId, parsed.filename, source.bytes, signal)
      check()
      try {
        this.options.queries.createPublication({
          publicationId,
          artifactFileId,
          sessionId: context.sessionId,
          relativePath: prepared.relativePath,
          filename: parsed.filename,
          title: parsed.title,
          kind: parsed.kind,
          sizeBytes: source.bytes.length,
          hash: source.hash,
          inputSource: source.inputSource,
          publishedAt: this.nextPublicationTime(context.sessionId, source.inputSource, 'artifact')
        })
      } catch {
        throw new Error('storage-failed')
      }
      committed = true
      return { type: 'orca.artifact.published', version: 1, publicationId }
    } catch (error) {
      throw artifactError(error)
    } finally {
      if (!committed && prepared) await prepared.cleanup().catch(() => undefined)
      this.publishing--
    }
  }

  listLatest(sessionId: string): ArtifactRef[] {
    this.assertOpen()
    return this.options.queries.listLatest(sessionId)
  }
  getRef(sessionId: string, publicationId: string): ArtifactRef {
    const file = this.own(sessionId, publicationId)
    return {
      publicationId: file.publicationId,
      artifactFileId: file.artifactFileId,
      title: file.title,
      filename: file.filename,
      kind: file.kind,
      category: file.category ?? 'artifact',
      sizeBytes: file.sizeBytes,
      publishedAt: file.publishedAt
    }
  }

  private async inspectLimited(
    file: ArtifactFileRecord
  ): Promise<ArtifactStatusItem['availability']> {
    if (this.statCount >= 4) await new Promise<void>((resolve) => this.statWaiters.push(resolve))
    else this.statCount++
    try {
      this.assertOpen()
      const { info } = await this.inspect(file)
      return { state: 'present', sizeBytes: info.size, modifiedAt: info.mtimeMs }
    } catch (error) {
      return classifyFileError(error)
    } finally {
      const next = this.statWaiters.shift()
      if (next) next()
      else this.statCount--
    }
  }
  private inspect(file: ArtifactFileRecord): ReturnType<ArtifactFiles['inspect']> {
    return file.category === 'file' ? inspectOutputFile(file) : this.files.inspect(file)
  }
  status(sessionId: string, publicationIds: string[]): Promise<ArtifactStatusItem[]> {
    return this.track(this.statusBatch(sessionId, publicationIds))
  }
  private async statusBatch(
    sessionId: string,
    publicationIds: string[]
  ): Promise<ArtifactStatusItem[]> {
    this.assertOpen()
    if (publicationIds.length > 100) throw new Error('invalid-input')
    return Promise.all(
      publicationIds.map(async (publicationId) => {
        const file = this.own(sessionId, publicationId)
        let pending = this.pendingStatus.get(file.artifactFileId)
        if (!pending) {
          pending = this.withFile(file.artifactFileId, () => this.inspectLimited(file))
          this.pendingStatus.set(file.artifactFileId, pending)
          const current = pending
          void pending
            .finally(() => {
              if (this.pendingStatus.get(file.artifactFileId) === current)
                this.pendingStatus.delete(file.artifactFileId)
            })
            .catch(() => undefined)
        }
        const availability = await pending
        const latest = this.own(sessionId, publicationId)
        return {
          publicationId,
          artifactFileId: file.artifactFileId,
          availability,
          ...(latest.lastTrashedAt !== null ? { lastTrashedAt: latest.lastTrashedAt } : {})
        }
      })
    )
  }

  async preview(sessionId: string, publicationId: string): Promise<ArtifactPreviewResult> {
    try {
      const file = await this.readForExport(sessionId, publicationId)
      // readForExport validates ownership before queueing, within the queue and after disk reads.
      this.own(sessionId, publicationId)
      return artifactPreview(file.filename, file.bytes)
    } catch (error) {
      return { state: 'unavailable', reason: artifactError(error).message }
    }
  }

  readForExport(
    sessionId: string,
    publicationId: string
  ): Promise<{ filename: string; bytes: Buffer }> {
    return this.track(this.readExport(sessionId, publicationId))
  }
  private async readExport(
    sessionId: string,
    publicationId: string
  ): Promise<{ filename: string; bytes: Buffer }> {
    const file = this.own(sessionId, publicationId)
    return this.withFile(file.artifactFileId, async () => {
      try {
        this.own(sessionId, publicationId)
        const before = await this.inspect(file)
        const bytes = await readStableFile(
          before.path,
          this.lifetime.signal,
          file.category === 'file' ? MAX_OUTPUT_BYTES : MAX_ARTIFACT_BYTES
        )
        const after = await this.inspect(file)
        if (before.info.ino !== after.info.ino || before.info.dev !== after.info.dev)
          throw new Error('file-changed')
        this.own(sessionId, publicationId)
        return { filename: file.filename, bytes }
      } catch (error) {
        throw artifactError(error)
      }
    })
  }
  revealPath(sessionId: string, publicationId: string): Promise<string> {
    return this.track(
      (async () => {
        const file = this.own(sessionId, publicationId)
        return this.withFile(file.artifactFileId, async () => {
          try {
            const { path } = await this.inspect(file)
            this.own(sessionId, publicationId)
            return path
          } catch (error) {
            throw artifactError(error)
          }
        })
      })()
    )
  }
  openFolderPath(): Promise<string> {
    return this.track(
      (async () => {
        try {
          this.assertOpen()
          const path = await this.files.folder(true)
          this.assertOpen()
          return path
        } catch (error) {
          throw artifactError(error)
        }
      })()
    )
  }
  trash(sessionId: string, publicationId: string): Promise<ArtifactTrashResult> {
    return this.track(this.trashOne(sessionId, publicationId))
  }
  private async trashOne(sessionId: string, publicationId: string): Promise<ArtifactTrashResult> {
    let file: ArtifactFileRecord
    try {
      file = this.own(sessionId, publicationId)
    } catch {
      return { outcome: 'failed', reason: 'forbidden' }
    }
    this.pendingStatus.delete(file.artifactFileId)
    return this.withFile(file.artifactFileId, async () => {
      try {
        this.own(sessionId, publicationId)
        const before = await this.inspect(file)
        const after = await this.inspect(file)
        if (
          before.info.ino !== after.info.ino ||
          before.info.dev !== after.info.dev ||
          before.info.mtimeMs !== after.info.mtimeMs ||
          before.info.size !== after.info.size
        )
          throw new Error('unsafe-path')
        this.own(sessionId, publicationId)
        await this.options.trashItem(after.path)
      } catch (error) {
        if (error instanceof Error && ['forbidden', 'closed'].includes(error.message))
          return { outcome: 'failed', reason: 'forbidden' }
        const state = classifyFileError(error)
        if (state.state === 'missing') {
          try {
            this.own(sessionId, publicationId)
            this.options.queries.markTrashed(file.artifactFileId, Date.now())
          } catch {
            return { outcome: 'failed', reason: 'trash-failed' }
          }
          return { outcome: 'already-missing' }
        }
        return {
          outcome: 'failed',
          reason:
            state.state === 'unavailable' && state.reason === 'unsafe-path'
              ? 'unsafe-path'
              : 'trash-failed'
        }
      }
      try {
        this.assertOpen()
        this.options.queries.markTrashed(file.artifactFileId, Date.now())
        return { outcome: 'trashed', deletionRecorded: true }
      } catch {
        return { outcome: 'trashed', deletionRecorded: false }
      }
    })
  }

  async close(): Promise<void> {
    this.closing = true
    this.lifetime.abort()
    await Promise.allSettled([...this.active])
  }
}
