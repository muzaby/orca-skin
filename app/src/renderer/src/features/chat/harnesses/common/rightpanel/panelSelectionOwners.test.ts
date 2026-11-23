import { createElement } from 'react'
import { it, expect, vi, afterEach } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import { installViewportSelection } from '../../../components/transcript/viewportSelection.testfixture'
import { DEFAULT_DIFF_VIEW } from '../../../reducer/chatReducer'
import { DiffReview } from './DiffReview'
import { ArtifactViewer } from './ArtifactViewer'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useId: () => ':fixture:'
}))
vi.mock('@tanstack/react-virtual', async (original) => ({
  ...(await original<typeof import('@tanstack/react-virtual')>()),
  useVirtualizer: (options: { count: number; scrollMargin: number }) => ({
    options,
    getVirtualItems: () =>
      Array.from({ length: Math.min(4, options.count) }, (_, index) => ({
        index,
        key: index,
        start: index * 20
      })),
    getTotalSize: () => options.count * 20,
    measurementsCache: [],
    measureElement: () => {}
  })
}))
vi.mock('../../../../../shared/compute/useComputeDocument', () => ({
  useComputeDocument: () => ({ ref: { id: 'fixture', revision: 1 }, ready: false })
}))
vi.mock('../../../hooks/useWindowTokens', () => ({ useWindowTokens: () => undefined }))
vi.mock('../../../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key }),
  i18n: { t: (key: string) => key }
}))
const rows = Array.from({ length: 501 }, (_, i) => 'line ' + i)
const path = 'sample.txt'
const file = {
  path,
  kind: 'text' as const,
  status: 'modified' as const,
  added: rows.length,
  removed: 0,
  lines: rows.map((text, index) => ({
    type: 'added' as const,
    text,
    oldLine: null,
    newLine: index + 1
  }))
}
function view(kind: 'git' | 'artifact', open: boolean): React.ReactElement {
  if (kind === 'git')
    return createElement(DiffReview, {
      summary: null,
      hasRequest: true,
      patch: {
        files: [file],
        base: { kind: 'none' },
        isRepo: true,
        filesTruncated: false,
        contextLimited: false,
        unavailable: false
      },
      comparison: { kind: 'all' },
      expandedFiles: new Set(open ? [path] : []),
      sidebarVisible: false,
      view: DEFAULT_DIFF_VIEW,
      draft: null,
      requirements: [],
      onToggleExpanded: vi.fn(),
      onExpandFile: vi.fn(),
      onOpenFile: vi.fn(),
      onPickComparison: vi.fn()
    })
  return createElement(ArtifactViewer, {
    selection: {
      sessionKey: 's',
      sessionId: 's',
      request: 1,
      expanded: true,
      loading: !open,
      mode: 'code',
      artifact: {
        publicationId: 'p',
        artifactFileId: 'f',
        title: path,
        filename: path,
        kind: 'text',
        sizeBytes: 3000,
        publishedAt: 1
      },
      result: open
        ? {
            state: 'ready',
            format: 'text',
            content: rows.join('\n'),
            language: 'text',
            mimeType: 'text/plain'
          }
        : undefined
    }
  })
}
let dom: FakeDom
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
})
it.each([
  ['po1', 'git', false, false],
  ['po2', 'git', true, false],
  ['po3', 'git', false, true],
  ['po4', 'artifact', false, false],
  ['po5', 'artifact', false, true]
] as const)('%s %s owner on first mount (outside %s, drag %s)', (_, kind, outside, drag) => {
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 800 })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      disconnect = vi.fn()
    }
  )
  const { selection, select } = installViewportSelection(dom)
  const render = (open: boolean): void =>
    dom.render(
      createElement(
        'main',
        null,
        createElement('aside', { 'data-other': '' }, 'outside'),
        view(kind, open)
      )
    )
  render(false)
  const owner = (): import('../../../../../shared/ui/renderHarness.testfixture').FakeNode =>
    dom.query(kind === 'git' ? '[data-diff-scroll-owner]' : '[data-artifact-viewer-body]')!
  const target = outside ? dom.query('[data-other]')! : owner()
  if (drag) {
    const down = owner().props.onPointerDown as (event: { button: number }) => void
    dom.act(() => down({ button: 0 }))
  }
  if (kind === 'artifact') {
    // Endpoints on the persistent body survive replacement of its loading child.
    selection.setBaseAndExtent(target, 0, target, 1)
    dom.act(() => {
      for (const listener of dom.documentListeners.get('selectionchange') ?? []) listener({})
    })
  } else select(target, 0, target, 1)
  expect(selection.rangeCount).toBe(1)
  render(true)
  expect(dom.query(kind === 'git' ? '[data-window-row]' : '[data-virtual-index]')).not.toBeNull()
  expect(selection.rangeCount).toBe(outside ? 1 : 0)
  expect(owner().getAttribute('data-selection-suppressed')).toBe(drag ? '' : null)
})
