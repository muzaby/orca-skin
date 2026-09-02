import { describe, expect, it } from 'vitest'
import {
  isTaskListToolName,
  isTaskToolName,
  readTaskToolObservation,
  TASK_LIST_TOOL_NAMES,
  TASK_TOOL_NAMES
} from './task-tool'

const read = (
  toolName: string,
  structuredOutput: unknown,
  args: unknown = {},
  isError = false
): ReturnType<typeof readTaskToolObservation> =>
  readTaskToolObservation({ toolName, args, structuredOutput, isError })

describe('isTaskToolName', () => {
  it('6종 도구를 인식하고 다른 도구는 배제한다', () => {
    expect(TASK_TOOL_NAMES).toHaveLength(6)
    for (const name of TASK_TOOL_NAMES) expect(isTaskToolName(name)).toBe(true)
    for (const other of ['Task', 'Agent', 'Bash', 'TodoWrite', 'Read']) {
      expect(isTaskToolName(other)).toBe(false)
    }
  })
})

describe('readTaskToolObservation — TaskCreate', () => {
  it('성공 결과에서 id·subject·description 을 읽고 pending 으로 만든다', () => {
    const obs = read(
      'TaskCreate',
      { task: { id: '3', subject: '테스트 작성' } },
      { subject: '테스트 작성', description: 'API 테스트 추가' }
    )
    expect(obs).toEqual({
      kind: 'created',
      id: '3',
      patch: { status: 'pending', subject: '테스트 작성', description: 'API 테스트 추가' }
    })
  })

  it('isError 면 관측이 없다 — 실패한 생성은 목록을 바꾸지 않는다', () => {
    expect(read('TaskCreate', { task: { id: '3', subject: 's' } }, {}, true)).toBeNull()
  })

  it('구조화 출력이 없거나 id 가 없으면 관측이 없다', () => {
    expect(read('TaskCreate', undefined, { subject: 's' })).toBeNull()
    expect(read('TaskCreate', { task: {} }, { subject: 's' })).toBeNull()
    expect(read('TaskCreate', 'created task 3', { subject: 's' })).toBeNull()
  })
})

describe('readTaskToolObservation — TaskUpdate', () => {
  it('statusChange.to 를 상태의 권위로 읽는다', () => {
    expect(
      read(
        'TaskUpdate',
        {
          success: true,
          taskId: '3',
          updatedFields: ['status'],
          statusChange: { from: 'pending', to: 'in_progress' }
        },
        { taskId: '3', status: 'in_progress' }
      )
    ).toEqual({ kind: 'upserted', id: '3', patch: { status: 'in_progress' } })
  })

  it('statusChange 가 없으면 입력 status 로 폴백한다', () => {
    expect(
      read(
        'TaskUpdate',
        { success: true, taskId: '3', updatedFields: ['status'] },
        { taskId: '3', status: 'completed' }
      )
    ).toEqual({ kind: 'upserted', id: '3', patch: { status: 'completed' } })
  })

  it('subject/description 변경은 updatedFields 에 있을 때만 반영한다', () => {
    expect(
      read(
        'TaskUpdate',
        { success: true, taskId: '3', updatedFields: ['subject'] },
        { taskId: '3', subject: '새 제목', description: '무시될 설명' }
      )
    ).toEqual({ kind: 'upserted', id: '3', patch: { subject: '새 제목' } })
  })

  it('deleted 는 제거 관측이다', () => {
    expect(
      read(
        'TaskUpdate',
        { success: true, taskId: '3', updatedFields: ['status'] },
        { taskId: '3', status: 'deleted' }
      )
    ).toEqual({ kind: 'removed', id: '3' })
  })

  it('success 가 true 가 아니면 관측이 없다 (미지정 포함 — fail-closed)', () => {
    expect(
      read(
        'TaskUpdate',
        { success: false, taskId: '3', error: 'nope' },
        { taskId: '3', status: 'completed' }
      )
    ).toBeNull()
    expect(read('TaskUpdate', { taskId: '3' }, { taskId: '3', status: 'completed' })).toBeNull()
  })

  it('바뀐 필드가 하나도 안 잡히면 빈 upsert 로 항목을 만들지 않는다', () => {
    expect(
      read('TaskUpdate', { success: true, taskId: '9', updatedFields: ['owner'] }, { taskId: '9' })
    ).toBeNull()
  })
})

describe('readTaskToolObservation — TaskGet', () => {
  it('task 를 그대로 upsert 한다', () => {
    expect(
      read(
        'TaskGet',
        {
          task: {
            id: '1',
            subject: 'API 수정',
            description: '핸들러 정리',
            status: 'in_progress',
            blocks: ['2'],
            blockedBy: ['9']
          }
        },
        { taskId: '1' }
      )
      // AT-34③ — `blocks` 는 patch 에 실리지 않는다(D-028: TaskList 가 보정할 수 없다).
      // 양성 짝: 같은 출력의 `blockedBy` 는 실린다 — 파서가 통째로 죽어도 참이 되는 형태가 아니다.
    ).toEqual({
      kind: 'upserted',
      id: '1',
      patch: {
        subject: 'API 수정',
        description: '핸들러 정리',
        status: 'in_progress',
        blockedBy: ['9']
      }
    })
  })

  it('task: null 은 그 id 의 제거다', () => {
    expect(read('TaskGet', { task: null }, { taskId: '7' })).toEqual({ kind: 'removed', id: '7' })
  })
})

describe('readTaskToolObservation — TaskList', () => {
  it('전체 스냅샷을 낸다', () => {
    expect(
      read('TaskList', {
        tasks: [
          { id: '1', subject: 'a', status: 'completed', blockedBy: [] },
          { id: '2', subject: 'b', status: 'in_progress', blockedBy: ['1'] }
        ]
      })
    ).toEqual({
      kind: 'snapshot',
      tasks: [
        { id: '1', patch: { subject: 'a', status: 'completed', blockedBy: [] } },
        { id: '2', patch: { subject: 'b', status: 'in_progress', blockedBy: ['1'] } }
      ]
    })
  })

  it('빈 목록도 스냅샷이다 — 전부 지우라는 뜻이다', () => {
    expect(read('TaskList', { tasks: [] })).toEqual({ kind: 'snapshot', tasks: [] })
  })

  it('형태가 어긋나면 관측이 없다', () => {
    expect(read('TaskList', { tasks: 'none' })).toBeNull()
  })
})

describe('readTaskToolObservation — 관측 대상이 아닌 도구', () => {
  it('TaskOutput·TaskStop 은 목록을 바꾸지 않는다 (0204 D-010)', () => {
    expect(read('TaskOutput', { output: 'done', status: 'completed' }, { task_id: 'x' })).toBeNull()
    expect(read('TaskStop', { message: 'stopped', task_id: 'x', task_type: 'bash' })).toBeNull()
  })

  it('Task 도구가 아닌 이름도 관측이 없다', () => {
    expect(read('TodoWrite', { todos: [] })).toBeNull()
  })
})

// ── 0212 — SDK 표면 결손 6건 중 파서 축(MD-01) ─────────────────────────────────

describe('0212 — activeForm (AT-05·AT-09 · §10 EP-03)', () => {
  it('AT-09 — TaskCreate 의 activeForm 을 patch 에 싣는다', () => {
    const obs = read(
      'TaskCreate',
      { task: { id: '3', subject: '테스트 작성' } },
      { subject: '테스트 작성', description: 'API 테스트 추가', activeForm: '테스트 작성 중' }
    )
    expect(obs).toEqual({
      kind: 'created',
      id: '3',
      patch: {
        status: 'pending',
        subject: '테스트 작성',
        description: 'API 테스트 추가',
        activeForm: '테스트 작성 중'
      }
    })
  })

  it('AT-09 — active_form 별칭도 읽는다 (스트림 입력은 정규화 전이다 · spec §2.5)', () => {
    const obs = read(
      'TaskUpdate',
      { success: true, taskId: '1', updatedFields: ['status'] },
      { taskId: '1', status: 'in_progress', active_form: '테스트 실행 중' }
    )
    expect(obs).toMatchObject({ kind: 'upserted', id: '1' })
    expect(obs && 'patch' in obs ? obs.patch.activeForm : null).toBe('테스트 실행 중')
  })

  it('activeForm 은 updatedFields 게이트를 지나지 않는다 — 출력에 그 필드가 없다', () => {
    // `updatedFields` 가 activeForm 을 안 실어도 입력에 왔다면 그것이 이번 호출의 지시다.
    const obs = read(
      'TaskUpdate',
      { success: true, taskId: '1', updatedFields: ['status'] },
      { taskId: '1', status: 'in_progress', activeForm: '실행 중' }
    )
    expect(obs && 'patch' in obs ? obs.patch.activeForm : null).toBe('실행 중')
  })

  it('activeForm 만 든 갱신도 관측이 된다 — 빈 patch 로 접히지 않는다', () => {
    const obs = read(
      'TaskUpdate',
      { success: true, taskId: '1', updatedFields: [] },
      { taskId: '1', activeForm: '실행 중' }
    )
    expect(obs).toEqual({ kind: 'upserted', id: '1', patch: { activeForm: '실행 중' } })
  })
})

describe('0212 — addBlocks (AT-10 · §10 EP-04)', () => {
  it('addBlocks 를 patch 에 싣는다 — 방향 해석은 소비자(fold) 몫이다', () => {
    const obs = read(
      'TaskUpdate',
      { success: true, taskId: '1', updatedFields: ['blocks'] },
      { taskId: '1', addBlocks: ['2', '3'] }
    )
    expect(obs).toEqual({ kind: 'upserted', id: '1', patch: { addBlocks: ['2', '3'] } })
  })

  it('updatedFields 가 addBlocks 라는 이름을 실어도 읽는다 (SDK 가 어느 이름을 쓰는지 미문서)', () => {
    const obs = read(
      'TaskUpdate',
      { success: true, taskId: '1', updatedFields: ['addBlocks'] },
      { taskId: '1', addBlocks: ['2'] }
    )
    expect(obs && 'patch' in obs ? obs.patch.addBlocks : null).toEqual(['2'])
  })

  it('빈 addBlocks 는 관측을 만들지 않는다 — 바뀔 간선이 없다', () => {
    expect(
      read(
        'TaskUpdate',
        { success: true, taskId: '1', updatedFields: ['blocks'] },
        { taskId: '1', addBlocks: [] }
      )
    ).toBeNull()
  })
})

describe('0212 — 이름 부분집합 (D-025 · §10 EP-11)', () => {
  it('할 일 목록 4종만 부분집합이고 TaskOutput/TaskStop 은 아니다', () => {
    expect(TASK_LIST_TOOL_NAMES).toHaveLength(4)
    for (const name of TASK_LIST_TOOL_NAMES) {
      expect(isTaskListToolName(name)).toBe(true)
      // 부분집합은 전체 집합에 포함된다 — 두 배열이 갈라지면 여기서 red 다.
      expect(isTaskToolName(name)).toBe(true)
    }
    for (const other of ['TaskOutput', 'TaskStop', 'Task', 'Agent', 'Bash']) {
      expect(isTaskListToolName(other)).toBe(false)
    }
    // 양성 짝 — 두 이름은 전체 집합에는 여전히 있다(관측 대상이라서).
    expect(isTaskToolName('TaskOutput')).toBe(true)
    expect(isTaskToolName('TaskStop')).toBe(true)
  })
})
