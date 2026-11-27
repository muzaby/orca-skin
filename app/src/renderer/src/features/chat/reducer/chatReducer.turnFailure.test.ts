import { describe, expect, it } from 'vitest'
import type {
  AppMessagePart,
  LoadedMessage,
  NormalizedEvent,
  TurnFailureReceipt
} from '../../../../../shared/ipc'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'
import { createWorkProjector } from '../lib/workActivity'
import { partMergeKey } from '../lib/transcript/mergeKey'

const user = (id: string): LoadedMessage => ({
  id,
  role: 'user',
  parts: [{ type: 'text', text: 'same question' }],
  createdAt: 1
})
const error = { category: 'stream_error', message: 'same failure', retryable: true } as const
type ReceiptEvent = Extract<NormalizedEvent, { type: 'error' }> & { failure: TurnFailureReceipt }
const failure = (owner: string, id: string): ReceiptEvent => ({
  type: 'error' as const,
  sessionId: 's',
  messageKey: 'a:' + id,
  error,
  failure: {
    failureId: id,
    ownerUserMessageKey: owner,
    assistantMessageKey: 'a:' + id,
    occurredAt: 100
  }
})
const load = (messages: LoadedMessage[], state = initialChatState, id = 's'): ChatState =>
  chatReducer(state, {
    type: 'LOAD_SESSION',
    session: { id, backend: 'claude', agentKind: 'code', title: null, messages }
  })
const recv = (state: ChatState, event: NormalizedEvent): ChatState =>
  chatReducer(state, { type: 'RECV_EVENT', event })

describe('durable turn failures', () => {
  it('restores two identical failures to the two original users after stale pages, with a legacy card and a separate banner', () => {
    const first = failure('u:x,y', 'first'),
      second = failure('u:y,x', 'second')
    const original = [user('u:x,y'), user('u:ok'), user('u:y,x')]
    let state = recv(recv(load(original), first), second)
    const expected = ['u:x,y', 'a:first', 'u:ok', 'u:y,x', 'a:second']
    expect(state.messages.map((m) => m.id)).toEqual(expected)
    expect(
      state.messages.flatMap((m) => m.parts.filter((p) => p.type === 'error').map((p) => p.failure))
    ).toEqual([first.failure, second.failure])
    expect(state.error).toBeUndefined()
    state = recv(state, { type: 'error', sessionId: 's', error })
    expect(recv(state, first)).toBe(state)
    expect(state.error).toBe(error)
    const legacy = {
      id: 'a:legacy',
      role: 'assistant' as const,
      parts: [{ type: 'error' as const, error }],
      createdAt: 2
    }
    expect(load([...original, legacy], state).messages.map((m) => m.id)).toEqual([
      ...expected.slice(0, 4),
      'a:legacy',
      'a:second'
    ])
    expect(load(original, state, 'other').messages).toHaveLength(3)
    expect(partMergeKey({ type: 'error', error })).toBeUndefined()
    expect(partMergeKey({ type: 'error', error, failure: second.failure })).toBe('failure:second')
  })

  it('checks session, group order, and roles, and leaves the next live turn running on late first delivery', () => {
    const prior = load([user('u:x,y')])
    const next = chatReducer(chatReducer(prior, { type: 'BEGIN_TURN' }), {
      type: 'APPEND_COMMITTED_USER_MESSAGE',
      text: 'next',
      messageKey: 'u:next'
    })
    const first = failure('u:x,y', 'first')
    expect(recv(next, { ...first, sessionId: 'other' })).toBe(next)
    expect(recv(next, { ...first, messageKey: 'a:wrong' })).toBe(next)
    expect(recv(next, failure('a:x,y', 'invalid'))).toBe(next)
    expect(recv(next, failure('u:x', 'partial')).messages).toBe(next.messages)
    const late = recv(next, first)
    expect(late.inflight).toBe(true)
    expect(late.messages.map((m) => m.id)).toEqual(['u:x,y', 'a:first', 'u:next'])
    expect(recv(late, first)).toBe(late)
    expect(recv(late, failure('u:next', 'next')).inflight).toBe(false)
  })

  it('replays an ACK before prepend and after deferred part replacement once, in the correct session', () => {
    const event = failure('u:old', 'older')
    const state = recv(load([user('u:current')]), event)
    const ref = {
      kind: 'parts',
      session: 's',
      generation: 'g',
      message: 'a:older',
      bytes: 100
    } as const
    const old = {
      id: 'a:older',
      role: 'assistant',
      createdAt: 0,
      parts: [],
      deferredBody: ref
    } as const
    const prepended = chatReducer(state, {
      type: 'PREPEND_HISTORY',
      messages: [user('u:old'), { ...old, parts: [] }],
      reachedStart: true
    })
    expect(prepended.messages[1].parts).toEqual([{ type: 'error', error, failure: event.failure }])
    const body = chatReducer(prepended, {
      type: 'RESOLVE_HISTORY_BODY',
      ref,
      parts: [{ type: 'text', text: 'older answer' }]
    })
    expect(body.messages[1].parts).toEqual([
      { type: 'text', text: 'older answer' },
      { type: 'error', error, failure: event.failure }
    ])
    expect(recv(body, event)).toBe(body)
    const reopened = load(body.messages)
    expect(recv(reopened, event).messages).toBe(reopened.messages)
  })

  it.each(['failed', 'aborted'] as const)(
    'keeps a receipt-bearing detail and preserves an independent %s boundary',
    (outcome) => {
      const receipt = failure('u:q', 'detail').failure
      const parts: AppMessagePart[] = [
        { type: 'response_boundary', boundary: { phase: 'begin', id: 'prior' } },
        { type: 'response_boundary', boundary: { phase: 'end', id: 'prior', outcome } }
      ]
      const rows = createWorkProjector()([
        { id: 'a:other', createdAt: 0, role: 'assistant', parts },
        {
          id: 'a:detail',
          createdAt: 0,
          role: 'assistant',
          parts: [
            { type: 'response_boundary', boundary: { phase: 'begin', id: 'here' } },
            {
              type: 'response_boundary',
              boundary: { phase: 'end', id: 'here', outcome: 'failed' }
            },
            { type: 'error', error, failure: receipt }
          ]
        }
      ])
      expect(rows?.map((n) => (n.kind === 'status' ? n.outcome : n.kind))).toEqual([
        outcome,
        'segment'
      ])
    }
  )
})

it('reconciles a more recent overlapping page by occurrence, including two distinct receipts on one assistant', () => {
  const first = failure('u:q', 'a')
  const second = { ...first.failure, failureId: 'b' }
  const firstPart = { type: 'error' as const, error, failure: first.failure }
  const secondPart = { type: 'error' as const, error, failure: second }
  const assistant = { id: 'a:a', role: 'assistant' as const, parts: [firstPart], createdAt: 1 }
  let state = load([user('u:q'), assistant])
  state = chatReducer(state, {
    type: 'PREPEND_HISTORY',
    messages: [user('u:q'), { ...assistant, parts: [firstPart, secondPart] }],
    reachedStart: true
  })
  expect(state.messages[1].parts).toEqual([firstPart, secondPart])
})

it('links a failed Work boundary to its receipt across assistant rows, preserving an unrelated failure', () => {
  const first = failure('u:q', 'detail').failure
  const rows = createWorkProjector()([
    {
      id: 'a:work',
      createdAt: 0,
      role: 'assistant',
      parts: [
        { type: 'response_boundary', boundary: { phase: 'begin', id: 'independent' } },
        {
          type: 'response_boundary',
          boundary: { phase: 'end', id: 'independent', outcome: 'failed' }
        },
        { type: 'response_boundary', boundary: { phase: 'begin', id: 'work' } },
        { type: 'response_boundary', boundary: { phase: 'end', id: 'work', outcome: 'failed' } }
      ]
    },
    {
      id: 'a:detail',
      createdAt: 0,
      role: 'assistant',
      parts: [{ type: 'error', error, failure: { ...first, responseBoundaryId: 'work' } }]
    }
  ])
  expect(rows?.map((n) => (n.kind === 'status' ? n.key : n.kind))).toEqual([
    'status:independent',
    'segment'
  ])
})
