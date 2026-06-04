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

// 전략문서 5.4 양식 — 카드가 아니라 *행*. 동사→이름→diff→chevron(마지막).
// 펼침 본문(코드/diff)만 recessed 블록. `inGroup` 이면 그룹 카드(bg-bg) 위라
// 본문은 테두리로만 구분, standalone 이면 본문이 bg-bg recessed.
export function ToolCard({
  call,
  inGroup = false
}: {
  call: ToolCall
  inGroup?: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  // 최초 오픈 후엔 본문을 계속 마운트 유지 → 닫힘도 grid-rows 전환으로 애니메이션.
  // 한 번도 안 연 카드는 본문 미마운트(shiki 등 선렌더 비용 회피).
  const [wasOpened, setWasOpened] = useState(false)
  const toggle = (): void => {
    setOpen((v) => !v)
    setWasOpened(true)
  }
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
    <div className="flex w-full flex-col">
      {/* 행: [동사] [서술] (+N-M) [chevron] — chevron 은 마지막 (전략 5.4) */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        }}
        className="group/tool flex max-w-full cursor-pointer items-center gap-g2 self-start text-left text-body text-t6 outline-none hide-focus-ring ring-focus"
      >
        <span
          className={`shrink-0 ${
            isError ? 'text-rust' : done ? 'group-hover/tool:text-t9' : 'epitaxy-text-shine'
          }`}
        >
          {verb}
        </span>
        {!done && <span className="sr-only">실행 중</span>}
        <span className="min-w-0 truncate group-hover/tool:text-t9">{description}</span>
        {stat && (stat.added > 0 || stat.removed > 0) && (
          <span className="shrink-0 font-mono text-caption tabular-nums">
            {stat.added > 0 && <span className="text-extended-green">+{stat.added}</span>}
            {stat.removed > 0 && <span className="ml-1 text-extended-pink">-{stat.removed}</span>}
          </span>
        )}
        <span aria-hidden className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}>
          <Icon name="chevR" size={12} />
        </span>
      </div>
      {/* 펼침 본문 — grid-rows 0fr↔1fr 전환으로 height+opacity 애니메이션(JS scrollHeight 불요) */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.215,0.61,0.355,1)] motion-reduce:transition-none ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          {(open || wasOpened) && (
            <div
              className={`mt-g2 overflow-hidden rounded-r4 font-mono text-footnote text-t9 ${
                inGroup ? 'border border-t5' : 'bg-bg'
              }`}
            >
              <div className="px-p5 py-p4">
                <div className="mb-g3 flex items-center gap-g3 font-sans text-caption text-t6">
                  <span className={`font-semibold ${isError ? 'text-rust' : 'text-t7'}`}>
                    {call.name}
                  </span>
                  <span>
                    {statusLabel}
                    {duration}
                  </span>
                </div>
                <ToolBody call={call} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
