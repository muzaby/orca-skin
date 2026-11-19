import { describe, expect, it } from 'vitest'
import { changesSince, foldChanges, newTranscriptChanges, recordChange } from './changeLog'

describe('transcript change log', () => {
  it('keeps the most recent 64 serializable changes and invalidates older and foreign cursors', () => {
    const original = newTranscriptChanges()
    let latest = original
    for (let index = 0; index < 1000; index++) {
      latest = recordChange(latest, { kind: 'append', ids: [String(index)] })
    }

    expect(original.log).toEqual([])
    expect(latest.revision).toBe(1000)
    expect(latest.log).toHaveLength(64)
    expect(latest.log[0]).toEqual({ kind: 'append', ids: ['936'] })
    expect(JSON.parse(JSON.stringify(latest.log))).toEqual(latest.log)
    expect(changesSince(latest, original)).toBe('reset')
    expect(changesSince(latest, { ...latest, revision: 936 })).toEqual(latest.log)
    expect(changesSince(latest, { ...latest, revision: 997 })).toEqual(latest.log.slice(-3))
    expect(changesSince(latest, { lineage: {}, revision: 999 })).toBe('reset')
    expect(changesSince(latest, latest)).toEqual([])
  })

  it('folds changes to the final membership and the first affected part', () => {
    expect(
      foldChanges([
        { kind: 'append', ids: ['removed'] },
        { kind: 'replace', id: 'removed', partsFrom: 1 },
        { kind: 'remove', ids: ['removed', 'readded'] },
        { kind: 'append', ids: ['readded'] },
        { kind: 'replace', id: 'readded', partsFrom: 5 },
        { kind: 'replace', id: 'edited', partsFrom: 3 },
        { kind: 'replace', id: 'edited', partsFrom: 1 }
      ])
    ).toEqual(
      new Map([
        ['removed', Infinity],
        ['readded', 0],
        ['edited', 1]
      ])
    )
  })
})
