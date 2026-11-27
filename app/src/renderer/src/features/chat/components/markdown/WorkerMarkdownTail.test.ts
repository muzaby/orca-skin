import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('../../../../shared/i18n', async (original) => ({
  ...(await original<typeof import('../../../../shared/i18n')>()),
  useI18n: () => ({ tr: (key: string) => key })
}))
vi.mock('../../store/chatStore', () => ({ useActiveSessionKey: () => 'test-session' }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useId: () => 'test-id'
}))
import type { ComputeResults } from '../../../../shared/compute/protocol'
import { createElement } from 'react'
import { setComputeClient } from '../../../../shared/compute/client'
import { fakeComputeClient } from '../../../../shared/compute/fakeClient.testfixture'
import {
  installFakeDom,
  type FakeNode,
  type FakeDom
} from '../../../../shared/ui/renderHarness.testfixture'
import { StreamingMarkdown } from './StreamingMarkdown'
import { WorkerMarkdownTail } from './WorkerMarkdownTail'

let dom: FakeDom
let fake: ReturnType<typeof fakeComputeClient>
beforeEach(() => {
  dom = installFakeDom({ innerWidth: 900, innerHeight: 560 })
  fake = fakeComputeClient()
  setComputeClient(fake.client)
})
afterEach(() => {
  dom.unmount()
  setComputeClient(null)
  vi.unstubAllGlobals()
})
const render = (tail: string): void => dom.render(createElement(WorkerMarkdownTail, { tail }))
function element(node: FakeNode = dom.body): FakeNode | undefined {
  if (node.props['data-markdown-tail']) return node
  for (const child of node.children) {
    const found = element(child)
    if (found) return found
  }
  return undefined
}
const parsed = (value: string): ComputeResults['markdown'] => ({
  hast: { type: 'root' as const, children: [{ type: 'text' as const, value }] }
})
async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve()
  dom.act(() => {})
}
it('s13: 4,001자 원문에서 접두 파싱으로 바뀌고 50,000자 결과 커밋을 구분한다', async () => {
  const first = 'a'.repeat(4001)
  const next = first + 'b'.repeat(45999)
  const open = vi.spyOn(fake.client, 'openDocument')
  render(first)
  expect(element()?.props['data-markdown-tail']).toBe('raw')
  expect(element()?.props['data-markdown-tail-parsed']).toBeUndefined()
  fake.resolveNext(parsed('prefix'))
  await settle()
  render(next)
  const refs = open.mock.calls.map(([ref]) => ref)
  expect(refs).toHaveLength(2)
  expect(refs[1].id).toBe(refs[0].id)
  expect(refs[1].revision).not.toBe(refs[0].revision)
  expect(element()?.props['data-markdown-tail-parsed']).toBe(4001)
  expect(element()?.textContent).toBe('prefix' + next.slice(4001))
  fake.resolveNext(parsed('complete'))
  await settle()
  expect(element()?.props['data-markdown-tail-parsed']).toBe(50000)
  expect(element()?.textContent).toBe('complete')
  render(next + 'c')
  expect(fake.requests).toHaveLength(3)
  fake.resolveNext(parsed('last'))
  await settle()
  expect(element()?.props['data-markdown-tail-parsed']).toBe(50001)
})
it('s15: 같은 꼬리 인스턴스에서 공통 첫 문장 뒤가 다른 늦은 결과를 버리고 최신 대기 하나만 보낸다', async () => {
  const x = 'common. ' + 'x'.repeat(4492)
  const y = 'common. ' + 'y'.repeat(4991) + '\n'
  const stream = (source: string): void => dom.render(createElement(StreamingMarkdown, { source }))
  const confirmed = x + 'x'.repeat(1500) + '\n\n'
  stream(x)
  const sameTail = element()
  stream(x + 'x'.repeat(1500))
  stream(confirmed + y)
  expect(element()).toBe(sameTail)
  expect(fake.requests).toHaveLength(2)
  fake.resolveNext(parsed('X-only'))
  await settle()
  expect(element()?.props['data-markdown-tail']).toBe('raw')
  expect(element()?.textContent).toBe(y)
  expect(fake.requests).toHaveLength(3)
  expect(fake.requests[2]).toMatchObject({ kind: 'markdown', end: y.length })
  fake.resolveNext(parsed('confirmed'))
  fake.resolveNext(parsed('Y-only'))
  await settle()
  expect(element()?.props['data-markdown-tail-parsed']).toBe(y.length)
  expect(element()?.textContent).toBe('Y-only')
})
it('s11/s12: 확정 본문이나 delta 크기와 무관하게 열린 꼬리 길이로만 워커를 선택한다', () => {
  const prefix = 'stable '.repeat(1000) + '\n\n'
  const stream = (source: string): void => dom.render(createElement(StreamingMarkdown, { source }))
  stream(prefix + 'tail\n')
  expect(fake.requests).toHaveLength(1)
  stream(prefix + 'head\n' + 't'.repeat(3995))
  expect(fake.requests).toHaveLength(1)
  stream(prefix + 'head\n' + 't'.repeat(3996))
  expect(fake.requests).toHaveLength(2)
  expect(fake.requests[1]).toMatchObject({ kind: 'markdown', start: 0, end: 4001 })
})
it('s14: 블록 확정 후 짧은 꼬리에 이전 응답을 전달해도 현재 본문이 유지된다', async () => {
  const deliveries: (() => void)[] = []
  const text = 'X-marker ' + 'x'.repeat(9991)
  const client = fake.client
  setComputeClient({
    ...client,
    request() {
      return {
        promise: new Promise<never>((resolve) => {
          const value = deliveries.length ? text : 'late-only'
          deliveries.push(() => resolve(parsed(value) as never))
        }),
        setPriority: vi.fn(),
        cancel: vi.fn()
      }
    }
  })
  dom.render(createElement(StreamingMarkdown, { source: text }))
  expect(element()?.props['data-markdown-tail']).toBe('raw')
  dom.render(createElement(StreamingMarkdown, { source: text + '\n\nY-marker\n' }))
  expect(element()).toBeUndefined()
  deliveries[0]()
  deliveries[1]()
  await settle()
  expect(dom.body.textContent.match(/X-marker|Y-marker|late-only/g)).toEqual([
    'X-marker',
    'Y-marker'
  ])
})

it('s7/s8: 응답 사이 세 번 늘어난 꼬리 중 최신 문서만 열고 캐시를 건너뛴다', async () => {
  const client = fake.client
  const documents: number[] = []
  let leases = 0
  let peak = 0
  const cacheable: (boolean | undefined)[] = []
  setComputeClient({
    ...client,
    openDocument(ref, payload, lane) {
      documents.push(payload.text.length)
      peak = Math.max(peak, ++leases)
      const lease = client.openDocument(ref, payload, lane)
      return {
        ...lease,
        release() {
          leases--
          lease.release()
        }
      }
    },
    request(request, options) {
      cacheable.push(options?.cacheable)
      return client.request(request, options)
    }
  })
  for (let n = 4001; n <= 4007; n++) {
    render('a'.repeat(n))
    if ((n - 4001) % 3 === 2) {
      fake.resolveNext(parsed('prefix'))
      await settle()
    }
  }
  fake.resolveNext(parsed('prefix'))
  await settle()
  fake.resolveNext(parsed('done'))
  await settle()
  expect(documents).toEqual([4001, 4003, 4006, 4007])
  expect(peak).toBe(1)
  expect(leases).toBe(0)
  expect(cacheable).toEqual([false, false, false, false])
})
it('s1 starts long prose raw and queues the exact range', () => {
  render('a'.repeat(4001))
  expect(element()?.textContent).toBe('a'.repeat(4001))
  expect(fake.requests[0]).toMatchObject({ kind: 'markdown', start: 0, end: 4001 })
})
it('s2 renders only the matching parse result', async () => {
  render('a'.repeat(4001))
  fake.resolveNext(parsed('rendered'))
  await settle()
  expect(element()?.textContent).toBe('rendered')
})
it('s3 parsed prefix keeps unparsed suffix visible', async () => {
  const prefix = 'a'.repeat(4001)
  render(prefix)
  fake.resolveNext(parsed('rendered'))
  await settle()
  render(prefix + ' new')
  expect(element()?.textContent).toBe('rendered new')
})
it('s4 replaced prefix cannot publish stale markup', async () => {
  render('a'.repeat(4001))
  render('b'.repeat(4001))
  fake.resolveNext(parsed('stale'))
  await settle()
  expect(element()?.textContent).toBe('b'.repeat(4001))
})
it('s5 failed parse leaves exact source text', async () => {
  const text = '**unparsed**'.repeat(402)
  render(text)
  fake.rejectNext()
  await settle()
  expect(element()?.textContent).toBe(text)
})
it('s6 exactly 4000 stays in synchronous Markdown', () => {
  const source = 'a'.repeat(4000)
  dom.render(createElement(StreamingMarkdown, { source }))
  expect(element()).toBeUndefined()
  expect(dom.body.textContent).toBe(source)
  expect(fake.requests).toHaveLength(0)
})
it('AC8 parses a 50,001-char tail', async () => {
  const text = 'a'.repeat(50001)
  render(text)
  expect(fake.requests[0]).toMatchObject({ kind: 'markdown', start: 0, end: text.length })
  fake.resolveNext(parsed('done'))
  await settle()
  expect(element()?.props['data-markdown-tail']).toBe('parsed')
  expect(element()?.props['data-markdown-tail-parsed']).toBe(text.length)
})
it('s9 completing a parsed tail yields the same elements and text as completed Markdown', async () => {
  const { ClaudeAssistantSegment } =
    await import('../../harnesses/claude/transcript/AssistantSegment')
  const { agentUiPolicy } = await import('../../lib/agentPresentation')
  const { Markdown } = await import('../../../../shared/ui/markdown/Markdown')
  const source = '**completed** ' + 'x'.repeat(4001)
  render(source)
  fake.resolveNext(parsed(source))
  await settle()
  expect(element()?.props['data-markdown-tail']).toBe('parsed')
  dom.render(
    createElement(ClaudeAssistantSegment, {
      segment: { kind: 'text', text: source },
      transcriptPolicy: agentUiPolicy('code').transcript
    })
  )
  function snapshot(n: FakeNode): unknown {
    return [n.tag, n.text, n.children.map(snapshot)]
  }
  fake.resolveNext(
    (await import('../../../../shared/compute/worker/markdown')).parseMarkdown(source)
  )
  await settle()
  const completed = snapshot(dom.body)
  expect(element()).toBeUndefined()
  dom.render(createElement(Markdown, { source }))
  expect(completed).toEqual(snapshot(dom.body))
})

it('indexes a tail larger than one worker document before registering its pieces', async () => {
  const limit = 8_000_000
  const source = 'x'.repeat(limit) + '**last**'
  const open = vi.spyOn(fake.client, 'openDocument')
  render(source)
  expect(fake.requests).toHaveLength(1)
  expect(fake.requests[0].kind).toBe('markdownLayout')
  expect(open).toHaveBeenCalledTimes(0)
  fake.resolveNext({
    segments: [
      { start: 0, end: limit, blocks: [{ start: 0, end: limit }] },
      { start: limit, end: source.length, blocks: [{ start: 0, end: source.length - limit }] }
    ]
  })
  await settle()
  expect(open.mock.calls.map(([, content]) => content.text.length)).toEqual([limit, 8])
  expect(fake.requests.slice(1).map((request) => request.kind)).toEqual(['markdown', 'markdown'])
})

it.each(['OpenCode text', 'Claude reasoning'])(
  'f13: %s preserves the long final line during streaming and after the worker commits',
  async (screen) => {
    const { OpenCodeText } = await import('../../harnesses/opencode/transcript/Text')
    const { ReasoningBlock } = await import('../../harnesses/claude/transcript/ReasoningBlock')
    const { parseMarkdown } = await import('../../../../shared/compute/worker/markdown')
    const line = 'a'.repeat(50_000)
    const source = '~~~ts\n' + line
    const view = (streaming: boolean): void =>
      dom.render(
        screen === 'OpenCode text'
          ? createElement(OpenCodeText, { source, streaming })
          : createElement(ReasoningBlock, {
              items: [{ text: source }],
              defaultOpen: true,
              streaming
            })
      )
    function codeLines(node: FakeNode): string[] {
      return node.tag === 'code' && node.parent?.tag === 'pre'
        ? [node.textContent]
        : node.children.flatMap(codeLines)
    }
    view(true)
    expect(codeLines(dom.body)).toEqual([line])
    view(false)
    expect(dom.query('[data-md-block-pending]')?.textContent).toBe('')
    expect(dom.body.textContent).not.toContain('~~~ts')
    expect(fake.requests.at(-1)).toMatchObject({ kind: 'markdown', start: 0, end: source.length })
    fake.resolveNext(parseMarkdown(source))
    await settle()
    expect(codeLines(dom.body)).toEqual([line])
    expect(dom.query('[data-md-block-pending]')).toBeNull()
  }
)

it('AC20 retries the worker markdown tail after recovery', async () => {
  const source = 'a'.repeat(4100)
  render(source)
  fake.rejectNext()
  await settle()
  expect(element()?.textContent).toBe(source)
  expect(fake.requests).toHaveLength(1)
  fake.recover('markdown')
  await settle()
  expect(fake.requests).toHaveLength(2)
  fake.resolveNext(parsed('restored tail'))
  await settle()
  expect(element()?.textContent).toBe('restored tail')
  expect(element()?.props['data-markdown-tail']).toBe('parsed')
  fake.recover('markdown')
  await settle()
  expect(fake.requests).toHaveLength(2)
})
