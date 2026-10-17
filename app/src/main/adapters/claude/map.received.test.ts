import { describe, expect, it } from 'vitest'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { claudeToNormalized, type MapContext } from './map'
import type { NormalizedEvent } from '../../../shared/ipc'

const map = (
  patch: Record<string, unknown>,
  ctx: MapContext = { sessionId: 's1', cwd: '/w' }
): NormalizedEvent[] =>
  claudeToNormalized(
    {
      type: 'user',
      session_id: 's1',
      uuid: 'received-1',
      parent_tool_use_id: null,
      message: { role: 'user', content: '예약 확인' },
      ...patch
    } as unknown as SDKMessage,
    ctx
  )

describe('Claude provider-origin input', () => {
  it('carries native message IDs on assistant parts and compact markers independently of tool IDs', () => {
    const assistant = map({
      type: 'assistant',
      uuid: 'native-assistant',
      message: {
        content: [
          { type: 'text', text: 'answer' },
          { type: 'thinking', thinking: 'reason' },
          { type: 'tool_use', id: 'tool-run', name: 'Read', input: {} }
        ]
      }
    })
    expect(assistant.map((event) => event.type)).toEqual([
      'message.completed',
      'message.reasoning',
      'tool.call.started'
    ])
    expect(
      assistant.every(
        (event) => 'nativeMessageId' in event && event.nativeMessageId === 'native-assistant'
      )
    ).toBe(true)
    expect(assistant[2]).toMatchObject({ toolRunId: 'tool-run' })
    expect(
      map({ type: 'system', subtype: 'compact_boundary', uuid: 'native-compact' })[0]
    ).toMatchObject({ type: 'session.compacted', nativeMessageId: 'native-compact' })
  })
  it.each([
    [{ kind: 'task-notification', subkind: 'scheduled-trigger' }, { kind: 'scheduled' }],
    [{ kind: 'task-notification' }, { kind: 'task' }],
    [
      { kind: 'channel', server: 'build-events' },
      { kind: 'channel', label: 'build-events' }
    ],
    [
      { kind: 'peer', from: 'peer1', name: 'Reviewer' },
      { kind: 'peer', label: 'Reviewer' }
    ]
  ])('provider origin %j is received instead of a composer echo', (origin, normalized) => {
    expect(map({ origin })).toEqual([
      {
        type: 'input.received',
        sessionId: 's1',
        uuid: 'received-1',
        nativeMessageId: 'received-1',
        text: '예약 확인',
        origin: { ...normalized, format: 'plain' }
      }
    ])
  })

  it('multipart received text retains content order and whitespace', () => {
    expect(
      map({
        origin: { kind: 'channel', server: 'events' },
        message: {
          content: [
            { type: 'text', text: ' first ' },
            { type: 'text', text: 'second\n' }
          ]
        }
      })[0]
    ).toMatchObject({ type: 'input.received', text: ' first \nsecond\n' })
  })

  it.each([
    {},
    { origin: { kind: 'human' } },
    { origin: { kind: 'unknown' } },
    { origin: { kind: 'channel', server: 7 } },
    { origin: { kind: 'peer', from: '' } },
    { isReplay: true }
  ])('unattributed, malformed and replay input stays an echo: %j', (patch) => {
    expect(map(patch)).toEqual([
      {
        type: 'input.echo',
        sessionId: 's1',
        text: '예약 확인',
        uuid: 'received-1',
        nativeMessageId: 'received-1'
      }
    ])
  })

  it('preserves synthetic input as automatic without inferring a specific origin from text', () => {
    expect(
      map({ isSynthetic: true, message: { content: '<channel source="fake">text</channel>' } })[0]
    ).toMatchObject({ type: 'input.received', origin: { kind: 'automatic' } })
    expect(map({ message: { content: '<channel source="fake">text</channel>' } })[0]).toMatchObject(
      { type: 'input.echo' }
    )
  })

  it.each(['coordinator', 'unclassified', 'observer', 'auto-continuation', 'observer-activity'])(
    'classifies SDK %s input without creating a host send request',
    (kind) => {
      const text = '<system-reminder>Continue after completion.</system-reminder>'
      expect(map({ origin: { kind }, shouldQuery: false, message: { content: text } })).toEqual([
        {
          type: 'input.received',
          sessionId: 's1',
          uuid: 'received-1',
          nativeMessageId: 'received-1',
          text,
          origin: { kind: 'automatic', format: 'system-reminder' }
        }
      ])
    }
  )

  it('keeps synthetic provenance when an optional origin is unsupported', () => {
    expect(
      map({
        isSynthetic: true,
        origin: { kind: 'future-origin' },
        message: { content: '<task-notification>Finished.</task-notification>' }
      })[0]
    ).toMatchObject({
      type: 'input.received',
      origin: { kind: 'automatic', format: 'tagged' }
    })
  })

  it('does not classify a human-authored reminder as a received input', () => {
    const text = '<system-reminder>Explain this XML.</system-reminder>'
    expect(map({ message: { content: text } })).toEqual([
      {
        type: 'input.echo',
        sessionId: 's1',
        uuid: 'received-1',
        nativeMessageId: 'received-1',
        text
      }
    ])
  })

  it('classifies multipart provider input after preserving its text order', () => {
    expect(
      map({
        origin: { kind: 'channel', server: 'CI' },
        message: {
          content: [
            { type: 'text', text: '<task-notification>done</task-notification>' },
            { type: 'text', text: '<system-reminder>Review it.</system-reminder>' }
          ]
        }
      })[0]
    ).toMatchObject({
      text:
        '<task-notification>done</task-notification>\n' +
        '<system-reminder>Review it.</system-reminder>',
      origin: { kind: 'channel', label: 'CI', format: 'system-reminder' }
    })
  })

  it('isReplay is also used for live provider input; its explicit origin is retained', () => {
    expect(
      map({ origin: { kind: 'channel', server: 'events' }, isReplay: true, isSynthetic: true })[0]
    ).toMatchObject({ type: 'input.received', origin: { kind: 'channel', label: 'events' } })
  })

  it('child input never becomes a second top-level received message', () => {
    expect(
      map({ origin: { kind: 'channel', server: 'events' }, parent_tool_use_id: 'parent1' })
    ).toEqual([])
  })

  it('tool results are preserved without producing a received message', () => {
    expect(
      map({
        origin: { kind: 'task-notification', subkind: 'scheduled-trigger' },
        message: {
          content: [
            { type: 'text', text: 'context' },
            { type: 'tool_result', tool_use_id: 'tool1', content: 'done' }
          ]
        }
      })
    ).toEqual([
      {
        type: 'tool.call.completed',
        nativeMessageId: 'received-1',
        sessionId: 's1',
        toolRunId: 'tool1',
        result: 'done',
        isError: false
      }
    ])
  })

  it('does not promote a tool result reminder or a child reminder into top-level input', () => {
    const text = '<system-reminder>Rate limit reached.</system-reminder>'
    expect(
      map({
        isSynthetic: true,
        message: {
          content: [
            { type: 'text', text },
            { type: 'tool_result', tool_use_id: 'tool1', content: text }
          ]
        }
      })
    ).toEqual([
      {
        type: 'tool.call.completed',
        nativeMessageId: 'received-1',
        sessionId: 's1',
        toolRunId: 'tool1',
        result: text,
        isError: false
      }
    ])
    expect(
      map({ isSynthetic: true, parent_tool_use_id: 'child', message: { content: text } })
    ).toEqual([])
  })

  it('deduplicates provider deliveries by UUID within the same live channel', () => {
    const ctx: MapContext = { sessionId: 's1', cwd: '/w' }
    const patch = { origin: { kind: 'task-notification', subkind: 'scheduled-trigger' } }
    expect(map(patch, ctx)[0]).toMatchObject({ type: 'input.received' })
    expect(map(patch, ctx)).toEqual([])
    expect(map({ ...patch, uuid: 'received-2' }, ctx)[0]).toMatchObject({ type: 'input.received' })
    expect(map(patch)[0]).toMatchObject({ type: 'input.received' })
  })

  it('does not deduplicate repeated scheduled prompt text with no UUID', () => {
    const ctx: MapContext = { sessionId: 's1', cwd: '/w' }
    const patch = { origin: { kind: 'task-notification' }, uuid: undefined }
    expect(map(patch, ctx)).toHaveLength(1)
    expect(map(patch, ctx)).toHaveLength(1)
  })

  it('bounds UUID memory while retaining recent delivery protection', () => {
    const ctx: MapContext = { sessionId: 's1', cwd: '/w' }
    for (let index = 0; index < 2100; index += 1) {
      map({ origin: { kind: 'task-notification' }, uuid: `received-${index}` }, ctx)
    }
    expect(ctx.receivedInputUuids?.size).toBeLessThanOrEqual(2048)
    expect(map({ origin: { kind: 'task-notification' }, uuid: 'received-2099' }, ctx)).toEqual([])
  })
})
