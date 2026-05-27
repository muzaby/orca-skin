import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useTweaks, type Tweaks } from '../../shared/hooks/useTweaks'
import { DENSITY_FONT } from '../../shared/config/theme'
import { getPlatform } from '../../shared/api/ipc'

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
