import { extToLang, stripLineNumberGutter } from '../../../lib/lang'
import { stringify } from '../../../format'
import { CodeBlock } from '../../../../../shared/ui/markdown/CodeBlock'
import type { ToolCall } from '../../../reducer/chatReducer'

function resultOutput(call: ToolCall): string {
  const o = call.result?.output
  return o == null ? '' : typeof o === 'string' ? o : stringify(o)
}

// Read 본문 — result.output 을 cat -n 거터 제거 후 언어 헤더 없는 코드블록으로(라인넘버).
export function FileBody({ call }: { call: ToolCall }): React.JSX.Element {
  const rec = call.input as { file_path?: unknown } | null
  const filePath = typeof rec?.file_path === 'string' ? rec.file_path : null
  const lang = filePath ? extToLang(filePath) : undefined
  const output = resultOutput(call)
  if (call.result && output.trim() !== '') {
    return (
      <CodeBlock
        code={stripLineNumberGutter(output)}
        lang={lang}
        showLineNumbers
        showHeader={false}
        embedded
      />
    )
  }
  return (
    <pre className="m-0 overflow-auto whitespace-pre-wrap break-words text-code text-t9">
      {stringify(call.input)}
    </pre>
  )
}
