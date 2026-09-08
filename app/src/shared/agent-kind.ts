// 제품 에이전트 종류. 실행 backend·모델 공급자·권한 모드와 독립적인 세션 출생 속성이다.
// preload에서도 안전하게 읽을 수 있도록 값/타입만 두고 zod는 protocol에서 적용한다.
export const AGENT_KINDS = ['coding', 'work'] as const
export type AgentKind = (typeof AGENT_KINDS)[number]
export const DEFAULT_AGENT_KIND: AgentKind = 'coding'

export function isAgentKind(value: unknown): value is AgentKind {
  return value === 'coding' || value === 'work'
}
