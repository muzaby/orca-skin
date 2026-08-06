// 파일·검색 IPC 6종 — 디렉토리 나열·첨부 선택·디렉토리 선택·경로 열기·첨부 읽기 + 대화 검색
// (0179 에서 misc 에서 분리). 검색이 여기 있는 이유는 "renderer 가 내용을 찾아 여는" 같은
// 사용자 동선이기 때문이다.

import {
  CHANNELS,
  ListFilesRequestSchema,
  OpenPathRequestSchema,
  ReadAttachmentRequestSchema,
  SearchMessagesRequestSchema,
  type FileEntry,
  type PickedAttachment,
  type ReadAttachmentResult,
  type SearchHit
} from '../../../shared/protocol'
import { dialog, shell } from 'electron'
import { promises as fs } from 'node:fs'
import {
  fileMeta,
  assertAllowedAttachmentPath,
  bufferToBase64Chunked,
  SUPPORTED_IMAGE_MIME_TYPES
} from '../../features/chat/attachments'
import { listDir } from '../../features/chat/scan'
import { isWithinDir, projectsDir } from '../../infra/config/paths'
import { handle, handlePlain } from '../../infra/ipc/handle'
import type { RouterContext } from '../context'

export function registerFilesHandlers(ctx: RouterContext): void {
  handle(
    CHANNELS.filesList,
    ListFilesRequestSchema,
    { fallback: [] as FileEntry[] },
    (req): Promise<FileEntry[]> => listDir(req.cwd, req.relDir)
  )

  handlePlain(CHANNELS.filesPickAttachments, async (): Promise<PickedAttachment[]> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Attachments', extensions: ['txt', 'md', 'jpg', 'jpeg', 'png', 'webp', 'gif'] }
      ]
    })
    if (result.canceled) return []
    const picked: PickedAttachment[] = []
    for (const rawPath of result.filePaths) {
      const path = assertAllowedAttachmentPath(rawPath)
      const meta = await fileMeta(path)
      picked.push({ path, ...meta, sourceKind: 'dialog' })
    }
    return picked
  })

  handlePlain(CHANNELS.filesPickDirectory, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      defaultPath: ctx.getCwd(),
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0] ?? null
  })

  // 임의 경로 오픈 벡터를 차단한다 — 렌더러가 보낸 경로를 무검증으로 shell.openPath 하지 않고
  // (1) 실재 디렉토리(파일/실행파일 거부)이며 (2) projects 루트 하위이거나 실재 세션 cwd 인
  // 경우에만 연다. 정상 호출은 세션 cwd(파생 폴더 또는 사용자가 고른 영속 cwd)뿐이다.
  handle(CHANNELS.filesOpenPath, OpenPathRequestSchema, 'reject', async (req): Promise<void> => {
    const stat = await fs.stat(req.path).catch(() => null)
    if (!stat?.isDirectory()) throw new Error('디렉토리만 열 수 있습니다.')
    const allowed = isWithinDir(req.path, projectsDir()) || ctx.db.hasSessionWithCwd(req.path)
    if (!allowed) throw new Error('허용되지 않은 경로입니다.')
    const error = await shell.openPath(req.path)
    if (error) throw new Error(error)
  })

  handle(
    CHANNELS.filesReadAttachment,
    ReadAttachmentRequestSchema,
    'reject',
    async (req): Promise<ReadAttachmentResult> => {
      const path = assertAllowedAttachmentPath(req.path)
      const meta = await fileMeta(path)
      if (!SUPPORTED_IMAGE_MIME_TYPES.has(meta.mimeType)) {
        throw new Error('미리보기는 이미지 첨부만 지원합니다.')
      }
      // 대용량 이미지 동기 인코딩이 이벤트 루프를 점유하지 않게 청크 양보(0110).
      return { data: await bufferToBase64Chunked(await fs.readFile(path)), mimeType: meta.mimeType }
    }
  )

  // 대화 검색 — main thread 에서 FTS5 prepared statement 실행. better-sqlite3 가 sync 라 main 이
  // 블록되지만 FTS5 + LIMIT 30 의 latency 는 단위 ms 수준으로 renderer 의 150ms debounce 하에서
  // 체감 영향 없음. perf 회귀 발생 시 utilityProcess 로 이전 검토.
  handle(
    CHANNELS.searchMessages,
    SearchMessagesRequestSchema,
    { fallback: [] as SearchHit[] },
    (req): SearchHit[] => {
      const rows = ctx.db.searchMessages(req.q, req.limit ?? 30)
      return rows.map((r) => ({
        messageId: r.message_id,
        sessionId: r.session_id,
        sessionTitle: r.session_title,
        role: r.role,
        createdAt: r.created_at,
        snippet: r.snippet
      }))
    }
  )
}
