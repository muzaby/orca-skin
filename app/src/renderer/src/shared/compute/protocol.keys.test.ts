import { expect, it } from 'vitest'
import { requestKey, requestSize, type ComputeRequest, type TokensRequest } from './protocol'
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

it('pk7 sizes each work kind in characters, counting only the requested window', () => {
  const inputs: [ComputeRequest, number][] = [
    [{ ...tokens, start: 3, end: 203 }, 20_000],
    [{ kind: 'diffView', source, options, start: 11, end: 61 }, 5_000],
    [{ kind: 'codeView', source: { doc }, start: 1, end: 301 }, 30_000],
    [{ kind: 'diffContext', source, ignoreWhitespace: false, lineIndex: 18 }, 700],
    [
      {
        kind: 'diffLocate',
        source,
        options,
        anchors: [1, 2, 3].map((oldLine) => ({ oldLine, newLine: null }))
      },
      48
    ],
    [{ kind: 'markdown', doc, start: 7, end: 5_007 }, 5_000],
    [{ kind: 'highlight', code: 'abc', lang: 'ts', theme: 'github-light' }, 3]
  ]
  for (const [request, expected] of inputs) {
    expect(
      requestSize(request, () => ({ chars: 1000, lines: 10 })),
      request.kind
    ).toBe(expected)
  }
})

it('pk7b weights paired documents by sampled lines', () => {
  const other = { id: 'other', revision: 4 }
  const pair = { kind: 'pair' as const, old: doc, new: other }
  expect(
    requestSize({ kind: 'diffView', source: pair, options, start: 4, end: 6 }, (ref) =>
      ref === doc ? { chars: 100, lines: 10 } : { chars: 9900, lines: 90 }
    )
  ).toBe(200)
})

it('pk7c resolves derived token axes and stripped views back to their source samples', () => {
  const view = { doc, transform: 'stripGutter' as const }
  const axis = { source, axis: 'old' as const, ignoreWhitespace: false }
  const window = { start: 2, end: 5 }
  const tokenOptions = {
    kind: 'tokens' as const,
    lang: tokens.lang,
    theme: tokens.theme,
    ...window
  }
  for (const input of [
    { ...tokenOptions, axis },
    { ...tokenOptions, view },
    { kind: 'codeView' as const, source: { view }, ...window }
  ]) {
    expect(
      requestSize(input, (ref) => {
        expect(ref).toBe(doc)
        return { chars: 7, lines: 2 }
      })
    ).toBe(10.5)
  }
})

it('pk3 separates context windows by anchor, source revision and whitespace policy', () => {
  const context = { kind: 'diffContext' as const, source, ignoreWhitespace: false, lineIndex: 6 }
  distinct(
    context,
    { ...context, lineIndex: 7 },
    { ...context, ignoreWhitespace: true },
    { ...context, source: { kind: 'patch', doc: { ...doc, revision: 13 } } }
  )
})
