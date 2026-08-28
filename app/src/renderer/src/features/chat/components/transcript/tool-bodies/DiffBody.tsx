import { useMemo } from 'react'
import { stringify } from '../../../format'
import { DiffTable } from '../../DiffTable'
import type { DiffPair } from '../../../lib/diffLines'
import type { ToolCall } from '../../../reducer/chatReducer'

// 도구 입력(Write/Edit/MultiEdit)을 diff 쌍으로 접는 곳. **줄 파생과 줄 렌더는 갖지 않는다** —
// diff 타일과 같은 표를 그려야 하므로 `lib/diffLines`·`components/DiffTable` 이 소유한다
// (0206 D-019). 여기 남는 것은 *도구 입력을 어떻게 쌍으로 읽는가* 뿐이다.

function buildPairs(call: ToolCall): DiffPair[] {
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

export function DiffBody({ call }: { call: ToolCall }): React.JSX.Element {
  const pairs = useMemo(() => buildPairs(call), [call])

  return (
    <div className="flex flex-col gap-2">
      {pairs.length === 0 ? (
        <pre className="m-0 overflow-auto whitespace-pre-wrap break-words text-code text-t9">
          {stringify(call.input)}
        </pre>
      ) : (
        pairs.map((p, i) => (
          <div key={i} className="overflow-auto rounded-r4 border border-t5">
            <DiffTable oldValue={p.oldValue} newValue={p.newValue} />
          </div>
        ))
      )}
    </div>
  )
}
