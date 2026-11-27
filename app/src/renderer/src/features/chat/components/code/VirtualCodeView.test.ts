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
import * as codeIndex from '../../../../shared/compute/codeView'
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

it('x5 a 5 MiB artifact reopens the same document and mounts only its requested rows after remount', async () => {
  const open = vi.spyOn(fake.client, 'openDocument')
  const build = vi.spyOn(codeIndex, 'buildCodeIndex')
  const line = 'const x = 1\n'
  const size = 5 * 1024 * 1024
  const source = { code: line.repeat(Math.ceil(size / line.length)).slice(0, size) }
  const mount = (): void =>
    dom.render(
      createElement(VirtualCodeView, {
        code: source.code,
        lang: 'typescript',
        documentId: 'artifact:sample',
        showLineNumbers: true,
        revisionSource: source
      })
    )
  try {
    mount()
    const first = fake.requests[0]
    dom.unmount()
    mount()
    expect(open.mock.calls).toHaveLength(2)
    expect(open.mock.calls[1][0]).toEqual(open.mock.calls[0][0])
    expect(first).toMatchObject({ kind: 'codeView', start: 0, end: 200 })
    expect(fake.requests.at(-1)).toEqual(first)
    expect(build).not.toHaveBeenCalled()
    if (first.kind !== 'codeView') throw Error('missing artifact window')
    const [ref, content] = open.mock.calls[1]
    const run = createWorkerState()
    await run({ type: 'doc.open', ref, ...content })
    const response = await run({ ...first, id: 1 })
    if (response?.ok !== true) throw Error('missing worker result')
    fake.resolveNext(response.result)
    await settle()
    expect(dom.queryAll('[data-virtual-text]').map((row) => row.textContent)).toEqual(
      Array(4).fill('const x = 1')
    )
    expect(dom.queryAll('[data-transcript-chrome]')).toHaveLength(4)
  } finally {
    open.mockRestore()
    build.mockRestore()
  }
})

it('wt6 renders matching token colors and falls back to source text for a mismatched row', async () => {
  render('const a\nconst b', 'typescript')
  fake.resolveNext({
    rows: [
      [{ content: 'const a', offset: 0, color: '#123456' }],
      [{ content: 'wrong', offset: 0, color: '#ffffff' }]
    ]
  })
  await settle()
  const rows = dom.queryAll('[data-virtual-text]')
  expect(rows.map((row) => row.textContent)).toEqual(['const a', 'const b'])
  expect(rows[0].children[0].props.style).toEqual({ color: '#123456' })
  expect(rows[1].children.some((child) => child.props.style)).toBe(false)
})
