import type { Root } from 'hast'
import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { markdownFrames } from './MarkdownHast'
import { MARKDOWN_COMMIT_MAX_NODES } from '../../compute/limits'

it('AC14′ splits 25,000 inline nodes inside one paragraph and preserves every earlier sibling', () => {
  const hast: Root = {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: Array.from({ length: 25000 }, (_, i) => ({
          type: 'element',
          tagName: i % 2 ? 'a' : 'code',
          properties: i % 2 ? { href: 'https://example.org' } : {},
          children: [{ type: 'text', value: String(i) }]
        }))
      }
    ]
  }
  const frames = markdownFrames({ hast, source: '' }, MARKDOWN_COMMIT_MAX_NODES, Infinity)
  let previous = 0
  let count = 0
  let html = ''
  for (let step = frames.next(); ; step = frames.next()) {
    html = renderToStaticMarkup(step.value)
    const ids = Array.from(html.matchAll(/>(\d+)<\/(?:code|a)>/g), (m) => Number(m[1]))
    expect(ids).toEqual(Array.from({ length: ids.length }, (_, i) => i))
    expect((ids.length - previous) * 2).toBeLessThanOrEqual(MARKDOWN_COMMIT_MAX_NODES)
    expect(ids.length).toBeGreaterThan(previous)
    previous = ids.length
    count++
    if (step.done) break
  }
  expect(count).toBeGreaterThan(1)
  expect(previous).toBe(25000)
  expect(html.match(/<p\b/g)).toHaveLength(1)
})

it('leaves already published partial child groups immutable for the React reconciler', () => {
  const hast: Root = {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: Array.from({ length: 301 }, (_, i) => ({
          type: 'element',
          tagName: 'strong',
          properties: {},
          children: [{ type: 'text', value: String(i) }]
        }))
      }
    ]
  }
  const frames = markdownFrames({ hast, source: '' }, 37, Infinity)
  const saved: { value: React.ReactNode; original: string }[] = []
  for (let step = frames.next(); !step.done; step = frames.next()) {
    saved.push({ value: step.value, original: renderToStaticMarkup(step.value) })
  }
  for (const frame of saved) expect(renderToStaticMarkup(frame.value)).toBe(frame.original)
})
