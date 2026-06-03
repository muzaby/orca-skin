import { useState } from 'react'
import { VERB_LABEL, toolDescription, toolDiffStat, toolVerbCategory } from '../../lib/toolMeta'
import { BashBody } from './tool-bodies/BashBody'
import { DiffBody } from './tool-bodies/DiffBody'
import { KeyValueBody } from './tool-bodies/KeyValueBody'
import { AskBody } from './tool-bodies/AskBody'
import type { ToolCall } from '../../reducer/chatReducer'

// 도구별 본문 디스패치. 미지 도구는 KeyValueBody 로 폴백(타 SDK 도 합리적 렌더).
function ToolBody({ call }: { call: ToolCall }): React.JSX.Element {
  switch (call.name) {
    case 'Bash':
    case 'PowerShell':
      return <BashBody call={call} />
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
      return <DiffBody call={call} />
    case 'AskUserQuestion':
      return <AskBody call={call} />
    default:
      return <KeyValueBody call={call} />
  }
}

export function ToolCard({ call }: { call: ToolCall }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const done = call.result != null
  const isError = call.result?.isError === true
  const verb = VERB_LABEL[toolVerbCategory(call.name)]
  const description = toolDescription(call)
  const stat = toolDiffStat(call)
  const statusLabel = isError ? '실패' : done ? '완료' : '실행 중…'
  const duration =
    call.result?.durationMs != null ? ` · ${(call.result.durationMs / 1000).toFixed(1)}s` : ''
  return (
    <div className="overflow-hidden rounded-[10px] border border-border bg-panel text-[12.5px] text-ink">
      {/* 헤더: [동사] [친화적 서술] (+N-M) — 도구 이름·raw·상태는 본문으로 (Claude Code 양식) */}
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
        {stat && (stat.added > 0 || stat.removed > 0) && (
          <span className="shrink-0 font-mono text-[11px]">
            {stat.added > 0 && <span className="text-good">+{stat.added}</span>}
            {stat.removed > 0 && <span className="ml-1 text-bad">-{stat.removed}</span>}
          </span>
        )}
      </button>
      {open && (
        <div className="border-t border-border bg-bg/50 px-3 py-2 font-mono text-[12px]">
          <div className="mb-2 flex items-center gap-2 font-sans text-[11px] text-ink3">
            <span className={`font-semibold ${isError ? 'text-rust' : 'text-ink2'}`}>
              {call.name}
            </span>
            <span>
              {statusLabel}
              {duration}
            </span>
          </div>
          <ToolBody call={call} />
        </div>
      )}
    </div>
  )
}
