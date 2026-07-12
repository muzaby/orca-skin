import { memo, useState } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'
import { ToolCard } from './ToolCard'
import {
  UNIT_KEY,
  VERB_KEY,
  VERB_KEY_ACTIVE,
  toolDescription,
  toolGroupSegments,
  toolVerbCategory
} from '../../lib/toolMeta'
import { isAgentTaskName } from '../../lib/parts'
import type { ToolCall } from '../../reducer/chatReducer'

// 한 어시스턴트 턴의 toolCalls 를 묶는다. 도구가 1개면 그룹 헤더 없이 카드만, 2+ 일 때만
// disclosure 그룹 헤더(진행 중엔 현재 도구 서술, 완료되면 동사별 카운트 요약).
// memo(shallow): reconcileSegments 가 변하지 않은 세그먼트의 calls 배열 identity 를
// 보존하므로 다른 세그먼트가 갱신돼도 이 그룹은 재렌더되지 않는다 (0008).
export const ToolGroup = memo(function ToolGroup({
  calls
}: {
  calls: ToolCall[]
}): React.JSX.Element | null {
  const { tr } = useI18n()
  const [open, setOpen] = useState(true)
  // 단일 도구: 그룹 헤더 없이 카드만(카드 자체가 border/bg 보유).
  if (calls.length <= 1) return calls[0] ? <ToolCard call={calls[0]} /> : null
  // 마지막 pending call (진행 중 헤더 텍스트의 출처)
  let pending: ToolCall | null = null
  for (const c of calls) if (c.result == null) pending = c
  const segments = toolGroupSegments(calls)
  // 서브에이전트(Task) 그룹이 진행 중이면 헤더를 "실행 중 에이전트 N개" 로 — 개별 도구 서술 대신
  // 진행 중 에이전트 수를 집계(참고 UI 양식). pending 이 Task 일 때만 적용.
  const pendingIsAgent = pending != null && isAgentTaskName(pending.name)
  const runningAgentCount = calls.filter((c) => isAgentTaskName(c.name) && c.result == null).length
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
            pendingIsAgent ? (
              // 진행 중 서브에이전트 그룹 — 진행 중 에이전트 수 집계
              tr('chat.toolMeta.runningAgents', { count: runningAgentCount })
            ) : (
              // 진행 중 — 마지막 pending 도구 서술(진행 시제)
              `${tr(VERB_KEY_ACTIVE[toolVerbCategory(pending.name)])} ${toolDescription(
                pending,
                tr('chat.toolMeta.planDescription')
              )}`
            )
          ) : (
            // 완료 — 동사별 카운트 요약. 동사(primary)와 카운트(secondary) span 분리.
            <>
              {segments.map((seg, i) => {
                const unitKey = UNIT_KEY[seg.category]
                return (
                  <span key={seg.category} className={seg.hasError ? 'text-bad' : undefined}>
                    {i > 0 && ', '}
                    <span className={seg.hasError ? undefined : 'text-t9'}>
                      {tr(VERB_KEY[seg.category])}
                    </span>
                    {unitKey && <span className="text-t6"> {tr(unitKey, { count: seg.n })}</span>}
                  </span>
                )
              })}
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
          <div className="mt-g2 flex flex-col gap-[var(--chat-item-gap)] rounded-r6 border border-t5 bg-bg p-p7">
            {calls.map((c) => (
              <ToolCard key={c.toolUseId} call={c} inGroup />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})
