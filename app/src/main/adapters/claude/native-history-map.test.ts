import { describe, expect, it } from 'vitest'
import {
  isClaudeHistoryComplete,
  mapClaudeHistory,
  selectClaudeHistory
} from './native-history-map'
import { HISTORY_SESSION_ID as id, historyEntry as entry } from './native-history.testfixture'

describe('Claude native current-chain display', () => {
  it('keeps text/thinking/tools in one assistant response and never makes a tool-result user bubble', async () => {
    const raw = [
      entry('u1', null, 'user', 'do work'),
      entry(
        'a1',
        'u1',
        'assistant',
        [
          { type: 'thinking', thinking: 'reason', signature: 'sig' },
          { type: 'text', text: 'before' },
          { type: 'tool_use', id: 'edit1', name: 'Edit', input: { file_path: '/w/a' } }
        ],
        {
          message: {
            id: 'model-1',
            role: 'assistant',
            content: [
              { type: 'thinking', thinking: 'reason', signature: 'sig' },
              { type: 'text', text: 'before' },
              { type: 'tool_use', id: 'edit1', name: 'Edit', input: { file_path: '/w/a' } }
            ],
            stop_reason: 'tool_use'
          }
        }
      ),
      entry('r1', 'a1', 'user', [{ type: 'tool_result', tool_use_id: 'edit1', content: 'done' }]),
      entry('a2', 'r1', 'assistant', [{ type: 'text', text: 'after' }])
    ]
    const before = JSON.stringify(raw)
    const selected = await selectClaudeHistory(id, '/w', raw)
    const messages = mapClaudeHistory(selected, id, '/w')
    expect(messages).toHaveLength(2)
    expect(messages[1]).toMatchObject({
      id: 'a1',
      sourceIds: ['a1', 'r1', 'a2'],
      role: 'assistant'
    })
    expect(messages[1].parts.map((part) => part.type)).toEqual([
      'reasoning',
      'text',
      'tool_call',
      'tool_result',
      'text'
    ])
    expect(isClaudeHistoryComplete(selected)).toBe(true)
    expect(JSON.stringify(raw)).toBe(before)
  })

  it('restores automatic meta input and compact metadata while excluding abandoned branches', async () => {
    const raw = [
      entry('u', null, 'user', 'hello'),
      entry('a', 'u', 'assistant', [{ type: 'text', text: 'first' }]),
      entry('old', 'a', 'user', 'discarded'),
      entry('old-a', 'old', 'assistant', [{ type: 'text', text: 'discarded answer' }]),
      entry('auto', 'a', 'user', '<system-reminder>continue</system-reminder>', {
        isMeta: true,
        origin: { kind: 'auto-continuation' }
      }),
      {
        uuid: 'compact',
        parentUuid: 'auto',
        type: 'system',
        subtype: 'compact_boundary',
        sessionId: id,
        compactMetadata: { trigger: 'auto', preTokens: 500, postTokens: 100 }
      },
      entry('done', 'compact', 'assistant', [{ type: 'text', text: 'finished' }])
    ]
    const selected = await selectClaudeHistory(id, '/w', raw)
    expect(selected.map((item) => item.uuid)).toEqual(['u', 'a', 'auto', 'compact', 'done'])
    const messages = mapClaudeHistory(selected, id, '/w')
    expect(messages[2]).toMatchObject({
      id: 'auto',
      parts: [{ type: 'text', origin: { kind: 'automatic', format: 'system-reminder' } }]
    })
    expect(messages[3].parts[0]).toEqual({
      type: 'compact_boundary',
      trigger: 'auto',
      preTokens: 500,
      postTokens: 100
    })
  })

  it('retains native camelCase tool metadata without replaying usage or embedding full files', async () => {
    const structuredPatch = [
      { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-before', '+after'] }
    ]
    const raw = [
      entry('u', null, 'user', 'edit'),
      entry('call', 'u', 'assistant', [
        { type: 'tool_use', id: 'edit', name: 'Edit', input: { file_path: '/w/a' } }
      ]),
      entry(
        'result',
        'call',
        'user',
        [{ type: 'tool_result', tool_use_id: 'edit', content: 'updated' }],
        {
          toolUseResult: { structuredPatch, originalFile: 'private original file body' },
          toolResultMeta: [{ id: 'edit', non_execution_kind: 'user-rejected' }]
        }
      ),
      entry('done', 'result', 'assistant', [{ type: 'text', text: 'finished' }]),
      { type: 'result', uuid: 'usage', total_cost_usd: 10, usage: { input_tokens: 100 } }
    ]
    const messages = mapClaudeHistory(await selectClaudeHistory(id, '/w', raw), id, '/w')
    expect(messages[1].parts.find((part) => part.type === 'tool_result')).toMatchObject({
      toolRunId: 'edit',
      structuredOutput: { structuredPatch },
      nonExecution: { source: 'sdk', kind: 'user-rejected' }
    })
    expect(messages).toHaveLength(2)
    expect(JSON.stringify(messages)).not.toContain('private original file body')
    expect(JSON.stringify(messages)).not.toContain('total_cost_usd')
  })

  it.each(['preservedMessages', 'preservedSegment'])(
    'uses SDK %s compaction rewiring',
    async (kind) => {
      const raw = [
        entry('u', null, 'user', 'hello'),
        entry('a', 'u', 'assistant', [{ type: 'text', text: 'retained' }]),
        {
          uuid: 'c',
          parentUuid: null,
          type: 'system',
          subtype: 'compact_boundary',
          sessionId: id,
          compactMetadata:
            kind === 'preservedMessages'
              ? { preservedMessages: { anchorUuid: 'c', uuids: ['u', 'a'] } }
              : { preservedSegment: { anchorUuid: 'c', headUuid: 'u', tailUuid: 'a' } }
        },
        entry('last', 'c', 'assistant', [{ type: 'text', text: 'after compact' }])
      ]
      expect((await selectClaudeHistory(id, '/w', raw)).map((item) => item.uuid)).toEqual([
        'c',
        'u',
        'a',
        'last'
      ])
    }
  )

  it('keeps distinct repeated human messages and their native IDs', async () => {
    const raw = [
      entry('u1', null, 'user', 'again'),
      entry('a1', 'u1', 'assistant', [{ type: 'text', text: 'ok' }]),
      entry('u2', 'a1', 'user', 'again'),
      entry('a2', 'u2', 'assistant', [{ type: 'text', text: 'ok' }])
    ]
    expect(
      mapClaudeHistory(await selectClaudeHistory(id, '/w', raw), id, '/w').map((item) => item.id)
    ).toEqual(['u1', 'a1', 'u2', 'a2'])
  })

  it('retains an image-only user identity for attachment sidecars', async () => {
    const raw = [
      entry('image-user', null, 'user', [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'fixture' } }
      ]),
      entry('answer', 'image-user', 'assistant', [{ type: 'text', text: 'image response' }])
    ]
    expect(mapClaudeHistory(await selectClaudeHistory(id, '/w', raw), id, '/w')[0]).toMatchObject({
      id: 'image-user',
      sourceIds: ['image-user'],
      role: 'user',
      parts: []
    })
  })

  it.each([true, false])(
    'preserves queued metadata with explicit origin=%s',
    async (withOrigin) => {
      const raw = [
        entry('u', null, 'user', 'hello'),
        entry('a', 'u', 'assistant', [{ type: 'text', text: 'done' }]),
        {
          uuid: 'queue-wrapper',
          parentUuid: 'a',
          type: 'attachment',
          sessionId: id,
          attachment: {
            type: 'queued_command',
            source_uuid: 'queued-user',
            prompt: '<system-reminder>continue</system-reminder>',
            isMeta: true,
            ...(withOrigin ? { origin: { kind: 'auto-continuation' } } : {})
          }
        }
      ]
      const selected = await selectClaudeHistory(id, '/w', raw)
      expect(selected.at(-1)).toMatchObject({ uuid: 'queued-user', type: 'user' })
      expect(isClaudeHistoryComplete(selected, raw)).toBe(false)
      expect(mapClaudeHistory(selected, id, '/w').at(-1)).toMatchObject({
        id: 'queued-user',
        role: 'user',
        parts: [{ origin: { kind: 'automatic', format: 'system-reminder' } }]
      })
    }
  )

  it('honors a persisted requires-action marker after a completed assistant', async () => {
    const raw = [
      entry('u', null, 'user', 'hello'),
      entry('a', 'u', 'assistant', [{ type: 'text', text: 'done' }]),
      {
        type: 'system',
        subtype: 'session_state_changed',
        state: 'requires_action',
        uuid: 'state',
        parentUuid: 'a',
        sessionId: id
      }
    ]
    const selected = await selectClaudeHistory(id, '/w', raw)
    expect(isClaudeHistoryComplete(selected, raw)).toBe(false)
  })

  it.each(
    [
      [entry('u', null, 'user', 'unfinished')],
      [entry('a', null, 'assistant', [{ type: 'tool_use', id: 't', name: 'Bash', input: {} }])],
      [
        entry('a', null, 'assistant', [{ type: 'text', text: 'done' }]),
        entry('auto', 'a', 'user', '<system-reminder>continue</system-reminder>', { isMeta: true })
      ]
    ].map((raw) => ({ raw }))
  )('does not call a stable but unfinished snapshot complete', ({ raw }) => {
    expect(isClaudeHistoryComplete(raw)).toBe(false)
  })
})
