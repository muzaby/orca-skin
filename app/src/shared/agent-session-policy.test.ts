import { describe, expect, it } from 'vitest'
import { sessionContextPolicy } from './agent-session-policy'

describe('session context capability', () => {
  it.each([
    ['claude', 'code', false, 'exact'],
    ['claude', 'work', true, 'windows'],
    ['opencode', 'code', true, 'windows']
  ] as const)('%s %s preserves its context policy', (backend, kind, allowed, identity) => {
    expect(sessionContextPolicy(kind, backend)).toEqual({
      allowDirectoryUpdates: allowed,
      allowContextFileOpen: allowed,
      directoryIdentity: identity
    })
  })
})
