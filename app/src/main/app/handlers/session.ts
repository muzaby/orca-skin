// session 도메인 핸들러 — cwd / list / load / delete / rename.
// 검증 실패 정책(조회·삭제·rename = 무해 폴백)은 registry.ts 의 등록부 명시 규약을 따른다.

import type { ChatActivitySnapshot, DeleteSessionResult } from '../../../shared/ipc'
import {
  AddSessionDirectorySchema,
  CHANNELS,
  DeleteSessionRequestSchema,
  RenameSessionRequestSchema,
  SetSessionPinnedSchema,
  type SessionListItem
} from '../../../shared/protocol'
import type { NativeSyncResult } from '../../features/history/native-sync'
import { toSessionListItem } from '../../infra/ipc/dto'
import { handle, handlePlain } from '../../infra/ipc/handle'
import type { RouterContext } from '../context'
import { registerSessionLoadHandlers } from '../data-host/session-load'
import { resolveLandingCwd } from './session-cwd'
import { addSessionDirectory } from './session-directory'

// 세션 폐기 시 정리할 in-memory 소유자들(0151 AC8) — 컴포지션 루트가 주입한다. 세션 슬라이스가
// chat 슬라이스를 직접 참조하지 않기 위한 구조적 포트(main/AGENTS.md 해소책 ③).
// 실행 상태는 에이전트 호스트에 있다 — 데이터 호스트는 물어서 안다(0324 F4 · AC19′ · AC43). 에이전트
// 호스트가 없으면 쉬는 상태로 답한다(그 판정은 주입하는 쪽이 한다).
export interface SessionDisposeHooks {
  historyIndex?: import('../../features/history/turn-index').HistoryIndex
  isSessionBusy?: (sessionId: string) => boolean | Promise<boolean>
  onSessionDisposed?: (sessionId: string) => void | Promise<void>
  getActivity?: (sessionId: string) => ChatActivitySnapshot | Promise<ChatActivitySnapshot>
  refreshHistory?: (sessionId: string) => Promise<NativeSyncResult | undefined>
}

type SessionHandlerContext = Pick<RouterContext, 'db' | 'getCwd'> & {
  settings: Pick<RouterContext['settings'], 'getAll' | 'patch'>
}

export function registerSessionHandlers(
  ctx: SessionHandlerContext,
  hooks: SessionDisposeHooks = {}
): void {
  handle(
    CHANNELS.sessionAddDirectory,
    AddSessionDirectorySchema,
    { fallback: { ok: false as const, reason: 'invalid-directory' as const } },
    (request) =>
      addSessionDirectory(
        {
          db: ctx.db,
          isSessionBusy: hooks.isSessionBusy ?? (() => true)
        },
        request
      )
  )

  // Renderer 부트 시 마지막 작업 폴더를 복원하고, 유효하지 않으면 기본 경로로 폴백한다.
  handlePlain(CHANNELS.sessionCwd, () =>
    resolveLandingCwd(ctx.settings.getAll().lastCwd, ctx.getCwd())
  )

  handlePlain(CHANNELS.sessionList, (): SessionListItem[] =>
    ctx.db.listSessions().map(toSessionListItem)
  )

  // 본문 로드·갱신은 조각 전송 모듈이 받는다(0324 EP-4′).
  registerSessionLoadHandlers(ctx, hooks)

  handle(
    CHANNELS.sessionDelete,
    DeleteSessionRequestSchema,
    {
      fallback: {
        ok: false,
        reason: 'worktree-check-failed',
        message: '세션 삭제 요청이 올바르지 않습니다.'
      }
    },
    async (req): Promise<DeleteSessionResult> => {
      // 먼저 런타임·미커밋 입력을 닫아 삭제 뒤 지각 이벤트가 DB에 다시 쓰는 경쟁을 막는다.
      await hooks.onSessionDisposed?.(req.sessionId)
      ctx.db.hideSession(req.sessionId)
      // 영속화된 lastSessionId 가 삭제 대상이면 같이 해제.
      const current = ctx.settings.getAll()
      if (current.lastSessionId === req.sessionId) {
        ctx.settings.patch({ lastSessionId: null })
      }
      return { ok: true }
    }
  )

  handle(
    CHANNELS.sessionRename,
    RenameSessionRequestSchema,
    { fallback: undefined },
    (req): void => {
      ctx.db.renameSession(req.sessionId, req.title, Date.now())
    }
  )

  // 0129 고정 토글 — pinned=true 면 현재 시각(정렬 키 겸용), false 면 null.
  handle(
    CHANNELS.sessionSetPinned,
    SetSessionPinnedSchema,
    { fallback: undefined },
    (req): void => {
      ctx.db.setSessionPinned(req.sessionId, req.pinned ? Date.now() : null)
    }
  )
}
