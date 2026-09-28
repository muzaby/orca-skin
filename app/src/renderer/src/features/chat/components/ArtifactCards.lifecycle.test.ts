import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({
  sessionId: 's',
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  effects: [] as { deps: readonly unknown[]; cleanup?: () => void }[],
  pending: [] as (() => void)[],
  stateIndex: 0,
  refIndex: 0,
  effectIndex: 0,
  acquire: vi.fn(() => vi.fn()),
  status: vi.fn(),
  action: vi.fn(),
  report: vi.fn(),
  same: (a: readonly unknown[], b: readonly unknown[]): boolean =>
    a.length === b.length && a.every((value, i) => Object.is(value, b[i]))
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useEffectEvent: (callback: () => unknown) => callback,
  useState: (initial: unknown) => {
    const i = h.stateIndex++
    if (!(i in h.states)) h.states[i] = initial
    return [
      h.states[i],
      (next: unknown) => {
        h.states[i] = next
      }
    ]
  },
  useRef: (initial: unknown) => {
    const i = h.refIndex++
    return (h.refs[i] ??= { current: initial })
  },
  useEffect: (run: () => (() => void) | void, deps: readonly unknown[]) => {
    const i = h.effectIndex++
    if (!h.effects[i] || !h.same(h.effects[i].deps, deps))
      h.pending.push(() => {
        h.effects[i]?.cleanup?.()
        h.effects[i] = { deps, cleanup: run() || undefined }
      })
  }
}))
vi.mock('../store/chatStore', () => ({
  useChatStore: Object.assign(
    (select: (state: { activeKey: string }) => unknown) => select({ activeKey: h.sessionId }),
    { getState: () => ({ activeKey: h.sessionId }) }
  ),
  useChatSession: (selector: (s: { sessionId: string }) => unknown) =>
    selector({ sessionId: h.sessionId })
}))
vi.mock('../store/artifactStore', () => ({
  useArtifactStore: (selector: (s: { sessions: object }) => unknown) => selector({ sessions: {} }),
  acquireArtifacts: h.acquire,
  refreshArtifactStatuses: h.status,
  runArtifactAction: h.action
}))
vi.mock('../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
vi.mock('../lib/artifactIssueReport', () => ({ reportArtifactIssue: h.report }))
import { ArtifactCard } from './ArtifactCard'
import { ArtifactCards } from './ArtifactCards'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import type { ArtifactRef } from '../../../../../shared/artifacts'
import { useConfirmStore } from '../../../shared/ui/confirmDialogStore'
import { closeArtifactViewer, useArtifactViewerStore } from '../store/artifactViewerStore'
const ref = {
  publicationId: 'p',
  artifactFileId: 'f',
  title: 'Report',
  filename: 'report.md',
  kind: 'markdown' as const,
  sizeBytes: 10,
  publishedAt: 1
}
function render(
  refs = [ref],
  variant: 'list' | 'transcript' = 'transcript'
): ReturnType<typeof ArtifactCards> {
  h.stateIndex = h.refIndex = h.effectIndex = 0
  h.pending = []
  const result = ArtifactCards({ artifacts: refs, variant })
  for (const run of h.pending) run()
  return result
}
beforeEach(() => {
  h.states = []
  h.refs = []
  h.effects = []
  h.sessionId = 's'
  vi.clearAllMocks()
  closeArtifactViewer()
})
afterEach(() => vi.unstubAllGlobals())

function previewTrigger(tree: ReactNode):
  | ReactElement<{
      'data-artifact-preview': string
      onClick: (event: { currentTarget: HTMLElement }) => void
    }>
  | undefined {
  for (const child of Children.toArray(tree)) {
    if (!isValidElement<{ children?: ReactNode; 'data-artifact-preview'?: string }>(child)) continue
    if (child.props['data-artifact-preview']) return child as ReturnType<typeof previewTrigger>
    const nested = previewTrigger(child.props.children)
    if (nested) return nested
  }
  return undefined
}

it.each(['transcript', 'list'] as const)(
  '%s primary button opens the exact publication through the real cards callback',
  async (variant) => {
    vi.stubGlobal('window', {
      orca: {
        artifacts: {
          preview: async () => ({
            state: 'ready',
            format: 'markdown',
            content: '# actual preview',
            mimeType: 'text/markdown'
          })
        }
      }
    })
    const tree = render([ref], variant) as ReactElement<{ children: unknown[] }>
    const cards = tree.props.children[1] as ReactElement<Parameters<typeof ArtifactCard>[0]>[]
    h.stateIndex = h.refIndex = 0
    const trigger = previewTrigger(ArtifactCard(cards[0].props))
    expect(trigger?.props['data-artifact-preview']).toBe('p')
    const origin = {} as HTMLElement
    trigger?.props.onClick({ currentTarget: origin })
    expect(useArtifactViewerStore.getState().selection).toMatchObject({
      sessionKey: 's',
      sessionId: 's',
      artifact: ref,
      origin,
      loading: true
    })
    await Promise.resolve()
    expect(useArtifactViewerStore.getState().selection?.result).toMatchObject({
      state: 'ready',
      content: '# actual preview'
    })
  }
)

it('ignores a stale card callback after the active session changes', () => {
  vi.stubGlobal('window', { orca: { artifacts: { preview: vi.fn() } } })
  const tree = render() as ReactElement<{ children: unknown[] }>
  const cards = tree.props.children[1] as ReactElement<Parameters<typeof ArtifactCard>[0]>[]
  h.sessionId = 'other'
  cards[0].props.onPreview(ref, {} as HTMLElement)
  expect(useArtifactViewerStore.getState().selection).toBeNull()
})
it('same publication IDs from another transcript projection do not resubscribe or restat; session change does', () => {
  render()
  render([{ ...ref }])
  expect(h.status).toHaveBeenCalledTimes(1)
  expect(h.acquire).toHaveBeenCalledTimes(1)
  const cleanup = h.acquire.mock.results[0].value
  h.sessionId = 'other'
  render()
  expect(cleanup).toHaveBeenCalledOnce()
  expect(h.status).toHaveBeenLastCalledWith('other', [ref])
})

it('trash waits for confirmation and still reports a late failure after the session changes (0242 ΔV2)', async () => {
  let resolve!: (result: { outcome: 'already-missing' }) => void
  h.action.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  const tree = render() as ReactElement<{ children: unknown[] }>
  const cards = tree.props.children[1] as ReactElement<{
    onAction: (ref: ArtifactRef, action: 'trash') => void
  }>[]
  cards[0].props.onAction(ref, 'trash')
  expect(h.action).not.toHaveBeenCalled()
  useConfirmStore.getState().request?.onConfirm()
  expect(h.action).toHaveBeenCalledWith('s', [ref], 'trash')
  h.sessionId = 'other'
  render()
  resolve({ outcome: 'already-missing' })
  await Promise.resolve()
  await Promise.resolve()
  expect(h.report.mock.calls).toEqual([
    [{ event: 'artifacts.trash.failed', filename: 'report.md', reason: 'missing' }]
  ])
})

it('reports each failed action issue as a toast and renders no inline issue list (0242 ΔV2 AC19)', async () => {
  const other = { ...ref, publicationId: 'q', artifactFileId: 'g', filename: 'data.csv' }
  const cases: [unknown, unknown[]][] = [
    [
      {
        outcome: 'completed',
        items: [
          { publicationId: 'p', outcome: 'failed', reason: 'missing' },
          { publicationId: 'q', outcome: 'failed', reason: 'access-denied' }
        ]
      },
      [
        { event: 'artifacts.save.failed', filename: 'report.md', reason: 'missing' },
        { event: 'artifacts.save.failed', filename: 'data.csv', reason: 'access-denied' }
      ]
    ],
    [
      { ok: false, reason: 'unsafe-path' },
      [{ event: 'artifacts.reveal.failed', filename: 'report.md', reason: 'unsafe-path' }]
    ],
    [
      { outcome: 'trashed', deletionRecorded: false },
      [
        {
          event: 'artifacts.trash.failed',
          filename: 'report.md',
          reason: undefined,
          messageKey: 'chat.artifacts.trashedUnrecorded'
        }
      ]
    ],
    [
      {
        outcome: 'completed',
        items: [{ publicationId: 'p', outcome: 'skipped', reason: 'missing' }]
      },
      [{ event: 'artifacts.save.failed', filename: 'report.md', reason: 'missing' }]
    ],
    [{ ok: false, reason: 'busy' }, []],
    [{ outcome: 'completed', items: [{ publicationId: 'p', outcome: 'saved' }] }, []],
    [{ outcome: 'cancelled', items: [] }, []]
  ]
  for (const [result, expected] of cases) {
    h.report.mockClear()
    h.action.mockResolvedValueOnce(result)
    const refs = expected.length === 2 ? [ref, other] : [ref]
    const tree = render(refs) as ReactElement<{ children: unknown[] }>
    const operation =
      (expected[0] as { event?: string } | undefined)?.event?.split('.')[1] ?? 'save'
    const cards = tree.props.children[1] as ReactElement<{
      onAction: (ref: ArtifactRef, action: string) => void
    }>[]
    if (refs.length === 2) {
      const saveAll = tree.props.children[0] as ReactElement<{
        children: ReactElement<{ onClick: () => void }>
      }>
      saveAll.props.children.props.onClick()
    } else {
      cards[0].props.onAction(ref, operation)
      if (operation === 'trash') useConfirmStore.getState().request?.onConfirm()
    }
    for (let i = 0; i < 4; i++) await Promise.resolve()
    expect(h.report.mock.calls.map(([call]) => call)).toEqual(expected)
    const after = render(refs) as ReactElement<{ children: unknown[] }>
    expect(after.props.children).toHaveLength(2)
  }
})
