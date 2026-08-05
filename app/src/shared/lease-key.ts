// 세션 체인 lease 의 **논리 키 코덱** — 순수 문자열 변환. 런타임 의존 0.
//
// 왜 shared 인가: 키를 **만드는 쪽**은 `features/sessions`(lease 레지스트리)이고 **읽는 쪽**은
// `features/chat`(활동 투영)이다. feature 끼리는 직접 import 하지 않으므로(main/AGENTS.md),
// 두 슬라이스가 같은 형식을 각자 손으로 적으면 조용히 갈린다 — 접두사를 바꾸는 순간 디코더가
// `undefined` 를 돌려주고 활동 갱신이 **타입 오류 없이** 멈춘다. 인코더와 디코더를 한 파일에
// 묶어 그 갈림 자체를 없앤다.

const SESSION_PREFIX = 'session:'
const CLIENT_PREFIX = 'client:'

export type LeaseKeyScope = 'session' | 'client'

export interface ParsedLeaseKey {
  scope: LeaseKeyScope
  // 접두사를 뗀 값 — session 이면 sessionId, client 면 클라이언트 임시 키.
  id: string
}

export function sessionLeaseKey(sessionId: string): string {
  return `${SESSION_PREFIX}${sessionId}`
}

export function clientLeaseKey(clientKey: string): string {
  return `${CLIENT_PREFIX}${clientKey}`
}

// 논리 키를 되돌린다. 아는 접두사가 아니면 `undefined` — 호출자가 건너뛴다.
export function parseLeaseKey(logicalKey: string): ParsedLeaseKey | undefined {
  if (logicalKey.startsWith(SESSION_PREFIX)) {
    return { scope: 'session', id: logicalKey.slice(SESSION_PREFIX.length) }
  }
  if (logicalKey.startsWith(CLIENT_PREFIX)) {
    return { scope: 'client', id: logicalKey.slice(CLIENT_PREFIX.length) }
  }
  return undefined
}
