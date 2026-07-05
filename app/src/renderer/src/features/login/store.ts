import { create } from 'zustand'
import type { NavigateFunction } from 'react-router-dom'
import { settingsApi } from '../../shared/api/ipc'
import { runSso } from './sso'

// SSO 로그인 게이트의 런타임 상태. `authenticated` 는 인메모리(영속 안 함) —
// 매 앱 실행마다 로그인 화면부터 시작한다. `bypass` 만 Settings.ssoBypass 로 영속되어
// 부팅 시 로그인을 건너뛸 수 있다(디버그 패널에서 토글).
export type LoginStatus = 'idle' | 'inflight' | 'error'

interface LoginStoreState {
  // debugApi.getMock() 로 bypass 를 읽어오기 전이면 false — 게이트는 이 동안 아무것도
  // 렌더하지 않는다(BrowserWindow 는 ready-to-show 까지 숨김이라 flash 없음).
  hydrated: boolean
  bypass: boolean
  authenticated: boolean
  // SSO 로그인 시 전달받는 사용자 이메일. 현재 runSso 는 항상 실패하므로 null 로 유지되며,
  // 실제 SSO 배선 시 attemptSso 성공 분기에서 채워진다. 사이드바 사용자 버튼은
  // bypass(=developer) 가 아닐 때 이 값을 표기한다.
  email: string | null
  status: LoginStatus
  errorMessage: string | null
}

export const useLoginStore = create<LoginStoreState>()(() => ({
  hydrated: false,
  bypass: false,
  authenticated: false,
  email: null,
  status: 'idle',
  errorMessage: null
}))

const { setState, getState } = useLoginStore

export const loginActions = {
  // 부팅 시 1회 — 영속된 bypass 플래그를 읽어 게이트 판단을 준비한다.
  async hydrateBypass(): Promise<void> {
    try {
      const settings = await settingsApi.get()
      setState({ bypass: settings.ssoBypass, hydrated: true })
    } catch {
      setState({ hydrated: true })
    }
  },

  // 디버그 패널 토글 — store 갱신 + 영속. store 에 두므로 게이트가 즉시 반응한다.
  setBypass(value: boolean): void {
    setState({ bypass: value })
    void settingsApi.set({ ssoBypass: value })
  },

  // SSO 로그인 시도. 현재 runSso 는 항상 실패하므로 성공 분기는 도달하지 않지만,
  // 향후 실제 SSO 로직으로 교체되면 그대로 동작한다(authenticated → 게이트가 앱 렌더).
  async attemptSso(navigate: NavigateFunction): Promise<void> {
    if (getState().status === 'inflight') return
    setState({ status: 'inflight', errorMessage: null })
    try {
      const { email } = await runSso()
      setState({ authenticated: true, email, status: 'idle' })
      navigate('/new')
    } catch {
      setState({ status: 'error', errorMessage: '로그인에 실패했습니다. 다시 시도해 주세요.' })
    }
  },

  resetError(): void {
    setState((s) => (s.status === 'error' ? { status: 'idle', errorMessage: null } : s))
  }
}
