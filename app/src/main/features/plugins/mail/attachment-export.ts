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

export interface MailAttachmentExportOptions {
  readonly root?: string
  readonly now?: () => number
}

export interface ExportedMailAttachment {
  readonly filename: string
  readonly bytes: number
  readonly savedPath: string
}

const unsafeDirectory = (): Error => new Error('unsafe attachment directory')

export async function exportMailAttachment(
  options: MailAttachmentExportOptions,
  accountId: string,
  filename: string,
  bytes: Uint8Array
): Promise<ExportedMailAttachment> {
  // 봉쇄 검사의 parent 는 스스로 정규화한다. 기본 경로 제공자가 8.3 별칭이나 symlink 를
  // 돌려줘도 realpath 한 자식과 비교가 성립해야 한다 (Windows `RUNNER~1` 형태).
  const root = await ensurePlainDirectory(
    null,
    options.root ? resolve(options.root) : await prepareTemporaryFilesPath(),
    unsafeDirectory
  )
  const mailRoot = await ensurePlainDirectory(root, join(root, 'mail'), unsafeDirectory)
  const accountRoot = await ensurePlainDirectory(
    mailRoot,
    join(mailRoot, safeSegment(accountId)),
    unsafeDirectory
  )
  const staging = await ensurePlainDirectory(
    accountRoot,
    join(accountRoot, '.staging'),
    unsafeDirectory
  )
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
