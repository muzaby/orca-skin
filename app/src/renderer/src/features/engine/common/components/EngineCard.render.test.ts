import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { expect, it, vi } from 'vitest'
import type { AgentEnvironment } from '../../../../../../shared/ipc'
import { EngineCard } from '../../components/EngineCard'

it.each([
  ['claude', 'Claude'],
  ['opencode', 'OpenCode']
])('preserves the %s card label and editable actions (0262 AC31)', (adapter, label) => {
  const agent: AgentEnvironment = {
    key: `${adapter}/fixture`,
    adapter,
    provider: 'fixture',
    supported: true,
    models: []
  }
  const $ = load(
    renderToStaticMarkup(
      createElement(EngineCard, { agent, busy: false, onEdit: vi.fn(), onDelete: vi.fn() })
    )
  )
  expect($('span').first().text()).toBe(label)
  expect($('svg').first().attr('viewBox')).toBe(adapter === 'claude' ? '0 0 248 248' : '0 0 16 20')
  expect(
    $('svg')
      .first()
      .hasClass(adapter === 'claude' ? 'text-spinner' : 'text-oc-ink')
  ).toBe(true)
  expect($('svg').first().next('span').text()).toBe(label)
  expect($('button')).toHaveLength(2)
  expect($('button[disabled]')).toHaveLength(0)
})

it('does not assign a supported harness brand to an unknown adapter', () => {
  const $ = load(
    renderToStaticMarkup(
      createElement(EngineCard, {
        agent: { key: 'external/x', adapter: 'external', supported: false, models: [] },
        onEdit: vi.fn(),
        onDelete: vi.fn()
      })
    )
  )
  expect($('svg[viewBox="0 0 248 248"],svg[viewBox="0 0 16 20"]')).toHaveLength(0)
  expect($.text()).toContain('external')
})

it.each([
  ['missing', 'OpenCode가 설치되어 있지 않습니다'],
  ['unsupported', '지원하지 않는 OpenCode 버전입니다'],
  ['failed', 'OpenCode 설치 상태를 확인하지 못했습니다']
] as const)(
  'displays the %s installation reason instead of the generic unsupported badge',
  (reason, text) => {
    const $ = load(
      renderToStaticMarkup(
        createElement(EngineCard, {
          agent: {
            key: 'opencode/fixture',
            adapter: 'opencode',
            models: [],
            supported: false,
            unavailable: reason
          },
          onEdit: vi.fn(),
          onDelete: vi.fn()
        })
      )
    )
    expect($.text()).toContain(text)
  }
)
