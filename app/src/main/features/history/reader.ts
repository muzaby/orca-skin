import type { LoadedMessage, LoadedSession } from '../../../shared/protocol'
import { parseStoredExtraDirectories } from '../../../shared/extra-directories'
import type { DbQueries } from '../../infra/db'
import { partFromRow, usageRowToTelemetry } from '../../infra/ipc/dto'

// 영속 세션의 복원 조립. 현재 실행 상태(activity)는 IPC 조립 루트가 덧붙인다.
export function loadSession(
  db: DbQueries,
  sessionId: string,
  getCwd: (projectId?: string | null) => string
): LoadedSession | null {
  // 세션의 모든 파트를 메시지 순서(message_idx) → 파트 순서(part_idx)로 조회해 재구성.
  const partRows = db.loadParts(sessionId)
  if (partRows.length === 0) return null
  const meta = db.getSessionById(sessionId)
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
  const usage = db.usage.getLatestTurnUsage(sessionId)
  const lastTelemetry = usage ? usageRowToTelemetry(usage.turn, usage.modelUsage) : undefined
  // 세션 한정 비용 총합(0122 r2) — 상태 팝오버 "이 세션에서 사용한 비용" 시드.
  const costUsd = db.usage.sumSessionCostUsd(sessionId)

  // 0064 continuity — fork/handoff 파생 세션이면 부모 관계를 실어 출처 배너를 복원한다.
  // 부모가 이미 삭제됐으면 lineage 행도 CASCADE 로 사라져 자연히 미포함된다.
  const lineageRow = db.getLineage(sessionId)
  const lineage =
    lineageRow && (lineageRow.relation === 'fork' || lineageRow.relation === 'handoff')
      ? {
          parentSessionId: lineageRow.parent_session_id,
          relation: lineageRow.relation,
          parentTitle: db.getSessionById(lineageRow.parent_session_id)?.title ?? null
        }
      : undefined

  // 0211 — 앱 관리 worktree 세션의 **표시 정본**. row 가 없으면(비격리·0210 D-107 폴백
  // 후) 필드를 싣지 않고, 그때는 소비자가 `cwd` 파생으로 폴백한다 — 폴백 경로가 곧
  // 원본이라 그 값이 옳다. 재시작 뒤 이름을 복원하는 자리가 여기다.
  const worktreeRow = db.getManagedWorktreeBySession(sessionId)
  const worktree = worktreeRow
    ? { sourceCwd: worktreeRow.source_cwd, repoRoot: worktreeRow.repo_root }
    : undefined

  return {
    id: meta.id,
    backend: meta.backend,
    agentKind: meta.agent_kind,
    title: meta.title,
    messages,
    providerKey: meta.provider_key,
    projectId: meta.project_id,
    cwd: meta.cwd ?? getCwd(meta.project_id),
    extraDirs: parseStoredExtraDirectories(meta.extra_dirs),
    ...(lastTelemetry ? { lastTelemetry } : {}),
    ...(costUsd > 0 ? { costUsd } : {}),
    ...(lineage ? { lineage } : {}),
    ...(worktree ? { worktree } : {})
  }
}
