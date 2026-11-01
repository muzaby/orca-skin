import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import type { Backend } from '../../../shared/ipc'
import { SidebarUserButton } from './SidebarUserButton'

vi.mock('../features/providers', () => ({ useProviderPrincipal: () => null }))
vi.mock('../shared/theme', () => ({ useTweakContext: () => ({ t: {}, setTweak: vi.fn() }) }))
vi.mock('../features/settings', () => ({
  useSettingsModalStore: () => vi.fn(),
  SettingsModal: ({ harnessBrand }: { harnessBrand: (backend: Backend) => ReactNode }) =>
    createElement(
      'div',
      null,
      createElement('section', { id: 'claude-brand' }, harnessBrand('claude')),
      createElement('section', { id: 'opencode-brand' }, harnessBrand('opencode'))
    )
}))

it('passes each settings brand with the original sidebar tone', () => {
  const html = renderToStaticMarkup(createElement(SidebarUserButton))
  const [claude, opencode] = html.split('id="claude-brand"')[1].split('id="opencode-brand"')
  expect(claude).toContain('viewBox="0 0 248 248"')
  expect(claude).toContain('text-spinner')
  expect(opencode).toContain('viewBox="0 0 16 20"')
  expect(opencode).toContain('text-ink')
})
