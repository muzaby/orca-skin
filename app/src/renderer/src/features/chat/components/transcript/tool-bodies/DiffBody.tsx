import { useMemo } from 'react'
import { stringify } from '../../../format'
import { DiffTable } from '../../DiffTable'
import { buildDiffLines, type DiffLine } from '../../../lib/diffLines'
import { patchLinesToDiffLines } from '../../../lib/diffPatchLines'
import {
  fileEditPatchLines,
  readFileEditStructuredPatch
} from '../../../../../../../shared/file-edit-tool'
import type { ToolCall } from '../../../reducer/chatReducer'

// 편집 도구(Write/Edit/MultiEdit)의 본문. **줄 파생과 줄 렌더는 갖지 않는다** — diff 타일과 같은
// 표를 그려야 하므로 `lib/diffLines`·`lib/diffPatchLines`·`components/DiffTable` 이 소유한다
// (0206 D-019 · 0211 ΔV4). 여기 남는 것은 *어느 입력으로 줄을 만들 것인가* 뿐이다.
//
// 우선순위는 **결과의 구조화 패치 → 도구 입력 쌍** 이다(0228 D-006). 패치는 실제 파일 좌표를
// 갖고 있어 `46 -` 처럼 그릴 수 있고, 입력 쌍은 조각이라 1번 줄부터 셀 수밖에 없다. 패치가
// 없는 경우(`Write`·`MultiEdit`·구버전·오류 결과)는 폴백이다(D-009·D-010).

function buildPairLines(call: ToolCall): DiffLine[][] {
  const rec = call.input as Record<string, unknown> | null
  if (!rec || typeof rec !== 'object') return []
  if (call.name === 'Write') {
    const content = typeof rec.content === 'string' ? rec.content : ''
    return [buildDiffLines('', content)]
  }
  if (call.name === 'Edit') {
    const oldValue = typeof rec.old_string === 'string' ? rec.old_string : ''
    const newValue = typeof rec.new_string === 'string' ? rec.new_string : ''
    return [buildDiffLines(oldValue, newValue)]
  }
  if (call.name === 'MultiEdit' && Array.isArray(rec.edits)) {
    return rec.edits.map((e) => {
      const er = (e ?? {}) as Record<string, unknown>
      return buildDiffLines(
        typeof er.old_string === 'string' ? er.old_string : '',
        typeof er.new_string === 'string' ? er.new_string : ''
      )
    })
  }
  return []
}

function buildBlocks(call: ToolCall): DiffLine[][] {
  const hunks = readFileEditStructuredPatch(call.result?.structuredOutput)
  if (hunks) return [patchLinesToDiffLines(fileEditPatchLines(hunks))]
  return buildPairLines(call)
}

export function DiffBody({ call }: { call: ToolCall }): React.JSX.Element {
  const blocks = useMemo(() => buildBlocks(call), [call])
  const rec = call.input as { file_path?: unknown } | null
  const filePath = typeof rec?.file_path === 'string' ? rec.file_path : undefined

  return (
    <div className="flex flex-col gap-2">
      {blocks.length === 0 ? (
        <pre className="m-0 overflow-auto whitespace-pre-wrap break-words text-code text-t9">
          {stringify(call.input)}
        </pre>
      ) : (
        blocks.map((lines, i) => (
          <div key={i} className="overflow-auto rounded-r4 border border-t5">
            <DiffTable lines={lines} filePath={filePath} />
          </div>
        ))
      )}
    </div>
  )
}
