// session 도메인 핸들러 — cwd / list / load / delete / rename.
// 검증 실패 정책(조회·삭제·rename = 무해 폴백)은 registry.ts 의 등록부 명시 규약을 따른다.

import {
  CHANNELS,
  DeleteSessionRequestSchema,
  LoadSessionRequestSchema,
  RenameSessionRequestSchema,
  SetSessionPinnedSchema,
  type LoadedSession,
  type SessionListItem
} from '../../../shared/protocol'
import { loadSession } from '../../features/history/reader'
import type { RouterContext } from '../context'
import { toSessionListItem } from '../../infra/ipc/dto'
import { handle, handlePlain } from '../../infra/ipc/handle'
import type { ChatActivitySnapshot } from '../../../shared/ipc'
import type { DeleteSessionResult } from '../../../shared/ipc'

// 세션 폐기 시 정리할 in-memory 소유자들(0151 AC8) — 컴포지션 루트가 주입한다. 세션 슬라이스가
// chat 슬라이스를 직접 참조하지 않기 위한 구조적 포트(main/AGENTS.md 해소책 ③).
interface SessionDisposeHooks {
  onSessionDisposed?: (sessionId: string) => void
  getActivity?: (sessionId: string) => ChatActivitySnapshot
  removeManagedWorktree?: (sessionId: string) => Promise<DeleteSessionResult>
}

type SessionHandlerContext = Pick<RouterContext, 'db' | 'getCwd'> & {
  settings: Pick<RouterContext['settings'], 'getAll' | 'patch'>
}

export function registerSessionHandlers(
  ctx: SessionHandlerContext,
  hooks: SessionDisposeHooks = {}
): void {
  // Renderer 가 세션 init 이벤트 전에도 cwd 를 알 수 있도록 노출. chat send 와
  // 동일한 cwd 단일 소스 — 인자 없는 호출은 비-프로젝트 기본(projects/default).
  handlePlain(CHANNELS.sessionCwd, (): string => ctx.getCwd())

  handlePlain(CHANNELS.sessionList, (): SessionListItem[] =>
    ctx.db.listSessions().map(toSessionListItem)
  )

  handle(
    CHANNELS.sessionLoad,
    LoadSessionRequestSchema,
    { fallback: null },
    (req): LoadedSession | null => {
      const session = loadSession(ctx.db, req.sessionId, (projectId) => ctx.getCwd(projectId))
      if (!session) return null
      return {
        ...session,
        ...(hooks.getActivity ? { activity: hooks.getActivity(req.sessionId) } : {})
      }
    }
  )

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
      const result = (await hooks.removeManagedWorktree?.(req.sessionId)) ?? { ok: true as const }
      if (!result.ok) return result
      // 먼저 런타임·미커밋 입력을 닫아 삭제 뒤 지각 이벤트가 DB에 다시 쓰는 경쟁을 막는다.
      hooks.onSessionDisposed?.(req.sessionId)
      ctx.db.deleteSession(req.sessionId)
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
