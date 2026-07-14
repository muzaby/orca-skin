import { memo, useMemo } from 'react'
import { ReadingColumn } from '../../../../shared/ui/ReadingColumn'
import { useI18n } from '../../../../shared/i18n'
import { Exchange, TurnErrorBanner } from './Exchange'
import { PendingAssistant } from './PendingAssistant'
import { PendingSteerTurn } from './PendingSteerTurn'
import { groupExchanges } from '../../lib/turns'
import { useTranscriptVirtualizer } from '../../hooks/useTranscriptVirtualizer'
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
// 델타 프레임에 커밋 상태(messages)는 불변이다 (0008). 가상화(0102) 도입 후 스크롤/
// 자동추종 프레임에는 virtualizer 가 이 컴포넌트를 깨우지만, head/tail 의 <Exchange> 가
// memo(exchangeEquals) 라 대부분 bail — 재계산은 보이는 창(virtualItems)으로 한정된다.
//
// 스크롤 컨테이너는 size container — tail 교환의 min-h-[50cqh](예약공간)가 이 컨테이너의
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
  const { tr } = useI18n()
  // 델타 프레임(messages 참조 불변)에서 Exchange/Turn 객체 identity 를 고정 — memo 된
  // 컴포넌트가 props 비교만으로 재렌더를 건너뛴다 (0007-transcript-render-memo 계승).
  const exchanges = useMemo(() => groupExchanges(messages), [messages])
  // "virtualized head + unvirtualized tail" (0102) — 마지막(스트리밍) 교환은 비가상 tail 로
  // 렌더해 0008 예약공간 앵커(min-h-[50cqh]) + useScrollAnchor 계약을 보존하고, 과거 확정
  // 교환들(head)만 가상화해 화면 밖 shiki/DOM 상주 비용을 시야로 제한한다.
  const head = useMemo(() => (exchanges.length > 0 ? exchanges.slice(0, -1) : []), [exchanges])
  const tail = exchanges.length > 0 ? exchanges[exchanges.length - 1] : undefined
  const virtualizer = useTranscriptVirtualizer(head, scrollRef)
  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  const hasPending = (pendingSteer?.length ?? 0) > 0
  const isEmpty = messages.length === 0 && !loadingSession && !inflight && !hasPending

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="app-frame-transcript flex-1 overflow-auto py-5 [container-type:size] [overflow-anchor:none]"
      data-behavior="virtualizable"
    >
      {/* gap 은 flex 가 아니라 각 항목의 pb-[--chat-turn-gap] 로 준다 — 가상 head 아이템은
          absolute 배치라 flex gap 이 적용되지 않기 때문. tail·엣지 상태도 동일 pb 로 균일. */}
      <ReadingColumn ref={contentRef} className="flex min-h-full flex-col">
        {loadingSession && (
          <div className="m-auto text-center text-[13px] text-ink3">
            {tr('chat.transcript.loading')}
          </div>
        )}
        {isEmpty && (
          <div className="m-auto text-center text-[13px] text-ink3">
            {tr('chat.transcript.emptyPrompt')}
          </div>
        )}
        {/* 가상화된 head — 확정 과거 교환. 스페이서(totalSize) 안에 보이는 항목만 absolute 배치. */}
        {head.length > 0 && (
          <div className="relative w-full" style={{ height: totalSize }}>
            {virtualItems.map((vi) => {
              const exchange = head[vi.index]
              if (!exchange) return null
              return (
                <div
                  key={exchange.startIndex}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full"
                  style={{ transform: `translateY(${vi.start}px)` }}
                >
                  {/* pb = 다음 교환까지의 간격. 측정 높이에 포함돼 스페이서/스크롤과 정합. */}
                  <div className="pb-[var(--chat-turn-gap)]">
                    <Exchange
                      exchange={exchange}
                      reserve={false}
                      pending={false}
                      forkable={false}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {/* 비가상 tail — 마지막(진행 중일 수 있는) 교환. 예약공간·pending·fork·에러·steer 를
            여기에만 적용해 0008 스트리밍 앵커를 그대로 유지한다. */}
        {tail && (
          <Exchange
            key={tail.startIndex}
            exchange={tail}
            reserve={anchored}
            pending={inflight}
            // 분기(fork) 아이콘은 transcript 의 마지막 어시스턴트 턴에서만(r2 피드백).
            forkable
            error={error}
            // pending-first(0067) — 유휴 중에도 미커밋(pending) 메시지는 계속 보인다.
            pendingSteer={pendingSteer}
            onRestoreSteerDraft={onRestoreSteerDraft}
          />
        )}
        {/* 교환이 없는 첫 전송(0067 pending-first) — pending 버블을 직접 렌더한다. */}
        {exchanges.length === 0 && hasPending && (
          <PendingSteerTurn items={pendingSteer!} onRestoreDraft={onRestoreSteerDraft} />
        )}
        {/* 교환이 없는데 턴이 진행 중(핸드오프 직후 init 대기 등, r2) — 라이브 인디케이터로
            빈 화면을 막는다. 교환이 생기면 마지막 Exchange 내부 PendingAssistant 로 넘어간다. */}
        {inflight && exchanges.length === 0 && <PendingAssistant />}
        {/* 교환이 없는데 에러만 있는 엣지(전송 실패 직후 등) — 최상위 fallback. */}
        {error && exchanges.length === 0 && <TurnErrorBanner error={error} />}
      </ReadingColumn>
    </div>
  )
})
