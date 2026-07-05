import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useTweaks, type Tweaks, type AppFontId } from '../hooks/useTweaks'
import { DENSITY_FONT } from '../config/theme'
import { getPlatform } from '../api/ipc'

// 앱 폰트 선택 → tokens.css 의 폰트 스택 var 매핑. --font-app 을 이 값으로 덮어써
// AppLayout 루트의 [font-family:var(--font-app)] 가 전체 트리에 적용된다.
const FONT_STACK: Record<AppFontId, string> = {
  sans: 'var(--font-sans)',
  serif: 'var(--font-serif)',
  mono: 'var(--font-mono)'
}

interface TweakContextValue {
  t: Tweaks
  setTweak: <K extends keyof Tweaks>(key: K, val: Tweaks[K]) => void
}

const TweakContext = createContext<TweakContextValue | null>(null)

export function TweakProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [t, setTweak] = useTweaks()

  useEffect(() => {
    document.documentElement.dataset.theme = t.theme
  }, [t.theme])

  useEffect(() => {
    document.documentElement.style.fontSize = DENSITY_FONT[t.density] + 'px'
  }, [t.density])

  useEffect(() => {
    document.documentElement.style.setProperty('--font-app', FONT_STACK[t.appFont])
  }, [t.appFont])

  // html[data-platform] 부착 — preload 가 sync 노출하므로 mount 직후 1회.
  useEffect(() => {
    const p = getPlatform()
    if (p) document.documentElement.dataset.platform = p
  }, [])

  return <TweakContext.Provider value={{ t, setTweak }}>{children}</TweakContext.Provider>
}

export function useTweakContext(): TweakContextValue {
  const ctx = useContext(TweakContext)
  if (!ctx) throw new Error('useTweakContext must be used within TweakProvider')
  return ctx
}
