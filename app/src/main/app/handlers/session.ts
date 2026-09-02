// session 도메인 핸들러 — cwd / list / load / delete / rename.
// 검증 실패 정책(조회·삭제·rename = 무해 폴백)은 registry.ts 의 등록부 명시 규약을 따른다.

import {
  CHANNELS,
  DeleteSessionRequestSchema,
  LoadSessionRequestSchema,
  RenameSessionRequestSchema,
  SetSessionPinnedSchema,
  type LoadedMessage,
  type LoadedSession,
  type SessionListItem
} from '../../../shared/protocol'
import { usageRowToTelemetry } from '../../features/usage/usage-map'
import type { RouterContext } from '../context'
import { partFromRow, toSessionListItem } from '../../infra/ipc/dto'
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

export function registerSessionHandlers(ctx: RouterContext, hooks: SessionDisposeHooks = {}): void {
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
      // 세션의 모든 파트를 메시지 순서(message_idx) → 파트 순서(part_idx)로 조회해 재구성.
      const partRows = ctx.db.loadParts(req.sessionId)
      if (partRows.length === 0) return null
      const meta = ctx.db.getSessionById(req.sessionId)
      if (!meta) return null

      const messages: LoadedMessage[] = []
      let curId: number | null = null
      let cur: LoadedMessage | null = null
      for (const r of partRows) {
        if (r.message_id !== curId) {
          cur = {
            role: r.role,
            parts: [],
            createdAt: r.created_at,
            ...(r.role === 'assistant' && r.complete === 0 ? { incomplete: true } : {})
          }
          messages.push(cur)
          curId = r.message_id
        }
        cur!.parts.push(partFromRow(r))
      }

      // 세션 마지막 턴 사용량 → 컨텍스트 도넛/패널 복원(세션 수명 동안 표시).
      const usage = ctx.db.getLatestTurnUsage(req.sessionId)
      const lastTelemetry = usage ? usageRowToTelemetry(usage.turn, usage.modelUsage) : undefined
      // 세션 한정 비용 총합(0122 r2) — 상태 팝오버 "이 세션에서 사용한 비용" 시드.
      const costUsd = ctx.db.sumSessionCostUsd(req.sessionId)

      // 0064 continuity — fork/handoff 파생 세션이면 부모 관계를 실어 출처 배너를 복원한다.
      // 부모가 이미 삭제됐으면 lineage 행도 CASCADE 로 사라져 자연히 미포함된다.
      const lineageRow = ctx.db.getLineage(req.sessionId)
      const lineage =
        lineageRow && (lineageRow.relation === 'fork' || lineageRow.relation === 'handoff')
          ? {
              parentSessionId: lineageRow.parent_session_id,
              relation: lineageRow.relation,
              parentTitle: ctx.db.getSessionById(lineageRow.parent_session_id)?.title ?? null
            }
          : undefined

      // 0211 — 앱 관리 worktree 세션의 **표시 정본**. row 가 없으면(비격리·0210 D-107 폴백
      // 후) 필드를 싣지 않고, 그때는 소비자가 `cwd` 파생으로 폴백한다 — 폴백 경로가 곧
      // 원본이라 그 값이 옳다. 재시작 뒤 이름을 복원하는 자리가 여기다.
      const worktreeRow = ctx.db.getManagedWorktreeBySession(req.sessionId)
      const worktree = worktreeRow
        ? { sourceCwd: worktreeRow.source_cwd, repoRoot: worktreeRow.repo_root }
        : undefined

      return {
        id: meta.id,
        backend: meta.backend,
        title: meta.title,
        messages,
        providerKey: meta.provider_key,
        projectId: meta.project_id,
        cwd: meta.cwd ?? ctx.getCwd(meta.project_id),
        ...(lastTelemetry ? { lastTelemetry } : {}),
        ...(costUsd > 0 ? { costUsd } : {}),
        ...(lineage ? { lineage } : {}),
        ...(worktree ? { worktree } : {}),
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
