import { create } from 'zustand'
import type { NavigateFunction } from 'react-router-dom'
import type { SsoFieldSpec } from '../../../../shared/ipc'
import { settingsApi, ssoApi } from '../../shared/api/ipc'
import type { UiMessage } from '../../shared/i18n'

// SSO 로그인 게이트의 renderer 미러 (0130 — main SsoService 가 상태 SSOT).
// `required` = main 에 SSO 모듈이 등록됐는지(폐쇄망 배포). false 면 prod 게이트가 없다.
// `authenticated` 는 인메모리(영속 안 함) — 매 앱 실행마다 main restore()/로그인부터 시작.
// `bypass` 만 Settings.ssoBypass 로 영속되어 DEV 게이트를 건너뛴다(디버그 패널 토글).
export type LoginStatus = 'idle' | 'inflight' | 'error'

interface LoginStoreState {
  // 하이드레이트(설정 bypass + main sso status) 전이면 false — 게이트는 이 동안 아무것도
  // 렌더하지 않는다(BrowserWindow 는 ready-to-show 까지 숨김이라 flash 없음).
  hydrated: boolean
  bypass: boolean
  required: boolean
  authenticated: boolean
  // SSO 성공 시 모듈이 넘긴 사용자 이메일 — 사이드바 사용자 버튼 표기.
  email: string | null
  status: LoginStatus
  // 카탈로그 키(폴백) 또는 모듈 원문(raw) — 렌더(LoginView)에서 uiMessageText 로 해석한다.
  errorMessage: UiMessage | null
  // 모듈이 선언한 로그인 입력 필드 — LoginView 가 제네릭 렌더링한다.
  fields: SsoFieldSpec[]
}

export const useLoginStore = create<LoginStoreState>()(() => ({
  hydrated: false,
  bypass: false,
  required: false,
  authenticated: false,
  email: null,
  status: 'idle',
  errorMessage: null,
  fields: []
}))

const { setState, getState } = useLoginStore

// main SsoState → store 필드 매핑 단일 지점.
function applySsoState(sso: {
  required: boolean
  authenticated: boolean
  inflight: boolean
  identity: { email?: string } | null
  errorMessage: string | null
  fields: SsoFieldSpec[]
}): void {
  setState({
    required: sso.required,
    authenticated: sso.authenticated,
    email: sso.identity?.email ?? null,
    status: sso.inflight ? 'inflight' : sso.errorMessage != null ? 'error' : 'idle',
    errorMessage: sso.errorMessage != null ? { raw: sso.errorMessage } : null,
    fields: sso.fields
  })
}

const STATUS_RETRIES = 5
const STATUS_RETRY_DELAY_MS = 400

let unsubscribe: (() => void) | null = null

export const loginActions = {
  // 부팅 시 1회 — 영속 bypass + main SSO 상태를 하이드레이트하고 상태 push 를 구독한다.
  // prod 에서 status 실패를 required:false 로 조용히 기본화하지 않는다(재시도 후 fail-closed)
  // — 그러면 로그인 게이트가 있어야 할 배포에서 게이트가 사라진다.
  async hydrate(): Promise<void> {
    unsubscribe ??= ssoApi.onState(applySsoState)
    const [settings, sso] = await Promise.all([
      settingsApi.get().catch(() => null),
      loginActions.fetchStatusWithRetry()
    ])
    if (settings) setState({ bypass: settings.ssoBypass })
    if (sso) applySsoState(sso)
    else if (!import.meta.env.DEV) setState({ required: true })
    setState({ hydrated: true })
  },

  async fetchStatusWithRetry(): Promise<Awaited<ReturnType<typeof ssoApi.status>> | null> {
    for (let attempt = 0; attempt < STATUS_RETRIES; attempt += 1) {
      try {
        return await ssoApi.status()
      } catch {
        await new Promise((resolve) => setTimeout(resolve, STATUS_RETRY_DELAY_MS))
      }
    }
    return null
  },

  // 디버그 패널 토글 — store 갱신 + 영속. store 에 두므로 게이트가 즉시 반응한다.
  setBypass(value: boolean): void {
    setState({ bypass: value })
    void settingsApi.set({ ssoBypass: value })
  },

  // SSO 로그인 시도 — main SsoService 로 위임. 성공(authenticated)이면 새 채팅으로 이동.
  async attemptSso(navigate: NavigateFunction, input: Record<string, string> = {}): Promise<void> {
    if (getState().status === 'inflight') return
    setState({ status: 'inflight', errorMessage: null })
    try {
      const state = await ssoApi.login(input)
      applySsoState(state)
      if (state.authenticated) {
        navigate('/new')
      } else if (state.errorMessage == null) {
        // 모듈이 메시지 없이 실패 — 카탈로그 폴백.
        setState({ status: 'error', errorMessage: { key: 'errors.loginFailed' } })
      }
    } catch {
      setState({ status: 'error', errorMessage: { key: 'errors.loginFailed' } })
    }
  },

  resetError(): void {
    setState((s) => (s.status === 'error' ? { status: 'idle', errorMessage: null } : s))
  }
}
