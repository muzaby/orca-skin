import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_UPDATE_CHECK,
  type SchedulerUpdateCheckSettings,
  type Settings
} from '../../../../../shared/ipc'
import { settingsApi } from '../../../shared/api/ipc'

// 자동 업데이트 확인 주기 설정(0156) — settings 의 `scheduler.updateCheck` 양방향 바인딩.
// Tweaks 컨텍스트를 쓰지 않는 이유: setTweak 은 flat 패치(`{[key]: val}`)만 만들 수 있어 중첩
// scheduler 키를 표현하지 못하고, scheduler 는 Tweaks projection 에 두지 않기로 한 결정(0112)이
// 있다. 그래서 accountInstructions 처럼 이 슬라이스가 settingsApi 를 직접 호출한다.
export function useUpdateCheckSetting(): [
  SchedulerUpdateCheckSettings,
  (patch: Partial<SchedulerUpdateCheckSettings>) => void
] {
  const [value, setValue] = useState<SchedulerUpdateCheckSettings>(DEFAULT_UPDATE_CHECK)

  useEffect(() => {
    let cancelled = false
    void settingsApi.get().then((s: Settings) => {
      if (!cancelled) setValue(s.scheduler.updateCheck)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 낙관적으로 먼저 반영하고, 저장이 실패하면 갱신 직전 값으로 되돌린다(useTweaks 와 같은 방식 —
  // 추가 IPC 없이 unmount 후에도 안전).
  const update = useCallback((patch: Partial<SchedulerUpdateCheckSettings>) => {
    let previous: SchedulerUpdateCheckSettings | null = null
    setValue((prev) => {
      previous = prev
      return { ...prev, ...patch }
    })
    void settingsApi.set({ scheduler: { updateCheck: patch } }).catch(() => {
      if (previous) setValue(previous)
    })
  }, [])

  return [value, update]
}
