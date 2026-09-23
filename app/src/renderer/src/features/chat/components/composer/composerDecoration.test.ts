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

  it('검증된 Plugin id는 label이 아닌 @id 토큰으로 별도 장식한다', () => {
    const segments = tokenizeComposerDecoration(
      '@jira-dc @unknown',
      new Set(),
      new Set(),
      new Set(['jira-dc'])
    )

    expect(segments).toEqual([
      { kind: 'chip', chip: 'plugin', text: '@jira-dc' },
      { kind: 'text', text: ' @unknown' }
    ])
  })

  it('draft 끝의 Plugin id도 chip으로 칠한다 — 끝 경계는 공백과 문자열 끝 둘 다다', () => {
    expect(
      tokenizeComposerDecoration('확인 @jira-dc', new Set(), new Set(), new Set(['jira-dc']))
    ).toEqual([
      { kind: 'text', text: '확인 ' },
      { kind: 'chip', chip: 'plugin', text: '@jira-dc' }
    ])
  })

  it('경로 토큰의 앞부분이 Plugin id와 같아도 Plugin chip으로 칠하지 않는다', () => {
    expect(
      tokenizeComposerDecoration(
        '@jira-dc/notes.md @jira-dc/missing',
        new Set(),
        new Set(['jira-dc/notes.md']),
        new Set(['jira-dc'])
      )
    ).toEqual([
      { kind: 'chip', chip: 'file', text: '@jira-dc/notes.md' },
      { kind: 'text', text: ' @jira-dc/missing' }
    ])
  })
})
