import { BrowserWindow, dialog, type IpcMainInvokeEvent, type OpenDialogOptions } from 'electron'
import { basename } from 'node:path'
import { CHANNELS } from '../../../shared/ipc'
import {
  MailArchiveIdRequestSchema,
  MailArchiveSearchRequestSchema,
  MailArchiveThreadRequestSchema,
  type MailArchiveImportResult,
  type MailArchiveProgress,
  type MailArchiveSourceRemovalResult
} from '../../../shared/mail-archive'
import type { MailArchiveService } from '../../features/plugins/mail-archive/service'
import { handle, handlePlain } from '../../infra/ipc/handle'

/** plan §14: 진행 이벤트는 초당 4회까지. 완료·취소는 항상 보낸다. */
const PROGRESS_INTERVAL_MS = 250

function sendProgress(event: IpcMainInvokeEvent): (progress: MailArchiveProgress) => void {
  let lastSentAt = 0
  return (progress) => {
    const now = Date.now()
    if (progress.state === 'running' && now - lastSentAt < PROGRESS_INTERVAL_MS) return
    lastSentAt = now
    if (!event.sender.isDestroyed()) event.sender.send(CHANNELS.mailArchiveProgress, progress)
  }
}

function safeAttachmentName(name: string): string {
  const value = basename(name.replaceAll('\\', '/'))
    .replace(/\p{Cc}/gu, '')
    .trim()
  return value && value !== '.' && value !== '..' ? value : '첨부파일'
}

async function pickPaths(event: IpcMainInvokeEvent, options: OpenDialogOptions): Promise<string[]> {
  const owner = BrowserWindow.fromWebContents(event.sender)
  const result = owner
    ? await dialog.showOpenDialog(owner, options)
    : await dialog.showOpenDialog(options)
  return result.canceled ? [] : result.filePaths
}

export function registerMailArchiveHandlers(service: MailArchiveService): void {
  // OS 선택기 결과를 main 안에서 바로 가져오기로 넘긴다. 원본 경로는 renderer에 가지 않는다.
  handlePlain(
    CHANNELS.mailArchiveImportFiles,
    async (_raw, event): Promise<MailArchiveImportResult | null> => {
      const paths = await pickPaths(event, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: '메일 원본', extensions: ['eml', 'pst'] }]
      })
      if (paths.length === 0) return null
      return service.import({ inputKind: 'files', paths }, sendProgress(event))
    }
  )
  handlePlain(
    CHANNELS.mailArchiveImportEmlFolder,
    async (_raw, event): Promise<MailArchiveImportResult | null> => {
      const paths = await pickPaths(event, {
        properties: ['openDirectory'],
        title: 'EML 폴더 선택'
      })
      if (paths.length === 0) return null
      return service.import({ inputKind: 'eml-folder', paths: [paths[0]!] }, sendProgress(event))
    }
  )
  handlePlain(CHANNELS.mailArchiveStatus, () => service.progress())
  handle(CHANNELS.mailArchiveCancel, MailArchiveIdRequestSchema, 'reject', (request) => ({
    cancelled: service.cancel(request.id)
  }))
  handle(CHANNELS.mailArchiveSearch, MailArchiveSearchRequestSchema, { fallback: [] }, (request) =>
    service.search(request)
  )
  handle(CHANNELS.mailArchiveGet, MailArchiveIdRequestSchema, 'reject', (request) =>
    service.get(request.id)
  )
  handle(
    CHANNELS.mailArchiveThread,
    MailArchiveThreadRequestSchema,
    { fallback: { mails: [], truncated: false } },
    (request) => service.thread(request)
  )
  handle(
    CHANNELS.mailArchiveExportAttachment,
    MailArchiveIdRequestSchema,
    'reject',
    (request, event) =>
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
        return result.canceled ? null : (result.filePath ?? null)
      })
  )
  handlePlain(CHANNELS.mailArchiveSources, () => service.sources())
  handle(
    CHANNELS.mailArchiveRemoveSource,
    MailArchiveIdRequestSchema,
    'reject',
    async (request, event): Promise<MailArchiveSourceRemovalResult> => {
      const source = (await service.sources()).find((item) => item.id === request.id)
      if (!source) return { state: 'not-found' }
      const options = {
        type: 'warning' as const,
        title: '메일 자료원 제거',
        message: `“${source.name}”을 보관함에서 제거할까요?`,
        detail: [
          `검색 가능한 메일 ${source.messageCount}개 중 다른 자료원과 공유된 ${source.sharedMessageCount}개는 유지됩니다.`,
          '이 자료원에만 있는 메일은 색인에서 삭제됩니다. 원본 파일은 삭제하지 않습니다.',
          '이 자료원을 가져오는 중이면 그 작업이 취소됩니다.'
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
  handlePlain(CHANNELS.mailArchiveStats, () => service.stats())
}
