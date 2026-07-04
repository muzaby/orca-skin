import { memo } from 'react'
import { Icon } from '../../../../shared/ui/Icon'

interface CompactBoundaryMarkerProps {
  trigger?: 'manual' | 'auto'
  preTokens?: number
}

// SDK 네이티브 압축 완료 경계(0064 handoff) — transcript 구분선. 핸드오프 도착 세션의
// 첫 턴(/compact)이나 자동 압축 지점에서 "이전 대화가 압축됨"을 표시한다.
export const CompactBoundaryMarker = memo(function CompactBoundaryMarker({
  trigger,
  preTokens
}: CompactBoundaryMarkerProps): React.JSX.Element {
  const tokenLabel = preTokens !== undefined ? ` · ${Math.round(preTokens / 1000)}k 토큰 압축` : ''
  const label = `${trigger === 'auto' ? '자동 압축됨' : '이전 대화 압축됨'}${tokenLabel}`
  return (
    <div className="my-1 flex items-center gap-2 text-ink3" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-border" aria-hidden />
      <span className="flex items-center gap-1 text-[11px] leading-none">
        <Icon name="layers" size={11} />
        {label}
      </span>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  )
})
