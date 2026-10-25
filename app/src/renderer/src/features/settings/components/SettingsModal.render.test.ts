import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { expect, it, vi } from 'vitest'
import { SettingsModal } from './SettingsModal'
import { providerTabId, useSettingsModalStore } from '../store/settingsModalStore'

vi.mock('../../../shared/ui/Modal', () => ({
  Modal: ({ children }: { children: ReactNode }) => children
}))
vi.mock('../../../shared/stores/agentStore', () => ({
  useAgentStore: (select: (s: unknown) => unknown) =>
    select({
      agents: [{ key: 'fixture', provider: 'Fixture', adapter: 'opencode' }],
      ensureLoaded: vi.fn()
    })
}))
vi.mock('../store/settingsModalStore', async (original) => {
  const actual = await original<typeof import('../store/settingsModalStore')>()
  return {
    ...actual,
    useSettingsModalStore: Object.assign(
      (select: (s: ReturnType<typeof actual.useSettingsModalStore.getState>) => unknown) =>
        select(actual.useSettingsModalStore.getState()),
      actual.useSettingsModalStore
    )
  }
})
vi.mock('./GeneralTab', () => ({
  GeneralTab: ({
    harnessBrand
  }: {
    harnessBrand?: (backend: 'claude' | 'opencode') => ReactNode
  }) =>
    createElement(
      'div',
      { 'data-page': 'general' },
      harnessBrand?.('claude'),
      harnessBrand?.('opencode')
    )
}))
vi.mock('./UsageTab', () => ({ UsageTab: () => createElement('div', { 'data-page': 'usage' }) }))
vi.mock('./ProviderUsageTab', () => ({
  ProviderUsageTab: ({ provider }: { provider: { key: string } }) =>
    createElement('div', { 'data-page': provider.key })
}))

it('retains general, usage and provider navigation without harness tabs or pages', () => {
  for (const [tab, page] of [
    ['general', 'general'],
    ['usage', 'usage'],
    [providerTabId('fixture'), 'fixture']
  ] as const) {
    useSettingsModalStore.getState().show(tab)
    const $ = load(renderToStaticMarkup(createElement(SettingsModal)))
    expect($('[data-page]').attr('data-page')).toBe(page)
    expect($.text()).toContain('일반')
    expect($.text()).toContain('사용량')
    expect($.text()).toContain('Fixture')
    expect($.text()).not.toMatch(/하네스|Claude Code|OpenCode/)
  }
  useSettingsModalStore.getState().hide()
  expect(useSettingsModalStore.getState().open).toBe(false)
})

it('passes the harness brand slot to the general tab', () => {
  useSettingsModalStore.getState().show('general')
  const $ = load(
    renderToStaticMarkup(
      createElement(SettingsModal, {
        harnessBrand: (backend) => createElement('i', { 'data-brand': backend })
      })
    )
  )
  expect(
    $('[data-page="general"] [data-brand]')
      .map((_i, node) => $(node).attr('data-brand'))
      .get()
  ).toEqual(['claude', 'opencode'])
})
