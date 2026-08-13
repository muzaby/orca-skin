// 설정 IPC 2종 (0179 에서 misc 에서 분리). 검증은 `SettingsStore.patch` 내부 zod 가 담당한다.

import { CHANNELS, type Settings } from '../../../shared/protocol'
import { handlePlain } from '../../infra/ipc/handle'
import { getLogger } from '../../infra/log'
import type { RouterContext } from '../context'

export function registerSettingsHandlers(ctx: RouterContext): void {
  handlePlain(CHANNELS.settingsGet, (): Settings => ctx.settings.getAll())

  // 파생 상태(게이트 판정·사용량 뷰)를 다시 미는 일은 **이 핸들러의 몫이 아니다** —
  // `SettingsStore.onPatch` 로 각 소유자가 부팅에서 스스로 등록한다(`app/bootstrap.ts`).
  // 여기에 `if (key === …)` 를 쌓으면 도메인을 모르는 핸들러가 feature 를 알아야 하고,
  // 파생 설정이 늘 때마다 "설정은 바뀌었는데 화면은 그대로" 가 반복된다.
  handlePlain(CHANNELS.settingsSet, (raw): Settings => {
    const next = ctx.settings.patch(raw)
    ctx.scheduler.applySettings(next.scheduler)
    // 설정 변경 경계(0124 카탈로그) — 변경 키 이름만 기록(값 금지).
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      getLogger()
        .child('settings')
        .info('settings.patch.applied', { keys: Object.keys(raw) })
    }
    return next
  })
}
