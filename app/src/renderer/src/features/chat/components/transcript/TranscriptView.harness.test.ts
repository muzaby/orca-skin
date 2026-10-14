import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { describe, expect, it, vi } from 'vitest'
import { TranscriptView } from './TranscriptView'
import { OpenCodeToolGroup } from '../../harnesses/opencode/transcript/ToolGroup'
import { transcriptPresentation } from '../../lib/agentPresentation'
import { installChatStoreHarness } from '../../store/chatStore.testHarness'
import {
  chatReducer,
  initialChatState,
  type ChatState,
  type Message
} from '../../reducer/chatReducer'

// SSR은 Zustand 초기 스냅샷을 읽으므로 구독 훅만 실제 활성 세션의 현재 스냅샷에 연결한다.
vi.mock('../../store/chatStore', async (original) => {
  const module = await original<typeof import('../../store/chatStore')>()
  return {
    ...module,
    useChatSession: (
      selector: (state: ReturnType<typeof module.getActiveChatSession>) => unknown
    ) => selector(module.getActiveChatSession())
  }
})

const userMessage: Message = {
  role: 'user',
  createdAt: 1,
  parts: [{ type: 'text', text: 'Prompt' }]
}
const assistantMessage: Message = {
  role: 'assistant',
  createdAt: 2,
  parts: [{ type: 'text', text: 'Answer' }]
}

describe('OpenCode transcript presentation', () => {
  it.each(['claude', 'opencode'] as const)(
    'uses the harness spinner on each pending transcript path (%s)',
    (backend) => {
      for (const messages of [[], [userMessage], [userMessage, assistantMessage]]) {
        const running = {
          ...initialChatState,
          backend,
          messages,
          inflight: true,
          turnStartedAt: 100
        }
        const render = (state: ChatState): ReturnType<typeof load> => {
          installChatStoreHarness(state)
          return load(
            renderToStaticMarkup(
              createElement(TranscriptView, {
                backend,
                agentKind: 'code',
                messages,
                pendingSteer: [],
                inflight: state.inflight,
                loadingSession: false,
                anchored: false,
                scrollRef: { current: null },
                contentRef: { current: null },
                onScroll: () => {}
              })
            )
          )
        }
        const $ = render(running)
        expect($('[aria-live="polite"] svg')).toHaveLength(1)
        expect($('[data-component="opencode-spinner"]')).toHaveLength(
          backend === 'opencode' ? 1 : 0
        )
        expect($('[aria-live="polite"] .text-spinner')).toHaveLength(backend === 'claude' ? 1 : 0)
        for (const event of [
          { type: 'telemetry', sessionId: 's' },
          { type: 'turn.aborted', sessionId: 's', reason: 'interrupted' }
        ] as const) {
          const settled = chatReducer(running, { type: 'RECV_EVENT', event })
          expect(settled.inflight).toBe(false)
          expect(render({ ...running, ...settled })('[aria-live="polite"] svg')).toHaveLength(0)
        }
      }
    }
  )
  it.each(['claude', 'opencode'] as const)('renders shared messages in the %s slice', (backend) => {
    installChatStoreHarness({ backend })
    const html = renderToStaticMarkup(
      createElement(TranscriptView, {
        backend,
        agentKind: 'code',
        messages: [
          { role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'User prompt' }] },
          { role: 'assistant', createdAt: 2, parts: [{ type: 'text', text: 'Answer body' }] }
        ],
        pendingSteer: [],
        inflight: false,
        loadingSession: false,
        anchored: false,
        scrollRef: { current: null },
        contentRef: { current: null },
        onScroll: () => {}
      })
    )
    expect(load(html)(`[data-harness="${backend}"]`)).toHaveLength(1)
    expect(html).toContain('User prompt')
    expect(html).toContain('Answer body')
    expect(load(html)(`[data-harness="${backend}"]`).hasClass('bg-bg')).toBe(true)
  })
  it('shows normalized edit detail and preserved provider input in an accessible disclosure', () => {
    const html = renderToStaticMarkup(
      createElement(OpenCodeToolGroup, {
        transcriptPolicy: transcriptPresentation('code', 'opencode'),
        calls: [
          {
            toolUseId: 'edit1',
            name: 'Edit',
            input: { file_path: 'a.ts', old_string: 'before', new_string: 'after' },
            providerTool: {
              name: 'edit',
              input: { filePath: 'a.ts', oldString: 'before', newString: 'after' }
            }
          }
        ]
      })
    )
    const $ = load(html)
    expect($('[data-slot="collapsible-trigger"]').attr('aria-expanded')).toBe('true')
    expect($('details pre').text()).toContain('filePath')
    expect($('details pre').text()).toContain('oldString')
    expect($('[data-component="tool-trigger"]').text()).toContain('edit')
  })
})
