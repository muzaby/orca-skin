import { createElement } from 'react'
import { it, expect, vi } from 'vitest'
import { dom, fake, settle } from '../../../shared/ui/virtual/virtualView.testfixture'
import { useDiffAnchor, useDiffContext } from './useDiffAnchor'
import { diffWindowPriority, useDiffRowWindow } from './useDiffViewWindow'
import type { DiffOptions, DiffSourceRef } from '../../../shared/compute/diffSource'
import { buildDiffView, diffViewRows } from '../../../shared/compute/diffView'
import { hunksToDiffLines } from '../../../shared/compute/diffModel'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
const source: DiffSourceRef = { kind: 'lines', doc: { id: 's', revision: 1 } },
  options: DiffOptions = {
    layout: 'inline',
    highlightWords: true,
    expansions: [],
    ignoreWhitespace: false
  }
const model = buildDiffView(hunksToDiffLines([{ value: 'a\nb\nc', added: true }]), false)
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 테스트 하네스의 반환형은 조립한 fixture에서 추론한다.
function mount() {
  let state!: ReturnType<typeof useDiffRowWindow>
  function Probe({
    src,
    view,
    start
  }: {
    src: DiffSourceRef
    view: DiffOptions
    start: number
  }): null {
    state = useDiffRowWindow(src, view, null, start, start + 2, true)
    return null
  }
  const render = (start: number, src = source, view = options): void =>
    dom.render(createElement(Probe, { start, src, view }))
  return { render, read: () => state }
}
it('dv2 pending and failed windows have distinct states', async () => {
  const v = mount()
  v.render(0)
  expect(v.read().data).toBeUndefined()
  fake.rejectNext()
  await settle()
  expect(v.read().data).toBeNull()
  expect(v.read().rowAt(0)).toBeUndefined()
})
it('overlapping row remains mounted while a new range is pending', async () => {
  const v = mount()
  v.render(0)
  const result = diffViewRows(model, options, 0, 2)
  fake.resolveNext(result)
  await settle()
  v.render(1)
  expect(v.read().data).toBeUndefined()
  expect(v.read().rowAt(1)).toBe(result.rows[1])
  expect(v.read().rowAt(2)).toBeUndefined()
})
it.each(['source', 'options'])('pending %s change cannot reuse stale rows', async (axis) => {
  const v = mount()
  v.render(0)
  fake.resolveNext(diffViewRows(model, options, 0, 2))
  await settle()
  v.render(
    1,
    axis === 'source' ? { kind: 'lines', doc: { id: 's', revision: 2 } } : source,
    axis === 'options' ? { ...options, layout: 'side-by-side' } : options
  )
  expect(v.read().rowAt(1)).toBeUndefined()
})
it('dv1 source bounds count original lines and characters before packing', async () => {
  const { diffViewPath } = await import('../../../shared/compute/diffViewPath')
  expect(diffViewPath(Array(5000).fill({ text: 'a'.repeat(40) }))).toBe('sync')
  expect(diffViewPath(Array(5001).fill({ text: '' }))).toBe('worker')
  expect(diffViewPath([{ text: 'a'.repeat(200001) }])).toBe('worker')
  expect(diffViewPath('a\n'.repeat(100000))).toBe('sync')
  expect(diffViewPath('a'.repeat(200001))).toBe('worker')
  const { withinDiffCap } = await import('../../../shared/compute/inline')
  expect(withinDiffCap('x'.repeat(64000), '')).toBe(true)
  expect(withinDiffCap('x'.repeat(64001), '')).toBe(false)
})

it('dv4 locates anchors and requests draft context against the same source', async () => {
  function Probe(): null {
    useDiffAnchor(source, options, null, { oldLine: null, newLine: 2 }, true)
    useDiffContext(source, false, null, 1, true)
    return null
  }
  dom.render(createElement(Probe))
  expect(fake.requests).toEqual([
    { kind: 'diffLocate', source, options, anchors: [{ oldLine: null, newLine: 2 }] },
    { kind: 'diffContext', source, ignoreWhitespace: false, lineIndex: 1 }
  ])
})

it('dv3 prioritizes visible and mixed windows ahead of overscan-only rows', () => {
  const request = vi.spyOn(fake.client, 'request')
  function Probe({ start, end }: { start: number; end: number }): null {
    useDiffRowWindow(
      source,
      options,
      null,
      start,
      end,
      true,
      diffWindowPriority(start, end, { startIndex: 20, endIndex: 40 })
    )
    return null
  }
  for (const [start, end] of [
    [0, 20],
    [20, 25],
    [10, 50],
    [40, 41],
    [41, 42]
  ])
    dom.render(createElement(Probe, { start, end }))
  expect(request.mock.calls.map(([, opt]) => opt?.priority)).toEqual([
    'background',
    'visible',
    'visible',
    'visible',
    'background'
  ])
})
