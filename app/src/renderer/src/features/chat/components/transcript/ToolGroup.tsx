import { useState } from 'react'
import { ToolCard } from './ToolCard'
import type { ToolCall } from '../../reducer/chatReducer'

// 한 어시스턴트 턴의 toolCalls 를 외곽 Disclosure 로 묶는다 (설계서 §3.3 2단 중첩).
// 외곽 = 그룹 요약 토글, 내부 = 각 ToolCard 가 자체 펼침/접힘 보유. 도구 1개여도 동일 구조.
export function ToolGroup({ calls }: { calls: ToolCall[] }): React.JSX.Element {
  const [open, setOpen] = useState(true)
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
        <span className="font-medium">도구 실행</span>
        <span className="text-ink3">· {calls.length}개</span>
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
