// 0313 VP-04 — 에이전트 행은 모델·도구 수·현재 도구를 세션 메시지의 요약에서 읽는다.
// `call` prop 만으로는 얻을 수 없는 값(결과 메타의 모델, child 도구)으로 요약 배선을 본다 —
// 요약 조회를 지우면 모델이 폴백 라벨로, 도구 수가 0 으로 떨어진다.
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AgentTaskRow } from './AgentTaskRow'
import { agentUiPolicy } from '../../../lib/agentPresentation'
import { partsToolCalls } from '../../../lib/parts'
import { useChatStore } from '../../../store/chatStore'
import type { ChatState, Message } from '../../../reducer/chatReducer'

const activeSession = (): ChatState => {
  const init = useChatStore.getInitialState()
  return init.sessions[init.activeKey]!.session
}
const pristine = activeSession().messages
afterEach(() => {
  activeSession().messages = pristine
})

const policy = agentUiPolicy('code').transcript

// 메시지를 심고 `toolRunId` 행을 그린다 — `call` 은 transcript 가 넘기는 것과 같은 파생이다.
function renderRow(messages: Message[], toolRunId: string): string {
  activeSession().messages = messages
  const call = partsToolCalls(messages.flatMap((message) => message.parts)).find(
    (item) => item.toolUseId === toolRunId
  )!
  return renderToStaticMarkup(createElement(AgentTaskRow, { call, transcriptPolicy: policy }))
}

const finished = (toolRunId: string, description: string, model: string): Message => ({
  role: 'assistant',
  createdAt: 1,
  parts: [
    { type: 'tool_call', toolRunId, toolName: 'Agent', args: { description } },
    {
      type: 'tool_result',
      toolRunId,
      result: { summary: 'done' },
      isError: false,
      subagentMeta: { model, durationMs: 92_000, toolUses: 3 }
    }
  ]
})

describe('0313 — 에이전트 행이 세션 요약을 읽는다', () => {
  it('완료 행은 자기 호출의 요약에서 모델을 읽는다 — 형제 호출의 모델이 섞이지 않는다', () => {
    const messages = [
      finished('agent-haiku', '로그 조사', 'claude-haiku-4-5'),
      finished('agent-opus', '설계 검토', 'claude-opus-4-5')
    ]
    const haiku = renderRow(messages, 'agent-haiku')
    expect(haiku).toContain('Haiku 4.5 로그 조사')
    expect(haiku).not.toContain('Opus')
    const opus = renderRow(messages, 'agent-opus')
    expect(opus).toContain('Opus 4.5 설계 검토')
    expect(opus).not.toContain('Haiku')
  })

  it('진행 중 단일 행은 요약의 현재 child 도구와 도구 수를 보인다', () => {
    const html = renderRow(
      [
        {
          role: 'assistant',
          createdAt: 1,
          parts: [
            {
              type: 'tool_call',
              toolRunId: 'agent-running',
              toolName: 'Agent',
              args: { description: '실행 중 작업' }
            },
            {
              type: 'tool_call',
              toolRunId: 'child-read',
              toolName: 'Read',
              args: {},
              parentToolRunId: 'agent-running'
            },
            {
              type: 'tool_result',
              toolRunId: 'child-read',
              result: 'ok',
              isError: false,
              parentToolRunId: 'agent-running'
            },
            {
              type: 'tool_call',
              toolRunId: 'child-bash',
              toolName: 'Bash',
              args: {},
              parentToolRunId: 'agent-running'
            }
          ]
        }
      ],
      'agent-running'
    )
    expect(html).toContain(' · Bash · 2')
  })
})
