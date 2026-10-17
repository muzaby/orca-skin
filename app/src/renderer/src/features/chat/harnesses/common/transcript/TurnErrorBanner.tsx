import { useI18n } from '../../../../../shared/i18n'
import { errorCategoryKey } from '../../../lib/errorLabels'
import type { ClassifiedError } from '../../../../../../../shared/ipc'

// 라이브 턴 에러 배너(state.error) — 영속 error 파트의 인라인 카드(ErrorCard)와 별개.
export function TurnErrorBanner({ error }: { error: ClassifiedError }): React.JSX.Element {
  const { tr } = useI18n()
  const categoryKey = errorCategoryKey(error.category)
  return (
    <div className="rounded-[10px] border border-bad/40 bg-bad/10 px-3 py-2 text-[calc(12.5px*var(--transcript-text-scale,1))] text-ink">
      <div className="flex items-center gap-2">
        <span className="font-semibold">
          {tr('errors.turnError', { category: categoryKey ? tr(categoryKey) : error.category })}
        </span>
        {error.retryable && (
          <span className="rounded-full border border-border px-1.5 py-px text-[calc(10.5px*var(--transcript-text-scale,1))] text-ink3">
            {tr('errors.retryable')}
          </span>
        )}
      </div>
      <div className="mt-1 text-ink2">{error.message}</div>
      {error.retryable && (
        <div className="mt-1 text-[calc(11.5px*var(--transcript-text-scale,1))] text-ink3">
          {tr('errors.transientHint')}
        </div>
      )}
    </div>
  )
}
