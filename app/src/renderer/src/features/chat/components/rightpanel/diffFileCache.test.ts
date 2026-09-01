import { describe, expect, it, vi } from 'vitest'
import type { GitDiffFileContent } from '../../../../../../shared/ipc'
import { createDiffPeekBodyRequestOwner, diffPeekBodyKey } from './diffFileCache'

describe('diff peek body request owner', () => {
  it('A identity의 늦은 같은-path 응답은 B identity의 현재 body를 채우지 못한다', async () => {
    const target = { group: { kind: 'uncommitted' as const }, path: 'src/a.ts' }
    const keyA = diffPeekBodyKey('/repo-a', 'session-a', target)
    const keyB = diffPeekBodyKey('/repo-b', 'session-b', target)
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
})
