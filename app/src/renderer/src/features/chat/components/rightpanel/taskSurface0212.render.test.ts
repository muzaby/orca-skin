// 0212 — SDK 표면 결손 6건의 **화면 산출**을 잠근다. 파생 규칙은 `lib/taskBoard.test.ts` 가,
// 정규화는 `main/adapters/claude-map.test.ts` 가 본다. 여기서는 그것들이 실제로 사용자에게
// 도달하는지만 본다.
//
// JSX 를 쓰지 않는 이유: vitest include 가 `src/**/*.test.ts` 라 `.tsx` 를 잡지 않는다
// (`rightPanelTiles.render.test.ts` 와 같은 제약).
//
// **음성 단언에는 양성 짝을 둔다** — 아무것도 그리지 않는 출력에서 음성만 자동으로 참이 되는
// 것을 막는다.

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SubAgentTaskList } from './SubAgentTileContent'
import { TaskProgressList } from './TaskTileContent'
import { subagentTasksFromMessages } from '../../lib/parts'
import { taskBoardFromMessages, taskBoardOrdered } from '../../lib/taskBoard'
// 메타 라인의 구분자는 **U+00A0 두 개**다 — 리터럴 공백으로 적으면 단언이 통과하지 않는다.
import { META_GAP } from '../../lib/toolMeta'
import { TaskToolBody } from '../transcript/tool-bodies/TaskToolBody'
import type { Message, ToolCall } from '../../reducer/chatReducer'
import type { AppMessagePart } from '../../../../../../shared/ipc'

let runSeq = 0
const nextRun = (): string => `run${(runSeq += 1)}`

const messages = (...parts: AppMessagePart[][]): Message[] => [
  { role: 'assistant', createdAt: 1_700_000_000_000, parts: parts.flat() }
]

// 할 일 항목 한 건 — 생성 후 (선택) 진행 중 전환. `activeForm` 은 **입력에만** 실린다.
function agentTask(
  subject: string,
  id: string,
  opts: { activeForm?: string; status?: 'in_progress' | 'completed' } = {}
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
  if (opts.status) {
    const updateRun = nextRun()
    parts.push(
      {
        type: 'tool_call',
        toolRunId: updateRun,
        toolName: 'TaskUpdate',
        args: {
          taskId: id,
          status: opts.status,
          ...(opts.activeForm !== undefined ? { activeForm: opts.activeForm } : {})
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
          updatedFields: ['status'],
          statusChange: { from: 'pending', to: opts.status }
        }
      }
    )
  }
  return parts
}

// 서브에이전트 한 건. `launched:true` 면 async_launched 런치 영수증이 도착한 상태(= 이미
// background), 없으면 결과 미도착(= 턴을 막고 있는 foreground).
function backgroundTask(
  toolRunId: string,
  description: string,
  opts: { launched?: boolean } = {}
): AppMessagePart[] {
  const parts: AppMessagePart[] = [
    { type: 'tool_call', toolRunId, toolName: 'Task', args: { description, prompt: 'p' } }
  ]
  if (opts.launched) {
    parts.push({
      type: 'tool_result',
      toolRunId,
      // 런치 영수증의 형태(`shared/subagent.ts`) — 이 키가 틀리면 성공 결과로 읽혀 status 가
      // completed 가 되고, 전환 버튼 음성 단언이 다른 이유로 통과한다.
      result: { status: 'async_launched' },
      isError: false
    })
  }
  return parts
}

const renderProgress = (
  msgs: Message[],
  opts: {
    stoppingBackgroundIds?: string[]
    pausedBackgroundIds?: string[]
    backgroundedIds?: string[]
    agentTools?: string[] | null
    cliVersion?: string | null
  } = {}
): string =>
  renderToStaticMarkup(
    createElement(TaskProgressList, {
      items: taskBoardOrdered(taskBoardFromMessages(msgs)),
      agentTools: opts.agentTools ?? null,
      cliVersion: opts.cliVersion ?? null
    })
  )

const renderSubagentList = (
  msgs: Message[],
  opts: { stoppingIds?: string[]; pausedIds?: string[]; backgroundedIds?: string[] } = {}
): string =>
  renderToStaticMarkup(
    createElement(SubAgentTaskList, {
      tasks: subagentTasksFromMessages(msgs),
      stoppingIds: new Set(opts.stoppingIds ?? []),
      pausedIds: new Set(opts.pausedIds ?? []),
      backgroundedIds: new Set(opts.backgroundedIds ?? [])
    })
  )

// ── R-01 기능 존재 게이트 ─────────────────────────────────────────────────────

describe('0212 R-01 — 빈 상태 세 갈래 (AT-01·02·03 · §10 EP-01)', () => {
  const NOTICE = '연결된 Claude Code 가 할 일 목록 도구를 지원하지 않습니다.'
  const EMPTY = 'Claude 가 Task 를 만들거나 백그라운드 작업을 시작하면 여기에 표시됩니다.'

  it('AT-01 — TaskCreate 가 있으면 안내가 뜨지 않는다', () => {
    const html = renderProgress(messages(), { agentTools: ['TaskCreate', 'Bash'] })
    expect(html).not.toContain(NOTICE)
    // 양성 짝 — 안내 대신 기존 빈 상태 문구가 실제로 렌더된다(둘 다 없으면 red).
    expect(html).toContain(EMPTY)
  })

  it('AT-02 — TaskCreate 가 없으면 원인과 CLI 버전이 함께 뜬다', () => {
    const html = renderProgress(messages(), {
      agentTools: ['Bash', 'Read'],
      cliVersion: '2.1.100'
    })
    expect(html).toContain(NOTICE)
    expect(html).toContain('2.1.100')
    // 음성 짝 — 기본 빈 상태 문구로 되돌아가지 않는다.
    expect(html).not.toContain(EMPTY)
  })

  it('AT-03 — tools 판정 불가(null)면 안내하지 않는다 (거짓 안내 금지 · D-005)', () => {
    const html = renderProgress(messages(), { agentTools: null, cliVersion: '2.1.100' })
    expect(html).not.toContain(NOTICE)
    expect(html).toContain(EMPTY)
  })

  // 0213 D-007 이 분모를 `items` 전체 → **할 일(agent) 항목**으로 좁혔다. 이 방향은 그대로다:
  // 할 일이 있으면 기능이 있다는 뜻이라 안내가 설 자리가 없다.
  it('안내는 할 일이 있으면 뜨지 않는다', () => {
    const html = renderProgress(messages(agentTask('설계', '1')), { agentTools: ['Bash'] })
    expect(html).not.toContain(NOTICE)
    expect(html).toContain('설계')
  })

  it('버전을 모르면 원인만 말한다 — 빈 버전 줄을 만들지 않는다', () => {
    const html = renderProgress(messages(), { agentTools: ['Bash'], cliVersion: null })
    expect(html).toContain(NOTICE)
    expect(html).not.toContain('설치된 버전')
  })
})

// ── R-02 표시 제목 교체 ───────────────────────────────────────────────────────

describe('0212 R-02 — activeForm 제목 교체와 안정 라벨 (AT-05·06·08 · §10 EP-05)', () => {
  it('AT-05·AT-08 — 제목은 현재진행형이고 aria-label 은 subject 다', () => {
    const html = renderProgress(
      messages(
        agentTask('테스트 작성', '1', { status: 'in_progress', activeForm: '테스트 작성 중' })
      )
    )
    // 표시 제목 — 현재진행형이 보인다.
    expect(html).toMatch(/<span class="[^"]*">테스트 작성 중<\/span>/)
    // 접근성 라벨 — 상태와 무관한 안정 이름이다. **두 값을 맞바꾸면 두 단언이 함께 red 다.**
    expect(html).toContain('aria-label="테스트 작성 상세 보기"')
    expect(html).not.toContain('aria-label="테스트 작성 중 상세 보기"')
  })

  it('AT-06 — completed 로 바뀌면 표시 제목이 subject 로 돌아온다', () => {
    const html = renderProgress(
      messages(agentTask('테스트 작성', '1', { status: 'completed', activeForm: '테스트 작성 중' }))
    )
    expect(html).toMatch(/<span class="[^"]*">테스트 작성<\/span>/)
    expect(html).not.toContain('테스트 작성 중')
  })
})

// ── R-05 일시정지 ─────────────────────────────────────────────────────────────

describe('0212 R-05 — paused 라벨과 중단 가용성 (AT-18·19 · §10 EP-10)', () => {
  it('0215 — `작업` 타일에는 그 행 자체가 없다 (제어도 상태 글리프도 오지 않는다)', () => {
    const html = renderProgress(messages(backgroundTask('bg1', '로그 조사')), {
      pausedBackgroundIds: ['bg1']
    })
    expect(html).not.toContain('로그 조사')
    expect(html).not.toContain('aria-label="중단"')
  })

  it('AT-18 — `백그라운드 작업` 타일도 일시정지 라벨을 보이고 버튼을 유지한다', () => {
    const html = renderSubagentList(messages(backgroundTask('bg1', '로그 조사')), {
      pausedIds: ['bg1']
    })
    // 카드 메타 라인이 일시정지를 말한다. 상태 **그룹 헤더**는 SDK 종단 상태(running) 기준이라
    // '진행 중' 으로 남는다 — 일시정지는 정착이 아니므로 그룹을 옮기지 않는다.
    expect(html).toContain(`에이전트${META_GAP}일시정지`)
    expect(html).toContain('aria-label="중단"')
    // 음성 짝 — 메타 라인이 진행 중으로 남지 않는다(같은 자리의 다른 값).
    expect(html).not.toContain(`에이전트${META_GAP}진행 중`)
  })

  it('중단 요청 중에는 버튼을 감춘다 — 중복 요청 차단은 그대로다', () => {
    const subagent = renderSubagentList(messages(backgroundTask('bg1', '로그 조사')), {
      stoppingIds: ['bg1'],
      pausedIds: ['bg1']
    })
    expect(subagent).not.toContain('aria-label="중단"')
    // 양성 짝 — 출력이 실제로 그 항목을 그렸다(행이 없어서 통과한 것이 아니다).
    expect(subagent).toContain('로그 조사')
  })
})

// ── R-07 foreground → background 전환 ────────────────────────────────────────

describe('0212 R-07 — 전환 버튼 (AT-23·24 · §10 EP-12)', () => {
  const ARIA = 'aria-label="로그 조사 백그라운드로 보내기"'

  it('AT-23 — foreground 행에 전환 버튼을 띄운다 (0215: `백그라운드 작업` 타일이 소유)', () => {
    const subagent = renderSubagentList(messages(backgroundTask('bg1', '로그 조사')))
    expect(subagent).toContain(ARIA)
    // 중단 버튼과 **함께** 있다 — 두 제어가 같은 행에 나란히 붙는다.
    expect(subagent).toContain('aria-label="중단"')
    // 음성 짝 — `작업` 타일에는 두 제어가 오지 않는다.
    const task = renderProgress(messages(backgroundTask('bg1', '로그 조사')))
    expect(task).not.toContain(ARIA)
    expect(task).not.toContain('aria-label="중단"')
  })

  it('AT-24 — 이미 background 인 행에는 전환 버튼이 없고 중단은 남는다', () => {
    const subagent = renderSubagentList(
      messages(backgroundTask('bg1', '로그 조사', { launched: true }))
    )
    expect(subagent).not.toContain(ARIA)
    // 양성 항 — 행 자체가 안 그려져서 통과한 것이 아니다.
    expect(subagent).toContain('aria-label="중단"')
  })

  it('전환 요청 in-flight 동안에는 버튼이 사라진다 — 중복 클릭 차단', () => {
    const html = renderSubagentList(messages(backgroundTask('bg1', '로그 조사')), {
      backgroundedIds: ['bg1']
    })
    expect(html).not.toContain(ARIA)
    expect(html).toContain('aria-label="중단"')
  })

  it('paused 행에는 전환 버튼이 없다 — 옮길 기다림이 없다', () => {
    const html = renderSubagentList(messages(backgroundTask('bg1', '로그 조사')), {
      pausedIds: ['bg1']
    })
    expect(html).not.toContain(ARIA)
    expect(html).toContain('aria-label="중단"')
  })

  it('전환 버튼 툴팁이 "작업은 계속 실행됩니다" 를 말한다 — 중단과 구분하는 유일한 수단이다', () => {
    const html = renderSubagentList(messages(backgroundTask('bg1', '로그 조사')))
    expect(html).toContain('백그라운드로 보냅니다. 작업은 계속 실행됩니다.')
  })
})

// ── AT-21 정착 사유 ──────────────────────────────────────────────────────────

describe('0212 — killed 의 patch.error 가 행에서 보인다 (AT-21)', () => {
  // `killed` → claude-map 이 `status:'stopped'` + `summary: patch.error` 로 정착시키고, settle 이
  // 그것을 `{ reason:'aborted', message, cause }` tool_result 로 굳힌다. **`cause` 가 사유**이고
  // `message` 는 transcript 용 기본 문장이다 — 사용자 중단 행의 표시 문구를 UI 가 소유하기
  // 때문이다(0204 AT-31). 그 `cause` 가 행에 닿는지가 이 단언의 대상이다.
  const settled = (cause: string): AppMessagePart[] => [
    { type: 'tool_call', toolRunId: 'bg1', toolName: 'Task', args: { description: '로그 조사' } },
    {
      type: 'tool_result',
      toolRunId: 'bg1',
      result: { reason: 'aborted', message: '서브에이전트가 중단되었습니다.', cause },
      isError: true
    }
  ]

  it('중단 행이 생산자가 실은 사유를 말한다 — 고정 문구가 아니다', () => {
    const html = renderSubagentList(messages(settled('한도를 초과했습니다')))
    expect(html).toContain('한도를 초과했습니다')
    // 음성 짝 — 고정 문구로 덮이지 않는다.
    expect(html).not.toContain('사용자에 의해 중단됨')
  })

  it('사유가 없으면 UI 문구로 떨어진다 — 양성 짝 (0204 AT-31 유지)', () => {
    const html = renderSubagentList(
      messages([
        {
          type: 'tool_call',
          toolRunId: 'bg1',
          toolName: 'Task',
          args: { description: '로그 조사' }
        },
        {
          type: 'tool_result',
          toolRunId: 'bg1',
          // 사용자 중단 — `message` 는 있고 `cause` 는 없다. 행은 UI 문구를 말한다.
          result: { reason: 'aborted', message: '서브에이전트가 중단되었습니다.' },
          isError: true
        }
      ])
    )
    expect(html).toContain('사용자에 의해 중단됨')
    expect(html).not.toContain('서브에이전트가 중단되었습니다.')
  })
})

// ── R-06 대화록 전용 본문 ─────────────────────────────────────────────────────

describe('0212 R-06 — Task 도구 전용 본문 (AT-22 · §10 EP-11)', () => {
  const call = (
    name: string,
    input: unknown,
    structuredOutput: unknown,
    isError = false
  ): ToolCall => ({
    toolUseId: 'u1',
    name,
    input,
    result: { output: 'wire', isError, structuredOutput }
  })

  const render = (c: ToolCall): string =>
    renderToStaticMarkup(createElement(TaskToolBody, { call: c }))

  it('성공한 TaskCreate 는 제목과 상태를 보인다', () => {
    const html = render(
      call(
        'TaskCreate',
        { subject: '설계', description: 'd' },
        { task: { id: '1', subject: '설계' } }
      )
    )
    expect(html).toContain('생성')
    expect(html).toContain('#1')
    expect(html).toContain('설계')
    expect(html).toContain('pending')
  })

  it('실패한 TaskUpdate 는 error 문구를 보인다 (D-016)', () => {
    const html = render(
      call(
        'TaskUpdate',
        { taskId: '404' },
        { success: false, taskId: '404', error: 'Task not found' }
      )
    )
    expect(html).toContain('실패')
    expect(html).toContain('Task not found')
    // 음성 짝 — 실패는 목록 지시로 읽히지 않으므로 상태/제목 줄이 없다.
    expect(html).not.toContain('갱신')
  })

  it('TaskList 는 전체 개수를 보인다', () => {
    const html = render(
      call('TaskList', {}, { tasks: [{ id: '1', subject: 'a', status: 'pending', blockedBy: [] }] })
    )
    expect(html).toContain('전체 조회')
    expect(html).toContain('1건')
  })

  it('삭제 신호는 제거로 읽힌다', () => {
    const html = render(
      call(
        'TaskUpdate',
        { taskId: '1', status: 'deleted' },
        { success: true, taskId: '1', updatedFields: ['status'] }
      )
    )
    expect(html).toContain('삭제')
    expect(html).toContain('#1')
  })
})
