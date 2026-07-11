// ClassifiedError.category → 카탈로그 키. 에러 배너(Exchange TurnErrorBanner)와 트랜스크립트
// ErrorCard·재시도 상태(PendingAssistant)가 공유한다. 라벨 문자열이 아니라 **키**만 주고
// 렌더에서 tr() 해석한다(0096 stale-방지 패턴 — 언어 전환 시 라이브 갱신). 미지정 category 는
// null 을 반환해 소비자가 원문 키를 그대로 노출한다(seam category 가 추가돼도 깨지지 않게).

import type { ErrorCategory } from '../../../../../shared/ipc'
import type { MessageKey } from '../../../shared/i18n'

export const ERROR_CATEGORY_KEYS: Record<ErrorCategory, MessageKey> = {
  provider_connection_error: 'errors.category.provider_connection_error',
  auth_error: 'errors.category.auth_error',
  permission_denied: 'errors.category.permission_denied',
  tool_execution_error: 'errors.category.tool_execution_error',
  stream_error: 'errors.category.stream_error',
  capability_unsupported: 'errors.category.capability_unsupported',
  schema_validation_error: 'errors.category.schema_validation_error',
  user_cancelled: 'errors.category.user_cancelled'
}

export function errorCategoryKey(category: string): MessageKey | null {
  return ERROR_CATEGORY_KEYS[category as ErrorCategory] ?? null
}
