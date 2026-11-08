import { describe, expect, it } from 'vitest'
import {
  displayedSessionIsolated,
  isOwnTurn,
  otherProjectTurns,
  ownTurnIdentity
} from './concurrencyNotice'

describe('concurrency notice identity', () => {
  it('N1 keeps the draft key after promotion and handles loaded/absent entries', () => {
    expect(ownTurnIdentity()).toEqual({ sessionId: null, clientKey: null })
    expect(ownTurnIdentity({ session: { sessionId: null }, clientKey: 'draft:a' })).toEqual({
      sessionId: null,
      clientKey: 'draft:a'
    })
    expect(ownTurnIdentity({ session: { sessionId: 's1' }, clientKey: 'draft:a' })).toEqual({
      sessionId: 's1',
      clientKey: 'draft:a'
    })
    expect(ownTurnIdentity({ session: { sessionId: 's1' } })).toEqual({
      sessionId: 's1',
      clientKey: null
    })
  })

  it.each([
    [{ sessionId: 's1', clientKey: null }, { sessionId: 's1', clientKey: null }, true],
    [{ sessionId: null, clientKey: 'draft:a' }, { sessionId: 's1', clientKey: 'draft:a' }, true],
    [{ sessionId: null, clientKey: null }, { sessionId: null, clientKey: null }, false],
    [{ sessionId: 's1', clientKey: null }, { sessionId: 's2', clientKey: null }, false],
    [{ sessionId: 's1', clientKey: 'draft:a' }, { sessionId: 's1', clientKey: null }, true],
    [{ sessionId: null, clientKey: 'draft:a' }, { sessionId: null, clientKey: 'draft:b' }, false]
  ] as const)('N2 compares non-null identity fields: %j / %j', (ref, own, expected) => {
    expect(isOwnTurn(ref, own)).toBe(expected)
  })

  it('N3 counts only other identities', () => {
    const own = { sessionId: 's1', clientKey: 'draft:a' }
    const other = { sessionId: 's2', clientKey: null }
    const other2 = { sessionId: 's3', clientKey: null }
    expect(otherProjectTurns([], own)).toBe(0)
    expect(otherProjectTurns([own], own)).toBe(0)
    expect(otherProjectTurns([own, other], own)).toBe(1)
    expect(otherProjectTurns([other, other2], own)).toBe(2)
  })

  it('I1 recognizes managed display and pending isolation independently', () => {
    expect(
      displayedSessionIsolated({
        worktree: { sourceCwd: '/r', repoRoot: '/r' },
        worktreeIsolation: false
      })
    ).toBe(true)
    expect(displayedSessionIsolated({ worktree: null, worktreeIsolation: true })).toBe(true)
    expect(displayedSessionIsolated({ worktree: null, worktreeIsolation: false })).toBe(false)
    expect(displayedSessionIsolated()).toBe(false)
  })
})
