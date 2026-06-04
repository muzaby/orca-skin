import { useState } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import {
  VERB_LABEL,
  VERB_LABEL_ACTIVE,
  toolDescription,
  toolDiffStat,
  toolVerbCategory
} from '../../lib/toolMeta'
import { BashBody } from './tool-bodies/BashBody'
import { DiffBody } from './tool-bodies/DiffBody'
import { ReadBody } from './tool-bodies/ReadBody'
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
    case 'Read':
      return <ReadBody call={call} />
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
  const cat = toolVerbCategory(call.name)
  // 진행 중이면 진행 시제(실행 중…), 완료되면 완료 시제(실행됨).
  const verb = done ? VERB_LABEL[cat] : VERB_LABEL_ACTIVE[cat]
  const description = toolDescription(call)
  const stat = toolDiffStat(call)
  const statusLabel = isError ? '실패' : done ? '완료' : '실행 중…'
  const duration =
    call.result?.durationMs != null ? ` · ${(call.result.durationMs / 1000).toFixed(1)}s` : ''
  return (
    <div className="overflow-hidden rounded-r6 border border-t5 bg-t1 text-footnote text-t9">
      {/* 헤더: [동사] [친화적 서술] (+N-M) — 도구 이름·raw·상태는 본문으로 (Claude Code 양식) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group/tool flex w-full cursor-default items-center gap-g4 border-0 bg-transparent px-p6 py-p4 text-left font-sans outline-none hide-focus-ring ring-focus"
        aria-expanded={open}
      >
        <span
          aria-hidden
          className="shrink-0 text-t6 transition-transform"
          style={{ transform: open ? 'rotate(90deg)' : undefined }}
        >
          <Icon name="chevR" size={12} />
        </span>
        <span
          className={`font-medium ${
            isError ? 'text-rust' : done ? 'text-t6 group-hover/tool:text-t7' : 'epitaxy-text-shine'
          }`}
        >
          {verb}
        </span>
        {!done && <span className="sr-only">실행 중</span>}
        {/* 서술 + diff-stat 을 한 묶음으로 — '생성됨 <파일> +99' 처럼 서술 바로 뒤에 붙는다. */}
        <span className="flex min-w-0 flex-1 items-center gap-g3">
          <span className="min-w-0 truncate text-t6">{description}</span>
          {stat && (stat.added > 0 || stat.removed > 0) && (
            <span className="shrink-0 font-mono text-caption tabular-nums">
              {stat.added > 0 && <span className="text-extended-green">+{stat.added}</span>}
              {stat.removed > 0 && <span className="ml-1 text-extended-pink">-{stat.removed}</span>}
            </span>
          )}
        </span>
      </button>
      {open && (
        <div className="border-t border-t5 px-p6 py-p4 font-mono text-footnote">
          <div className="mb-g4 flex items-center gap-g3 font-sans text-caption text-t6">
            <span className={`font-semibold ${isError ? 'text-rust' : 'text-t6'}`}>
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
