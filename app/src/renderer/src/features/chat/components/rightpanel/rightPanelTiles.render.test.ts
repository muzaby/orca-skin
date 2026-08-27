// 0204 ΔV1 — 두 타일이 서로 다른 책임을 갖는다(D-015·D-019)는 것을 렌더 출력으로 잠근다.
//
//   `백그라운드 작업`(subagent) = `72766d2` 복구 — 상태 그룹 · 3줄 카드 · 대화록 상세 (AT-28)
//   `작업`(task)               = cowork 3섹션 · id 순 · 취소선 · 제목 직후 중단 (AT-26·27·29)
//
// JSX 를 쓰지 않는 이유: vitest include 가 `src/**/*.test.ts` 라 `.tsx` 를 잡지 않는다.
// jsdom·testing-library 없이 react-dom/server 로 돈다(신규 의존성 0).
//
// **음성 단언에는 양성 짝을 둔다** — 아무것도 그리지 않는 출력에서 음성만 자동으로 참이 되는
// 것을 막는다(0203 ΔV2 에서 실제로 겪은 형태다).

import { beforeEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SubAgentTaskDetail, SubAgentTaskList } from './SubAgentTileContent'
import { TaskProgressList, TaskTileContent } from './TaskTileContent'
import { childMessageForParentToolRunId, subagentTasksFromMessages } from '../../lib/parts'
import {
  agentTaskKey,
  backgroundTaskKey,
  taskBoardFromMessages,
  taskBoardOrdered
} from '../../lib/taskBoard'
import type { Message } from '../../reducer/chatReducer'
import type { AppMessagePart } from '../../../../../../shared/ipc'

// 검증 대상은 **props 만 읽는 View** 다. store 연결 컴포넌트를 `renderToStaticMarkup` 으로
// 돌리면 zustand 가 SSR 스냅샷(`getInitialState()`)을 돌려주어 시드가 반영되지 않는다 —
// 0203 이 `PinnedSectionView` 로 잡은 것과 같은 seam 이다. `TaskTileContent`(store 연결)는
// 섹션 골격 자체가 store 와 무관하므로 AT-29 에서만 직접 렌더한다.

let runSeq = 0
const nextRun = (): string => `run${(runSeq += 1)}`

function agentTask(
  subject: string,
  id: string,
  status?: 'in_progress' | 'completed'
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
  if (status) {
    const updateRun = nextRun()
    parts.push(
      {
        type: 'tool_call',
        toolRunId: updateRun,
        toolName: 'TaskUpdate',
        args: { taskId: id, status }
      },
      {
        type: 'tool_result',
        toolRunId: updateRun,
        result: 'wire',
        isError: false,
        structuredOutput: {
          success: true,
          taskId: id,
          updatedFields: ['status'],
          statusChange: { from: 'pending', to: status }
        }
      }
    )
  }
  return parts
}

function backgroundTask(
  toolRunId: string,
  description: string,
  result?: { output: unknown; isError: boolean }
): AppMessagePart[] {
  const parts: AppMessagePart[] = [
    { type: 'tool_call', toolRunId, toolName: 'Task', args: { description, prompt: 'p' } }
  ]
  if (result) {
    parts.push({
      type: 'tool_result',
      toolRunId,
      result: result.output,
      isError: result.isError,
      subagentMeta: { durationMs: 134_000, toolUses: 24 }
    })
  }
  return parts
}

const messages = (...parts: AppMessagePart[][]): Message[] => [
  { role: 'assistant', createdAt: 1_700_000_000_000, parts: parts.flat() }
]

// 세션 parts → `진행 상황` 섹션 본문 HTML. 프로덕션과 같은 파생을 통과시킨다.
const renderProgress = (msgs: Message[], stoppingIds: string[] = []): string =>
  renderToStaticMarkup(
    createElement(TaskProgressList, {
      items: taskBoardOrdered(
        taskBoardFromMessages(msgs, { stoppingBackgroundIds: new Set(stoppingIds) })
      )
    })
  )

// 세션 parts → `백그라운드 작업` 목록 HTML.
const renderSubagentList = (msgs: Message[], stoppingIds: string[] = []): string =>
  renderToStaticMarkup(
    createElement(SubAgentTaskList, {
      tasks: subagentTasksFromMessages(msgs),
      stoppingIds: new Set(stoppingIds)
    })
  )

beforeEach(() => {
  runSeq = 0
})

describe('작업 타일 — cowork 3섹션 (AT-29)', () => {
  it('세 섹션 헤더를 모두 그리고, 출력·컨텍스트는 설명문만 낸다', () => {
    const html = renderToStaticMarkup(createElement(TaskTileContent))
    // 양성 — 세 헤더가 실제로 렌더된다.
    expect(html).toContain('진행 상황')
    expect(html).toContain('출력')
    expect(html).toContain('컨텍스트')
    expect(html).toContain('이 작업 중에 생성된 파일을 확인하고 열 수 있습니다.')
    expect(html).toContain('이 작업에 사용된 도구와 참조된 파일을 추적합니다.')
    // 섹션은 접힘 가능하다 — 기본 펼침.
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(3)
  })

  it('진행 상황 섹션에 상태 그룹 헤더가 없다 — 단일 목록이다', () => {
    const html = renderProgress(
      messages(
        agentTask('완료된 일', '1', 'completed'),
        agentTask('대기 중인 일', '2'),
        backgroundTask('bg1', '로그 파서 조사')
      )
    )
    // 양성 — 세 항목이 모두 한 목록에 있다(D-019: TaskXXX + background 함께).
    expect(html).toContain('완료된 일')
    expect(html).toContain('대기 중인 일')
    expect(html).toContain('로그 파서 조사')
    // 음성 — 그룹 헤더('대기 중'·'중단됨' 라벨)가 없다. '진행 상황' 섹션 제목과 구분된다.
    expect(html).not.toContain('대기 중<')
    expect(html).not.toContain('중단됨<')
  })
})

describe('작업 타일 — 완료 항목 취소선 (AT-26)', () => {
  it('완료 항목 제목에만 취소선이 걸린다', () => {
    const html = renderProgress(
      messages(
        agentTask('완료된 일', '1', 'completed'),
        agentTask('진행 중인 일', '2', 'in_progress')
      )
    )
    const doneSpan = html.match(/<span class="([^"]*)">완료된 일<\/span>/)
    const runningSpan = html.match(/<span class="([^"]*)">진행 중인 일<\/span>/)
    expect(doneSpan?.[1]).toContain('line-through')
    // 양방향 — 미완료에는 걸리지 않는다.
    expect(runningSpan?.[1]).not.toContain('line-through')
  })
})

describe('작업 타일 — 중단 버튼 자리 (AT-27 · D-020)', () => {
  it('중단 버튼이 제목 바로 뒤 형제이고 제목이 flex-1 을 갖지 않는다', () => {
    const html = renderProgress(messages(backgroundTask('bg1', '로그 파서 조사')))
    // 양성 — 버튼이 실제로 렌더된다.
    expect(html).toContain('aria-label="중단"')
    // 제목 span 바로 다음이 버튼이다 — 사이에 다른 엘리먼트가 없다.
    expect(html).toMatch(/로그 파서 조사<\/span><button/)
    // flex-1 이면 제목이 남는 폭을 다 먹어 버튼이 행 우측 끝으로 밀린다(수정 전 동작).
    const titleSpan = html.match(/<span class="([^"]*)">로그 파서 조사<\/span>/)
    expect(titleSpan?.[1]).not.toContain('flex-1')
    expect(titleSpan?.[1]).toContain('truncate')
  })

  it('중단 확정을 기다리는 동안에는 버튼을 다시 낼 수 없다', () => {
    const html = renderProgress(messages(backgroundTask('bg1', '로그 파서 조사')), ['bg1'])
    expect(html).toContain('로그 파서 조사')
    expect(html).not.toContain('aria-label="중단"')
  })
})

describe('백그라운드 작업 타일 — 복구 (AT-28 · D-016)', () => {
  it('상태 그룹을 진행 중 → 완료 → 중단됨 → 실패 순으로 그린다', () => {
    const html = renderSubagentList(
      messages(
        backgroundTask('bg1', '진행 중 작업'),
        backgroundTask('bg2', '완료 작업', { output: { summary: 'ok' }, isError: false }),
        backgroundTask('bg3', '중단 작업', {
          output: { reason: 'aborted', message: '중단됨' },
          isError: true
        }),
        backgroundTask('bg4', '실패 작업', {
          output: { reason: 'failed', message: '오류로 중단되었습니다' },
          isError: true
        })
      )
    )
    const order = ['진행 중 작업', '완료 작업', '중단 작업', '실패 작업'].map((t) =>
      html.indexOf(t)
    )
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('카드가 3줄 정보를 갖는다 — 제목 · 에이전트/상태/경과 · 도구수와 대화록 보기', () => {
    const html = renderSubagentList(messages(backgroundTask('bg1', '로그 파서 조사')))
    expect(html).toContain('로그 파서 조사')
    expect(html).toContain('진행 중')
    expect(html).toContain('대화록 보기')
    // 복구된 자리 — 중단 버튼은 '대화록 보기' 우측이지 제목 우측이 아니다(D-016 vs D-020).
    expect(html).toMatch(/대화록 보기<\/span>.*aria-label="중단"/s)
    expect(html).not.toMatch(/로그 파서 조사<\/span><button/)
  })

  it('상세는 child transcript 를 그린다', () => {
    const parts = backgroundTask('bg1', '로그 파서 조사')
    parts.push(
      {
        type: 'tool_call',
        toolRunId: 'child1',
        toolName: 'Bash',
        args: {},
        parentToolRunId: 'bg1'
      },
      { type: 'text', text: '서브에이전트가 찾은 결과', parentToolRunId: 'bg1' } as AppMessagePart
    )
    const msgs = messages(parts)
    const task = subagentTasksFromMessages(msgs)[0]
    const html = renderToStaticMarkup(
      createElement(SubAgentTaskDetail, {
        task,
        childMessage: childMessageForParentToolRunId(msgs, 'bg1'),
        startedAtMs: null
      })
    )
    expect(html).toContain('서브에이전트가 찾은 결과')
  })
})

describe('두 타일의 파생이 다르다 (AT-09a)', () => {
  it('백그라운드 파생은 background 만, 작업 파생은 두 종류를 낸다', () => {
    const msgs = messages(agentTask('일반 할 일', '1'), backgroundTask('bg1', '백그라운드 작업'))
    const backgroundOnly = subagentTasksFromMessages(msgs).map((t) =>
      backgroundTaskKey(t.toolUseId)
    )
    const board = taskBoardFromMessages(msgs).map((i) => i.key)

    expect(backgroundOnly).toEqual([backgroundTaskKey('bg1')])
    // 작업 파생이 백그라운드 파생을 포함한다(차집합 0).
    expect(backgroundOnly.filter((k) => !board.includes(k))).toEqual([])
    // 그리고 백그라운드 파생에는 없는 agent 항목을 더 갖는다.
    expect(board).toContain(agentTaskKey('1'))
    expect(backgroundOnly).not.toContain(agentTaskKey('1'))
  })
})

// 0204 ΔV1 §4 — 새로 만든 사용자 대면 문구에 **소비자가 있는지**를 화면 출력으로 본다.
// producer(파생)만 만들고 consumer(렌더)가 없으면 그 문구는 아무도 보지 못한다.
describe('새 문구의 소비자 (AT-31 · D-016a)', () => {
  it('작업 타일의 실패 행이 정착 사유를 그대로 보인다', () => {
    const html = renderProgress(
      messages(
        backgroundTask('bg1', '실패한 작업', {
          output: { reason: 'failed', message: '채널이 종료되어 서브에이전트가 중단되었습니다.' },
          isError: true
        })
      )
    )
    expect(html).toContain('채널이 종료되어 서브에이전트가 중단되었습니다.')
    // 양성 짝 — 중단 행의 기존 사유도 계속 나온다(대칭이지 대체가 아니다).
    const aborted = renderProgress(
      messages(
        backgroundTask('bg2', '중단한 작업', {
          output: { reason: 'aborted', message: '서브에이전트가 중단되었습니다.' },
          isError: true
        })
      )
    )
    expect(aborted).toContain('사용자에 의해 중단됨')
  })

  it('백그라운드 작업 타일이 중단 확정 대기를 중단 중으로 보인다', () => {
    const msgs = messages(backgroundTask('bg1', '로그 파서 조사'))
    const waiting = renderSubagentList(msgs, ['bg1'])
    expect(waiting).toContain('중단 중…')
    // 확정 대기 중에는 버튼을 다시 낼 수 없다(중복 요청 차단).
    expect(waiting).not.toContain('aria-label="중단"')
    // 양성 짝 — 대기 전에는 '진행 중' 이고 버튼이 있다.
    const running = renderSubagentList(msgs)
    expect(running).toContain('진행 중')
    expect(running).toContain('aria-label="중단"')
  })
})
