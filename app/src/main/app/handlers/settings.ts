// 설정 IPC 2종 (0179 에서 misc 에서 분리). 검증은 `SettingsStore.patch` 내부 zod 가 담당한다.

import { CHANNELS, type Settings } from '../../../shared/protocol'
import { handlePlain } from '../../infra/ipc/handle'
import { broadcastProviderState } from '../../infra/ipc/send'
import { getLogger } from '../../infra/log'
import type { RouterContext } from '../context'

export function registerSettingsHandlers(ctx: RouterContext): void {
  handlePlain(CHANNELS.settingsGet, (): Settings => ctx.settings.getAll())

  handlePlain(CHANNELS.settingsSet, (raw): Settings => {
    const next = ctx.settings.patch(raw)
    ctx.scheduler.applySettings(next.scheduler)
    // 설정 변경 경계(0124 카탈로그) — 변경 키 이름만 기록(값 금지).
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const keys = Object.keys(raw)
      getLogger().child('settings').info('settings.patch.applied', { keys })
      // 게이트 우회(dev)는 **게이트 판정의 입력**이라, 설정만 바꾸고 끝내면 화면이 재시작
      // 전까지 옛 판정에 머문다(0181). 판정을 소유한 쪽이 새 상태를 밀어 준다.
      if (keys.includes('authBypass') && ctx.providers) {
        broadcastProviderState(ctx.providers.state())
      }
      // 전역 월 한도도 같은 성격이다 — **한도는 사용량 뷰의 입력**(`budget`·`pct`)이라 설정만
      // 바꾸고 끝내면 도넛이 다음 턴 종료(=다음 delta)까지 옛 한도의 퍼센트를 보여준다.
      // 판정을 소유한 쪽(UsageTracker)이 새 뷰를 밀어 준다.
      if (keys.includes('spendingLimitUsd')) {
        ctx.cost.recordAndBroadcast()
      }
    }
    return next
  })
}
