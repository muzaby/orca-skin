import { stringify } from '../../../format'
import type { ToolCall } from '../../../reducer/chatReducer'

// Bash/PowerShell 본문 — 명령과 출력을 분리 렌더(Claude Code 양식). 명령 앞 '$' 는
// select-none 으로 선택/복사에서 제외. 복사는 ToolCard 헤더 버튼이 담당.
export function BashBody({ call }: { call: ToolCall }): React.JSX.Element {
  const input = call.input as { command?: unknown } | null
  const command = typeof input?.command === 'string' ? input.command : stringify(call.input)
  const output = call.result?.output
  const outText = output == null ? '' : typeof output === 'string' ? output : stringify(output)
  const hasOutput = call.result != null && outText.trim() !== ''

  return (
    <div className="font-mono text-code">
      <div className="flex">
        <span className="shrink-0 select-none pr-g2 text-t6">$</span>
        <span className="min-w-0 whitespace-pre-wrap break-words text-t9">{command}</span>
      </div>
      {hasOutput && <div className="mt-g2 whitespace-pre-wrap break-words text-t6">{outText}</div>}
    </div>
  )
}
