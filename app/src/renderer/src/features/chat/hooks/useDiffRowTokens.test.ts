import { it, expect, vi } from 'vitest'
import { addedFile, renderGit } from '../harnesses/common/rightpanel/gitReview.testfixture'
import {
  dom,
  fake,
  settle,
  visible,
  useTestVirtualRows
} from '../../../shared/ui/virtual/virtualView.testfixture'
import { FakeNode } from '../../../shared/ui/renderHarness.testfixture'
import { patchLinesToDiffLines } from '../lib/diffPatchLines'
import { createDiffRequirementItem } from '../harnesses/common/rightpanel/diffRequirements'
import { buildDiffView, diffViewRows, diffViewLocate } from '../../../shared/compute/diffView'
import { requestKey } from '../../../shared/compute/protocol'
import { DEFAULT_DIFF_VIEW } from '../reducer/chatReducer'

const state = vi.hoisted(() => ({ id: 0, theme: 'github-light' }))
vi.mock('../../../shared/ui/markdown/themeStore', () => ({
  getThemeSnapshot: () => state.theme,
  subscribeTheme: () => () => {}
}))
vi.mock('react', async (original) => {
  const { fakeHooks } = await import('../../../shared/ui/renderHarness.testfixture')
  return {
    ...(await original<typeof import('react')>()),
    ...fakeHooks,
    useId: () => fakeHooks.useMemo(() => ':fixture:' + state.id++, [])
  }
})
vi.mock('../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key }),
  i18n: { t: (key: string) => key }
}))
vi.mock('../../../shared/ui/virtual/useVirtualRows', () => ({
  useVirtualRows: (count: number, _root: unknown, _owner: unknown, mode?: string) => ({
    ...useTestVirtualRows(mode === 'hidden' ? 0 : count),
    measurementsCache: [],
    scrollToIndex: vi.fn()
  })
}))

function keys(): string[] {
  return [...new Set(fake.requests.filter((r) => r.kind === 'tokens').map(requestKey))]
}
it('rt1/rt2 adjacent mounted rows share a 200-line axis window', () => {
  renderGit([addedFile(1000, 'code.ts')])
  expect(keys()).toHaveLength(1)
  expect(fake.requests.find((r) => r.kind === 'tokens')).toMatchObject({ start: 0, end: 200 })
})
it.each([200, 201, 400])('requests the visible token windows of a %i-row inline diff', (count) => {
  const open = vi.spyOn(fake.client, 'openDocument')
  const file = addedFile(count, 'code.ts')
  renderGit([file])
  const text = file.lines.map((line) => line.text).join('\n')
  const axis = open.mock.calls.find(([, document]) => document.text === text)?.[0]
  expect(axis).toBeDefined()
  const starts = count === 200 ? [0] : [0, 200]
  expect(fake.requests.filter((r) => r.kind === 'tokens')).toEqual(
    starts.map((start) => ({
      kind: 'tokens',
      doc: axis,
      lang: 'typescript',
      theme: state.theme,
      start,
      end: start + 200
    }))
  )
})
it('rt3 same patch retains token keys after collapse and reopening', () => {
  const file = addedFile(501, 'code.ts')
  renderGit([file])
  const first = keys()
  expect(first).toHaveLength(1)
  renderGit([file], { expandedFiles: new Set() })
  renderGit([file])
  expect(keys()).toEqual(first)
})
it('rt4 whitespace option distinguishes the axis document', () => {
  const file = addedFile(501, 'code.ts')
  const open = vi.spyOn(fake.client, 'openDocument')
  renderGit([file])
  renderGit([file], {
    view: { ...DEFAULT_DIFF_VIEW, ignoreWhitespace: !DEFAULT_DIFF_VIEW.ignoreWhitespace }
  })
  expect(keys()).toHaveLength(2)
  const axes = open.mock.calls.filter(([ref]) => ref.id !== 'git:code.ts')
  const text = file.lines.map((line) => line.text).join('\n')
  expect(axes.map(([ref, doc]) => [ref.id, doc.text])).toEqual([
    ['git:code.ts:old:k', ''],
    ['git:code.ts:new:k', text],
    ['git:code.ts:old:w', ''],
    ['git:code.ts:new:w', text]
  ])
})
it('rt5 tokens for other source text leave the visible line intact', async () => {
  renderGit([addedFile(501, 'code.ts')])
  fake.resolveNext({ rows: [[{ offset: 0, content: 'stale text', color: '#123456' }]] })
  await settle()
  expect(dom.body.textContent).toContain('line 0')
  expect(dom.body.textContent).not.toContain('stale text')
})
it('rt7/v6 a distant pinned row adds only its own axis window', () => {
  const file = addedFile(5000, 'code.ts')
  const pin = createDiffRequirementItem({
    id: 'far',
    sessionId: 's',
    base: { kind: 'none' },
    filePath: file.path,
    lines: patchLinesToDiffLines(file.lines),
    lineIndex: 4000,
    comment: 'far',
    createdAt: 1
  })
  vi.stubGlobal('CSS', { escape: (s: string) => s })
  const prototype = FakeNode.prototype as FakeNode & { scrollIntoView?: () => void }
  const reveal = vi.fn()
  prototype.scrollIntoView = reveal
  try {
    visible.first = 100
    renderGit([file], { requirements: [pin], activeRequirementId: pin.id })
    expect(keys()).toHaveLength(2)
    expect(dom.body.textContent).toContain('line 4000')
    expect(dom.body.textContent).toContain('line 100')
    expect(reveal).toHaveBeenCalledOnce()
  } finally {
    delete prototype.scrollIntoView
  }
})
it('rt8 remote model opens no renderer-side axis documents', () => {
  const open = vi.spyOn(fake.client, 'openDocument')
  renderGit([addedFile(50000, 'code.ts')])
  expect(open.mock.calls.map(([ref]) => ref.id)).toEqual(['git:code.ts'])
  expect(fake.requests[0]).toMatchObject({ kind: 'diffView' })
})

it('rt7 requests only the visible and pinned windows of a 50000-line worker axis after a theme change', async () => {
  const file = addedFile(50000, 'code.ts')
  const lines = patchLinesToDiffLines(file.lines)
  const model = buildDiffView(lines, false)
  const pin = createDiffRequirementItem({
    id: 'pin',
    sessionId: 's',
    base: { kind: 'none' },
    filePath: file.path,
    lines,
    lineIndex: 40000,
    comment: 'pin',
    createdAt: 1
  })
  const render = (): void => renderGit([file], { requirements: [pin], activeRequirementId: pin.id })
  const open = vi.spyOn(fake.client, 'openDocument')
  vi.stubGlobal('CSS', { escape: (s: string) => s })
  Object.assign(FakeNode.prototype, { scrollIntoView: vi.fn() })
  try {
    visible.first = 100
    render()
    for (let i = 0; i < fake.requests.length; i++) {
      const r = fake.requests[i]
      if (fake.cancelled.includes(r)) continue
      if (r.kind === 'diffView') fake.resolveNext(diffViewRows(model, r.options, r.start, r.end))
      else if (r.kind === 'diffLocate')
        fake.resolveNext(diffViewLocate(model, r.options, r.anchors))
      else if (r.kind === 'tokens') fake.resolveNext({ rows: [] })
      else throw Error(r.kind)
      await settle()
    }
    expect(dom.body.textContent).toContain('line 40000')
    state.theme = 'github-dark'
    render()
    for (const theme of ['github-light', 'github-dark']) {
      const windows = new Map(
        fake.requests
          .filter((r) => r.kind === 'tokens' && r.theme === theme)
          .map((r) => [requestKey(r), r])
      )
      expect(
        [...windows.values()].sort(
          (a, b) => ('start' in a ? a.start : 0) - ('start' in b ? b.start : 0)
        )
      ).toMatchObject([
        { axis: { axis: 'new' }, start: 0, end: 200 },
        { axis: { axis: 'new' }, start: 40000, end: 40200 }
      ])
    }
    expect(fake.requests.some((r) => r.kind === 'diffTokens')).toBe(false)
    expect(open.mock.calls.map(([ref]) => ref.id)).toEqual(['git:code.ts'])
  } finally {
    open.mockRestore()
    state.theme = 'github-light'
    Reflect.deleteProperty(FakeNode.prototype, 'scrollIntoView')
  }
})
