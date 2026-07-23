import { describe, expect, it } from 'vitest'
import { tokenizeComposerDecoration } from './composerDecoration'

describe('tokenizeComposerDecoration', () => {
  it('검증된 skill/file 토큰만 장식하고 원문 순서를 보존한다', () => {
    const segments = tokenizeComposerDecoration(
      'run /build with @"src/a b.ts" and /missing',
      new Set(['build']),
      new Set(['src/a b.ts'])
    )

    expect(segments.filter((segment) => segment.kind === 'chip')).toEqual([
      { kind: 'chip', chip: 'skill', text: '/build' },
      { kind: 'chip', chip: 'file', text: '@"src/a b.ts"' }
    ])
    expect(segments.map((segment) => segment.text).join('')).toBe(
      'run /build with @"src/a b.ts" and /missing'
    )
  })
})
