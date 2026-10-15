import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../shared/ui/renderHarness.testfixture'
import { initialChatState } from '../reducer/chatReducer'
import { ChatTile } from './ChatTile'

const fixture = vi.hoisted(() => ({
  backend: 'claude' as 'claude' | 'opencode',
  key: 'pending',
  mounts: 0,
  unmounts: 0,
  scroll: {
    scrollRef: { current: null },
    contentRef: { current: null },
    onScroll: () => {},
    showJump: false,
    scrollToBottom: () => {},
    anchored: false
  }
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../store/chatStore', () => ({
  useChatSession: (select: (state: typeof initialChatState) => unknown) =>
    select({ ...initialChatState, backend: fixture.backend, sessionId: fixture.key }),
  useChatStore: (select: (state: unknown) => unknown) =>
    select({ activeKey: fixture.key, draftRestore: null }),
  useChatResponding: () => false,
  usePendingSteer: () => [],
  chatActions: {}
}))
vi.mock('../hooks/useScrollAnchor', () => ({ useScrollAnchor: () => fixture.scroll }))
// Keep the actual harness dispatcher and its keyed controller boundary; only
// browser scroll measurement is replaced in this React lifetime test.
vi.mock('../harnesses/opencode/transcript/ScrollController', () => ({
  OpenCodeScrollController: ({
    children
  }: {
    children: (scroll: typeof fixture.scroll) => unknown
  }) => children(fixture.scroll)
}))
vi.mock('./ChatTitleBar', () => ({ ChatTitleBar: () => null }))
vi.mock('./transcript/LineageBanner', () => ({ LineageBanner: () => null }))
vi.mock('./transcript/TranscriptView', () => ({ TranscriptView: () => null }))
vi.mock('./rightpanel/RightPanel', () => ({ RightPanel: () => null }))
vi.mock('./Composer', async () => {
  const { createElement, useEffect, useState } = await import('react')
  return {
    Composer: function ComposerProbe() {
      const [draft, setDraft] = useState('')
      useEffect(() => {
        fixture.mounts++
        return () => {
          fixture.unmounts++
        }
      }, [])
      return createElement(
        'button',
        { 'data-composer-probe': '', onClick: () => setDraft('draft + attachment') },
        draft
      )
    }
  }
})
let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
describe('ChatTile Composer identity', () => {
  it('keeps the Composer instance across harness switch and draft session materialization', () => {
    vi.useFakeTimers()
    fixture.backend = 'claude'
    fixture.key = 'pending'
    fixture.mounts = 0
    fixture.unmounts = 0
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    const render = (): void =>
      dom!.render(createElement(ChatTile, { backendLabel: fixture.backend, canAbort: true }))
    render()
    dom.click(dom.body.querySelector('[data-composer-probe]')!)
    for (const [backend, key] of [
      ['opencode', 'pending'],
      ['opencode', 'session-created'],
      ['claude', 'another-session']
    ] as const) {
      fixture.backend = backend
      fixture.key = key
      render()
      expect(dom.body.querySelector('[data-composer-probe]')!.textContent).toBe(
        'draft + attachment'
      )
      expect(fixture.mounts).toBe(1)
      expect(fixture.unmounts).toBe(0)
    }
  })
})
