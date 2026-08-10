import { create } from 'zustand'
import { settingsApi } from '../../../shared/api/ipc'

// 게이트 우회(dev) 토글의 renderer 미러 (0181 — 0180 이 지운 `features/auth` 의 bypass 를 복원).
//
// **왜 store 인가**: 디버그 패널이 **두 곳**에 뜬다 — 게이트 화면(`GateFrame`)과 메인 셸
// (`OverlayLayer`). 둘이 각자 `settingsApi.get()` 을 들고 있으면 한쪽에서 켠 값이 다른 쪽에
// 안 보인다. 토글은 화면을 갈아타게 만드는 스위치라(게이트 → 메인) 그 불일치가 그대로 보인다.
//
// **SSOT 는 main 의 `Settings.authBypass`** 다. 여기는 미러이고, 실제 게이트 판정은 main 이
// `import.meta.env.DEV && settings.authBypass` 로 한다 — prod 번들에서는 그 분기가 접혀 사라지므로
// 설정 값이 켜져 있어도 게이트는 유지된다.

interface BypassStoreState {
  // 하이드레이트 전에는 null — 토글이 "꺼짐" 으로 깜빡였다가 켜지는 것을 막는다.
  bypass: boolean | null
}

export const useBypassStore = create<BypassStoreState>()(() => ({ bypass: null }))

let hydrating: Promise<void> | null = null

export const bypassActions = {
  // 두 디버그 패널이 동시에 마운트돼도 invoke 는 1회다.
  hydrate(): void {
    if (hydrating || useBypassStore.getState().bypass !== null) return
    hydrating = settingsApi
      .get()
      .then((settings) => {
        useBypassStore.setState({ bypass: settings.authBypass })
      })
      .catch(() => {
        // 못 읽으면 우회하지 않는 쪽으로 둔다(fail-closed) — 토글은 계속 쓸 수 있다.
        useBypassStore.setState({ bypass: false })
      })
      .finally(() => {
        hydrating = null
      })
  },

  // 낙관 갱신 후 영속. main 이 `settings:set` 응답과 함께 provider state 를 push 하므로
  // 게이트 화면은 이 호출만으로 메인 UI 로 넘어간다(재시작 불요).
  setBypass(next: boolean): void {
    useBypassStore.setState({ bypass: next })
    void settingsApi.set({ authBypass: next }).catch(() => {
      // 영속 실패는 되돌린다 — 화면만 켜지고 게이트는 그대로인 상태를 만들지 않는다.
      useBypassStore.setState({ bypass: !next })
    })
  }
}

export const useBypass = (): boolean | null => useBypassStore((s) => s.bypass)
