// 0230 VP-03 · VP-06 · VP-11 (R-03·R-06·R-07 ↔ AT-05·AT-08·AT-10·AT-11·AT-12 · §10 EP-05·EP-07)
//
// 목록 fold 가 셸 백그라운드 작업을 **영속 파트만으로** 세우는지 본다. 여기 입력은 전부
// 재로드 후에도 DB 에서 돌아오는 파트다 — 라이브 transient 메타를 쓰지 않으므로 이 스위트가
// 곧 AT-11(재로드 복원)의 관측이다.

import { describe, expect, it } from 'vitest'
import {
  isBackgroundTaskCall,
  resultMap,
  subagentTaskDescription,
  subagentTasksFromMessages
} from './parts'
import type { Message } from '../reducer/chatReducer'
import type { AppMessagePart } from '../../../../../shared/ipc'

const CMD = 'npx vitest run src/main'

function shellMessages(opts: {
  structuredOutput?: unknown
  stdout?: string
  notice?: Extract<AppMessagePart, { type: 'subagent_notice' }>
}): Message[] {
  const parts: AppMessagePart[] = [
    { type: 'tool_call', toolRunId: 'sh1', toolName: 'PowerShell', args: { command: CMD } },
    {
      type: 'tool_result',
      toolRunId: 'sh1',
      result: opts.stdout ?? 'RUN v4 …',
      isError: false,
      ...(opts.structuredOutput !== undefined ? { structuredOutput: opts.structuredOutput } : {})
    }
  ]
  if (opts.notice) parts.push(opts.notice)
  return [{ role: 'assistant', createdAt: 1_700_000_000_000, parts }]
}

const launched = { shellBackground: { taskId: 'bg-1' } }

describe('0230 AT-05/AT-10 — 목록 포함 술어', () => {
  it('AT-05: 백그라운드 셸 작업이 목록에 선다', () => {
    const tasks = subagentTasksFromMessages(shellMessages({ structuredOutput: launched }))
    expect(tasks).toHaveLength(1)
    expect(tasks[0].kind).toBe('shell')
    expect(tasks[0].description).toBe(CMD)
  })

  it('AT-10 음성: 영수증 없는 foreground 셸은 목록에 서지 않는다', () => {
    expect(subagentTasksFromMessages(shellMessages({}))).toHaveLength(0)
  })

  it('EP-05: 포함 술어가 이름이 아니라 영수증을 본다', () => {
    const withReceipt = shellMessages({ structuredOutput: launched })
    const withoutReceipt = shellMessages({})
    const call = (m: Message[]): Extract<AppMessagePart, { type: 'tool_call' }> =>
      m[0].parts[0] as Extract<AppMessagePart, { type: 'tool_call' }>
    // 조회는 지연 콜백이다(r2 · D2) — 통지 행마다 Map 을 새로 접지 않기 위해서다.
    const lookup = (m: Message[]) => {
      const byRun = resultMap(m[0].parts)
      return (id: string) => byRun.get(id)
    }
    expect(isBackgroundTaskCall(call(withReceipt), lookup(withReceipt))).toBe(true)
    expect(isBackgroundTaskCall(call(withoutReceipt), lookup(withoutReceipt))).toBe(false)
  })

  it('회귀: 에이전트 작업은 영수증과 무관하게 종전대로 선다', () => {
    const messages: Message[] = [
      {
        role: 'assistant',
        createdAt: 1_700_000_000_000,
        parts: [
          { type: 'tool_call', toolRunId: 'ag1', toolName: 'Task', args: { description: '조사' } }
        ]
      }
    ]
    const tasks = subagentTasksFromMessages(messages)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].kind).toBe('agent')
    expect(tasks[0].status).toBe('running')
  })
})

describe('0230 AT-08/AT-11 — 상태와 출력이 정착을 견딘다', () => {
  it('AT-08: 정착 통지가 와도 셸 결과의 stdout 이 남는다', () => {
    const tasks = subagentTasksFromMessages(
      shellMessages({
        structuredOutput: launched,
        stdout: 'Tests 402 passed',
        notice: { type: 'subagent_notice', toolRunId: 'sh1', status: 'completed' }
      })
    )
    expect(tasks[0].call.result?.output).toBe('Tests 402 passed')
  })

  it('통지 전에는 실행 중이다', () => {
    const tasks = subagentTasksFromMessages(shellMessages({ structuredOutput: launched }))
    expect(tasks[0].status).toBe('running')
  })

  it('AT-11: 통지 파트만으로 종단 상태가 복원된다', () => {
    const cases = [
      ['completed', 'completed'],
      ['failed', 'failed'],
      ['stopped', 'aborted']
    ] as const
    for (const [noticeStatus, expected] of cases) {
      const tasks = subagentTasksFromMessages(
        shellMessages({
          structuredOutput: launched,
          notice: { type: 'subagent_notice', toolRunId: 'sh1', status: noticeStatus }
        })
      )
      expect(tasks[0].status).toBe(expected)
    }
  })

  it('실패 사유는 통지의 summary 에서, 성공 요약은 사유 자리에 쓰지 않는다', () => {
    const failed = subagentTasksFromMessages(
      shellMessages({
        structuredOutput: launched,
        notice: {
          type: 'subagent_notice',
          toolRunId: 'sh1',
          status: 'failed',
          summary: '종료 코드 1'
        }
      })
    )
    expect(failed[0].settlementMessage).toBe('종료 코드 1')
    const done = subagentTasksFromMessages(
      shellMessages({
        structuredOutput: launched,
        notice: {
          type: 'subagent_notice',
          toolRunId: 'sh1',
          status: 'completed',
          summary: '402 passed'
        }
      })
    )
    expect(done[0].settlementMessage).toBeNull()
  })

  it('투영이 카드까지 실려 온다 — timedOutAfterMs 보존', () => {
    const tasks = subagentTasksFromMessages(
      shellMessages({
        structuredOutput: { shellBackground: { taskId: 'bg-1', timedOutAfterMs: 120_000 } }
      })
    )
    expect(tasks[0].shellBackground).toEqual({ taskId: 'bg-1', timedOutAfterMs: 120_000 })
  })

  it('셸은 이미 백그라운드라 전환 버튼 조건이 서지 않는다', () => {
    const tasks = subagentTasksFromMessages(shellMessages({ structuredOutput: launched }))
    expect(tasks[0].asyncLaunched).toBe(true)
  })
})

describe('0230 AT-12 — 통지 행 제목 조인', () => {
  it('AT-12: 셸 작업의 설명이 toolRunId 로 조인된다', () => {
    const messages = shellMessages({
      structuredOutput: launched,
      notice: { type: 'subagent_notice', toolRunId: 'sh1', status: 'completed' }
    })
    expect(subagentTaskDescription(messages, 'sh1')).toBe(CMD)
  })

  it('EP-07 음성: 영수증 없는 셸은 조인되지 않는다 — 목록 술어와 같은 답이다', () => {
    expect(subagentTaskDescription(shellMessages({}), 'sh1')).toBeUndefined()
  })

  it('회귀: 에이전트 통지 행의 제목 조인은 종전대로 동작한다', () => {
    const messages: Message[] = [
      {
        role: 'assistant',
        createdAt: 1_700_000_000_000,
        parts: [
          { type: 'tool_call', toolRunId: 'ag1', toolName: 'Task', args: { description: '조사' } },
          { type: 'subagent_notice', toolRunId: 'ag1', status: 'completed' }
        ]
      }
    ]
    expect(subagentTaskDescription(messages, 'ag1')).toBe('조사')
  })
})
