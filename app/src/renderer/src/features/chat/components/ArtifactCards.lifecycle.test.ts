import { beforeEach, expect, it, vi } from 'vitest'
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
import { ArtifactCards } from './ArtifactCard'
import type { ReactElement } from 'react'
import type { ArtifactRef } from '../../../../../shared/artifacts'
import { useConfirmStore } from '../../../shared/ui/confirmDialogStore'
const ref = {
  publicationId: 'p',
  artifactFileId: 'f',
  title: 'Report',
  filename: 'report.md',
  kind: 'markdown' as const,
  sizeBytes: 10,
  publishedAt: 1
}
function render(refs = [ref]): ReturnType<typeof ArtifactCards> {
  h.stateIndex = h.refIndex = h.effectIndex = 0
  h.pending = []
  const result = ArtifactCards({ artifacts: refs })
  for (const run of h.pending) run()
  return result
}
beforeEach(() => {
  h.states = []
  h.refs = []
  h.effects = []
  h.sessionId = 's'
  vi.clearAllMocks()
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

it('trash waits for confirmation, captures the original session, and drops a late result after cleanup', async () => {
  let resolve!: (result: { outcome: 'trashed'; deletionRecorded: boolean }) => void
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
  resolve({ outcome: 'trashed', deletionRecorded: true })
  await Promise.resolve()
  await Promise.resolve()
  expect(h.states[0]).toBeNull()
})
