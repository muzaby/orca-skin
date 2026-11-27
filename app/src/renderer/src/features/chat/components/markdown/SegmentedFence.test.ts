import { fakeComputeClient } from '../../../../shared/compute/fakeClient.testfixture'
import { createElement } from 'react'
import { SegmentedFence } from './SegmentedFence'
import type { MarkdownRow } from './useMarkdownRows'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ComputeClient } from '../../../../shared/compute/client'
import { setComputeClient } from '../../../../shared/compute/client'
import {
  docKey,
  type ComputeRequest,
  type ComputeResult
} from '../../../../shared/compute/protocol'
import { compute } from '../../../../shared/compute/worker/handler'
import { markdownBlock } from '../../../../shared/compute/worker/markdown'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../../shared/ui/renderHarness.testfixture'
import { TranscriptMarkdown } from './MarkdownDocument'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useId: () => 'large-fence'
}))
// The fake DOM has no native soft-wrap measurement. Keep paragraph text readable
// when a regression incorrectly routes the fence through the prose renderer.
vi.mock('../../../../shared/ui/markdown/LongParagraphText', async () => {
  const { useEffect } = await import('react')
  return {
    LongParagraphText: ({ value, onComplete }: { value: string; onComplete?: () => void }) => {
      useEffect(() => {
        onComplete?.()
      }, [onComplete])
      return createElement('span', null, value)
    }
  }
})
vi.mock('../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
let dom: FakeDom
const SIZE = 8_000_000
let docs: Map<string, { text: string; users: number }>
let registered: number[]
let rejectFirstBlock: boolean
beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1000, innerHeight: 600 })
  docs = new Map()
  registered = []
  rejectFirstBlock = false
  async function computeRange(input: ComputeRequest): Promise<ComputeResult> {
    if (input.kind === 'markdown' && rejectFirstBlock) {
      rejectFirstBlock = false
      throw Error('parse failed')
    }
    return input.kind === 'markdown'
      ? markdownBlock(docs.get(docKey(input.doc))!, input)
      : compute(input)
  }
  const client: ComputeClient = {
    ...fakeComputeClient().client,
    openDocument(ref, { text }) {
      registered.push(text.length)
      if (text.length > SIZE) throw Error('individual registration exceeded')
      const key = docKey(ref)
      const tracked = docs.get(key) ?? { text, users: 0 }
      tracked.users++
      docs.set(key, tracked)
      if ([...docs.values()].reduce((sum, v) => sum + v.text.length, 0) > 32e6)
        throw Error('lane capacity exceeded')
      return {
        ref,
        available: true,
        onAvailable: () => () => {},
        release() {
          tracked.users--
          if (tracked.users === 0) docs.delete(key)
        }
      }
    },
    peek: () => undefined,
    request(input) {
      const promise = Promise.resolve().then(() => computeRange(input))
      return { promise: promise as Promise<never>, cancel: vi.fn(), setPriority: vi.fn() }
    }
  }
  setComputeClient(client)
})
afterEach(() => {
  dom.unmount()
  setComputeClient(null)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function tags(tag: string): FakeNode[] {
  const result: FakeNode[] = []
  function visit(node: FakeNode): void {
    if (node.tag === tag) result.push(node)
    for (const child of node.children) visit(child)
  }
  visit(dom.body)
  return result
}
it('VP-41 a single fenced block crossing the 8M registrations retains its language, full code and part selection', async () => {
  const opening = '  ~~~~typescript extra\r\n'
  const prefix = 'a'.repeat(SIZE + 13)
  const code = prefix + '🦦\n  z\n~~~'
  const source = opening + '  ' + prefix + '🦦\r\n\tz\r\n  ~~~\r\n  ~~~~\r\n**뒤**'
  const boundary = opening.length + 2 + SIZE
  dom.render(
    createElement(TranscriptMarkdown, {
      source,
      sourceParts: [
        { key: 'a', start: 0 },
        { key: 'b', start: boundary }
      ]
    })
  )
  for (let frame = 0; frame < 110 && !dom.query('[data-markdown-document="complete"]'); frame++) {
    for (let i = 0; i < 12; i++) await Promise.resolve()
    dom.frame()
  }
  const blocks = tags('pre')
  expect(blocks.length).toBe(1)
  expect(blocks[0].textContent.length).toBe(code.length)
  expect(blocks[0].textContent === code).toBe(true)
  expect(dom.body.textContent.includes('typescript')).toBe(true)
  expect(tags('strong')[0]?.textContent).toBe('뒤')
  const first = dom.query('[data-part-key="a"]')
  const second = dom.query('[data-part-key="b"]')
  expect(first?.textContent.length).toBe(SIZE)
  expect(second?.textContent.startsWith('a'.repeat(13) + '🦦')).toBe(true)
  expect(registered.some((n) => n === SIZE)).toBe(true)
})

it.each([
  ['regular block', '**bad**' + 'x'.repeat(4800)],
  ['segmented fence', '~~~ts\n' + 'x'.repeat(SIZE + 12) + '\n~~~']
])('keeps the source and finishes later rows when a %s fails', async (_name, first) => {
  rejectFirstBlock = true
  const later = Array.from({ length: 9 }, (_, i) => '**later' + i + '**' + 'y'.repeat(4100))
  dom.render(createElement(TranscriptMarkdown, { source: [first, ...later].join('\n\n') }))
  for (let frame = 0; frame < 160; frame++) {
    for (let i = 0; i < 12; i++) await Promise.resolve()
    dom.frame()
    if (dom.query('[data-markdown-document="error"]') && !dom.query('[data-md-block-pending]'))
      break
  }
  expect(dom.query('[data-md-block-error]')?.textContent.includes(first)).toBe(true)
  expect(tags('strong').at(-1)?.textContent).toBe('later8')
  expect(dom.query('[data-markdown-document="error"]')).not.toBeNull()
  expect(dom.query('[data-md-block-pending]')).toBeNull()
  expect(dom.query('[data-markdown-document="complete"]')).toBeNull()
})

it('VP-41 resolves footnotes on both sides of 8M in reference order with one footer and exact backlinks', async () => {
  const prefix = 'first[^B] and `[^a]` and \\[^a]\n\n[^a]: original **Alpha**'
  const after =
    'second[^A] again[^b], third[^c]\n\n[^b]: **Beta**\n\n[^a]: duplicate\n\n[^c]: Gamma\n\n**done**'
  const source = prefix + '\n\n~~~text\n' + 'z'.repeat(SIZE + 5) + '\n~~~\n\n' + after
  const start = source.indexOf(after)
  dom.render(
    createElement(TranscriptMarkdown, {
      source,
      sourceParts: [
        { key: 'first', start: 0 },
        { key: 'last', start }
      ]
    })
  )
  for (let frame = 0; frame < 500 && !dom.query('[data-markdown-document="complete"]'); frame++) {
    for (let turn = 0; turn < 14; turn++) await Promise.resolve()
    dom.frame()
  }
  const refs = dom.queryAll('[data-footnote-ref]')
  expect(refs.map((n) => [n.textContent, n.getAttribute('href'), n.getAttribute('id')])).toEqual([
    ['1', '#user-content-fn-b', 'user-content-fnref-b'],
    ['2', '#user-content-fn-a', 'user-content-fnref-a'],
    ['1', '#user-content-fn-b', 'user-content-fnref-b-2'],
    ['3', '#user-content-fn-c', 'user-content-fnref-c']
  ])
  expect(dom.queryAll('[data-footnotes]')).toHaveLength(1)
  expect(tags('li').map((n) => n.getAttribute('id'))).toEqual([
    'user-content-fn-b',
    'user-content-fn-a',
    'user-content-fn-c'
  ])
  expect(dom.queryAll('[data-footnote-backref]').map((n) => n.getAttribute('href'))).toEqual([
    '#user-content-fnref-b',
    '#user-content-fnref-b-2',
    '#user-content-fnref-a',
    '#user-content-fnref-c'
  ])
  const foot = dom.query('[data-footnotes]')!
  expect(foot.textContent).not.toContain('duplicate')
  expect(
    foot.querySelectorAll('[data-part-key="first"]').some((n) => n.textContent === 'Alpha')
  ).toBe(true)
  expect(
    foot.querySelectorAll('[data-part-key="last"]').some((n) => n.textContent === 'Beta')
  ).toBe(true)
  expect(dom.query('[data-markdown-document="complete"]')).toBeTruthy()
})

async function flushRecovery(): Promise<void> {
  for (let turn = 0; turn < 16; turn++) await Promise.resolve()
  dom.frame()
  for (let turn = 0; turn < 16; turn++) await Promise.resolve()
  dom.frame()
}

it('AC20 replaces a raw block with hast after recovery', async () => {
  const fake = fakeComputeClient()
  setComputeClient(fake.client)
  const source = '## ' + 'x'.repeat(4500)
  dom.render(createElement(TranscriptMarkdown, { source }))
  fake.rejectNext()
  await flushRecovery()
  expect(dom.query('[data-md-block-error]')?.textContent).toBe(source)
  expect(dom.query('[data-markdown-document="error"]')).not.toBeNull()
  expect(fake.requests).toHaveLength(1)
  fake.recover('markdown')
  await flushRecovery()
  expect(fake.requests).toHaveLength(2)
  fake.resolveNext({
    hast: {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'h2',
          properties: {},
          children: [{ type: 'text', value: 'restored' }]
        }
      ]
    }
  })
  await flushRecovery()
  expect(tags('h2')[0]?.textContent).toBe('restored')
  expect(dom.query('[data-markdown-document="complete"]')).not.toBeNull()
  fake.recover('markdown')
  await flushRecovery()
  expect(fake.requests).toHaveLength(2)
})

it('AC20 retries the failed segmented fence piece after recovery', async () => {
  const fake = fakeComputeClient()
  setComputeClient(fake.client)
  const source = '~~~js\nabcd\n~~~'
  const fence = { start: 0, end: source.length, bodyStart: 6, bodyEnd: 10, lang: 'js', indent: 0 }
  const pieces = [
    { start: 0, end: 8 },
    { start: 8, end: source.length }
  ].map(({ start, end }) => {
    const block = { start: 0, end: end - start, fence }
    return {
      block,
      segment: { start, end, text: source.slice(start, end), blocks: [block] },
      doc: { id: 'p' + start, revision: 1 }
    }
  })
  const row: MarkdownRow = {
    ...pieces[0],
    fencePieces: pieces,
    readSource: (a, b) => source.slice(a, b)
  }
  dom.render(createElement(SegmentedFence, { row, priority: 'visible' }))
  fake.resolveNext({ hast: { type: 'root', children: [{ type: 'text', value: 'ab' }] } })
  await flushRecovery()
  fake.rejectNext()
  await flushRecovery()
  expect(dom.query('[data-md-block-error]')?.textContent).toBe(source)
  expect(fake.requests).toHaveLength(2)
  fake.recover('markdown')
  await flushRecovery()
  expect(fake.requests).toHaveLength(3)
  expect(fake.requests[2]).toEqual(fake.requests[1])
  fake.resolveNext({ hast: { type: 'root', children: [{ type: 'text', value: 'cd' }] } })
  await flushRecovery()
  expect(tags('code')[0]?.textContent).toBe('abcd')
  fake.recover('markdown')
  await flushRecovery()
  expect(fake.requests.filter((r) => r.kind === 'markdown')).toHaveLength(3)
})
