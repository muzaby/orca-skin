import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { expect, it, vi } from 'vitest'
import { AgentEnvironmentView } from '../../components/AgentEnvironmentView'
import { AgentEnvironmentView as CommonAgentEnvironmentView } from './AgentEnvironmentView'

const view = vi.hoisted(() => ({ agents: [] as unknown[] }))

vi.mock('../hooks/useEngines', () => ({
  useEngines: () => ({
    agents: view.agents,
    state: { busy: false, error: null },
    refresh: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    read: vi.fn()
  })
}))

it('keeps only the right-aligned add action beside the engine catalog heading (0262 AC31)', () => {
  const $ = load(renderToStaticMarkup(createElement(AgentEnvironmentView)))
  const header = $('h1').parent()
  expect(header.find('button')).toHaveLength(1)
  expect(header.find('button').text()).toBe('엔진 추가')
  expect(header.find('button').attr('class')?.split(' ')).toContain('ml-auto')
  expect(header.text()).not.toContain('새로고침')
})

it('orders engine cards Claude, OpenCode, then others', () => {
  const row = (key: string, adapter: string): unknown => ({
    key,
    adapter,
    provider: key,
    models: [],
    supported: true
  })
  view.agents = [
    row('opencode-corp', 'opencode'),
    row('legacy-row', 'legacy'),
    row('claude-runtime', 'claude'),
    row('opencode-host', 'opencode'),
    row('claude-settings', 'claude')
  ]
  try {
    const Card = ({ agent }: { agent: { key: string } }): React.JSX.Element =>
      createElement('article', { 'data-card': agent.key })
    const markup = renderToStaticMarkup(
      createElement(CommonAgentEnvironmentView, { Card, Form: () => null })
    )
    const $ = load(markup)
    expect(
      $('[data-card]')
        .map((_, node) => $(node).attr('data-card'))
        .get()
    ).toEqual(['claude-runtime', 'claude-settings', 'opencode-corp', 'opencode-host', 'legacy-row'])
  } finally {
    view.agents = []
  }
})
