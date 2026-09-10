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

describe('engine settings count', () => {
  it('counts two registered settings while retaining a runtime environment in the list', () => {
    state.agents = [
      environment('anthropic', 'settings'),
      environment('bedrock', 'settings'),
      environment('corporate-runtime', 'runtime')
    ]
    const markup = render()
    expect(count(markup)).toBe('2개')
    expect(markup).toContain('corporate-runtime')
    expect(markup).not.toContain(ko.engine.subtitle)
    expect(markup).not.toContain('<code>')
  })

  it('updates the total when settings are removed and excludes entries without settings provenance', () => {
    state.agents = [environment('anthropic', 'settings'), environment('legacy', undefined)]
    expect(count(render())).toBe('1개')
    state.agents = [environment('corporate-runtime', 'runtime')]
    expect(count(render())).toBe('0개')
    state.agents = []
    expect(count(render())).toBe('0개')
  })
})
