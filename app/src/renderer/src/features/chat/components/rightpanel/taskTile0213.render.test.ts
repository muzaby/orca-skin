// 0213 — `작업` 타일 표시 계약 (AT-11~15 · §10 EP-04 · EP-05).
//
// 두 구멍을 닫는다. ① 할 일의 `blockedBy` 가 상세를 열어야만 보였다 — 목록에서 막힌 항목과
// 그냥 대기 중인 항목이 구분되지 않는다(D-005·D-006). ② 기능 부재 안내가 `items.length === 0`
// 이라 서브에이전트가 돌고 있으면 침묵했다 — `items` 는 할 일 + 서브에이전트 합집합이다(D-007).
//
// `TaskProgressList` 는 props-only View 라 store 없이 `react-dom/server` 로 돈다(0203 선례).
// 껍데기 부재(AC8·AC9)는 형제 파일 `rightPanelTiles.render.test.ts` 가 래퍼를 직접 렌더해
// 양성 짝과 함께 관측한다 — 여기서 다시 단언하지 않는다.

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TaskProgressList } from './TaskTileContent'
import { taskBoardFromMessages, taskBoardOrdered } from '../../lib/taskBoard'
import type { Message } from '../../reducer/chatReducer'
import type { AppMessagePart } from '../../../../../../shared/ipc'

let runSeq = 0
const nextRun = (): string => `run${(runSeq += 1)}`

// 할 일 한 건 — 생성 후 (선택) 상태 전환 · 의존 가산. `blockedBy` 는 `updatedFields` 게이트를
//지나야 patch 에 실린다(`shared/task-tool.ts`).
function agentTask(
  subject: string,
  id: string,
  opts: { status?: 'in_progress' | 'completed'; blockedBy?: string[] } = {}
): AppMessagePart[] {
  const createRun = nextRun()
  const parts: AppMessagePart[] = [
    { type: 'tool_call', toolRunId: createRun, toolName: 'TaskCreate', args: { subject } },
    {
      type: 'tool_result',
      toolRunId: createRun,
      result: 'wire',
      isError: false,
      structuredOutput: { task: { id, subject } }
    }
  ]
  if (opts.status || opts.blockedBy) {
    const updateRun = nextRun()
    const updatedFields: string[] = []
    if (opts.status) updatedFields.push('status')
    if (opts.blockedBy) updatedFields.push('addBlockedBy')
    parts.push(
      {
        type: 'tool_call',
        toolRunId: updateRun,
        toolName: 'TaskUpdate',
        args: {
          taskId: id,
          ...(opts.status ? { status: opts.status } : {}),
          ...(opts.blockedBy ? { addBlockedBy: opts.blockedBy } : {})
        }
      },
      {
        type: 'tool_result',
        toolRunId: updateRun,
        result: 'wire',
        isError: false,
        structuredOutput: {
          success: true,
          taskId: id,
          updatedFields,
          ...(opts.status ? { statusChange: { from: 'pending', to: opts.status } } : {})
        }
      }
    )
  }
  return parts
}

// 서브에이전트 한 건 — 결과 미도착(진행 중)이라 메타 줄에 경과·도구수가 실린다.
const backgroundTask = (toolRunId: string, description: string): AppMessagePart[] => [
  { type: 'tool_call', toolRunId, toolName: 'Task', args: { description, prompt: 'p' } }
]

const messages = (...groups: AppMessagePart[][]): Message[] => [
  { role: 'assistant', createdAt: 1_700_000_000_000, parts: groups.flat() }
]

const renderProgress = (
  msgs: Message[],
  opts: { agentTools?: string[] | null; cliVersion?: string | null } = {}
): string =>
  renderToStaticMarkup(
    createElement(TaskProgressList, {
      items: taskBoardOrdered(
        taskBoardFromMessages(msgs, {
          stoppingBackgroundIds: new Set<string>(),
          pausedBackgroundIds: new Set<string>(),
          backgroundedIds: new Set<string>()
        })
      ),
      agentTools: opts.agentTools ?? null,
      cliVersion: opts.cliVersion ?? null
    })
  )

const BLOCKED = '#2 완료 필요'
const NOTICE = '연결된 Claude Code 가 할 일 목록 도구를 지원하지 않습니다.'
const EMPTY = 'Claude 가 Task 를 만들거나 백그라운드 작업을 시작하면 여기에 표시됩니다.'

// ── R-03 막힘 표시 ────────────────────────────────────────────────────────────

describe('0213 R-03 — 할 일 행의 막힘 표시 (AT-11·12·13 · §10 EP-04)', () => {
  it('AT-11·AT-12 — 막힌 행만 문구를 낸다. 같은 목록의 다른 행에는 없다', () => {
    const html = renderProgress(
      messages(
        agentTask('선행 작업', '2'),
        agentTask('막힌 작업', '3', { blockedBy: ['2'] }),
        agentTask('그냥 대기', '4')
      )
    )
    // 양성 — 막힌 행에 문구가 있다. 상세와 같은 키(`blockedByValue`)로 조립된다.
    expect(html).toContain(BLOCKED)
    // 세 행이 모두 살아 있다(음성 단언이 빈 출력으로 자동 통과하지 않는다).
    expect(html).toContain('선행 작업')
    expect(html).toContain('막힌 작업')
    expect(html).toContain('그냥 대기')
    // 음성 — 문구는 **한 번만** 난다. 세 행 전부에 붙는 회귀를 막는다.
    expect(html.match(/#2 완료 필요/g)).toHaveLength(1)
  })

  it('AT-13 — `completed` 행은 같은 의존을 갖고도 문구를 내지 않는다 (D-006)', () => {
    const html = renderProgress(
      messages(
        agentTask('선행 작업', '2'),
        agentTask('끝난 작업', '3', {
          blockedBy: ['2'],
          status: 'completed'
        })
      )
    )
    // 양성 짝 — 행 자체는 있다. 사라진 것은 둘째 줄뿐이다.
    expect(html).toContain('끝난 작업')
    expect(html).toContain('line-through')
    expect(html).not.toContain(BLOCKED)
  })

  it('AT-14 — background 행은 자기 메타 줄을 그대로 낸다 — 형제 슬롯이 맞바뀌지 않는다', () => {
    const html = renderProgress(
      messages(
        agentTask('선행 작업', '2'),
        agentTask('막힌 작업', '3', { blockedBy: ['2'] }),
        backgroundTask('bg1', '로그 파서 조사')
      )
    )
    // 두 분기가 **같은 둘째 줄 슬롯**을 쓴다. 존재만 보면 맞바꿈이 침묵하므로 각각 자기
    // 문구를 내는지 본다 — 맞바꾸면 background 행이 의존을, 할 일 행이 메타를 말한다.
    expect(html).toContain('로그 파서 조사')
    expect(html).toContain('background')
    expect(html).toContain(BLOCKED)
    // 막힘 문구는 할 일 행 쪽에만 있다 — background 항목은 `blockedBy` 가 항상 비어 있다.
    expect(html.match(/#2 완료 필요/g)).toHaveLength(1)
  })
})

// ── R-04 안내 조건 ────────────────────────────────────────────────────────────

describe('0213 R-04 — 기능 부재 안내의 분모 (AT-15~18 · §10 EP-05)', () => {
  it('AT-15 — 할 일 0 · 서브에이전트 진행 중이면 안내와 목록이 **함께** 선다', () => {
    const html = renderProgress(messages(backgroundTask('bg1', '로그 파서 조사')), {
      agentTools: ['Bash', 'Read'],
      cliVersion: '2.1.100'
    })
    // 안내가 침묵하지 않는다 — `items.length === 0` 으로 세면 여기서 사라진다.
    expect(html).toContain(NOTICE)
    expect(html).toContain('2.1.100')
    // 그리고 목록을 **대체하지 않는다** — 돌고 있는 행이 그대로 보인다.
    expect(html).toContain('로그 파서 조사')
    // 안내가 떴으므로 기본 빈 문구로 되돌아가지 않는다.
    expect(html).not.toContain(EMPTY)
  })

  it('AT-16 — 할 일이 있으면 안내가 없다 — 기능이 있다는 뜻이다', () => {
    const html = renderProgress(
      messages(agentTask('설계', '1'), backgroundTask('bg1', '로그 파서 조사')),
      { agentTools: ['Bash'], cliVersion: '2.1.100' }
    )
    expect(html).not.toContain(NOTICE)
    expect(html).toContain('설계')
    expect(html).toContain('로그 파서 조사')
  })

  it('AT-17 — 판정 불가(null)면 서브에이전트가 돌아도 안내하지 않는다 (0212 D-005)', () => {
    const html = renderProgress(messages(backgroundTask('bg1', '로그 파서 조사')), {
      agentTools: null,
      cliVersion: '2.1.100'
    })
    expect(html).not.toContain(NOTICE)
    expect(html).toContain('로그 파서 조사')
  })

  it('AT-18 — 전부 비고 기능이 있으면 기존 빈 문구다 — 안내와 서로의 음성 짝이다', () => {
    const html = renderProgress(messages(), { agentTools: ['TaskCreate'], cliVersion: '2.1.100' })
    expect(html).toContain(EMPTY)
    expect(html).not.toContain(NOTICE)
  })
})
