import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AgentEnvironment } from '../../../../../shared/ipc'
import { ko } from '../../../shared/i18n/resources/ko'

const state = vi.hoisted(() => ({ agents: [] as AgentEnvironment[] }))
vi.mock('../hooks/useEngines', () => ({
  useEngines: () => ({
    agents: state.agents,
    state: { busy: false, error: null },
    refresh: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    read: vi.fn()
  })
}))
import { AgentEnvironmentView } from './AgentEnvironmentView'

const environment = (key: string, source: AgentEnvironment['source']): AgentEnvironment => ({
  key,
  adapter: 'claude',
  provider: key,
  source,
  supported: true,
  readOnly: source === 'runtime',
  models: []
})
const render = (): string => renderToStaticMarkup(createElement(AgentEnvironmentView))
const count = (markup: string): string | undefined =>
  markup.match(/data-engine-catalog-count=""[^>]*>([^<]+)</)?.[1]
// 실제 EngineCard의 최상위 요소를 같은 SSR 산출에서 센다.
const cards = (markup: string): number =>
  [...markup.matchAll(/<div class="rounded-xl border border-border bg-panel px-4 py-3\.5">/g)]
    .length
const expectCountMatchesCards = (markup: string, expected: number): void => {
  expect(cards(markup)).toBe(expected)
  expect(count(markup)).toBe(`${cards(markup)}개`)
}

describe('engine catalog count (0249 AC22)', () => {
  it('counts settings and deployed runtime cards in the same render', () => {
    state.agents = [
      environment('anthropic', 'settings'),
      environment('bedrock', 'settings'),
      environment('corporate-runtime', 'runtime')
    ]
    const markup = render()
    expectCountMatchesCards(markup, 3)
    expect(markup).toContain('corporate-runtime')
    expect(markup).not.toContain(ko.engine.subtitle)
    expect(markup).not.toContain('<code>')
  })

  it('updates the count alongside runtime additions and removals, including legacy provenance', () => {
    state.agents = [environment('anthropic', 'settings'), environment('legacy', undefined)]
    expectCountMatchesCards(render(), 2)
    state.agents = [...state.agents, environment('corporate-runtime', 'runtime')]
    expectCountMatchesCards(render(), 3)
    state.agents = state.agents.filter((agent) => agent.source !== 'runtime')
    expectCountMatchesCards(render(), 2)
    state.agents = [environment('corporate-runtime', 'runtime')]
    expectCountMatchesCards(render(), 1)
  })

  it('shows zero and the empty state when there are no cards', () => {
    state.agents = []
    const markup = render()
    expectCountMatchesCards(markup, 0)
    expect(markup).toContain(ko.engine.emptyState)
  })
})
