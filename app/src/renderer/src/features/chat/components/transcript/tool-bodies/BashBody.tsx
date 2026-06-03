import { CodeBlock } from '../../markdown/CodeBlock'
import { stringify } from '../../../format'
import type { ToolCall } from '../../../reducer/chatReducer'

// Bash/PowerShell 본문 — 명령과 결과를 bash 코드블럭으로 (Claude Code 양식).
export function BashBody({ call }: { call: ToolCall }): React.JSX.Element {
  const input = call.input as { command?: unknown } | null
  const command = typeof input?.command === 'string' ? input.command : stringify(call.input)
  const output = call.result?.output
  const outText = output == null ? '' : typeof output === 'string' ? output : stringify(output)
  return (
    <div className="flex flex-col gap-2">
      <CodeBlock code={command} lang="bash" />
      {call.result && outText.trim() !== '' && <CodeBlock code={outText} lang="bash" />}
    </div>
  )
}
