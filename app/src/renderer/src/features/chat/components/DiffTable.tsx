import { useDiffSyntax } from '../hooks/useDiffSyntax'
import type { DiffLine } from '../lib/diffLines'
import { syntaxText } from './diffSyntaxText'

// diff 줄 묶음의 렌더 — **props 만 읽는다**(0206 D-019). 줄 파생은 `lib/diffLines`(입력 쌍)와
// `lib/diffPatchLines`(구조화 패치)가 소유하고 여기는 그 결과를 그리기만 한다.
//
// 3열이 계약이다: 줄번호(3em) · `+`/`-` 거터(1.4em) · 본문. 앞 둘은 `select-none` 이라
// 사용자가 diff 를 복사하면 본문만 딸려 온다.
//
// `filePath` 를 주면 변경사항 패널과 같은 경로로 문법 색을 얹는다(0228 D-011). 확장자가
// 미지원이거나 하이라이터가 아직 없으면 토큰 맵이 비어 원문 그대로 그린다 — 훅 순서가
// 분기하지 않도록 호출 자체는 무조건 한다.
export function DiffTable({
  lines,
  filePath
}: {
  lines: readonly DiffLine[]
  filePath?: string
}): React.JSX.Element {
  const tokens = useDiffSyntax(lines, filePath ?? '')

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
                  {syntaxText(line, tokens.get(line)?.[isRemoved ? 'old' : 'new'])}
                </pre>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
