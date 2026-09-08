import { describe, expect, it } from 'vitest'
import { resolveAgentKind, resolveAgentProfile } from './profiles'

describe('product agent profiles', () => {
  it('defaults only a new birth and inherits authoritative kinds', () => {
    expect(resolveAgentKind(undefined, undefined)).toEqual({ ok: true, kind: 'coding' })
    expect(resolveAgentKind('work', undefined)).toEqual({ ok: true, kind: 'work' })
    expect(resolveAgentKind(undefined, 'work')).toEqual({ ok: true, kind: 'work' })
    expect(resolveAgentKind('work', 'work')).toEqual({ ok: true, kind: 'work' })
    expect(resolveAgentKind('coding', 'work')).toEqual({ ok: false, reason: 'mismatch' })
    expect(resolveAgentKind(undefined, 'invalid')).toEqual({ ok: false, reason: 'invalid' })
    expect(resolveAgentKind('invalid', undefined)).toEqual({ ok: false, reason: 'invalid' })
  })
  it('keeps coding unchanged and returns a stable bounded work instruction', () => {
    expect(resolveAgentProfile('coding')).toEqual({ kind: 'coding' })
    const work = resolveAgentProfile('work')
    expect(work).toBe(resolveAgentProfile('work'))
    expect(work.instructions).toContain('deliverable')
    expect(Buffer.byteLength(work.instructions!)).toBeLessThanOrEqual(4096)
    expect(work.key).toBeTruthy()
  })
})
