/** renderer·로그로 내보내도 되는 안정 오류 코드만 남긴다. 경로·원본 메시지는 버린다. */
export function archiveErrorCode(error: unknown, fallback: string): string {
  if (error instanceof Error && /^(?:mail|eml)_[a-z0-9_]{1,80}(?::\d+)?$/.test(error.message)) {
    return error.message
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^[A-Z0-9_]{2,32}$/.test(error.code)
  ) {
    return `mail_source_${error.code.toLowerCase()}`
  }
  return fallback
}
