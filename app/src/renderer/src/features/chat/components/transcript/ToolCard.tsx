import { useState } from 'react'
import { Dot } from '../../../../shared/ui/Status'
import { Markdown } from '../markdown/Markdown'
import { stringify } from '../../format'
import type { ToolCall } from '../../reducer/chatReducer'

export function ToolCard({ call }: { call: ToolCall }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const done = call.result != null
  const isError = call.result?.isError === true
  const tone: 'green' | 'amber' | 'slate' = isError ? 'slate' : done ? 'green' : 'amber'
  const label = isError ? '실패' : done ? '완료' : '실행 중…'
  const args = stringify(call.input).replace(/\n/g, ' ')
  const duration =
    call.result?.durationMs != null ? ` · ${(call.result.durationMs / 1000).toFixed(1)}s` : ''
  return (
    <div
      className={`rounded-[10px] border ${
        isError ? 'border-rust bg-rust-soft' : 'border-border bg-panel'
      } overflow-hidden font-mono text-[12.5px] text-ink`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span aria-hidden className="w-3 text-[10px] text-ink3">
          {open ? '▼' : '▶'}
        </span>
        <Dot tone={tone} />
        <span className="font-semibold text-rust">{call.name}</span>
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-ink3">
          ({args})
        </span>
        <span className="font-sans text-[11px] text-ink3">
          {label}
          {duration}
        </span>
      </button>
      {open && (
        <div className="border-t border-border bg-bg/50 px-3 py-2 text-[12px]">
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
