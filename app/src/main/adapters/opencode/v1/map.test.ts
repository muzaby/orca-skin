import { describe, expect, it } from 'vitest'
import { OpenCodeEventMapper, normalizeOpenCodeTool } from './map'
import { assistantMessage, editTool, openCodeEvent as event, textPart } from './adapter.testfixture'

describe('OpenCode event mapper', () => {
  it('rejects unseen assistant IDs with an old parent after a response boundary', () => {
    const mapper = new OpenCodeEventMapper('s1', 'first')
    mapper.map(
      event('message.updated', { sessionID: 's1', info: assistantMessage('s1', 'first', 'old') })
    )
    mapper.finish()
    mapper.acceptPrompt('second')
    for (const id of ['second', 'first'])
      mapper.map(
        event('message.updated', {
          sessionID: 's1',
          info: {
            id,
            sessionID: 's1',
            role: 'user',
            time: { created: 10 },
            agent: 'build',
            model: { providerID: 'p', modelID: 'm' }
          }
        })
      )
    mapper.map(
      event('message.updated', {
        sessionID: 's1',
        info: assistantMessage('s1', 'first', 'late-unseen')
      })
    )
    expect(mapper.ownsMessage('late-unseen')).toBe(false)
    expect(mapper.sawAssistant).toBe(false)
    expect(
      mapper.map(
        event('message.part.updated', {
          sessionID: 's1',
          time: 5,
          part: textPart('stale', { messageID: 'late-unseen' })
        })
      )
    ).toEqual([])
    mapper.map(
      event('message.updated', { sessionID: 's1', info: assistantMessage('s1', 'second', 'new') })
    )
    expect(mapper.ownsMessage('new')).toBe(true)
    expect(mapper.finish().find((value) => value.type === 'telemetry')).toMatchObject({
      usage: { inputTokens: 10, outputTokens: 20, costUsd: 0.25 }
    })
  })

  it('normalizes tools without changing the original name or input', () => {
    const mapper = new OpenCodeEventMapper('s1')
    mapper.map(event('message.updated', { sessionID: 's1', info: assistantMessage() }))
    const tool = editTool()
    const mapped = mapper.map(
      event('message.part.updated', { sessionID: 's1', part: tool, time: 125 })
    )
    expect(mapped).toEqual([
      {
        type: 'tool.call.started',
        sessionId: 's1',
        toolRunId: 'call-1',
        toolName: 'Edit',
        args: {
          filePath: 'src/a.ts',
          oldString: 'old',
          newString: 'new',
          file_path: 'src/a.ts',
          old_string: 'old',
          new_string: 'new'
        },
        providerTool: { name: 'edit', input: tool.state.input }
      },
      {
        type: 'tool.call.completed',
        sessionId: 's1',
        toolRunId: 'call-1',
        result: 'Updated file',
        isError: false,
        durationMs: 25,
        structuredOutput: { diff: '-old\n+new' }
      }
    ])
    expect(tool.state.input).not.toHaveProperty('file_path')
    expect(
      mapper.map(event('message.part.updated', { sessionID: 's1', part: tool, time: 130 }))
    ).toEqual([])
    expect(normalizeOpenCodeTool('custom_tool', { x: 1 })).toEqual({
      name: 'custom_tool',
      input: { x: 1 }
    })
  })

  it('deduplicates delta/snapshot completion and places telemetry before the turn boundary', () => {
    const mapper = new OpenCodeEventMapper('s1')
    mapper.map(event('message.updated', { sessionID: 's1', info: assistantMessage() }))
    expect(
      mapper.map(event('message.part.updated', { sessionID: 's1', part: textPart('Hi'), time: 1 }))
    ).toEqual([{ type: 'message.delta', sessionId: 's1', delta: { text: 'Hi' } }])
    const delta = event('message.part.delta', {
      sessionID: 's1',
      messageID: 'a1',
      partID: 'p1',
      field: 'text',
      delta: ' there'
    })
    expect(mapper.map(delta)).toHaveLength(1)
    expect(mapper.map(delta)).toEqual([])
    expect(
      mapper.map(
        event('message.part.updated', {
          sessionID: 's1',
          part: textPart('Hi there', { time: { start: 1, end: 2 } }),
          time: 2
        })
      )
    ).toEqual([{ type: 'message.completed', sessionId: 's1', message: { text: 'Hi there' } }])
    const result = mapper.finish()
    expect(result).toEqual([
      {
        type: 'telemetry',
        sessionId: 's1',
        usage: {
          model: 'provider-1/model-1',
          inputTokens: 10,
          outputTokens: 20,
          cacheReadTokens: 4,
          cacheCreationTokens: 5,
          costUsd: 0.25
        }
      },
      { type: 'turn.ended', sessionId: 's1' }
    ])
    expect(mapper.finish()).toEqual([])
    expect(mapper.map(delta)).toEqual([])
  })

  it('ignores other sessions, user text and stale assistant turns while retaining compaction continuations', () => {
    const mapper = new OpenCodeEventMapper('s1', 'prompt-1')
    mapper.map(event('message.updated', { sessionID: 's2', info: assistantMessage('s2') }))
    mapper.map(
      event('message.updated', { sessionID: 's1', info: assistantMessage('s1', 'older-prompt') })
    )
    expect(mapper.sawAssistant).toBe(false)
    expect(
      mapper.map(event('message.part.updated', { sessionID: 's1', part: textPart('old'), time: 1 }))
    ).toEqual([])
    const user = {
      id: 'prompt-1',
      sessionID: 's1',
      role: 'user' as const,
      time: { created: 99 },
      agent: 'build',
      model: { providerID: 'provider-1', modelID: 'model-1' }
    }
    mapper.map(event('message.updated', { sessionID: 's1', info: user }))
    expect(
      mapper.map(
        event('message.part.updated', {
          sessionID: 's1',
          part: textPart('prompt', { messageID: user.id }),
          time: 99
        })
      )
    ).toEqual([])
    mapper.map(
      event('message.updated', {
        sessionID: 's1',
        info: { ...user, id: 'synthetic', time: { created: 105 } }
      })
    )
    mapper.map(
      event('message.updated', { sessionID: 's1', info: assistantMessage('s1', 'synthetic') })
    )
    expect(mapper.sawAssistant).toBe(true)
    expect(
      mapper.map(
        event('message.part.updated', { sessionID: 's1', part: textPart('new'), time: 106 })
      )
    ).toMatchObject([{ type: 'message.delta', delta: { text: 'new' } }])
  })

  it('settles reasoning, errors and auth failures without a false successful turn', () => {
    const mapper = new OpenCodeEventMapper('s1')
    mapper.map(event('message.updated', { sessionID: 's1', info: assistantMessage() }))
    expect(
      mapper.map(
        event('message.part.updated', {
          sessionID: 's1',
          time: 1,
          part: {
            id: 'reason',
            sessionID: 's1',
            messageID: 'a1',
            type: 'reasoning',
            text: 'Think',
            time: { start: 1, end: 2 }
          }
        })
      )
    ).toEqual([
      { type: 'message.reasoning.delta', sessionId: 's1', delta: { text: 'Think' } },
      { type: 'message.reasoning', sessionId: 's1', text: 'Think' }
    ])
    expect(
      mapper.map(
        event('message.updated', {
          sessionID: 's1',
          info: {
            ...assistantMessage(),
            error: {
              name: 'ProviderAuthError',
              data: { providerID: 'provider-1', message: 'no token' }
            }
          }
        })
      )
    ).toMatchObject([{ type: 'error', error: { category: 'auth_error' } }])
    expect(mapper.finish()).toEqual([])
  })
})
