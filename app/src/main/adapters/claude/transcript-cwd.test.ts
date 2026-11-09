import { describe, expect, it } from 'vitest'
import type { ClaudeHistoryEntry } from './native-history-map'
import { claudeTranscriptCwd } from './transcript-cwd'

const entry = (cwd: unknown): ClaudeHistoryEntry => ({ type: 'user', cwd })
const relocated = (relocatedCwd: unknown, cwd?: unknown): ClaudeHistoryEntry => ({
  type: 'relocated',
  relocatedCwd,
  ...(cwd === undefined ? {} : { cwd })
})

describe('claudeTranscriptCwd', () => {
  it.each<[string, ClaudeHistoryEntry[], string | undefined]>([
    ['C1 no relocated: first cwd wins over a later shell move', [entry('/a'), entry('/a/b')], '/a'],
    [
      'C2 a relocated stamp in the middle wins over later entries',
      [entry('/a'), relocated('/r', '/a'), entry('/b')],
      '/r'
    ],
    ['C3 the last relocated stamp wins', [entry('/a'), relocated('/r1'), relocated('/r2')], '/r2'],
    [
      'C4 empty or non-string relocatedCwd is ignored',
      [entry('/a'), relocated(''), relocated(7), entry('/b')],
      '/a'
    ],
    ['C5 no string cwd and no relocated stamp', [entry(undefined), entry(3)], undefined],
    [
      'C6 the first entry without cwd is skipped',
      [{ type: 'summary' }, entry('/a'), entry('/b')],
      '/a'
    ],
    [
      'C7 an empty relocated stamp after a valid one keeps the valid one',
      [entry('/a'), relocated('/r1'), relocated('')],
      '/r1'
    ]
  ])('%s', (_name, entries, expected) => {
    expect(claudeTranscriptCwd(entries)).toBe(expected)
  })

  it('does not treat relocatedCwd on a non-relocated entry as a relocation', () => {
    expect(
      claudeTranscriptCwd([entry('/a'), { type: 'user', cwd: '/b', relocatedCwd: '/r' }])
    ).toBe('/a')
  })
})
