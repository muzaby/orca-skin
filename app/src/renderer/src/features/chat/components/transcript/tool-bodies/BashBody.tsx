import { CodeBlock } from '../../markdown/CodeBlock'
import { stringify } from '../../../format'
import type { ToolCall } from '../../../reducer/chatReducer'

// Bash/PowerShell 본문 — 명령과 결과를 하나의 bash 블록으로. 명령 줄은 '$' 프리픽스로 표시.
export function BashBody({ call }: { call: ToolCall }): React.JSX.Element {
  const input = call.input as { command?: unknown } | null
  const command = typeof input?.command === 'string' ? input.command : stringify(call.input)
  const output = call.result?.output
  const outText = output == null ? '' : typeof output === 'string' ? output : stringify(output)

  const hasOutput = call.result != null && outText.trim() !== ''
  const code = `$ ${command}` + (hasOutput ? `\n${outText}` : '')
  return <CodeBlock code={code} lang="bash" />
}
