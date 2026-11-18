import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import { OpenCodeTimelineRow } from './Timeline'
import type { TimelineRow } from './projection'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
const live = vi.hoisted(() => ({ text: '', enabled: [] as boolean[] }))
vi.mock('../../../store/chatStore', () => ({
  useLiveTextFor: (enabled: boolean) => {
    live.enabled.push(enabled)
    return enabled ? live.text : ''
  }
}))
vi.mock('./Text', async () => {
  const { createElement } = await import('react')
  const Text = ({ source, streaming }: { source: string; streaming: boolean }): React.JSX.Element =>
    createElement('span', { 'data-markdown-mode': streaming ? 'streaming' : 'complete' }, source)
  return { OpenCodeText: Text }
})
let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  vi.unstubAllGlobals()
  live.text = ''
  live.enabled = []
})
describe('OpenCode selected row renderer continuity', () => {
  it('keeps selected live content on completion, then resolves complete Markdown when selection clears', () => {
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    const row: TimelineRow = {
      key: 'text',
      kind: 'segment',
      segment: { kind: 'text', text: '[link][reference]' },
      gap: 0,
      streaming: true
    }
    const render = (streaming: boolean, selected: boolean): void =>
      dom!.render(createElement(OpenCodeTimelineRow, { row: { ...row, streaming }, selected }))
    render(true, false)
    render(true, true)
    render(false, true)
    expect(dom.body.querySelector('[data-markdown-mode]')!.getAttribute('data-markdown-mode')).toBe(
      'streaming'
    )
    render(false, false)
    expect(dom.body.querySelector('[data-markdown-mode]')!.getAttribute('data-markdown-mode')).toBe(
      'complete'
    )
    render(false, true)
    expect(dom.body.querySelector('[data-markdown-mode]')!.getAttribute('data-markdown-mode')).toBe(
      'complete'
    )
  })

  // 0325 VP-07 자리 6·7 — live 행과 같은 key 의 확정 행은 같은 행 컴포넌트라 완료 전환에서 DOM 이 남는다.
  it('keeps the same row component when a live row becomes the committed row of the same key', () => {
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    const base: TimelineRow = {
      key: 'user:1:0:text',
      kind: 'segment',
      segment: { kind: 'text', text: '확정 ' },
      gap: 0,
      streaming: true,
      live: true
    }
    live.text = '스트리밍'
    dom.render(createElement(OpenCodeTimelineRow, { row: base, selected: true }))
    const liveNode = dom.body.querySelector('[data-markdown-mode]')!
    expect(liveNode.textContent).toBe('확정 스트리밍')
    // 완료 — live 가 비고 같은 key 의 확정 행이 온다.
    live.text = ''
    const committed: TimelineRow = {
      key: base.key,
      kind: 'segment',
      segment: { kind: 'text', text: '확정 스트리밍' },
      gap: 0,
      streaming: false
    }
    dom.render(createElement(OpenCodeTimelineRow, { row: committed, selected: true }))
    const committedNode = dom.body.querySelector('[data-markdown-mode]')!
    expect(committedNode).toBe(liveNode)
    expect(committedNode.textContent).toBe('확정 스트리밍')
    // 확정 행은 live 본문을 구독하지 않고(`useLiveTextFor(false)`) 읽지도 않는다(EP-2 ⑦).
    expect(live.enabled.at(-1)).toBe(false)
    expect(live.enabled[0]).toBe(true)
    live.text = '다음 턴'
    dom.render(createElement(OpenCodeTimelineRow, { row: committed, selected: true }))
    expect(dom.body.querySelector('[data-markdown-mode]')!.textContent).toBe('확정 스트리밍')
  })
})
