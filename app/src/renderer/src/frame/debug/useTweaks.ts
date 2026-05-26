import { useCallback, useEffect, useState } from 'react'
import type { ThemeId, DensityId } from '../theme'

export interface Tweaks {
  theme: ThemeId
  density: DensityId
  sidebarCollapsed: boolean
  sidebarWidth: number
}

const DEFAULTS: Tweaks = {
  theme: 'classic',
  density: 'normal',
  sidebarCollapsed: false,
  sidebarWidth: 248
}

// settings 영속화와 양방향 바인딩되는 Tweaks 훅.
// 초기값은 DEFAULTS 로 시작하고 mount 직후 settings.get 결과로 교체된다
// (BrowserWindow.show 가 ready-to-show 까지 지연되므로 사용자에게 flash 가 보이는 일은 거의 없다).
export function useTweaks(): [Tweaks, <K extends keyof Tweaks>(key: K, val: Tweaks[K]) => void] {
  const [tweaks, setTweaks] = useState<Tweaks>(DEFAULTS)

  useEffect(() => {
    let cancelled = false
    void window.orca.settings.get().then((s) => {
      if (cancelled) return
      setTweaks({
        theme: s.theme,
        density: s.density,
        sidebarCollapsed: s.sidebarCollapsed,
        sidebarWidth: s.sidebarWidth
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setTweak = useCallback(<K extends keyof Tweaks>(key: K, val: Tweaks[K]) => {
    setTweaks((prev) => ({ ...prev, [key]: val }))
    void window.orca.settings.set({ [key]: val } as Partial<Tweaks>)
  }, [])

  return [tweaks, setTweak]
}
