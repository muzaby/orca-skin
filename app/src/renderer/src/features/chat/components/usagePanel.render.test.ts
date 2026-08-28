// 0208 — 추정치 안내는 설정 사용량 3표면에만 붙고 **컴포저 도넛 팝오버에는 붙지 않는다**(D-013).
//
// 이 단언이 settings 쪽 형제 파일(usageTooltip.render.test.ts)이 아니라 여기 있는 이유:
// eslint boundaries 가 features/settings → features/chat import 를 막는다. 계약은 파일 위치가
// 아니라 행동이므로 단언을 소비자 feature 로 옮겼다.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { UsageLimitsView } from '../../../../../shared/usage/limits'
import { i18n } from '../../../shared/i18n'
import { UsagePanel } from './UsagePanel'

const NOTE = i18n.t('usage.estimateNote')

const LIMITS = {
  week: { period: 'week', used: 12, budget: 100, pct: 0.12, unlimited: false, resetAt: 0 },
  month: { period: 'month', used: 40, budget: 100, pct: 0.4, unlimited: false, resetAt: 0 },
  budgetSource: 'local',
  configuredLimitUsd: 100
} as unknown as UsageLimitsView

describe('컴포저 도넛 팝오버 — 범위 밖 (AT-19)', () => {
  it('같은 Meter 를 쓰지만 안내는 붙지 않는다', () => {
    const html = renderToStaticMarkup(
      createElement(UsagePanel, {
        telemetry: { inputTokens: 1000, cacheReadTokens: 0, cacheCreationTokens: 0 },
        usageLimits: LIMITS,
        onOpenUsageSettings: () => undefined
      } as unknown as Parameters<typeof UsagePanel>[0])
    )
    expect(html).not.toContain(NOTE)
    expect(html).not.toContain('title=')
    // 양성 짝 — 막대 자체는 그대로 있다(빈 출력이 음성 술어를 통과하지 못하게).
    expect(html).toContain('rounded-full bg-border')
  })
})
