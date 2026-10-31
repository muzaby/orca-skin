import { expect, it } from 'vitest'
import { OpenCodeEventMapper } from './map'
import { assistantMessage, openCodeEvent as event, textPart } from './adapter.testfixture'

it('ignores an old text delta replay after more than 4096 distinct events', () => {
  const mapper = new OpenCodeEventMapper('s1')
  mapper.map(event('message.updated', { sessionID: 's1', info: assistantMessage() }))
  mapper.map(event('message.part.updated', { sessionID: 's1', part: textPart('start'), time: 1 }))
  const delta = {
    ...event('message.part.delta', {
      sessionID: 's1',
      messageID: 'a1',
      partID: 'p1',
      field: 'text',
      delta: ' first'
    }),
    id: 'first-delta'
  }
  expect(mapper.map(delta)).toHaveLength(1)
  for (let index = 0; index < 4096; index++)
    mapper.map({ ...delta, id: `delta-${index}`, properties: { ...delta.properties, delta: '.' } })
  expect(mapper.map(delta)).toEqual([])
})
