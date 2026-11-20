import { createElement } from 'react'
import { renderWithTranscript as renderToStaticMarkup } from '../../harnesses/registries/transcript.testfixture'
import { load } from 'cheerio'
import { describe, expect, it, vi } from 'vitest'
import { TranscriptView } from './TranscriptView'
import {
  TimelineDisclosureContext,
  TimelineViewState
} from '../../harnesses/opencode/transcript/viewState'
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

// SSR에도 실제 virtualizer가 이전 교환을 그릴 수 있게 viewport 측정값만 제공한다.
// TranscriptView, Exchange, UserTurn, UserMessage, UserBubbleText는 실제 구현을 실행한다.
vi.mock('@tanstack/react-virtual', async (original) => {
  const module = await original<typeof import('@tanstack/react-virtual')>()
  return {
    ...module,
    useVirtualizer: (options: Parameters<typeof module.useVirtualizer>[0]) =>
      module.useVirtualizer({ ...options, initialRect: { width: 1200, height: 900 } })
  }
})

const userMessage: Message = {
  id: 'm-42',
  role: 'user',
  createdAt: 1,
  parts: [{ type: 'text', text: 'Prompt' }]
}
const assistantMessage: Message = {
  id: 'm-47',
  role: 'assistant',
  createdAt: 2,
  parts: [{ type: 'text', text: 'Answer' }]
}

describe('OpenCode transcript presentation', () => {
  it.each([
    { backend: 'claude', agentKind: 'code' },
    { backend: 'claude', agentKind: 'work' },
    { backend: 'opencode', agentKind: 'code' }
  ] as const)(
    'marks both rendered messages inside one grouped user row ($backend/$agentKind)',
    ({ backend, agentKind }) => {
      const messages: Message[] = [
        { ...userMessage, id: 'u:first', parts: [{ type: 'text', text: 'First question' }] },
        { ...userMessage, id: 'u:next', parts: [{ type: 'text', text: 'Follow-up question' }] },
        assistantMessage
      ]
      installChatStoreHarness({ backend, agentKind, messages })
      const $ = load(
        renderToStaticMarkup(
          createElement(TranscriptView, {
            backend,
            agentKind,
            messages,
            pendingSteer: [],
            inflight: false,
            loadingSession: false,
            anchored: false,
            scrollRef: { current: null },
            contentRef: { current: null },
            onScroll: () => {}
          })
        )
      )

      const first = $('[data-part-key="u:first:user"]')
      const next = $('[data-part-key="u:next:user"]')
      expect(first).toHaveLength(1)
      expect(next).toHaveLength(1)
      expect(first.text()).toBe('First question')
      expect(next.text()).toBe('Follow-up question')
      expect(first.closest('[data-index]')[0]).toBe(next.closest('[data-index]')[0])
    }
  )

  it.each([
    { backend: 'claude', agentKind: 'code' },
    { backend: 'claude', agentKind: 'work' },
    { backend: 'opencode', agentKind: 'code' }
  ] as const)(
    'preserves bubble colors and the harness viewport background in earlier and last exchanges ($backend/$agentKind)',
    ({ backend, agentKind }) => {
      const messages: Message[] = [
        {
          id: 'm-62',
          role: 'user',
          createdAt: 1,
          parts: [{ type: 'text', text: 'Earlier prompt' }]
        },
        {
          id: 'm-63',
          role: 'assistant',
          createdAt: 2,
          parts: [{ type: 'text', text: 'Earlier answer' }]
        },
        { id: 'm-64', role: 'user', createdAt: 3, parts: [{ type: 'text', text: 'Last prompt' }] },
        {
          id: 'm-65',
          role: 'assistant',
          createdAt: 4,
          parts: [{ type: 'text', text: 'Last answer' }]
        }
      ]
      installChatStoreHarness({ backend, agentKind, messages })
      const $ = load(
        renderToStaticMarkup(
          createElement(TranscriptView, {
            backend,
            agentKind,
            messages,
            pendingSteer: [],
            inflight: false,
            loadingSession: false,
            anchored: false,
            scrollRef: { current: null },
            contentRef: { current: null },
            onScroll: () => {}
          })
        )
      )
      const exchanges = $(
        backend === 'opencode' ? '[data-timeline-row="user"]' : '[data-index]:has(.bg-bubble-user)'
      )
      expect($('[data-transcript-viewport]')).toHaveLength(1)
      expect(exchanges).toHaveLength(2)
      for (const [index, prompt] of ['Earlier prompt', 'Last prompt'].entries()) {
        const bubble = exchanges.eq(index).find('.bg-bubble-user')
        expect(bubble).toHaveLength(1)
        expect(bubble.text()).toBe(prompt)
        expect(bubble.hasClass('text-ink')).toBe(true)
        expect(bubble.hasClass('bg-oc-bubble')).toBe(false)
        expect(bubble.hasClass('text-oc-bubble-ink')).toBe(false)
        expect(bubble.hasClass('rounded-[10px]')).toBe(backend === 'opencode')
        expect(bubble.hasClass('max-w-[min(82%,64ch)]')).toBe(backend === 'opencode')
        expect(bubble.hasClass('rounded-r6')).toBe(backend === 'claude')
        expect(bubble.hasClass('px-[12px]')).toBe(backend === 'opencode')
        expect(bubble.hasClass('text-body')).toBe(true)
      }
      expect(
        $(
          backend === 'opencode'
            ? '[data-index="0"] [data-timeline-row="user"]'
            : '[data-index="0"]'
        ).text()
      ).toContain('Earlier prompt')
      expect($('[data-timeline-scroll]')).toHaveLength(backend === 'opencode' ? 1 : 0)
      expect($('[data-harness]').hasClass('bg-bg')).toBe(backend === 'opencode')
    }
  )
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
        if (backend === 'opencode') expect($('[aria-live="polite"]').text()).toContain('생각 중')
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
          {
            id: 'm-168',
            role: 'user',
            createdAt: 1,
            parts: [{ type: 'text', text: 'User prompt' }]
          },
          {
            id: 'm-169',
            role: 'assistant',
            createdAt: 2,
            parts: [{ type: 'text', text: 'Answer body' }]
          }
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
    expect(load(html)(`[data-harness="${backend}"]`).hasClass('bg-bg')).toBe(backend === 'opencode')
  })
  it('shows normalized edit detail and preserved provider input in an opened disclosure', () => {
    const disclosure = new TimelineViewState()
    disclosure.disclosures.set('tool:edit1', true)
    const html = renderToStaticMarkup(
      createElement(
        TimelineDisclosureContext.Provider,
        { value: disclosure },
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
    )
    const $ = load(html)
    expect($('[data-slot="collapsible-trigger"]').attr('aria-expanded')).toBe('true')
    expect($('details pre').text()).toContain('filePath')
    expect($('details pre').text()).toContain('oldString')
    expect($('[data-component="tool-trigger"]').text()).toContain('편집')
    expect($('[data-component="tool-trigger"] [title="edit"]')).toHaveLength(1)
  })
})
