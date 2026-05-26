import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useTweaks, type Tweaks } from '../../frame/debug/useTweaks'
import { DENSITY_FONT } from '../../frame/theme'

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

  // html[data-platform] 부착 — preload 가 sync 노출하므로 mount 직후 1회.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.orca?.platform) {
      document.documentElement.dataset.platform = window.orca.platform
    }
  }, [])

  return <TweakContext.Provider value={{ t, setTweak }}>{children}</TweakContext.Provider>
}

export function useTweakContext(): TweakContextValue {
  const ctx = useContext(TweakContext)
  if (!ctx) throw new Error('useTweakContext must be used within TweakProvider')
  return ctx
}
