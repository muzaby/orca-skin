import { memo } from 'react'
import { UserTurn } from './UserTurn'
import { AssistantTurn } from './AssistantTurn'
import { PendingAssistant } from './PendingAssistant'
import { errorCategoryLabel } from '../../lib/errorLabels'
import { exchangeEquals, type Exchange as ExchangeGroup } from '../../lib/turns'
import type { ClassifiedError } from '../../../../../../shared/ipc'

interface ExchangeProps {
  exchange: ExchangeGroup
  // 예약공간(ChatGPT식 앵커) — 라이브 전송으로 생긴 마지막 교환에만 true. min-h-[50cqh]
  // (스크롤 컨테이너 = size container 의 content-box 기준 50%)가 user 버블이 미드라인까지
  // 올라갈 공간을 CSS 로 보장하고, 답변이 그 안을 채우는 동안 scrollHeight 가 불변이라
  // 스트리밍 중 레이아웃 JS 가 필요 없다 (rendering.md §1.8, 0008). 회수는 없다 — 다음
  // 전송에서 이 교환이 "마지막"에서 벗어나며 새 예약+앵커 스크롤에 가려 무점프 해제.
  reserve: boolean
  // 이 교환의 턴이 아직 진행 중(스트리밍) — 마지막 assistant 턴 메타 숨김 + 라이브 리프 표시.
  pending: boolean
  // 라이브 턴 에러 배너 — 예약공간 아래로 밀리지 않도록 마지막 교환 *내부* 끝에 렌더.
  error?: ClassifiedError
}

export const Exchange = memo(
  function Exchange({ exchange, reserve, pending, error }: ExchangeProps): React.JSX.Element {
    const lastTurn = exchange.turns[exchange.turns.length - 1]
    return (
      <div
        className={`flex flex-col gap-[var(--chat-turn-gap)] ${reserve ? 'min-h-[50cqh]' : ''}`}
        data-app-exchange
      >
        {exchange.turns.map((turn) =>
          turn.role === 'user' ? (
            <UserTurn key={turn.startIndex} turn={turn} />
          ) : (
            <AssistantTurn
              key={turn.startIndex}
              turn={turn}
              // 진행 중 교환의 마지막 assistant 턴만 메타 숨김(턴 종료 시 노출).
              pending={pending && turn === lastTurn}
            />
          )
        )}
        {pending && <PendingAssistant />}
        {error && <TurnErrorBanner error={error} />}
      </div>
    )
  },
  (prev, next) =>
    prev.reserve === next.reserve &&
    prev.pending === next.pending &&
    prev.error === next.error &&
    exchangeEquals(prev.exchange, next.exchange)
)

// 라이브 턴 에러 배너(state.error) — 영속 error 파트의 인라인 카드(ErrorCard)와 별개.
export function TurnErrorBanner({ error }: { error: ClassifiedError }): React.JSX.Element {
  return (
    <div className="rounded-[10px] border border-rust bg-rust-soft px-3 py-2 text-[12.5px] text-ink">
      <div className="flex items-center gap-2">
        <span className="font-semibold">에러: {errorCategoryLabel(error.category)}</span>
        {error.retryable && (
          <span className="rounded-full border border-border px-1.5 py-px text-[10.5px] text-ink3">
            재시도 가능
          </span>
        )}
      </div>
      <div className="mt-1 text-ink2">{error.message}</div>
      {error.retryable && (
        <div className="mt-1 text-[11.5px] text-ink3">
          일시적 오류일 수 있습니다. 다시 보내보세요.
        </div>
      )}
    </div>
  )
}
