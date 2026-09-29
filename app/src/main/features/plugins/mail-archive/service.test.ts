import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { warmFileSqlite } from '../../../infra/db/warm-file-sqlite'
import { createMailArchiveStore } from './store'
import { createMailArchiveService } from './service'
import { readEmlFile } from './readers/eml'
import { archiveMailIdentityKey, archiveSourceId } from './identity'
import type { MailArchiveIndexWorker, MailArchiveWorkerFactory } from './worker-contract'
import type {
  MailArchiveAttachmentExportInput,
  MailArchiveAttachmentExportOutput,
  NormalizedArchiveMail
} from './types'

const roots: string[] = []
const services: Array<ReturnType<typeof createMailArchiveService>> = []

beforeAll(warmFileSqlite)
afterEach(async () => {
  for (const service of services.splice(0)) service.close()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

function rawMail(index: number): string {
  return [
    'From: sender@example.test',
    'To: team@example.test',
    `Subject: 서버 이전 ${index}`,
    `Message-ID: <batch-${index}@example.test>`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    `이전 작업 본문 ${index}`,
    ''
  ].join('\r\n')
}

function rawMailWithAttachment(): string {
  return [
    'From: sender@example.test',
    'To: team@example.test',
    'Subject: 첨부 선택 추출',
    'Message-ID: <attachment-export@example.test>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="archive-export"',
    '',
    '--archive-export',
    'Content-Type: text/plain; charset=utf-8',
    '',
    '메일 본문 검색에는 첨부 내용이 없습니다.',
    '--archive-export',
    'Content-Type: text/plain; name="export-me.txt"',
    'Content-Disposition: attachment; filename="export-me.txt"',
    '',
    'only-the-selected-file',
    '--archive-export--',
    ''
  ].join('\r\n')
}

function pstSnapshotMail(
  sourceId: string,
  sourcePath: string,
  sourceFingerprint: string,
  input: { readonly id: string; readonly body: string }
): NormalizedArchiveMail {
  const partial: Omit<NormalizedArchiveMail, 'identityKey'> = {
    sourceKind: 'pst',
    sourceId,
    sourcePath,
    sourceFingerprint,
    itemKey: input.id,
    folderPath: '받은 편지함',
    sentAt: 1_700_000_000_000,
    from: 'sender@example.test',
    to: 'team@example.test',
    cc: '',
    subject: 'PST 누적 이력',
    bodyText: input.body,
    bodyKind: 'plain',
    bodyAlternateText: null,
    bodyAlternateKind: null,
    bodyAlternateOmitted: false,
    bodyQualityFlags: [],
    bodySelectionReason: 'plain_preferred',
    messageId: `<${input.id}@example.test>`,
    inReplyTo: null,
    references: null,
    threadKey: `<${input.id}@example.test>`,
    attachments: [],
    sizeBytes: input.body.length
  }
  return { ...partial, identityKey: archiveMailIdentityKey(partial) }
}

async function fingerprint(path: string, signal: AbortSignal): Promise<string> {
  const hash = createHash('sha256')
  const stream = createReadStream(path)
  try {
    for await (const chunk of stream) {
      signal.throwIfAborted()
      hash.update(chunk as Buffer)
    }
    return hash.digest('hex')
  } finally {
    stream.destroy()
  }
}

function testWorkerFactory(
  root: string,
  hooks: {
    afterBatch?: (path: string, signal: AbortSignal) => Promise<void>
    parsed?: () => void
    extract?: (
      input: MailArchiveAttachmentExportInput
    ) => Promise<MailArchiveAttachmentExportOutput>
    readPst?: (
      sourcePath: string,
      sourceId: string,
      sourceFingerprint: string
    ) => Promise<NormalizedArchiveMail[]>
  } = {}
): MailArchiveWorkerFactory {
  const store = createMailArchiveStore(root)
  const activeEpochs = new Set<string>()
  const assertEpoch = (epoch: string): void => {
    if (!activeEpochs.has(epoch)) throw new Error('mail_import_epoch_revoked')
  }
  const index: MailArchiveIndexWorker = {
    openEpoch: async (epoch) => {
      activeEpochs.add(epoch)
    },
    revokeEpoch: async (epoch) => {
      activeEpochs.delete(epoch)
    },
    beginRevision: async (input) => store.beginRevision(input),
    upsertBatch: async ({ epoch, ...input }) => {
      assertEpoch(epoch)
      return store.upsertBatch(input)
    },
    verifyRevision: async (sourceId, revision, sourceFingerprint, epoch) => {
      assertEpoch(epoch)
      store.verifyRevision(sourceId, revision, sourceFingerprint)
    },
    activateRevision: async (sourceId, revision, sourceFingerprint, epoch) => {
      assertEpoch(epoch)
      store.activateRevision(sourceId, revision, sourceFingerprint)
    },
    abortRevision: async (sourceId, revision, state) =>
      store.abortRevision(sourceId, revision, state),
    search: async (request) => store.search(request),
    get: async (request) => store.get(request.id),
    thread: async (request) => store.thread(request),
    attachmentLocation: async (attachmentId) => store.attachmentLocation(attachmentId),
    sourcePathInUse: async (path) => store.sourcePathInUse(path),
    sources: async () => store.sources(),
    removeSource: async (sourceId) => store.removeSource(sourceId),
    stats: async () => store.stats(),
    close: () => store.close()
  }
  return {
    createIndex: () => index,
    createSource: () => ({
      extract: async (input) => {
        if (hooks.extract) return hooks.extract(input)
        throw new Error('mail_attachment_export_not_configured')
      },
      run: async (input, callbacks, signal) => {
        signal.throwIfAborted()
        const startFingerprint = await fingerprint(input.sourcePath, signal)
        const decision = await callbacks.onReady(startFingerprint)
        let messages = 0
        let revision: number | null = null
        const skipped = decision.action === 'skip'
        if (decision.action === 'scan') {
          revision = decision.revision
          hooks.parsed?.()
          const sourceMessages =
            input.sourceKind === 'pst' && hooks.readPst
              ? await hooks.readPst(input.sourcePath, input.sourceId, startFingerprint)
              : [await readEmlFile(input.sourcePath, input.sourceId, startFingerprint, signal)]
          for (const message of sourceMessages) {
            signal.throwIfAborted()
            await callbacks.onBatch(revision, [message])
            messages += 1
            await hooks.afterBatch?.(input.sourcePath, signal)
          }
        }
        signal.throwIfAborted()
        const endFingerprint = await fingerprint(input.sourcePath, signal)
        await callbacks.onComplete({
          startFingerprint,
          endFingerprint,
          revision,
          messages,
          skipped
        })
      }
    })
  }
}

describe('mail archive import service', () => {
  it('skips an unchanged source without reparsing and replaces changed contents without stale search results', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-service-'))
    roots.push(root)
    const path = join(root, 'mail.eml')
    await writeFile(path, rawMail(1))
    let parsed = 0
    const service = createMailArchiveService(
      root,
      testWorkerFactory(root, { parsed: () => parsed++ })
    )
    services.push(service)

    const first = await service.import({ inputKind: 'files', paths: [path] })
    const duplicate = await service.import({ inputKind: 'files', paths: [path] })
    expect(first).toMatchObject({ messages: 1, inserted: 1, skipped: 0, failures: [] })
    expect(duplicate).toMatchObject({ messages: 1, inserted: 0, skipped: 1, failures: [] })
    expect(parsed).toBe(1)

    await writeFile(path, rawMail(2))
    const changed = await service.import({ inputKind: 'files', paths: [path] })
    expect(changed).toMatchObject({ messages: 1, inserted: 1, skipped: 0 })
    expect(await service.search({ query: '본문 1', limit: 10 })).toHaveLength(0)
    expect(await service.search({ query: '본문 2', limit: 10 })).toHaveLength(1)
    expect(await service.stats()).toMatchObject({ totalMessages: 1, emlMessages: 1 })
  })

  it('keeps the last verified revision when the source changes during parsing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-revision-'))
    roots.push(root)
    const path = join(root, 'mail.eml')
    await writeFile(path, rawMail(1))
    const service = createMailArchiveService(root, testWorkerFactory(root))
    services.push(service)
    await service.import({ inputKind: 'files', paths: [path] })

    await writeFile(path, rawMail(2))
    let changedOnce = false
    const serviceWithMutation = createMailArchiveService(
      root,
      testWorkerFactory(root, {
        afterBatch: async (sourcePath) => {
          if (changedOnce) return
          changedOnce = true
          await writeFile(sourcePath, rawMail(3))
        }
      })
    )
    services.push(serviceWithMutation)
    const failed = await serviceWithMutation.import({ inputKind: 'files', paths: [path] })

    expect(failed.failures).toEqual([
      { path: 'mail.eml', reason: 'mail_source_changed_during_import' }
    ])
    expect(await service.search({ query: '본문 1', limit: 10 })).toHaveLength(1)
    expect(await service.search({ query: '본문 2', limit: 10 })).toHaveLength(0)
    expect(await service.stats()).toMatchObject({ totalMessages: 1, emlMessages: 1 })
  })

  it('reuses PST mail across full-file revisions and counts edited Message-ID payloads separately', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-pst-revisions-'))
    roots.push(root)
    const path = join(root, 'archive.pst')
    const writeSnapshot = async (mails: Array<{ id: string; body: string }>): Promise<void> =>
      writeFile(path, JSON.stringify({ mails }))
    await writeSnapshot([{ id: 'mail-a', body: '기존 본문 승인' }])
    let parsed = 0
    const service = createMailArchiveService(
      root,
      testWorkerFactory(root, {
        parsed: () => parsed++,
        readPst: async (sourcePath, sourceId, sourceFingerprint) => {
          const snapshot = JSON.parse(await readFile(sourcePath, 'utf8')) as {
            mails: Array<{ id: string; body: string }>
          }
          return snapshot.mails.map((mail) =>
            pstSnapshotMail(sourceId, sourcePath, sourceFingerprint, mail)
          )
        }
      })
    )
    services.push(service)

    const first = await service.import({ inputKind: 'files', paths: [path] })
    const unchanged = await service.import({ inputKind: 'files', paths: [path] })
    expect(first).toMatchObject({ messages: 1, inserted: 1, skipped: 0, failures: [] })
    expect(unchanged).toMatchObject({ messages: 1, inserted: 0, skipped: 1, failures: [] })
    expect(parsed).toBe(1)

    await writeSnapshot([
      { id: 'mail-a', body: '기존 본문 승인' },
      { id: 'mail-b', body: '새 메일 추가' }
    ])
    const appended = await service.import({ inputKind: 'files', paths: [path] })
    expect(appended).toMatchObject({ messages: 2, inserted: 1, skipped: 1 })

    await writeSnapshot([
      { id: 'mail-a', body: '수정 본문 승인' },
      { id: 'mail-b', body: '새 메일 추가' }
    ])
    const edited = await service.import({ inputKind: 'files', paths: [path] })
    expect(edited).toMatchObject({ messages: 2, inserted: 1, skipped: 1 })
    expect(await service.search({ query: '기존 본문', limit: 10 })).toHaveLength(0)
    expect(await service.search({ query: '수정 본문', limit: 10 })).toHaveLength(1)
    expect(await service.search({ query: '새 메일', limit: 10 })).toHaveLength(1)
    expect(await service.stats()).toMatchObject({ totalMessages: 2, pstMessages: 2 })
  })

  it('keeps completed EML files searchable when a folder batch is cancelled between files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-batch-'))
    roots.push(root)
    const folder = join(root, 'eml')
    await mkdir(folder)
    await Promise.all(
      [1, 2, 3].map((index) => writeFile(join(folder, `${index}.eml`), rawMail(index)))
    )
    const service = createMailArchiveService(root, testWorkerFactory(root))
    services.push(service)
    let cancelled = false
    const result = await service.import(
      { inputKind: 'eml-folder', paths: [folder] },
      (progress) => {
        if (!cancelled && progress.processedFiles >= 1) {
          cancelled = service.cancel(progress.jobId)
        }
      }
    )
    expect(cancelled).toBe(true)
    expect(result.state).toBe('cancelled')
    expect(result.messages).toBe(1)
    expect(await service.search({ query: '본문 1', limit: 10 })).toHaveLength(1)
    expect(await service.search({ query: '본문 2', limit: 10 })).toHaveLength(0)
  })

  it('does not promote a staged file when its import epoch is cancelled', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-cancel-'))
    roots.push(root)
    const path = join(root, 'mail.eml')
    await writeFile(path, rawMail(1))
    const service = createMailArchiveService(root, testWorkerFactory(root))
    services.push(service)
    let cancelled = false
    const result = await service.import({ inputKind: 'files', paths: [path] }, (progress) => {
      if (!cancelled && progress.processedMessages >= 1) {
        cancelled = service.cancel(progress.jobId)
      }
    })

    expect(cancelled).toBe(true)
    expect(result.state).toBe('cancelled')
    expect(await service.search({ query: '본문 1', limit: 10 })).toHaveLength(0)
    expect(await service.stats()).toMatchObject({ totalMessages: 0 })
  })

  it('revokes an in-flight import before removing a source and cannot restore deleted mail', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-remove-source-'))
    roots.push(root)
    const path = join(root, 'mail.eml')
    await writeFile(path, rawMail(1))
    const service = createMailArchiveService(root, testWorkerFactory(root))
    services.push(service)
    await service.import({ inputKind: 'files', paths: [path] })

    await writeFile(path, rawMail(2))
    let entered!: () => void
    const batchEntered = new Promise<void>((resolve) => {
      entered = resolve
    })
    let release!: () => void
    const holdBatch = new Promise<void>((resolve) => {
      release = resolve
    })
    const concurrentService = createMailArchiveService(
      root,
      testWorkerFactory(root, {
        afterBatch: async (_sourcePath, signal) => {
          entered()
          await Promise.race([
            holdBatch,
            new Promise<void>((resolve) =>
              signal.addEventListener('abort', () => resolve(), { once: true })
            )
          ])
        }
      })
    )
    services.push(concurrentService)

    const importing = concurrentService.import({ inputKind: 'files', paths: [path] })
    await batchEntered
    const removed = await concurrentService.removeSource(archiveSourceId('eml', path))
    release()
    const importResult = await importing

    expect(importResult.state).toBe('cancelled')
    expect(removed).toMatchObject({
      state: 'removed',
      removedMessages: 1,
      preservedMessages: 0,
      importCancelled: true
    })
    expect(await concurrentService.search({ query: '본문 1', limit: 10 })).toHaveLength(0)
    expect(await concurrentService.search({ query: '본문 2', limit: 10 })).toHaveLength(0)
    expect(await concurrentService.sources()).toHaveLength(0)
  })

  it('exports only a picked attachment and removal waits for an in-flight export', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-export-service-'))
    roots.push(root)
    const sourcePath = join(root, 'mail.eml')
    const destinationPath = join(root, 'saved-attachment.txt')
    await writeFile(sourcePath, rawMailWithAttachment())
    let entered!: () => void
    const exportEntered = new Promise<void>((resolve) => {
      entered = resolve
    })
    let release!: () => void
    const holdExport = new Promise<void>((resolve) => {
      release = resolve
    })
    const service = createMailArchiveService(
      root,
      testWorkerFactory(root, {
        extract: async (input) => {
          entered()
          await holdExport
          const temporaryPath = join(root, '.selected.orca-part')
          await writeFile(temporaryPath, Buffer.alloc(input.sizeBytes, 0x61))
          return { temporaryPath, bytesWritten: input.sizeBytes }
        }
      })
    )
    services.push(service)
    await service.import({ inputKind: 'files', paths: [sourcePath] })
    const hit = (await service.search({ query: 'export-me.txt', limit: 10 }))[0]!
    const message = await service.get({ id: hit.id })
    const attachment = message!.attachments[0]!

    await expect(service.exportAttachment(attachment.id, async () => sourcePath)).rejects.toThrow(
      'mail_attachment_destination_is_source'
    )

    const exporting = service.exportAttachment(attachment.id, async () => destinationPath)
    await exportEntered
    let removed = false
    const removing = service.removeSource(archiveSourceId('eml', sourcePath)).then((result) => {
      removed = true
      return result
    })
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(removed).toBe(false)

    release()
    await expect(exporting).resolves.toMatchObject({
      state: 'exported',
      name: 'export-me.txt',
      sizeBytes: attachment.sizeBytes
    })
    expect(await readFile(destinationPath)).toEqual(Buffer.alloc(attachment.sizeBytes, 0x61))
    await expect(removing).resolves.toMatchObject({ state: 'removed', removedMessages: 1 })
    expect(await service.get({ id: hit.id })).toBeNull()
  })
})
