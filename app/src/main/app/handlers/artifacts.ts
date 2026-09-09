import { dialog, shell, type IpcMainInvokeEvent } from 'electron'
import { randomUUID } from 'node:crypto'
import type { Stats } from 'node:fs'
import { lstat, open, realpath, rename, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import {
  CHANNELS,
  ArtifactListRequestSchema,
  ArtifactTargetRequestSchema,
  ArtifactStatusRequestSchema,
  ArtifactSaveRequestSchema
} from '../../../shared/protocol'
import type {
  ArtifactActionResult,
  ArtifactSaveItem,
  ArtifactSaveResult
} from '../../../shared/artifacts'
import type { ArtifactService } from '../../features/artifacts/service'
import { isWithinDir } from '../../infra/config/paths'
import { handle, handlePlain } from '../../infra/ipc/handle'

type ArtifactHandlers = Pick<
  ArtifactService,
  'listLatest' | 'status' | 'trash' | 'readForExport' | 'revealPath' | 'openFolderPath'
>
export type ArtifactSenderCheck = (event: IpcMainInvokeEvent) => boolean

function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  return [
    'missing',
    'forbidden',
    'unsafe-path',
    'access-denied',
    'too-large',
    'unsafe-destination'
  ].includes(message)
    ? message
    : 'io-error'
}

async function assertExportDestination(path: string, root: string): Promise<void> {
  const parent = await realpath(dirname(path))
  let target = join(parent, basename(path))
  try {
    target = await realpath(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  // 개발 DB도 production 보관 파일을 내보내기 대상으로 덮어쓰지 못한다.
  const storageRoot = basename(root) === '.dev' ? dirname(root) : root
  if (isWithinDir(target, await realpath(storageRoot))) throw new Error('unsafe-destination')
}

async function saveWithoutOverwrite(
  directory: string,
  filename: string,
  bytes: Buffer
): Promise<void> {
  const extension = extname(filename)
  const stem = basename(filename, extension)
  for (let suffix = 0; suffix < 10_000; suffix++) {
    const name = suffix === 0 ? filename : `${stem} (${suffix})${extension}`
    try {
      await writeFile(join(directory, name), bytes, { flag: 'wx' })
      return
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }
  throw new Error('name-conflict')
}

async function replaceExport(path: string, root: string, bytes: Buffer): Promise<void> {
  // Replace the directory entry rather than truncating a possibly shared hardlink inode.
  const parent = await realpath(dirname(path))
  const destination = join(parent, basename(path))
  const pending = join(parent, `.orca-artifact-${randomUUID()}.tmp`)
  await assertExportDestination(destination, root)
  await assertExportDestination(pending, root)
  let owned: Stats | undefined
  let renamed = false
  try {
    const file = await open(pending, 'wx')
    try {
      await file.writeFile(bytes)
      await file.sync()
    } finally {
      try {
        owned = await file.stat()
      } finally {
        await file.close()
      }
    }
    await assertExportDestination(destination, root)
    const current = await lstat(pending)
    if (
      !owned ||
      current.dev !== owned.dev ||
      current.ino !== owned.ino ||
      current.size !== owned.size ||
      current.mtimeMs !== owned.mtimeMs
    )
      throw new Error('unsafe-destination')
    await rename(pending, destination)
    renamed = true
  } finally {
    if (!renamed && owned) {
      try {
        const current = await lstat(pending)
        if (
          current.dev === owned.dev &&
          current.ino === owned.ino &&
          current.size === owned.size &&
          current.mtimeMs === owned.mtimeMs
        )
          await unlink(pending)
      } catch {
        /* only this request's unchanged temporary file may be cleaned up */
      }
    }
  }
}

export function registerArtifactHandlers(
  service: ArtifactHandlers,
  isTrustedSender: ArtifactSenderCheck
): void {
  const assertSender = (event: IpcMainInvokeEvent): void => {
    if (!isTrustedSender(event)) throw new Error('forbidden')
  }
  handle(CHANNELS.artifactList, ArtifactListRequestSchema, 'reject', (req, event) => {
    assertSender(event)
    return service.listLatest(req.sessionId)
  })
  handle(CHANNELS.artifactStatus, ArtifactStatusRequestSchema, 'reject', (req, event) => {
    assertSender(event)
    return service.status(req.sessionId, req.publicationIds)
  })
  handle(CHANNELS.artifactTrash, ArtifactTargetRequestSchema, 'reject', (req, event) => {
    assertSender(event)
    return service.trash(req.sessionId, req.publicationId)
  })

  handle(
    CHANNELS.artifactReveal,
    ArtifactTargetRequestSchema,
    'reject',
    async (req, event): Promise<ArtifactActionResult> => {
      assertSender(event)
      try {
        shell.showItemInFolder(await service.revealPath(req.sessionId, req.publicationId))
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    }
  )
  handlePlain(CHANNELS.artifactOpenFolder, async (_req, event): Promise<ArtifactActionResult> => {
    assertSender(event)
    try {
      const error = await shell.openPath(await service.openFolderPath())
      return error ? { ok: false, reason: 'open-failed' } : { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  })

  handle(
    CHANNELS.artifactSave,
    ArtifactSaveRequestSchema,
    'reject',
    async (req, event): Promise<ArtifactSaveResult> => {
      assertSender(event)
      const publicationIds = [...new Set(req.publicationIds)]
      const items: ArtifactSaveItem[] = []
      try {
        const root = await service.openFolderPath()
        let destination: string
        const single = publicationIds.length === 1
        if (single) {
          const original = await service.revealPath(req.sessionId, publicationIds[0]!)
          const selected = await dialog.showSaveDialog({ defaultPath: basename(original) })
          if (selected.canceled || !selected.filePath) return { outcome: 'cancelled', items: [] }
          destination = resolve(selected.filePath)
          await assertExportDestination(destination, root)
        } else {
          const selected = await dialog.showOpenDialog({
            properties: ['openDirectory', 'createDirectory']
          })
          if (selected.canceled || !selected.filePaths[0])
            return { outcome: 'cancelled', items: [] }
          destination = await realpath(selected.filePaths[0])
          await assertExportDestination(join(destination, '.orca-export-check'), root)
        }
        for (const publicationId of publicationIds) {
          try {
            // 대화상자가 열린 동안 파일/세션이 달라졌을 수 있으므로 원래 ID를 다시 검사한다.
            const file = await service.readForExport(req.sessionId, publicationId)
            if (single) {
              await assertExportDestination(destination, root)
              await replaceExport(destination, root, file.bytes)
            } else {
              await assertExportDestination(join(destination, file.filename), root)
              await saveWithoutOverwrite(destination, file.filename, file.bytes)
            }
            items.push({ publicationId, outcome: 'saved' })
          } catch (error) {
            const reason = reasonOf(error)
            items.push({
              publicationId,
              outcome: reason === 'missing' ? 'skipped' : 'failed',
              reason
            })
          }
        }
        return { outcome: 'completed', items }
      } catch (error) {
        return { outcome: 'failed', items, reason: reasonOf(error) }
      }
    }
  )
}
