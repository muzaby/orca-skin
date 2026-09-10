import { describe, expect, it } from 'vitest'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { claudeToNormalized, type MapContext } from './claude-map'
import type { NormalizedEvent } from '../../shared/ipc'

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
        text: '예약 확인',
        origin: normalized
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
      { type: 'input.echo', sessionId: 's1', text: '예약 확인', uuid: 'received-1' }
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
        sessionId: 's1',
        toolRunId: 'tool1',
        result: 'done',
        isError: false
      }
    ])
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
