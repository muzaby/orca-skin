import { useState } from 'react'
import { Markdown } from '../markdown/Markdown'
import { stringify } from '../../format'
import { VERB_LABEL, toolDescription, toolVerbCategory } from '../../lib/toolMeta'
import type { ToolCall } from '../../reducer/chatReducer'

export function ToolCard({ call }: { call: ToolCall }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const done = call.result != null
  const isError = call.result?.isError === true
  const verb = VERB_LABEL[toolVerbCategory(call.name)]
  const description = toolDescription(call)
  const statusLabel = isError ? '실패' : done ? '완료' : '실행 중…'
  const duration =
    call.result?.durationMs != null ? ` · ${(call.result.durationMs / 1000).toFixed(1)}s` : ''
  return (
    <div className="overflow-hidden rounded-[10px] border border-border bg-panel text-[12.5px] text-ink">
      {/* 헤더: [동사] [친화적 서술] — 도구 이름·raw JSON·상태는 본문으로 (Claude Code 양식) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-3 py-2 text-left font-sans"
        aria-expanded={open}
      >
        <span aria-hidden className="w-3 text-[10px] text-ink3">
          {open ? '▼' : '▶'}
        </span>
        <span className={`font-medium ${isError ? 'text-rust' : 'text-ink2'}`}>{verb}</span>
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-ink3">
          {description}
        </span>
      </button>
      {open && (
        <div className="border-t border-border bg-bg/50 px-3 py-2 font-mono text-[12px]">
          <div className="mb-2 flex items-center gap-2 font-sans text-[11px] text-ink3">
            <span className="font-semibold text-rust">{call.name}</span>
            <span>
              {statusLabel}
              {duration}
            </span>
          </div>
          <div className="mb-1 font-sans text-[10.5px] uppercase tracking-wide text-ink3">
            input
          </div>
          <pre className="m-0 mb-2 overflow-auto whitespace-pre-wrap break-words text-ink">
            {stringify(call.input)}
          </pre>
          {call.result && (
            <>
              <div className="mb-1 font-sans text-[10.5px] uppercase tracking-wide text-ink3">
                output
              </div>
              {typeof call.result.output === 'string' ? (
                <Markdown source={call.result.output} />
              ) : (
                <pre className="m-0 overflow-auto whitespace-pre-wrap break-words text-ink">
                  {stringify(call.result.output)}
                </pre>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
