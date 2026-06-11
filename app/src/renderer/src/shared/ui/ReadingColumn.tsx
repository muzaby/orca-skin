interface ReadingColumnProps {
  children: React.ReactNode
  className?: string
  // React 19 ref-as-prop — transcript 가 콘텐츠 성장 관찰(ResizeObserver) 대상으로 쓴다.
  ref?: React.Ref<HTMLDivElement>
}

// 중앙 정렬 리딩 컬럼 — transcript 와 composer 가 동일 폭(`--reading-column`)·거터(`--reading-gutter`)
// 를 공유하도록 캡슐화한 도메인-무관 레이아웃 래퍼. min-w-0 로 좁은 폭에서 자연 축소.
export function ReadingColumn({
  children,
  className = '',
  ref
}: ReadingColumnProps): React.JSX.Element {
  return (
    <div
      ref={ref}
      className={`mx-auto w-full min-w-0 max-w-[var(--reading-column)] px-[var(--reading-gutter)] ${className}`}
    >
      {children}
    </div>
  )
}
