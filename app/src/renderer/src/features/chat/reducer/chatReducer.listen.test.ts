// 0143 — listen phase 레벨 상태 + 백그라운드 완료 통지 파트의 reducer 계약.
import { describe, expect, it } from 'vitest'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'
import { messageSegments } from '../lib/parts'
import type { NormalizedEvent } from '../../../../../shared/ipc'

const recv = (ev: NormalizedEvent): { type: 'RECV_EVENT'; event: NormalizedEvent } => ({
  type: 'RECV_EVENT',
  event: ev
})

const listenStarted: NormalizedEvent = { type: 'chat.listen', sessionId: 's', phase: 'started' }
const listenEnded: NormalizedEvent = { type: 'chat.listen', sessionId: 's', phase: 'ended' }
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

describe('chatReducer — chat.listen (0143)', () => {
  it('started 는 listening + 앵커를 세우고, ended 는 내린다', () => {
    let s = chatReducer(initialChatState, recv(listenStarted))
    expect(s.listening).toBe(true)
    expect(s.listenStartedAt).not.toBeNull()
    const anchor = s.listenStartedAt
    // 중복 started 는 앵커를 갱신하지 않는다.
    s = chatReducer(s, recv(listenStarted))
    expect(s.listenStartedAt).toBe(anchor)
    s = chatReducer(s, recv(listenEnded))
    expect(s.listening).toBe(false)
    expect(s.listenStartedAt).toBeNull()
  })

  it('telemetry(TURN_END_RESET)는 listening 을 건드리지 않는다 — 대기 중 알림 턴 종료에도 애니메이션 유지', () => {
    let s = chatReducer(initialChatState, { type: 'BEGIN_TURN' })
    s = chatReducer(s, recv(listenStarted))
    s = chatReducer(s, recv({ type: 'telemetry', sessionId: 's' } as NormalizedEvent))
    expect(s.inflight).toBe(false)
    expect(s.listening).toBe(true)
    expect(s.listenStartedAt).not.toBeNull()
  })

  it('CANCEL_CHAT 은 listening 을 낙관적으로 내린다', () => {
    let s = chatReducer(initialChatState, recv(listenStarted))
    s = chatReducer(s, { type: 'CANCEL_CHAT' })
    expect(s.listening).toBe(false)
    expect(s.listenStartedAt).toBeNull()
  })

  it('NEW_CHAT/세션 로드는 초기 상태(false)로 재구축된다', () => {
    const s = chatReducer(chatReducer(initialChatState, recv(listenStarted)), { type: 'NEW_CHAT' })
    expect(s.listening).toBe(false)
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
