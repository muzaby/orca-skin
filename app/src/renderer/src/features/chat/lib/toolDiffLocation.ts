import type { GitDiffPatch, GitDiffPatchFile, GitDiffPatchLine } from '../../../../../shared/ipc'
import type { DiffPair } from './diffLines'

export interface ToolDiffLocation {
  oldStartLine: number | null
  newStartLine: number | null
}

function textLines(text: string): string[] {
  if (text === '') return []
  const lines = text.split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines
}

function matchingStarts(
  lines: readonly GitDiffPatchLine[],
  expected: readonly string[],
  axis: 'old' | 'new'
): GitDiffPatchLine[] {
  if (expected.length === 0) return []
  const visible = lines.filter((line) =>
    axis === 'old' ? line.type !== 'added' : line.type !== 'removed'
  )
  const matches: GitDiffPatchLine[] = []
  for (let start = 0; start + expected.length <= visible.length; start++) {
    if (expected.every((text, offset) => visible[start + offset].text === text))
      matches.push(visible[start])
  }
  return matches
}

function matchingFile(patch: GitDiffPatch, filePath: string): GitDiffPatchFile | null {
  const normalized = filePath.replaceAll('\\', '/')
  const matches = patch.files.filter((file) => {
    const path = file.path.replaceAll('\\', '/')
    return normalized === path || normalized.endsWith(`/${path}`)
  })
  return matches.length === 1 && matches[0].kind === 'text' ? matches[0] : null
}

/** 도구의 exact old/new 본문이 Git patch의 각 축에 유일하게 대응할 때만 실제 줄을 반환한다. */
export function locateToolDiffPairs(
  patch: GitDiffPatch | null,
  filePath: string,
  pairs: readonly DiffPair[]
): ToolDiffLocation[] {
  const file = patch && matchingFile(patch, filePath)
  if (!file) return pairs.map(() => ({ oldStartLine: null, newStartLine: null }))
  return pairs.map((pair) => {
    const oldMatches = matchingStarts(file.lines, textLines(pair.oldValue), 'old')
    const newMatches = matchingStarts(file.lines, textLines(pair.newValue), 'new')
    const oldStartLine = oldMatches.length === 1 ? oldMatches[0].oldLine : null
    const newStartLine = newMatches.length === 1 ? newMatches[0].newLine : null
    // 두 본문이 있는 Edit는 양쪽 모두 유일해야 같은 변경이라고 말할 수 있다.
    if (pair.oldValue !== '' && pair.newValue !== '' && (!oldStartLine || !newStartLine))
      return { oldStartLine: null, newStartLine: null }
    return { oldStartLine, newStartLine }
  })
}
