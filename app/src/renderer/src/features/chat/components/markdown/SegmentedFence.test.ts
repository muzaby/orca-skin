import { createElement } from 'react'
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
