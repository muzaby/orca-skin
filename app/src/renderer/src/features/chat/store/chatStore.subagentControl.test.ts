// 0212 — 서브에이전트 단위 제어 두 축이 **IPC 까지 실제로 나가는지**(AT-25·26 · §10 EP-14).
//
// 술어(`taskBoard.test.ts`)와 버튼 렌더(`taskSurface0212.render.test.ts`)가 각자 자기 축을
// 잠그지만 그 사이의 요청 조립은 어느 쪽도 보지 않는다. 인자를 흘리면 **다른 태스크가**
// 백그라운드로 가고, 실패를 삼키면 화면이 "아무 일도 안 일어남" 이 된다.
//
// 단언은 "호출됐다" 가 아니라 **"그 toolUseId 로 1회"** 다 — 호출 여부만 보면 아무 id 나 보내도
// 통과한다.

import { beforeEach, describe, expect, it } from 'vitest'
import { chatActions, useChatStore } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'
import { backgroundTaskKey } from '../lib/taskBoard'

let harness: ReturnType<typeof installChatStoreHarness>

const activeSession = (): ReturnType<typeof useChatStore.getState>['sessions'][string]['session'] =>
  useChatStore.getState().sessions[useChatStore.getState().activeKey].session

beforeEach(() => {
  harness = installChatStoreHarness()
})

describe('0212 — foreground → background 전환 요청 (AT-25)', () => {
  it('그 toolUseId 로 정확히 1회 요청한다', async () => {
    chatActions.backgroundTask('use1')
    expect(harness.backgroundSubagent).toHaveBeenCalledTimes(1)
    expect(harness.backgroundSubagent).toHaveBeenCalledWith('s', 'use1')
    await Promise.resolve()
  })

  it('요청 즉시 낙관 표식을 남긴다 — 버튼이 사라져 중복 클릭이 막힌다', () => {
    chatActions.backgroundTask('use1')
    expect(activeSession().backgroundingTaskIds).toEqual(['use1'])
  })

  it('세션 id 가 없으면 요청하지 않는다 — 보낼 좌표가 없다', () => {
    useChatStore.setState((s) => {
      const entry = s.sessions[s.activeKey]
      return {
        sessions: {
          ...s.sessions,
          [s.activeKey]: { ...entry, session: { ...entry.session, sessionId: null } }
        }
      }
    })
    chatActions.backgroundTask('use1')
    expect(harness.backgroundSubagent).not.toHaveBeenCalled()
    // 양성 짝 — 표식도 남기지 않는다(요청이 없었으므로 되돌릴 것도 없다).
    expect(activeSession().backgroundingTaskIds).toEqual([])
  })

  it('중단과 다른 채널로 나간다 — 두 제어가 섞이지 않는다', () => {
    chatActions.backgroundTask('use1')
    expect(harness.stopSubagent).not.toHaveBeenCalled()
    chatActions.stopTask('use2')
    expect(harness.stopSubagent).toHaveBeenCalledWith('s', 'use2')
    // 양성 짝 — 전환 요청은 그대로 1회다(같은 함수를 두 번 부르지 않았다).
    expect(harness.backgroundSubagent).toHaveBeenCalledTimes(1)
  })
})

describe('0212 — 전환 실패 복구 (AT-26 · §10 EP-14)', () => {
  it('reject 하면 표식을 되돌리고 사유를 그 행에 남긴다', async () => {
    harness.backgroundSubagent.mockRejectedValueOnce(
      new Error('subagent-background: no foreground task for this tool use')
    )
    chatActions.backgroundTask('use1')
    // 요청 직후에는 표식이 있다 — 실패가 그것을 되돌리는지 본다.
    expect(activeSession().backgroundingTaskIds).toEqual(['use1'])
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(activeSession().backgroundingTaskIds).toEqual([])
    expect(activeSession().taskStopErrors[backgroundTaskKey('use1')]).toEqual({
      messageKey: 'chat.taskTile.backgroundFailed',
      detail: 'subagent-background: no foreground task for this tool use'
    })
  })

  it('성공하면 사유를 만들지 않는다 — 음성 단언의 양성 짝', async () => {
    chatActions.backgroundTask('use1')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(activeSession().taskStopErrors[backgroundTaskKey('use1')]).toBeUndefined()
    // 성공은 표식을 되돌리지 않는다 — 런치 영수증 관측이 버튼을 영구히 없앤다.
    expect(activeSession().backgroundingTaskIds).toEqual(['use1'])
  })
})
