import { describe, expect, it, vi } from 'vitest'
import type { GitDiffFileContent } from '../../../../../../shared/ipc'
import { createDiffFileRequestOwner } from './diffFileCache'

interface DiffFileRequestOwner {
  run(
    load: () => Promise<GitDiffFileContent>,
    onResult: (content: GitDiffFileContent) => void,
    onError: () => void
  ): void
  invalidate(): void
}

describe('diff file request owner', () => {
  it('commit A의 늦은 같은-path 응답이 commit B cache를 채우거나 B 조회를 생략시키지 않는다', async () => {
    const path = 'src/a.ts'
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
    const cache = new Map<string, GitDiffFileContent>()
    const owner: DiffFileRequestOwner = createDiffFileRequestOwner()

    owner.run(
      loadA,
      (content) => cache.set(path, content),
      () => undefined
    )
    owner.invalidate()
    cache.clear()
    resolveA(contentA)
    await Promise.resolve()

    expect(cache.has(path)).toBe(false)
    if (!cache.has(path)) {
      owner.run(
        loadB,
        (content) => cache.set(path, content),
        () => undefined
      )
    }
    expect(loadB).toHaveBeenCalledTimes(1)
    resolveB(contentB)
    await Promise.resolve()
    expect(cache.get(path)).toEqual(contentB)
  })
})
