import { describe, expect, it } from 'vitest'
import { rangeArgs } from './git-diff'

describe('immutable range arguments', () => {
  it('uses B,H for cumulative diff and log, and skips an equal pair', () => {
    expect(
      rangeArgs({
        kind: 'cumulative',
        base: { kind: 'worktree-base', oid: 'B', ref: null },
        headOid: 'H'
      })
    ).toEqual({ diff: ['B', 'H'], log: 'B..H' })
    expect(
      rangeArgs({ kind: 'cumulative', base: { kind: 'head', oid: 'H' }, headOid: 'H' })
    ).toBeNull()
    expect(rangeArgs({ kind: 'cumulative', base: { kind: 'none' }, headOid: null })).toBeNull()
  })
  it('always uses P,C for selected commits regardless of the current HEAD', () => {
    expect(
      rangeArgs({ kind: 'commit', base: { kind: 'commit-parent', oid: 'P', commitOid: 'C' } })
    ).toEqual({ diff: ['P', 'C'], log: null })
    expect(
      rangeArgs({ kind: 'commit', base: { kind: 'commit-parent', oid: 'C', commitOid: 'C' } })
    ).toEqual({ diff: ['C', 'C'], log: null })
  })
})
