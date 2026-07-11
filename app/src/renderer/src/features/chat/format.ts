// 채팅 transcript 에서 쓰이는 JSON 포맷 유틸. 시간 포맷(formatTimeShort/Full)은 0096 에서
// 로케일·타임존 명시 공용 모듈 shared/i18n/datetime.ts 로 이관됐다.

export function stringify(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
