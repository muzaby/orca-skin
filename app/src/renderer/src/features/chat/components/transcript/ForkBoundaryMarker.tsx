import { memo } from 'react'
import { Icon } from '../../../../shared/ui/Icon'

// 분기 경계 구분선(0062 r5) — fork 세션에서 복사된 원본 이력과 새 대화 사이를 표시한다
// (CompactBoundaryMarker 와 동형). 라이브 draft 는 chatStore.startForkDraft 의 합성 파트,
// 재로드는 물질화 시 영속된 fork_boundary 파트가 이 컴포넌트로 렌더된다.
export const ForkBoundaryMarker = memo(function ForkBoundaryMarker(): React.JSX.Element {
  const label = '분기된 지점'
  return (
    <div className="my-1 flex items-center gap-2 text-ink3" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-border" aria-hidden />
      <span className="flex items-center gap-1 text-[11px] leading-none">
        <Icon name="fork" size={11} />
        {label}
      </span>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  )
})
