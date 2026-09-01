import { describe, expect, it, vi } from 'vitest'
import type { GitDiffFileContent } from '../../../../../../shared/ipc'
import {
  createDiffPeekBodyRequestOwner,
  diffPeekBodyKey,
  type DiffPeekBodyState
} from './diffFileCache'

describe('diff peek body request owner', () => {
  it('A identity의 늦은 같은-path 응답은 B identity의 현재 body를 채우지 못한다', async () => {
    const target = { group: { kind: 'uncommitted' as const }, path: 'src/a.ts' }
    const keyA = diffPeekBodyKey('/repo-a', 'session-a', target, 1)
    const keyB = diffPeekBodyKey('/repo-b', 'session-b', target, 1)
    const contentA: GitDiffFileContent = {
      kind: 'text',
      oldValue: 'A-old',
      newValue: 'A-new',
      truncated: false
    }
    const contentB: GitDiffFileContent = {
      kind: 'text',
      oldValue: 'B-old',
      newValue: 'B-new',
      truncated: false
    }
    let resolveA!: (content: GitDiffFileContent) => void
    let resolveB!: (content: GitDiffFileContent) => void
    const loadA = vi.fn(() => new Promise<GitDiffFileContent>((resolve) => (resolveA = resolve)))
    const loadB = vi.fn(() => new Promise<GitDiffFileContent>((resolve) => (resolveB = resolve)))
    const received: Array<{ key: string; generation: number; content: GitDiffFileContent }> = []
    const owner = createDiffPeekBodyRequestOwner()

    owner.run(
      keyA,
      loadA,
      (request, content) => received.push({ ...request, content }),
      () => undefined
    )
    owner.run(
      keyB,
      loadB,
      (request, content) => received.push({ ...request, content }),
      () => undefined
    )
    resolveA(contentA)
    await Promise.resolve()

    expect(received).toEqual([])
    resolveB(contentB)
    await Promise.resolve()
    expect(received).toEqual([{ key: keyB, generation: 2, content: contentB }])
    expect(loadA).toHaveBeenCalledTimes(1)
    expect(loadB).toHaveBeenCalledTimes(1)
  })

  it('summary generation이 바뀐 same-path body cache를 버리고 새 completion만 받는다', async () => {
    const target = { group: { kind: 'commit' as const, sha: 'commit-a' }, path: 'src/a.ts' }
    const keyA = diffPeekBodyKey('/repo', 'session-a', target, 1)
    const keyB = diffPeekBodyKey('/repo', 'session-a', target, 2)
    const oldContent: GitDiffFileContent = {
      kind: 'text',
      oldValue: 'old-before-refresh',
      newValue: 'old-after-refresh',
      truncated: false
    }
    const currentContent: GitDiffFileContent = {
      kind: 'text',
      oldValue: 'current-before-refresh',
      newValue: 'current-after-refresh',
      truncated: false
    }
    const cached: DiffPeekBodyState = { key: keyA, generation: 1, content: oldContent }
    let resolveOld!: (content: GitDiffFileContent) => void
    let resolveCurrent!: (content: GitDiffFileContent) => void
    const loadOld = vi.fn(
      () => new Promise<GitDiffFileContent>((resolve) => (resolveOld = resolve))
    )
    const loadCurrent = vi.fn(
      () => new Promise<GitDiffFileContent>((resolve) => (resolveCurrent = resolve))
    )
    const received: Array<{ key: string; generation: number; content: GitDiffFileContent }> = []
    const owner = createDiffPeekBodyRequestOwner()

    expect(keyB).not.toBe(keyA)
    expect(cached.key === keyB ? cached : null).toBeNull()

    owner.run(
      keyA,
      loadOld,
      (request, content) => received.push({ ...request, content }),
      () => undefined
    )
    owner.run(
      keyB,
      loadCurrent,
      (request, content) => received.push({ ...request, content }),
      () => undefined
    )
    resolveOld(oldContent)
    await Promise.resolve()

    expect(received).toEqual([])
    resolveCurrent(currentContent)
    await Promise.resolve()
    expect(received).toEqual([{ key: keyB, generation: 2, content: currentContent }])
    expect(loadOld).toHaveBeenCalledTimes(1)
    expect(loadCurrent).toHaveBeenCalledTimes(1)
  })
})
