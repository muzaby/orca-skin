import { describe, expect, it } from 'vitest'
import type { AppMessagePart, LoadedMessage } from '../../../../../shared/ipc'
import { userMessageId } from '../../../../../shared/message-id'
import { chatReducer, initialChatState } from './chatReducer'

const msg = (
  id: string,
  role: 'user' | 'assistant',
  ...parts: AppMessagePart[]
): LoadedMessage => ({
  id,
  role,
  createdAt: 0,
  parts
})

describe('VP-10 EP-5 ③ messages write sweep (l8, l11)', () => {
  it.each([true, false])(
    'records a partial same-session reload when preserveLocalState is %s',
    (preserveLocalState) => {
      const session = {
        id: 's',
        title: null,
        backend: 'claude',
        agentKind: 'code',
        messages: []
      } as const
      const before = chatReducer(initialChatState, {
        type: 'LOAD_SESSION',
        session: { ...session, messages: [] },
        complete: true
      })
      const next = chatReducer(before, {
        type: 'LOAD_SESSION',
        session: { ...session, messages: [] },
        complete: false,
        preserveLocalState
      })
      expect(next.transcriptChanges.lineage).toBe(before.transcriptChanges.lineage)
      expect(next.transcriptChanges.revision).toBe(before.transcriptChanges.revision + 1)
      expect(next.transcriptChanges.log.at(-1)).toEqual({ kind: 'reset', complete: false })
    }
  )

  it('every messages write records one change of the right kind', () => {
    const write: typeof chatReducer = (state, action) => {
      const next = chatReducer(state, action)
      expect(next.transcriptChanges.revision, action.type).toBe(
        state.transcriptChanges.revision + 1
      )
      return next
    }

    // ⓖ LOAD_SESSION full branch -> reset{complete: true / false} (l11)
    let s = write(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        id: 's',
        backend: 'claude',
        agentKind: 'code',
        title: null,
        messages: [msg('u:0', 'user', { type: 'text', text: 'hi' })]
      },
      complete: true
    })
    expect(s.transcriptChanges.log.at(-1)).toEqual({ kind: 'reset', complete: true })

    // ⓕ LOAD_SESSION with complete: false -> reset{complete: false} (l11)
    s = write(s, {
      type: 'LOAD_SESSION',
      session: {
        id: 's',
        backend: 'claude',
        agentKind: 'code',
        title: null,
        messages: [msg('u:0', 'user', { type: 'text', text: 'hi' })]
      },
      complete: false
    })
    expect(s.transcriptChanges.log.at(-1)).toEqual({ kind: 'reset', complete: false })

    // ⓐ appendAssistantPart (new message -> append; append part -> replace{partsFrom: prevLen}; same mergeKey -> replace{partsFrom: slot})
    s = write(s, {
      type: 'RECV_EVENT',
      event: {
        type: 'tool.call.started',
        sessionId: 's',
        toolRunId: 't1',
        toolName: 'ExitPlanMode',
        args: { plan: 'v1' },
        messageKey: 'a:1'
      }
    })
    expect(s.transcriptChanges.log.at(-1)).toEqual({ kind: 'append', ids: ['a:1'] })

    s = write(s, {
      type: 'RECV_EVENT',
      event: {
        type: 'tool.call.completed',
        sessionId: 's',
        toolRunId: 't1',
        result: 'r1',
        isError: false,
        messageKey: 'a:1'
      }
    })
    expect(s.transcriptChanges.log.at(-1)).toEqual({ kind: 'replace', id: 'a:1', partsFrom: 1 })

    s = write(s, {
      type: 'RECV_EVENT',
      event: {
        type: 'tool.call.completed',
        sessionId: 's',
        toolRunId: 't1',
        result: 'r2',
        isError: false,
        messageKey: 'a:1'
      }
    })
    expect(s.transcriptChanges.log.at(-1)).toEqual({ kind: 'replace', id: 'a:1', partsFrom: 1 })

    // ⓑ appendOwnedArtifact -> replace{owner, prevLen}
    s = write(s, {
      type: 'RECV_EVENT',
      event: {
        type: 'output.captured',
        sessionId: 's',
        toolRunId: 't1',
        artifact: { publicationId: 'pub-1' } as Extract<
          AppMessagePart,
          { type: 'artifact' }
        >['artifact']
      }
    })
    expect(s.transcriptChanges.log.at(-1)).toEqual({ kind: 'replace', id: 'a:1', partsFrom: 2 })

    // ⓒ correctPlanToolInput -> replace{id, partIndex}
    s = write(s, {
      type: 'RECV_EVENT',
      event: {
        type: 'tool.call.started',
        sessionId: 's',
        toolRunId: 't-later',
        toolName: 'ExitPlanMode',
        args: { plan: 'v1' },
        messageKey: 'a:1'
      }
    })
    s = write(s, {
      type: 'RECV_EVENT',
      event: {
        type: 'permission.requested',
        sessionId: 's',
        action: {
          kind: 'plan_review',
          input: { plan: 'updated plan content' },
          providerRequest: { toolUseId: 't-later' },
          request: {
            plan: 'updated plan content'
          }
        }
      } as unknown as Parameters<typeof chatReducer>[1] extends { event: infer E } ? E : never
    })
    expect(s.transcriptChanges.log.at(-1)).toEqual({ kind: 'replace', id: 'a:1', partsFrom: 3 })

    // ⓓ APPEND_COMMITTED_USER_MESSAGE -> append (normal) and reset{complete} (mixed batch replacement)
    s = write(s, {
      type: 'APPEND_COMMITTED_USER_MESSAGE',
      text: 'opt',
      clientId: 'c1'
    })
    expect(s.transcriptChanges.log.at(-1)).toEqual({ kind: 'append', ids: ['u:c1'] })

    s = write(s, {
      type: 'APPEND_COMMITTED_USER_MESSAGE',
      text: 'opt\nsteer',
      messageKey: userMessageId(['c1', 'c2']),
      ids: ['c1', 'c2']
    })
    expect(s.transcriptChanges.log.at(-1)).toEqual({ kind: 'reset', complete: false })

    // ⓔ DROP_UNCOMMITTED_USER -> remove
    s = write(s, {
      type: 'APPEND_COMMITTED_USER_MESSAGE',
      text: 'temp',
      clientId: 'drop-me'
    })
    s = write(s, { type: 'DROP_UNCOMMITTED_USER', clientId: 'drop-me' })
    expect(s.transcriptChanges.log.at(-1)).toEqual({ kind: 'remove', ids: ['u:drop-me'] })

    // ⓗ PREPEND_HISTORY -> prepend (T-preserving) and reset{complete: false} (T-violating, l11)
    s = write(s, {
      type: 'PREPEND_HISTORY',
      messages: [
        msg('u:old', 'user', { type: 'text', text: 'old q' }),
        msg('a:old', 'assistant', { type: 'text', text: 'old a' })
      ],
      reachedStart: false
    })
    expect(s.transcriptChanges.log.at(-1)).toEqual({ kind: 'prepend', ids: ['u:old', 'a:old'] })

    s = write(s, {
      type: 'PREPEND_HISTORY',
      messages: [msg('u:older', 'user', { type: 'text', text: 'older q' })],
      reachedStart: false
    })
    expect(s.transcriptChanges.log.at(-1)).toEqual({ kind: 'reset', complete: false })
  })
})
