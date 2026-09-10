import { useId, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

const TOGGLE_HEAD =
  'flex w-full items-center gap-1 border-0 bg-transparent px-3 pb-1 pt-4 text-left text-caption font-medium text-ink3 hover:text-t7'

interface CollapsibleSectionProps {
  label: string
  // 섹션 루트의 DOM 마커 클래스와 data-context (dom-architecture.md 의 마커 체계).
  className: string
  dataContext: string
  children: ReactNode
}

// 접히는 사이드바 섹션 — 헤더 버튼 + 본문. 섹션이 늘어도 헤더의 시각·접근성
// (aria-expanded/aria-controls/라벨)이 갈라지지 않도록 한 곳에 둔다.
export function CollapsibleSection({
  label,
  className,
  dataContext,
  children
}: CollapsibleSectionProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const bodyId = useId()

  return (
    <div className={className} data-context={dataContext}>
      <button
        type="button"
        className={TOGGLE_HEAD}
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={bodyId}
      >
        <span>{label}</span>
        <Icon name={expanded ? 'chevD' : 'chevR'} size={12} />
      </button>
      {expanded && (
        <div id={bodyId} className="px-1.5">
          {children}
        </div>
      )}
    </div>
  )
}
