vi.mock('zustand', async (original) => {
  const actual = await original<typeof import('zustand')>()
  const { createStore } = await import('zustand/vanilla')
  const { fakeHooks } = await import('../../../shared/ui/renderHarness.testfixture')
  const bind = (init: import('zustand').StateCreator<unknown>): unknown => {
    const store = createStore(init)
    return Object.assign(
      (select: (state: unknown) => unknown) =>
        fakeHooks.useSyncExternalStore(store.subscribe, () => select(store.getState())),
      store
    )
  }
  return {
    ...actual,
    create: (init?: import('zustand').StateCreator<unknown>) => (init ? bind(init) : bind)
  }
})
import { useHarnessAvailabilityStore } from '../../../shared/stores/harnessAvailabilityStore'
import { beforeEach } from 'vitest'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../shared/ui/renderHarness.testfixture'
import { initialChatState } from '../reducer/chatReducer'
import { ChatTile } from './ChatTile'

const fixture = vi.hoisted(() => ({
  backend: 'claude' as 'claude' | 'opencode',
  key: 'pending',
  transcriptRenders: 0,
  jump: undefined as (() => void) | undefined,
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
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>()
  const { fakeHooks } = await import('../../../shared/ui/renderHarness.testfixture')
  return { ...actual, ...fakeHooks, default: { ...actual, ...fakeHooks } }
})
vi.mock('../store/chatStore', () => ({
  useChatSession: (select: (state: typeof initialChatState) => unknown) =>
    select({ ...initialChatState, backend: fixture.backend, sessionId: fixture.key }),
  useChatStore: (select: (state: unknown) => unknown) =>
    select({ activeKey: fixture.key, draftRestore: null }),
  useChatResponding: () => false,
  usePendingSteer: () => [],
  chatActions: {}
}))
vi.mock('../harnesses/claude/transcript/useScrollAnchor', () => ({
  useScrollAnchor: () => fixture.scroll
}))
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
vi.mock('./transcript/TranscriptView', () => ({
  TranscriptView: () => {
    fixture.transcriptRenders++
    return null
  }
}))
vi.mock('./rightpanel/RightPanelFrame', () => ({
  RightPanelFrame: () => createElement('div', { 'data-frame-owner-probe': '' })
}))
vi.mock('./Composer', async () => {
  const { createElement, useEffect, useState } = await import('react')
  return {
    Composer: function ComposerProbe(props: {
      showScrollToBottom?: boolean
      onScrollToBottom?: () => void
    }) {
      fixture.jump = props.showScrollToBottom ? props.onScrollToBottom : undefined
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
  it('renders a switched transcript once while the jump control is hidden, then publishes a visible control', () => {
    vi.useFakeTimers()
    fixture.backend = 'claude'
    fixture.key = 'first'
    fixture.scroll.showJump = false
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    const render = (): void =>
      dom!.render(createElement(ChatTile, { backendLabel: fixture.backend, canAbort: true }))
    render()
    fixture.transcriptRenders = 0
    fixture.key = 'second'
    render()
    expect(fixture.transcriptRenders).toBe(1)
    expect(fixture.jump).toBeUndefined()
    fixture.scroll.showJump = true
    render()
    expect(fixture.jump).toBe(fixture.scroll.scrollToBottom)
    fixture.scroll.showJump = false
    render()
    expect(fixture.jump).toBeUndefined()
  })

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
    const frame = dom.body.querySelector('[data-frame-owner-probe]')
    expect(frame).not.toBeNull()
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
      expect(dom.body.querySelector('[data-frame-owner-probe]') === frame).toBe(true)
      expect(fixture.mounts).toBe(1)
      expect(fixture.unmounts).toBe(0)
    }
  })
})

beforeEach(() =>
  useHarnessAvailabilityStore.setState(({ byId }) => ({
    byId: { ...byId, opencode: { id: 'opencode', installed: true, usable: true } }
  }))
)
