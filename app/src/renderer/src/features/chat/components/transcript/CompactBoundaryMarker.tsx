import { memo } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'

interface CompactBoundaryMarkerProps {
  trigger?: 'manual' | 'auto'
  preTokens?: number
  postTokens?: number
}

// 1k 미만은 그대로, 이상은 k 단위(소수 1자리 — 1471→1.5k). 압축 결과가 보통 수백~수천이라
// Math.round(…/1000) 만으로는 0k/1k 로 뭉개진다.
function formatTokens(n: number): string {
  return n < 1000 ? `${n}` : `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
}

// SDK 네이티브 압축 완료 경계(0064 handoff) — transcript 구분선. 핸드오프 도착 세션의
// 첫 턴(/compact)이나 자동 압축 지점에서 "이전 대화가 압축됨"을 표시한다.
// pre/post 둘 다 있으면(0065 r2 — compact_metadata.post_tokens) "pre → post 토큰" 으로
// 얼마에서 얼마로 압축됐는지 표기한다.
export const CompactBoundaryMarker = memo(function CompactBoundaryMarker({
  trigger,
  preTokens,
  postTokens
}: CompactBoundaryMarkerProps): React.JSX.Element {
  const { tr } = useI18n()
  const tokenLabel =
    preTokens !== undefined && postTokens !== undefined
      ? ` · ${tr('chat.transcript.compactTokensRange', {
          pre: formatTokens(preTokens),
          post: formatTokens(postTokens)
        })}`
      : preTokens !== undefined
        ? ` · ${tr('chat.transcript.compactTokensCompressed', { pre: formatTokens(preTokens) })}`
        : ''
  const label = `${tr(trigger === 'auto' ? 'chat.transcript.compactAuto' : 'chat.transcript.compactManual')}${tokenLabel}`
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
