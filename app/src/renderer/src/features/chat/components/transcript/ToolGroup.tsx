import { useState } from 'react'
import { ToolCard } from './ToolCard'
import {
  VERB_LABEL,
  summarizeToolGroup,
  toolDescription,
  toolVerbCategory
} from '../../lib/toolMeta'
import type { ToolCall } from '../../reducer/chatReducer'

// 한 어시스턴트 턴의 toolCalls 를 외곽 Disclosure 로 묶는다 (설계서 §3.3 2단 중첩).
// 외곽 = 그룹 요약 토글, 내부 = 각 ToolCard 가 자체 펼침/접힘 보유. 도구 1개여도 동일 구조.
// 헤더는 Claude Code 양식 모방 — 진행 중엔 현재 도구 서술, 완료되면 동사별 카운트 요약.
export function ToolGroup({ calls }: { calls: ToolCall[] }): React.JSX.Element {
  const [open, setOpen] = useState(true)
  // 마지막 pending call (진행 중 헤더 텍스트의 출처)
  let pending: ToolCall | null = null
  for (const c of calls) if (c.result == null) pending = c
  const summary = pending
    ? `${VERB_LABEL[toolVerbCategory(pending.name)]} ${toolDescription(pending)}`
    : summarizeToolGroup(calls)
  return (
    <div className="flex flex-col gap-[var(--chat-item-gap)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-1 text-left text-[12px] text-ink2"
      >
        <span aria-hidden className="w-3 text-[10px] text-ink3">
          {open ? '▼' : '▶'}
        </span>
        <span className="min-w-0 truncate font-medium">{summary}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-[var(--chat-item-gap)] rounded-[10px] bg-sidebar p-2.5">
          {calls.map((c) => (
            <ToolCard key={c.toolUseId} call={c} />
          ))}
        </div>
      )}
    </div>
  )
}
