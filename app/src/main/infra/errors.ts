// ErrorClassifier — provider 중립 에러 정규화 계층 (provider-runtime.md §6).
// 어댑터/IPC 가 던지는 임의 예외를 8 category + retryable 의 ClassifiedError 로 정규화해
// 와이어(orca:chat:event)의 error 이벤트에 싣는다. 여기엔 provider 비의존 조각만 둔다:
//   ① ErrorClassifier 인터페이스 — provider 별 classifier(claude-classifier.ts 등)가 구현.
//   ② makeClassifiedError — category→기본 retryable 매핑을 적용해 ClassifiedError 를 합성.
//   ③ sanitizeCause — Error 인스턴스/함수를 IPC(structuredClone) 안전값으로 평탄화.
//   ④ errorMessage — 임의 예외를 사람 읽는 한 줄 메시지로.
// SDK/electron 비의존 순수 함수 → vitest 대상.

import type { ClassifiedError, ErrorCategory, ProviderId } from '../../shared/ipc'

// classify 호출 컨텍스트 — provider(optional) 와 발생 단계(sendMessage 등). 분류 휴리스틱이
// phase 로 추가 단서를 얻을 수 있게 열어 두지만, 현재 claude classifier 는 메시지 패턴만 본다.
// provider 는 어댑터 컨텍스트가 있을 때만 채운다(0016) — 표시용이고 분기에 쓰지 않는다.
export interface ClassifyContext {
  provider?: ProviderId
  phase: string
}

export interface ErrorClassifier {
  classify(error: unknown, ctx: ClassifyContext): ClassifiedError
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// category 별 기본 retryable. 연결/스트림 계열은 일시적 장애일 수 있어 재시도 가치가 있다.
// 그 외(인증·권한·검증·취소·도구실패·미지원)는 같은 입력으로 재시도해도 동일 실패라 false.
// makeClassifiedError 의 opts.retryable 로 호출처가 개별 override 할 수 있다(예: router 의
// "활성 백엔드 없음" → connection 이지만 명시 true).
const DEFAULT_RETRYABLE: Record<ErrorCategory, boolean> = {
  provider_connection_error: true,
  stream_error: true,
  auth_error: false,
  permission_denied: false,
  tool_execution_error: false,
  capability_unsupported: false,
  schema_validation_error: false,
  user_cancelled: false
}

export interface MakeClassifiedErrorOptions {
  retryable?: boolean
  provider?: ProviderId
  cause?: unknown
}

export function makeClassifiedError(
  category: ErrorCategory,
  message: string,
  opts: MakeClassifiedErrorOptions = {}
): ClassifiedError {
  return {
    category,
    message,
    retryable: opts.retryable ?? DEFAULT_RETRYABLE[category],
    ...(opts.provider ? { provider: opts.provider } : {}),
    ...(opts.cause !== undefined ? { cause: sanitizeCause(opts.cause) } : {})
  }
}

// IPC 직렬화 안전화. wc.send 는 structuredClone 을 쓰므로 Error 인스턴스는 stack/프로토타입이
// 손실되고 함수/심볼은 throw 한다. Error → {name, message} 평탄 객체로 낮추고, 원시값은 그대로,
// 그 외 객체는 JSON round-trip 으로 함수/순환을 떨어낸다(실패하면 String 표현으로 폴백).
export function sanitizeCause(err: unknown): unknown {
  if (err instanceof Error) {
    return { name: err.name, message: err.message }
  }
  if (err === null || typeof err !== 'object') {
    // string/number/boolean/undefined/null — 그대로 직렬화 안전.
    return typeof err === 'function' || typeof err === 'symbol' ? String(err) : err
  }
  try {
    return JSON.parse(JSON.stringify(err))
  } catch {
    return String(err)
  }
}
