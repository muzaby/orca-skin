import { Icon } from '../../../../shared/ui/Icon'
import { errorCategoryLabel } from '../../lib/errorLabels'

interface ErrorCardProps {
  // error 파트 payload — 보통 ClassifiedError({ category, message, ... }) 이나 unknown 으로 방어.
  error: unknown
}

function asClassified(error: unknown): { category: string; message: string } {
  if (typeof error === 'object' && error !== null) {
    const e = error as Record<string, unknown>
    const category = typeof e.category === 'string' ? e.category : 'error'
    const message =
      typeof e.message === 'string' ? e.message : typeof error === 'string' ? error : String(error)
    return { category, message }
  }
  return { category: 'error', message: typeof error === 'string' ? error : String(error) }
}

// 트랜스크립트에 영속된 error 파트(provider-runtime.md §7)를 작은 카드로. 라이브 턴 에러는
// ChatTile 의 배너가 담당하지만, 로드된 과거 세션의 error 파트는 여기서 인라인 표시한다.
export function ErrorCard({ error }: ErrorCardProps): React.JSX.Element {
  const { category, message } = asClassified(error)
  return (
    <div className="flex items-start gap-2 rounded-r6 border border-bad/40 bg-bad/10 px-p5 py-p4 text-[13px] text-ink">
      <span className="mt-[1px] text-bad">
        <Icon name="alert" size={15} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-bad">
          {errorCategoryLabel(category)}
        </span>
        <span className="break-words leading-[1.5] text-ink2">{message}</span>
      </div>
    </div>
  )
}
