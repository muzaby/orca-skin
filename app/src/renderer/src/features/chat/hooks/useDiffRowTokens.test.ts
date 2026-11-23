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
import { requestKey } from '../../../shared/compute/protocol'
import { DEFAULT_DIFF_VIEW } from '../reducer/chatReducer'

const state = vi.hoisted(() => ({ id: 0 }))
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
  renderGit([file])
  renderGit([file], {
    view: { ...DEFAULT_DIFF_VIEW, ignoreWhitespace: !DEFAULT_DIFF_VIEW.ignoreWhitespace }
  })
  expect(keys()).toHaveLength(2)
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
