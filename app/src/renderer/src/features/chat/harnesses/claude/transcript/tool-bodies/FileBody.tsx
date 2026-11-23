import { useMemo } from 'react'
import { VirtualCodeView } from '../../../../components/code/VirtualCodeView'
import { countLinesUpTo } from '../../../../../../shared/compute/diffModel'
import { VIRTUAL_BODY_MIN_LINES } from '../../../../../../shared/ui/virtual/limits'
import { extToLang, stripLineNumberGutter } from '../../../../lib/lang'
import { stringify } from '../../../../format'
import { CodeBlock } from '../../../../../../shared/ui/markdown/CodeBlock'
import type { ToolCall } from '../../../../reducer/chatReducer'

function resultOutput(o: unknown): string {
  return o == null ? '' : typeof o === 'string' ? o : stringify(o)
}

// Read 본문 — result.output 을 cat -n 거터 제거 후 언어 헤더 없는 코드블록으로(라인넘버).
export function FileBody({ call }: { call: ToolCall }): React.JSX.Element {
  const rec = call.input as { file_path?: unknown } | null
  const filePath = typeof rec?.file_path === 'string' ? rec.file_path : null
  const lang = filePath ? extToLang(filePath) : undefined
  const raw = call.result?.output
  const output = useMemo(() => resultOutput(raw), [raw])
  const large = useMemo(
    () => countLinesUpTo(output, VIRTUAL_BODY_MIN_LINES) > VIRTUAL_BODY_MIN_LINES,
    [output]
  )
  const small = useMemo(() => (large ? '' : stripLineNumberGutter(output)), [large, output])
  if (call.result && output.trim() !== '') {
    if (large)
      return (
        <VirtualCodeView
          documentId={call.toolUseId + ':read'}
          revisionSource={call.result}
          code={output}
          stripGutter
          lang={lang}
          showLineNumbers
        />
      )
    return <CodeBlock code={small} lang={lang} showLineNumbers showHeader={false} embedded />
  }
  return (
    <pre className="m-0 overflow-auto whitespace-pre-wrap break-words text-code text-t9">
      {stringify(call.input)}
    </pre>
  )
}
