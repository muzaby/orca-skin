import { describe, expect, it } from 'vitest'
import { resolveAgentKind, resolveAgentProfile } from './profiles'

describe('product agent profiles', () => {
  it('defaults only a new birth and inherits authoritative kinds', () => {
    expect(resolveAgentKind(undefined, undefined)).toEqual({ ok: true, kind: 'code' })
    expect(resolveAgentKind('work', undefined)).toEqual({ ok: true, kind: 'work' })
    expect(resolveAgentKind(undefined, 'work')).toEqual({ ok: true, kind: 'work' })
    expect(resolveAgentKind('work', 'work')).toEqual({ ok: true, kind: 'work' })
    expect(resolveAgentKind('code', 'work')).toEqual({ ok: false, reason: 'mismatch' })
    expect(resolveAgentKind('coding', undefined)).toEqual({ ok: false, reason: 'invalid' })
    expect(resolveAgentKind(undefined, 'invalid')).toEqual({ ok: false, reason: 'invalid' })
    expect(resolveAgentKind('invalid', undefined)).toEqual({ ok: false, reason: 'invalid' })
  })
  it('defines both execution profiles and returns a stable bounded work instruction', () => {
    expect(resolveAgentProfile('code')).toEqual({
      kind: 'code',
      persistResponseBoundaries: false
    })
    const work = resolveAgentProfile('work')
    expect(work).toBe(resolveAgentProfile('work'))
    expect(work.instructions).toContain('deliverable')
    expect(work.instructions).toContain('orcinus-orca')
    expect(work.instructions).not.toContain('user OS temporary folder')
    expect(Buffer.byteLength(work.instructions!)).toBeLessThanOrEqual(4096)
    expect(work.key).toBeTruthy()
    expect(work.persistResponseBoundaries).toBe(true)
  })
})
