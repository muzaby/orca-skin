import { it, expect, vi } from 'vitest'
import { addedFile, renderGit } from './gitReview.testfixture'
import {
  dom,
  fake,
  useTestVirtualRows
} from '../../../../../shared/ui/virtual/virtualView.testfixture'
import * as model from '../../../../../shared/compute/diffView'
const state = vi.hoisted(() => ({ id: 0 }))
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
  useVirtualRows: (count: number, _root: unknown, _owner: unknown, mode?: string) => ({
    ...useTestVirtualRows(mode === 'hidden' ? 0 : count),
    measurementsCache: [],
    scrollToIndex: vi.fn()
  })
}))

function proximity(): Map<string, (value: boolean) => void> {
  const callbacks = new Map<string, (value: boolean) => void>()
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private cb: (entries: { isIntersecting: boolean }[]) => void) {}
      observe(node: HTMLElement): void {
        callbacks.set(node.getAttribute('data-diff-file')!, (value) =>
          this.cb([{ isIntersecting: value }])
        )
      }
      disconnect = vi.fn()
    }
  )
  return callbacks
}
it('ea1 expanding 200 small files keeps distant file bodies unmounted', () => {
  const seen = proximity(),
    open = vi.spyOn(fake.client, 'openDocument')
  const files = Array.from({ length: 200 }, (_, i) => addedFile(300, 'f' + i))
  renderGit(files)
  expect(seen.size).toBe(200)
  expect(open).not.toHaveBeenCalled()
  dom.act(() => seen.get('f0')!(true))
  expect(dom.queryAll('[data-diff-hunk-row-id]')).toHaveLength(300)
  expect(dom.queryAll('[data-diff-placeholder]')).toHaveLength(199)
})
it('ea2 four large files only request worker rows when near', () => {
  const seen = proximity(),
    files = Array.from({ length: 4 }, (_, i) => addedFile(50000, 'f' + i))
  renderGit(files)
  expect(fake.requests).toHaveLength(0)
  dom.act(() => seen.get('f3')!(true))
  expect(fake.requests.filter((r) => r.kind === 'diffView')).toHaveLength(1)
  expect(dom.queryAll('[data-diff-placeholder]')).toHaveLength(3)
})
it('ea3 revisiting an opened file preserves its cached computation', () => {
  const seen = proximity(),
    files = Array.from({ length: 200 }, (_, i) => addedFile(501, 'f' + i))
  const builds = vi.spyOn(model, 'buildDiffView')
  try {
    renderGit(files)
    dom.act(() => seen.get('f0')!(true))
    dom.act(() => {
      seen.get('f0')!(false)
      seen.get('f199')!(true)
    })
    expect(dom.queryAll('[data-window-row]')).toHaveLength(4)
    dom.act(() => {
      seen.get('f199')!(false)
      seen.get('f0')!(true)
    })
    expect(builds).toHaveBeenCalledTimes(2)
  } finally {
    builds.mockRestore()
  }
})

it('v7/v7b/v7c/ea3 a draft pins just its row in the distant file among 200 expanded sections', () => {
  const seen = proximity()
  const files = Array.from({ length: 200 }, (_, i) => addedFile(501, 'f' + i))
  const filePath = 'f120'
  const draft = {
    key: JSON.stringify([filePath, null, 333]),
    filePath,
    oldLine: null,
    newLine: 333,
    body: 'draft'
  }
  renderGit(files, { draft })
  dom.act(() => seen.get('f0')!(true))
  const file = dom.query('[data-diff-file="f120"]')!
  const rows = file.querySelectorAll('[data-window-row]')
  expect(rows).toHaveLength(1)
  expect(rows[0].props.style).toMatchObject({ top: 332 * 20 })
  expect(file.querySelector('[data-diff-requirement-draft-input]')).not.toBeNull()
  expect(dom.queryAll('[data-window-row]')).toHaveLength(5)
})

it('reserves estimated height before opening and measured height when the file leaves view', () => {
  const seen = proximity()
  const file = addedFile(501)
  file.added = 2
  file.removed = 1
  renderGit([file])
  expect(dom.query('[data-diff-placeholder]')!.props.style).toMatchObject({ height: 440 })
  dom.act(() => seen.get(file.path)!(true))
  const wrapper = dom.query('[data-diff-file-body]')!.parentElement!
  Object.defineProperty(wrapper, 'offsetHeight', { value: 317 })
  dom.act(() => seen.get(file.path)!(false))
  expect(dom.query('[data-virtual-git]')!.props.style).toMatchObject({ height: 317 })
})
