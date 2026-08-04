// 0143 — listen phase 레벨 상태 + 백그라운드 완료 통지 파트의 reducer 계약.
import { describe, expect, it } from 'vitest'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'
import { messageSegments } from '../lib/parts'
import type { NormalizedEvent } from '../../../../../shared/ipc'
import { activitySnapshot as activity } from '../activity.testfixture'

const recv = (ev: NormalizedEvent): { type: 'RECV_EVENT'; event: NormalizedEvent } => ({
  type: 'RECV_EVENT',
  event: ev
})

const noticeSettled = (toolUseId = 'p1'): NormalizedEvent => ({
  type: 'subagent.task',
  sessionId: 's',
  toolUseId,
  phase: 'settled',
  status: 'completed',
  background: true,
  durationMs: 283_000,
  summary: '조사 완료'
})

describe('chatReducer — chat.activity 권위 스냅샷', () => {
  it('started 는 listening + 앵커를 세우고, ended 는 내린다', () => {
    let s = chatReducer(initialChatState, recv(activity(1, 'listening')))
    expect(s.listening).toBe(true)
    expect(s.listenStartedAt).not.toBeNull()
    const anchor = s.listenStartedAt
    // 중복 started 는 앵커를 갱신하지 않는다.
    s = chatReducer(s, recv(activity(1, 'listening')))
    expect(s.listenStartedAt).toBe(anchor)
    s = chatReducer(s, recv(activity(2, 'idle')))
    expect(s.listening).toBe(false)
    expect(s.listenStartedAt).toBeNull()
  })

  it('telemetry(TURN_END_RESET)는 listening 을 건드리지 않는다 — 대기 중 알림 턴 종료에도 애니메이션 유지', () => {
    let s = chatReducer(initialChatState, { type: 'BEGIN_TURN' })
    s = chatReducer(s, recv(activity(1, 'listening')))
    s = chatReducer(s, recv({ type: 'telemetry', sessionId: 's' } as NormalizedEvent))
    expect(s.inflight).toBe(false)
    expect(s.listening).toBe(true)
    expect(s.listenStartedAt).not.toBeNull()
  })

  it('CANCEL_CHAT 은 listening 을 낙관적으로 내린다', () => {
    let s = chatReducer(
      {
        ...initialChatState,
        error: { category: 'stream_error', message: 'late', retryable: false }
      },
      recv(activity(1, 'listening'))
    )
    s = chatReducer(s, { type: 'CANCEL_CHAT' })
    expect(s.listening).toBe(false)
    expect(s.listenStartedAt).toBeNull()
    expect(s.error).toBeUndefined()
  })

  it('NEW_CHAT/세션 로드는 초기 상태(false)로 재구축된다', () => {
    const s = chatReducer(chatReducer(initialChatState, recv(activity(1, 'listening'))), {
      type: 'NEW_CHAT'
    })
    expect(s.listening).toBe(false)
  })

  // ── 0167 AC6(잔여와 직교) 회귀 — verify r1 F1 이 잡은 결함. ──────────────────────────────
  it('**잔여가 남아 있어도 transport idle 이면 listening 을 켜지 않는다** (보고 ②-a 회귀)', () => {
    // 0154 는 orphaned 예약을 **의도적으로** 남긴다(늦은 echo 로 확정될 수 있으므로). 그 상태를
    // busy 로 읽으면 사용자가 다음 메시지를 보낼 때까지 애니메이션이 영원히 돈다.
    const s = chatReducer(
      initialChatState,
      recv(activity(1, 'idle', { deliveryPendingCount: 1, residualCount: 1, queuedCount: 2 }))
    )
    expect(s.listening).toBe(false)
    expect(s.listenStartedAt).toBeNull()
    // 사실 자체는 스냅샷 필드로 남아 라벨·Notice 가 쓴다.
    expect(s.activityResidualCount).toBe(1)
    expect(s.activityDeliveryPendingCount).toBe(1)
    expect(s.activityQueuedCount).toBe(2)
  })

  it('백그라운드 대기(transport listening)는 그대로 listening 이다 — 0143 불변', () => {
    const s = chatReducer(
      initialChatState,
      recv(activity(1, 'listening', { backgroundTaskCount: 2 }))
    )
    expect(s.listening).toBe(true)
    expect(s.activityBackgroundTaskCount).toBe(2)
  })

  // ── 0167 AC13(현행과 동일) 회귀 — inflight 소유권. ──────────────────────────────────────
  it('**라이브 스냅샷은 inflight 를 건드리지 않는다** — 턴 시작/종료는 renderer 소유', () => {
    let s = chatReducer(initialChatState, { type: 'BEGIN_TURN' })
    expect(s.inflight).toBe(true)
    // 준비/스트리밍 스냅샷이 뒤늦게 와도 로컬 판정을 덮어쓰지 않는다.
    s = chatReducer(s, recv(activity(1, 'idle', { foreground: 'streaming' })))
    expect(s.inflight).toBe(true)
    s = chatReducer(s, { type: 'CANCEL_CHAT' })
    expect(s.inflight).toBe(false)
    // 취소 후 도착한 더 높은 revision 의 'streaming' 스냅샷이 애니메이션을 되살리지 않는다.
    s = chatReducer(s, recv(activity(2, 'idle', { foreground: 'streaming' })))
    expect(s.inflight).toBe(false)
    expect(s.listening).toBe(false)
    // 라벨용 foreground 는 그대로 반영된다(표시 계층 입력).
    expect(s.activityForeground).toBe('streaming')
  })

  it('load 응답보다 최신 live revision이 먼저 도착하면 hydration이 되감지 않는다', () => {
    let s = chatReducer({ ...initialChatState, sessionId: 's' }, recv(activity(5, 'listening')))
    s = chatReducer(s, {
      type: 'LOAD_SESSION',
      session: {
        id: 's',
        backend: 'claude',
        title: null,
        messages: [],
        activity: activity(4, 'idle') as Extract<NormalizedEvent, { type: 'chat.activity' }>
      }
    })
    expect(s.activityRevision).toBe(5)
    expect(s.listening).toBe(true)
  })

  it('hydrate 는 로컬 진실이 없으므로 스냅샷으로 inflight·listening·counts 를 세운다 (AC10)', () => {
    const s = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        id: 's',
        backend: 'claude',
        title: null,
        messages: [],
        activity: activity(7, 'listening', {
          foreground: 'streaming',
          deliveryPendingCount: 2,
          residualCount: 1,
          backgroundTaskCount: 3
        }) as Extract<NormalizedEvent, { type: 'chat.activity' }>
      }
    })
    expect(s.activityRevision).toBe(7)
    expect(s.inflight).toBe(true) // 재접속 시점에는 BEGIN_TURN 이력이 없다
    expect(s.listening).toBe(true)
    expect(s.listenStartedAt).not.toBeNull()
    expect(s.activityDeliveryPendingCount).toBe(2)
    expect(s.activityResidualCount).toBe(1)
    expect(s.activityBackgroundTaskCount).toBe(3)
  })

  it('hydrate 스냅샷이 transport idle 이면 잔여가 있어도 listening 을 켜지 않는다', () => {
    const s = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        id: 's',
        backend: 'claude',
        title: null,
        messages: [],
        activity: activity(3, 'idle', {
          deliveryPendingCount: 1,
          residualCount: 1
        }) as Extract<NormalizedEvent, { type: 'chat.activity' }>
      }
    })
    expect(s.listening).toBe(false)
    expect(s.inflight).toBe(false)
    expect(s.activityResidualCount).toBe(1)
  })
})

describe('chatReducer — subagent_notice 커밋 (0143)', () => {
  it('settled + background:true 는 subagent_notice 파트로 물질화된다', () => {
    const s = chatReducer(initialChatState, recv(noticeSettled()))
    const parts = s.messages.flatMap((m) => m.parts)
    const notice = parts.find((p) => p.type === 'subagent_notice')
    expect(notice).toMatchObject({
      toolRunId: 'p1',
      status: 'completed',
      durationMs: 283_000,
      summary: '조사 완료'
    })
  })

  it('같은 toolRunId 의 중복 settled 는 파트를 1개만 남긴다(멱등)', () => {
    let s = chatReducer(initialChatState, recv(noticeSettled()))
    s = chatReducer(s, recv(noticeSettled()))
    const notices = s.messages.flatMap((m) => m.parts).filter((p) => p.type === 'subagent_notice')
    expect(notices).toHaveLength(1)
  })

  it('background 미부여 settled 는 파트를 만들지 않는다(사용자 직접 stop·foreground)', () => {
    const ev: NormalizedEvent = {
      type: 'subagent.task',
      sessionId: 's',
      toolUseId: 'p1',
      phase: 'settled',
      status: 'stopped'
    }
    const s = chatReducer(initialChatState, recv(ev))
    expect(s.messages.flatMap((m) => m.parts)).toHaveLength(0)
  })

  it('messageSegments 가 notice 를 독립 세그먼트로 분리한다(텍스트/도구 미병합)', () => {
    let s: ChatState = chatReducer(initialChatState, {
      type: 'RECV_EVENT',
      event: { type: 'message.completed', sessionId: 's', message: { text: '본문' } }
    })
    s = chatReducer(s, recv(noticeSettled()))
    const last = s.messages[s.messages.length - 1]
    const segs = messageSegments(last.parts)
    expect(segs.map((seg) => seg.kind)).toEqual(['text', 'subagent_notice'])
  })
})
