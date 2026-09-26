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

describe('snapshot hook request lifecycle', () => {
  it('retains an initial status request across a same-cwd session switch without another API call', async () => {
    const pending = deferred()
    harness.snapshot.mockReturnValue(pending.promise)
    render('/repo', 's1')
    render('/repo', 's2')
    pending.resolve({ status, summary: null })
    await vi.waitFor(() =>
      expect(harness.actions.setGitStatus).toHaveBeenCalledWith({ cwd: '/repo', status })
    )
    expect(harness.snapshot).toHaveBeenCalledOnce()
    expect(harness.actions.beginGitSnapshotQuery).not.toHaveBeenCalled()
  })

  it('retains pending status through StrictMode effect replay', async () => {
    const pending = deferred()
    harness.snapshot.mockReturnValue(pending.promise)
    render('/repo', 's1')
    cleanup?.()
    cleanup = harness.effect!()
    pending.resolve({ status, summary: null })
    await vi.waitFor(() => expect(harness.actions.setGitStatus).toHaveBeenCalledOnce())
    expect(harness.snapshot).toHaveBeenCalledOnce()
  })

  it('discards a previous cwd response and an unmounted response', async () => {
    const old = deferred()
    const next = deferred()
    harness.snapshot.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise)
    render('/repo', 's1')
    render('/other', 's2')
    old.resolve({ status, summary: null })
    await new Promise((done) => setTimeout(done, 0))
    expect(harness.actions.setGitStatus).not.toHaveBeenCalled()
    cleanup?.()
    next.resolve({ status, summary: null })
    await new Promise((done) => setTimeout(done, 0))
    expect(harness.actions.setGitStatus).not.toHaveBeenCalled()
    expect(harness.snapshot).toHaveBeenCalledTimes(2)
  })

  it('does not transfer a pending summary to another session', async () => {
    harness.snapshot.mockResolvedValueOnce({ status, summary: null })
    render('/repo', 's1')
    await vi.waitFor(() => expect(harness.actions.setGitStatus).toHaveBeenCalledOnce())
    const pending = deferred()
    harness.snapshot.mockReturnValueOnce(pending.promise)
    harness.tick++
    render('/repo', 's1')
    render('/repo', 's2')
    pending.resolve({ status, summary: null })
    await new Promise((done) => setTimeout(done, 0))
    expect(harness.actions.setGitStatus).toHaveBeenCalledOnce()
    expect(harness.actions.receiveGitSnapshotSummary).not.toHaveBeenCalled()
    expect(harness.actions.failGitSnapshotQuery).not.toHaveBeenCalled()
    expect(harness.snapshot).toHaveBeenCalledTimes(2)
  })
})
