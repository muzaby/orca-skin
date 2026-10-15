import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { expect, it, vi } from 'vitest'
import { AgentEnvironmentView } from './AgentEnvironmentView'

vi.mock('../hooks/useEngines', () => ({
  useEngines: () => ({
    agents: [],
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
