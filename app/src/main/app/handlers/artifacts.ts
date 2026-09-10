import { dialog, shell, type IpcMainInvokeEvent } from 'electron'
import { realpath } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import {
  CHANNELS,
  ArtifactListRequestSchema,
  ArtifactCatalogRequestSchema,
  ArtifactSetPinnedRequestSchema,
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
import type { ArtifactCatalog } from '../../features/artifacts/catalog'
import {
  assertExportDestination,
  replaceExport,
  saveWithoutOverwrite
} from '../../features/artifacts/export-files'
import { handle, handlePlain } from '../../infra/ipc/handle'

type ArtifactHandlers = Pick<
  ArtifactService,
  'listLatest' | 'status' | 'preview' | 'trash' | 'readForExport' | 'revealPath' | 'openFolderPath'
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

export function registerArtifactHandlers(
  service: ArtifactHandlers,
  isTrustedSender: ArtifactSenderCheck,
  catalog: Pick<ArtifactCatalog, 'list' | 'setPinned'>
): void {
  const assertSender = (event: IpcMainInvokeEvent): void => {
    if (!isTrustedSender(event)) throw new Error('forbidden')
  }
  handle(CHANNELS.artifactCatalog, ArtifactCatalogRequestSchema, 'reject', (_req, event) => {
    assertSender(event)
    return catalog.list()
  })
  handle(CHANNELS.artifactSetPinned, ArtifactSetPinnedRequestSchema, 'reject', (req, event) => {
    assertSender(event)
    return catalog.setPinned(req.sessionId, req.publicationId, req.pinned)
  })
  handle(CHANNELS.artifactList, ArtifactListRequestSchema, 'reject', (req, event) => {
    assertSender(event)
    return service.listLatest(req.sessionId)
  })
  handle(CHANNELS.artifactStatus, ArtifactStatusRequestSchema, 'reject', (req, event) => {
    assertSender(event)
    return service.status(req.sessionId, req.publicationIds)
  })
  handle(CHANNELS.artifactPreview, ArtifactTargetRequestSchema, 'reject', (req, event) => {
    assertSender(event)
    return service.preview(req.sessionId, req.publicationId)
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
