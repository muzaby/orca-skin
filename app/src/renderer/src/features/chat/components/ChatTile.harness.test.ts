import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { describe, expect, it, vi } from 'vitest'
import { initialChatState } from '../reducer/chatReducer'

const fixture = vi.hoisted(() => ({
  backend: 'claude' as 'claude' | 'opencode',
  agentKind: 'code' as 'code' | 'work'
}))
vi.mock('../store/chatStore', () => ({
  useChatSession: (select: (state: typeof initialChatState) => unknown) =>
    select({ ...initialChatState, backend: fixture.backend, agentKind: fixture.agentKind }),
  useChatStore: (select: (state: unknown) => unknown) =>
    select({ activeKey: 's', draftRestore: null }),
  useChatResponding: () => false,
  usePendingSteer: () => [],
  chatActions: {}
}))
vi.mock('../hooks/useScrollAnchor', () => ({
  useScrollAnchor: () => ({
    scrollRef: { current: null },
    contentRef: { current: null },
    onScroll: vi.fn(),
    showJump: false,
    anchored: false
  })
}))
vi.mock('./ChatTitleBar', () => ({ ChatTitleBar: () => null }))
vi.mock('./transcript/LineageBanner', () => ({ LineageBanner: () => null }))
vi.mock('./Composer', () => ({ Composer: () => null }))
vi.mock('./rightpanel/RightPanel', () => ({ RightPanel: () => null }))

import { ChatTile } from './ChatTile'

describe('harness transcript background', () => {
  it.each([
    { backend: 'claude', agentKind: 'code' },
    { backend: 'claude', agentKind: 'work' },
    { backend: 'opencode', agentKind: 'code' }
  ] as const)(
    'preserves the shared canvas and fades with the original $backend/$agentKind viewport',
    ({ backend, agentKind }) => {
      fixture.backend = backend
      fixture.agentKind = agentKind
      const $ = load(
        renderToStaticMarkup(createElement(ChatTile, { backendLabel: backend, canAbort: true }))
      )
      for (const surface of ['.app-frame-pane-host', '.app-frame-tile']) {
        expect($(surface).hasClass('bg-bg')).toBe(true)
        expect($(surface).hasClass('bg-oc-background')).toBe(false)
      }
      expect($('.app-frame-transcript').hasClass('bg-bg')).toBe(backend === 'opencode')
      expect($('.app-frame-transcript').hasClass('bg-oc-background')).toBe(false)
      expect($('[class~="bg-gradient-to-b"]').hasClass('from-bg')).toBe(true)
      expect($('[class~="bg-gradient-to-t"]').hasClass('from-bg')).toBe(true)
      expect($('.app-frame-transcript').attr('data-harness')).toBe(backend)
    }
  )
})
