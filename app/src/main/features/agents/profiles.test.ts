import { describe, expect, it } from 'vitest'
import { resolveAgentKind, resolveAgentProfile } from './profiles'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
  it('preserves Code and applies the complete approved Work prompt with a fresh spawn key', () => {
    expect(resolveAgentProfile('code')).toEqual({
      kind: 'code',
      persistResponseBoundaries: false
    })
    const work = resolveAgentProfile('work')
    expect(work).toBe(resolveAgentProfile('work'))
    const approved = readFileSync(
      resolve('../docs/handoff/0234-work-prompt-profile/work-system-prompt.md'),
      'utf8'
    )
      .trim()
      .replace(/\r\n/g, '\n')
    expect(work.instructions).toBe(approved)
    expect(work.key).toBe('work:4')
    expect(work.persistResponseBoundaries).toBe(true)
  })
})
