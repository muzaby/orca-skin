import { Button } from '../../../../../shared/ui/Button'
import { chatActions } from '../../../store/chatStore'
import { stringify } from '../../../format'
import type { ToolCall } from '../../../reducer/chatReducer'

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
}

function stringField(rec: Record<string, unknown>, key: string): string | null {
  const value = rec[key]
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

export function AgentTaskBody({ call }: { call: ToolCall }): React.JSX.Element {
  const input = asRecord(call.input)
  const subagentType =
    stringField(input, 'subagent_type') ?? stringField(input, 'agent') ?? 'default'
  const prompt = stringField(input, 'prompt')
  const result = call.result?.output
  return (
    <div className="flex flex-col gap-g3 font-sans text-body text-ink">
      <div className="rounded-r4 border border-t5 bg-bg2 px-3 py-2">
        <div className="text-caption font-semibold text-t7">서브에이전트</div>
        <div className="mt-1 text-footnote text-ink3">유형: {subagentType}</div>
        {prompt && <div className="mt-2 line-clamp-3 text-footnote text-t7">{prompt}</div>}
      </div>
      {result !== undefined && (
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-r4 bg-bg2 p-3 font-mono text-caption text-t8">
          {typeof result === 'string' ? result : stringify(result)}
        </pre>
      )}
      <div>
        <Button size="small" onClick={() => chatActions.openSubagentTask(call.toolUseId)}>
          서브에이전트 패널 열기
        </Button>
      </div>
    </div>
  )
}
