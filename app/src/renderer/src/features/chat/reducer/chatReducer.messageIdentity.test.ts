/**
 * VP-02 · ST-01 · AC1 (renderer side) — Feeds the shared fixture's window-arrival event sequence
 * into `chatReducer` and compares against `ST01_EXPECTED_LIVE_MESSAGES`.
 */
import { describe, expect, it } from 'vitest'
import {
  ST01_EXPECTED_LIVE_MESSAGES,
  ST01_WINDOW_EVENTS,
  summarizeMessage
} from '../../../../../shared/message-identity.testfixture'
import { chatReducer, initialChatState } from './chatReducer'

describe('VP-02 ST-01 message-identity (renderer)', () => {
  it('같은 번호 열을 창 도착 순서로 reducer 에 넣으면 고정 입력의 기대 목록이다', () => {
    let state = initialChatState
    for (const ev of ST01_WINDOW_EVENTS) {
      if (ev.type === 'message.committed') {
        state = chatReducer(state, {
          type: 'APPEND_COMMITTED_USER_MESSAGE',
          text: ev.text,
          messageKey: ev.messageKey,
          ids: ev.ids
        })
      } else {
        state = chatReducer(state, { type: 'RECV_EVENT', event: ev })
      }
    }

    const actual = state.messages.map((m) =>
      summarizeMessage({ id: m.id, role: m.role, parts: m.parts })
    )
    expect(actual).toEqual(ST01_EXPECTED_LIVE_MESSAGES)
    // Error is shown as banner in renderer, not appended to messages (B7)
    expect(state.error?.message).toBe('turn error after recommit')
  })
})
