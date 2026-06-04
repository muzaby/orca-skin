interface ReadingColumnProps {
  children: React.ReactNode
  className?: string
}

// 중앙 정렬 리딩 컬럼 — transcript 와 composer 가 동일 폭(`--reading-column`)·거터(`--reading-gutter`)
// 를 공유하도록 캡슐화한 도메인-무관 레이아웃 래퍼. min-w-0 로 좁은 폭에서 자연 축소.
export function ReadingColumn({ children, className = '' }: ReadingColumnProps): React.JSX.Element {
  return (
    <div
      className={`mx-auto w-full min-w-0 max-w-[var(--reading-column)] px-[var(--reading-gutter)] ${className}`}
    >
      {children}
    </div>
  )
}
