// 0326 EP-14 — AgentDetail 은 useTranscriptView('childMessage', toolUseId) 로 증분 색인에서 child 대화를 읽는다.
import { afterEach, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { sessionPanelModel } from '../../../lib/transcriptIndex.legacy.testfixture'
import { useChatStore } from '../../../store/chatStore'
import { AgentDetail } from './AgentViews'
import type { Message } from '../../../reducer/chatReducer'

afterEach(() => vi.restoreAllMocks())

const transcript = (): Message[] => [
  {
    id: 'm-15',
    role: 'assistant',
    createdAt: 1,
    parts: [
      {
        type: 'tool_call',
        toolRunId: 'task',
        toolName: 'Task',
        args: { description: 'Inspect', prompt: 'Inspect sample.md' }
      },
      { type: 'text', text: 'Child answer', parentToolRunId: 'task' }
    ]
  }
]

it('AgentDetail 은 useTranscriptView 증분 색인에서 child 대화를 읽는다', () => {
  const initial = useChatStore.getInitialState()
  const entry = initial.sessions[initial.activeKey]
  const previous = entry.session
  try {
    const messages = transcript()
    entry.session = { ...previous, sessionId: 'agent-cache', messages }
    const agent = sessionPanelModel(messages).agents[0]
    const html = renderToStaticMarkup(createElement(AgentDetail, { agent }))
    expect(html).toContain('Child answer')
  } finally {
    entry.session = previous
  }
})
