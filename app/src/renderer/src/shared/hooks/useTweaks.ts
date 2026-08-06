import { useCallback, useEffect, useState } from 'react'
import type { ThemeId, DensityId } from '../config/theme'
import type { UiLocale } from '../i18n/datetime'
import { settingsApi } from '../api/ipc'

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
  // 플러그인 탭의 추가 버튼 노출 (0164). 서버 목록의 정본은 빌드타임(`servers.ts`)이라
  // 기본은 숨김이고 디버그 패널 토글로만 켠다.
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
        uiLocale: s.uiLocale,
        notifyOnComplete: s.notifyOnComplete,
        spendingLimitUsd: s.spendingLimitUsd
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setTweak = useCallback(<K extends keyof Tweaks>(key: K, val: Tweaks[K]) => {
    let previous: Tweaks | null = null
    setTweaks((prev) => {
      previous = prev
      return { ...prev, [key]: val }
    })
    void settingsApi.set({ [key]: val } as Partial<Tweaks>).catch(() => {
      if (previous) setTweaks(previous)
    })
  }, [])

  return [tweaks, setTweak]
}
