// 0204 ΔV1 — 두 타일이 서로 다른 책임을 갖는다(D-015·D-019)는 것을 렌더 출력으로 잠근다.
//
//   `백그라운드 작업`(subagent) = `72766d2` 복구 — 상태 그룹 · 3줄 카드 · 대화록 상세 (AT-28)
//   `작업`(task)               = 목록 하나 · id 순 · 취소선 · 제목 직후 중단 (AT-26·27 · 0213 AC8·AC9
//                                가 AT-29 의 3섹션을 대체했다)
//
// JSX 를 쓰지 않는 이유: vitest include 가 `src/**/*.test.ts` 라 `.tsx` 를 잡지 않는다.
// jsdom·testing-library 없이 react-dom/server 로 돈다(신규 의존성 0).
//
// **음성 단언에는 양성 짝을 둔다** — 아무것도 그리지 않는 출력에서 음성만 자동으로 참이 되는
// 것을 막는다(0203 ΔV2 에서 실제로 겪은 형태다).

import { beforeEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SubAgentTaskDetail, SubAgentTaskList, SubAgentTileContent } from './SubAgentTileContent'
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
const renderProgress = (msgs: Message[]): string =>
  renderToStaticMarkup(
    createElement(TaskProgressList, { items: taskBoardOrdered(taskBoardFromMessages(msgs)) })
  )

// 세션 parts → `백그라운드 작업` 목록 HTML.
const renderSubagentList = (msgs: Message[], stoppingIds: string[] = []): string =>
  renderToStaticMarkup(
    createElement(SubAgentTaskList, {
      tasks: subagentTasksFromMessages(msgs),
      stoppingIds: new Set(stoppingIds)
    })
  )

// 섹션 제목 → 그 섹션 **본문** HTML. 산출의 존재만 단언하면 형제 섹션끼리 본문을 맞바꾼
// 회귀가 초록으로 통과한다(verify r4 D15 / 변이 M-S) — 어느 섹션에 담겼는지까지 본다.
// 섹션이 없으면 `undefined` 라 단언이 실패한다(fail-closed).
function sectionBodies(html: string): Record<string, string> {
  const bodies: Record<string, string> = {}
  for (const chunk of html.split('<section').slice(1)) {
    const title = chunk.match(/<span[^>]*>([^<]+)<\/span>/)?.[1]
    const body = chunk.match(/<div class="pb-3">([\s\S]*)$/)?.[1]
    if (title !== undefined && body !== undefined) bodies[title] = body
  }
  return bodies
}

beforeEach(() => {
  runSeq = 0
})

// 0213 AC8·AC9 — 0204 AT-29(cowork 3섹션)를 **대체한다**. 사용자가 두 섹션을 숨기기로
// 했고(D-002) 하나 남은 섹션의 껍데기도 벗겼다(D-003). 구 케이스가 잡던 것은 *래퍼 →
// 본문 View 배선* 이라, 그 감도는 여기서 양성 단언으로 유지한다 — 래퍼에서 목록 View 를
// 지우면 빈 상태 문구가 사라져 red 다.
describe('작업 타일 — 목록 하나 (AC8·AC9 · §10 EP-06)', () => {
  it('껍데기 없이 목록 View 만 그린다 — 래퍼→본문 배선은 그대로다', () => {
    const html = renderToStaticMarkup(createElement(TaskTileContent))
    // 양성 — 래퍼가 `TaskProgressList` 를 실제로 부른다(빈 상태 문구가 그 View 의 산출이다).
    expect(html).toContain(
      'Claude 가 Task 를 만들거나 백그라운드 작업을 시작하면 여기에 표시됩니다.'
    )
    // 음성 ① — 섹션 껍데기가 없다. 헤더도 접기 컨트롤도 남지 않는다(D-003).
    expect(sectionBodies(html)).toEqual({})
    expect(html).not.toContain('aria-expanded')
    expect(html).not.toContain('진행 상황')
    // 음성 ② — 숨긴 두 섹션의 제목·설명 4문구가 전부 없다(D-002).
    expect(html).not.toContain('출력')
    expect(html).not.toContain('컨텍스트')
    expect(html).not.toContain('이 작업 중에 생성된 파일을 확인하고 열 수 있습니다.')
    expect(html).not.toContain('이 작업에 사용된 도구와 참조된 파일을 추적합니다.')
  })

  it('목록에 상태 그룹 헤더가 없다 — 한 줄로 나열한다 (AC10)', () => {
    const html = renderProgress(
      messages(agentTask('완료된 일', '1', 'completed'), agentTask('대기 중인 일', '2'))
    )
    // 양성 — 두 항목이 모두 한 목록에 있다(0215: 목록은 할 일만 담는다).
    expect(html).toContain('완료된 일')
    expect(html).toContain('대기 중인 일')
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

describe('0215 AT-16·AT-17 — `작업` 타일에는 서브에이전트가 오지 않는다', () => {
  it('서브에이전트만 있으면 목록이 비고 중단·전환 버튼도 없다', () => {
    const html = renderProgress(messages(backgroundTask('bg1', '로그 파서 조사')))
    expect(html).not.toContain('로그 파서 조사')
    expect(html).not.toContain('aria-label="중단"')
    expect(html).not.toContain('chat.taskTile.toBackgroundAria')
  })

  it('양성 짝 — 같은 세션의 할 일은 그대로 그려진다', () => {
    const html = renderProgress(messages(agentTask('설계 정리', '1', 'in_progress')))
    expect(html).toContain('설계 정리')
  })

  it('제목이 flex-1 을 갖지 않는다 (D-020 유지)', () => {
    const html = renderProgress(messages(agentTask('로그 파서 조사', '1', 'in_progress')))
    const titleSpan = html.match(/<span class="([^"]*)">로그 파서 조사<\/span>/)
    expect(titleSpan?.[1]).not.toContain('flex-1')
    expect(titleSpan?.[1]).toContain('truncate')
  })
})

describe('백그라운드 작업 타일 — 복구 (AT-28 · D-016)', () => {
  it('빈 상태에서도 래퍼가 목록 View의 제목과 설명을 그린다', () => {
    const html = renderToStaticMarkup(createElement(SubAgentTileContent))
    // 래퍼 → 목록 View 배선의 양성 관측. SubAgentTaskList 를 래퍼에서 제거하면
    // 두 문구가 함께 사라져야 한다(verify r3 D10 / V2).
    expect(html).toContain('백그라운드 작업이 없습니다')
    expect(html).toContain('Task 도구 호출이 감지되면 여기에 표시됩니다.')
  })

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
  it('0215 — 두 파생이 서로 겹치지 않는다 (한 항목을 두 타일이 그리지 않는다)', () => {
    const msgs = messages(agentTask('일반 할 일', '1'), backgroundTask('bg1', '백그라운드 작업'))
    const backgroundOnly = subagentTasksFromMessages(msgs).map((t) =>
      backgroundTaskKey(t.toolUseId)
    )
    const board = taskBoardFromMessages(msgs).map((i) => i.key)

    expect(backgroundOnly).toEqual([backgroundTaskKey('bg1')])
    expect(board).toEqual([agentTaskKey('1')])
    // 교집합 0 — 차집합으로 본다(총계는 이 주장을 반증하지 못한다).
    expect(board.filter((k) => backgroundOnly.includes(k))).toEqual([])
  })
})

// 0204 ΔV1 §4 — 새로 만든 사용자 대면 문구에 **소비자가 있는지**를 화면 출력으로 본다.
// producer(파생)만 만들고 consumer(렌더)가 없으면 그 문구는 아무도 보지 못한다.
describe('새 문구의 소비자 (AT-31 · D-016a)', () => {
  it('0215 — 정착 사유는 `백그라운드 작업` 타일이 보인다 (문구의 소비자가 옮겨졌다)', () => {
    const html = renderSubagentList(
      messages(
        backgroundTask('bg1', '실패한 작업', {
          output: { reason: 'failed', message: '채널이 종료되어 서브에이전트가 중단되었습니다.' },
          isError: true
        })
      )
    )
    expect(html).toContain('채널이 종료되어 서브에이전트가 중단되었습니다.')
    // 음성 짝 — `작업` 타일에는 그 행 자체가 없다.
    const board = renderProgress(
      messages(
        backgroundTask('bg1', '실패한 작업', {
          output: { reason: 'failed', message: '채널이 종료되어 서브에이전트가 중단되었습니다.' },
          isError: true
        })
      )
    )
    expect(board).not.toContain('실패한 작업')
    // 양성 짝 — 중단 행의 기존 사유도 계속 나온다(대칭이지 대체가 아니다).
    const aborted = renderSubagentList(
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

// 0215 VP-19 (SD-04 ↔ AT-19 · §10 EP-19) — 중단 실패 문구의 자리가 옮겨졌다.
describe('0215 AT-19 — 중단 실패 문구는 `백그라운드 작업` 타일이 낸다', () => {
  const withStopError = (msgs: Message[]): string =>
    renderToStaticMarkup(
      createElement(SubAgentTaskList, {
        tasks: subagentTasksFromMessages(msgs),
        stoppingIds: new Set<string>(),
        stopErrors: { [backgroundTaskKey('bg1')]: { messageKey: 'chat.taskTile.stopFailed' } }
      })
    )

  it('그 행 아래에 실패 문구가 뜬다', () => {
    const html = withStopError(messages(backgroundTask('bg1', '로그 파서 조사')))
    expect(html).toContain('중단하지 못했습니다')
    // 양성 짝 — 행 자체가 그려졌다.
    expect(html).toContain('로그 파서 조사')
  })

  it('실패가 없으면 문구도 없다 — 음성 짝', () => {
    const html = renderSubagentList(messages(backgroundTask('bg1', '로그 파서 조사')))
    expect(html).not.toContain('중단하지 못했습니다')
  })

  it('다른 항목의 실패는 이 행에 새지 않는다', () => {
    const html = renderToStaticMarkup(
      createElement(SubAgentTaskList, {
        tasks: subagentTasksFromMessages(messages(backgroundTask('bg1', '로그 파서 조사'))),
        stoppingIds: new Set<string>(),
        stopErrors: { [backgroundTaskKey('other')]: { messageKey: 'chat.taskTile.stopFailed' } }
      })
    )
    expect(html).not.toContain('중단하지 못했습니다')
  })
})
