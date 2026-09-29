import { BrowserWindow, dialog, type IpcMainInvokeEvent } from 'electron'
import { realpath } from 'node:fs/promises'
import { basename } from 'node:path'
import { CHANNELS } from '../../../shared/ipc'
import {
  MailArchiveCancelRequestSchema,
  MailArchiveAttachmentRequestSchema,
  MailArchiveGetRequestSchema,
  MailArchiveImportRequestSchema,
  MailArchiveSearchRequestSchema,
  MailArchiveSourceRequestSchema,
  MailArchiveThreadRequestSchema
} from '../../../shared/mail-archive'
import type {
  MailArchiveProgress,
  MailArchiveAttachmentExportResult,
  MailArchiveSourceRemovalResult
} from '../../../shared/mail-archive'
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

function safeAttachmentName(name: string): string {
  const value = basename(name.replaceAll('\\', '/'))
    .replace(/\p{Cc}/gu, '')
    .trim()
  return value && value !== '.' && value !== '..' ? value : '첨부파일'
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
  handle(
    CHANNELS.mailArchiveExportAttachment,
    MailArchiveAttachmentRequestSchema,
    'reject',
    async (request, event): Promise<MailArchiveAttachmentExportResult> =>
      service.exportAttachment(request.id, async (attachment) => {
        const options = {
          title: '메일 첨부파일 저장',
          buttonLabel: '저장',
          defaultPath: safeAttachmentName(attachment.name)
        }
        const owner = BrowserWindow.fromWebContents(event.sender)
        const result = owner
          ? await dialog.showSaveDialog(owner, options)
          : await dialog.showSaveDialog(options)
        return result.canceled ? null : result.filePath
      })
  )
  handle(
    CHANNELS.mailArchiveThread,
    MailArchiveThreadRequestSchema,
    { fallback: { mails: [], relations: [], truncated: false } },
    (request) => service.thread(request)
  )
  handlePlain(CHANNELS.mailArchiveSources, (): ReturnType<MailArchiveService['sources']> =>
    service.sources()
  )
  handle(
    CHANNELS.mailArchiveRemoveSource,
    MailArchiveSourceRequestSchema,
    'reject',
    async (request, event): Promise<MailArchiveSourceRemovalResult> => {
      const source = (await service.sources()).find((item) => item.id === request.id)
      if (!source) return { state: 'not-found' }
      const options = {
        type: 'warning' as const,
        title: '메일 자료원 제거',
        message: `“${source.name}” (자료원 ${source.id.slice(0, 8)})을 보관함에서 제거할까요?`,
        detail: [
          `현재 검색 가능한 메일 ${source.messageCount}개 중 다른 자료원과 공유된 ${source.sharedMessageCount}개는 유지됩니다.`,
          '이 자료원에만 있는 메일은 색인에서 삭제됩니다. 원본 파일은 삭제하지 않습니다.',
          '진행 중인 가져오기가 있으면 해당 작업이 취소됩니다.'
        ].join('\n'),
        buttons: ['취소', '자료원 제거'],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      }
      const owner = BrowserWindow.fromWebContents(event.sender)
      const confirmation = owner
        ? await dialog.showMessageBox(owner, options)
        : await dialog.showMessageBox(options)
      if (confirmation.response !== 1) return { state: 'cancelled' }
      return service.removeSource(request.id)
    }
  )
  handlePlain(CHANNELS.mailArchiveStats, (): ReturnType<MailArchiveService['stats']> =>
    service.stats()
  )
}
