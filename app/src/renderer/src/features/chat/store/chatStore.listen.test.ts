// 0143 — listen 대기 UX 의 store 계약: busy 라우팅(steer 예약), 자식 이벤트 BEGIN_TURN 제외,
// 백그라운드 완료 통지 dispatch. 하네스는 chatStore.testHarness 공용(0149).
import { beforeEach, describe, expect, it } from 'vitest'
import { chatActions, ingestChatEvent, useChatStore } from './chatStore'
import {
  flushRaf,
  harnessSession as session,
  installChatStoreHarness
} from './chatStore.testHarness'
import type { NormalizedEvent } from '../../../../../shared/ipc'

let chatSend: ReturnType<typeof installChatStoreHarness>['chatSend']

beforeEach(() => {
  ;({ chatSend } = installChatStoreHarness())
})

describe('chatStore — chat.listen 라우팅 (0143)', () => {
  it('chat.listen started/ended 가 listening 상태를 굴린다', () => {
    ingestChatEvent({ type: 'chat.listen', sessionId: 's', phase: 'started' })
    flushRaf()
    expect(session().listening).toBe(true)
    ingestChatEvent({ type: 'chat.listen', sessionId: 's', phase: 'ended' })
    flushRaf()
    expect(session().listening).toBe(false)
  })

  it('listening 중 send 는 steer 예약(pendingSteer) — 낙관 커밋/BEGIN_TURN 없음', () => {
    ingestChatEvent({ type: 'chat.listen', sessionId: 's', phase: 'started' })
    flushRaf()
    const ok = chatActions.send('대기 중 질문')
    expect(ok).toBe(true)
    expect(chatSend).toHaveBeenCalledTimes(1)
    const st = useChatStore.getState().sessions.s
    expect(st.pendingSteer).toHaveLength(1)
    expect(st.pendingSteer?.[0].text).toBe('대기 중 질문')
    expect(st.session.inflight).toBe(false) // BEGIN_TURN 미발생
    expect(st.session.messages).toHaveLength(0) // 낙관 커밋 없음(이중 렌더 방지)
  })

  it('유휴(비-listening) send 는 종전대로 턴을 연다', () => {
    const ok = chatActions.send('일반 전송')
    expect(ok).toBe(true)
    const st = useChatStore.getState().sessions.s
    expect(st.session.inflight).toBe(true)
    expect(st.session.messages).toHaveLength(1)
    expect(st.pendingSteer ?? []).toHaveLength(0)
  })
})

describe('chatStore — 자동 BEGIN_TURN 자식 이벤트 제외 (0143)', () => {
  const childTool: NormalizedEvent = {
    type: 'tool.call.started',
    sessionId: 's',
    toolRunId: 'c1',
    toolName: 'Bash',
    args: {},
    parentToolRunId: 'p1'
  }
  const topTool: NormalizedEvent = {
    type: 'tool.call.started',
    sessionId: 's',
    toolRunId: 't1',
    toolName: 'Bash',
    args: {}
  }

  it('parentToolRunId 실린 활동 이벤트는 유휴 세션의 inflight 를 켜지 않는다', () => {
    ingestChatEvent(childTool)
    flushRaf()
    expect(session().inflight).toBe(false)
  })

  it('최상위 활동 이벤트는 종전대로 BEGIN_TURN 을 유발한다(자동 연속 턴)', () => {
    ingestChatEvent(topTool)
    flushRaf()
    expect(session().inflight).toBe(true)
  })

  // 0149 — 델타는 코얼레서 배치 경로로 흐른다. 그 경로가 receive 의 라우팅/BEGIN_TURN 규칙을
  // 따로 구현하는 바람에 0143 의 child 제외가 델타에는 적용되지 않았다(백그라운드 서브에이전트
  // 스트리밍이 listen 대기 중 메인 inflight 를 점멸시켰다). 두 경로가 같은 술어를 쓴다.
  it('parentToolRunId 실린 델타도 유휴 세션의 inflight 를 켜지 않는다', () => {
    ingestChatEvent({
      type: 'message.delta',
      sessionId: 's',
      delta: { text: '백그라운드 출력' },
      parentToolRunId: 'p1'
    } as NormalizedEvent)
    flushRaf()
    expect(session().inflight).toBe(false)
  })

  it('최상위 델타는 BEGIN_TURN 을 유발한다', () => {
    ingestChatEvent({
      type: 'message.delta',
      sessionId: 's',
      delta: { text: '메인 출력' }
    } as NormalizedEvent)
    flushRaf()
    expect(session().inflight).toBe(true)
  })
})

describe('chatStore — 백그라운드 완료 통지 dispatch (0143)', () => {
  it('settled + background:true 는 메타 병합과 함께 notice 파트를 커밋한다', () => {
    ingestChatEvent({
      type: 'subagent.task',
      sessionId: 's',
      toolUseId: 'p1',
      phase: 'settled',
      status: 'completed',
      background: true,
      durationMs: 1000
    })
    flushRaf()
    const st = useChatStore.getState().sessions.s
    expect(st.subagentMeta.p1?.status).toBe('completed')
    const notices = st.session.messages
      .flatMap((m) => m.parts)
      .filter((p) => p.type === 'subagent_notice')
    expect(notices).toHaveLength(1)
  })

  it('background 미부여 settled 는 메타만 갱신하고 파트를 만들지 않는다', () => {
    ingestChatEvent({
      type: 'subagent.task',
      sessionId: 's',
      toolUseId: 'p1',
      phase: 'settled',
      status: 'stopped'
    })
    flushRaf()
    const st = useChatStore.getState().sessions.s
    expect(st.subagentMeta.p1?.status).toBe('stopped')
    expect(st.session.messages).toHaveLength(0)
  })
})
