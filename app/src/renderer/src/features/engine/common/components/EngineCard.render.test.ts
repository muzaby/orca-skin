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
  expect($('button')).toHaveLength(2)
  expect($('button[disabled]')).toHaveLength(0)
})
