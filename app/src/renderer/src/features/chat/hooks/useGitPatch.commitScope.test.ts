import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitDiffPatch } from '../../../../../shared/ipc'
import { chatReducer, initialChatState, type ChatState } from '../reducer/chatReducer'

const h = vi.hoisted(() => ({
  state: null as unknown as ChatState,
  effect: null as null | (() => void | (() => void)),
  ref: null as null | { current: { inFlightKey: string | null } },
  diffPatch: vi.fn(),
  receive: vi.fn()
}))
vi.mock('react', () => ({
  useEffect: (effect: () => void | (() => void)) => {
    h.effect = effect
  },
  useRef: (initial: { inFlightKey: string | null }) => (h.ref ??= { current: initial })
}))
vi.mock('../../../shared/api/ipc', () => ({ gitApi: { diffPatch: h.diffPatch } }))
vi.mock('../store/chatStore', () => ({
  useChatSession: (select: (state: ChatState) => unknown) => select(h.state),
  useChatStore: (select: (state: { activeKey: string }) => unknown) =>
    select({ activeKey: 'session' }),
  chatActions: { receiveGitPatch: h.receive }
}))
import { useGitPatch } from './useGitPatch'

const A = 'a'.repeat(40)
const B = 'b'.repeat(40)
const request = { key: 'repo-session', generation: 1 }
const patch: GitDiffPatch = {
  isRepo: true,
  base: { kind: 'none' },
  files: [],
  filesTruncated: false,
  contextLimited: false,
  unavailable: false
}
function HookProbe(): () => void {
  useGitPatch()
  return h.effect?.() || (() => {})
}
function select(sha: string): void {
  h.state = {
    ...h.state,
    gitSnapshot: { ...h.state.gitSnapshot, comparison: { kind: 'commit', sha } }
  }
}
function deferred(): { promise: Promise<GitDiffPatch>; resolve: (value: GitDiffPatch) => void } {
  let resolve!: (value: GitDiffPatch) => void
  const promise = new Promise<GitDiffPatch>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
beforeEach(() => {
  h.state = { ...initialChatState, cwd: '/repo', sessionId: 'session', gitSnapshotRequest: request }
  h.ref = null
  h.effect = null
  h.diffPatch.mockReset()
  h.receive.mockReset()
})
describe('실제 useGitPatch 비교 범위 배선', () => {
  it('completed A→B→A and reopen reuse reducer cache; a new generation fetches again', async () => {
    h.receive.mockImplementation((request, patch, comparison) => {
      h.state = chatReducer(h.state, { type: 'RECEIVE_GIT_PATCH', request, patch, comparison })
    })
    h.diffPatch.mockResolvedValue(patch)
    let cleanup: () => void = () => {}
    for (const sha of [A, B, A]) {
      cleanup()
      h.state = chatReducer(h.state, {
        type: 'SET_DIFF_COMPARISON',
        comparison: { kind: 'commit', sha }
      })
      cleanup = HookProbe()
      await Promise.resolve()
    }
    expect(h.diffPatch).toHaveBeenCalledTimes(2)
    expect(h.state.gitSnapshot.patch).toBe(patch)
    cleanup()
    h.ref = null
    HookProbe()()
    expect(h.diffPatch).toHaveBeenCalledTimes(2)
    h.state = chatReducer(h.state, {
      type: 'BEGIN_GIT_SNAPSHOT_QUERY',
      request: { ...request, generation: 2 }
    })
    HookProbe()
    expect(h.diffPatch).toHaveBeenCalledTimes(3)
  })
  it('선택한 SHA를 IPC로 보내고 이전 범위의 늦은 응답은 dispatch하지 않는다', async () => {
    const a = deferred()
    const b = deferred()
    h.diffPatch.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)
    select(A)
    const cleanupA = HookProbe()
    expect(h.diffPatch).toHaveBeenLastCalledWith({
      cwd: '/repo',
      sessionId: 'session',
      commitSha: A
    })
    cleanupA()
    select(B)
    HookProbe()
    expect(h.diffPatch).toHaveBeenLastCalledWith({
      cwd: '/repo',
      sessionId: 'session',
      commitSha: B
    })
    b.resolve(patch)
    await b.promise
    a.resolve(patch)
    await a.promise
    expect(h.receive).toHaveBeenCalledExactlyOnceWith(request, patch, { kind: 'commit', sha: B })
  })
  it('A→B→A 중 이전 A가 진행 중이어도 새 A를 요청한다', () => {
    h.diffPatch.mockReturnValue(new Promise(() => {}))
    select(A)
    HookProbe()()
    select(B)
    HookProbe()()
    select(A)
    HookProbe()
    expect(h.diffPatch).toHaveBeenCalledTimes(3)
    expect(h.diffPatch).toHaveBeenLastCalledWith({
      cwd: '/repo',
      sessionId: 'session',
      commitSha: A
    })
  })
  it('같은 범위의 저장된 패치로 다시 열면 조회하지 않는다', () => {
    select(A)
    h.state = { ...h.state, gitSnapshot: { ...h.state.gitSnapshot, patch } }
    HookProbe()()
    h.ref = null
    HookProbe()
    expect(h.diffPatch).not.toHaveBeenCalled()
  })
})
