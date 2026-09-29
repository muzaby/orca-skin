import { dialog, type IpcMainInvokeEvent } from 'electron'
import { realpath } from 'node:fs/promises'
import { CHANNELS } from '../../../shared/ipc'
import {
  MailArchiveCancelRequestSchema,
  MailArchiveGetRequestSchema,
  MailArchiveImportRequestSchema,
  MailArchiveSearchRequestSchema
} from '../../../shared/mail-archive'
import type { MailArchiveProgress } from '../../../shared/mail-archive'
import type { MailArchiveService } from '../../features/plugins/mail-archive/service'
import { handle, handlePlain } from '../../infra/ipc/handle'

type SourceSelection =
  | { readonly kind: 'files'; readonly paths: ReadonlySet<string> }
  | { readonly kind: 'eml-folder'; readonly path: string }

// Renderer receives the picker result so it can start an import, but an invoke payload alone is
// not an authority to read an arbitrary absolute path. Keep the last OS-picker selection bound to
// the requesting WebContents and re-check it on import. WeakMap also drops the capability when the
// window is destroyed.
const selections = new WeakMap<Electron.WebContents, SourceSelection>()

async function canonical(path: string): Promise<string> {
  return realpath(path).catch(() => path)
}

async function assertPickedSelection(
  request: { inputKind: 'files' | 'eml-folder'; paths: readonly string[] },
  event: IpcMainInvokeEvent
): Promise<void> {
  const selection = selections.get(event.sender)
  if (!selection || selection.kind !== request.inputKind)
    throw new Error('mail_source_not_selected')
  const paths = await Promise.all(request.paths.map((path) => canonical(path)))
  if (selection.kind === 'files') {
    if (paths.some((path) => !selection.paths.has(path)))
      throw new Error('mail_source_not_selected')
    return
  }
  if (paths.length !== 1 || paths[0] !== selection.path) throw new Error('mail_source_not_selected')
}

function sendProgress(event: IpcMainInvokeEvent) {
  return (progress: MailArchiveProgress): void => {
    if (!event.sender.isDestroyed()) event.sender.send(CHANNELS.mailArchiveProgress, progress)
  }
}

export function registerMailArchiveHandlers(service: MailArchiveService): void {
  handlePlain(CHANNELS.mailArchivePickFiles, async (_raw, event): Promise<string[]> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '메일 원본', extensions: ['eml', 'pst'] }]
    })
    if (result.canceled) {
      selections.delete(event.sender)
      return []
    }
    const paths = await Promise.all(result.filePaths.map((path) => canonical(path)))
    selections.set(event.sender, { kind: 'files', paths: new Set(paths) })
    return paths
  })

  handlePlain(CHANNELS.mailArchivePickEmlFolder, async (_raw, event): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'EML 폴더 선택'
    })
    if (result.canceled || result.filePaths.length === 0) {
      selections.delete(event.sender)
      return null
    }
    const path = await canonical(result.filePaths[0]!)
    selections.set(event.sender, { kind: 'eml-folder', path })
    return path
  })

  handle(
    CHANNELS.mailArchiveImport,
    MailArchiveImportRequestSchema,
    'reject',
    async (request, event) => {
      await assertPickedSelection(request, event)
      return service.import(request, sendProgress(event))
    }
  )
  handle(
    CHANNELS.mailArchiveCancel,
    MailArchiveCancelRequestSchema,
    'reject',
    (request): { cancelled: boolean } => ({ cancelled: service.cancel(request.id) })
  )
  handle(CHANNELS.mailArchiveSearch, MailArchiveSearchRequestSchema, { fallback: [] }, (request) =>
    service.search(request)
  )
  handle(CHANNELS.mailArchiveGet, MailArchiveGetRequestSchema, 'reject', (request) =>
    service.get(request)
  )
  handlePlain(CHANNELS.mailArchiveStats, (): ReturnType<MailArchiveService['stats']> =>
    service.stats()
  )
}
