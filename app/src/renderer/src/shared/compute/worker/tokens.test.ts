import { afterEach, expect, it, vi } from 'vitest'
import { getHighlighter } from './highlighter'
import { tokensRange, type TokenDocument } from './tokens'
import type { TokensRequest, TokenRows } from '../protocol'
import { TOKENIZE_MAX_LINE_CHARS, TOKENIZE_LINE_TIME_LIMIT_MS } from '../limits'

const request: TokensRequest = {
  kind: 'tokens',
  doc: { id: 'source', revision: 1 },
  lang: 'typescript',
  theme: 'github-dark',
  start: 0,
  end: 0
}
const document = (text: string): TokenDocument => ({ text, chains: new Map() })
afterEach(() => vi.restoreAllMocks())

it.each([
  [0, [0]],
  [1, [1]],
  [49, [49]],
  [50, [50]],
  [51, [50, 1]],
  [100, [50, 50]],
  [101, [50, 50, 1]]
] as const)('t5 completes the final slice of %i lines', async (n, expected) => {
  const highlighter = await getHighlighter()
  const calls = vi.spyOn(highlighter, 'codeToTokens')
  const start = n === 0 ? 1 : 0
  const end = n === 0 ? 5 : n
  const cursor = tokensRange(
    document(Array(n).fill('let x=42').join('\n')),
    { ...request, start, end },
    highlighter,
    () => calls.mock.calls.length
  )
  const slices: number[] = []
  for (let step = 0; step <= expected.length; step++) {
    const before = calls.mock.calls.length
    const result = cursor.next()
    slices.push(calls.mock.calls.length - before)
    if (result.done) {
      expect(result.value.rows).toHaveLength(n)
      expect(slices).toEqual(expected)
      return
    }
    expect(result.value).toBe('continue')
  }
  throw Error('request never completed')
})

it('t1–t4/t6/t7/t8 keep grammar and text across checkpoints, themes and end of file', async () => {
  const h = await getHighlighter()
  // TextMate reads Date.now() between matches; keep this color fixture below the line timeout.
  vi.spyOn(Date, 'now').mockReturnValue(0)
  const lines = Array<string>(600).fill('const value = 1')
  lines[195] = '/*'
  lines[205] = '*/'
  lines[390] = 'const text = `'
  lines[401] = '`'
  lines[502] = 'x'.repeat(20001)
  const doc = document(lines.join('\r\n'))
  const colors = (rows: TokenRows): unknown =>
    rows.map((row) => row.map(({ content, color }) => ({ content, color })))
  for (const theme of ['github-dark', 'github-light'] as const) {
    const expected = h.codeToTokens(doc.text, {
      lang: request.lang,
      theme,
      tokenizeMaxLineLength: TOKENIZE_MAX_LINE_CHARS,
      tokenizeTimeLimit: TOKENIZE_LINE_TIME_LIMIT_MS
    }).tokens
    for (const [start, end] of [
      [0, 200],
      [190, 390],
      [400, 600],
      [580, 780],
      [600, 800],
      [700, 900]
    ]) {
      const result = tokensRange(doc, { ...request, theme, start, end }, h, () => 0).next()
      expect(result.done).toBe(true)
      if (result.done) expect(colors(result.value.rows)).toEqual(colors(expected.slice(start, end)))
    }
  }
  vi.restoreAllMocks()
  const compressed = 'const x={a:1};'.repeat(1000)
  const result = tokensRange(document(compressed), { ...request, end: 1 }, h, () => 0).next()
  expect(result.done && result.value.rows[0].map((token) => token.content).join('')).toBe(
    compressed
  )
})

it('resumes at cached grammar checkpoints within a theme and rebuilds an evicted chain', async () => {
  const h = await getHighlighter()
  const calls = vi.spyOn(h, 'codeToTokens')
  const doc = document(Array(450).fill('const x=1').join('\n'))
  const seek = (lang: string, theme: TokensRequest['theme']): number => {
    const before = calls.mock.calls.length
    const result = tokensRange(
      doc,
      { ...request, lang, theme, start: 401, end: 402 },
      h,
      () => 0
    ).next()
    expect(result.done).toBe(true)
    return calls.mock.calls.length - before
  }
  expect(seek('typescript', 'github-dark')).toBe(402)
  expect(seek('typescript', 'github-dark')).toBe(2)
  expect(seek('typescript', 'github-light')).toBe(402)
  expect(seek('javascript', 'github-dark')).toBe(402)
  expect(seek('typescript', 'github-dark')).toBe(402)
})
