// 0143 — listen 대기 UX 의 store 계약: busy 라우팅(steer 예약), 자식 이벤트 BEGIN_TURN 제외,
// 백그라운드 완료 통지 dispatch. 하네스는 chatStore.testHarness 공용(0149).
import { beforeEach, describe, expect, it } from 'vitest'
import { chatActions, ingestChatEvent, sessionBusy, useChatStore } from './chatStore'
import {
  flushRaf,
  harnessSession as session,
  installChatStoreHarness
} from './chatStore.testHarness'
import type { NormalizedEvent } from '../../../../../shared/ipc'

let chatSend: ReturnType<typeof installChatStoreHarness>['chatSend']

const activity = (
  revision: number,
  transport: 'idle' | 'listening',
  patch: Partial<Extract<NormalizedEvent, { type: 'chat.activity' }>> = {}
): NormalizedEvent => ({
  type: 'chat.activity',
  sessionId: 's',
  revision,
  foreground: 'idle',
  transport,
  busy: transport === 'listening',
  queuedCount: 0,
  deliveryPendingCount: 0,
  residualCount: 0,
  backgroundTaskCount: transport === 'listening' ? 1 : 0,
  ...patch
})

beforeEach(() => {
  ;({ chatSend } = installChatStoreHarness())
})

describe('chatStore — chat.activity 라우팅', () => {
  it('transport 스냅샷이 listening 상태를 굴린다', () => {
    ingestChatEvent(activity(1, 'listening'))
    flushRaf()
    expect(session().listening).toBe(true)
    ingestChatEvent(activity(2, 'idle'))
    flushRaf()
    expect(session().listening).toBe(false)
  })

  it('listening 중 send 는 steer 예약(pendingSteer) — 낙관 커밋/BEGIN_TURN 없음', () => {
    ingestChatEvent(activity(1, 'listening'))
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

  // 0167 AC13 — "sessionBusy 정의 불변" 은 문자열이 아니라 **동작**으로 고정한다.
  it('**잔여만 남은 idle 스냅샷은 busy 를 만들지 않는다** — 애니메이션·중단버튼이 유휴로 돌아간다', () => {
    ingestChatEvent(activity(1, 'listening'))
    flushRaf()
    expect(sessionBusy(session())).toBe(true)
    // 체인이 끝나고 orphaned 예약만 남은 상태(0154 가 의도적으로 유지하는 상태).
    ingestChatEvent(activity(2, 'idle', { busy: true, deliveryPendingCount: 1, residualCount: 1 }))
    flushRaf()
    expect(session().listening).toBe(false)
    expect(session().inflight).toBe(false)
    expect(sessionBusy(session())).toBe(false)
    // 잔여 수는 그대로 노출돼 Composer 의 '세션 전체 중단' 안내가 뜬다.
    expect(session().activityResidualCount).toBe(1)
  })

  it('잔여만 남은 상태의 send 는 그래도 예약 경로다 — 0153 의 pendingCount 규칙 유지', () => {
    ingestChatEvent(activity(1, 'listening'))
    flushRaf()
    chatActions.send('잔여 유발')
    ingestChatEvent(activity(2, 'idle', { busy: true, deliveryPendingCount: 1, residualCount: 1 }))
    flushRaf()
    expect(sessionBusy(session())).toBe(false)

    const ok = chatActions.send('그 다음')
    expect(ok).toBe(true)
    const st = useChatStore.getState().sessions.s
    // busy 가 아니어도 미확정 예약이 있으므로 낙관 커밋하지 않는다(순서 역전 방지).
    expect(st.session.messages).toHaveLength(0)
    expect(st.pendingSteer?.map((p) => p.text)).toEqual(['잔여 유발', '그 다음'])
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

// 0153 — 실기 로그(세션 5a47b0c7)에서 관측된 순서 역전의 재현. `telemetry` 로 renderer 가 턴을
// 닫은 직후, main 은 held 배치로 연속 턴을 여는데(flush 스텝) 그 신호가 renderer 에 없어 idle 로
// 오판했다. 그 창의 send 가 낙관 커밋 경로를 타 **잔여보다 앞에** 정식 버블로 섰고, DB 는 반대
// 순서(main 커밋 순서 = idx)라 재시작하면 위치가 재조정된 것처럼 보였다.
describe('chatStore — 턴 경계 낙관 커밋 금지 (0153)', () => {
  it('telemetry 직후에도 미확정 예약이 있으면 send 는 예약 경로 — 순서 역전 없음', () => {
    // 진행 턴 중 steer 3건 예약(666·777·888 상당).
    ingestChatEvent(activity(1, 'listening'))
    flushRaf()
    chatActions.send('666')
    chatActions.send('777')
    chatActions.send('888')
    // 직전 턴이 끝나 renderer 의 inflight/listening 이 모두 내려간 창.
    ingestChatEvent(activity(2, 'idle'))
    ingestChatEvent({ type: 'telemetry', sessionId: 's', usage: {} } as NormalizedEvent)
    flushRaf()
    expect(session().inflight).toBe(false)
    expect(session().listening).toBe(false)

    // 이 창에서 새 메시지(999 상당) — 낙관 커밋이면 잔여보다 앞에 서게 된다.
    const ok = chatActions.send('999')
    expect(ok).toBe(true)

    const st = useChatStore.getState().sessions.s
    expect(st.session.messages).toHaveLength(0) // 낙관 커밋 없음
    expect(st.session.inflight).toBe(false) // BEGIN_TURN 없음
    expect(st.pendingSteer?.map((p) => p.text)).toEqual(['666', '777', '888', '999'])
  })

  it('예약이 모두 커밋된 뒤의 유휴 send 는 종전대로 낙관 커밋', () => {
    ingestChatEvent(activity(1, 'listening'))
    flushRaf()
    chatActions.send('잔여')
    const pendingId = useChatStore.getState().sessions.s.pendingSteer![0].id
    ingestChatEvent(activity(2, 'idle'))
    ingestChatEvent({
      type: 'message.committed',
      sessionId: 's',
      ids: [pendingId],
      text: '잔여',
      messageId: 1,
      createdAt: 1
    } as NormalizedEvent)
    flushRaf()
    expect(useChatStore.getState().sessions.s.pendingSteer ?? []).toHaveLength(0)

    chatActions.send('새 턴')
    const st = useChatStore.getState().sessions.s
    expect(st.session.inflight).toBe(true)
    expect(st.session.messages.at(-1)?.role).toBe('user')
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
