// 코드 블록 강조의 순서 (0324 AC8) — 워커 응답 전에는 원문, 응답 후에는 응답 HTML,
// 상한을 넘는 코드는 요청하지 않는다. 계산 클라이언트는 가짜를 넣는다.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../i18n', () => {
  const tr = (key: string): string => key
  return { useI18n: () => ({ tr }) }
})
import { createElement } from 'react'
import { CachedHighlightOnly } from '../../compute/useHighlightedHtml'
import { setComputeClient } from '../../compute/client'
import { fakeComputeClient, type FakeCompute } from '../../compute/fakeClient.testfixture'
import { HIGHLIGHT_MAX_CHARS } from '../../compute/limits'
import { installFakeDom, type FakeDom, type FakeNode } from '../renderHarness.testfixture'
import * as themeStore from './themeStore'
import { CodeBlock } from './CodeBlock'
import { MarkdownStreamingContext } from './streamingContext'

let dom: FakeDom
let compute: FakeCompute

beforeEach(() => {
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 800 })
  compute = fakeComputeClient()
  setComputeClient(compute.client)
})
afterEach(() => {
  dom.unmount()
  setComputeClient(null)
  vi.unstubAllGlobals()
})

async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve()
  dom.act(() => {})
}
const render = (code: string, lang = 'typescript'): void =>
  dom.render(createElement(CodeBlock, { code, lang, showHeader: false }))
// 하네스의 selector 는 태그를 받지 않는다 — 트리를 직접 걷는다.
function nodes(root: FakeNode = dom.body): FakeNode[] {
  return [root, ...root.children.flatMap((child) => nodes(child))]
}
const pre = (): FakeNode | undefined => nodes().find((node) => node.tag === 'pre')
const injected = (): FakeNode | undefined =>
  nodes().find((node) => node.props.dangerouslySetInnerHTML)
const innerHtml = (): string | undefined =>
  (injected()?.props.dangerouslySetInnerHTML as { __html: string } | undefined)?.__html

describe('CodeBlock — 계산 워커 강조', () => {
  it('cb1: 같은 코드로 열 번 다시 그려도 줄 번호는 한 번만 계산한다', () => {
    const code = 'first\nsecond\n'
    const theme = vi.spyOn(themeStore, 'getThemeSnapshot')
    const split = vi.spyOn(String.prototype, 'split')
    try {
      for (let pass = 0; pass <= 10; pass++) {
        theme.mockReturnValue(pass % 2 ? 'github-dark' : 'github-light')
        dom.render(
          createElement(CodeBlock, {
            code,
            showLineNumbers: true,
            embedded: pass % 2 === 0,
            showHeader: false
          })
        )
        expect(pre()?.textContent).toBe('1\n2\n3' + code)
      }
      expect(split.mock.contexts.filter((value) => String(value) === code)).toHaveLength(1)
      dom.render(
        createElement(CodeBlock, { code: 'new', showLineNumbers: true, showHeader: false })
      )
      expect(pre()?.textContent).toBe('1new')
    } finally {
      split.mockRestore()
      theme.mockRestore()
    }
  })

  it('상한은 32,000자다', () => expect(HIGHLIGHT_MAX_CHARS).toBe(32_000))

  it('응답 전에는 <pre> 원문, 응답 후에는 응답 HTML 이다', async () => {
    render('const a = 1')
    expect(compute.requests).toEqual([
      { kind: 'highlight', code: 'const a = 1', lang: 'typescript', theme: 'github-light' }
    ])
    expect(pre()?.textContent).toBe('const a = 1')
    expect(injected()).toBeUndefined()

    compute.resolveNext({ html: '<pre class="shiki">colored</pre>' })
    await settle()
    expect(innerHtml()).toBe('<pre class="shiki">colored</pre>')
    expect(pre()).toBeUndefined()
  })

  it('32,000자는 요청하고 32,001자는 요청하지 않는다', () => {
    render('x'.repeat(HIGHLIGHT_MAX_CHARS))
    expect(compute.requests).toHaveLength(1)
    render('x'.repeat(HIGHLIGHT_MAX_CHARS + 1))
    expect(compute.requests).toHaveLength(1)
    expect(pre()?.textContent).toHaveLength(HIGHLIGHT_MAX_CHARS + 1)
  })

  it('지원하지 않는 언어와 스트리밍 중인 블록은 요청하지 않는다', () => {
    render('plain', 'no-such-lang')
    dom.render(
      createElement(
        MarkdownStreamingContext.Provider,
        { value: true },
        createElement(CodeBlock, { code: 'const a = 1', lang: 'typescript', showHeader: false })
      )
    )
    expect(compute.requests).toEqual([])
  })

  it('복사용 마운트는 캐시된 강조만 읽고 새 계산을 예약하지 않는다', async () => {
    render('cached')
    compute.resolveNext({ html: '<pre>cached highlight</pre>' })
    await settle()
    dom.unmount()
    const copy = (code: string): void =>
      dom.render(
        createElement(
          CachedHighlightOnly.Provider,
          { value: true },
          createElement(CodeBlock, { code, lang: 'typescript', showHeader: false })
        )
      )
    copy('cached')
    expect(innerHtml()).toBe('<pre>cached highlight</pre>')
    copy('uncached')
    expect(pre()?.textContent).toBe('uncached')
    expect(compute.requests).toHaveLength(1)
  })

  it('내용이 바뀌면 앞 요청을 취소하고, 늦은 응답은 새 내용에 반영되지 않는다', async () => {
    render('const a = 1')
    render('const b = 2')
    expect(compute.cancelled.map((r) => (r.kind === 'highlight' ? r.code : ''))).toEqual([
      'const a = 1'
    ])
    expect(pre()?.textContent).toBe('const b = 2')
    compute.resolveNext({ html: '<pre>b</pre>' })
    await settle()
    expect(innerHtml()).toBe('<pre>b</pre>')
  })

  it('언마운트하면 요청을 취소한다', () => {
    render('const a = 1')
    dom.unmount()
    expect(compute.cancelled).toHaveLength(1)
  })

  it('워커가 실패하면 원문을 유지한다', async () => {
    render('const a = 1')
    compute.rejectNext()
    await settle()
    expect(pre()?.textContent).toBe('const a = 1')
    expect(injected()).toBeUndefined()
  })

  it('같은 내용이 캐시에 있으면 다시 놓였을 때 첫 렌더부터 색상이다', async () => {
    render('const a = 1')
    compute.resolveNext({ html: '<pre>cached</pre>' })
    await settle()
    dom.unmount()
    render('const a = 1')
    expect(innerHtml()).toBe('<pre>cached</pre>')
  })
})
