import { describe, expect, it } from 'vitest'
import { activeTurnRef } from './active-turn-ref'

describe('activeTurnRef', () => {
  it.each([
    [true, null, 'draft:a', { sessionId: null, clientKey: 'draft:a' }],
    [false, 's1', 's1', { sessionId: 's1', clientKey: null }],
    [false, 's1', undefined, { sessionId: 's1', clientKey: null }],
    [true, null, undefined, { sessionId: null, clientKey: null }]
  ] as const)('A1 new=%s sid=%s key=%s', (isNewSession, dbSessionId, queueKey, expected) => {
    expect(activeTurnRef({ isNewSession, dbSessionId, queueKey })).toEqual(expected)
  })
})
