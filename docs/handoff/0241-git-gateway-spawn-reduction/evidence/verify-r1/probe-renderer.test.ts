import { beforeEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effect: null as (() => (() => void) | undefined) | null,
  tick: 0,
  snapshot: vi.fn(),
  actions: {
    setGitStatus: vi.fn(),
    beginGitSnapshotQuery: vi.fn(),
    receiveGitSnapshotSummary: vi.fn(),
    failGitSnapshotQuery: vi.fn()
  }
}))
vi.mock('react', () => ({
  useRef: (initial: unknown) => {
    const index = harness.cursor++
    return (harness.slots[index] ??= { current: initial })
  },
  useState: (initial: () => unknown) => {
    const index = harness.cursor++
    return [(harness.slots[index] ??= initial())]
  },
  useEffect: (effect: typeof harness.effect) => {
    harness.effect = effect
  }
}))
vi.mock('../../../../shared/api/ipc', () => ({ gitApi: { snapshot: harness.snapshot } }))
vi.mock('../../store/chatStore', () => ({
  chatActions: harness.actions,
  turnEndTick: () => harness.tick,
  useChatSession: (selector: (state: { gitRefreshTick: number }) => unknown) =>
    selector({ gitRefreshTick: 0 })
}))

import { useGitSnapshot } from './useGitSnapshot'

const status = { isRepo: true, branch: 'main', detached: false, root: '/repo', githubUrl: null }
function deferred(): {
  promise: Promise<{ status: typeof status; summary: null }>
  resolve: (value: { status: typeof status; summary: null }) => void
} {
  let resolve!: (value: { status: typeof status; summary: null }) => void
  const promise = new Promise<{ status: typeof status; summary: null }>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
let cleanup: (() => void) | undefined
function render(cwd: string, sessionId: string): void {
  harness.cursor = 0
  // eslint-disable-next-line react-hooks/rules-of-hooks -- Runs the real hook through the mocked lifecycle above.
  useGitSnapshot(cwd, sessionId)
  cleanup?.()
  cleanup = harness.effect!()
}
beforeEach(() => {
  cleanup?.()
  cleanup = undefined
  harness.slots = []
  harness.tick = 0
  vi.clearAllMocks()
})
describe('verifier probe P1', () => {
  it('turn-end snapshot applies status and summary', async () => {
    harness.snapshot.mockResolvedValueOnce({ status, summary: null })
    render('/repo', 's1')
    await vi.waitFor(() => expect(harness.actions.setGitStatus).toHaveBeenCalledOnce())
    const moved = { ...status, branch: 'feature' }
    const summary = { isRepo: true } as never
    harness.snapshot.mockResolvedValueOnce({ status: moved, summary })
    harness.tick++
    render('/repo', 's1')
    await vi.waitFor(() =>
      expect(harness.actions.setGitStatus).toHaveBeenLastCalledWith({ cwd: '/repo', status: moved })
    )
    expect(harness.snapshot).toHaveBeenLastCalledWith({ cwd: '/repo', sessionId: 's1', includeSummary: true })
    expect(harness.actions.receiveGitSnapshotSummary).toHaveBeenCalledOnce()
  })
})
