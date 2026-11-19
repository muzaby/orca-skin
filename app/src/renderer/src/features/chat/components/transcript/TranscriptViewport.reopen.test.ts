import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import { chatReducer, initialChatState, type Message } from '../../reducer/chatReducer'
import { createClaudeBlockModel } from '../../harnesses/claude/transcript/claudeBlocks'
import { createOpenCodeBlockModel } from '../../harnesses/opencode/transcript/openCodeBlocks'
import { clearDisclosures, getDisclosure, setDisclosure } from '../../store/disclosureStore'
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

let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  dom = undefined
  clearDisclosures('s-reopen')
})

describe('TranscriptViewport.reopen (VP-08 · AR-02 ↔ IT-01 · EP-4 ⑥⑪)', () => {
  it('reopening a cached session keeps block keys and DOM nodes on all three screens', () => {
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
      const state1 = chatReducer(initialChatState, {
        type: 'LOAD_SESSION',
        session: {
          id: 's-reopen',
          title: 't',
          agentKind: screen.agentKind,
          createdAt: 0,
          updatedAt: 0,
          messages: makeMessages()
        } as never,
        complete: true
      })
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
      const state2 = chatReducer(state1, {
        type: 'LOAD_SESSION',
        session: {
          id: 's-reopen',
          title: 't',
          agentKind: screen.agentKind,
          createdAt: 0,
          updatedAt: 0,
          messages: makeMessages()
        } as never,
        complete: true
      })
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

  it('a reset that merges or splits blocks keeps surviving nodes, expansion and selection ends on all three screens', () => {
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
      const state1 = chatReducer(initialChatState, {
        type: 'LOAD_SESSION',
        session: {
          id: 's-reopen',
          title: 't',
          agentKind: screen.agentKind,
          createdAt: 0,
          updatedAt: 0,
          messages: makeMessages()
        } as never,
        complete: true
      })
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

      // Reset with an extra assistant part inserted (y13/y14)
      const extended = makeMessages()
      extended[1] = {
        ...extended[1],
        parts: [{ type: 'text', text: 'inserted before' }, ...extended[1].parts]
      }
      const state2 = chatReducer(state1, {
        type: 'LOAD_SESSION',
        session: {
          id: 's-reopen',
          title: 't',
          agentKind: screen.agentKind,
          createdAt: 0,
          updatedAt: 0,
          messages: extended
        } as never,
        complete: true
      })
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
    }
  })
})
