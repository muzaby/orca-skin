import { describe, expect, it } from 'vitest'
import { unifiedDiffLines } from './unifiedDiffLines'

describe('unified patch coordinates', () => {
  it('uses hunk offsets and preserves context/add/delete axes', () => {
    expect(
      unifiedDiffLines('--- a/a.ts\n+++ b/a.ts\n@@ -40,2 +40,2 @@\n same\n-old\n+new\n')
    ).toEqual([
      { type: 'unchanged', oldLine: 40, newLine: 40, lineNo: 40, text: 'same' },
      { type: 'removed', oldLine: 41, newLine: null, lineNo: 41, text: 'old' },
      { type: 'added', oldLine: null, newLine: 41, lineNo: 41, text: 'new' }
    ])
  })
  it('leaves invalid patch text to the raw fallback', () => {
    expect(unifiedDiffLines('unstructured output')).toEqual([])
  })
})
