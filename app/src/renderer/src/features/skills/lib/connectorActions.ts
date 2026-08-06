// Connector 행의 **판정 로직** (0162) — 상태 점 색 · 액션 집합 · 재연결 순서. React 비의존.
//
// 이 저장소는 UI 를 시각 검증으로 갈음하므로(`app/AGENTS.md` §에이전트 원칙 4), 검증하고 싶은
// 규칙은 렌더링에서 떼어 여기로 내린다. 컴포넌트는 이 결과를 그리기만 한다.

import type { AuthLogoutOutcome } from '../../../../../shared/ipc'

export type ConnectorAction = 'connect' | 'reconnect' | 'disconnect'

// `Dot` 이 받는 tone 중 이 화면이 쓰는 둘 (`shared/ui/Status.tsx`).
export type ConnectorTone = 'green' | 'slate'

export interface ConnectorActionInput {
  connected: boolean
}

export function connectorActions(connector: ConnectorActionInput): {
  tone: ConnectorTone
  actions: readonly ConnectorAction[]
} {
  // 연결된 것만 끊거나 다시 붙일 수 있다. connector 당 활성 연결은 1개이므로(0158) 연결된
  // 상태에서 `connect` 를 다시 내주면 `already_connected` 로 죽는다 — 그래서 배타다.
  const connection: ConnectorAction[] = connector.connected
    ? ['reconnect', 'disconnect']
    : ['connect']
  return {
    tone: connector.connected ? 'green' : 'slate',
    actions: connection
  }
}

// 재연결 = **끊고 다시 붙기**. 순서가 이 함수의 존재 이유다 — 붙은 채로 붙이면
// `already_connected` 로 실패하므로 `disconnect` 가 반드시 먼저다.
//
// 끊기가 실패하면 자격증명 화면을 **열지 않는다**. 열면 사용자가 새 PAT 를 다 입력한 뒤에야
// 같은 이유로 다시 실패한다.
export async function runReconnect(steps: {
  disconnect: () => Promise<AuthLogoutOutcome>
  open: () => void
}): Promise<boolean> {
  let outcome: AuthLogoutOutcome
  try {
    outcome = await steps.disconnect()
  } catch {
    return false
  }
  // broker 는 실패를 **던지지 않고** `{kind:'failed'}` 로 돌려준다(`broker.ts` logout).
  // `.catch()` 만 보면 실패가 성공으로 보인다.
  if (outcome.kind !== 'logged_out') return false
  steps.open()
  return true
}
