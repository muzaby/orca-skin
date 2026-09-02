import { describe, expect, it, vi } from 'vitest'
import type { GitDiffSummary } from '../../../../../../shared/ipc'
import {
  createGitSnapshotQueryOwner,
  gitSnapshotQueryReason,
  gitSnapshotRequestKey,
  gitSnapshotTriggerKey
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
  it('summary query trigger count is limited to initial, identity, turn-end, and refresh inputs', () => {
    const reasons: Array<Exclude<ReturnType<typeof gitSnapshotQueryReason>, null>> = []
    let previous: Parameters<typeof gitSnapshotQueryReason>[0] = null
    const step = (identity: string, busy: boolean): void => {
      const reason = gitSnapshotQueryReason(previous, { identity, busy })
      previous = { identity, busy }
      if (reason) reasons.push(reason)
    }
    const base = gitSnapshotTriggerKey('/repo-a', 'session-a', 0)

    step(base, false)
    step(base, false) // tile mount/unmount or list↔peek without identity input changes
    step(base, true)
    step(base, false)
    step(gitSnapshotTriggerKey('/repo-b', 'session-b', 0), false)
    step(gitSnapshotTriggerKey('/repo-b', 'session-b', 1), false)

    expect(reasons).toEqual(['initial', 'turn-end', 'identity', 'identity'])
  })

  it('busy session A에서 idle session B로 바뀌면 B identity 조회 한 번만 판정한다', () => {
    const reasons: Array<ReturnType<typeof gitSnapshotQueryReason>> = []
    let previous: Parameters<typeof gitSnapshotQueryReason>[0] = {
      identity: gitSnapshotTriggerKey('/repo-a', 'session-a', 0),
      busy: true
    }
    for (const next of [
      { identity: gitSnapshotTriggerKey('/repo-b', 'session-b', 0), busy: false },
      { identity: gitSnapshotTriggerKey('/repo-b', 'session-b', 0), busy: false }
    ]) {
      reasons.push(gitSnapshotQueryReason(previous, next))
      previous = next
    }

    expect(reasons).toEqual(['identity', null])
    expect(
      gitSnapshotQueryReason(
        { identity: '["/repo-a","session-a",0]', busy: true },
        { identity: '["/repo-b","session-b",0]', busy: false }
      )
    ).toBe('identity')
    expect(
      gitSnapshotQueryReason(
        { identity: '["/repo-b","session-b",0]', busy: true },
        { identity: '["/repo-b","session-b",0]', busy: false }
      )
    ).toBe('turn-end')
  })

  it('cwd/session/refresh만 trigger key를 바꾸고 같은 입력의 remount는 바꾸지 않는다', () => {
    const base = gitSnapshotTriggerKey('/repo', 's1', 0)
    expect(gitSnapshotTriggerKey('/repo', 's1', 0)).toBe(base)
    expect(gitSnapshotTriggerKey('/repo-2', 's1', 0)).not.toBe(base)
    expect(gitSnapshotTriggerKey('/repo', 's2', 0)).not.toBe(base)
    expect(gitSnapshotTriggerKey('/repo', 's1', 1)).not.toBe(base)
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
