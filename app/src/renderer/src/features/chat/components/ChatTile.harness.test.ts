import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { describe, expect, it, vi } from 'vitest'
import { initialChatState } from '../reducer/chatReducer'
import { useScrollAnchor } from '../hooks/useScrollAnchor'

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
  useLiveText: () => '',
  useLiveReasoning: () => '',
  usePendingSteer: () => [],
  chatActions: {}
}))
vi.mock('../hooks/useScrollAnchor', () => ({
  useScrollAnchor: vi.fn(() => ({
    scrollRef: { current: null },
    contentRef: { current: null },
    onScroll: vi.fn(),
    showJump: false,
    anchored: false
  }))
}))
vi.mock('./ChatTitleBar', () => ({ ChatTitleBar: () => null }))
vi.mock('./transcript/LineageBanner', () => ({ LineageBanner: () => null }))
vi.mock('./Composer', () => ({
  Composer: () => createElement('div', { 'data-composer-probe': '' })
}))
vi.mock('./rightpanel/RightPanel', () => ({ RightPanel: () => null }))

import { ChatTile } from './ChatTile'

describe('harness transcript background', () => {
  it.each([
    { backend: 'claude', agentKind: 'code' },
    { backend: 'claude', agentKind: 'work' },
    { backend: 'opencode', agentKind: 'code' }
  ] as const)(
    'preserves the shared canvas, fades and transcript-only text scale for $backend/$agentKind',
    ({ backend, agentKind }) => {
      vi.clearAllMocks()
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
      const textScaleClassName = '[--transcript-text-scale:var(--chat-text-scale,1)]'
      const scaleOwners = $('[class]').filter((_, element) =>
        $(element).hasClass(textScaleClassName)
      )
      expect(scaleOwners).toHaveLength(1)
      expect(scaleOwners.is('.app-frame-transcript')).toBe(true)
      const composer = $('[data-composer-probe]')
      expect(composer).toHaveLength(1)
      expect(
        composer.parents().filter((_, element) => $(element).hasClass(textScaleClassName))
      ).toHaveLength(0)
      expect(useScrollAnchor).toHaveBeenCalledTimes(backend === 'claude' ? 1 : 0)
    }
  )
})
