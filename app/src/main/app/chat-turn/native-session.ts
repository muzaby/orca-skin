import type { SessionAdapter } from '../../adapters/common/types'
import type { NativeHistoryRequest } from '../../adapters/common/native-history'
import { makeClassifiedError } from '../../infra/errors'
import type { ClassifiedError } from '../../../shared/ipc'
import type { DbQueries } from '../../infra/db'
import { loadSession } from '../../features/history/reader'
import { archivePrompt, recoveryArchive } from '../../features/history/native-recovery'

export interface NativeSessionPreparation {
  nativeSessionId?: string
  recoveryHistory?: string
  recoveryFreshStart?: boolean
}

/** Only a confirmed absence permits reconstruction. Network/auth failures never fork history. */
export async function prepareNativeSession(
  adapter: Pick<SessionAdapter, 'readHistory' | 'recoverSession'>,
  request: NativeHistoryRequest,
  db: DbQueries,
  getCwd: (projectId?: string | null) => string
): Promise<{ ok: true; value: NativeSessionPreparation } | { ok: false; error: ClassifiedError }> {
  if (!adapter.readHistory) return { ok: true, value: {} }
  try {
    const recovery = db.nativeHistory?.recovery?.(request.sessionId)
    const nativeId = recovery?.native_id ?? request.sessionId
    const result = await adapter.readHistory({ ...request, sessionId: nativeId })
    if (result.status === 'missing' && adapter.recoverSession) {
      const archive = loadSession(db, request.sessionId, getCwd)
      if (!archive) throw new Error('Conversation was removed during recovery')
      const before = db.nativeHistory.observe(request.sessionId)
      const created = await adapter.recoverSession({ ...request, sessionId: nativeId })
      db.nativeHistory.prepareRecovery({
        sessionId: request.sessionId,
        nativeId: created.sessionId,
        freshStart: created.freshStart,
        archiveJson: JSON.stringify(archive.messages),
        frontier: before.frontier,
        expectedVersion: before.version,
        messages: archive.messages.map((message, index) => ({
          id: String(index),
          role: message.role,
          createdAt: message.createdAt,
          content: message.parts
            .filter((part) => part.type === 'text')
            .map((part) => (part.type === 'text' ? part.text : ''))
            .join('\n')
        }))
      })
      return {
        ok: true,
        value: {
          nativeSessionId: created.sessionId,
          recoveryHistory: archivePrompt(archive.messages),
          recoveryFreshStart: created.freshStart
        }
      }
    }
    if (result.status === 'ready' || result.status === 'busy' || result.status === 'unchanged') {
      if (recovery && !recovery.accepted) {
        const received =
          result.status === 'ready' &&
          result.snapshot.messages.some(
            (message) =>
              message.id === recovery.prompt_id ||
              message.sourceIds?.includes(recovery.prompt_id ?? '')
          )
        if (received && recovery.prompt_id)
          db.nativeHistory.acceptRecovery(request.sessionId, recovery.prompt_id)
        else if (result.status === 'ready' && result.snapshot.messages.length === 0) {
          return {
            ok: true,
            value: {
              nativeSessionId: nativeId,
              recoveryHistory: archivePrompt(recoveryArchive(recovery)),
              recoveryFreshStart: false
            }
          }
        } else if (!received) throw new Error('Native recovery is still settling')
      }
      return { ok: true, value: { nativeSessionId: nativeId } }
    }
    return { ok: false, error: makeClassifiedError('schema_validation_error', result.message) }
  } catch {
    return {
      ok: false,
      error: makeClassifiedError(
        'schema_validation_error',
        '하네스 원본을 확인하거나 복구할 수 없습니다. 보관 대화는 유지됩니다. 연결과 접근 권한을 확인한 후 다시 시도해 주세요.'
      )
    }
  }
}
