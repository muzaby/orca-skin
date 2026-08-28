// 0208 ΔV1 — SDK 추정치 안내는 **전역 사용량 설명 한 곳**에만 보이고 차트·막대에서는 0건이다
// (D-019 · AT-25~AT-29). r1 은 반대였다: 세 표면에 안내를 붙였고 사용자가 그것을 되돌렸다.
//
// 음성 단언("안내가 없다")만 두면 차트를 통째로 지워도 통과한다. 그래서 표면마다 **양성 짝**
// (막대 트랙 · 모델명 · 날짜/토큰/비용)을 함께 본다.
//
// AT-19(컴포저 도넛)는 `features/chat` 쪽 형제 파일이 갖는다 — eslint boundaries 가
// settings → chat import 를 막는다. 계약은 파일 위치가 아니라 행동이다.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { UsageStatsModel } from '../../../../../shared/ipc'
import type { UsageLimitsView } from '../../../../../shared/usage/limits'
import { i18n } from '../../../shared/i18n'
import { codeOf } from '../../../shared/ui/sourceScan.testlib'
import { LimitBarsSection } from './UsageLimitViews'
import { ModelUsageList, UsageDescription } from './UsageTab'
import { UsageTooltip } from './TokensPerDayChart'

const NOTE = i18n.t('usage.estimateNote')
const DESC = i18n.t('settings.usage.desc')

const RENDERER_SRC = fileURLToPath(new URL('../../../', import.meta.url))

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

/** 안내 문구가 몇 번 나오는가 — 붙은 자리가 아니라 개수를 센다. */
const notes = (html: string): number => html.split(NOTE).length - 1

/** Meter 트랙 요소 — 음성 단언의 양성 짝이다. */
const bars = (html: string): number => html.match(/rounded-full bg-border/g)?.length ?? 0

describe('안내 문구 — 카탈로그 (D-018)', () => {
  it('사용자 원문 그대로다', () => {
    expect(NOTE).toBe(
      '표시된 사용량은 SDK가 제공하는 추정치입니다. 실제 토큰 사용량 및 청구 금액과 차이가 있을 수 있습니다.'
    )
  })

  it('ko/en 설명에서 provider 위치 안내가 사라졌다', () => {
    for (const locale of ['ko', 'en'] as const) {
      const desc = i18n.getFixedT(locale)('settings.usage.desc') as string
      expect(desc, locale).not.toMatch(/좌측|left|하위 항목|sub-items/)
      // 양성 짝 — 토큰 설명 첫 문장은 남아 있다(문장을 통째로 비워도 위 술어는 통과한다).
      expect(desc.length, locale).toBeGreaterThan(20)
      // 문구를 카탈로그에 복제하지 않는다 — SSOT 는 usage.estimateNote 하나다.
      expect(desc, locale).not.toContain('SDK')
    }
  })
})

describe('전역 사용량 설명 (AT-25)', () => {
  it('첫 문장과 추정치 안내를 각각 한 번 낸다', () => {
    const html = renderToStaticMarkup(createElement(UsageDescription))
    expect(notes(html)).toBe(1)
    expect(html.split(DESC).length - 1).toBe(1)
    // 순서 — 토큰 설명이 먼저다.
    expect(html.indexOf(DESC)).toBeLessThan(html.indexOf(NOTE))
  })
})

describe('provider 주간/월간 막대 (AT-26)', () => {
  it('막대 두 개는 남고 안내는 0건이다', () => {
    const html = renderToStaticMarkup(createElement(LimitBarsSection, { usageLimits: LIMITS }))
    expect(notes(html)).toBe(0)
    expect(html).not.toContain('title=')
    // 양성 짝 — week/month 트랙과 수치가 그대로다(차트를 지워 통과할 수 없다).
    expect(bars(html)).toBe(2)
    expect(html).toContain(i18n.t('usage.weekly'))
    expect(html).toContain(i18n.t('usage.monthly'))
  })

  it('사용량이 아직 없으면 막대도 안내도 없다', () => {
    const html = renderToStaticMarkup(createElement(LimitBarsSection, { usageLimits: null }))
    expect(notes(html)).toBe(0)
    expect(bars(html)).toBe(0)
  })
})

describe('모델별 내역 막대 (AT-27)', () => {
  it('모델 수만큼 막대가 남고 안내는 0건이다', () => {
    const models = [MODEL('a'), MODEL('b'), MODEL('c')]
    const html = renderToStaticMarkup(createElement(ModelUsageList, { models }))
    expect(notes(html)).toBe(0)
    expect(html).not.toContain('title=')
    // 양성 짝 — 모델 수만큼의 Meter·모델명·토큰 breakdown 이 그대로다.
    expect(bars(html)).toBe(models.length)
    for (const m of models) expect(html).toContain(m.model)
    expect(html).toContain('30')
  })
})

describe('일별 토큰 차트 툴팁 (AT-28)', () => {
  const datum = { day: '2026-08-28', ms: Date.parse('2026-08-28'), tokens: 1234, costUsd: 5.5 }

  it('날짜·토큰·비용만 남고 안내 줄이 없다', () => {
    const html = renderToStaticMarkup(
      createElement(UsageTooltip, { active: true, payload: [{ payload: datum }], locale: 'ko' })
    )
    expect(notes(html)).toBe(0)
    // 양성 짝 — 기존 세 줄이 그대로다(툴팁을 통째로 지워 통과할 수 없다).
    expect(html).toContain('1.2K')
    expect(html).toContain('$5.50')
    expect(html).toMatch(/8[^<]*28/)
    // 안내를 위해 붙였던 폭 제한과 구분선도 함께 사라진다.
    expect(html).not.toContain('max-w-[240px]')
    expect(html).not.toContain('border-t')
  })

  it('비활성이면 아무것도 그리지 않는다', () => {
    const html = renderToStaticMarkup(
      createElement(UsageTooltip, { active: false, payload: [{ payload: datum }], locale: 'ko' })
    )
    expect(html).toBe('')
  })
})

describe('안내 문구의 소비자 전수 (AT-29 · IT-06)', () => {
  const files: string[] = []
  const walk = (dir: string): void => {
    for (const e of readdirSync(join(RENDERER_SRC, dir), { withFileTypes: true })) {
      const rel = join(dir, e.name)
      if (e.isDirectory()) walk(rel)
      else if (/\.tsx?$/.test(e.name)) files.push(rel)
    }
  }
  walk('.')
  // 주석을 뺀 코드 줄만 본다 — 안내를 설명하는 문장과 실제 호출부를 구분하지 못하면
  // 이 전수는 아무것도 세지 않는다(같은 실수를 이번 턴에 두 번 했다).
  const source = (f: string): string => codeOf(readFileSync(join(RENDERER_SRC, f), 'utf8'))
  const isTest = (f: string): boolean => f.endsWith('.test.ts') || f.endsWith('.testlib.ts')

  it('production callsite 가 UsageDescription 한 곳뿐이다', () => {
    // 파일이 아니라 **등장 횟수**를 센다. 파일 목록으로 세면 같은 파일 안에서 두 번째 소비자가
    // 생겨도(ModelUsageList 가 UsageTab.tsx 에 산다) 목록이 그대로라 통과한다.
    const callsites = files
      .filter((f) => !isTest(f) && !f.includes('i18n'))
      .flatMap((f) => (source(f).match(/'usage\.estimateNote'/g) ?? []).map(() => f))
    expect(callsites).toEqual(['features/settings/components/UsageTab.tsx'])
    // 그 한 번이 UsageDescription 안이다 — 파일 안 어디든이 아니라 그 함수여야 한다.
    const tab = source('features/settings/components/UsageTab.tsx')
    const body = tab.slice(tab.indexOf('export function UsageDescription'))
    expect(body.slice(0, body.indexOf('\n}'))).toContain("tr('usage.estimateNote')")
    // 양성 짝 — 술어가 살아 있다(키가 사라졌으면 위 배열도 비어 통과한다).
    expect(i18n.t('usage.estimateNote')).not.toBe('usage.estimateNote')
  })

  it('Meter 의 title API 와 V1 전용 주석이 남지 않았다', () => {
    const meter = source('shared/ui/Meter.tsx')
    expect(meter).not.toContain('title')
    // 양성 짝 — Meter 자체는 살아 있다.
    expect(meter).toContain('export function Meter')
    expect(meter).toContain('rounded-full bg-border')
    // 어느 호출부도 Meter 에 title 을 넘기지 않는다.
    const withTitle = files
      .filter((f) => !isTest(f))
      .filter((f) => /<Meter[^>]*title=/s.test(source(f)))
    expect(withTitle).toEqual([])
  })
})
