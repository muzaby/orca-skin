import type { ProviderGateState } from '../../../shared/ipc'

// 최상위 화면 선택 (0194 — 구 `RootGate.tsx` 안의 if 사슬).
//
// **별도 파일인 이유**: `RootGate.tsx` 안에 두면 React·preload 를 물어 vitest 대상에서
// 벗어난다. 이 판정은 게이트 통과 여부와 fail-closed 규칙을 담고 있어 사람 실기로 미룰
// 대상이 아니다(`src/renderer/AGENTS.md §테스트` — 파생 셀렉터는 단위 테스트와 함께).
export type RootFrame = 'boot-failure' | 'waiting' | 'gate' | 'app'

export interface RootFrameInput {
  bootPhase: string
  // main 이 준 게이트 판정. **판정 전에는 `null`** 이다.
  gate: ProviderGateState | null
  // 게이트 통과 후 나머지 Auth 의 부팅 복원이 진행 중인가.
  resuming: boolean
}

// 순서가 계약이다:
//   1. 부팅 실패 — 게이트보다 먼저다(main 이 죽었으면 로그인할 상대가 없다)
//   2. 부팅 미완료 / 게이트 미판정 — 대기 화면. **판정 전(gate=null)에는 통과시키지 않는다**
//      (fail-closed): main 이 잠깐 응답하지 못하는 사이 로그인 강제 빌드가 무인증으로 열리면 안 된다
//   3. 게이트 미통과 — 로그인 화면
//   4. 복원 진행 중 — 대기 화면. 여기서 넘겨 보내면 복원이 만드는 로그인 창이 **메인 UI 뒤에서**
//      뜬다(0194 의 요구). 게이트가 이미 통과했으므로 로그인 랜딩이 아니라 대기 화면이다
//   5. 통과 + 복원 종료 — 메인 UI
export function rootFrame({ bootPhase, gate, resuming }: RootFrameInput): RootFrame {
  if (bootPhase === 'failed') return 'boot-failure'
  if (bootPhase !== 'ready' || gate === null) return 'waiting'
  if (!gate.passed) return 'gate'
  if (resuming) return 'waiting'
  return 'app'
}
