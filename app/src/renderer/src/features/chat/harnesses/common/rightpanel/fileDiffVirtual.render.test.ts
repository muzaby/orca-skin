import { it, expect, vi } from 'vitest'
import { createDiffRequirementItem } from './diffRequirements'
import { addedFile, renderGit } from './gitReview.testfixture'
import {
  dom,
  settle,
  fake,
  visible,
  useTestVirtualRows
} from '../../../../../shared/ui/virtual/virtualView.testfixture'
import { DEFAULT_DIFF_VIEW } from '../../../reducer/chatReducer'
import * as patch from '../../../lib/diffPatchLines'
import { FakeNode } from '../../../../../shared/ui/renderHarness.testfixture'
import * as model from '../../../../../shared/compute/diffView'
const state = vi.hoisted(() => ({
  id: 0,
  scrollToIndex: vi.fn(),
  lists: [] as { shouldAdjustScrollPositionOnItemSizeChange?: () => boolean }[]
}))
vi.mock('react', async (original) => {
  const { fakeHooks } = await import('../../../../../shared/ui/renderHarness.testfixture')
  return {
    ...(await original<typeof import('react')>()),
    ...fakeHooks,
    useId: () => fakeHooks.useMemo(() => ':fixture:' + state.id++, [])
  }
})
vi.mock('../../../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key }),
  i18n: { t: (key: string) => key }
}))
vi.mock('../../../../../shared/ui/virtual/useVirtualRows', () => ({
  useVirtualRows: (count: number, _root: unknown, _owner: unknown, mode?: string) => {
    const list = {
      ...useTestVirtualRows(mode === 'hidden' ? 0 : count),
      measurementsCache: [],
      scrollToIndex: state.scrollToIndex,
      shouldAdjustScrollPositionOnItemSizeChange: undefined as (() => boolean) | undefined
    }
    state.lists.push(list)
    return list
  }
}))

it('v1 first visible window is bounded for a long local file', () => {
  renderGit([addedFile(5000)])
  expect(dom.queryAll('[data-window-row]')).toHaveLength(4)
  expect(dom.body.textContent).toContain('line 0')
})
it('v2 moving the window reaches the last row', () => {
  const file = addedFile(5000)
  renderGit([file])
  visible.first = 4996
  renderGit([file])
  expect(dom.body.textContent).toContain('line 4999')
  expect(dom.queryAll('[data-window-row]')).toHaveLength(4)
})
it('v3 400-line file retains all plain rows', () => {
  renderGit([addedFile(400)])
  expect(dom.queryAll('[data-diff-hunk-row-id]')).toHaveLength(400)
  expect(dom.query('[data-virtual-git]')).toBeNull()
})
it('v4 split view emits stable pair keys within the same mount bound', () => {
  renderGit([addedFile(501)], { view: { ...DEFAULT_DIFF_VIEW, layout: 'side-by-side' } })
  expect(dom.queryAll('[data-window-row]').map((n) => n.getAttribute('data-window-row'))).toEqual([
    'pair:-1:0',
    'pair:-1:1',
    'pair:-1:2',
    'pair:-1:3'
  ])
})
it('v9 renderer model is reused for local updates and a large file builds once in the worker', async () => {
  const spy = vi.spyOn(model, 'buildDiffView')
  const convert = vi.spyOn(patch, 'patchLinesToDiffLines')
  const open = vi.spyOn(fake.client, 'openDocument')
  try {
    const file = addedFile(5000)
    renderGit([file])
    for (let i = 0; i < 10; i++) {
      const draft = {
        key: JSON.stringify([file.path, null, 2]),
        filePath: file.path,
        oldLine: null,
        newLine: 2,
        body: 'draft ' + i
      }
      renderGit([file], { draft })
    }
    expect(spy).toHaveBeenCalledTimes(1)
    expect(convert).toHaveBeenCalledTimes(1)
    const { createWorkerState } = await import('../../../../../shared/compute/worker/state')
    const run = createWorkerState()
    const large = addedFile(50000)
    renderGit([large])
    expect(spy).toHaveBeenCalledTimes(1)
    expect(convert).toHaveBeenCalledTimes(1)
    const [ref, content] = open.mock.calls.at(-1)!
    await run({ type: 'doc.open', ref, ...content })
    let served = 0
    const flush = async (): Promise<void> => {
      while (served < fake.requests.length) {
        const request = fake.requests[served++]
        if (fake.cancelled.includes(request)) continue
        const response = await run({ ...request, id: served })
        if (response?.ok !== true) throw Error('worker did not return the requested window')
        fake.resolveNext(response.result)
        await settle()
      }
    }
    await flush()
    visible.first = 49000
    renderGit([large])
    await flush()
    expect(dom.body.textContent).toContain('line 49000')
    expect(spy).toHaveBeenCalledTimes(2)
    expect(convert).toHaveBeenCalledTimes(1)
  } finally {
    open.mockRestore()
    convert.mockRestore()
    spy.mockRestore()
  }
})
it.each([501, 5001])(
  'v10 width includes an unmounted wide line and stays fixed while scrolling at %i rows',
  async (count) => {
    const file = addedFile(count)
    file.lines[250].text = '\t' + '界'.repeat(50)
    const built = model.buildDiffView(patch.patchLinesToDiffLines(file.lines), false)
    let served = 0
    async function render(wrapLines: boolean): Promise<void> {
      renderGit([file], { view: { ...DEFAULT_DIFF_VIEW, wrapLines } })
      while (served < fake.requests.length) {
        const r = fake.requests[served++]
        if (fake.cancelled.includes(r)) continue
        if (r.kind !== 'diffView') throw Error('expected diff window')
        fake.resolveNext(model.diffViewRows(built, r.options, r.start, r.end))
        await settle()
      }
    }
    const width = (): unknown =>
      (dom.query('[data-virtual-git]')!.props.style as { minWidth?: string }).minWidth
    await render(false)
    expect(width()).toBe('calc(108ch + 5em)')
    visible.first = count - 4
    await render(false)
    expect(width()).toBe('calc(108ch + 5em)')
    await render(true)
    expect(width()).toBeUndefined()
  }
)

it('sc3 file virtualizer delegates row size scroll correction to the panel', () => {
  state.lists.length = 0
  renderGit([addedFile(501)])
  expect(state.lists.at(-1)?.shouldAdjustScrollPositionOnItemSizeChange?.()).toBe(false)
})

it.each([501, 5001])(
  'v11 local and worker word marks cover the changed text at %i lines',
  async (count) => {
    const file = addedFile(count)
    file.lines[0] = { type: 'removed', text: 'prefix red suffix', oldLine: 1, newLine: null }
    file.lines[1] = { type: 'added', text: 'prefix blue suffix', oldLine: null, newLine: 1 }
    renderGit([file], { view: { ...DEFAULT_DIFF_VIEW, highlightWords: true } })
    if (count > 5000) {
      const built = model.buildDiffView(patch.patchLinesToDiffLines(file.lines), false)
      for (let i = 0; i < 2; i++) {
        const r = fake.requests[i]
        if (r.kind !== 'diffView') throw Error('expected row request')
        fake.resolveNext(model.diffViewRows(built, r.options, r.start, r.end))
        await settle()
      }
    }
    function marks(node: FakeNode): string[] {
      return node.tag === 'mark' ? [node.textContent] : node.children.flatMap(marks)
    }
    expect(marks(dom.body)).toEqual(['red', 'blue'])
  }
)

it.each([
  ['v5', 501, false],
  ['v5b', 501, true],
  ['v5w', 5001, false]
] as const)(
  '%s upward context expansion keeps the following row in place',
  async (_, count, wrap) => {
    const file = addedFile(count)
    file.lines = file.lines.map((line, i) =>
      i === 40 ? line : { ...line, type: 'unchanged', oldLine: i + 1 }
    )
    const built = model.buildDiffView(patch.patchLinesToDiffLines(file.lines), false)
    const query = FakeNode.prototype.querySelectorAll
    const selectors = vi.spyOn(FakeNode.prototype, 'querySelectorAll').mockImplementation(function (
      this: FakeNode,
      selector
    ) {
      return selector.includes(',')
        ? selector.split(',').flatMap((s) => query.call(this, s))
        : query.call(this, selector)
    })
    const nativeRect = FakeNode.prototype.getBoundingClientRect
    const geometry = vi
      .spyOn(FakeNode.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: FakeNode) {
        const base = nativeRect.call(this)
        const index = this.getAttribute('data-index')
        const scroll = this.closest('[data-diff-scroll-owner]')?.scrollTop ?? 0
        const top = index === null ? 0 : Number(index) * (wrap ? 32 : 20) - scroll
        return { ...base, top, bottom: top + (index === null ? 500 : 20) }
      })
    Object.defineProperty(FakeNode.prototype, 'nextElementSibling', {
      configurable: true,
      get(this: FakeNode) {
        return this.parent?.children[this.parent.children.indexOf(this) + 1]
      }
    })
    Object.assign(document, { documentElement: { dataset: {} } })
    Object.assign(FakeNode.prototype, { addEventListener: vi.fn(), removeEventListener: vi.fn() })
    vi.stubGlobal('HTMLElement', FakeNode)
    vi.stubGlobal('CSS', { escape: (s: string) => s })
    let schedule = (): void => {}
    let frame = (): void => {}
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      frame = cb
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          schedule = cb
        }
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
      }
    )
    vi.stubGlobal(
      'MutationObserver',
      class {
        observe = vi.fn()
        disconnect = vi.fn()
      }
    )
    let served = 0
    async function flushRows(): Promise<void> {
      while (served < fake.requests.length) {
        const r = fake.requests[served++]
        if (r.kind === 'diffView')
          fake.resolveNext(model.diffViewRows(built, r.options, r.start, r.end))
        else throw Error('unexpected ' + r.kind)
        await settle()
      }
    }
    try {
      visible.count = 100
      const draft = wrap
        ? {
            key: JSON.stringify([file.path, null, 41]),
            filePath: file.path,
            oldLine: null,
            newLine: 41,
            body: 'draft'
          }
        : null
      renderGit([file], { view: { ...DEFAULT_DIFF_VIEW, wrapLines: wrap }, draft })
      await flushRows()
      const input = dom.query('[data-diff-requirement-draft-input]')
      input?.focus()
      const gap = dom.query('[data-diff-gap-up]')!
      const gapRow = gap.closest('[data-window-row]')!
      const anchor = gapRow.parent!.children[gapRow.parent!.children.indexOf(gapRow) + 1]
      const key = anchor.getAttribute('data-window-row')!
      const owner = dom.query('[data-diff-scroll-owner]')!
      let scrollTop = owner.scrollTop
      const write = vi.fn((value: number) => {
        scrollTop = value
      })
      Object.defineProperty(owner, 'scrollTop', {
        configurable: true,
        get: () => scrollTop,
        set: write
      })
      const before = anchor.getBoundingClientRect().top
      dom.act(() => (gap.props.onClick as () => void)())
      await flushRows()
      schedule()
      dom.act(() => frame())
      const after = dom.query('[data-window-row="' + key + '"]')!
      expect(owner.scrollTop).toBeGreaterThan(0)
      expect(Math.abs(after.getBoundingClientRect().top - before)).toBeLessThanOrEqual(1)
      expect(write).toHaveBeenCalledTimes(1)
      write.mockClear()
      const down = dom.query('[data-diff-gap-down]')!
      dom.act(() => (down.props.onClick as () => void)())
      await flushRows()
      schedule()
      dom.act(() => frame())
      expect(write).not.toHaveBeenCalled()
      if (wrap)
        expect({
          hasInput: !!input,
          connected: input?.isConnected,
          focused: dom.activeElement === input
        }).toEqual({ hasInput: true, connected: true, focused: true })
    } finally {
      dom.unmount()
      Reflect.deleteProperty(FakeNode.prototype, 'addEventListener')
      Reflect.deleteProperty(FakeNode.prototype, 'removeEventListener')
      visible.count = 4
      geometry.mockRestore()
      selectors.mockRestore()
      Reflect.deleteProperty(FakeNode.prototype, 'nextElementSibling')
    }
  }
)

it.each([false, true])(
  'v6w locates and reveals the 49000th worker row once (hidden %s)',
  async (hidden) => {
    const file = addedFile(50000)
    if (hidden)
      file.lines = file.lines.map((line, index) =>
        index === 0 ? line : { ...line, type: 'unchanged', oldLine: index + 1 }
      )
    state.scrollToIndex.mockClear()
    const lines = patch.patchLinesToDiffLines(file.lines)
    const pin = createDiffRequirementItem({
      id: 'far',
      sessionId: 's',
      base: { kind: 'none' },
      filePath: file.path,
      lines,
      lineIndex: 49000,
      comment: 'far',
      createdAt: 1
    })
    const built = model.buildDiffView(lines, false)
    vi.stubGlobal('CSS', { escape: (s: string) => s })
    const reveal = vi.fn()
    Object.assign(FakeNode.prototype, { scrollIntoView: reveal })
    try {
      renderGit([file], { requirements: [pin], activeRequirementId: pin.id })
      for (let i = 0; i < fake.requests.length; i++) {
        const r = fake.requests[i]
        if (fake.cancelled.includes(r)) continue
        if (r.kind === 'diffLocate')
          fake.resolveNext(model.diffViewLocate(built, r.options, r.anchors))
        else if (r.kind === 'diffView')
          fake.resolveNext(model.diffViewRows(built, r.options, r.start, r.end))
        else throw Error('unexpected ' + r.kind)
        await settle()
      }
      const locate = fake.requests.findIndex((r) => r.kind === 'diffLocate')
      expect(locate).toBeGreaterThanOrEqual(0)
      const requested = fake.requests.filter((r) => r.kind === 'diffView')
      const options = requested.at(-1)!.options
      const row = model.diffViewLocate(built, options, [
        { oldLine: hidden ? 49001 : null, newLine: 49001 }
      ]).rowIndex[0]
      if (hidden) expect(options.expansions).toContainEqual([48997, 49004])
      expect(row).toBeGreaterThan(0)
      expect(
        fake.requests.findIndex((r) => r.kind === 'diffView' && r.start === row)
      ).toBeGreaterThan(locate)
      expect(state.scrollToIndex).toHaveBeenCalledWith(row, { align: 'center' })
      expect(dom.query('[data-diff-requirement-marker="far"]')).not.toBeNull()
      expect(reveal).toHaveBeenCalledOnce()
    } finally {
      Reflect.deleteProperty(FakeNode.prototype, 'scrollIntoView')
    }
  }
)

it('v7w/v12 worker draft submits its bounded context with the full-file anchor and releases its document on collapse', async () => {
  const file = addedFile(5001)
  file.lines[0] = { ...file.lines[0], type: 'unchanged', oldLine: 1 }
  const lines = patch.patchLinesToDiffLines(file.lines)
  const built = model.buildDiffView(lines, false)
  const index = 4500
  const draft = {
    key: JSON.stringify([file.path, null, index + 1]),
    filePath: file.path,
    oldLine: null,
    newLine: index + 1,
    body: 'comment'
  }
  const make = (
    input: Pick<
      Parameters<typeof createDiffRequirementItem>[0],
      'lines' | 'lineIndex' | 'before' | 'comment'
    >
  ): unknown =>
    createDiffRequirementItem({
      ...input,
      id: 'item',
      base: { kind: 'none' },
      sessionId: 's',
      filePath: file.path,
      createdAt: 1
    }).anchor
  const add = vi.fn()
  const open = vi.spyOn(fake.client, 'openDocument')
  const release = vi.fn()
  open.mockImplementation((ref) => ({ ref, available: true, release, onAvailable: () => () => {} }))
  try {
    renderGit([file], { draft, onAddRequirement: add })
    for (let i = 0; i < fake.requests.length; i++) {
      const r = fake.requests[i]
      if (fake.cancelled.includes(r)) continue
      if (r.kind === 'diffView')
        fake.resolveNext(model.diffViewRows(built, r.options, r.start, r.end))
      else if (r.kind === 'diffLocate')
        fake.resolveNext(model.diffViewLocate(built, r.options, r.anchors))
      else if (r.kind === 'diffContext') fake.resolveNext(model.diffViewContext(built, r.lineIndex))
      else throw Error(r.kind)
      await settle()
    }
    const submit = dom.query('[data-diff-requirement-draft-submit]')!
    dom.act(() => (submit.props.onClick as () => void)())
    expect(add).toHaveBeenCalledOnce()
    expect(add.mock.calls[0][0].lines).toHaveLength(7)
    expect(make(add.mock.calls[0][0])).toEqual(
      make({ lines, lineIndex: index, comment: draft.body })
    )
    expect(release).not.toHaveBeenCalled()
    renderGit([file], { expandedFiles: new Set() })
    expect(release).toHaveBeenCalledTimes(1)
  } finally {
    open.mockRestore()
  }
})
