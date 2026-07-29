import { useCallback, useEffect, useState } from 'react'
import type { SchedulerUpdateCheckSettings } from '../../../../../shared/ipc'
import { settingsApi } from '../../../shared/api/ipc'

// 자동 업데이트 확인 주기 설정(0156) — settings 의 `scheduler.updateCheck` 양방향 바인딩.
// Tweaks 컨텍스트를 쓰지 않는 이유: setTweak 은 flat 패치(`{[key]: val}`)만 만들 수 있어 중첩
// scheduler 키를 표현하지 못하고, scheduler 는 Tweaks projection 에 두지 않기로 한 결정(0112)이
// 있다. 그래서 accountInstructions 처럼 이 슬라이스가 settingsApi 를 직접 호출한다.
const DEFAULTS: SchedulerUpdateCheckSettings = { enabled: true, intervalHours: 6 }

export function useUpdateCheckSetting(): [
  SchedulerUpdateCheckSettings,
  (patch: Partial<SchedulerUpdateCheckSettings>) => void
] {
  const [value, setValue] = useState<SchedulerUpdateCheckSettings>(DEFAULTS)

  useEffect(() => {
    let cancelled = false
    void settingsApi.get().then((s) => {
      if (!cancelled) setValue(s.scheduler.updateCheck)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 낙관적 반영 후 영속. 실패하면 main 이 돌려준 진짜 값으로 되돌린다.
  const update = useCallback((patch: Partial<SchedulerUpdateCheckSettings>) => {
    setValue((prev) => ({ ...prev, ...patch }))
    void settingsApi.set({ scheduler: { updateCheck: patch } }).then(
      (next) => setValue(next.scheduler.updateCheck),
      () => {
        void settingsApi.get().then((s) => setValue(s.scheduler.updateCheck))
      }
    )
  }, [])

  return [value, update]
}
