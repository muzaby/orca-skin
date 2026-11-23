import { createElement } from 'react'
import { it, expect, vi } from 'vitest'
import { dom, fake, visible, settle } from '../../../../shared/ui/virtual/virtualView.testfixture'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useId: () => ':fixture:'
}))
vi.mock('../../../../shared/ui/virtual/useVirtualRows', async () => ({
  useVirtualRows: (await import('../../../../shared/ui/virtual/virtualView.testfixture'))
    .useTestVirtualRows
}))
import { VirtualCodeView } from './VirtualCodeView'
import { createWorkerState } from '../../../../shared/compute/worker/state'
vi.mock('../../../../shared/ui/markdown/CodeBlock', () => ({
  CodeBlock: ({ code }: { code: string }) => createElement('pre', { 'data-fallback': '' }, code)
}))
const lines = Array.from({ length: 5001 }, (_, i) => 'const row' + i)
const render = (code = lines.join('\n'), lang?: string): void =>
  dom.render(createElement(VirtualCodeView, { code, lang, showLineNumbers: true }))
it('x1 renders only mounted lines and their gutters', () => {
  render()
  expect(dom.queryAll('[data-virtual-text]').map((n) => n.textContent)).toEqual(lines.slice(0, 4))
  expect(dom.queryAll('[data-transcript-chrome]')).toHaveLength(4)
})
it('x2 scrolling renders the final row', () => {
  render()
  visible.first = 4997
  render()
  expect(dom.queryAll('[data-virtual-text]').at(-1)!.textContent).toBe(lines.at(-1))
})
it('x3 syntax request covers the displayed window beyond the highlight cap', () => {
  render(lines.join('\n'), 'typescript')
  expect(fake.requests).toMatchObject([{ kind: 'tokens', start: 0, end: 200 }])
})
it('x4 remote document failure renders original text', async () => {
  const s = 'x'.repeat(1000001)
  render(s)
  fake.rejectNext()
  await settle()
  expect(dom.query('[data-fallback]')!.textContent).toBe(s)
})
it('x5 plain text makes no syntax request', () => {
  render()
  expect(fake.requests).toHaveLength(0)
})
it('x6 requests the first window above 1000000 characters and displays a pending slot', () => {
  render('x'.repeat(1000001))
  expect(fake.requests).toMatchObject([{ kind: 'codeView', start: 0, end: 200 }])
  expect(dom.query('[data-virtual-code]')!.props['aria-busy']).toBe(true)
})
it('x7 worker reports offsets and empty beyond-end windows', async () => {
  const run = createWorkerState(),
    doc = { id: 'code', revision: 1 }
  await run({ type: 'doc.open', ref: doc, text: 'abc\nxy' })
  for (const [start, lines, charsBefore] of [
    [1, ['xy'], 3],
    [2, [], 5]
  ] as const)
    expect(
      await run({ id: start, kind: 'codeView', source: { doc }, start, end: start + 10 })
    ).toMatchObject({ ok: true, result: { lines, charsBefore, textChars: 5 } })
})
