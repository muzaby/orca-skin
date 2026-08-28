// 0208 — 사용량 수치가 SDK 추정치라는 안내가 **세 표면 전부**에 붙고 범위 밖에는 번지지
// 않는다는 것을 렌더 출력으로 잠근다(plan D-013 · AT-15~AT-17 · AT-19).
//
// 문구의 *존재*만 보면 행 아무 데나 붙어도 통과하므로, Meter 막대 쪽은 트랙 클래스와 title 을
// 한 정규식에 묶어 **자리까지** 본다.
//
// AT-19(범위 밖인 컴포저 도넛 팝오버에 번지지 않는다)는 `features/chat` 쪽 형제 파일이 갖는다 —
// eslint boundaries 가 settings → chat import 를 막는다.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { UsageStatsModel } from '../../../../../shared/ipc'
import type { UsageLimitsView } from '../../../../../shared/usage/limits'
import { i18n } from '../../../shared/i18n'
import { LimitBarsSection } from './UsageLimitViews'
import { ModelUsageList } from './UsageTab'
import { UsageTooltip } from './TokensPerDayChart'

const NOTE = i18n.t('usage.estimateNote')

const LIMITS: UsageLimitsView = {
  week: { period: 'week', used: 12, budget: 100, pct: 0.12, unlimited: false, resetAt: 0 },
  month: { period: 'month', used: 40, budget: 100, pct: 0.4, unlimited: false, resetAt: 0 },
  budgetSource: 'local',
  configuredLimitUsd: 100
} as unknown as UsageLimitsView

const MODEL = (model: string): UsageStatsModel =>
  ({
    model,
    inputTokens: 10,
    outputTokens: 20,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    costUsd: 1
  }) as unknown as UsageStatsModel

/** Meter 트랙 요소 위에 안내가 걸렸는가 — 행 아무 곳이 아니라 막대여야 한다. */
const onTrack = (html: string): number =>
  html.match(new RegExp(`rounded-full bg-border[^"]*" title="${NOTE.slice(0, 12)}`, 'g'))?.length ??
  0

describe('안내 문구 — 카탈로그', () => {
  it('사용자 원문 그대로다', () => {
    expect(NOTE).toBe(
      '표시된 사용량은 SDK가 제공하는 추정치입니다. 실제 토큰 사용량 및 청구 금액과 차이가 있을 수 있습니다.'
    )
  })
})

describe('provider 주간/월간 막대 (AT-15)', () => {
  it('두 막대 트랙에 각각 안내가 붙는다', () => {
    const html = renderToStaticMarkup(createElement(LimitBarsSection, { usageLimits: LIMITS }))
    expect(onTrack(html)).toBe(2)
  })

  it('사용량이 아직 없으면 막대도 안내도 없다', () => {
    const html = renderToStaticMarkup(createElement(LimitBarsSection, { usageLimits: null }))
    expect(html).not.toContain('title=')
  })
})

describe('모델별 내역 막대 (AT-16)', () => {
  it('모델 수만큼 안내가 붙는다', () => {
    const models = [MODEL('a'), MODEL('b'), MODEL('c')]
    const html = renderToStaticMarkup(createElement(ModelUsageList, { models }))
    expect(onTrack(html)).toBe(models.length)
  })
})

describe('일별 토큰 차트 툴팁 (AT-17)', () => {
  const datum = { day: '2026-08-28', ms: Date.parse('2026-08-28'), tokens: 1234, costUsd: 5.5 }

  it('날짜·토큰·비용과 함께 안내를 낸다', () => {
    const html = renderToStaticMarkup(
      createElement(UsageTooltip, { active: true, payload: [{ payload: datum }], locale: 'ko' })
    )
    expect(html).toContain(NOTE)
    // 양성 짝 — 안내가 기존 세 줄을 밀어내지 않았다.
    expect(html).toContain('1.2K')
    expect(html).toContain('$5.50')
  })

  it('비활성이면 아무것도 그리지 않는다', () => {
    const html = renderToStaticMarkup(
      createElement(UsageTooltip, { active: false, payload: [{ payload: datum }], locale: 'ko' })
    )
    expect(html).toBe('')
  })
})
