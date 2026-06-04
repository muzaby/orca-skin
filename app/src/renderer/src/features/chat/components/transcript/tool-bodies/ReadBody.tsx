import { CodeBlock } from '../../markdown/CodeBlock'
import { stringify } from '../../../format'
import { extToLang, stripLineNumberGutter } from '../../../lib/lang'
import type { ToolCall } from '../../../reducer/chatReducer'

// Read 본문 — 파일 내용을 확장자별 코드블록 + 라인넘버로(pretty). 결과 없으면 input 표기.
export function ReadBody({ call }: { call: ToolCall }): React.JSX.Element {
  const rec = call.input as { file_path?: unknown } | null
  const filePath = typeof rec?.file_path === 'string' ? rec.file_path : null
  const lang = filePath ? extToLang(filePath) : undefined

  const output = call.result?.output
  const content = typeof output === 'string' ? output : output == null ? '' : stringify(output)

  return (
    <div className="flex flex-col gap-2">
      {filePath && <div className="text-caption text-t6">{filePath}</div>}
      {call.result && content.trim() !== '' ? (
        <CodeBlock code={stripLineNumberGutter(content)} lang={lang} showLineNumbers embedded />
      ) : (
        <pre className="m-0 overflow-auto whitespace-pre-wrap break-words text-code text-t9">
          {stringify(call.input)}
        </pre>
      )}
    </div>
  )
}
