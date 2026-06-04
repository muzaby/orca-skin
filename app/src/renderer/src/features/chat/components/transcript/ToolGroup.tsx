import { useState } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { ToolCard } from './ToolCard'
import {
  VERB_LABEL_ACTIVE,
  toolDescription,
  toolGroupSegments,
  toolVerbCategory
} from '../../lib/toolMeta'
import type { ToolCall } from '../../reducer/chatReducer'

// 한 어시스턴트 턴의 toolCalls 를 묶는다. 도구가 1개면 그룹 헤더 없이 카드만, 2+ 일 때만
// disclosure 그룹 헤더(진행 중엔 현재 도구 서술, 완료되면 동사별 카운트 요약).
export function ToolGroup({ calls }: { calls: ToolCall[] }): React.JSX.Element | null {
  const [open, setOpen] = useState(true)
  // 단일 도구: 그룹 헤더 없이 카드만(카드 자체가 border/bg 보유).
  if (calls.length <= 1) return calls[0] ? <ToolCard call={calls[0]} /> : null
  // 마지막 pending call (진행 중 헤더 텍스트의 출처)
  let pending: ToolCall | null = null
  for (const c of calls) if (c.result == null) pending = c
  const segments = toolGroupSegments(calls)
  return (
    <div className="flex w-full flex-col gap-[var(--chat-item-gap)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group/tool flex max-w-full cursor-pointer items-center gap-g1 self-start border-0 bg-transparent text-left text-body text-t6 outline-none hide-focus-ring ring-focus"
      >
        <span
          className={`min-w-0 truncate group-hover/tool:text-t9 ${pending ? 'epitaxy-text-shine' : ''}`}
        >
          {pending ? (
            // 진행 중 — 마지막 pending 도구 서술(진행 시제)
            `${VERB_LABEL_ACTIVE[toolVerbCategory(pending.name)]} ${toolDescription(pending)}`
          ) : (
            // 완료 — 동사별 카운트 요약. 동사(primary)와 카운트(secondary) span 분리.
            <>
              {segments.map((seg, i) => (
                <span key={seg.category} className={seg.hasError ? 'text-rust' : undefined}>
                  {i > 0 && ', '}
                  <span className={seg.hasError ? undefined : 'text-t9'}>{seg.verb}</span>
                  {seg.count && <span className="text-t6"> {seg.count}</span>}
                </span>
              ))}
            </>
          )}
        </span>
        <span aria-hidden className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}>
          <Icon name="chevR" size={12} />
        </span>
      </button>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.215,0.61,0.355,1)] motion-reduce:transition-none ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-g2 flex flex-col gap-[var(--chat-item-gap)] rounded-r6 bg-bg p-p7">
            {calls.map((c) => (
              <ToolCard key={c.toolUseId} call={c} inGroup />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
