import { Markdown } from '../markdown/Markdown'
import type { ReasoningItem } from '../../lib/parts'

interface ReasoningBlockProps {
  items: ReasoningItem[]
  // 라이브 프리뷰(스트리밍 중)는 펼친 상태로 표시. 완성/로드된 블록은 기본 접힘.
  defaultOpen?: boolean
}

// 확장사고(reasoning) 블록 — 기본 접힘. 여러 블록이 있으면 줄바꿈으로 이어 한 카드에 표시한다.
// signature 는 무결성용 opaque 값이라 표시하지 않는다(저장만).
export function ReasoningBlock({
  items,
  defaultOpen
}: ReasoningBlockProps): React.JSX.Element | null {
  if (items.length === 0) return null
  const source = items.map((i) => i.text).join('\n\n')
  if (source.trim() === '') return null // 내용이 비면 빈 카드를 그리지 않는다(방어)
  return (
    <details
      open={defaultOpen}
      className="group/reasoning rounded-r6 border border-border bg-bg2 px-p5 py-p4 text-[13px] text-ink2"
    >
      <summary className="cursor-pointer select-none list-none font-mono text-[11px] uppercase tracking-[0.04em] text-ink3">
        사고 과정
      </summary>
      <div className="mt-p3 leading-[1.6] text-ink2">
        <Markdown source={source} />
      </div>
    </details>
  )
}
