import { randomUUID } from 'node:crypto'
import {
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  rename,
  rm,
  type FileHandle
} from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { prepareTemporaryFilesPath } from '../../../infra/config/temp-path'
import { JiraToolError } from './result'

const STALE_STAGE_MS = 24 * 60 * 60 * 1000
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i

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

function inside(parent: string, child: string): boolean {
  const path = relative(parent, child)
  return path === '' || (!path.startsWith('..') && !isAbsolute(path))
}

async function ensurePlainDirectory(parentReal: string | null, directory: string): Promise<string> {
  try {
    await mkdir(directory)
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST'))
      throw error
  }
  const info = await lstat(directory)
  if (!info.isDirectory() || info.isSymbolicLink()) throw filesystemError()
  const resolved = await realpath(directory)
  if (parentReal !== null && !inside(parentReal, resolved)) throw filesystemError()
  return resolved
}

function safeSegment(value: string): string {
  const withoutControls = Array.from(value, (character) =>
    character.charCodeAt(0) <= 0x1f ? '_' : character
  ).join('')
  const sanitized = withoutControls
    .replace(/[<>:"/\\|?*]/g, '_')
    .slice(0, 120)
    .replace(/[. ]+$/g, '')
  if (!sanitized || sanitized === '.' || sanitized === '..') return '_'
  return WINDOWS_RESERVED.test(sanitized) ? `_${sanitized}` : sanitized
}

export function sanitizeAttachmentFilename(value: string): string {
  const leaf = basename(value.replace(/\\/g, '/'))
  return safeSegment(leaf || 'attachment')
}

function suffixed(filename: string, number: number): string {
  if (number === 1) return filename
  const dot = filename.lastIndexOf('.')
  return dot > 0
    ? `${filename.slice(0, dot)} (${number})${filename.slice(dot)}`
    : `${filename} (${number})`
}

async function cleanupStaleStages(staging: string, now: number): Promise<void> {
  for (const entry of await readdir(staging, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue
    const target = join(staging, entry.name)
    const info = await lstat(target)
    if (now - info.mtimeMs <= STALE_STAGE_MS) continue
    const resolved = await realpath(target)
    if (!inside(staging, resolved)) continue
    await rm(resolved, { recursive: true, force: true })
  }
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
          options.root ? resolve(options.root) : await prepareTemporaryFilesPath()
        )
        const jira = await ensurePlainDirectory(root, join(root, 'jira'))
        const auth = await ensurePlainDirectory(jira, join(jira, safeSegment(authId)))
        const selection = await ensurePlainDirectory(auth, join(auth, safeSegment(selector)))
        const staging = await ensurePlainDirectory(selection, join(selection, '.staging'))
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
