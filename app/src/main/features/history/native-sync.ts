import type { LoadedSession } from '../../../shared/ipc'
import type {
  NativeHistoryRequest,
  NativeHistoryCursor,
  NativeHistoryResult,
  NativeHistorySnapshot
} from '../../adapters/common/native-history'
import { isRecord } from '../../../shared/obj'
import type { DbQueries } from '../../infra/db'

type SyncStatus = NonNullable<LoadedSession['nativeSync']>

export interface NativeSyncDependencies {
  db: DbQueries
  read: (previous?: NativeHistoryRequest['previous']) => Promise<NativeHistoryResult>
  isBusy: () => boolean
  releaseIdleRuntime?: () => void
}

export function validNativeSnapshot(snapshot: NativeHistorySnapshot, sessionId: string): boolean {
  if (
    snapshot.sessionId !== sessionId ||
    !snapshot.sourceKey ||
    !snapshot.revision ||
    !Array.isArray(snapshot.messages)
  )
    return false
  const ids = new Set<string>()
  for (const message of snapshot.messages) {
    if (
      !message.id ||
      (message.role !== 'user' && message.role !== 'assistant') ||
      !Array.isArray(message.parts) ||
      !Number.isFinite(message.createdAt)
    )
      return false
    for (const id of new Set([message.id, ...(message.sourceIds ?? [])])) {
      if (typeof id !== 'string' || !id || ids.has(id)) return false
      ids.add(id)
    }
  }
  return true
}

/** Reads a consistent native view; never replays history into the execution bus. */
export async function refreshNativeHistory(
  sessionId: string,
  deps: NativeSyncDependencies
): Promise<SyncStatus> {
  const busy: SyncStatus = { status: 'busy' }
  if (deps.isBusy()) return busy
  if (!deps.db.getSessionById(sessionId))
    return { status: 'missing', message: '목록에서 제거된 대화입니다.' }
  // There is no await between the guard and release. Active children are never closed for a read.
  deps.releaseIdleRuntime?.()
  const before = deps.db.nativeHistory.observe(sessionId)
  let result: NativeHistoryResult
  try {
    const row = deps.db.nativeHistory.get(sessionId)
    const snapshot = row ? (JSON.parse(row.payload_json) as NativeHistorySnapshot) : undefined
    const candidate = row?.cursor_json
      ? (JSON.parse(row.cursor_json) as NativeHistoryCursor)
      : undefined
    const cursor =
      candidate?.version === 1 &&
      candidate.sourceKey === snapshot?.sourceKey &&
      candidate.revision === snapshot?.revision
        ? candidate
        : undefined
    result = await deps.read(snapshot ? { snapshot, cursor } : undefined)
  } catch {
    return {
      status: 'unavailable',
      message:
        '하네스 원본에 연결할 수 없어 보관된 대화를 표시합니다. 다시 열어 재시도할 수 있습니다.'
    }
  }
  if (
    deps.isBusy() ||
    !deps.db.getSessionById(sessionId) ||
    deps.db.nativeHistory.observe(sessionId).version !== before.version
  )
    return busy
  if (result.status !== 'ready') return result
  if (
    !validNativeSnapshot(result.snapshot, sessionId) ||
    (result.cursor &&
      (result.cursor.version !== 1 ||
        result.cursor.sourceKey !== result.snapshot.sourceKey ||
        result.cursor.revision !== result.snapshot.revision ||
        !isRecord(result.cursor.checkpoint)))
  ) {
    return {
      status: 'unavailable',
      message: '하네스 원본의 메시지 식별자를 확인할 수 없어 보관된 대화를 표시합니다.'
    }
  }
  const previous = deps.db.nativeHistory.get(sessionId)
  try {
    if (
      previous &&
      (JSON.parse(previous.payload_json) as NativeHistorySnapshot).sourceKey !==
        result.snapshot.sourceKey
    ) {
      return {
        status: 'migration-required',
        message: '이 대화의 하네스 저장 경로가 변경되었습니다. 기존 원본을 확인해 주세요.'
      }
    }
    const saved = deps.db.nativeHistory.replace({
      sessionId,
      payloadJson: JSON.stringify(result.snapshot),
      cursorJson: result.cursor ? JSON.stringify(result.cursor) : undefined,
      frontier: before.frontier,
      expectedVersion: before.version,
      now: Date.now(),
      messages: result.snapshot.messages.map((message) => ({
        id: message.id,
        role: message.role,
        createdAt: message.createdAt,
        content: message.parts
          .filter((part) => part.type === 'text' && !part.parentToolRunId)
          .map((part) => (part.type === 'text' ? part.text : ''))
          .join('\n')
      }))
    })
    return saved ? { status: 'ready' } : busy
  } catch {
    return {
      status: 'unavailable',
      message: '원본 이력을 보관하지 못해 이전 대화를 유지했습니다. 다시 열어 재시도해 주세요.'
    }
  }
}
