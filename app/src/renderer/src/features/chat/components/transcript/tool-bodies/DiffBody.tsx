import { diffLines, type DiffRow } from '../../../lib/diff'
import { stringify } from '../../../format'
import type { ToolCall } from '../../../reducer/chatReducer'

// 하나의 diff 행 — git-diff 스타일(좌측 라인넘버 거터 + +/- 마커 + 배경).
function Row({ row }: { row: DiffRow }): React.JSX.Element {
  const marker = row.type === 'add' ? '+' : row.type === 'del' ? '-' : ' '
  const bg = row.type === 'add' ? 'bg-good/10' : row.type === 'del' ? 'bg-bad/10' : ''
  const markerTone = row.type === 'add' ? 'text-good' : row.type === 'del' ? 'text-bad' : 'text-t6'
  return (
    <div className={`flex ${bg}`}>
      <span className="w-10 shrink-0 select-none px-1 text-right text-t6 tabular-nums">
        {row.oldNo ?? ''}
      </span>
      <span className="w-10 shrink-0 select-none px-1 text-right text-t6 tabular-nums">
        {row.newNo ?? ''}
      </span>
      <span className={`w-4 shrink-0 select-none text-center ${markerTone}`}>{marker}</span>
      <span className="whitespace-pre-wrap break-words text-t9">{row.text || ' '}</span>
    </div>
  )
}

// Write/Edit/MultiEdit input 에서 diff 행 묶음(들)을 산출. MultiEdit 은 edit 별로 분리.
function buildHunks(call: ToolCall): DiffRow[][] {
  const rec = call.input as Record<string, unknown> | null
  if (!rec || typeof rec !== 'object') return []
  if (call.name === 'Write') {
    const content = typeof rec.content === 'string' ? rec.content : ''
    return [diffLines('', content).rows]
  }
  if (call.name === 'Edit') {
    const oldStr = typeof rec.old_string === 'string' ? rec.old_string : ''
    const newStr = typeof rec.new_string === 'string' ? rec.new_string : ''
    return [diffLines(oldStr, newStr).rows]
  }
  if (call.name === 'MultiEdit' && Array.isArray(rec.edits)) {
    return rec.edits.map((e) => {
      const er = (e ?? {}) as Record<string, unknown>
      const oldStr = typeof er.old_string === 'string' ? er.old_string : ''
      const newStr = typeof er.new_string === 'string' ? er.new_string : ''
      return diffLines(oldStr, newStr).rows
    })
  }
  return []
}

// Write/Edit/MultiEdit 본문 — 파일 경로 + git-diff. 라인넘버는 거터에 베스트에포트(1부터).
export function DiffBody({ call }: { call: ToolCall }): React.JSX.Element {
  const rec = call.input as { file_path?: unknown } | null
  const filePath = typeof rec?.file_path === 'string' ? rec.file_path : null
  const hunks = buildHunks(call)

  return (
    <div className="flex flex-col gap-2">
      {filePath && <div className="text-caption text-t6">{filePath}</div>}
      {hunks.length === 0 ? (
        <pre className="m-0 overflow-auto whitespace-pre-wrap break-words text-code text-t9">
          {stringify(call.input)}
        </pre>
      ) : (
        hunks.map((rows, hi) => (
          <div key={hi} className="overflow-hidden rounded-r4 border border-t5 font-mono text-code">
            {rows.map((row, ri) => (
              <Row key={ri} row={row} />
            ))}
          </div>
        ))
      )}
    </div>
  )
}
