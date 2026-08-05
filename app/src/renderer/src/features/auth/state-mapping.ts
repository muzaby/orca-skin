// main `AuthPlatformState` → auth store 패치 (0172 에서 store 에서 분리).
//
// `window.orca` 에 닿지 않는 **순수 변환**이라 단위 테스트가 된다 — store 안에 두면 IPC 구독
// 배선과 얽혀 매핑 규칙만 따로 검증할 수 없다.

import type {
  AuthChainProgress,
  AuthFieldSpec,
  AuthPlatformState,
  AuthStepInfo
} from '../../../../shared/ipc'
import type { UiMessage } from '../../shared/i18n'

export interface AuthStatePatch {
  required: boolean
  authenticated: boolean
  email: string | null
  status: 'idle' | 'inflight' | 'error'
  errorMessage: UiMessage | null
  providerId: string | null
  fields: AuthFieldSpec[]
  transactionId: string | null
  chain: AuthChainProgress | null
  // 폼 입력 초기화 키. 체인의 다음 멤버가 같은 필드 이름을 쓰면(둘 다 `credential` 등) 이 키가
  // 없을 때 1단계에 넣은 값이 2단계 폼에 그대로 남는다.
  stepKey: string
}

// step 에서 renderer 가 쓰는 부분만 추린다.
export function stepPatch(
  step: AuthStepInfo | null
): Pick<AuthStatePatch, 'fields' | 'transactionId' | 'chain' | 'stepKey'> {
  if (step === null || step.kind === 'done' || step.kind === 'failed') {
    return { fields: [], transactionId: null, chain: null, stepKey: '' }
  }
  const chain = step.chain ?? null
  const stepKey = `${step.transactionId}:${chain?.index ?? 0}`
  if (step.kind === 'collect') {
    return { fields: step.fields, transactionId: step.transactionId, chain, stepKey }
  }
  return { fields: [], transactionId: step.transactionId, chain, stepKey }
}

// 앱 로그인에 쓸 provider — application 을 지원하는 첫 번째. 그 provider 가 속한 패키지의
// 체인 전체를 main 이 실행한다(0172), 그래서 renderer 는 헤드 하나만 알면 된다.
export function platformStatePatch(state: AuthPlatformState): AuthStatePatch {
  const applicationProvider = state.providers.find((p) => p.targets.includes('application'))
  return {
    required: state.required,
    authenticated: state.authenticated,
    email: state.identity?.email ?? null,
    status: state.inflight ? 'inflight' : state.errorMessage != null ? 'error' : 'idle',
    errorMessage: state.errorMessage != null ? { raw: state.errorMessage } : null,
    providerId: applicationProvider?.id ?? null,
    ...stepPatch(state.step)
  }
}
