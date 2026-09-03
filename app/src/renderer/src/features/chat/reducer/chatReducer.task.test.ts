// 0204 — 작업 타일이 라이브 이벤트에서 목록을 만들 수 있는지의 reducer 계약.
//
// taskBoard 의 fold 테스트는 parts 를 직접 만들어 넣는다(재로드 경로와 동형). 여기서는 그
// parts 가 **라이브 이벤트로도 같은 모양으로 만들어지는지**를 본다 — 둘이 갈라지면 목록이
// 재로드 전까지 비어 보인다(AC18).
import { describe, expect, it } from 'vitest'
import { chatReducer, initialChatState, type ChatAction, type ChatState } from './chatReducer'
import { backgroundTaskKey, taskBoardFromMessages } from '../lib/taskBoard'
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

  it('0215 AT-18 — background 완료 통지는 배지를 켜지 않는다 (통지 파트는 그대로 남는다)', () => {
    const s = chatReducer(
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
    // `작업` 타일이 서브에이전트를 더는 보이지 않으므로 그 항목을 가리키는 배지도 없다(D-016).
    expect(s.unseenSettledTaskKeys).toEqual([])
    // 양성 짝 — 알림 경로가 0이 되지는 않는다. 완료 통지 파트는 계속 붙는다.
    expect(
      s.messages.flatMap((m) => m.parts).filter((p) => p.type === 'subagent_notice')
    ).toHaveLength(1)
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
    // 0213 — `작업` 이 자기 타일을 붙인다(0204 AT-30 복귀). **형제 타일은 붙지 않는다** —
    // 두 타일이 서로를 열지 않는 것이 D-015 의 요지다.
    expect(taskOnly.selectedTaskKey).toBe('agent:1')
    expect(tiles).toContain('task')
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

// ── 0212 — 기능 게이트 보존 · 라이브 상태 표식 (AT-04·18·19·26) ────────────────

describe('0212 — session.updated patch 병합 (AT-04 · §10 EP-02)', () => {
  const sessionUpdated = (patch: Record<string, unknown>): NormalizedEvent =>
    ({ type: 'session.updated', sessionId: 's', patch }) as NormalizedEvent

  it('init 의 tools·버전을 세션 상태에 싣는다', () => {
    const s = chatReducer(
      initialChatState,
      recv(sessionUpdated({ agentTools: ['TaskCreate'], cliVersion: '2.1.200', cwd: '/w' }))
    )
    expect(s.agentTools).toEqual(['TaskCreate'])
    expect(s.cliVersion).toBe('2.1.200')
  })

  it('AT-04 — 뒤이은 session.updated 가 기능 게이트를 지우지 않는다', () => {
    const first = chatReducer(
      initialChatState,
      recv(sessionUpdated({ agentTools: ['TaskCreate'], cliVersion: '2.1.200' }))
    )
    // model 만 든 두 번째 이벤트 — 누락은 무변경이다.
    const second = chatReducer(first, recv(sessionUpdated({ model: 'opus' })))
    expect(second.agentTools).toEqual(['TaskCreate'])
    expect(second.cliVersion).toBe('2.1.200')
  })

  it('판정 불가는 null 로 남는다 — tools 를 실지 않은 init 이 게이트를 만들지 않는다', () => {
    const s = chatReducer(initialChatState, recv(sessionUpdated({ cliVersion: '2.1.100' })))
    expect(s.agentTools).toBeNull()
    // 양성 짝 — 같은 이벤트의 버전은 실렸다.
    expect(s.cliVersion).toBe('2.1.100')
  })
})

describe('0212 — 라이브 상태 표식 (AT-18·19·26)', () => {
  const runState = (
    toolUseId: string,
    patch: { runState?: 'running' | 'paused'; isBackgrounded?: boolean }
  ): ChatAction => ({ type: 'SUBAGENT_RUN_STATE', toolUseId, ...patch })

  it('paused 는 집합에 들고 running 은 빠진다', () => {
    const paused = chatReducer(initialChatState, runState('a1', { runState: 'paused' }))
    expect(paused.pausedTaskIds).toEqual(['a1'])
    const resumed = chatReducer(paused, runState('a1', { runState: 'running' }))
    expect(resumed.pausedTaskIds).toEqual([])
  })

  it('같은 값이 다시 오면 배열 identity 를 유지한다 — 파생 메모가 죽지 않는다', () => {
    const paused = chatReducer(initialChatState, runState('a1', { runState: 'paused' }))
    const again = chatReducer(paused, runState('a1', { runState: 'paused' }))
    expect(again.pausedTaskIds).toBe(paused.pausedTaskIds)
    expect(again).toBe(paused)
  })

  it('is_backgrounded 는 두 방향 모두 반영한다', () => {
    const on = chatReducer(initialChatState, runState('a1', { isBackgrounded: true }))
    expect(on.backgroundedTaskIds).toEqual(['a1'])
    const off = chatReducer(on, runState('a1', { isBackgrounded: false }))
    expect(off.backgroundedTaskIds).toEqual([])
  })

  it('전환 요청은 낙관 표식을 남기고 실패는 그것을 되돌린다 (AT-26)', () => {
    const requested = chatReducer(initialChatState, {
      type: 'TASK_BACKGROUND_REQUESTED',
      toolUseId: 'a1'
    })
    expect(requested.backgroundingTaskIds).toEqual(['a1'])
    expect(requested.taskStopErrors).toEqual({})

    const failed = chatReducer(requested, {
      type: 'TASK_BACKGROUND_FAILED',
      toolUseId: 'a1',
      detail: 'no foreground task'
    })
    // 버튼이 되살아나고(표식 제거) 사유가 그 행에 붙는다 — "아무 일도 안 일어남" 이 아니다.
    expect(failed.backgroundingTaskIds).toEqual([])
    expect(failed.taskStopErrors[backgroundTaskKey('a1')]).toEqual({
      messageKey: 'chat.taskTile.backgroundFailed',
      detail: 'no foreground task'
    })
  })

  it('재요청은 앞선 실패 사유를 지운다 — 오래된 사유가 남지 않는다', () => {
    const failed = chatReducer(
      chatReducer(initialChatState, { type: 'TASK_BACKGROUND_REQUESTED', toolUseId: 'a1' }),
      { type: 'TASK_BACKGROUND_FAILED', toolUseId: 'a1', detail: 'x' }
    )
    const retried = chatReducer(failed, { type: 'TASK_BACKGROUND_REQUESTED', toolUseId: 'a1' })
    expect(retried.taskStopErrors[backgroundTaskKey('a1')]).toBeUndefined()
  })

  it('정착(부모 Task 권위 결과)이 오면 라이브 표식이 함께 끝난다', () => {
    const live: ChatState = {
      ...initialChatState,
      pausedTaskIds: ['a1'],
      backgroundingTaskIds: ['a1']
    }
    const settled = chatReducer(
      live,
      recv({
        type: 'tool.call.completed',
        sessionId: 's',
        toolRunId: 'a1',
        result: { reason: 'aborted' },
        isError: true
      })
    )
    expect(settled.pausedTaskIds).toEqual([])
    expect(settled.backgroundingTaskIds).toEqual([])
  })
})
