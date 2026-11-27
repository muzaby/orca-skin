import { load } from 'cheerio'
import type { Plugin } from 'unified'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Markdown } from '../../../../shared/ui/markdown/Markdown'
import { MarkdownStreamingContext } from '../../../../shared/ui/markdown/streamingContext'
import { ReasoningBlock } from '../../harnesses/claude/transcript/ReasoningBlock'
import { OpenCodeText } from '../../harnesses/opencode/transcript/Text'
import { advanceStableBlocks } from '../../../../shared/markdown/markdownBlocks'
import { StreamingFence, StreamingMarkdown } from './StreamingMarkdown'

const parsedSource = vi.hoisted(() => vi.fn<(source: string) => void>())

vi.mock('remark-gfm', async (importOriginal) => {
  const original = await importOriginal<typeof import('remark-gfm')>()
  const observeParse: Plugin = function () {
    original.default.call(this)
    return (_tree, file) => {
      parsedSource(String(file))
    }
  }
  return { ...original, default: observeParse }
})

describe('StreamingMarkdown open fence parity (EP-19 f10)', () => {
  it('uses the same wrapper typography for an open fence and committed Markdown', () => {
    const source = '~~~text\nbody'
    const fence = advanceStableBlocks(null, source).openFence!
    for (const className of [undefined, '', 'custom-code']) {
      const open = load(renderToStaticMarkup(createElement(StreamingFence, { fence, className })))
      const committed = load(renderToStaticMarkup(createElement(Markdown, { source, className })))
      const expected = committed('body > div').attr('class')
      expect(open('body > div').attr('class')).toBe(expected)
      if (className !== undefined) expect(expected).toBe(className)
    }
  })

  it.each([
    ['plain **tail**', 'strong', 'tail'],
    ['```js\nconst tail', 'pre code', 'tail']
  ])('keeps part offsets when a stable paragraph is followed by %s', (tail, selector, end) => {
    const source = 'stable word\n\n' + tail
    const html = renderToStaticMarkup(
      createElement(StreamingMarkdown, {
        source,
        sourceParts: [
          { start: 0, key: 'first' },
          { start: 7, key: 'second' },
          { start: source.indexOf('tail'), key: 'last' }
        ]
      })
    )
    const $ = load(html)
    expect($('p [data-part-key="first"]').text()).toBe('stable ')
    expect($('p [data-part-key="second"]').first().text()).toBe('word')
    expect($(`${selector} [data-part-key="last"]`).text()).toBe(end)
  })

  it.each([
    [' ~~~\n\tcode\n', '   '],
    ['   ~~~\n  \tcode\n', ' '],
    ['  ~~~\r\n \tcode\r\n', '  ']
  ])(
    'keeps spaces from a partially consumed tab in the source part that owns the tab',
    (source, spaces) => {
      const sourceParts = [
        { key: 'prefix', start: 0 },
        { key: 'tab', start: source.indexOf('\t') },
        { key: 'body', start: source.indexOf('code') }
      ]
      for (const component of [StreamingMarkdown, Markdown]) {
        const html = renderToStaticMarkup(createElement(component, { source, sourceParts }))
        const $ = load(html)
        expect($('pre code [data-part-key="prefix"]')).toHaveLength(0)
        expect($('pre code [data-part-key="tab"]').text()).toBe(spaces)
        expect($('pre code [data-part-key="body"]').text()).toBe('code')
      }
    }
  )

  it.each(['\u00a0', '\u2003', '\u202f'])(
    'preserves a paragraph containing non-ASCII whitespace before a fence (%s)',
    (space) => {
      const source = space + '\n~~~js\ncode\n'
      const paragraphs = (component: typeof StreamingMarkdown | typeof Markdown): string[] => {
        const $ = load(renderToStaticMarkup(createElement(component, { source })))
        return $('p, pre')
          .map((_, node) => $(node).text())
          .get()
      }
      expect(paragraphs(Markdown)).toEqual([space, 'code'])
      expect(paragraphs(StreamingMarkdown)).toEqual(paragraphs(Markdown))
    }
  )

  it.each(['\u2028', '\u2029'])(
    'preserves code indentation after a Unicode separator (%s)',
    (separator) => {
      const body = 'left' + separator + '   center' + separator + '\tright'
      const source = '   ~~~ts\n   ' + body + '\n'
      for (const Component of [Markdown, StreamingMarkdown]) {
        const $ = load(renderToStaticMarkup(createElement(Component, { source })))
        expect($('pre code').text()).toBe(body)
      }
    }
  )

  const cases = [
    ['f1: encoded fence info', '~~~c&#43;&#43; metadata\nint main() {}\n'],
    ['f1: line separator inside info', '~~~js\u2028metadata\ncode\n'],
    ['f1: paragraph separator inside info', '~~~js\u2029metadata\ncode\n'],
    ['f1: escaped punctuation in info', '~~~c\\+\\+ description\nint x;\n'],
    ['f1: encoded space ends language', '~~~ts&#x20;metadata\nlet x\n'],
    ['f1: non-ASCII leading space in info', '~~~\u00a0ts\nlet x\n'],
    ['f6: raw tabs after indent', '   ~~~\n   \tcode\n    \tmore\n'],
    ['f6: partial tab indentation', '   ~~~\n\tcode\n  \tmore\n'],
    ['f1: backtick + info', '```ts\nconst x = 1\n'],
    ['f2: tilde 4 with inner 3', '~~~~py\nprint(1)\n~~~\nprint(2)\n'],
    ['f5: closing candidate with trailing char', '```ts\nconst x = 1\n```x\n'],
    ['f6: indent 3', '   ```js\n   const a = 1\n'],
    ['f7: CRLF', '```ts\r\nconst a = 1\r\n'],
    ['f11: unfinished last line', '```ts\nconst a = 1\nconst b = 2']
  ] as const

  it.each(cases)(
    'f10: %s renders identical markup to Markdown in streaming context',
    (_name, src) => {
      const res = advanceStableBlocks(null, src)
      expect(res.openFence).not.toBeNull()
      const fenceHtml = renderToStaticMarkup(
        createElement(
          MarkdownStreamingContext.Provider,
          { value: true },
          createElement(StreamingFence, { fence: res.openFence! })
        )
      )
      const markdownHtml = renderToStaticMarkup(
        createElement(
          MarkdownStreamingContext.Provider,
          { value: true },
          createElement(Markdown, { source: src })
        )
      )
      expect(fenceHtml).toBe(markdownHtml)
    }
  )

  it.each([
    ['unfinished body', '~~~ts\nalpha\nbeta', 'alpha\nbeta', 'alpha\nbeta'],
    ['unterminated close line', '~~~ts\nalpha\n~~~', 'alpha\n~~~', 'alpha'],
    ['long final line', '~~~ts\n' + 'a'.repeat(50_000), 'a'.repeat(50_000), 'a'.repeat(50_000)]
  ])('f11·f12·f13: %s in the live and committed harness renderers', (_, source, live, final) => {
    const reference = load(renderToStaticMarkup(createElement(Markdown, { source })))(
      'pre code'
    ).text()
    expect(reference).toBe(final)
    for (const streaming of [true, false]) {
      const renderers = [
        createElement(OpenCodeText, { source, streaming }),
        createElement(ReasoningBlock, { items: [{ text: source }], streaming, defaultOpen: true })
      ]
      for (const renderer of renderers) {
        const code = load(renderToStaticMarkup(renderer))('pre code')
        expect(code).toHaveLength(1)
        expect(code.text()).toBe(streaming ? live : reference)
      }
    }
  })

  it('parses only the stable prefix and preserves the whole open body after that prefix', () => {
    parsedSource.mockClear()
    const prefix = 'stable **paragraph**'
    const body = '1234567890'.repeat(5)
    const source = prefix + '\n\n~~~ts\n' + body
    const $ = load(renderToStaticMarkup(createElement(StreamingMarkdown, { source })))
    expect($('pre code').text()).toBe(body)
    expect(parsedSource.mock.calls).toEqual([[prefix]])
  })

  it('StreamingMarkdown renders open fence without invoking Markdown for the tail', () => {
    parsedSource.mockClear()
    const html = renderToStaticMarkup(
      createElement(StreamingMarkdown, { source: '```ts\nconst x = 1\n' })
    )
    expect(html).toContain('const x = 1')
    expect(html).toContain('<code')
    expect(parsedSource).not.toHaveBeenCalled()
    const closedHtml = renderToStaticMarkup(
      createElement(StreamingMarkdown, { source: '```ts\nconst x = 1\n```\n' })
    )
    expect(closedHtml).toContain('const x = 1')
    expect(parsedSource.mock.calls).toEqual([['```ts\nconst x = 1\n```\n']])
  })
})
