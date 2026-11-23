import { describe, expect, it } from 'vitest'
import { buildCodeIndex, codeWindow } from '../../../shared/compute/codeView'
import { hunksToDiffLines } from '../../../shared/compute/diffModel'
import { packLines, unpackLines, type DiffOptions } from '../../../shared/compute/diffSource'
import {
  buildDiffView,
  diffViewContext,
  diffViewLocate,
  diffViewRows
} from '../../../shared/compute/diffView'
import { markdownDocumentBlocks } from './markdownDocumentBlocks'

describe('visible document windows', () => {
  it('preserves trailing empty lines, CRLF offsets and tab width', () => {
    const source = buildCodeIndex('x\r\n\t한\n')
    expect(codeWindow(source, 1, 100)).toEqual({
      lines: ['\t한', ''],
      lineCount: 3,
      widthColumns: 10,
      textChars: 3,
      charsBefore: 1
    })
    expect(codeWindow(source, 300, 400).lines).toEqual([])
  })

  it('locates a folded anchor before and after opening its context', () => {
    const lines = hunksToDiffLines([
      { value: 'same\n'.repeat(50) },
      { value: 'before\n', removed: true },
      { value: 'after\n', added: true }
    ])
    const packed = packLines(lines)
    expect(unpackLines(packed.text, packed.lines)).toEqual(lines)
    const model = buildDiffView(lines, false)
    const options: DiffOptions = {
      layout: 'side-by-side',
      ignoreWhitespace: false,
      highlightWords: true,
      expansions: []
    }
    const anchor = [{ oldLine: 20, newLine: 20 }]
    expect(diffViewLocate(model, options, anchor)).toEqual({ lineIndex: [19], rowIndex: [-1] })
    const open = { ...options, expansions: [[17, 21] as const] }
    const row = diffViewLocate(model, open, anchor).rowIndex[0]
    expect(diffViewRows(model, open, row, row + 1).rows[0]).toMatchObject({
      kind: 'pair',
      left: { sourceIndex: 19 },
      right: { sourceIndex: 19 }
    })
    expect(diffViewContext(model, 51)).toMatchObject({
      lines: lines.slice(48),
      offset: 3,
      oldBefore: 48,
      newBefore: 48
    })
  })

  it('partitions table rows without dropping the last row or the following block', () => {
    const header = '| a | b |\n| --- | --- |\n'
    const rows = Array.from({ length: 401 }, (_, i) => '| ' + i + ' | value |\n').join('')
    const text = header + rows + '\nNext paragraph'
    const [block, next] = markdownDocumentBlocks(text)
    expect(block.table?.map((chunk) => text.slice(...chunk.rows)).join('')).toBe(rows)
    expect(block.table).toHaveLength(3)
    expect(text.slice(next.start, next.end).trim()).toBe('Next paragraph')
  })
})

it('keys ordered anchor windows without embedding source text or dropping duplicates', async () => {
  const { requestKey } = await import('../../../shared/compute/protocol')
  const doc = { id: 'big', revision: 1 }
  const base = {
    kind: 'diffLocate' as const,
    source: { kind: 'lines' as const, doc },
    options: {
      layout: 'inline' as const,
      expansions: [],
      highlightWords: false,
      ignoreWhitespace: false
    }
  }
  const a = { oldLine: 1, newLine: null },
    b = { oldLine: null, newLine: 2 }
  const key = requestKey({ ...base, anchors: [a, b, a] })
  expect(key.length).toBeLessThan(120)
  expect(key).not.toBe(requestKey({ ...base, anchors: [b, a, a] }))
  expect(key).not.toBe(requestKey({ ...base, anchors: [a, b] }))
  expect(key).not.toBe(
    requestKey({
      ...base,
      source: { kind: 'lines', doc: { ...doc, revision: 2 } },
      anchors: [a, b, a]
    })
  )
})
it('reconstructs packed line and gutter windows inside the worker after eviction', async () => {
  const { createWorkerState } = await import('../../../shared/compute/worker/state')
  const run = createWorkerState(),
    doc = { id: 'read', revision: 1 }
  await run({ type: 'doc.open', ref: doc, text: '1\tfirst\n2\tsecond' })
  expect(
    await run({
      id: 1,
      kind: 'codeView',
      source: { view: { doc, transform: 'stripGutter' } },
      start: 1,
      end: 200
    })
  ).toMatchObject({ ok: true, result: { lines: ['second'] } })
  const options: DiffOptions = {
    layout: 'inline',
    expansions: [],
    ignoreWhitespace: false,
    highlightWords: true
  }
  for (let i = 0; i < 10; i++) {
    const lines = hunksToDiffLines([
      { value: 'old' + i, removed: true },
      { value: 'new' + i, added: true }
    ])
    const packed = packLines(lines),
      ref = { id: 'file' + i, revision: 1 }
    await run({ type: 'doc.open', ref, ...packed })
    expect(
      await run({
        id: 2 + i,
        kind: 'diffView',
        source: { kind: 'lines', doc: ref },
        options,
        start: 0,
        end: 2
      })
    ).toMatchObject({ ok: true, result: { summary: { rowCount: 2 } } })
  }
  const source = { kind: 'lines' as const, doc: { id: 'file0', revision: 1 } }
  expect(
    await run({ id: 14, kind: 'diffContext', source, ignoreWhitespace: false, lineIndex: 1 })
  ).toMatchObject({ ok: true, result: { lines: [{ text: 'old0' }, { text: 'new0' }], offset: 1 } })
  const token = await run({
    id: 15,
    kind: 'tokens',
    axis: { source, ignoreWhitespace: false, axis: 'new' },
    lang: 'typescript',
    theme: 'github-dark',
    start: 0,
    end: 1
  })
  expect(token).toMatchObject({ ok: true, result: { rows: [[{ content: 'new0' }]] } })
  await run({ type: 'doc.close', ref: source.doc })
  expect(await run({ id: 16, kind: 'diffLocate', source, options, anchors: [] })).toMatchObject({
    ok: false,
    error: 'unknown-doc'
  })
})

it.each([
  ['list', 'Before\n\n- first\n\n- second\n\nAfter'],
  ['quote', '> paragraph\n>\n> another\n\nPlain'],
  ['HTML', '<!-- hello\n\n# hidden\n\n-->\n\nText'],
  [
    'reference',
    'See [item][later].\n\nAnother paragraph.\n\n[later]: https://example.org "caption"'
  ],
  ['indented code', '    a\n\n    b\n\nProse'],
  ['fenced code', '~~~js\n\nconst x=1\n\n~~~\n\nMore'],
  ['footnote', 'A note[^1].\n\n[^1]: footnote text']
])('preserves whole-document Markdown structure for %s', async (_, text) => {
  const { markdownBlock, parseMarkdown } = await import('../../../shared/compute/worker/markdown')
  const doc = { text }
  const whole = parseMarkdown(text)
  if (!('hast' in whole)) throw Error('unexpected raw fixture')
  const nodes = markdownDocumentBlocks(text).flatMap((block) => {
    const parsed = markdownBlock(doc, {
      kind: 'markdown',
      doc: { id: 'fixture', revision: 1 },
      start: block.start,
      end: block.end
    })
    if (!('hast' in parsed)) throw Error('unexpected raw block')
    return parsed.hast.children
  })
  const structure = (items: typeof nodes): unknown =>
    JSON.parse(
      JSON.stringify(
        items.filter((n) => n.type !== 'text' || n.value !== '\n'),
        (k, v) => (k === 'position' ? undefined : v)
      )
    )
  expect(structure(nodes)).toEqual(structure(whole.hast.children))
})
