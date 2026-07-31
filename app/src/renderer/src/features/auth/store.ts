import { create } from 'zustand'
import type { NavigateFunction } from 'react-router-dom'
import type { AuthFieldSpec, AuthPlatformState, AuthStepInfo } from '../../../../shared/ipc'
import { APPLICATION_TARGET, authApi, settingsApi } from '../../shared/api/ipc'
import type { UiMessage } from '../../shared/i18n'

// 인증 게이트의 renderer 미러 (0157 — main AuthBroker 가 상태 SSOT. 구 loginStore 승계).
//
// 0130 대비 달라진 점: 로그인이 **1회 invoke 가 아니라 transaction** 이다. `begin` 이
// 다음 step(입력 수집·브라우저·device code)을 주고, 입력이 필요한 step 만 `continue` 로 잇는다.
// 브라우저 플로우(ADFS/WIA)는 begin 안에서 끝나므로 renderer 는 필드 유무만 보고 분기한다.
//
// `required` = application target 을 지원하는 provider 가 등록됐는지. false 면 prod 게이트 없음.
// `authenticated` 는 인메모리 — binding 을 영속하지 않으므로 매 앱 실행마다 로그인부터 시작한다.
// `bypass` 만 Settings.authBypass 로 영속되어 DEV 게이트를 건너뛴다(디버그 패널 토글).
export type AuthStatus = 'idle' | 'inflight' | 'error'

interface AuthStoreState {
  // 하이드레이트(설정 bypass + main auth status) 전이면 false — 게이트는 이 동안 아무것도
  // 렌더하지 않는다(BrowserWindow 는 ready-to-show 까지 숨김이라 flash 없음).
  hydrated: boolean
  bypass: boolean
  required: boolean
  authenticated: boolean
  // 인증 성공 시 provider 가 넘긴 사용자 이메일 — 사이드바 사용자 버튼 표기.
  email: string | null
  status: AuthStatus
  // 카탈로그 키(폴백) 또는 provider 원문(raw) — 렌더에서 uiMessageText 로 해석한다.
  errorMessage: UiMessage | null
  // 현재 step 이 요구하는 입력 필드 — AuthView 가 제네릭 렌더링한다.
  fields: AuthFieldSpec[]
  // 진행 중 transaction. continue 에 필요하다.
  transactionId: string | null
  // 앱 로그인에 쓸 provider. 복수 등록 시 application 을 지원하는 첫 번째를 고른다.
  providerId: string | null
}

export const useAuthStore = create<AuthStoreState>()(() => ({
  hydrated: false,
  bypass: false,
  required: false,
  authenticated: false,
  email: null,
  status: 'idle',
  errorMessage: null,
  fields: [],
  transactionId: null,
  providerId: null
}))

const { setState, getState } = useAuthStore

// step 에서 renderer 가 쓰는 부분만 추린다.
function stepPatch(step: AuthStepInfo | null): Partial<AuthStoreState> {
  if (!step) return { fields: [], transactionId: null }
  if (step.kind === 'collect') return { fields: step.fields, transactionId: step.transactionId }
  if (step.kind === 'browser' || step.kind === 'device_code') {
    return { fields: [], transactionId: step.transactionId }
  }
  return { fields: [], transactionId: null }
}

// main AuthPlatformState → store 필드 매핑 단일 지점.
function applyPlatformState(state: AuthPlatformState): void {
  const applicationProvider = state.providers.find((p) => p.targets.includes('application'))
  setState({
    required: state.required,
    authenticated: state.authenticated,
    email: state.identity?.email ?? null,
    status: state.inflight ? 'inflight' : state.errorMessage != null ? 'error' : 'idle',
    errorMessage: state.errorMessage != null ? { raw: state.errorMessage } : null,
    providerId: applicationProvider?.id ?? null,
    ...stepPatch(state.step)
  })
}

const STATUS_RETRIES = 5
const STATUS_RETRY_DELAY_MS = 400

let unsubscribe: (() => void) | null = null

export const authActions = {
  // 부팅 시 1회 — 영속 bypass + main 인증 상태를 하이드레이트하고 상태 push 를 구독한다.
  // prod 에서 status 실패를 required:false 로 조용히 기본화하지 않는다(재시도 후 fail-closed)
  // — 그러면 로그인 게이트가 있어야 할 배포에서 게이트가 사라진다.
  async hydrate(): Promise<void> {
    unsubscribe ??= authApi.onState(applyPlatformState)
    const [settings, state] = await Promise.all([
      settingsApi.get().catch(() => null),
      authActions.fetchStatusWithRetry()
    ])
    if (settings) setState({ bypass: settings.authBypass })
    if (state) applyPlatformState(state)
    else if (!import.meta.env.DEV) setState({ required: true })
    setState({ hydrated: true })
  },

  async fetchStatusWithRetry(): Promise<AuthPlatformState | null> {
    for (let attempt = 0; attempt < STATUS_RETRIES; attempt += 1) {
      try {
        return await authApi.status()
      } catch {
        await new Promise((resolve) => setTimeout(resolve, STATUS_RETRY_DELAY_MS))
      }
    }
    return null
  },

  // 디버그 패널 토글 — store 갱신 + 영속. store 에 두므로 게이트가 즉시 반응한다.
  setBypass(value: boolean): void {
    setState({ bypass: value })
    void settingsApi.set({ authBypass: value })
  },

  // 앱 로그인 시도. transaction 이 없으면 begin, 있으면 continue 로 잇는다.
  async attemptLogin(
    navigate: NavigateFunction,
    input: Record<string, string> = {}
  ): Promise<void> {
    const { status, providerId, transactionId } = getState()
    if (status === 'inflight') return
    if (!providerId) {
      setState({ status: 'error', errorMessage: { key: 'errors.loginFailed' } })
      return
    }
    setState({ status: 'inflight', errorMessage: null })
    try {
      const step = transactionId
        ? await authApi.continueAuth(transactionId, input)
        : await authApi.begin(providerId, APPLICATION_TARGET)
      authActions.applyStep(step, navigate)
    } catch {
      setState({ status: 'error', errorMessage: { key: 'errors.loginFailed' } })
    }
  },

  applyStep(step: AuthStepInfo, navigate: NavigateFunction): void {
    if (step.kind === 'done') {
      setState({ status: 'idle', errorMessage: null, ...stepPatch(null) })
      navigate('/new')
      return
    }
    if (step.kind === 'failed') {
      setState({
        status: 'error',
        // provider 원문 우선, 없으면 카탈로그 폴백.
        errorMessage: step.message != null ? { raw: step.message } : { key: 'errors.loginFailed' },
        ...stepPatch(null)
      })
      return
    }
    // 입력이 더 필요한 step — 필드를 렌더하고 사용자의 다음 제출을 기다린다.
    setState({ status: 'idle', errorMessage: null, ...stepPatch(step) })
  },

  resetError(): void {
    setState((s) => (s.status === 'error' ? { status: 'idle', errorMessage: null } : s))
  }
}
