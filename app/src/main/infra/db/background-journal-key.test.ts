import { expect, it } from 'vitest'
import type { ProviderMessageEvent } from '../../../shared/background-task'
import { backgroundJournalKey } from './background-task-queries'

it('preserves persisted journal keys across nested key ordering, arrays and undefined fields', () => {
  const event: ProviderMessageEvent = {
    type: 'provider.message',
    sessionId: 'session-golden',
    source: { generation: 'g1', sequence: 42, receivedAt: 100, replay: false, uuid: 'uuid-golden' },
    raw: { z: [{ z: 'last', a: 1 }, 2, undefined], missing: undefined, a: { y: true, a: null } }
  }
  // Measured with the pre-refactor implementation, before replacing canonical().
  const golden = 'c963878603a212611dba1d3043c4b9e2e65194d4bfa4d48bf1b4aa55a8546502'
  expect(backgroundJournalKey(event)).toBe(golden)
  expect(
    backgroundJournalKey({
      ...event,
      raw: { a: { a: null, y: true }, z: [{ a: 1, z: 'last' }, 2, undefined] }
    })
  ).toBe(golden)
  expect(
    backgroundJournalKey({ ...event, raw: { z: [2, { a: 1, z: 'last' }, undefined] } })
  ).not.toBe(golden)
  expect(backgroundJournalKey({ ...event, source: { ...event.source, replay: true } })).not.toBe(
    golden
  )
})
