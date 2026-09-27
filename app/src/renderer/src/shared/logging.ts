// renderer 로깅 진입점 (0123) — window.orca.log 의 얇은 패스-스루. 전역 오류 보고는 shared/errors가 소유한다.
// renderer 는 파일에 직접 쓰지 않는다: LogInput 만 main 으로 보내고, 공통 필드는 main 이
// 부여한다. window.orca 부재(테스트·프리뷰)에서도 안전하도록 lazy 접근 + 조용한 no-op.

import type { SerializedError } from '../../../shared/logging'

type LogData = Record<string, unknown>

function api(): Window['orca']['log'] | undefined {
  if (typeof window === 'undefined') return undefined
  return window.orca?.log
}

export function toSerializedError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause !== undefined ? toSerializedError(error.cause) : undefined
    }
  }
  return { name: 'UnknownError', message: String(error) }
}

export const rendererLog = {
  debug: (event: string, scope: string, data?: LogData): void => api()?.debug(event, scope, data),
  info: (event: string, scope: string, data?: LogData): void => api()?.info(event, scope, data),
  warn: (event: string, scope: string, data?: LogData): void => api()?.warn(event, scope, data),
  error: (event: string, scope: string, error?: unknown, data?: LogData): void =>
    api()?.error(event, scope, error === undefined ? undefined : toSerializedError(error), data)
}
