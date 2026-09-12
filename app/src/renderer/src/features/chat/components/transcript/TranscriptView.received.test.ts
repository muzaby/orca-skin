import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { TranscriptView } from './TranscriptView'
import { chatReducer, initialChatState, type Message } from '../../reducer/chatReducer'
import { ingestChatEvent } from '../../store/chatStore'
import { harnessSession, installChatStoreHarness } from '../../store/chatStore.testHarness'
import type { AgentKind } from '../../../../../../shared/agent-kind'

vi.mock('../../hooks/useTranscriptVirtualizer', () => ({
  useTranscriptVirtualizer: () => ({
    getVirtualItems: () => [{ index: 0, start: 0 }],
    getTotalSize: () => 100,
    measureElement: vi.fn()
  })
}))
vi.mock('./MessageMeta', () => ({
  MessageMeta: ({ align, createdAt }: { align: string; createdAt: number }) =>
    createElement('span', { 'data-meta-align': align, 'data-meta-time': createdAt })
}))
vi.mock('../../../../shared/ui/markdown/Markdown', () => ({
  Markdown: ({ source }: { source: string }) => createElement('p', null, source)
}))

function render(agentKind: AgentKind, messages: Message[]): string {
  return renderToStaticMarkup(
    createElement(TranscriptView, {
      agentKind,
      messages,
      pendingSteer: [],
      inflight: false,
      loadingSession: false,
      anchored: false,
      scrollRef: { current: null },
      contentRef: { current: null },
      onScroll: vi.fn()
    })
  )
}

describe.each(['work', 'code'] as const)('%s received input visibility', (agentKind) => {
  it('keeps automatic data in live/reloaded state while excluding its bubble and metadata', () => {
    installChatStoreHarness({ agentKind })
    const automatic = '<task-notification>자동 수신 비공개 본문</task-notification>'
    const human = '<task-notification>직접 입력 보존</task-notification>'
    ingestChatEvent({
      type: 'message.committed',
      sessionId: 's',
      ids: ['auto'],
      messageId: 1,
      createdAt: 11,
      text: automatic,
      origin: { kind: 'task' }
    })
    ingestChatEvent({
      type: 'message.committed',
      sessionId: 's',
      ids: ['human'],
      messageId: 2,
      createdAt: 22,
      text: human
    })
    ingestChatEvent({
      type: 'message.completed',
      sessionId: 's',
      message: { text: '정상 어시스턴트 결과' }
    })
    const live = harnessSession()
    expect(live.messages[0].parts).toEqual([
      { type: 'text', text: automatic, origin: { kind: 'task' } }
    ])
    const loaded = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        id: 's',
        backend: 'claude',
        agentKind,
        title: null,
        messages: live.messages.map((message, id) => ({ ...message, id }))
      }
    })
    expect(loaded.messages[0].parts).toEqual(live.messages[0].parts)
    for (const messages of [live.messages, loaded.messages]) {
      const html = render(agentKind, messages)
      expect(html).not.toContain('자동 수신 비공개 본문')
      expect(html).not.toContain('data-message-origin')
      expect(html).not.toContain('data-meta-time="11"')
      expect(html).toContain('&lt;task-notification&gt;직접 입력 보존&lt;/task-notification&gt;')
      expect(html).toContain('정상 어시스턴트 결과')
      expect(html.match(/data-meta-align="right"/g)).toHaveLength(1)
      expect(html.match(/data-app-exchange/g)).toHaveLength(1)
    }
  })

  it('renders an empty transcript without an exchange when only automatic input is stored', () => {
    const html = render(agentKind, [
      {
        role: 'user',
        createdAt: 11,
        parts: [{ type: 'text', text: '자동', origin: { kind: 'automatic' } }]
      }
    ])
    expect(html).not.toContain('data-app-exchange')
    expect(html).not.toContain('data-meta-align')
    expect(html).toContain('메시지')
  })
})
