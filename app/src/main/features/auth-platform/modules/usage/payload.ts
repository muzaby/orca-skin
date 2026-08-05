// 응답 → 범용 표본 payload (순수).
//
// **JSON 을 강제하지 않는다.** 사내 사용량 API 가 CSV·평문을 주는 배포가 있고, 그때 예외를
// 던지면 사용량 갱신이 통째로 멈춘다. 파싱에 실패하면 원문 문자열을 그대로 싣고 해석은
// 구독자(usage provider 의 `map`)에게 넘긴다.

import type { AuthenticatedFetchResponse } from '../../../../contracts/connector-plugin'

export interface UsagePayloadEnvelope {
  status: number
  contentType?: string
  payload: unknown
}

export function toUsagePayload(response: AuthenticatedFetchResponse): UsagePayloadEnvelope {
  const contentType = headerValue(response.headers, 'content-type')
  return {
    status: response.status,
    ...(contentType !== undefined ? { contentType } : {}),
    payload: parseBody(response.body)
  }
}

function parseBody(body: string): unknown {
  const trimmed = body.trim()
  if (trimmed === '') return ''
  // 형태로 먼저 거른다 — content-type 을 잘못 붙이는 서버가 흔하고, 그 한 줄 때문에 JSON 이
  // 문자열로 내려가면 map 이 매번 파싱을 다시 해야 한다.
  if (!/^[[{]/.test(trimmed)) return body
  try {
    return JSON.parse(trimmed)
  } catch {
    return body
  }
}

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const lower = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value
  }
  return undefined
}
