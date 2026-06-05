import { diffLines } from 'diff'
import { stringify } from '../../../format'
import type { ToolCall } from '../../../reducer/chatReducer'

interface DiffPair {
  oldValue: string
  newValue: string
}

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

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  lineNo: number
  text: string
}

function buildDiffLines(oldValue: string, newValue: string): DiffLine[] {
  const hunks = diffLines(oldValue, newValue)
  const result: DiffLine[] = []
  let oldLine = 1
  let newLine = 1

  for (const hunk of hunks) {
    const lines = hunk.value.split('\n')
    // diffLines includes trailing empty string when value ends with \n
    if (lines[lines.length - 1] === '') lines.pop()

    if (hunk.removed) {
      for (const text of lines) {
        result.push({ type: 'removed', lineNo: oldLine++, text })
      }
    } else if (hunk.added) {
      for (const text of lines) {
        result.push({ type: 'added', lineNo: newLine++, text })
      }
    } else {
      for (const text of lines) {
        result.push({ type: 'unchanged', lineNo: newLine, text })
        oldLine++
        newLine++
      }
    }
  }

  return result
}

function DiffTable({ oldValue, newValue }: DiffPair): React.JSX.Element {
  const lines = buildDiffLines(oldValue, newValue)

  return (
    <table
      className="w-full border-collapse font-mono"
      style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
    >
      <colgroup>
        <col style={{ width: '3em' }} />
        <col style={{ width: '1.4em' }} />
        <col />
      </colgroup>
      <tbody>
        {lines.map((line, i) => {
          const isAdded = line.type === 'added'
          const isRemoved = line.type === 'removed'
          const rowBg = isAdded
            ? 'bg-[color-mix(in_srgb,var(--color-good)_14%,transparent)]'
            : isRemoved
              ? 'bg-[color-mix(in_srgb,var(--color-bad)_14%,transparent)]'
              : ''
          const gutterBg = isAdded
            ? 'bg-[color-mix(in_srgb,var(--color-good)_18%,transparent)]'
            : isRemoved
              ? 'bg-[color-mix(in_srgb,var(--color-bad)_18%,transparent)]'
              : 'bg-transparent'
          return (
            <tr key={i} className={rowBg}>
              <td
                className={`select-none whitespace-nowrap px-2 text-right align-baseline tabular-nums ${gutterBg}`}
              >
                <pre className="m-0 text-code text-t6 opacity-60">{line.lineNo}</pre>
              </td>
              <td className={`select-none px-1 text-center align-baseline ${gutterBg}`}>
                <pre className="m-0 text-code text-t6">{isAdded ? '+' : isRemoved ? '-' : ' '}</pre>
              </td>
              <td className="px-2 align-baseline">
                <pre className="m-0 whitespace-pre-wrap break-all text-code text-t9">
                  {line.text}
                </pre>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function DiffBody({ call }: { call: ToolCall }): React.JSX.Element {
  const pairs = buildPairs(call)

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
