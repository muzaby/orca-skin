import { describe, expect, it } from 'vitest'
import { isTaskToolName, readTaskToolObservation, TASK_TOOL_NAMES } from './task-tool'

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
            blockedBy: []
          }
        },
        { taskId: '1' }
      )
    ).toEqual({
      kind: 'upserted',
      id: '1',
      patch: {
        subject: 'API 수정',
        description: '핸들러 정리',
        status: 'in_progress',
        blocks: ['2'],
        blockedBy: []
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
