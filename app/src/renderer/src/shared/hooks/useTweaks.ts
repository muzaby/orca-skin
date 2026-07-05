import { useCallback, useEffect, useState } from 'react'
import type { ThemeId, DensityId } from '../config/theme'
import { settingsApi } from '../api/ipc'

export type AppFontId = 'sans' | 'serif' | 'mono'

export interface Tweaks {
  theme: ThemeId
  density: DensityId
  sidebarCollapsed: boolean
  sidebarWidth: number
  // 앱 전체 폰트(설정 모달). TweakProvider 가 --font-app var 로 적용.
  appFont: AppFontId
  // 응답완료 알림 토글. 완료 감지 훅(useCompletionNotifier)이 이 값을 읽어 알림 요청.
  notifyOnComplete: boolean
}

const DEFAULTS: Tweaks = {
  theme: 'white',
  density: 'normal',
  sidebarCollapsed: false,
  sidebarWidth: 248,
  appFont: 'sans',
  notifyOnComplete: false
}

// settings 영속화와 양방향 바인딩되는 Tweaks 훅.
// 초기값은 DEFAULTS 로 시작하고 mount 직후 settings.get 결과로 교체된다
// (BrowserWindow.show 가 ready-to-show 까지 지연되므로 사용자에게 flash 가 보이는 일은 거의 없다).
export function useTweaks(): [Tweaks, <K extends keyof Tweaks>(key: K, val: Tweaks[K]) => void] {
  const [tweaks, setTweaks] = useState<Tweaks>(DEFAULTS)

  useEffect(() => {
    let cancelled = false
    void settingsApi.get().then((s) => {
      if (cancelled) return
      setTweaks({
        theme: s.theme,
        density: s.density,
        sidebarCollapsed: s.sidebarCollapsed,
        sidebarWidth: s.sidebarWidth,
        appFont: s.appFont,
        notifyOnComplete: s.notifyOnComplete
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setTweak = useCallback(<K extends keyof Tweaks>(key: K, val: Tweaks[K]) => {
    setTweaks((prev) => ({ ...prev, [key]: val }))
    void settingsApi.set({ [key]: val } as Partial<Tweaks>)
  }, [])

  return [tweaks, setTweak]
}
