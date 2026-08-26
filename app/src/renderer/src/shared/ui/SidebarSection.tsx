import { useId, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

// 사이드바 섹션 헤더의 시각 단일 소스. app/Sidebar 의 '최근 대화'(접히지 않는 헤더)와
// features/ 의 접히는 섹션이 함께 쓴다 — 레이어마다 클래스 문자열을 복제하면 한쪽만
// 바뀌어 조용히 어긋난다(MODAL_LABEL 과 같은 공유 상수 패턴). 도메인 지식은 없다.
export const SIDEBAR_SECTION_HEAD = 'px-3 pb-1 pt-4 text-caption font-medium text-ink3'

const TOGGLE_HEAD = `${SIDEBAR_SECTION_HEAD} flex w-full items-center gap-1 border-0 bg-transparent text-left hover:text-t7`

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
