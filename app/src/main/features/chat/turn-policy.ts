// 턴 종류별 정책(0149, 순수) — 코디네이터가 턴마다 1회 조회한다.
//
// 0136~0143 은 "listen 턴" 을 `TurnRequest.listen` 불리언으로 실어 나르며, stall 무장 여부와
// activeTurns 계상 여부를 각 사용처에서 `request.listen !== true` 로 따로 판정했다. 같은 규칙이
// 네 곳에 흩어지면 다음 비-입력 턴 종류(압축 드레인·알림 전용 턴 등)가 생길 때 네 곳을 모두
// 찾아 고쳐야 한다. 종류를 1급 값으로 올리고 정책을 여기 한 곳에 모은다.
export type TurnKind = 'user' | 'continuation' | 'listen'

export interface TurnPolicy {
  // stall 타이머 무장 — listen 턴은 장시간 무이벤트가 정상이라 '응답 없음' 오판을 막는다.
  armStall: boolean
  // 프로젝트 동시 턴 회계 계상 — listen 은 사용자 관점의 "진행 중 작업" 이 아니라 수신 대기다.
  countsAsActive: boolean
  // 입력(프롬프트/첨부)을 push 하는 턴인가 — listen 은 프레임만 열어 CLI 자동 턴을 소비한다.
  pushesInput: boolean
}

const POLICIES: Record<TurnKind, TurnPolicy> = {
  user: { armStall: true, countsAsActive: true, pushesInput: true },
  continuation: { armStall: true, countsAsActive: true, pushesInput: true },
  listen: { armStall: false, countsAsActive: false, pushesInput: false }
}

export function turnPolicyFor(kind: TurnKind): TurnPolicy {
  return POLICIES[kind]
}
