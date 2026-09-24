import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { describe, expect, it } from 'vitest'
import { chatReducer, initialChatState, type ToolCall } from '../../reducer/chatReducer'
import type { LoadedSession } from '../../../../../../shared/ipc'
import { ToolCard } from './ToolCard'
import { ToolGroup } from './ToolGroup'
import { AgentTaskRow } from './AgentTaskRow'
import { WorkToolRow } from './WorkToolTimeline'
import { WorkToolBody } from './WorkToolBody'
import { TaskToolBody } from './tool-bodies/TaskToolBody'
import { SubAgentTaskList } from '../rightpanel/SubAgentTileContent'
import { TaskStatusIcon } from '../rightpanel/TaskStatusIcon'
import { TaskProgressList } from '../rightpanel/TaskProgressList'
import { agentUiPolicy } from '../../lib/agentPresentation'
import { backgroundBoardStatus } from '../../lib/taskBoard'
import { partsToolCalls, subagentTasksFromMessages } from '../../lib/parts'
import { workToolPresentation } from '../../lib/workToolPresentation'
import { toolGroupSegments } from '../../lib/toolMeta'

const policy = agentUiPolicy('code').transcript
const inputs = [
  ['user-rejected', 'rejected', '거부됨'],
  ['cancelled', 'cancelled', '취소됨'],
  ['unknown', 'not_executed', '실행되지 않음'],
  ['interrupted', 'aborted', '중단됨']
] as const
describe('0239 result status surfaces', () => {
  it.each(['no_result', 'retracted'] as const)(
    'renders host %s neutrally before and after reload',
    (kind) => {
      let live = chatReducer(initialChatState, { type: 'BEGIN_TURN' })
      live = chatReducer(live, {
        type: 'RECV_EVENT',
        event: {
          type: 'tool.call.started',
          sessionId: 's',
          toolRunId: 't',
          toolName: 'Read',
          args: {}
        }
      })
      live = chatReducer(live, {
        type: 'RECV_EVENT',
        event: {
          type: 'tool.call.completed',
          sessionId: 's',
          toolRunId: 't',
          result: { reason: 'not_executed' },
          isError: true,
          nonExecution: { source: 'host', kind }
        }
      })
      const reload = chatReducer(initialChatState, {
        type: 'LOAD_SESSION',
        session: { id: 's', messages: live.messages } as LoadedSession
      })
      for (const state of [live, reload]) {
        const call = partsToolCalls(state.messages.flatMap((message) => message.parts))[0]
        const html = renderToStaticMarkup(
          createElement(ToolCard, { call, transcriptPolicy: policy })
        )
        expect(html).toContain('실행되지 않음')
        expect(html).not.toContain('text-bad')
        expect(html).not.toContain('sr-only')
        expect(html).not.toContain('animate-spin')
      }
    }
  )
  it.each(inputs)(
    'shows SDK %s neutrally on Code, Work and task surfaces',
    (kind, status, label) => {
      const call: ToolCall = {
        toolUseId: 't',
        name: 'Read',
        input: {},
        result: { output: 'receipt', isError: true, nonExecution: { source: 'sdk', kind } }
      }
      const agent = { ...call, name: 'Agent' }
      const task = { ...call, name: 'TaskUpdate', input: { taskId: '1', status: 'completed' } }
      const render = (element: ReturnType<typeof createElement>): string =>
        renderToStaticMarkup(element)
      const row = render(createElement(ToolCard, { call, transcriptPolicy: policy }))
      expect(row).toContain(label)
      expect(row).not.toContain('sr-only')
      expect(row).not.toContain('text-bad')
      const detail = render(
        createElement(ToolCard, { call, transcriptPolicy: policy, presentation: 'detail-body' })
      )
      expect(detail).not.toContain('text-bad')
      const agentRow = render(
        createElement(AgentTaskRow, { call: agent, transcriptPolicy: policy })
      )
      expect(agentRow).toContain(label)
      expect(agentRow).not.toContain('text-bad')
      expect(workToolPresentation(call).status).toBe(status)
      const work = render(createElement(WorkToolRow, { call }))
      expect(work).toContain(label)
      expect(work).not.toContain('text-bad')
      expect(render(createElement(WorkToolBody, { call: task }))).not.toContain('text-bad')
      const taskHtml = render(createElement(TaskToolBody, { call: task }))
      expect(taskHtml).toContain(label)
      expect(taskHtml).not.toContain('실패')
      expect(toolGroupSegments([call, call])[0].hasError).toBe(false)
      expect(
        render(
          createElement(ToolGroup, {
            calls: [call, { ...call, toolUseId: 'second' }],
            transcriptPolicy: policy
          })
        )
      ).not.toContain('text-bad')
      const summaries = subagentTasksFromMessages([
        {
          role: 'assistant',
          createdAt: 1,
          parts: [
            { type: 'tool_call', toolRunId: 't', toolName: 'Agent', args: {} },
            {
              type: 'tool_result',
              toolRunId: 't',
              result: 'receipt',
              isError: true,
              nonExecution: { source: 'sdk', kind }
            }
          ]
        }
      ])
      const list = render(
        createElement(SubAgentTaskList, {
          tasks: summaries,
          stoppingIds: new Set<string>(),
          stopErrors: {}
        })
      )
      expect(list).toContain(label)
      expect(list).not.toContain('text-bad')
      const boardStatus = backgroundBoardStatus(status, 't', new Set())
      expect(boardStatus).toBe(status)
      const icon = render(createElement(TaskStatusIcon, { status: boardStatus, position: 1 }))
      expect(icon).not.toContain('text-bad')
      expect(icon).not.toContain('animate-spin')
      const progress = load(
        render(
          createElement(TaskProgressList, {
            items: [
              {
                key: 'agent:1',
                id: '1',
                title: 'task',
                subject: 'task',
                description: null,
                status: boardStatus,
                blockedBy: []
              }
            ]
          })
        )
      )
      expect(progress('[data-status]').attr('data-status')).toBe(status)
      expect(progress.html()).toContain(label)
    }
  )
  it('retains red failure styling and summaries for actual errors', () => {
    const call: ToolCall = {
      toolUseId: 't',
      name: 'Read',
      input: {},
      result: { output: 'failed', isError: true }
    }
    expect(
      renderToStaticMarkup(createElement(ToolCard, { call, transcriptPolicy: policy }))
    ).toContain('text-bad')
    expect(renderToStaticMarkup(createElement(WorkToolRow, { call }))).toContain('text-bad')
    expect(toolGroupSegments([call])[0].hasError).toBe(true)
  })
})
