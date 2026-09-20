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

const STALE_STAGE_MS = 24 * 60 * 60 * 1000
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i

export interface MailAttachmentExportOptions {
  readonly root?: string
  readonly now?: () => number
}

export interface ExportedMailAttachment {
  readonly filename: string
  readonly bytes: number
  readonly savedPath: string
}

function inside(parent: string, child: string): boolean {
  const path = relative(parent, child)
  return path === '' || (!path.startsWith('..') && !isAbsolute(path))
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
  return safeSegment(basename(value.replace(/\\/g, '/')) || 'attachment')
}

async function ensureDirectory(parentReal: string | null, directory: string): Promise<string> {
  try {
    await mkdir(directory)
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST'))
      throw error
  }
  const info = await lstat(directory)
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('unsafe attachment directory')
  const resolved = await realpath(directory)
  if (parentReal !== null && !inside(parentReal, resolved))
    throw new Error('unsafe attachment directory')
  return resolved
}

async function cleanupStaleStages(staging: string, now: number): Promise<void> {
  for (const entry of await readdir(staging, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue
    const target = join(staging, entry.name)
    const info = await lstat(target)
    if (now - info.mtimeMs <= STALE_STAGE_MS) continue
    const resolved = await realpath(target)
    if (inside(staging, resolved)) await rm(resolved, { recursive: true, force: true })
  }
}

export async function exportMailAttachment(
  options: MailAttachmentExportOptions,
  accountId: string,
  filename: string,
  bytes: Uint8Array
): Promise<ExportedMailAttachment> {
  // 봉쇄 검사의 parent 는 스스로 정규화한다. 기본 경로 제공자가 8.3 별칭이나 symlink 를
  // 돌려줘도 realpath 한 자식과 비교가 성립해야 한다 (Windows `RUNNER~1` 형태).
  const root = await ensureDirectory(
    null,
    options.root ? resolve(options.root) : await prepareTemporaryFilesPath()
  )
  const mailRoot = await ensureDirectory(root, join(root, 'mail'))
  const accountRoot = await ensureDirectory(mailRoot, join(mailRoot, safeSegment(accountId)))
  const staging = await ensureDirectory(accountRoot, join(accountRoot, '.staging'))
  await cleanupStaleStages(staging, (options.now ?? Date.now)())
  const stage = join(staging, randomUUID())
  const finalDirectory = join(accountRoot, randomUUID())
  await mkdir(stage, { mode: 0o700 })
  const safeName = sanitizeAttachmentFilename(filename)
  const stagedPath = join(stage, safeName)
  let handle: FileHandle | undefined
  try {
    handle = await open(stagedPath, 'wx', 0o600)
    await handle.writeFile(bytes)
    await handle.close()
    handle = undefined
    await rename(stage, finalDirectory)
    return {
      filename: safeName,
      bytes: bytes.byteLength,
      savedPath: join(finalDirectory, safeName)
    }
  } catch (error) {
    await handle?.close().catch(() => undefined)
    await rm(stage, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }
}
