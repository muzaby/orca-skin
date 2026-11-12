// 0316 T-08a — AgentDetail 은 child 대화를 렌더마다 다시 만들지 않는다(0314 D-021 이월분).
// 실제 export 를 그대로 통과시키는 spy 로 반환 객체를 비교한다 — 같은 메시지 배열이면 같은 객체,
// 새 배열이면 새 객체다. 캐시를 우회하거나 화면이 export 를 거치지 않으면 갈린다.
import { afterEach, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as parts from '../../../lib/parts'
import { AgentDetail } from './AgentViews'
import { sessionPanelModel } from './model'
import type { Message } from '../../../reducer/chatReducer'

afterEach(() => vi.restoreAllMocks())

const transcript = (): Message[] => [
  {
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

it('AgentDetail 은 같은 메시지로 다시 그려도 child 대화를 다시 만들지 않는다', () => {
  const derive = vi.spyOn(parts, 'childMessageForParentToolRunId')
  const messages = transcript()
  const agent = sessionPanelModel(messages).agents[0]
  const render = (list: Message[]): string =>
    renderToStaticMarkup(createElement(AgentDetail, { agent, messages: list }))
  expect(render(messages)).toContain('Child answer')
  render(messages)
  expect(derive).toHaveBeenCalledTimes(2)
  const [first, second] = derive.mock.results.map((result) => result.value)
  expect(first).not.toBeNull()
  expect(second).toBe(first)
  render(transcript())
  expect(derive.mock.results[2].value).not.toBe(first)
})
