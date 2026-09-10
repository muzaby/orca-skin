import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import type { Tweaks } from '../shared/theme/TweakProvider'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { SidebarUserButton } from './SidebarUserButton'
import { useCompletionNotifier } from './hooks/useCompletionNotifier'
import { DebugPanel } from '../features/debug/components/DebugPanel'
import { GeneralTab } from '../features/settings/components/GeneralTab'

const h = vi.hoisted(() => {
  vi.stubGlobal('__APP_VERSION__', 'test')
  return { selectors: [] as ((t: Tweaks) => unknown)[], patch: vi.fn() }
})
const values: Tweaks = {
  theme: 'white',
  density: 'normal',
  sidebarCollapsed: false,
  sidebarWidth: 248,
  appFont: 'sans',
  uiLocale: 'ko',
  notifyOnComplete: false,
  spendingLimitUsd: 90
}
vi.mock('../shared/theme', () => ({
  useTweakContext: (selector: (t: Tweaks) => unknown) => {
    h.selectors.push(selector)
    return { t: selector(values), setTweak: h.patch }
  }
}))

function CompletionProbe(): null {
  useCompletionNotifier()
  return null
}
const cases: [string, () => ReactNode, (keyof Tweaks)[]][] = [
  ['Header', () => createElement(Header, { onOpenSearch: () => {} }), ['sidebarCollapsed']],
  [
    'Sidebar',
    () =>
      createElement(Sidebar, {
        projectsSlot: null,
        pinnedSlot: null,
        footerSlot: null,
        onOpenPlugins: () => {}
      }),
    ['sidebarCollapsed', 'sidebarWidth']
  ],
  ['UserButton', () => createElement(SidebarUserButton), ['uiLocale']],
  ['CompletionNotifier', () => createElement(CompletionProbe), ['notifyOnComplete']],
  ['DebugPanel', () => createElement(DebugPanel, {}), ['theme', 'sidebarCollapsed']],
  [
    'GeneralTab',
    () => createElement(GeneralTab),
    ['theme', 'appFont', 'uiLocale', 'density', 'notifyOnComplete']
  ]
]
beforeEach(() => {
  h.selectors = []
  h.patch.mockClear()
})

describe('actual renderer Tweaks consumer selectors', () => {
  it.each(cases)('%s reads only its required fields', (_name, render, expected) => {
    renderToStaticMarkup(createElement(MemoryRouter, null, render()))
    expect(h.selectors).toHaveLength(1)
    const reads = new Set<string>()
    const observed = new Proxy(values, {
      get: (target, key: keyof Tweaks) => {
        reads.add(key)
        return target[key]
      }
    })
    const selected = h.selectors[0](observed)
    expect([...reads].sort()).toEqual([...expected].sort())
    const unrelated = {
      ...values,
      spendingLimitUsd: 500,
      ...(expected.includes('sidebarWidth') ? {} : { sidebarWidth: 420 })
    }
    expect(h.selectors[0](unrelated)).toEqual(selected)
  })
})
