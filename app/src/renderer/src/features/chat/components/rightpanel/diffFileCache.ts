import type { GitDiffFileContent } from '../../../../../../shared/ipc'

export function resetDiffFileCache(
  setExpanded: (value: readonly string[]) => void,
  setContents: (value: ReadonlyMap<string, GitDiffFileContent>) => void
): void {
  setExpanded([])
  setContents(new Map())
}
