import { describe, expect, it } from 'vitest'
import { OpenCodeNativeInputs, nativeTaskCompletion } from './native-input'
import { openCodeEvent as event, textPart } from './adapter.testfixture'

function fixture(): OpenCodeNativeInputs {
  const inputs = new OpenCodeNativeInputs('s1', 'host')
  inputs.observe(
    event('message.updated', {
      sessionID: 's1',
      info: {
        id: 'host',
        sessionID: 's1',
        role: 'user',
        time: { created: 100 },
        agent: 'build',
        model: { providerID: 'provider', modelID: 'model' }
      }
    })
  )
  return inputs
}

describe('OpenCode native input receipts', () => {
  it('rejects unseen parts of retired user messages even at the same creation time', () => {
    const inputs = fixture()
    inputs.acceptPrompt('next', true)
    const header = (id: string): ReturnType<typeof event<'message.updated'>> =>
      event('message.updated', {
        sessionID: 's1',
        info: {
          id,
          sessionID: 's1',
          role: 'user',
          time: { created: 100 },
          agent: 'build',
          model: { providerID: 'p', modelID: 'm' }
        }
      })
    expect(inputs.observe(header('next')).userId).toBeUndefined()
    expect(inputs.observe(header('host')).userId).toBeUndefined()
    expect(
      inputs.observe(
        event('message.part.updated', {
          sessionID: 's1',
          time: 100,
          part: textPart('Old', { id: 'unseen-old', messageID: 'host', synthetic: true })
        })
      ).events
    ).toEqual([])
    expect(inputs.observe(header('native'), true).userId).toBe('native')
    expect(
      inputs.observe(
        event('message.part.updated', {
          sessionID: 's1',
          time: 100,
          part: textPart('Continue', { id: 'new-part', messageID: 'native', synthetic: true })
        })
      ).events
    ).toMatchObject([{ type: 'input.received', text: 'Continue' }])
  })

  it('preserves native synthetic parts and rejects own text, ignored and foreign inputs', () => {
    const inputs = fixture()
    const part = textPart('<system-reminder>Continue</system-reminder>', {
      messageID: 'host',
      synthetic: true
    })
    const received = inputs.observe(
      event('message.part.updated', { sessionID: 's1', part, time: 100 })
    )
    expect(received.events).toEqual([
      {
        type: 'input.received',
        nativeMessageId: 'host',
        sessionId: 's1',
        text: part.text,
        uuid: part.id,
        origin: { kind: 'automatic', format: 'system-reminder' }
      }
    ])
    for (const changed of [
      { id: 'own', synthetic: false },
      { id: 'ignored', ignored: true },
      { id: 'foreign', messageID: 'foreign-user' },
      { id: 'empty', text: '' }
    ])
      expect(
        inputs.observe(
          event('message.part.updated', {
            sessionID: 's1',
            part: { ...part, ...changed },
            time: 100
          })
        ).events
      ).toEqual([])
    expect(
      inputs.observe(
        event('message.part.updated', {
          sessionID: 'child',
          part: { ...part, id: 'child', sessionID: 'child' },
          time: 100
        })
      ).events
    ).toEqual([])
    expect(
      inputs.observe(
        event('message.updated', {
          sessionID: 's1',
          info: {
            id: 'stale',
            sessionID: 's1',
            role: 'user',
            time: { created: 99 },
            agent: 'build',
            model: { providerID: 'provider', modelID: 'model' }
          }
        })
      ).userId
    ).toBeUndefined()
  })

  it('deduplicates native part IDs but preserves equal text from different parts', () => {
    const inputs = fixture()
    const update = (id: string): ReturnType<typeof event<'message.part.updated'>> =>
      event('message.part.updated', {
        sessionID: 's1',
        time: 101,
        part: textPart('Continue', { id, messageID: 'host', synthetic: true })
      })
    expect(inputs.observe(update('one')).events).toHaveLength(1)
    expect(inputs.observe(update('one')).events).toEqual([])
    expect(inputs.observe(update('two')).events).toMatchObject([
      { text: 'Continue', origin: { format: 'plain' } }
    ])
  })

  it('accepts only complete native task completion envelopes', () => {
    expect(
      nativeTaskCompletion(
        '<task id="child" state="completed"><task_result>Done</task_result></task>'
      )
    ).toEqual({ id: 'child', status: 'completed' })
    expect(
      nativeTaskCompletion('<task id="child" state="error"><task_error>Failed</task_error></task>')
    ).toEqual({ id: 'child', status: 'error' })
    for (const text of [
      '<task id="child" state="running">Running</task>',
      'ordinary text',
      '<task id="child" state="completed">incomplete'
    ])
      expect(nativeTaskCompletion(text)).toBeUndefined()
  })
})
