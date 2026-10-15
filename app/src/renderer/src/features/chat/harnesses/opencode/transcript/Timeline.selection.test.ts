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
vi.mock('./Text', async () => {
  const { createElement } = await import('react')
  const Text = ({ source, streaming }: { source: string; streaming: boolean }): React.JSX.Element =>
    createElement('span', { 'data-markdown-mode': streaming ? 'streaming' : 'complete' }, source)
  return { OpenCodeText: Text, OpenCodeReasoning: Text }
})
let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  vi.unstubAllGlobals()
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
})
