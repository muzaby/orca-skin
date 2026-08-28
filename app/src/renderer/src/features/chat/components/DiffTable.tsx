import { useMemo } from 'react'
import { buildDiffLines, type DiffPair } from '../lib/diffLines'

// diff 한 쌍의 줄 렌더 — **props 만 읽는다**(0206 D-019). 도구 카드(`DiffBody`)와 diff 타일이
// 같은 표를 쓰므로 거터 문자·줄번호 자리·행 틴트가 한 곳에서 정해진다.
//
// 3열이 계약이다: 줄번호(3em) · `+`/`-` 거터(1.4em) · 본문. 앞 둘은 `select-none` 이라
// 사용자가 diff 를 복사하면 본문만 딸려 온다.
export function DiffTable({ oldValue, newValue }: DiffPair): React.JSX.Element {
  // diffLines 는 O(n·m) — 부모가 재렌더돼도 같은 입력이면 재계산하지 않는다(0108).
  const lines = useMemo(() => buildDiffLines(oldValue, newValue), [oldValue, newValue])

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
