import {
  DIFF_MODEL_SYNC_MAX_LINES,
  DIFF_MODEL_SYNC_MAX_CHARS
} from '../../../../../../shared/compute/limits'
import { useMemo } from 'react'
import { stringify } from '../../../../format'
import { DiffTable, PairDiffTable, StructuredDiffTable } from '../../../common/transcript/DiffTable'
import { diffLinesWithinCap } from '../../../../../../shared/compute/inline'
import type { DiffLine } from '../../../../lib/diffLines'
import { patchLinesToDiffLines } from '../../../../lib/diffPatchLines'
import {
  fileEditPatchLines,
  readFileEditStructuredPatch
} from '../../../../../../../../shared/file-edit-tool'
import type { ToolCall } from '../../../../reducer/chatReducer'

// 편집 도구(Write/Edit/MultiEdit)의 본문. **줄 파생과 줄 렌더는 갖지 않는다** — diff 타일과 같은
// 표를 그려야 하므로 `lib/diffLines`·`lib/diffPatchLines`·`components/DiffTable` 이 소유한다
// (0206 D-019 · 0211 ΔV4). 여기 남는 것은 *어느 입력으로 줄을 만들 것인가* 뿐이다.
//
// 우선순위는 **결과의 구조화 패치 → 실행 전 미리보기 → 도구 입력 쌍** 이다(0228 D-006 · 0229
// E-009). 앞의 둘은 실제 파일 좌표를 갖고 있어 `46 -` 처럼 그릴 수 있고, 입력 쌍은 조각이라
// 1번 줄부터 셀 수밖에 없다. 결과가 오면 예측을 사실로 교체한다 — 진행 중에만 미리보기가 선다.
// 셋 다 없는 경우(`Write`·`MultiEdit`·구버전·오류 결과)는 입력 쌍 폴백이다(D-009·D-010).

// 줄 묶음 하나의 원천 — 구조화 패치는 이미 줄이고, 입력 쌍은 줄 계산이 필요하다. 쌍의 계산은
// `useDiffLines` 가 상한에 따라 UI 스레드 또는 계산 워커에서 한다(0324 D-014).
type DiffBlock =
  | { raw: ReturnType<typeof fileEditPatchLines> }
  | { lines: DiffLine[] }
  | { oldValue: string; newValue: string }

function buildPairBlocks(call: ToolCall): DiffBlock[] {
  const rec = call.input as Record<string, unknown> | null
  if (!rec || typeof rec !== 'object') return []
  if (call.name === 'Write') {
    const content = typeof rec.content === 'string' ? rec.content : ''
    return [{ oldValue: '', newValue: content }]
  }
  if (call.name === 'Edit') {
    const oldValue = typeof rec.old_string === 'string' ? rec.old_string : ''
    const newValue = typeof rec.new_string === 'string' ? rec.new_string : ''
    return [{ oldValue, newValue }]
  }
  if (call.name === 'MultiEdit' && Array.isArray(rec.edits)) {
    return rec.edits.map((e) => {
      const er = (e ?? {}) as Record<string, unknown>
      return {
        oldValue: typeof er.old_string === 'string' ? er.old_string : '',
        newValue: typeof er.new_string === 'string' ? er.new_string : ''
      }
    })
  }
  return []
}

export function buildBlocks(call: ToolCall): DiffBlock[] {
  const hunks =
    readFileEditStructuredPatch(call.result?.structuredOutput) ??
    readFileEditStructuredPatch(call.editPreview)
  if (hunks) {
    const raw = fileEditPatchLines(hunks)
    let chars = 0
    if (
      raw.length > DIFF_MODEL_SYNC_MAX_LINES ||
      raw.some((line) => (chars += line.text.length) > DIFF_MODEL_SYNC_MAX_CHARS)
    )
      return [{ raw }]
    return [{ lines: patchLinesToDiffLines(raw) }]
  }
  return buildPairBlocks(call)
}

function RawInput({ call }: { call: ToolCall }): React.JSX.Element {
  return (
    <pre className="m-0 overflow-auto whitespace-pre-wrap break-words text-code text-t9">
      {stringify(call.input)}
    </pre>
  )
}

// 입력 쌍 한 묶음 — 계산 중에는 로딩 표시, 워커 실패에는 도구 입력 원문을 보인다.
function PairBlock({
  call,
  oldValue,
  newValue,
  filePath
}: {
  call: ToolCall
  oldValue: string
  newValue: string
  filePath?: string
}): React.JSX.Element {
  const lines = useMemo(() => diffLinesWithinCap(oldValue, newValue), [oldValue, newValue])
  return (
    <div className="overflow-auto rounded-r4 border border-t5">
      {lines ? (
        <DiffTable lines={lines} filePath={filePath} />
      ) : (
        <PairDiffTable
          before={oldValue}
          after={newValue}
          filePath={filePath}
          fallback={<RawInput call={call} />}
        />
      )}
    </div>
  )
}

export function DiffBody({ call }: { call: ToolCall }): React.JSX.Element {
  const blocks = useMemo(() => buildBlocks(call), [call])
  const rec = call.input as { file_path?: unknown } | null
  const filePath = typeof rec?.file_path === 'string' ? rec.file_path : undefined

  return (
    <div className="flex flex-col gap-2">
      {blocks.length === 0 ? (
        <RawInput call={call} />
      ) : (
        blocks.map((block, i) =>
          'raw' in block ? (
            <StructuredDiffTable
              key={i}
              lines={block.raw}
              filePath={filePath}
              fallback={<RawInput call={call} />}
            />
          ) : 'lines' in block ? (
            <div key={i} className="overflow-auto rounded-r4 border border-t5">
              <DiffTable lines={block.lines} filePath={filePath} />
            </div>
          ) : (
            <PairBlock
              key={i}
              call={call}
              oldValue={block.oldValue}
              newValue={block.newValue}
              filePath={filePath}
            />
          )
        )
      )}
    </div>
  )
}
