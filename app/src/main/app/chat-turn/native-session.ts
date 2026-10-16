import type { SessionAdapter } from '../../adapters/common/types'
import type { NativeHistoryRequest } from '../../adapters/common/native-history'
import { makeClassifiedError } from '../../infra/errors'
import type { ClassifiedError } from '../../../shared/ipc'

/** A cold resume must resolve the native ID, never reconstruct context from the Orca archive. */
export async function nativeSessionError(
  adapter: Pick<SessionAdapter, 'readHistory'>,
  request: NativeHistoryRequest
): Promise<ClassifiedError | undefined> {
  if (!adapter.readHistory) return undefined
  try {
    const result = await adapter.readHistory(request)
    // Busy protects display refresh; it still proves the native session exists for an explicit resume.
    if (result.status === 'ready' || result.status === 'busy') return undefined
    return makeClassifiedError('schema_validation_error', result.message)
  } catch {
    return makeClassifiedError(
      'schema_validation_error',
      '하네스 원본에 연결할 수 없습니다. 원본 경로와 접근 권한을 확인한 후 다시 시도해 주세요.'
    )
  }
}
