import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import type { ChatState, Message } from '../../reducer/chatReducer'
import { createClaudeBlockModel } from '../../harnesses/claude/transcript/claudeBlocks'
import { createOpenCodeBlockModel } from '../../harnesses/opencode/transcript/openCodeBlocks'
import { clearDisclosures, getDisclosure, setDisclosure } from '../../store/disclosureStore'
import { sessionApi, settingsApi } from '../../../../shared/api/ipc'
import { chatActions, consumeEntryIntent, useChatStore } from '../../store/chatStore'
import { installChatStoreHarness } from '../../store/chatStore.testHarness'
import { installViewportSelection } from './viewportSelection.testfixture'
import { TranscriptViewport, type ViewportBlockBase } from './TranscriptViewport'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('@tanstack/react-virtual', async () => {
  const { useRealVirtualizerWithFakeHooks } = await import('./viewportTestBridge.testfixture')
  return { useVirtualizer: useRealVirtualizerWithFakeHooks }
})

function makeScroller(): HTMLDivElement {
  return {
    scrollTop: 0,
    scrollHeight: 1000,
    clientHeight: 600,
    clientWidth: 600,
    getBoundingClientRect: () => ({ top: 0, bottom: 600, left: 0, width: 600, height: 600 }),
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: (selector: string) => dom!.query(selector),
    contains: (node: Node) => dom!.body.contains(node),
    scrollTo: () => {}
  } as unknown as HTMLDivElement
}

function makeMessages(): Message[] {
  return [
    { id: 'u:1', role: 'user', createdAt: 1000, parts: [{ type: 'text', text: 'hello' }] },
    {
      id: 'a:1',
      role: 'assistant',
      createdAt: 2000,
      parts: [
        { type: 'text', text: 'first answer' },
        { type: 'tool_call', toolRunId: 't1', toolName: 'Read', args: { file_path: 'a.ts' } },
        { type: 'tool_result', toolRunId: 't1', result: 'ok', isError: false }
      ]
    }
  ]
}

async function loadHistory(
  agentKind: 'code' | 'work',
  screen: string,
  messages: Message[]
): Promise<ChatState> {
  const load = vi.spyOn(sessionApi, 'load').mockResolvedValueOnce({
    id: 's-reopen',
    backend: screen === 'opencode' ? 'opencode' : 'claude',
    agentKind,
    title: 'history',
    messages
  })
  // Open another session without evicting the cached history being reopened.
  useChatStore.setState({ activeKey: 's' })
  await chatActions.loadSession('s-reopen')
  expect(load).toHaveBeenLastCalledWith('s-reopen')
  return useChatStore.getState().sessions['s-reopen'].session
}

let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  dom = undefined
  clearDisclosures('s-reopen')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('TranscriptViewport.reopen (VP-08 · AR-02 ↔ IT-01 · EP-4 ⑥⑪)', () => {
  it('reopening a cached session keeps block keys and DOM nodes on all three screens', async () => {
    installChatStoreHarness()
    vi.stubGlobal('requestAnimationFrame', vi.fn())
    vi.spyOn(settingsApi, 'set').mockResolvedValue({} as never)
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    const scrollRef = { current: makeScroller() }

    const screens = [
      {
        name: 'claude-code',
        agentKind: 'code',
        create: () => createClaudeBlockModel({ mode: 'code', sessionKey: 's-reopen' })
      },
      {
        name: 'claude-work',
        agentKind: 'work',
        create: () => createClaudeBlockModel({ mode: 'work', sessionKey: 's-reopen' })
      },
      { name: 'opencode', agentKind: 'code', create: () => createOpenCodeBlockModel() }
    ] as const

    for (const screen of screens) {
      const model = screen.create()
      const state1 = await loadHistory(screen.agentKind, screen.name, makeMessages())
      const snap1 = model.advance({
        messages: state1.messages,
        transcriptChanges: state1.transcriptChanges
      })
      dom.render(
        createElement(TranscriptViewport<ViewportBlockBase>, {
          snapshot: snap1 as never,
          scrollRef,
          estimateSizePx: 80,
          renderBlock: (b) => createElement('div', { 'data-inner-key': b.key }, b.key)
        })
      )
      const nodesBefore = dom.queryAll('[data-block-key]')
      const keysBefore = nodesBefore.map((n) => n.getAttribute('data-block-key'))
      expect(keysBefore.length).toBeGreaterThan(0)

      // Reopen cached session with fresh message objects carrying the same IDs (EP-4 ⑥)
      const state2 = await loadHistory(screen.agentKind, screen.name, makeMessages())
      const snap2 = model.advance({
        messages: state2.messages,
        transcriptChanges: state2.transcriptChanges
      })
      dom.render(
        createElement(TranscriptViewport<ViewportBlockBase>, {
          snapshot: snap2 as never,
          scrollRef,
          estimateSizePx: 80,
          renderBlock: (b) => createElement('div', { 'data-inner-key': b.key }, b.key)
        })
      )
      const nodesAfter = dom.queryAll('[data-block-key]')
      const keysAfter = nodesAfter.map((n) => n.getAttribute('data-block-key'))
      expect(keysAfter).toEqual(keysBefore)
      // Same DOM node instances preserved because block keys stayed identical
      for (let i = 0; i < nodesBefore.length; i++) {
        expect(nodesAfter[i]).toBe(nodesBefore[i])
      }
    }
  })

  it('sets an open intent for cached navigation and keeps same-session sync separate', async () => {
    installChatStoreHarness()
    vi.stubGlobal('requestAnimationFrame', vi.fn())
    vi.spyOn(settingsApi, 'set').mockResolvedValue({} as never)
    await loadHistory('code', 'opencode', makeMessages())
    expect(consumeEntryIntent('s')).toBeNull()
    expect(consumeEntryIntent('s-reopen')).toMatchObject({ cause: 'open', sessionKey: 's-reopen' })

    const load = vi.spyOn(sessionApi, 'load')
    load.mockClear()
    await chatActions.loadSession('s-reopen')
    expect(load).not.toHaveBeenCalled()
    expect(consumeEntryIntent('s-reopen')).toBeNull()

    load.mockResolvedValueOnce({
      id: 's-reopen',
      backend: 'opencode',
      agentKind: 'code',
      title: 'synced',
      messages: makeMessages()
    })
    await chatActions.loadSession('s-reopen', null, { revalidate: true })
    expect(load).toHaveBeenCalledWith('s-reopen')
    expect(consumeEntryIntent('s-reopen')).toBeNull()
    expect(
      useChatStore.getState().sessions['s-reopen'].session.transcriptChanges.log.at(-1)
    ).toEqual({ kind: 'reset', complete: true })
  })

  it('p15 applies late cached revalidation to X while Y keeps its open intent and its history', async () => {
    installChatStoreHarness()
    vi.stubGlobal('requestAnimationFrame', vi.fn())
    vi.spyOn(settingsApi, 'set').mockResolvedValue({} as never)
    await loadHistory('code', 'opencode', makeMessages())
    expect(consumeEntryIntent('s-reopen')?.cause).toBe('open')
    const updated = makeMessages().slice(0, 1)
    const fresh = {
      id: 's-reopen',
      backend: 'opencode' as const,
      agentKind: 'code' as const,
      title: 'updated',
      messages: updated
    }
    let resolveX!: (value: typeof fresh) => void
    const load = vi
      .spyOn(sessionApi, 'load')
      .mockReturnValueOnce(
        new Promise<typeof fresh>((resolve) => {
          resolveX = resolve
        })
      )
      .mockResolvedValueOnce({ ...fresh, id: 's', messages: makeMessages() })
    const waiting = chatActions.loadSession('s-reopen', null, { revalidate: true })
    await chatActions.loadSession('s')
    const y = useChatStore.getState()
    expect(y.entryIntent).toMatchObject({ sessionKey: 's', cause: 'open' })
    resolveX(fresh)
    await waiting
    const after = useChatStore.getState()
    expect(after.activeKey).toBe('s')
    expect(after.entryIntent).toBe(y.entryIntent)
    expect(after.sessions.s).toBe(y.sessions.s)
    expect(after.sessions['s-reopen'].session.messages.map((m) => m.id)).toEqual(['u:1'])
    load.mockResolvedValueOnce(fresh)
    await chatActions.loadSession('s-reopen')
    expect(consumeEntryIntent('s-reopen')).toMatchObject({ sessionKey: 's-reopen', cause: 'open' })
    expect(consumeEntryIntent('s-reopen')).toBeNull()
  })

  it('a reset that merges or splits blocks keeps surviving nodes, expansion and selection ends on all three screens', async () => {
    installChatStoreHarness()
    vi.stubGlobal('requestAnimationFrame', vi.fn())
    vi.spyOn(settingsApi, 'set').mockResolvedValue({} as never)
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    const scrollRef = { current: makeScroller() }
    const { select, selection } = installViewportSelection(dom)

    const screens = [
      {
        name: 'claude-code',
        agentKind: 'code',
        create: () => createClaudeBlockModel({ mode: 'code', sessionKey: 's-reopen' })
      },
      {
        name: 'claude-work',
        agentKind: 'work',
        create: () => createClaudeBlockModel({ mode: 'work', sessionKey: 's-reopen' })
      },
      { name: 'opencode', agentKind: 'code', create: () => createOpenCodeBlockModel() }
    ] as const

    for (const screen of screens) {
      const model = screen.create()
      const state1 = await loadHistory(screen.agentKind, screen.name, makeMessages())
      const snap1 = model.advance({
        messages: state1.messages,
        transcriptChanges: state1.transcriptChanges
      })
      dom.render(
        createElement(TranscriptViewport<ViewportBlockBase>, {
          snapshot: snap1 as never,
          scrollRef,
          estimateSizePx: 80,
          renderBlock: (b) =>
            createElement('div', { 'data-part-key': b.partKeys?.[0] ?? b.key }, b.key)
        })
      )
      const survivingKey = snap1.keyAt(0)
      const survivingNodeBefore = dom.query(`[data-block-key="${survivingKey}"]`)!
      setDisclosure('s-reopen', survivingKey, true)
      const part = survivingNodeBefore.children[0]
      select(part, 4, part, 1)
      expect(selection.toString().length).toBe(3)

      // Reset with an extra assistant part inserted (y13/y14)
      const extended = makeMessages()
      extended[1] = {
        ...extended[1],
        parts: [{ type: 'text', text: 'inserted before' }, ...extended[1].parts]
      }
      const state2 = await loadHistory(screen.agentKind, screen.name, extended)
      const snap2 = model.advance({
        messages: state2.messages,
        transcriptChanges: state2.transcriptChanges
      })
      dom.render(
        createElement(TranscriptViewport<ViewportBlockBase>, {
          snapshot: snap2 as never,
          scrollRef,
          estimateSizePx: 80,
          renderBlock: (b) =>
            createElement('div', { 'data-part-key': b.partKeys?.[0] ?? b.key }, b.key)
        })
      )
      expect(dom.query(`[data-block-key="${survivingKey}"]`)).toBe(survivingNodeBefore)
      expect(getDisclosure('s-reopen', survivingKey)).toBe(true)
      expect(selection.anchorNode?.parentElement).toBe(part)
      expect(selection.focusNode?.parentElement).toBe(part)
      expect([selection.anchorOffset, selection.focusOffset]).toEqual([4, 1])
    }
  })
})
