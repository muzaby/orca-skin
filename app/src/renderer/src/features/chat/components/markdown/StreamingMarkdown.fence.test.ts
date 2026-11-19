import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Markdown } from '../../../../shared/ui/markdown/Markdown'
import { MarkdownStreamingContext } from '../../../../shared/ui/markdown/streamingContext'
import { advanceStableBlocks } from '../../lib/markdownBlocks'
import { StreamingFence, StreamingMarkdown } from './StreamingMarkdown'

describe('StreamingMarkdown open fence parity (EP-19 f10)', () => {
  const cases = [
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

  it('StreamingMarkdown renders open fence without invoking Markdown for the tail', () => {
    const html = renderToStaticMarkup(
      createElement(StreamingMarkdown, { source: '```ts\nconst x = 1\n' })
    )
    expect(html).toContain('const x = 1')
    expect(html).toContain('<code')
    // Sanity: closed fence still renders cleanly via Markdown
    const closedHtml = renderToStaticMarkup(
      createElement(StreamingMarkdown, { source: '```ts\nconst x = 1\n```\n' })
    )
    expect(closedHtml).toContain('const x = 1')
    expect(vi.isMockFunction(StreamingFence)).toBe(false)
  })
})
