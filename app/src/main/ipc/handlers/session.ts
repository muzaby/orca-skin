// session 도메인 핸들러 — cwd / list / load / delete / rename.
// 검증 실패 정책(조회·삭제·rename = 무해 폴백)은 registry.ts 의 등록부 명시 규약을 따른다.

import {
  CHANNELS,
  DeleteSessionRequestSchema,
  LoadSessionRequestSchema,
  RenameSessionRequestSchema,
  type LoadedMessage,
  type LoadedSession,
  type SessionListItem
} from '../../../shared/protocol'
import { usageRowToTelemetry } from '../../usage/usageMap'
import type { RouterContext } from '../context'
import { partFromRow, toSessionListItem } from '../dto'
import { handle, handlePlain } from '../registry'

export function registerSessionHandlers(ctx: RouterContext): void {
  // Renderer 가 세션 init 이벤트 전에도 cwd 를 알 수 있도록 노출. chat send 와
  // 동일한 cwd 단일 소스 — 현재는 home 고정.
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
          cur = { role: r.role, parts: [], createdAt: r.created_at }
          messages.push(cur)
          curId = r.message_id
        }
        cur!.parts.push(partFromRow(r))
      }

      // 세션 마지막 턴 사용량 → 컨텍스트 도넛/패널 복원(세션 수명 동안 표시).
      const usage = ctx.db.getLatestTurnUsage(req.sessionId)
      const lastTelemetry = usage ? usageRowToTelemetry(usage.turn, usage.modelUsage) : undefined

      return {
        id: meta.id,
        backend: meta.backend,
        title: meta.title,
        messages,
        providerKey: meta.provider_key,
        ...(lastTelemetry ? { lastTelemetry } : {})
      }
    }
  )

  handle(
    CHANNELS.sessionDelete,
    DeleteSessionRequestSchema,
    { fallback: undefined },
    (req): void => {
      ctx.db.deleteSession(req.sessionId)
      // 영속화된 lastSessionId 가 삭제 대상이면 같이 해제.
      const current = ctx.settings.getAll()
      if (current.lastSessionId === req.sessionId) {
        ctx.settings.patch({ lastSessionId: null })
      }
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
}
