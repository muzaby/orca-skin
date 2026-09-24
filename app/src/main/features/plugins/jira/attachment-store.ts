import { randomUUID } from 'node:crypto'
import { mkdir, open, rename, rm, type FileHandle } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { prepareTemporaryFilesPath } from '../../../infra/config/temp-path'
import {
  cleanupStaleStages,
  ensurePlainDirectory,
  safeSegment,
  sanitizeAttachmentFilename
} from '../attachment-fs'
import { JiraToolError } from './result'

export interface JiraAttachmentStoreOptions {
  readonly root?: string
  readonly now?: () => number
}

export interface JiraStagedFile {
  readonly filename: string
  readonly savedPath: string
}

export interface JiraAttachmentBatch {
  write(filename: string, bytes: Uint8Array): Promise<JiraStagedFile>
  commit(): Promise<void>
  abort(): Promise<void>
}

export interface JiraAttachmentStore {
  begin(authId: string, selector: string): Promise<JiraAttachmentBatch>
}

function filesystemError(): JiraToolError {
  return new JiraToolError('filesystem_error', 'filesystem_error')
}

function suffixed(filename: string, number: number): string {
  if (number === 1) return filename
  const dot = filename.lastIndexOf('.')
  return dot > 0
    ? `${filename.slice(0, dot)} (${number})${filename.slice(dot)}`
    : `${filename} (${number})`
}

export function createJiraAttachmentStore(
  options: JiraAttachmentStoreOptions = {}
): JiraAttachmentStore {
  return {
    async begin(authId, selector): Promise<JiraAttachmentBatch> {
      try {
        // 봉쇄 검사의 parent 는 스스로 정규화한다 — mail attachment-export 와 같은 불변식.
        const root = await ensurePlainDirectory(
          null,
          options.root ? resolve(options.root) : await prepareTemporaryFilesPath(),
          filesystemError
        )
        const jira = await ensurePlainDirectory(root, join(root, 'jira'), filesystemError)
        const auth = await ensurePlainDirectory(
          jira,
          join(jira, safeSegment(authId)),
          filesystemError
        )
        const selection = await ensurePlainDirectory(
          auth,
          join(auth, safeSegment(selector)),
          filesystemError
        )
        const staging = await ensurePlainDirectory(
          selection,
          join(selection, '.staging'),
          filesystemError
        )
        await cleanupStaleStages(staging, (options.now ?? Date.now)())

        const requestId = randomUUID()
        const batchId = randomUUID()
        const stageDirectory = join(staging, requestId)
        const finalDirectory = join(selection, batchId)
        await mkdir(stageDirectory, { mode: 0o700 })
        const used = new Set<string>()
        let state: 'open' | 'published' | 'aborted' = 'open'

        return {
          async write(untrustedName, bytes): Promise<JiraStagedFile> {
            if (state !== 'open') throw filesystemError()
            const base = sanitizeAttachmentFilename(untrustedName)
            let counter = 1
            let filename = base
            while (used.has(filename)) filename = suffixed(base, ++counter)
            used.add(filename)
            const stagedPath = join(stageDirectory, filename)
            let handle: FileHandle | undefined
            let failure: unknown
            try {
              handle = await open(stagedPath, 'wx', 0o600)
              await handle.writeFile(bytes)
            } catch (error) {
              failure = error
            } finally {
              try {
                await handle?.close()
              } catch (error) {
                failure ??= error
              }
            }
            if (failure !== undefined) throw filesystemError()
            return { filename, savedPath: join(finalDirectory, filename) }
          },
          async commit(): Promise<void> {
            if (state !== 'open') throw filesystemError()
            try {
              await rename(stageDirectory, finalDirectory)
              state = 'published'
            } catch {
              await rm(stageDirectory, { recursive: true, force: true }).catch(() => undefined)
              state = 'aborted'
              throw filesystemError()
            }
          },
          async abort(): Promise<void> {
            if (state !== 'open') return
            state = 'aborted'
            await rm(stageDirectory, { recursive: true, force: true }).catch(() => undefined)
          }
        }
      } catch (error) {
        if (error instanceof JiraToolError) throw error
        throw filesystemError()
      }
    }
  }
}
