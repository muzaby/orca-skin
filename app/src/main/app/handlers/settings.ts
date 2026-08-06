// 설정 IPC 2종 (0179 에서 misc 에서 분리). 검증은 `SettingsStore.patch` 내부 zod 가 담당한다.

import { CHANNELS, type Settings } from '../../../shared/protocol'
import { handlePlain } from '../../infra/ipc/handle'
import { getLogger } from '../../infra/log'
import type { RouterContext } from '../context'

export function registerSettingsHandlers(ctx: RouterContext): void {
  handlePlain(CHANNELS.settingsGet, (): Settings => ctx.settings.getAll())

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
