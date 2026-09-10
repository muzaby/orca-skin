import { describe, expect, it } from 'vitest'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'
import { partsArtifacts } from '../lib/parts'
import { turnEquals } from '../lib/turns'
import type { NormalizedEvent } from '../../../../../shared/ipc'

const artifact = {
  publicationId: 'p1',
  artifactFileId: 'f1',
  title: 'Report',
  filename: 'report.md',
  kind: 'markdown' as const,
  sizeBytes: 12,
  publishedAt: 1
}
const start: ChatState = {
  ...initialChatState,
  sessionId: 's',
  messages: [
    {
      role: 'assistant',
      createdAt: 1,
      parts: [{ type: 'tool_call', toolRunId: 'original', toolName: 'publish_artifact', args: {} }]
    },
    { role: 'user', createdAt: 2, parts: [{ type: 'text', text: 'next' }] },
    { role: 'assistant', createdAt: 3, parts: [{ type: 'text', text: 'later answer' }] }
  ]
}
const complete = (toolRunId = 'original', isError = false): NormalizedEvent => ({
  type: 'tool.call.completed',
  sessionId: 's',
  toolRunId,
  result: 'ok',
  isError,
  artifact
})

describe('artifact publication ownership', () => {
  it('attaches a late artifact only to the original call message and invalidates its turn memo', () => {
    const next = chatReducer(start, { type: 'RECV_EVENT', event: complete() })
    expect(partsArtifacts(next.messages[0].parts)).toEqual([artifact])
    expect(partsArtifacts(next.messages[2].parts)).toEqual([])
    expect(next.messages[1]).toBe(start.messages[1])
    expect(
      turnEquals(
        { role: 'assistant', startIndex: 0, messages: [start.messages[0]] },
        { role: 'assistant', startIndex: 0, messages: [next.messages[0]] }
      )
    ).toBe(false)
  })
  it('does not invent a card for an unknown call or failed result; duplicate completion keeps one card', () => {
    for (const event of [complete('missing'), complete('original', true)]) {
      expect(
        chatReducer(start, { type: 'RECV_EVENT', event }).messages.flatMap((m) =>
          partsArtifacts(m.parts)
        )
      ).toEqual([])
    }
    const once = chatReducer(start, { type: 'RECV_EVENT', event: complete() })
    const twice = chatReducer(once, { type: 'RECV_EVENT', event: complete() })
    expect(partsArtifacts(twice.messages[0].parts)).toEqual([artifact])
  })
  it('a list notification cannot append a transcript part or open a panel', () => {
    expect(
      chatReducer(start, {
        type: 'RECV_EVENT',
        event: { type: 'artifact.published', sessionId: 's', artifact }
      })
    ).toBe(start)
  })
  it('reload preserves the artifact reference on its original message', () => {
    const live = chatReducer(start, { type: 'RECV_EVENT', event: complete() })
    const loaded = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        agentKind: 'code',
        id: 's',
        backend: 'claude',
        title: 'report',
        messages: live.messages
      }
    })
    expect(loaded.messages.map((message) => message.parts)).toEqual(
      live.messages.map((message) => message.parts)
    )
    expect(partsArtifacts(loaded.messages[0].parts)).toEqual([artifact])
  })
})

describe('captured ordinary output ownership', () => {
  const file = { ...artifact, category: 'file' as const }
  const captured = (
    origin: Pick<Extract<NormalizedEvent, { type: 'output.captured' }>, 'toolRunId' | 'responseId'>
  ): NormalizedEvent => ({ type: 'output.captured', sessionId: 's', artifact: file, ...origin })
  const withBoundary: ChatState = {
    ...start,
    messages: start.messages.map((message, index) =>
      index === 0
        ? {
            ...message,
            parts: [
              { type: 'response_boundary', boundary: { phase: 'begin', id: 'response-1' } },
              ...message.parts
            ]
          }
        : message
    )
  }

  it.each([{ toolRunId: 'original' }, { responseId: 'response-1' }])(
    'attaches late output to the original message from %j and preserves unrelated identities',
    (origin) => {
      const next = chatReducer(withBoundary, { type: 'RECV_EVENT', event: captured(origin) })
      expect(partsArtifacts(next.messages[0].parts)).toEqual([file])
      expect(next.messages[0]).not.toBe(withBoundary.messages[0])
      expect(next.messages.slice(1)).toEqual(withBoundary.messages.slice(1))
      expect(next.messages[1]).toBe(withBoundary.messages[1])
      expect(next.messages[2]).toBe(withBoundary.messages[2])
      expect(next.inflight).toBe(withBoundary.inflight)
    }
  )

  it.each([
    {},
    { toolRunId: 'missing' },
    { responseId: 'missing' },
    { toolRunId: 'missing', responseId: 'response-1' }
  ])('does not guess a tail or substitute response ownership for %j', (origin) => {
    expect(chatReducer(withBoundary, { type: 'RECV_EVENT', event: captured(origin) })).toBe(
      withBoundary
    )
  })

  it('ignores captures whose artifact was rejected by Main', () => {
    expect(
      chatReducer(withBoundary, {
        type: 'RECV_EVENT',
        event: { type: 'output.captured', sessionId: 's', toolRunId: 'original' }
      })
    ).toBe(withBoundary)
  })

  it('deduplicates one publication across adjacent assistant messages in the same turn', () => {
    const sameTurn: ChatState = {
      ...withBoundary,
      messages: [
        withBoundary.messages[0],
        { role: 'assistant', createdAt: 2, parts: [{ type: 'artifact', artifact: file }] },
        ...withBoundary.messages.slice(1)
      ]
    }
    expect(
      chatReducer(sameTurn, { type: 'RECV_EVENT', event: captured({ toolRunId: 'original' }) })
    ).toBe(sameTurn)
  })

  it('deduplicates repeated delivery and retains the same file in a later explicit turn after reload', () => {
    const once = chatReducer(withBoundary, {
      type: 'RECV_EVENT',
      event: captured({ toolRunId: 'original' })
    })
    expect(
      chatReducer(once, { type: 'RECV_EVENT', event: captured({ toolRunId: 'original' }) })
    ).toBe(once)
    const laterBoundary = chatReducer(once, {
      type: 'RECV_EVENT',
      event: {
        type: 'response.boundary',
        sessionId: 's',
        boundary: { phase: 'begin', id: 'response-2' }
      }
    })
    const later = chatReducer(laterBoundary, {
      type: 'RECV_EVENT',
      event: captured({ responseId: 'response-2' })
    })
    const loaded = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        agentKind: 'work',
        id: 's',
        backend: 'claude',
        title: 'files',
        messages: later.messages
      }
    })
    expect(partsArtifacts(loaded.messages[0].parts)).toEqual([file])
    expect(partsArtifacts(loaded.messages[2].parts)).toEqual([file])
  })
})
