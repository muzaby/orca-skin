import { buildDiffLines } from '../../../lib/diffLines'
import { unifiedDiffLines } from '../../../lib/unifiedDiffLines'
import type { OpenCodeFileView } from '../toolPresentation'

export const fileName = (path: string): string => path.replace(/\\/g, '/').split('/').at(-1) || path

export function fileDiffLines(file: OpenCodeFileView): ReturnType<typeof buildDiffLines> {
  return file.before != null || file.after != null
    ? buildDiffLines(file.before ?? '', file.after ?? '')
    : unifiedDiffLines(file.patch ?? '')
}

export function fileChanges(files: OpenCodeFileView[]): { added: number; removed: number } {
  const lines = files.flatMap(fileDiffLines)
  return {
    added: lines.filter((line) => line.type === 'added').length,
    removed: lines.filter((line) => line.type === 'removed').length
  }
}
