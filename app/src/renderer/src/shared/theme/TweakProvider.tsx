import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { ThemeId, DensityId } from '../config/theme'
import type { UiLocale } from '../i18n/datetime'
import { DENSITY_FONT } from '../config/theme'
import { getPlatform, settingsApi } from '../api/ipc'
import { i18n } from '../i18n'

export type AppFontId = 'sans' | 'serif' | 'mono'

export interface Tweaks {
  theme: ThemeId
  density: DensityId
  sidebarCollapsed: boolean
  sidebarWidth: number
  // 앱 전체 폰트(설정 모달). TweakProvider 가 --font-app var 로 적용.
  appFont: AppFontId
  // UI 표시 언어(ko/en, 0096). TweakProvider 가 i18n.changeLanguage + <html lang> 으로 적용.
  uiLocale: UiLocale
  // 응답완료 알림 토글. 완료 감지 훅(useCompletionNotifier)이 이 값을 읽어 알림 요청.
  notifyOnComplete: boolean
  // 월간 지출 한도(USD). 사용량 한도 바(도넛·설정)의 기준. null=무제한.
  spendingLimitUsd: number | null
  // scheduler(주기 실행) 설정은 renderer 소비처가 없다(0112 에서 cron UI 제거) —
  // main 스케줄러가 settings store 를 직접 읽으므로 이 projection 에는 두지 않는다.
}

const DEFAULTS: Tweaks = {
  theme: 'white',
  density: 'normal',
  sidebarCollapsed: false,
  sidebarWidth: 248,
  appFont: 'sans',
  uiLocale: 'ko',
  notifyOnComplete: false,
  spendingLimitUsd: 90
}

// 앱 폰트 선택 → tokens.css 의 폰트 스택 var 매핑. --font-app 을 이 값으로 덮어써
// AppLayout 루트의 [font-family:var(--font-app)] 가 전체 트리에 적용된다.
const FONT_STACK: Record<AppFontId, string> = {
  sans: 'var(--font-sans)',
  serif: 'var(--font-serif)',
  mono: 'var(--font-mono)'
}

interface TweakState {
  t: Tweaks
  setTweak: <K extends keyof Tweaks>(key: K, val: Tweaks[K]) => void
}
type TweakStore = StoreApi<TweakState> & { load: () => () => void }

// Provider 인스턴스가 소유한다. 별도 전역 캐시나 설정 서비스 없이 기존 저장 계약을 유지한다.
// eslint-disable-next-line react-refresh/only-export-components -- Provider 소유의 저장·수명 계약을 직접 검증하기 위한 factory.
export function createTweakStore(): TweakStore {
  const store = createStore<TweakState>((set, get) => ({
    t: DEFAULTS,
    setTweak: (key, val) => {
      const previous = get().t
      set({ t: { ...previous, [key]: val } })
      void settingsApi.set({ [key]: val } as Partial<Tweaks>).catch(() => {
        set({ t: previous })
      })
    }
  }))
  return Object.assign(store, {
    load: (): (() => void) => {
      let cancelled = false
      void settingsApi.get().then((s) => {
        if (cancelled) return
        store.setState({
          t: {
            theme: s.theme,
            density: s.density,
            sidebarCollapsed: s.sidebarCollapsed,
            sidebarWidth: s.sidebarWidth,
            appFont: s.appFont,
            uiLocale: s.uiLocale,
            notifyOnComplete: s.notifyOnComplete,
            spendingLimitUsd: s.spendingLimitUsd
          }
        })
      })
      return () => {
        cancelled = true
      }
    }
  })
}

const TweakContext = createContext<ReturnType<typeof createTweakStore> | null>(null)

export function TweakProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [store] = useState(createTweakStore)
  const t = useStore(
    store,
    useShallow((state) => ({
      theme: state.t.theme,
      density: state.t.density,
      appFont: state.t.appFont,
      uiLocale: state.t.uiLocale
    }))
  )
  useEffect(() => store.load(), [store])

  useEffect(() => {
    document.documentElement.dataset.theme = t.theme
  }, [t.theme])

  useEffect(() => {
    document.documentElement.style.fontSize = DENSITY_FONT[t.density] + 'px'
  }, [t.density])

  useEffect(() => {
    document.documentElement.style.setProperty('--font-app', FONT_STACK[t.appFont])
  }, [t.appFont])

  // UI 표시 언어(0096) — i18next 언어 전환 + <html lang> 동기화. theme 적용과 동일 패턴.
  useEffect(() => {
    void i18n.changeLanguage(t.uiLocale)
    document.documentElement.lang = t.uiLocale
  }, [t.uiLocale])

  // html[data-platform] 부착 — preload 가 sync 노출하므로 mount 직후 1회.
  useEffect(() => {
    const p = getPlatform()
    if (p) document.documentElement.dataset.platform = p
  }, [])

  return <TweakContext.Provider value={store}>{children}</TweakContext.Provider>
}

export function useTweakContext<T>(selector: (t: Tweaks) => T): {
  t: T
  setTweak: TweakState['setTweak']
} {
  const store = useContext(TweakContext)
  if (!store) throw new Error('useTweakContext must be used within TweakProvider')
  const selected = useStore(
    store,
    useShallow((state) => selector(state.t))
  )
  return { t: selected, setTweak: store.getState().setTweak }
}
