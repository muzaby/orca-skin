import { CodeBlock } from '../../../../shared/ui/markdown/CodeBlock'
import { useI18n } from '../../../../shared/i18n'
import { stringify } from '../../format'

interface StructuredOutputCardProps {
  // structured_output 파트의 value(JSON Schema 결과). 형식은 unknown.
  value: unknown
}

// 구조화 출력(provider-runtime.md §7 structured_output) 카드 — value 를 pretty-JSON 으로.
// claude 는 `outputFormat:json_schema` 미와이어라 현재 소스가 없는 seam 이지만, parts 모델이
// 이 종류를 싣게 되면 그대로 렌더한다(rendering.md §1.7 의 valid 뷰 최소 구현).
export function StructuredOutputCard({ value }: StructuredOutputCardProps): React.JSX.Element {
  const { tr } = useI18n()
  const code = typeof value === 'string' ? value : stringify(value)
  return (
    <div className="flex flex-col gap-1 rounded-r6 border border-border bg-bg2 px-p5 py-p4">
      <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-ink3">
        {tr('chat.transcript.structuredOutput')}
      </span>
      <CodeBlock code={code} lang="json" showHeader={false} embedded />
    </div>
  )
}
