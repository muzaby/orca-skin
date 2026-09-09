// 제품 에이전트 종류. 실행 backend·모델 공급자·권한 모드와 독립적인 세션 출생 속성이다.
// preload에서도 안전하게 읽을 수 있도록 값/타입만 두고 zod는 protocol에서 적용한다.
export const AGENT_KINDS = ['code', 'work'] as const
export type AgentKind = (typeof AGENT_KINDS)[number]
export const DEFAULT_AGENT_KIND: AgentKind = 'code'

export function isAgentKind(value: unknown): value is AgentKind {
  return value === 'code' || value === 'work'
}

export function parseAgentKind(value: unknown): AgentKind {
  if (!isAgentKind(value)) throw new TypeError('Invalid agent kind')
  return value
}

// 이전 IPC 응답/fixture의 누락과 0224 이전 저장 어휘만 현재 종류로 올린다.
// null이나 임의 문자열은 오래된 데이터로 추측하지 않고 current parser가 거부한다.
export function readLegacyAgentKind(value: unknown): AgentKind {
  if (value === undefined || value === 'coding') return 'code'
  return parseAgentKind(value)
}
