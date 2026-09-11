// Claude Agent SDK 의 파일 편집 도구 wire 형태 (L0 — 양 프로세스 안전, 런타임 의존 0).
//
// 왜 shared 인가: 도구 이름과 **구조화 패치 해석 규칙**을 main(어댑터가 결과에 실을지 판정)과
// renderer(그 패치를 diff 줄로 편다)가 각자 들면 SDK 가 형태를 바꿀 때 두 곳이 함께 어긋난다 —
// 프로세스 경계를 넘는 wire 상수라 shared 가 단일 소유한다(`task-tool.ts` 선례, 0204).
//
// 출력 형태의 정본은 SDK `sdk-tools.d.ts` 의 `FileEditOutput.structuredPatch` 다. SDK 는
// `tool_use_result` 를 "render from it instead of parsing the tool_result text" 로 규정하므로
// (`sdk.d.ts` SDKUserMessage), 카드의 줄번호는 결과 텍스트가 아니라 이 패치가 정본이다(0228 D-006).
// 형태가 어긋나면 `null` 을 돌려준다 — 거짓 줄번호보다 폴백 렌더를 택한다.

import type { GitDiffPatchLine } from './ipc'
import { isRecord } from './obj'

// 대화록이 diff 카드로 그리는 편집 도구. `MultiEdit` 은 현재 SDK `ToolInputSchemas` 에 없고
// 과거 세션에만 남아 있다 — 이름 술어에는 포함되지만 구조화 패치는 오지 않는다(0228 D-010).
export const FILE_EDIT_TOOL_NAMES = ['Write', 'Edit', 'MultiEdit'] as const

export type FileEditToolName = (typeof FILE_EDIT_TOOL_NAMES)[number]

export const FILE_EDIT_TOOL_NAME_SET: ReadonlySet<string> = new Set(FILE_EDIT_TOOL_NAMES)

export function isFileEditToolName(name: string): name is FileEditToolName {
  return FILE_EDIT_TOOL_NAME_SET.has(name)
}

// 구조화 패치를 **실어 영속하는** 도구. `Write` 는 입력 `content` 가 이미 파일 전체라 1번 줄부터
// 세는 현재 렌더가 정확하고, 실으면 같은 본문을 두 번 영속한다(0228 D-009).
export function carriesFileEditPatch(name: string): boolean {
  return name === 'Edit'
}

/** SDK `FileEditOutput.structuredPatch` 의 hunk 하나. 좌표는 SDK 가 준 값 그대로 쓴다. */
export interface FileEditPatchHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  /** unified diff 본문 줄 — 선두 문자가 `+`/`-`/공백이고 `\` 는 직전 줄의 성질이다. */
  lines: string[]
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0
}

// 한 hunk 의 형태와 **자기 정합성**을 함께 본다. 줄 수가 `oldLines`/`newLines` 와 어긋나면
// 그 뒤 좌표가 전부 밀리므로 여기서 거부한다 — 카드가 실제와 다른 줄을 사실처럼 보이는 것보다
// 폴백이 낫다(0228 §10 EP-05).
function asHunk(value: unknown): FileEditPatchHunk | null {
  if (!isRecord(value)) return null
  const { oldStart, oldLines, newStart, newLines, lines } = value
  if (
    !isCount(oldStart) ||
    !isCount(oldLines) ||
    !isCount(newStart) ||
    !isCount(newLines) ||
    !Array.isArray(lines) ||
    !lines.every((line) => typeof line === 'string')
  )
    return null
  const body = (lines as string[]).filter((line) => !line.startsWith('\\'))
  const added = body.filter((line) => line.startsWith('+')).length
  const removed = body.filter((line) => line.startsWith('-')).length
  const common = body.length - added - removed
  if (removed + common !== oldLines || added + common !== newLines) return null
  return { oldStart, oldLines, newStart, newLines, lines: lines as string[] }
}

// `{ structuredPatch }` 를 담은 객체에서 hunk 배열만 좁혀 읽는다. SDK 원본(`FileEditOutput`)과
// 어댑터가 투영한 `{ structuredPatch }` 둘 다 같은 키라 리더가 하나면 된다.
export function readFileEditStructuredPatch(value: unknown): FileEditPatchHunk[] | null {
  if (!isRecord(value) || !Array.isArray(value.structuredPatch)) return null
  const hunks: FileEditPatchHunk[] = []
  for (const raw of value.structuredPatch) {
    const hunk = asHunk(raw)
    if (!hunk) return null
    hunks.push(hunk)
  }
  return hunks.length > 0 ? hunks : null
}

// hunk → 패널과 같은 패치 줄(`GitDiffPatchLine`). 줄번호는 hunk 머리말의 시작값에서 전진시킨다 —
// `unchanged` 는 두 축 모두, `removed` 는 old, `added` 는 new 만(`infra/git/git-diff-parse.ts`
// 와 같은 규칙). 입력은 `readFileEditStructuredPatch` 를 통과한 hunk 여야 한다.
export function fileEditPatchLines(hunks: readonly FileEditPatchHunk[]): GitDiffPatchLine[] {
  const out: GitDiffPatchLine[] = []
  for (const hunk of hunks) {
    let oldLine = hunk.oldStart
    let newLine = hunk.newStart
    for (const line of hunk.lines) {
      if (line.startsWith('\\')) continue
      const text = line.slice(1)
      if (line.startsWith('+')) {
        out.push({ type: 'added', oldLine: null, newLine, text })
        newLine += 1
      } else if (line.startsWith('-')) {
        out.push({ type: 'removed', oldLine, newLine: null, text })
        oldLine += 1
      } else {
        out.push({ type: 'unchanged', oldLine, newLine, text })
        oldLine += 1
        newLine += 1
      }
    }
  }
  return out
}
