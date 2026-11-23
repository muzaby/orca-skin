// 클라이언트 ↔ 워커 메시지 계약 (0324 VP-10) — 요청 3종을 실제 처리 함수에 넣고, 응답을
// 클라이언트의 파서(`parseResponse`)로 읽는다. 워커 프로세스만 빼고 같은 경로다.

import { describe, expect, it, vi } from 'vitest'
import { diffLinesWithinCap } from '../inline'
import { parseResponse, resultSize, type ComputeRequest, type WireResponse } from '../protocol'
import { handleMessage } from './handler'

async function roundTrip(
  request: ComputeRequest,
  id = 7
): Promise<Exclude<WireResponse, { ok: 'continue' }>> {
  // 워커 경계는 structured clone 이다 — JSON 왕복으로 "복제 가능한 값만 실린다"를 함께 본다.
  const wire = JSON.parse(JSON.stringify(await handleMessage({ ...request, id }))) as unknown
  const parsed = parseResponse(wire)
  if (!parsed || parsed.ok === 'continue') throw new Error('응답 형식이 아니다')
  return parsed
}

describe('워커 처리 함수', () => {
  it('highlight — 테마 색이 입혀진 HTML 을 낸다', async () => {
    const response = await roundTrip({
      kind: 'highlight',
      code: 'const a = 1',
      lang: 'typescript',
      theme: 'github-dark'
    })
    if (!response.ok || !('html' in response.result)) throw new Error('highlight 응답이 아니다')
    expect(response.id).toBe(7)
    expect(response.result.html).toContain('<pre class="shiki github-dark"')
    expect(response.result.html).toContain('const')
    expect(resultSize(response.result)).toBe(response.result.html.length)
  })

  it('highlight — 테마가 다르면 결과가 다르다', async () => {
    const html = async (theme: 'github-light' | 'github-dark'): Promise<string> => {
      const response = await roundTrip({
        kind: 'highlight',
        code: 'let x',
        lang: 'javascript',
        theme
      })
      return response.ok && 'html' in response.result ? response.result.html : ''
    }
    expect(await html('github-light')).not.toBe(await html('github-dark'))
  })

  it('diffTokens — 축마다 줄 수만큼 토큰 행을 내고 없는 축은 null 이다', async () => {
    const response = await roundTrip({
      kind: 'diffTokens',
      oldText: null,
      newText: 'const a = 1\nconst b = 2',
      lang: 'typescript',
      theme: 'github-light'
    })
    if (!response.ok || !('old' in response.result)) throw new Error('diffTokens 응답이 아니다')
    expect(response.result.old).toBeNull()
    expect(response.result.new?.map((row) => row.map((t) => t.content).join(''))).toEqual([
      'const a = 1',
      'const b = 2'
    ])
    // 0325 D-038 — 결과 문자 + 행·토큰마다 36. 응답은 워커가 센 그 크기를 싣는다.
    const rows = response.result.new!
    const tokens = rows.reduce((sum, row) => sum + row.length, 0)
    expect(resultSize(response.result)).toBe(
      'const a = 1const b = 2'.length + 36 * (rows.length + tokens)
    )
    expect(response.size).toBe(resultSize(response.result))
  })

  it('diffLines — UI 스레드의 상한 있는 계산과 같은 줄을 낸다', async () => {
    const response = await roundTrip({
      kind: 'diffLines',
      oldValue: 'a\nb\nc\n',
      newValue: 'a\nc\nd\n'
    })
    if (!response.ok || !('lines' in response.result)) throw new Error('diffLines 응답이 아니다')
    expect(response.result.lines).toEqual(diffLinesWithinCap('a\nb\nc\n', 'a\nc\nd\n'))
    // 0325 D-038 — 줄 문자 4 + 줄 4개 × 36.
    expect(resultSize(response.result)).toBe(4 + 4 * 36)
    expect(response.size).toBe(148)
  })

  it('계산이 던지면 그 요청만 실패 응답이 된다', async () => {
    const response = await roundTrip({
      kind: 'highlight',
      code: 'x',
      lang: 'no-such-language',
      theme: 'github-light'
    })
    expect(response.ok).toBe(false)
    expect(response.id).toBe(7)
  })
})

describe('parseResponse', () => {
  it.each([
    null,
    1,
    {},
    { id: 'x', ok: true, result: {} },
    { id: 1, ok: true },
    { id: 1, ok: false }
  ])('형식이 아닌 값 %j 은 null 이다', (raw) => expect(parseResponse(raw)).toBeNull())
})

it('h9 passes line length and time budgets to Shiki', async () => {
  const { getHighlighter } = await import('./highlighter')
  const highlighter = await getHighlighter(),
    spy = vi.spyOn(highlighter, 'codeToHtml')
  try {
    await roundTrip({
      kind: 'highlight',
      code: 'x'.repeat(32000),
      lang: 'javascript',
      theme: 'github-light'
    })
    expect(spy).toHaveBeenCalledWith(
      'x'.repeat(32000),
      expect.objectContaining({ tokenizeMaxLineLength: 20000, tokenizeTimeLimit: 50 })
    )
  } finally {
    spy.mockRestore()
  }
})
it('h12 eight warm models survive reverse traversal and rebuild on eviction or replacement', async () => {
  const { createWorkerState } = await import('./state'),
    diff = await import('../diffView'),
    spy = vi.spyOn(diff, 'buildDiffView')
  let run = createWorkerState()
  const doc = (i: number): { id: string; revision: number } => ({ id: 'fixture' + i, revision: 1 })
  const open = (i: number): Promise<WireResponse | undefined> =>
    run({
      type: 'doc.open',
      ref: doc(i),
      text: '+row',
      lines: { oldLine: Int32Array.of(-1), newLine: Int32Array.of(1) }
    })
  const query = (i: number): Promise<WireResponse | undefined> =>
    run({
      id: i,
      kind: 'diffView',
      source: { kind: 'lines', doc: doc(i) },
      options: { layout: 'inline', expansions: [], highlightWords: false, ignoreWhitespace: false },
      start: 0,
      end: 1
    })
  try {
    for (let i = 1; i <= 9; i++) {
      await open(i)
      await query(i)
    }
    expect(spy).toHaveBeenCalledTimes(9)
    for (let i = 9; i >= 2; i--) await query(i)
    expect(spy).toHaveBeenCalledTimes(9)
    await query(1)
    expect(spy).toHaveBeenCalledTimes(10)
    run = createWorkerState()
    expect(await query(1)).toMatchObject({ ok: false, error: 'unknown-doc' })
    await open(1)
    await query(1)
    expect(spy).toHaveBeenCalledTimes(11)
  } finally {
    spy.mockRestore()
  }
})
it('h13 stripped view supplies identical visible rows and Shiki colors and closes with source', async () => {
  const { createWorkerState } = await import('./state'),
    { getHighlighter } = await import('./highlighter'),
    run = createWorkerState(),
    doc = { id: 'read', revision: 1 },
    view = { doc, transform: 'stripGutter' as const },
    options = { lang: 'typescript', theme: 'github-dark' as const }
  const code = 'const n = 1\nreturn n',
    text = '1\tconst n = 1\n2\treturn n'
  await run({ type: 'doc.open', ref: doc, text })
  const req = { kind: 'codeView' as const, id: 1, source: { view }, start: 0, end: 2 }
  expect(await run(req)).toMatchObject({ ok: true, result: { lines: code.split('\n') } })
  const response = await run({ id: 2, kind: 'tokens', view, ...options, start: 0, end: 2 })
  if (
    !response ||
    response.ok !== true ||
    !('rows' in response.result) ||
    'summary' in response.result
  )
    throw Error('missing token rows')
  const colors = (rows: { content: string; color?: string }[][]): (string | undefined)[][][] =>
    rows.map((row) => row.map(({ content, color }) => [content, color]))
  expect(colors(response.result.rows)).toEqual(
    colors((await getHighlighter()).codeToTokens(code, options).tokens)
  )
  await run({ type: 'doc.close', ref: doc })
  expect(await run(req)).toMatchObject({ ok: false, error: 'unknown-doc' })
})
