// ClassifiedError.category → 사용자용 한국어 라벨. 에러 배너(ChatTile)와 트랜스크립트
// ErrorCard 가 공유한다. 미지정 category 는 원문 키를 그대로 노출(seam category 가 추가돼도
// 깨지지 않게).

import type { ErrorCategory } from '../../../../../shared/ipc'

export const ERROR_CATEGORY_LABELS: Record<ErrorCategory, string> = {
  provider_connection_error: '백엔드 연결 오류',
  auth_error: '인증 오류',
  permission_denied: '권한 거부',
  tool_execution_error: '도구 실행 오류',
  stream_error: '스트림 오류',
  capability_unsupported: '지원하지 않는 기능',
  schema_validation_error: '입력 검증 오류',
  user_cancelled: '사용자 취소'
}

export function errorCategoryLabel(category: string): string {
  return ERROR_CATEGORY_LABELS[category as ErrorCategory] ?? category
}
