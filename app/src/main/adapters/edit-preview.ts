// `Edit` 실행 **전** 미리보기 패치 — 진행 중(`수정 중`) 카드가 완료 카드와 같은 줄번호·전체 줄을
// 그리게 하는 값이다(0229 E-001).
//
// 왜 만들어야 하는가: SDK 는 실행 전 diff 를 주지 않는다(`CanUseTool` options 에 patch/diff 필드가
// 없다). 결과가 오기 전까지 파일 위치를 아는 값은 **편집 전 파일 본문**뿐이고 그것을 읽을 수 있는
// 곳은 main 이다 — 렌더러에는 임의 파일 read IPC 가 없다(0229 E-002).
//
// 왜 `diff.structuredPatch` 인가: SDK `FileEditOutput.structuredPatch` 의 필드 형상이 jsdiff 반환
// 형상 그대로라, 같은 함수를 쓰면 문맥 폭(기본 4줄)까지 일치해 완료 시 카드가 튀지 않는다(E-003).
//
// **판정은 순수하고 읽기는 포트다** — `buildEditPreview` 는 reader 를 주입받고, 실제 fs reader 는
// 같은 파일의 별도 export 다. `claude.ts` 는 electron 을 타 테스트가 import 할 수 없으므로
// 저쪽에는 배선만 두고 판정·상한은 여기서 단위 테스트한다.

import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { structuredPatch } from 'diff'
import type { FileEditPatchHunk } from '../../shared/file-edit-tool'
import { guardToolAccess, type GuardRoots } from './workspace-guard'

/** 해석된 절대 경로를 본문으로 읽는다. 부재·상한 초과·읽기 실패는 전부 `null` 이다(E-010). */
export type EditPreviewReader = (absolutePath: string) => string | null

interface EditInput {
  filePath: string
  oldString: string
  newString: string
  replaceAll: boolean
}

function readEditInput(input: unknown): EditInput | null {
  if (typeof input !== 'object' || input === null) return null
  const rec = input as Record<string, unknown>
  const { file_path: filePath, old_string: oldString, new_string: newString } = rec
  if (typeof filePath !== 'string' || filePath === '') return null
  if (typeof oldString !== 'string' || oldString === '') return null
  if (typeof newString !== 'string') return null
  return { filePath, oldString, newString, replaceAll: rec.replace_all === true }
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0
  let from = 0
  for (;;) {
    const at = haystack.indexOf(needle, from)
    if (at < 0) return count
    count += 1
    from = at + needle.length
  }
}

// `Edit` 하나의 미리보기 hunk. 어느 단계에서든 확신이 없으면 `null` 을 돌려준다 — 거짓 좌표보다
// 폴백(도구 입력 쌍 렌더)이 낫다는 것이 0228 EP-05 와 같은 판단이다.
//
// 순서가 계약이다: **가드가 거부하면 reader 를 부르지 않는다**(0229 §10 EP-Δ1). 결과값만 보면
// 읽고 나서 버린 경우와 구분되지 않으므로 호출 자체가 일어나지 않아야 한다.
export function buildEditPreview(
  toolName: string,
  input: unknown,
  roots: GuardRoots,
  read: EditPreviewReader
): FileEditPatchHunk[] | null {
  if (toolName !== 'Edit') return null
  const edit = readEditInput(input)
  if (!edit) return null
  // 편집 자신의 write 판정을 그대로 쓴다 — 이 편집이 쓸 수 없는 파일은 미리보기로도 읽지 않는다.
  if (guardToolAccess('Edit', input as Record<string, unknown>, roots) !== null) return null

  const before = read(path.resolve(roots.ws, edit.filePath))
  if (before === null) return null

  const hits = countOccurrences(before, edit.oldString)
  // `replace_all` 이 아니면 자리가 하나로 특정돼야 한다(E-007). 0회면 편집 자체가 실패한다.
  if (hits === 0 || (hits > 1 && !edit.replaceAll)) return null

  const after = edit.replaceAll
    ? before.split(edit.oldString).join(edit.newString)
    : before.replace(edit.oldString, () => edit.newString)
  if (after === before) return null

  const hunks = structuredPatch(edit.filePath, edit.filePath, before, after).hunks
  return hunks.length > 0 ? hunks : null
}

/** 미리보기 대상 파일의 크기 상한. 턴 이벤트 루프에서 동기로 읽으므로 상한이 없으면 큰 파일
 *  하나가 스트림을 멈춘다(0229 E-006). 상한을 넘으면 본문을 읽지 않고 미리보기를 포기한다. */
export const EDIT_PREVIEW_MAX_BYTES = 1024 * 1024

// 실제 reader. **크기 확인이 먼저다** — `statSync` 로 자른 뒤에만 본문을 읽는다(§10 EP-Δ2).
// 부재·권한·디코딩 실패는 전부 `null` 로 삼킨다: 미리보기는 표시 보조라 턴을 막지 않는다(E-010).
export function nodeEditPreviewReader(maxBytes = EDIT_PREVIEW_MAX_BYTES): EditPreviewReader {
  return (absolutePath) => {
    try {
      if (statSync(absolutePath).size > maxBytes) return null
      return readFileSync(absolutePath, 'utf8')
    } catch {
      return null
    }
  }
}
