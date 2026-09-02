import { describe, expect, it } from 'vitest'
import {
  agentTaskKey,
  backgroundTaskKey,
  canBackgroundStatus,
  canBackgroundTask,
  canStopBackgroundStatus,
  canStopTask,
  taskBoardFromMessages,
  taskBoardOrdered,
  taskDetailRows,
  type TaskBoardItem
} from './taskBoard'
import type { Message } from '../reducer/chatReducer'
import type { AppMessagePart } from '../../../../../shared/ipc'

let runSeq = 0
const nextRun = (): string => `run${(runSeq += 1)}`

// Task 도구 호출 한 쌍(tool_call + tool_result)을 파트로 만든다. `structuredOutput` 이 없으면
// 결과가 도착하지 않은 것으로 두어 "tool_use 만 관측된 시점" 을 표현한다.
function call(
  toolName: string,
  args: unknown,
  structuredOutput?: unknown,
  opts: { isError?: boolean; pending?: boolean } = {}
): AppMessagePart[] {
  const toolRunId = nextRun()
  const parts: AppMessagePart[] = [{ type: 'tool_call', toolRunId, toolName, args }]
  if (!opts.pending) {
    parts.push({
      type: 'tool_result',
      toolRunId,
      result: 'wire text for the model',
      isError: opts.isError === true,
      ...(structuredOutput !== undefined ? { structuredOutput } : {})
    })
  }
  return parts
}

function messages(...parts: AppMessagePart[][]): Message[] {
  return [{ role: 'assistant', createdAt: 1_700_000_000_000, parts: parts.flat() }]
}

const created = (id: string, subject: string): unknown => ({ task: { id, subject } })
const updated = (id: string, to: string): unknown => ({
  success: true,
  taskId: id,
  updatedFields: ['status'],
  statusChange: { from: 'pending', to }
})

// background 서브에이전트 한 건 — 부모 Agent 도구 호출 + (선택) 결과.
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

const titles = (items: TaskBoardItem[]): string[] => items.map((i) => i.title)
const byKey = (items: TaskBoardItem[], key: string): TaskBoardItem => {
  const found = items.find((i) => i.key === key)
  if (!found) throw new Error(`no item for ${key}`)
  return found
}

describe('taskBoardFromMessages — TaskCreate (AC1·AC2)', () => {
  it('성공 결과가 도착해야 항목이 생긴다 — tool_use 만으로는 0건', () => {
    const pending = taskBoardFromMessages(
      messages(call('TaskCreate', { subject: '테스트 작성' }, undefined, { pending: true }))
    )
    expect(pending).toHaveLength(0)

    const settled = taskBoardFromMessages(
      messages(
        call(
          'TaskCreate',
          { subject: '테스트 작성', description: 'API 테스트' },
          created('3', '테스트 작성')
        )
      )
    )
    expect(settled).toHaveLength(1)
    expect(settled[0]).toMatchObject({
      key: agentTaskKey('3'),
      kind: 'agent',
      id: '3',
      title: '테스트 작성',
      description: 'API 테스트',
      status: 'pending',
      background: null
    })
  })

  it('실패한 TaskCreate 는 항목을 만들지 않는다', () => {
    const items = taskBoardFromMessages(
      messages(call('TaskCreate', { subject: 'x' }, created('3', 'x'), { isError: true }))
    )
    expect(items).toHaveLength(0)
  })
})

describe('taskBoardFromMessages — TaskUpdate (AC3~AC6)', () => {
  it('상태 변경은 같은 항목을 갱신하고 중복을 만들지 않는다', () => {
    const items = taskBoardFromMessages(
      messages(
        call('TaskCreate', { subject: '테스트 작성' }, created('3', '테스트 작성')),
        call('TaskUpdate', { taskId: '3', status: 'in_progress' }, updated('3', 'in_progress'))
      )
    )
    expect(items).toHaveLength(1)
    expect(items[0].status).toBe('in_progress')
  })

  it('제목 변경이 반영된다', () => {
    const items = taskBoardFromMessages(
      messages(
        call('TaskCreate', { subject: '옛 제목' }, created('3', '옛 제목')),
        call(
          'TaskUpdate',
          { taskId: '3', subject: '새 제목' },
          { success: true, taskId: '3', updatedFields: ['subject'] }
        )
      )
    )
    expect(titles(items)).toEqual(['새 제목'])
  })

  it('deleted 는 목록에서 제거한다', () => {
    const items = taskBoardFromMessages(
      messages(
        call('TaskCreate', { subject: 'x' }, created('3', 'x')),
        call(
          'TaskUpdate',
          { taskId: '3', status: 'deleted' },
          { success: true, taskId: '3', updatedFields: ['status'] }
        )
      )
    )
    expect(items).toHaveLength(0)
  })

  it('success:false 는 아무것도 바꾸지 않는다', () => {
    const items = taskBoardFromMessages(
      messages(
        call('TaskCreate', { subject: 'x' }, created('3', 'x')),
        call(
          'TaskUpdate',
          { taskId: '3', status: 'completed' },
          { success: false, taskId: '3', updatedFields: [], error: 'stale' }
        )
      )
    )
    expect(items[0].status).toBe('pending')
  })
})

describe('taskBoardFromMessages — TaskList / TaskGet 보정 (AC7·AC8)', () => {
  it('TaskList 스냅샷이 상태 교체·신규 추가·부재 제거를 모두 수행한다', () => {
    const items = taskBoardFromMessages(
      messages(
        call('TaskCreate', { subject: '1' }, created('1', '하나')),
        call('TaskUpdate', { taskId: '1', status: 'in_progress' }, updated('1', 'in_progress')),
        call('TaskCreate', { subject: '2' }, created('2', '둘')),
        call('TaskCreate', { subject: '9' }, created('9', '아홉')),
        call(
          'TaskList',
          {},
          {
            tasks: [
              { id: '1', subject: '하나', status: 'completed', blockedBy: [] },
              { id: '2', subject: '둘', status: 'in_progress', blockedBy: [] },
              { id: '3', subject: '셋', status: 'pending', blockedBy: [] }
            ]
          }
        )
      )
    )
    expect(items.map((i) => [i.id, i.status])).toEqual([
      ['1', 'completed'],
      ['2', 'in_progress'],
      ['3', 'pending']
    ])
    expect(items.some((i) => i.id === '9')).toBe(false)
  })

  it('TaskGet 은 그 id 만 갱신하고 task:null 은 제거한다', () => {
    const base = [
      call('TaskCreate', { subject: 'a' }, created('1', 'a')),
      call('TaskCreate', { subject: 'b' }, created('2', 'b'))
    ]
    const updatedOne = taskBoardFromMessages(
      messages(
        ...base,
        call(
          'TaskGet',
          { taskId: '2' },
          {
            task: {
              id: '2',
              subject: 'b',
              description: 'd',
              status: 'in_progress',
              blocks: [],
              blockedBy: ['1']
            }
          }
        )
      )
    )
    expect(updatedOne.map((i) => [i.id, i.status])).toEqual([
      ['1', 'pending'],
      ['2', 'in_progress']
    ])
    expect(byKey(updatedOne, agentTaskKey('2')).blockedBy).toEqual(['1'])

    const removed = taskBoardFromMessages(
      messages(...base, call('TaskGet', { taskId: '2' }, { task: null }))
    )
    expect(removed.map((i) => i.id)).toEqual(['1'])
  })
})

describe('taskBoardFromMessages — background 항목 (AC9·AC10·AC12)', () => {
  it('background 항목만 실행 메타를 갖고 일반 Task 는 갖지 않는다', () => {
    const items = taskBoardFromMessages(
      messages(
        call('TaskCreate', { subject: '문서 갱신' }, created('1', '문서 갱신')),
        backgroundTask('bg1', '테스트 실행')
      )
    )
    expect(byKey(items, agentTaskKey('1')).background).toBeNull()
    const bg = byKey(items, backgroundTaskKey('bg1'))
    expect(bg.kind).toBe('background')
    expect(bg.background).toMatchObject({ toolUses: 0 })
    expect(bg.status).toBe('in_progress')
  })

  it('중단 요청 중인 background 는 stopping 이고 목록에서 사라지지 않는다', () => {
    const items = taskBoardFromMessages(messages(backgroundTask('bg1', '테스트 실행')), {
      stoppingBackgroundIds: new Set(['bg1'])
    })
    expect(items[0].status).toBe('stopping')
    expect(taskBoardOrdered(items)).toHaveLength(1)
    // 중단 중에는 버튼을 다시 누를 수 없다(중복 요청 차단).
    expect(canStopTask(items[0])).toBe(false)
  })

  it('AT-10a — 그룹 없이 id 오름차순 단일 목록이고 background 는 관측 순으로 뒤에 온다', () => {
    const items = taskBoardFromMessages(
      messages(
        // 일부러 뒤섞어 넣는다 — 관측 순서가 아니라 id 순서가 정본임을 본다.
        call('TaskCreate', { subject: 'ten' }, created('10', 'ten')),
        call('TaskCreate', { subject: 'two' }, created('2', 'two')),
        call('TaskCreate', { subject: 'one' }, created('1', 'one')),
        call('TaskUpdate', { taskId: '1', status: 'completed' }, updated('1', 'completed')),
        backgroundTask('bgA', '먼저 뜬 백그라운드'),
        backgroundTask('bgB', '나중에 뜬 백그라운드')
      )
    )
    const ordered = taskBoardOrdered(items)
    // 수치 비교여야 한다 — 사전순이면 '10' 이 '2' 앞에 온다.
    expect(ordered.map((i) => i.key)).toEqual([
      agentTaskKey('1'),
      agentTaskKey('2'),
      agentTaskKey('10'),
      backgroundTaskKey('bgA'),
      backgroundTaskKey('bgB')
    ])
    // 완료 항목이 뒤로 옮겨가지 않는다 — 제자리에서 취소선으로 표시된다(D-018).
    expect(ordered[0].status).toBe('completed')
  })

  it('AT-10a — 숫자가 아닌 id 는 수치 id 뒤에 사전순으로 오고 순서가 전순서다', () => {
    const items = taskBoardFromMessages(
      messages(
        call('TaskCreate', { subject: 'b' }, created('beta', 'b')),
        call('TaskCreate', { subject: 'a' }, created('alpha', 'a')),
        call('TaskCreate', { subject: '3' }, created('3', '3'))
      )
    )
    expect(taskBoardOrdered(items).map((i) => i.id)).toEqual(['3', 'alpha', 'beta'])
  })
})

describe('taskBoardFromMessages — 관측만 하는 도구 (AC23)', () => {
  it('TaskOutput·TaskStop 호출은 목록을 만들지 않는다', () => {
    const items = taskBoardFromMessages(
      messages(
        call(
          'TaskOutput',
          { task_id: 'bg1', block: true, timeout: 30_000 },
          { output: 'log', status: 'completed' }
        ),
        call(
          'TaskStop',
          { task_id: 'bg1' },
          { message: 'stopped', task_id: 'bg1', task_type: 'bash' }
        )
      )
    )
    expect(items).toHaveLength(0)
  })

  it('서브에이전트 child 의 Task 도구 호출은 이 세션 목록이 아니다', () => {
    const toolRunId = nextRun()
    const items = taskBoardFromMessages(
      messages([
        {
          type: 'tool_call',
          toolRunId,
          toolName: 'TaskCreate',
          args: { subject: 'child' },
          parentToolRunId: 'bg1'
        },
        {
          type: 'tool_result',
          toolRunId,
          result: 'x',
          isError: false,
          structuredOutput: created('5', 'child'),
          parentToolRunId: 'bg1'
        }
      ])
    )
    expect(items).toHaveLength(0)
  })
})

describe('taskDetailRows (AC24)', () => {
  it('일반 Task 는 상태·설명·의존성만 낸다', () => {
    const items = taskBoardFromMessages(
      messages(
        call(
          'TaskCreate',
          { subject: '테스트 작성', description: 'API 테스트 추가' },
          created('2', '테스트 작성')
        ),
        call(
          'TaskGet',
          { taskId: '2' },
          {
            task: {
              id: '2',
              subject: '테스트 작성',
              description: 'API 테스트 추가',
              status: 'in_progress',
              blocks: [],
              blockedBy: ['1']
            }
          }
        )
      )
    )
    expect(taskDetailRows(items[0]).map((r) => r.labelKey)).toEqual([
      'chat.taskTile.detail.status',
      'chat.taskTile.detail.description',
      'chat.taskTile.detail.blockedBy'
    ])
  })

  it('background Task 는 경과·최근 작업·도구 사용을 낸다 — 설명/의존성 행이 없다', () => {
    const items = taskBoardFromMessages(messages(backgroundTask('bg1', '테스트 실행')))
    const keys = taskDetailRows(items[0]).map((r) => r.labelKey)
    expect(keys).toContain('chat.taskTile.detail.elapsed')
    expect(keys).toContain('chat.taskTile.detail.toolUses')
    expect(keys).not.toContain('chat.taskTile.detail.description')
    expect(keys).not.toContain('chat.taskTile.detail.blockedBy')
  })
})

describe('키 네임스페이스 (EP-04)', () => {
  it('같은 문자열 id 를 가진 두 종류가 서로 덮어쓰지 않는다', () => {
    const items = taskBoardFromMessages(
      messages(
        call('TaskCreate', { subject: '일반' }, created('bg1', '일반')),
        backgroundTask('bg1', '백그라운드')
      )
    )
    expect(items).toHaveLength(2)
    expect(items.map((i) => i.key).sort()).toEqual(
      [agentTaskKey('bg1'), backgroundTaskKey('bg1')].sort()
    )
  })
})

// 0204 ΔV2 AT-34 / §10 EP-19 — 의존 간선의 두 의미.
//
//   TaskUpdate(addBlockedBy) = 가산    TaskGet/TaskList(blockedBy) = 전체 교체
//
// 한 의미로 합치면 둘 중 하나가 조용히 깨진다 — 가산만 알면 삭제된 간선이 영구 잔류하고,
// 교체만 알면 TaskUpdate 한 번이 기존 간선을 통째로 지운다.
describe('의존 간선 — 가산 vs 교체 (AT-34)', () => {
  const dependsOn = (id: string, items: TaskBoardItem[]): string[] =>
    byKey(items, agentTaskKey(id)).blockedBy

  // 의존 id 는 **args** 가 나른다 — `TaskUpdateOutput` 에는 blockedBy 필드가 없다.
  // 출력은 성공 여부와 `updatedFields` 게이트만 준다.
  const addBlocked = (id: string): unknown => ({
    success: true,
    taskId: id,
    updatedFields: ['addBlockedBy']
  })

  it('TaskUpdate 의 addBlockedBy 는 기존 의존에 더한다 — 중복 id 는 한 번만', () => {
    const items = taskBoardFromMessages(
      messages(
        call('TaskCreate', { subject: '배포' }, created('5', '배포')),
        call('TaskUpdate', { taskId: '5', addBlockedBy: ['1'] }, addBlocked('5')),
        call('TaskUpdate', { taskId: '5', addBlockedBy: ['2'] }, addBlocked('5')),
        // 같은 id 를 다시 더해도 누적되지 않는다.
        call('TaskUpdate', { taskId: '5', addBlockedBy: ['1'] }, addBlocked('5'))
      )
    )
    expect(dependsOn('5', items)).toEqual(['1', '2'])
  })

  it('TaskList 스냅샷은 의존을 전체 교체한다 — 가산분이 누적되지 않는다', () => {
    const items = taskBoardFromMessages(
      messages(
        call('TaskCreate', { subject: '배포' }, created('5', '배포')),
        call('TaskUpdate', { taskId: '5', addBlockedBy: ['1', '2'] }, addBlocked('5')),
        call(
          'TaskList',
          {},
          { tasks: [{ id: '5', subject: '배포', status: 'pending', blockedBy: ['3'] }] }
        )
      )
    )
    // 교체다 — ['1','2','3'] 이면 가산으로 잘못 구현된 것이다.
    expect(dependsOn('5', items)).toEqual(['3'])
  })

  it('완료 후 새로 생긴 작업은 앞의 것과 의존이 없다 (D-031)', () => {
    const items = taskBoardFromMessages(
      messages(
        call('TaskCreate', { subject: '먼저' }, created('1', '먼저')),
        call('TaskUpdate', { taskId: '1', status: 'completed' }, updated('1', 'completed')),
        call('TaskCreate', { subject: '나중' }, created('2', '나중'))
      )
    )
    // 순서(id)는 의존이 아니다 — 목록에 둘 다 있고 새 항목의 의존은 비어 있다.
    expect(taskBoardOrdered(items).map((i) => i.id)).toEqual(['1', '2'])
    expect(dependsOn('2', items)).toEqual([])
  })
})

// ── 0212 — 표시 제목 · 역방향 간선 · 일시정지 · 전환 술어 ──────────────────────

// `activeForm` 은 **입력에만** 있다(spec §2.2·§2.4) — 출력은 성공/updatedFields 만 준다.
const updatedActive = (id: string): unknown => ({
  success: true,
  taskId: id,
  updatedFields: ['status', 'activeForm'],
  statusChange: { from: 'pending', to: 'in_progress' }
})

describe('0212 — 표시 제목과 안정 이름 (AT-05·06·07 · §10 EP-05)', () => {
  const item = (id: string, items: TaskBoardItem[]): TaskBoardItem => byKey(items, agentTaskKey(id))

  it('AT-05 — in_progress 인 동안 제목이 activeForm 으로 교체된다', () => {
    const items = taskBoardFromMessages(
      messages(
        call('TaskCreate', { subject: '테스트 작성' }, created('1', '테스트 작성')),
        call(
          'TaskUpdate',
          { taskId: '1', status: 'in_progress', activeForm: '테스트 작성 중' },
          updatedActive('1')
        )
      )
    )
    expect(item('1', items).title).toBe('테스트 작성 중')
    // **형제 슬롯을 맞바꾼 회귀를 잡는 짝** — 안정 이름은 흔들리지 않는다(D-007).
    expect(item('1', items).subject).toBe('테스트 작성')
  })

  it('AT-06 — completed 로 바뀌면 제목이 subject 로 돌아온다', () => {
    const items = taskBoardFromMessages(
      messages(
        call('TaskCreate', { subject: '테스트 작성' }, created('1', '테스트 작성')),
        call(
          'TaskUpdate',
          { taskId: '1', status: 'in_progress', activeForm: '테스트 작성 중' },
          updatedActive('1')
        ),
        call('TaskUpdate', { taskId: '1', status: 'completed' }, updated('1', 'completed'))
      )
    )
    expect(item('1', items).title).toBe('테스트 작성')
    expect(item('1', items).subject).toBe('테스트 작성')
  })

  it('다시 in_progress 가 되면 같은 activeForm 이 돌아온다 — 값은 지워지지 않는다', () => {
    const items = taskBoardFromMessages(
      messages(
        call('TaskCreate', { subject: '테스트 작성' }, created('1', '테스트 작성')),
        call(
          'TaskUpdate',
          { taskId: '1', status: 'in_progress', activeForm: '테스트 작성 중' },
          updatedActive('1')
        ),
        call('TaskUpdate', { taskId: '1', status: 'completed' }, updated('1', 'completed')),
        call('TaskUpdate', { taskId: '1', status: 'in_progress' }, updated('1', 'in_progress'))
      )
    )
    expect(item('1', items).title).toBe('테스트 작성 중')
  })

  it('AT-07 — activeForm 이 없으면 진행 중에도 subject 를 쓴다', () => {
    const items = taskBoardFromMessages(
      messages(
        call('TaskCreate', { subject: '테스트 작성' }, created('1', '테스트 작성')),
        call('TaskUpdate', { taskId: '1', status: 'in_progress' }, updated('1', 'in_progress'))
      )
    )
    expect(item('1', items).title).toBe('테스트 작성')
    expect(item('1', items).subject).toBe('테스트 작성')
  })

  it('background 항목은 표시와 안정 이름이 같다 — activeForm 개념이 없다', () => {
    const items = taskBoardFromMessages(messages(backgroundTask('bg1', '코드 탐색')))
    const bg = byKey(items, backgroundTaskKey('bg1'))
    expect(bg.title).toBe('코드 탐색')
    expect(bg.subject).toBe('코드 탐색')
  })
})

describe('0212 — 역방향 의존 간선 (AT-10·11·12·13 · §10 EP-04)', () => {
  const dependsOn = (id: string, items: TaskBoardItem[]): string[] =>
    byKey(items, agentTaskKey(id)).blockedBy
  const addBlocks = (id: string): unknown => ({
    success: true,
    taskId: id,
    updatedFields: ['blocks']
  })

  it('AT-10 — TaskUpdate(A, addBlocks:[B]) 는 B 의 blockedBy 에 A 를 더한다', () => {
    const items = taskBoardFromMessages(
      messages(
        call('TaskCreate', { subject: '설계' }, created('1', '설계')),
        call('TaskCreate', { subject: '구현' }, created('2', '구현')),
        call('TaskUpdate', { taskId: '1', addBlocks: ['2'] }, addBlocks('1'))
      )
    )
    expect(dependsOn('2', items)).toEqual(['1'])
    // 방향이 뒤집혔는지 확인하는 짝 — 소스 항목에는 간선이 생기지 않는다.
    expect(dependsOn('1', items)).toEqual([])
  })

  it('AT-11 — 대상이 없으면 항목을 만들지 않는다 (유령 행 방지 · D-010)', () => {
    const items = taskBoardFromMessages(
      messages(
        call('TaskCreate', { subject: '설계' }, created('1', '설계')),
        call('TaskUpdate', { taskId: '1', addBlocks: ['9'] }, addBlocks('1'))
      )
    )
    expect(items).toHaveLength(1)
    expect(items.map((i) => i.id)).toEqual(['1'])
  })

  it('AT-12 — 자기 자신을 막는 간선은 만들지 않는다', () => {
    const items = taskBoardFromMessages(
      messages(
        call('TaskCreate', { subject: '설계' }, created('1', '설계')),
        call('TaskUpdate', { taskId: '1', addBlocks: ['1'] }, addBlocks('1'))
      )
    )
    expect(dependsOn('1', items)).toEqual([])
  })

  it('가산이다 — 여러 소스가 같은 대상을 막으면 둘 다 남고 중복은 한 번만', () => {
    const items = taskBoardFromMessages(
      messages(
        call('TaskCreate', { subject: '설계' }, created('1', '설계')),
        call('TaskCreate', { subject: '구현' }, created('2', '구현')),
        call('TaskCreate', { subject: '검토' }, created('3', '검토')),
        call('TaskUpdate', { taskId: '1', addBlocks: ['3'] }, addBlocks('1')),
        call('TaskUpdate', { taskId: '2', addBlocks: ['3'] }, addBlocks('2')),
        call('TaskUpdate', { taskId: '1', addBlocks: ['3'] }, addBlocks('1'))
      )
    )
    expect(dependsOn('3', items)).toEqual(['1', '2'])
  })

  it('AT-13 — TaskList 스냅샷이 역방향 가산분을 교체한다', () => {
    const items = taskBoardFromMessages(
      messages(
        call('TaskCreate', { subject: '설계' }, created('1', '설계')),
        call('TaskCreate', { subject: '구현' }, created('2', '구현')),
        call('TaskUpdate', { taskId: '1', addBlocks: ['2'] }, addBlocks('1')),
        call(
          'TaskList',
          {},
          {
            tasks: [
              { id: '1', subject: '설계', status: 'pending', blockedBy: [] },
              { id: '2', subject: '구현', status: 'pending', blockedBy: [] }
            ]
          }
        )
      )
    )
    expect(dependsOn('2', items)).toEqual([])
  })
})

describe('0212 — 일시정지와 제어 술어 (AT-18·19·23·24 · §10 EP-10·EP-13)', () => {
  // 런치 영수증의 형태는 `{ status: 'async_launched' }` 다(`shared/subagent.ts`) — `async_launched:
  // true` 로 쓰면 성공 결과로 읽혀 status 가 completed 가 되고, 음성 단언이 **다른 이유로**
  // 통과한다.
  const running = { output: { status: 'async_launched' }, isError: false }

  it('paused 집합에 든 진행 중 항목은 paused 상태다', () => {
    const items = taskBoardFromMessages(messages(backgroundTask('bg1', '탐색')), {
      stoppingBackgroundIds: new Set(),
      pausedBackgroundIds: new Set(['bg1'])
    })
    expect(byKey(items, backgroundTaskKey('bg1')).status).toBe('paused')
    // 양성 짝 — 집합에 없으면 진행 중이다.
    const plain = taskBoardFromMessages(messages(backgroundTask('bg1', '탐색')), {
      stoppingBackgroundIds: new Set()
    })
    expect(byKey(plain, backgroundTaskKey('bg1')).status).toBe('in_progress')
  })

  it('중단 요청이 일시정지보다 우선한다 — 사용자가 이미 없애기로 했다', () => {
    const items = taskBoardFromMessages(messages(backgroundTask('bg1', '탐색')), {
      stoppingBackgroundIds: new Set(['bg1']),
      pausedBackgroundIds: new Set(['bg1'])
    })
    expect(byKey(items, backgroundTaskKey('bg1')).status).toBe('stopping')
  })

  it('AT-18 — paused 행은 중단 가능하다 (SDK 에 resume 이 없다 · D-022)', () => {
    expect(canStopBackgroundStatus('paused')).toBe(true)
    // 양성 짝 + 음성 짝 — 진행 중은 가능하고 중단 대기·종단은 불가능하다.
    expect(canStopBackgroundStatus('in_progress')).toBe(true)
    expect(canStopBackgroundStatus('stopping')).toBe(false)
    expect(canStopBackgroundStatus('completed')).toBe(false)
    expect(canStopBackgroundStatus('aborted')).toBe(false)
    expect(canStopBackgroundStatus('failed')).toBe(false)
    expect(canStopBackgroundStatus('pending')).toBe(false)
  })

  it('AT-23·24 — 전환은 foreground 진행 중일 때만 가능하다', () => {
    expect(canBackgroundStatus('in_progress', false)).toBe(true)
    // 이미 background 면 눌러도 SDK 가 false 를 준다 — 죽은 버튼을 만들지 않는다(D-021).
    expect(canBackgroundStatus('in_progress', true)).toBe(false)
    // 멈춘 태스크는 턴을 막고 있지 않다 — 옮길 기다림이 없다.
    expect(canBackgroundStatus('paused', false)).toBe(false)
    expect(canBackgroundStatus('stopping', false)).toBe(false)
    expect(canBackgroundStatus('completed', false)).toBe(false)
  })

  it('AT-24 — 런치 영수증이 관측된 항목에는 전환 술어가 거짓이다', () => {
    const launched = taskBoardFromMessages(messages(backgroundTask('bg1', '탐색', running)))
    expect(canBackgroundTask(byKey(launched, backgroundTaskKey('bg1')))).toBe(false)
    // 양성 짝 — 영수증이 없으면(=foreground 대기 중) 참이다.
    const foreground = taskBoardFromMessages(messages(backgroundTask('bg2', '탐색')))
    expect(canBackgroundTask(byKey(foreground, backgroundTaskKey('bg2')))).toBe(true)
  })

  it('SDK is_backgrounded 확정분·전환 in-flight 분도 같은 축으로 술어를 끈다', () => {
    const items = taskBoardFromMessages(messages(backgroundTask('bg1', '탐색')), {
      stoppingBackgroundIds: new Set(),
      backgroundedIds: new Set(['bg1'])
    })
    expect(canBackgroundTask(byKey(items, backgroundTaskKey('bg1')))).toBe(false)
  })

  it('agent 항목은 전환 대상이 아니다 — 실행 단위가 아니다', () => {
    const items = taskBoardFromMessages(
      messages(call('TaskCreate', { subject: '설계' }, created('1', '설계')))
    )
    expect(canBackgroundTask(byKey(items, agentTaskKey('1')))).toBe(false)
    expect(canStopTask(byKey(items, agentTaskKey('1')))).toBe(false)
  })
})
