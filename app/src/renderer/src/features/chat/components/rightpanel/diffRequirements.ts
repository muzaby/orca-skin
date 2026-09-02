import type {
  DiffRequirementAnchor,
  DiffRequirementItem,
  GitDiffBase
} from '../../../../../../shared/ipc'
import type { DiffLine } from '../../lib/diffLines'

const CONTEXT_LINE_LIMIT = 200
const CONTEXT_LINE_COUNT = 3
const COMMENT_LIMIT = 2000

export interface CreateDiffRequirementInput {
  id: string
  sessionId: string
  base: GitDiffBase
  filePath: string
  lines: readonly DiffLine[]
  lineIndex: number
  comment: string
  createdAt: number
}

export function diffRequirementLineKey(
  filePath: string,
  oldLine: number | null,
  newLine: number | null
): string {
  return JSON.stringify([filePath, oldLine, newLine])
}

function cappedLine(text: string): string {
  return text.slice(0, CONTEXT_LINE_LIMIT)
}

function contextBefore(lines: readonly DiffLine[], lineIndex: number): string[] {
  return lines
    .slice(Math.max(0, lineIndex - CONTEXT_LINE_COUNT), lineIndex)
    .map((line) => cappedLine(line.text))
}

function contextAfter(lines: readonly DiffLine[], lineIndex: number): string[] {
  return lines
    .slice(lineIndex + 1, lineIndex + 1 + CONTEXT_LINE_COUNT)
    .map((line) => cappedLine(line.text))
}

function baselineCommit(base: GitDiffBase): string {
  return base.kind === 'none' ? 'HEAD' : base.oid
}

function rangeStart(
  lines: readonly DiffLine[],
  start: number,
  end: number,
  axis: 'old' | 'new'
): number {
  for (let i = start; i < end; i += 1) {
    const value = axis === 'old' ? lines[i].oldLine : lines[i].newLine
    if (value != null) return value
  }
  for (let i = start - 1; i >= 0; i -= 1) {
    const value = axis === 'old' ? lines[i].oldLine : lines[i].newLine
    if (value != null) return value + 1
  }
  return 0
}

function rangeCount(
  lines: readonly DiffLine[],
  start: number,
  end: number,
  axis: 'old' | 'new'
): number {
  let count = 0
  for (let i = start; i < end; i += 1) {
    const value = axis === 'old' ? lines[i].oldLine : lines[i].newLine
    if (value != null) count += 1
  }
  return count
}

function hunkHeader(lines: readonly DiffLine[], lineIndex: number): string {
  const start = Math.max(0, lineIndex - CONTEXT_LINE_COUNT)
  const end = Math.min(lines.length, lineIndex + CONTEXT_LINE_COUNT + 1)
  const oldStart = rangeStart(lines, start, end, 'old')
  const newStart = rangeStart(lines, start, end, 'new')
  const oldCount = rangeCount(lines, start, end, 'old')
  const newCount = rangeCount(lines, start, end, 'new')
  return `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`
}

function withLinePosition(
  anchor: DiffRequirementAnchor,
  lines: readonly DiffLine[],
  lineIndex: number
): DiffRequirementAnchor {
  const line = lines[lineIndex]
  return {
    sessionId: anchor.sessionId,
    baselineCommit: anchor.baselineCommit,
    filePath: anchor.filePath,
    oldLine: line.oldLine,
    newLine: line.newLine,
    hunkHeader: hunkHeader(lines, lineIndex),
    contextBefore: contextBefore(lines, lineIndex),
    contextAfter: contextAfter(lines, lineIndex),
    comment: anchor.comment,
    createdAt: anchor.createdAt
  }
}

export function wireDiffRequirementAnchor(anchor: DiffRequirementAnchor): DiffRequirementAnchor {
  return {
    sessionId: anchor.sessionId,
    baselineCommit: anchor.baselineCommit,
    filePath: anchor.filePath,
    oldLine: anchor.oldLine,
    newLine: anchor.newLine,
    hunkHeader: anchor.hunkHeader,
    contextBefore: [...anchor.contextBefore],
    contextAfter: [...anchor.contextAfter],
    comment: anchor.comment,
    createdAt: anchor.createdAt
  }
}

export function createDiffRequirementItem(input: CreateDiffRequirementInput): DiffRequirementItem {
  return {
    id: input.id,
    anchor: withLinePosition(
      {
        sessionId: input.sessionId,
        baselineCommit: baselineCommit(input.base),
        filePath: input.filePath,
        oldLine: null,
        newLine: null,
        hunkHeader: '',
        contextBefore: [],
        contextAfter: [],
        comment: input.comment.slice(0, COMMENT_LIMIT),
        createdAt: input.createdAt
      },
      input.lines,
      input.lineIndex
    ),
    located: true
  }
}

function matchesBeforeContext(candidate: readonly string[], saved: readonly string[]): boolean {
  if (saved.length > candidate.length) return false
  const offset = candidate.length - saved.length
  return saved.every((value, index) => value === candidate[offset + index])
}

function matchesAfterContext(candidate: readonly string[], saved: readonly string[]): boolean {
  if (saved.length > candidate.length) return false
  return saved.every((value, index) => value === candidate[index])
}

function matchesLineKind(anchor: DiffRequirementAnchor, line: DiffLine): boolean {
  if (anchor.oldLine === null) return line.oldLine === null
  if (anchor.newLine === null) return line.newLine === null
  return line.oldLine !== null && line.newLine !== null
}

function anchorLine(anchor: DiffRequirementAnchor): number {
  return anchor.newLine ?? anchor.oldLine ?? 0
}

function candidateLine(anchor: DiffRequirementAnchor, line: DiffLine): number {
  if (anchor.oldLine === null) return line.newLine ?? 0
  if (anchor.newLine === null) return line.oldLine ?? 0
  return line.newLine ?? line.oldLine ?? 0
}

function candidateMatches(
  item: DiffRequirementItem,
  lines: readonly DiffLine[],
  lineIndex: number
): boolean {
  return (
    matchesLineKind(item.anchor, lines[lineIndex]) &&
    matchesBeforeContext(contextBefore(lines, lineIndex), item.anchor.contextBefore) &&
    matchesAfterContext(contextAfter(lines, lineIndex), item.anchor.contextAfter)
  )
}

export function reanchorDiffRequirementItem(
  item: DiffRequirementItem,
  lines: readonly DiffLine[]
): DiffRequirementItem {
  let bestIndex: number | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  const savedLine = anchorLine(item.anchor)

  for (let index = 0; index < lines.length; index += 1) {
    if (!candidateMatches(item, lines, index)) continue
    const distance = Math.abs(candidateLine(item.anchor, lines[index]) - savedLine)
    if (distance < bestDistance) {
      bestIndex = index
      bestDistance = distance
    }
  }

  if (bestIndex === null) return { ...item, located: false }
  return {
    id: item.id,
    anchor: withLinePosition(item.anchor, lines, bestIndex),
    located: true
  }
}
