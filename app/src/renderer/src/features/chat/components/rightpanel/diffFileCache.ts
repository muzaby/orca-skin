import type { GitDiffFileContent } from '../../../../../../shared/ipc'

interface DiffFileRequestOwner {
  run(
    load: () => Promise<GitDiffFileContent>,
    onResult: (content: GitDiffFileContent) => void,
    onError: () => void
  ): void
  invalidate(): void
}

export function createDiffFileRequestOwner(): DiffFileRequestOwner {
  let generation = 0
  return {
    run(load, onResult, onError) {
      const requestGeneration = generation
      void load()
        .then((content) => {
          if (requestGeneration === generation) onResult(content)
        })
        .catch(() => {
          if (requestGeneration === generation) onError()
        })
    },
    invalidate() {
      generation += 1
    }
  }
}

export function resetDiffFileCache(
  setExpanded: (value: readonly string[]) => void,
  setContents: (value: ReadonlyMap<string, GitDiffFileContent>) => void
): void {
  setExpanded([])
  setContents(new Map())
}
