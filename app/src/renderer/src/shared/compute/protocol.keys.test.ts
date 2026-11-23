import { expect, it } from 'vitest'
import { requestKey, type ComputeRequest, type TokensRequest } from './protocol'
import type { DiffOptions, DiffSourceRef } from './diffSource'
const doc = { id: 'fixture', revision: 12 }
const source: DiffSourceRef = { kind: 'patch', doc }
const options: DiffOptions = {
  layout: 'inline',
  ignoreWhitespace: false,
  highlightWords: false,
  expansions: []
}
const tokens: TokensRequest = {
  kind: 'tokens',
  doc,
  lang: 'typescript',
  theme: 'github-dark',
  start: 1,
  end: 12
}
function distinct(...requests: ComputeRequest[]): void {
  expect(new Set(requests.map(requestKey)).size).toBe(requests.length)
}
it('pk1 document size does not increase key length', () => {
  const source = { ...doc, text: 'x'.repeat(4_000_000) }
  const key = requestKey({ ...tokens, doc: source })
  expect(key).toBe(requestKey(tokens))
  expect(key.length).toBeLessThanOrEqual(doc.id.length + 96)
})
it('pk2 token revision, theme, language and range each distinguish requests', () => {
  distinct(
    tokens,
    { ...tokens, doc: { ...doc, revision: 13 } },
    { ...tokens, lang: 'rust' },
    { ...tokens, theme: 'github-light' },
    { ...tokens, start: 2 },
    { ...tokens, end: 11 }
  )
})
it('pk3 diff options and expansions distinguish requests', () => {
  const base = { kind: 'diffView' as const, source, options, start: 0, end: 12 }
  distinct(
    base,
    ...[
      { ...options, layout: 'side-by-side' as const },
      { ...options, ignoreWhitespace: true },
      { ...options, highlightWords: true },
      { ...options, expansions: [[1, 3]] as const }
    ].map((options) => ({ ...base, options }))
  )
})
it('pk4 markdown and code windows distinguish bounds and document', () => {
  for (const kind of ['codeView', 'markdown'] as const) {
    const req = (start: number, end: number, revision: number): ComputeRequest =>
      kind === 'markdown'
        ? { kind, doc: { ...doc, revision }, start, end }
        : { kind, source: { doc: { ...doc, revision } }, start, end }
    distinct(req(0, 2, 1), req(1, 2, 1), req(0, 3, 1), req(0, 2, 2))
  }
})
it('pk5 axis, source kind and whitespace policy distinguish token rows', () => {
  const key = (
    axis: 'old' | 'new',
    ignoreWhitespace: boolean,
    src: DiffSourceRef
  ): ComputeRequest => ({
    kind: 'tokens',
    axis: { axis, ignoreWhitespace, source: src },
    theme: tokens.theme,
    lang: tokens.lang,
    start: 1,
    end: 12
  })
  distinct(
    key('old', false, source),
    key('new', false, source),
    key('old', true, source),
    key('old', false, { kind: 'lines', doc }),
    tokens
  )
})
it('pk6 preserves anchor order, duplicates, missing sides and view transform', () => {
  const a = { oldLine: null, newLine: 4 },
    b = { oldLine: 4, newLine: null }
  const locate = (
    anchors: (typeof a)[] | { oldLine: number | null; newLine: number | null }[]
  ): ComputeRequest => ({ kind: 'diffLocate', source, options, anchors })
  distinct(locate([a, b]), locate([b, a]), locate([a, a, b]), locate([a]), locate([b]))
  const view = { doc, transform: 'stripGutter' as const }
  distinct(
    { kind: 'codeView', source: { view }, start: 0, end: 2 },
    { kind: 'codeView', source: { doc }, start: 0, end: 2 }
  )
})
