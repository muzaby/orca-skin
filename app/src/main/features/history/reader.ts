import { localRowMessageId, orphanMessageId } from '../../../shared/message-id'
import type { LoadedMessage } from '../../../shared/ipc'
import type { HistoryMessageHeader } from '../../infra/db/types'
import { parseAgentKind } from '../../../shared/agent-kind'
import { parseStoredExtraDirectories } from '../../../shared/extra-directories'
import type { LoadedSession } from '../../../shared/protocol'
import type { NativeHistorySnapshot } from '../../adapters/common/native-history'
import type { DbQueries } from '../../infra/db'
import { usageRowToTelemetry } from '../../infra/ipc/dto'
import { localMessages, projectNativeHistory } from './native-projection'
import { forkNativeSuffix } from './fork-native'
import { recoveryArchive } from './native-recovery'

// 영속 세션의 복원 조립. 현재 실행 상태(activity)는 IPC 조립 루트가 덧붙인다.
export function loadSession(
  db: DbQueries,
  sessionId: string,
  getCwd: (projectId?: string | null) => string,
  refreshedSnapshot?: NativeHistorySnapshot
): LoadedSession | null {
  const projection = readHistorySource(db, sessionId, refreshedSnapshot)
  const meta = loadSessionMetadata(db, sessionId, getCwd)
  if (!meta) return null
  return {
    ...meta,
    messages: projection.messages,
    ...(projection.nativeSync ? { nativeSync: projection.nativeSync } : {})
  }
}

export type SourceAlias = { source: 'local' | 'native' | 'archive'; identity: string }
export interface HistorySource {
  messages: LoadedMessage[]
  aliases: Map<string, SourceAlias[]>
  sourceBytes: number
  nativeSync?: LoadedSession['nativeSync']
}

export function readHistorySource(
  db: DbQueries,
  sessionId: string,
  refreshedSnapshot?: NativeHistorySnapshot,
  headers?: HistoryMessageHeader[]
): HistorySource {
  const recovery = db.nativeHistory?.recovery?.(sessionId)
  const loadedRows = db.loadParts(sessionId)
  const rows = recovery
    ? loadedRows.filter((row) => row.message_id > recovery.local_frontier)
    : loadedRows
  const marker = !recovery ? db.forkPrefix?.(sessionId) : undefined
  const localHeaders = (
    headers ?? (marker !== undefined ? db.historyIndex.headers(sessionId) : undefined)
  )?.filter((row) => !recovery || row.message_id > recovery.local_frontier)
  const stored = db.nativeHistory?.get(sessionId)
  const aliases = new Map<string, SourceAlias[]>()
  const alias = (key: string, source: SourceAlias['source'], identity: string): void => {
    const list = aliases.get(key)
    if (list) list.push({ source, identity })
    else aliases.set(key, [{ source, identity }])
  }
  let nativeSync: LoadedSession['nativeSync']
  let messages: LoadedMessage[]
  if (stored) {
    try {
      const snapshot =
        refreshedSnapshot ?? (JSON.parse(stored.payload_json) as NativeHistorySnapshot)
      const bindings = db.nativeHistory.bindings(sessionId)
      const native =
        marker === undefined
          ? snapshot.messages
          : forkNativeSuffix(snapshot.messages, bindings, marker)
      const suffixRows = marker === undefined ? rows : rows.filter((r) => r.message_id > marker)
      const suffixHeaders =
        marker === undefined ? localHeaders : localHeaders?.filter((r) => r.message_id > marker)
      const prefix =
        marker === undefined
          ? []
          : localMessages(
              rows.filter((r) => r.message_id <= marker),
              localHeaders?.filter((r) => r.message_id <= marker)
            )
      const projection = projectNativeHistory(
        { ...snapshot, messages: native },
        suffixRows,
        bindings,
        native.length || marker === undefined ? stored.local_frontier : 0,
        suffixHeaders
      )
      messages = [...prefix, ...projection.messages]
      if (headers)
        native.forEach((message, i) => {
          for (const key of new Set([message.id, ...(message.sourceIds ?? [])]))
            alias(projection.nativeKeys[i], 'native', key)
        })
      nativeSync = {
        status: 'ready',
        ...(projection.orphaned
          ? {
              message:
                '원본 메시지에 연결할 수 없는 이전 Orcinus orca 부가 기록을 대화 끝에 보존했습니다.'
            }
          : {})
      }
    } catch {
      messages = localMessages(rows, localHeaders)
      nativeSync = {
        status: 'unavailable',
        message: '저장된 원본 이력을 읽을 수 없어 Orcinus orca 보관 기록을 표시합니다.'
      }
    }
  } else messages = localMessages(rows, localHeaders)
  if (localHeaders) {
    const keys = new Set(messages.map((m) => m.id))
    for (const row of localHeaders) {
      const key = row.message_key ?? localRowMessageId(row.message_id)
      if (keys.has(key)) alias(key, 'local', String(row.message_id))
      else if (keys.has(orphanMessageId(key)))
        alias(orphanMessageId(key), 'local', String(row.message_id))
    }
  }
  const archive = recoveryArchive(recovery)
  if (headers && recovery) archive.forEach((m, i) => alias(m.id, 'archive', String(i)))
  const sourceBytes = headers
    ? Buffer.byteLength(stored?.payload_json ?? '') +
      Buffer.byteLength(recovery?.archive_json ?? '') +
      loadedRows.reduce((sum, row) => sum + Buffer.byteLength(row.payload_json), 0)
    : 0
  return { messages: [...archive, ...messages], aliases, sourceBytes, nativeSync }
}

export function loadSessionMetadata(
  db: DbQueries,
  sessionId: string,
  getCwd: (projectId?: string | null) => string
): Omit<LoadedSession, 'messages'> | null {
  const meta = db.getSessionById(sessionId)
  if (!meta) return null
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
    providerKey: meta.provider_key,
    modelFamily: meta.last_model ?? lastTelemetry?.model ?? null,
    projectId: meta.project_id,
    cwd: meta.cwd ?? getCwd(meta.project_id),
    extraDirs: parseStoredExtraDirectories(meta.extra_dirs),
    ...(lastTelemetry ? { lastTelemetry } : {}),
    ...(costUsd > 0 ? { costUsd } : {}),
    ...(lineage ? { lineage } : {}),
    ...(worktree ? { worktree } : {})
  }
}
