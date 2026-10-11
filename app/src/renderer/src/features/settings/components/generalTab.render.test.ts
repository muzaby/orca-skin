// 0256 AC1 — 환경설정 그룹의 행 순서·설명·옵션 순서.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Tweaks } from '../../../shared/theme/TweakProvider'

const values: Tweaks = {
  theme: 'white',
  transcriptTextSize: 'medium',
  transcriptWidth: 'medium',
  sidebarCollapsed: false,
  sidebarWidth: 248,
  appFont: 'sans',
  uiLocale: 'ko',
  notifyOnComplete: false,
  spendingLimitUsd: 90
}
vi.hoisted(() => vi.stubGlobal('__APP_VERSION__', 'test'))
vi.mock('../../../shared/theme', () => ({
  useTweakContext: (selector: (t: Tweaks) => unknown) => ({
    t: selector(values),
    setTweak: vi.fn()
  })
}))
vi.mock('../../../shared/api/ipc', () => ({
  settingsApi: { get: () => new Promise(() => {}), set: vi.fn() }
}))

import { GeneralTab } from './GeneralTab'

const text = (html: string): string => html.replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n')

describe('0256 AC1 — 환경설정 행', () => {
  const html = renderToStaticMarkup(createElement(GeneralTab))
  const lines = text(html).split('\n').filter(Boolean)
  const after = (label: string): string => lines[lines.indexOf(label) + 1]

  it('밀도 행이 없고 행 순서가 모양·폰트·언어·텍스트 크기·너비다', () => {
    expect(html).not.toContain('밀도')
    const order = ['모양', '폰트', '언어', '대화 내용 텍스트 크기', '대화 기록 너비'].map((label) =>
      lines.indexOf(label)
    )
    expect(order.every((index) => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('각 신규 행의 설명이 그 행 라벨 바로 다음에 온다', () => {
    expect(after('대화 내용 텍스트 크기')).toBe('대화 내용 텍스트의 크기입니다.')
    expect(after('대화 기록 너비')).toBe('트랜스크립트와 입력창 열의 최대 너비입니다.')
  })

  it('옵션 라벨 순서가 작게·보통·크게 / 좁게·보통·넓게다', () => {
    const selects = [...html.matchAll(/<select[\s\S]*?<\/select>/g)].map((m) =>
      [...m[0].matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((o) => o[1])
    )
    expect(selects).toContainEqual(['작게', '보통', '크게'])
    expect(selects).toContainEqual(['좁게', '보통', '넓게'])
  })
})
