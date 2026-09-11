import { describe, expect, it } from 'vitest'
import { resultMap } from './parts'
import {
  fileEditPatchLines,
  readFileEditStructuredPatch
} from '../../../../../shared/file-edit-tool'
import type { AppMessagePart } from '../../../../../shared/ipc'

// 0228 AC13 — 편집 패치는 DB 에 JSON 으로 영속됐다가 tool_result 파트로 돌아온다. 라이브 경로와
// 재로드 경로가 같은 hunk 를 주지 않으면 카드가 재진입 후 다른 줄번호를 그린다.
describe('편집 패치 영속 왕복', () => {
  const structuredPatch = [
    {
      oldStart: 45,
      oldLines: 2,
      newStart: 45,
      newLines: 2,
      lines: ['   const frame = 0', '-async function animate() {', '+async function animate2() {']
    }
  ]

  it('영속 JSON 을 거친 tool_result 파트가 같은 줄번호를 복원한다', () => {
    // HistoryWriter 가 쓰는 형태 그대로 — 필드 선별 후 JSON 직렬화/역직렬화.
    const persisted = JSON.parse(
      JSON.stringify({
        type: 'tool_result',
        toolRunId: 't1',
        result: 'updated',
        isError: false,
        structuredOutput: { structuredPatch }
      })
    ) as AppMessagePart

    const restored = resultMap([persisted]).get('t1')
    const hunks = readFileEditStructuredPatch(restored?.structuredOutput)

    expect(hunks).toEqual(structuredPatch)
    expect(fileEditPatchLines(hunks ?? []).map((line) => [line.oldLine, line.newLine])).toEqual([
      [45, 45],
      [46, null],
      [null, 46]
    ])
  })
})
