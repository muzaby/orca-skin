import { describe, expect, it } from 'vitest'
import type { LoadedSession, NormalizedEvent } from '../../../../../shared/ipc'
import { type ChatAction, chatReducer, initialChatState } from './chatReducer'

const recv = (event: NormalizedEvent): ChatAction => ({ type: 'RECV_EVENT', event })

describe('chatReducer runtime resilience', () => {
  it('turn.aborted 는 에러 없이 inflight 와 승인 게이트를 종료한다', () => {
    const started = chatReducer(initialChatState, { type: 'SEND_USER_MESSAGE', text: 'hi' })
    const next = chatReducer(
      {
        ...started,
        pendingAsks: [
          {
            requestId: 'a1',
            questions: [{ question: 'q', header: 'h', options: [], multiSelect: false }]
          }
        ]
      },
      recv({ type: 'turn.aborted', sessionId: 's1', reason: 'user_cancelled' })
    )

    expect(next.inflight).toBe(false)
    expect(next.error).toBeUndefined()
    expect(next.pendingAsks).toEqual([])
  })

  it('LOAD_SESSION 은 incomplete 메시지 마커를 보존한다', () => {
    const session: LoadedSession = {
      id: 's1',
      backend: 'claude',
      title: null,
      providerKey: null,
      messages: [
        {
          role: 'assistant',
          createdAt: 1,
          incomplete: true,
          parts: [{ type: 'text', text: 'partial' }]
        }
      ]
    }

    const next = chatReducer(initialChatState, { type: 'LOAD_SESSION', session })
    expect(next.messages[0]).toMatchObject({ role: 'assistant', incomplete: true })
  })
})
