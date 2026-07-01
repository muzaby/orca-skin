import { memo, useMemo } from 'react'
import { ReadingColumn } from '../../../../shared/ui/ReadingColumn'
import { Exchange, TurnErrorBanner } from './Exchange'
import { groupExchanges } from '../../lib/turns'
import { PendingSteerTurn } from './PendingSteerTurn'
import type { Message } from '../../reducer/chatReducer'
import type { PendingSteerState } from '../../store/chatStore'
import type { ClassifiedError } from '../../../../../../shared/ipc'

interface TranscriptViewProps {
  messages: Message[]
  pendingSteer: PendingSteerState[]
  onRestoreSteerDraft?: (text: string) => void
  inflight: boolean
  loadingSession: boolean
  error?: ClassifiedError
  // 마지막 교환에 예약공간(min-h-[50cqh])을 적용할지 — useScrollAnchor 가 결정.
  anchored: boolean
  scrollRef: React.RefObject<HTMLDivElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
  onScroll: () => void
}

// transcript 스크롤 영역 — 커밋 상태(messages·inflight…)만 props 로 받아 memo 된다.
// 라이브 델타는 마지막 교환 안의 PendingAssistant 리프가 store 를 직접 구독하므로,
// 델타 프레임에 이 컴포넌트(= 교환 map)는 깨어나지 않는다 (0008).
//
// 스크롤 컨테이너는 size container — 교환의 min-h-[50cqh](예약공간)가 이 컨테이너의
// content-box 높이를 기준으로 풀리고, Composer 성장/윈도 리사이즈에도 CSS 가 자동 추종한다.
// overflow-anchor:none — pin/앵커를 직접 제어하므로 네이티브 scroll anchoring 의 이중
// 보정을 차단한다.
export const TranscriptView = memo(function TranscriptView({
  messages,
  pendingSteer,
  onRestoreSteerDraft,
  inflight,
  loadingSession,
  error,
  anchored,
  scrollRef,
  contentRef,
  onScroll
}: TranscriptViewProps): React.JSX.Element {
  // 델타 프레임(messages 참조 불변)에서 Exchange/Turn 객체 identity 를 고정 — memo 된
  // 컴포넌트가 props 비교만으로 재렌더를 건너뛴다 (0007-transcript-render-memo 계승).
  const exchanges = useMemo(() => groupExchanges(messages), [messages])
  const isEmpty = messages.length === 0 && !loadingSession

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="app-frame-transcript flex-1 overflow-auto py-5 [container-type:size] [overflow-anchor:none]"
      data-behavior="virtualizable"
    >
      <ReadingColumn
        ref={contentRef}
        className="flex min-h-full flex-col gap-[var(--chat-turn-gap)]"
      >
        {loadingSession && (
          <div className="m-auto text-center text-[13px] text-ink3">대화 불러오는 중…</div>
        )}
        {isEmpty && (
          <div className="m-auto text-center text-[13px] text-ink3">
            Claude Code 에 첫 메시지를 보내보세요.
          </div>
        )}
        {exchanges.map((exchange, i) => {
          const isLast = i === exchanges.length - 1
          return (
            <Exchange
              key={exchange.startIndex}
              exchange={exchange}
              reserve={isLast && anchored}
              pending={isLast && inflight}
              error={isLast ? error : undefined}
            />
          )
        })}
        {/* 교환이 없는데 에러만 있는 엣지(전송 실패 직후 등) — 최상위 fallback. */}
        {pendingSteer.length > 0 && (
          <PendingSteerTurn items={pendingSteer} onRestoreDraft={onRestoreSteerDraft} />
        )}
        {error && exchanges.length === 0 && <TurnErrorBanner error={error} />}
      </ReadingColumn>
    </div>
  )
})
