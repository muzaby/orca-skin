import { createElement, memo } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import { chatReducer, initialChatState, type Message } from '../../reducer/chatReducer'
import { createClaudeBlockModel } from '../../harnesses/claude/transcript/claudeBlocks'
import { createOpenCodeBlockModel } from '../../harnesses/opencode/transcript/openCodeBlocks'
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
    scrollHeight: 1200,
    clientHeight: 800,
    clientWidth: 600,
    getBoundingClientRect: () => ({ top: 0, bottom: 800, left: 0, width: 600, height: 800 }),
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelectorAll: () => [],
    scrollTo: () => {}
  } as unknown as HTMLDivElement
}

let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  dom = undefined
})

describe('TranscriptViewport.lateResult (VP-17 · AR-04 ↔ IT-03 · EP-8 ⑨)', () => {
  it('a late tool result re-renders only the original call block on each screen', () => {
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    const scrollRef = { current: makeScroller() }

    const screens = [
      {
        name: 'claude-code',
        agentKind: 'code',
        create: () => createClaudeBlockModel({ mode: 'code', sessionKey: 's-late' })
      },
      {
        name: 'claude-work',
        agentKind: 'work',
        create: () => createClaudeBlockModel({ mode: 'work', sessionKey: 's-late' })
      },
      { name: 'opencode', agentKind: 'code', create: () => createOpenCodeBlockModel() }
    ] as const

    for (const screen of screens) {
      const renderCounts = new Map<string, number>()
      const lastProps = new Map<string, ViewportBlockBase>()
      const BlockView = memo(function BlockView({ block }: { block: ViewportBlockBase }) {
        if (lastProps.get(block.key) !== block) {
          lastProps.set(block.key, block)
          renderCounts.set(block.key, (renderCounts.get(block.key) ?? 0) + 1)
        }
        return createElement('div', { 'data-rendered-key': block.key }, block.key)
      })

      const initialMessages: Message[] = [
        { id: 'u:1', role: 'user', createdAt: 1000, parts: [{ type: 'text', text: 'run' }] },
        {
          id: 'a:1',
          role: 'assistant',
          createdAt: 2000,
          parts: [
            { type: 'text', text: 'calling tool' },
            { type: 'tool_call', toolRunId: 't-late', toolName: 'Bash', args: { cmd: 'ls' } }
          ]
        },
        { id: 'u:2', role: 'user', createdAt: 2500, parts: [{ type: 'text', text: 'follow-up' }] },
        {
          id: 'a:2',
          role: 'assistant',
          createdAt: 3000,
          parts: [{ type: 'text', text: 'next assistant message' }]
        }
      ]

      let state = chatReducer(initialChatState, {
        type: 'LOAD_SESSION',
        session: {
          id: 's-late',
          title: 't',
          agentKind: screen.agentKind,
          createdAt: 0,
          updatedAt: 0,
          messages: initialMessages
        } as never,
        complete: true
      })

      const model = screen.create()
      const snap1 = model.advance({
        messages: state.messages,
        transcriptChanges: state.transcriptChanges
      })
      dom.render(
        createElement(TranscriptViewport<ViewportBlockBase>, {
          snapshot: snap1 as never,
          scrollRef,
          estimateSizePx: 80,
          renderBlock: (b) => createElement(BlockView, { block: b })
        })
      )
      renderCounts.clear()

      // Late tool_result arrives with original owner messageKey 'a:1'
      state = chatReducer(state, {
        type: 'RECV_EVENT',
        event: {
          type: 'tool.call.completed',
          sessionKey: 's-late',
          toolRunId: 't-late',
          messageKey: 'a:1',
          messageKeySource: 'owner',
          result: 'late output',
          isError: false
        } as never
      })
      const resultPart = { type: 'tool_result', toolRunId: 't-late', result: 'late output' }
      expect(state.messages.find((message) => message.id === 'a:1')?.parts).toContainEqual(
        expect.objectContaining(resultPart)
      )
      expect(state.messages.find((message) => message.id === 'a:2')?.parts).not.toContainEqual(
        expect.objectContaining(resultPart)
      )
      const snap2 = model.advance({
        messages: state.messages,
        transcriptChanges: state.transcriptChanges
      })
      dom.render(
        createElement(TranscriptViewport<ViewportBlockBase>, {
          snapshot: snap2 as never,
          scrollRef,
          estimateSizePx: 80,
          renderBlock: (b) => createElement(BlockView, { block: b })
        })
      )

      // The original call block (a:1:tool:t-late) re-rendered; unrelated user block u:1 did NOT
      expect(renderCounts.get('a:1:tool:t-late')).toBe(1)
      expect(renderCounts.get('u:1:user') ?? 0).toBe(0)
    }
  })
})
