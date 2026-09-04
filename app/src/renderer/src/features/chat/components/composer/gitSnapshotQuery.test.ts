import { chatReducer, initialChatState } from '../../reducer/chatReducer'
import { describe, expect, it, vi } from 'vitest'
import type { GitDiffSummary } from '../../../../../../shared/ipc'
import {
  createGitSnapshotQueryOwner,
  gitSnapshotRequestKey,
  gitSnapshotTriggerKey,
  gitStatusTriggerKey
} from './useGitSnapshot'

const SUMMARY_A: GitDiffSummary = {
  isRepo: true,
  base: { kind: 'head', oid: 'head-oid' },
  files: [{ path: 'a.ts', status: 'modified', added: 1, removed: 0, binary: false }],
  totals: { added: 0, removed: 0 },
  filesTruncated: false,
  commits: [],
  commitsTruncated: false,
  commitFilesUnavailable: false,
  uncommitted: { files: [], totals: { added: 0, removed: 0 }, filesTruncated: false }
}
const SUMMARY_B: GitDiffSummary = { ...SUMMARY_A, files: [] }

interface Request {
  key: string
  generation: number
}

interface QueryOwner {
  run(
    key: string,
    load: () => Promise<GitDiffSummary>,
    onStart: (request: Request) => void,
    onResult: (request: Request, summary: GitDiffSummary) => void
  ): () => void
}

describe('git snapshot query owner', () => {
  // 0211 ΔV5 D-099 — 키에서 `refreshGeneration` 이 빠졌다. 새로고침 계기가 사라져 그 축이
  // 아무것도 세지 않는다.
  it('cwd/session만 trigger key를 바꾸고 같은 입력의 remount는 바꾸지 않는다', () => {
    const base = gitSnapshotTriggerKey('/repo', 's1')
    expect(gitSnapshotTriggerKey('/repo', 's1')).toBe(base)
    expect(gitSnapshotTriggerKey('/repo-2', 's1')).not.toBe(base)
    expect(gitSnapshotTriggerKey('/repo', 's2')).not.toBe(base)
    // 상태 키는 커밋도 세션도 보지 않는다 — 이름은 저장소 좌표만의 함수다.
    expect(gitStatusTriggerKey('/repo')).toBe(gitStatusTriggerKey('/repo'))
    expect(gitStatusTriggerKey('/repo-2')).not.toBe(gitStatusTriggerKey('/repo'))
  })

  it('같은 request key의 B가 먼저 끝나면 늦은 A 결과를 버린다', async () => {
    let resolveA!: (summary: GitDiffSummary) => void
    let resolveB!: (summary: GitDiffSummary) => void
    const loadA = vi.fn(() => new Promise<GitDiffSummary>((resolve) => (resolveA = resolve)))
    const loadB = vi.fn(() => new Promise<GitDiffSummary>((resolve) => (resolveB = resolve)))
    const results: GitDiffSummary[] = []
    const starts: Request[] = []
    const owner: QueryOwner = createGitSnapshotQueryOwner()
    const key = gitSnapshotRequestKey('/repo', 's1')

    owner.run(
      key,
      loadA,
      (request) => starts.push(request),
      (_request, summary) => results.push(summary)
    )
    owner.run(
      key,
      loadB,
      (request) => starts.push(request),
      (_request, summary) => results.push(summary)
    )
    resolveB(SUMMARY_B)
    await Promise.resolve()
    resolveA(SUMMARY_A)
    await Promise.resolve()

    expect(loadA).toHaveBeenCalledTimes(1)
    expect(loadB).toHaveBeenCalledTimes(1)
    expect(starts.map((request) => request.generation)).toEqual([1, 2])
    expect(results).toEqual([SUMMARY_B])
  })

  it('화면 재마운트의 새 owner는 저장된 패치보다 새 세대를 발급한다', () => {
    const key = gitSnapshotRequestKey('/repo', 's1')
    let state = initialChatState
    const start = (request: Request): void => {
      state = chatReducer(state, { type: 'BEGIN_GIT_SNAPSHOT_QUERY', request })
    }
    const load = (): Promise<GitDiffSummary> => new Promise(() => {})
    const cleanup = createGitSnapshotQueryOwner().run(key, load, start, () => {})
    const previous = state.gitSnapshotRequest!
    state = chatReducer(state, {
      type: 'RECEIVE_GIT_PATCH',
      request: previous,
      comparison: { kind: 'all' },
      patch: {
        isRepo: true,
        base: SUMMARY_A.base,
        files: [],
        filesTruncated: false,
        contextLimited: false,
        unavailable: false
      }
    })
    expect(state.gitSnapshot.patch).not.toBeNull()
    cleanup()
    createGitSnapshotQueryOwner().run(key, load, start, () => {})
    expect(state.gitSnapshotRequest!.generation).toBeGreaterThan(previous.generation)
    expect(state.gitSnapshot.patch).toBeNull()
  })

  it('owner cleanup 뒤 도착한 결과는 commit하지 않는다', async () => {
    let resolve!: (summary: GitDiffSummary) => void
    const results: GitDiffSummary[] = []
    const cancel = createGitSnapshotQueryOwner().run(
      'key',
      () => new Promise<GitDiffSummary>((done) => (resolve = done)),
      () => undefined,
      (_request, summary) => results.push(summary)
    )
    cancel()
    resolve(SUMMARY_A)
    await Promise.resolve()

    expect(results).toEqual([])
  })
})
