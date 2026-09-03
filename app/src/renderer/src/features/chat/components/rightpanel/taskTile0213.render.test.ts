// 0213 — `작업` 타일 표시 계약 (AT-11~15 · §10 EP-04 · EP-05).
//
// 두 구멍을 닫는다. ① 할 일의 `blockedBy` 가 상세를 열어야만 보였다 — 목록에서 막힌 항목과
// 그냥 대기 중인 항목이 구분되지 않는다(D-005·D-006). ② 기능 부재 안내가 `items.length === 0`
// 이라 서브에이전트가 돌고 있으면 침묵했다 — `items` 는 할 일 + 서브에이전트 합집합이다(D-007).
//
// `TaskProgressList` 는 props-only View 라 store 없이 `react-dom/server` 로 돈다(0203 선례).
// 껍데기 부재(AC8·AC9)는 형제 파일 `rightPanelTiles.render.test.ts` 가 래퍼를 직접 렌더해
// 양성 짝과 함께 관측한다 — 여기서 다시 단언하지 않는다.

import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { backgroundTaskKey, taskBoardFromMessages, taskBoardOrdered } from '../../lib/taskBoard'
import type { Message } from '../../reducer/chatReducer'
import type { AppMessagePart } from '../../../../../../shared/ipc'

// 래퍼(`TaskTileContent`)는 store 를 읽는다 — `renderToStaticMarkup` 은 zustand 의 SSR
// 스냅샷(`getInitialState()`)을 돌려주어 시드가 반영되지 않는다. 그래서 store 모듈을 통째로
// 모킹해 **래퍼가 View 로 흘리는 props** 를 카드 산출로 관측한다(선례 `ChatTitleBar.render.test.ts`).
const { tileState } = vi.hoisted(() => ({
  tileState: {
    value: {
      messages: [] as unknown[],
      selectedTaskKey: null as string | null,
      taskStopErrors: {} as Record<string, unknown>,
      agentTools: null as string[] | null,
      cliVersion: null as string | null
    }
  }
}))

vi.mock('../../store/chatStore', () => ({
  chatActions: {
    acknowledgeSettledTasks: vi.fn(),
    selectTask: vi.fn(),
    stopTask: vi.fn(),
    backgroundTask: vi.fn()
  },
  useChatSession: (select: (s: unknown) => unknown) => select(tileState.value),
  useStoppingTasks: () => new Set<string>(),
  usePausedTasks: () => new Set<string>(),
  useBackgroundedTasks: () => new Set<string>(),
  useSubagentMeta: () => undefined,
  useUnseenSettledTaskCount: () => 0
}))

const { TaskProgressList, TaskTileContent } = await import('./TaskTileContent')

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
      items: taskBoardOrdered(taskBoardFromMessages(msgs)),
      agentTools: opts.agentTools ?? null,
      cliVersion: opts.cliVersion ?? null
    })
  )

// 행 제목(= `aria-label` 의 안정 이름) → 그 **행** 의 HTML. 목록 전체에서 문구 유무만 보면
// 어느 행이 냈는지 알 수 없고, 형제 행끼리 맞바뀐 회귀가 초록으로 통과한다 — 어디에 담겼는지까지
// 본다(형제 파일 `sectionBodies` 와 같은 형태). 행이 없으면 `undefined` 라 fail-closed 다.
function rowsBySubject(html: string): Record<string, string> {
  const rows: Record<string, string> = {}
  for (const chunk of html.split('<div role="button"').slice(1)) {
    const subject = chunk.match(/aria-label="([^"]+) 상세 보기"/)?.[1]
    if (subject !== undefined) rows[subject] = chunk
  }
  return rows
}

// **부재 술어는 부재가 깨질 때 나타날 산출 전체를 덮는다.** `#2 완료 필요` 로 세면 id 가 빠진
// 같은 문구(`# 완료 필요`)를 못 본다 — 실제로 `blockedBy.length === 0` 가드를 지운 변이가 그
// 좁은 술어를 통과했다(r1 verify D1). 그래서 세는 술어는 id 를 뺀 문구 자체다.
const BLOCKED_ANY = /완료 필요/g
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
    const rows = rowsBySubject(html)
    // 세 행이 모두 살아 있다(음성 단언이 빈 출력으로 자동 통과하지 않는다).
    expect(Object.keys(rows).sort()).toEqual(['그냥 대기', '막힌 작업', '선행 작업'])
    // 양성 — **막힌 행에** 문구가 있다. 상세와 같은 키(`blockedByValue`)로 조립된다.
    expect(rows['막힌 작업']).toContain(BLOCKED)
    // 음성 — 미막힘 두 행에는 그 문구가 **행 안에** 없다. 목록 전체가 아니라 행마다 본다.
    expect(rows['선행 작업']).not.toMatch(BLOCKED_ANY)
    expect(rows['그냥 대기']).not.toMatch(BLOCKED_ANY)
    // 음성 — id 를 뺀 문구까지 덮어 **전체 1회**다. `blockedBy` 빈 가드를 지우면 미막힘 행이
    // `# 완료 필요` 를 내는데, 좁은 술어는 그것을 못 본다(r1 verify D1).
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
    const rows = rowsBySubject(html)
    // 양성 짝 — 행 자체는 있다. 사라진 것은 둘째 줄뿐이다.
    expect(rows['끝난 작업']).toContain('line-through')
    // 음성 — id 유무와 무관하게 그 행에 문구가 없다. 목록 전체로도 0회다.
    expect(rows['끝난 작업']).not.toMatch(BLOCKED_ANY)
    expect(html.match(BLOCKED_ANY)).toBeNull()
  })

  it('0215 AT-16 — 서브에이전트는 행 자체가 없고 막힘 표시는 그 행에만 붙는다', () => {
    const html = renderProgress(
      messages(
        agentTask('선행 작업', '2'),
        agentTask('막힌 작업', '3', { blockedBy: ['2'] }),
        backgroundTask('bg1', '로그 파서 조사')
      )
    )
    const rows = rowsBySubject(html)
    // 차집합 — 두 할 일 말고는 아무 행도 없다.
    expect(Object.keys(rows).sort()).toEqual(['막힌 작업', '선행 작업'])
    // 둘째 줄 슬롯의 분기는 하나뿐이고, **막힌 행에만** 선다(형제 행으로 새지 않는다).
    expect(rows['막힌 작업']).toContain(BLOCKED)
    expect(rows['선행 작업']).not.toMatch(BLOCKED_ANY)
  })
})

// ── R-04 안내 조건 ────────────────────────────────────────────────────────────

describe('0213 R-04 — 기능 부재 안내의 분모 (AT-15~18 · §10 EP-05)', () => {
  it('AT-15 — 할 일 0 · 서브에이전트 진행 중이면 안내가 선다 (서브에이전트 행은 없다)', () => {
    const html = renderProgress(messages(backgroundTask('bg1', '로그 파서 조사')), {
      agentTools: ['Bash', 'Read'],
      cliVersion: '2.1.100'
    })
    // 안내가 침묵하지 않는다 — 이 CLI 에 할 일 도구가 없다는 사실은 여전히 참이다.
    expect(html).toContain(NOTICE)
    expect(html).toContain('2.1.100')
    // 0215 — 서브에이전트는 이 타일에 오지 않는다.
    expect(html).not.toContain('로그 파서 조사')
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
    expect(html).not.toContain('로그 파서 조사')
  })

  it('AT-17 — 판정 불가(null)면 안내하지 않는다 (0212 D-005)', () => {
    const html = renderProgress(messages(backgroundTask('bg1', '로그 파서 조사')), {
      agentTools: null,
      cliVersion: '2.1.100'
    })
    expect(html).not.toContain(NOTICE)
    // 양성 짝 — 안내 대신 기본 빈 문구가 선다(아무것도 안 그려진 것이 아니다).
    expect(html).toContain(EMPTY)
  })

  it('AT-18 — 전부 비고 기능이 있으면 기존 빈 문구다 — 안내와 서로의 음성 짝이다', () => {
    const html = renderProgress(messages(), { agentTools: ['TaskCreate'], cliVersion: '2.1.100' })
    expect(html).toContain(EMPTY)
    expect(html).not.toContain(NOTICE)
  })
})

// ── VP-08 path 의 마지막 홉 — 래퍼 → View props ───────────────────────────────

describe('0213 — 래퍼가 View 로 흘리는 props (VP-08 path `→ 카드` · §12)', () => {
  // 분기 자체는 위에서 잠갔다. 여기서 보는 것은 **그 판정의 입력이 어디서 오는가** 다 —
  // 래퍼가 props 를 안 넘기면 기본값(`null`·`{}`)으로 떨어져 안내가 프로덕션에서 영영 안 뜨는데,
  // View 를 고립 렌더하는 oracle 은 그것을 못 본다(r1 verify D2).
  //
  // 네 props 를 **전수로** 본다: `items` · `stopErrors` · `agentTools` · `cliVersion`.
  // D2 는 뒤의 둘만 지목했으나 같은 불변식이 넷 모두에 성립한다.
  const renderCard = (state: Partial<typeof tileState.value>): string => {
    tileState.value = {
      messages: [],
      selectedTaskKey: null,
      taskStopErrors: {},
      agentTools: null,
      cliVersion: null,
      ...state
    }
    return renderToStaticMarkup(createElement(TaskTileContent))
  }

  it('`agentTools`·`cliVersion` 이 카드까지 흐른다 — 안내와 버전이 실제로 뜬다', () => {
    const html = renderCard({
      messages: messages(backgroundTask('bg1', '로그 파서 조사')),
      agentTools: ['Bash', 'Read'],
      cliVersion: '2.1.100'
    })
    expect(html).toContain(NOTICE)
    expect(html).toContain('2.1.100')
  })

  it('`agentTools` 판정 불가면 카드도 안내하지 않는다 — 음성 짝', () => {
    const html = renderCard({
      messages: messages(backgroundTask('bg1', '로그 파서 조사')),
      agentTools: null,
      cliVersion: '2.1.100'
    })
    expect(html).not.toContain(NOTICE)
    // 양성 짝 — 카드가 렌더되긴 했다(빈 문구가 그 증거).
    expect(html).toContain(EMPTY)
  })

  it('`items` 가 카드까지 흐른다 — 세션 parts 가 행이 된다', () => {
    const html = renderCard({
      messages: messages(
        agentTask('선행 작업', '2'),
        agentTask('막힌 작업', '3', { blockedBy: ['2'] })
      )
    })
    const rows = rowsBySubject(html)
    expect(Object.keys(rows).sort()).toEqual(['막힌 작업', '선행 작업'])
    expect(rows['막힌 작업']).toContain(BLOCKED)
  })

  it('0215 — `stopErrors` 는 이 카드로 흐르지 않는다 (문구의 자리가 옮겨졌다)', () => {
    const html = renderCard({
      messages: messages(backgroundTask('bg1', '로그 파서 조사')),
      taskStopErrors: { [backgroundTaskKey('bg1')]: { messageKey: 'chat.taskTile.stopFailed' } }
    })
    expect(html).not.toContain('중단하지 못했습니다')
    // 양성 짝은 `백그라운드 작업` 타일 쪽 케이스가 갖는다(0215 AT-19).
  })
})
