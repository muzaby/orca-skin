import { describe, expect, it } from 'vitest'
import type { GitDiffPatch } from '../../../../../shared/ipc'
import { locateToolDiffPairs } from './toolDiffLocation'

const patch: GitDiffPatch = {
  isRepo: true,
  base: { kind: 'head', oid: 'base' },
  filesTruncated: false,
  contextLimited: false,
  unavailable: false,
  files: [
    {
      path: 'hello_world.ts',
      status: 'modified',
      added: 1,
      removed: 1,
      kind: 'text',
      lines: [
        { type: 'unchanged', oldLine: 45, newLine: 46, text: 'before' },
        {
          type: 'removed',
          oldLine: 46,
          newLine: null,
          text: 'async function animate(): Promise<void> {'
        },
        {
          type: 'added',
          oldLine: null,
          newLine: 47,
          text: 'async function animate2(): Promise<void> {'
        },
        { type: 'unchanged', oldLine: 47, newLine: 48, text: 'after' }
      ]
    }
  ]
}

describe('locateToolDiffPairs', () => {
  it('uses the Git patch old/new axes from the reported 46/47 example', () => {
    expect(
      locateToolDiffPairs(patch, 'C:\\repo\\hello_world.ts', [
        {
          oldValue: 'async function animate(): Promise<void> {',
          newValue: 'async function animate2(): Promise<void> {'
        }
      ])
    ).toEqual([{ oldStartLine: 46, newStartLine: 47 }])
  })

  it('hides both axes when either side is absent or ambiguous', () => {
    const duplicate = structuredClone(patch)
    duplicate.files[0].lines.push({
      type: 'added',
      oldLine: null,
      newLine: 90,
      text: 'async function animate2(): Promise<void> {'
    })
    expect(
      locateToolDiffPairs(duplicate, 'hello_world.ts', [
        {
          oldValue: 'async function animate(): Promise<void> {',
          newValue: 'async function animate2(): Promise<void> {'
        }
      ])
    ).toEqual([{ oldStartLine: null, newStartLine: null }])
  })

  it('returns no location for a missing or ambiguous file path', () => {
    expect(locateToolDiffPairs(patch, 'other.ts', [{ oldValue: 'a', newValue: 'b' }])).toEqual([
      { oldStartLine: null, newStartLine: null }
    ])
  })
})
