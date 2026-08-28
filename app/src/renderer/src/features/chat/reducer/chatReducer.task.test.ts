// 0204 — 작업 타일이 라이브 이벤트에서 목록을 만들 수 있는지의 reducer 계약.
//
// taskBoard 의 fold 테스트는 parts 를 직접 만들어 넣는다(재로드 경로와 동형). 여기서는 그
// parts 가 **라이브 이벤트로도 같은 모양으로 만들어지는지**를 본다 — 둘이 갈라지면 목록이
// 재로드 전까지 비어 보인다(AC18).
import { describe, expect, it } from 'vitest'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'
import { taskBoardFromMessages } from '../lib/taskBoard'
import type { NormalizedEvent } from '../../../../../shared/ipc'

const recv = (ev: NormalizedEvent): { type: 'RECV_EVENT'; event: NormalizedEvent } => ({
  type: 'RECV_EVENT',
  event: ev
})

const started = (toolRunId: string, toolName: string, args: unknown): NormalizedEvent => ({
  type: 'tool.call.started',
  sessionId: 's',
  toolRunId,
  toolName,
  args
})

const completed = (
  toolRunId: string,
  structuredOutput?: unknown,
  isError = false
): NormalizedEvent => ({
  type: 'tool.call.completed',
  sessionId: 's',
  toolRunId,
  result: 'wire text',
  isError,
  ...(structuredOutput !== undefined ? { structuredOutput } : {})
})

function apply(state: ChatState, events: NormalizedEvent[]): ChatState {
  return events.reduce((s, ev) => chatReducer(s, recv(ev)), state)
}

describe('chatReducer — TaskXXX 라이브 파트 (AC18)', () => {
  it('라이브 이벤트로 만든 파트만으로 작업 목록이 파생된다', () => {
    const s = apply(initialChatState, [
      started('t1', 'TaskCreate', { subject: '테스트 작성', description: 'API 테스트' }),
      completed('t1', { task: { id: '3', subject: '테스트 작성' } }),
      started('t2', 'TaskUpdate', { taskId: '3', status: 'in_progress' }),
      completed('t2', {
        success: true,
        taskId: '3',
        updatedFields: ['status'],
        statusChange: { from: 'pending', to: 'in_progress' }
      })
    ])

    const items = taskBoardFromMessages(s.messages)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: '3', title: '테스트 작성', status: 'in_progress' })
  })

  it('구조화 출력을 파트에 싣는다 — 라이브와 영속이 같은 필드를 갖는다', () => {
    const s = apply(initialChatState, [
      started('t1', 'TaskCreate', { subject: 'x' }),
      completed('t1', { task: { id: '1', subject: 'x' } })
    ])
    const part = s.messages.flatMap((m) => m.parts).find((p) => p.type === 'tool_result')
    expect(part).toMatchObject({ structuredOutput: { task: { id: '1', subject: 'x' } } })
  })
})

describe('chatReducer — 중단 대기 상태 (AC12·AC13·AC15)', () => {
  it('요청은 중단 대기에 넣고 이전 실패 사유를 지운다', () => {
    let s = chatReducer(initialChatState, { type: 'TASK_STOP_FAILED', toolUseId: 'a1' })
    // 실패는 `agent:` 가 아니라 background 네임스페이스의 키로 들어간다(유도값).
    expect(s.taskStopErrors['bg:a1']).toBeDefined()

    s = chatReducer(s, { type: 'TASK_STOP_REQUESTED', toolUseId: 'a1' })
    expect(s.stoppingTaskIds).toEqual(['a1'])
    expect(s.taskStopErrors['bg:a1']).toBeUndefined()
  })

  it('요청 실패는 대기를 풀고 사유를 남긴다 — 화면이 진행 중으로 복구된다', () => {
    let s = chatReducer(initialChatState, { type: 'TASK_STOP_REQUESTED', toolUseId: 'a1' })
    s = chatReducer(s, {
      type: 'TASK_STOP_FAILED',
      toolUseId: 'a1',
      detail: 'channel is not live'
    })
    expect(s.stoppingTaskIds).toEqual([])
    // 번역된 문장이 아니라 카탈로그 키 + 원문이 실린다 — 언어 전환이 표시 중인 문구를 따라온다.
    expect(s.taskStopErrors['bg:a1']).toEqual({
      messageKey: 'chat.taskTile.stopFailed',
      detail: 'channel is not live'
    })
  })

  it('부모 Task 결과가 도착하면 중단 대기가 풀린다 — 확정·watchdog·채널 사망 공통 경로', () => {
    let s = chatReducer(initialChatState, { type: 'TASK_STOP_REQUESTED', toolUseId: 'a1' })
    expect(s.stoppingTaskIds).toEqual(['a1'])
    s = chatReducer(s, recv(completed('a1', undefined, true)))
    expect(s.stoppingTaskIds).toEqual([])
  })

  it('다른 도구의 결과는 중단 대기를 건드리지 않는다', () => {
    let s = chatReducer(initialChatState, { type: 'TASK_STOP_REQUESTED', toolUseId: 'a1' })
    s = chatReducer(s, recv(completed('other')))
    expect(s.stoppingTaskIds).toEqual(['a1'])
  })
})

describe('chatReducer — 미확인 완료 배지 (AC19)', () => {
  it('TaskUpdate 의 completed 전이가 배지를 켠다', () => {
    const s = apply(initialChatState, [
      started('t1', 'TaskCreate', { subject: 'x' }),
      completed('t1', { task: { id: '1', subject: 'x' } }),
      started('t2', 'TaskUpdate', { taskId: '1', status: 'completed' }),
      completed('t2', {
        success: true,
        taskId: '1',
        updatedFields: ['status'],
        statusChange: { from: 'in_progress', to: 'completed' }
      })
    ])
    expect(s.unseenSettledTaskKeys).toEqual(['agent:1'])
  })

  it('진행 중 전이는 배지를 켜지 않는다', () => {
    const s = apply(initialChatState, [
      started('t1', 'TaskCreate', { subject: 'x' }),
      completed('t1', { task: { id: '1', subject: 'x' } }),
      started('t2', 'TaskUpdate', { taskId: '1', status: 'in_progress' }),
      completed('t2', {
        success: true,
        taskId: '1',
        updatedFields: ['status'],
        statusChange: { from: 'pending', to: 'in_progress' }
      })
    ])
    expect(s.unseenSettledTaskKeys).toEqual([])
  })

  it('background 완료 통지가 배지를 켜고, 타일을 열면 비운다', () => {
    let s = chatReducer(
      initialChatState,
      recv({
        type: 'subagent.task',
        sessionId: 's',
        toolUseId: 'a1',
        phase: 'settled',
        status: 'completed',
        background: true
      })
    )
    expect(s.unseenSettledTaskKeys).toEqual(['bg:a1'])
    s = chatReducer(s, { type: 'OPEN_TASK', key: 'bg:a1' })
    expect(s.unseenSettledTaskKeys).toEqual([])
    // 0205 — `작업` 타일이 정지된 동안은 선택만 서고 타일은 붙지 않는다. 정지 해제 시
    // 이 단언이 `toContain('task')` 로 돌아간다(0204 AT-30 의 원래 문장).
    expect(s.selectedTaskKey).toBe('bg:a1')
    expect(s.rightPanelTiles.flatMap((c) => c.tiles)).not.toContain('task')
  })

  it('사용자 중단(background 미부여)은 배지를 켜지 않는다 — 자기 행위는 소음', () => {
    const s = chatReducer(
      initialChatState,
      recv({
        type: 'subagent.task',
        sessionId: 's',
        toolUseId: 'a1',
        phase: 'settled',
        status: 'stopped'
      })
    )
    expect(s.unseenSettledTaskKeys).toEqual([])
  })
})

// 0204 ΔV1 AT-30 / §10 EP-12 — 두 타일의 선택 상태는 독립 필드 2개다.
//
// 하나로 합치면 한 타일을 닫을 때 다른 타일의 상세가 함께 접힌다. 네 방향을 모두 본다 —
// 선택 2방향 · 타일 제거 2방향.
describe('chatReducer — 두 타일의 선택 상태 독립 (AT-30)', () => {
  const bothSelected = (): ChatState => {
    let s = chatReducer(initialChatState, { type: 'OPEN_TASK', key: 'agent:1' })
    s = chatReducer(s, { type: 'OPEN_SUBAGENT_TASK', toolRunId: 'bg1' })
    return s
  }

  it('한 타일의 선택이 다른 타일의 선택을 바꾸지 않는다', () => {
    const s = bothSelected()
    expect(s.selectedTaskKey).toBe('agent:1')
    expect(s.selectedSubagentTaskId).toBe('bg1')

    // 작업 타일에서 목록으로 돌아가도 백그라운드 상세는 열려 있다.
    const backToTaskList = chatReducer(s, { type: 'SELECT_TASK', key: null })
    expect(backToTaskList.selectedTaskKey).toBeNull()
    expect(backToTaskList.selectedSubagentTaskId).toBe('bg1')

    // 반대 방향도 같다.
    const backToSubagentList = chatReducer(s, { type: 'SELECT_SUBAGENT_TASK', toolRunId: null })
    expect(backToSubagentList.selectedSubagentTaskId).toBeNull()
    expect(backToSubagentList.selectedTaskKey).toBe('agent:1')
  })

  it('타일을 닫으면 그 타일의 선택만 비워진다', () => {
    const s = bothSelected()

    const taskClosed = chatReducer(s, { type: 'REMOVE_RIGHT_PANEL_TILE', id: 'task' })
    expect(taskClosed.selectedTaskKey).toBeNull()
    expect(taskClosed.selectedSubagentTaskId).toBe('bg1')

    const subagentClosed = chatReducer(s, { type: 'REMOVE_RIGHT_PANEL_TILE', id: 'subagent' })
    expect(subagentClosed.selectedSubagentTaskId).toBeNull()
    expect(subagentClosed.selectedTaskKey).toBe('agent:1')
  })

  it('각 타일 열기는 자기 타일만 패널에 붙인다', () => {
    const taskOnly = chatReducer(initialChatState, { type: 'OPEN_TASK', key: 'agent:1' })
    const tiles = taskOnly.rightPanelTiles.flatMap((c) => c.tiles)
    // 0205 — `작업` 은 정지 중이라 자기 타일도 붙지 않는다. 선택 상태는 계속 선다.
    expect(taskOnly.selectedTaskKey).toBe('agent:1')
    expect(tiles).not.toContain('task')
    expect(tiles).not.toContain('subagent')

    const subagentOnly = chatReducer(initialChatState, {
      type: 'OPEN_SUBAGENT_TASK',
      toolRunId: 'bg1'
    })
    const tiles2 = subagentOnly.rightPanelTiles.flatMap((c) => c.tiles)
    expect(tiles2).toContain('subagent')
    expect(tiles2).not.toContain('task')
  })
})
