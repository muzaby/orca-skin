import { CopyIconButton } from '../../../../../shared/ui/CopyIconButton'
import { stringify } from '../../../format'
import type { ToolCall } from '../../../reducer/chatReducer'

// Bash/PowerShell 본문 — 명령과 출력을 분리 렌더(Claude Code 양식). 명령 앞 '$' 는
// select-none 으로 선택/복사에서 제외, 복사 버튼은 명령만 복사. 출력은 muted 색으로 구분.
export function BashBody({ call }: { call: ToolCall }): React.JSX.Element {
  const input = call.input as { command?: unknown } | null
  const command = typeof input?.command === 'string' ? input.command : stringify(call.input)
  const output = call.result?.output
  const outText = output == null ? '' : typeof output === 'string' ? output : stringify(output)
  const hasOutput = call.result != null && outText.trim() !== ''

  return (
    <div className="group/bash relative font-mono text-code">
      <div className="absolute right-0 top-0 opacity-0 transition-opacity duration-150 ease-[cubic-bezier(0.215,0.61,0.355,1)] motion-reduce:transition-none group-hover/bash:opacity-100 focus-within:opacity-100">
        <CopyIconButton text={command} title="명령 복사" />
      </div>
      <div className="flex">
        <span className="shrink-0 select-none pr-g2 text-t6">$</span>
        <span className="min-w-0 whitespace-pre-wrap break-words pr-7 text-t9">{command}</span>
      </div>
      {hasOutput && <div className="mt-g2 whitespace-pre-wrap break-words text-t6">{outText}</div>}
    </div>
  )
}
