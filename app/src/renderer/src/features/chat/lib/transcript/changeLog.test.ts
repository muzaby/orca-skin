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

  it('l1, l2, l3, l4, l6 track revision increments, multi-consumer cursors, 64-entry ring cap, and foreign lineage reset', () => {
    const base = newTranscriptChanges()
    // l1: 1 write -> 1 entry, revision +1
    const r1 = recordChange(base, { kind: 'append', ids: ['m1'] })
    expect(r1.revision).toBe(1)
    expect(changesSince(r1, base)).toEqual([{ kind: 'append', ids: ['m1'] }])

    // l2 & l6: 3 consumers at different revisions
    const r2 = recordChange(r1, { kind: 'replace', id: 'm1', partsFrom: 1 })
    const r3 = recordChange(r2, { kind: 'append', ids: ['m2'] })
    const r4 = recordChange(r3, { kind: 'remove', ids: ['m2'] })
    expect(changesSince(r4, r1)).toHaveLength(3)
    expect(changesSince(r4, r2)).toHaveLength(2)
    expect(changesSince(r4, r3)).toHaveLength(1)

    // l3: 1,000 appends -> ring cap 64, >64 behind returns reset
    let cur = r4
    for (let i = 0; i < 1000; i++) {
      cur = recordChange(cur, { kind: 'append', ids: [`k:${i}`] })
    }
    expect(cur.log).toHaveLength(64)
    expect(changesSince(cur, { lineage: cur.lineage, revision: cur.revision - 65 })).toBe('reset')
    expect(changesSince(cur, { lineage: cur.lineage, revision: cur.revision - 64 })).toHaveLength(
      64
    )

    // l4: foreign lineage -> reset
    expect(changesSince(cur, { lineage: {}, revision: cur.revision })).toBe('reset')
  })

  it('l5, l7, l9, l10 ensure fresh lineage, primitive-only entries (no Message/array refs), and fold semantics', () => {
    // l5: newTranscriptChanges creates distinct lineage at revision 0
    const a = newTranscriptChanges()
    const b = newTranscriptChanges()
    expect(a.lineage).not.toBe(b.lineage)
    expect(b.revision).toBe(0)

    // l7: entries hold only primitives and string id lists (no Message or part objects)
    const prependIds = Array.from({ length: 1000 }, (_, i) => `p:${i}`)
    const log = recordChange(a, { kind: 'prepend', ids: prependIds }).log
    expect(log[0]).toEqual({ kind: 'prepend', ids: prependIds })
    for (const entry of log) {
      for (const value of Object.values(entry)) {
        if (Array.isArray(value)) {
          expect(value.every((v) => typeof v === 'string')).toBe(true)
        } else {
          expect(['string', 'number', 'boolean'].includes(typeof value)).toBe(true)
        }
      }
    }

    // l9: append -> replace -> remove folds to withdrawal only (Infinity)
    expect(
      foldChanges([
        { kind: 'append', ids: ['x'] },
        { kind: 'replace', id: 'x', partsFrom: 2 },
        { kind: 'remove', ids: ['x'] }
      ]).get('x')
    ).toBe(Infinity)

    // l10: remove -> re-append folds to partsFrom = 0
    expect(
      foldChanges([
        { kind: 'remove', ids: ['y'] },
        { kind: 'append', ids: ['y'] }
      ]).get('y')
    ).toBe(0)
  })
})
