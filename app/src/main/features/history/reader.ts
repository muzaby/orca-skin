import type { LoadedSession } from '../../../shared/protocol'
import type { NativeHistorySnapshot } from '../../adapters/common/native-history'
import { parseStoredExtraDirectories } from '../../../shared/extra-directories'
import type { DbQueries } from '../../infra/db'
import { parseAgentKind } from '../../../shared/agent-kind'
import { usageRowToTelemetry } from '../../infra/ipc/dto'
import { localMessages, projectNativeHistory } from './native-projection'

// 영속 세션의 복원 조립. 현재 실행 상태(activity)는 IPC 조립 루트가 덧붙인다.
export function loadSession(
  db: DbQueries,
  sessionId: string,
  getCwd: (projectId?: string | null) => string
): LoadedSession | null {
  // 세션의 모든 파트를 메시지 순서(message_idx) → 파트 순서(part_idx)로 조회해 재구성.
  const partRows = db.loadParts(sessionId)
  const meta = db.getSessionById(sessionId)
  if (!meta) return null
  const stored = db.nativeHistory?.get(sessionId)
  if (partRows.length === 0 && !stored) return null
  let messages = localMessages(partRows)
  let nativeSync: LoadedSession['nativeSync']
  if (stored) {
    try {
      const snapshot = JSON.parse(stored.payload_json) as NativeHistorySnapshot
      const projected = projectNativeHistory(
        snapshot,
        partRows,
        db.nativeHistory.bindings(sessionId),
        stored.local_frontier
      )
      messages = projected.messages
      nativeSync = {
        status: 'ready',
        ...(projected.orphaned
          ? {
              message: '원본 메시지에 연결할 수 없는 이전 Orca 부가 기록을 대화 끝에 보존했습니다.'
            }
          : {})
      }
    } catch {
      nativeSync = {
        status: 'unavailable',
        message: '저장된 원본 이력을 읽을 수 없어 Orca 보관 기록을 표시합니다.'
      }
    }
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
    agentKind: parseAgentKind(meta.agent_kind),
    title: meta.title,
    messages,
    ...(nativeSync ? { nativeSync } : {}),
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
