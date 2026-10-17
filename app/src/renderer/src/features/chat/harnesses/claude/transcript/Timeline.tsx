import { surfaces } from '../surfaces'
import { memo, useMemo, useState } from 'react'
import { ReadingColumn } from '../../../../../shared/ui/ReadingColumn'
import { useI18n } from '../../../../../shared/i18n'
import { Exchange } from './Exchange'
import { TurnErrorBanner } from '../../common/transcript/TurnErrorBanner'
import { PendingAssistant } from './PendingAssistant'
import { PendingSteerTurn } from '../../common/transcript/PendingSteerTurn'
import { groupExchanges } from '../../../lib/turns'
import { useTranscriptVirtualizer } from '../../../hooks/useTranscriptVirtualizer'
import { createWorkToolResultSelector } from '../../../lib/workToolResults'
import { agentPresentation } from '../presentation'

// 0256 D-009: both harness viewports accept the global scale at this shared boundary.

import type { TranscriptTimelineProps } from '../../contracts'
export const ClaudeTranscriptView = memo(function ClaudeTranscriptView({
  agentKind,
  backend = 'claude',
  messages,
  pendingSteer,
  onRestoreSteerDraft,
  inflight,
  loadingSession,
  error,
  anchored,
  scrollRef,
  contentRef,
  onScroll,
  textScaleClassName,
  showAutomaticFeeds
}: TranscriptTimelineProps): React.JSX.Element {
  const { tr } = useI18n()
  // 델타 프레임(messages 참조 불변)에서 Exchange/Turn 객체 identity 를 고정 — memo 된
  // 컴포넌트가 props 비교만으로 재렌더를 건너뛴다 (0007-transcript-render-memo 계승).
  const exchanges = useMemo(
    () => groupExchanges(messages, { showAutomaticFeeds }),
    [messages, showAutomaticFeeds]
  )
  const transcriptPolicy = agentPresentation[agentKind].transcript
  const [selectWorkResults] = useState(createWorkToolResultSelector)
  const workResults = useMemo(
    () =>
      transcriptPolicy.turnProjection === 'work-activity'
        ? selectWorkResults(exchanges)
        : undefined,
    [exchanges, selectWorkResults, transcriptPolicy]
  )
  // "virtualized head + unvirtualized tail" (0102) — 마지막(스트리밍) 교환은 비가상 tail 로
  // 렌더해 0008 예약공간 앵커(min-h-[50cqh]) + useScrollAnchor 계약을 보존하고, 과거 확정
  // 교환들(head)만 가상화해 화면 밖 shiki/DOM 상주 비용을 시야로 제한한다.
  const head = useMemo(() => exchanges.slice(0, -1), [exchanges])
  const tail = exchanges.at(-1)
  const virtualizer = useTranscriptVirtualizer(head, scrollRef)
  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  const hasPending = (pendingSteer?.length ?? 0) > 0
  const isEmpty = exchanges.length === 0 && !loadingSession && !inflight && !hasPending

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      // 대화 내용 텍스트 크기(0256 D-009) — 전역 설정값을 이 루트만 범위 변수로 받아들인다.
      // 컴포저·우측 패널·포털 팝오버는 선언 밖이라 배율 1이다.
      className={`app-frame-transcript flex-1 overflow-auto py-5 [container-type:size] [overflow-anchor:none] ${textScaleClassName} ${surfaces.transcriptRoot}`}
      data-harness={backend ?? 'claude'}
      data-behavior="virtualizable"
    >
      {/* gap 은 flex 가 아니라 각 항목의 pb-[--chat-turn-gap] 로 준다 — 가상 head 아이템은
          absolute 배치라 flex gap 이 적용되지 않기 때문. tail·엣지 상태도 동일 pb 로 균일. */}
      <ReadingColumn ref={contentRef} className="flex min-h-full flex-col">
        {loadingSession && (
          <div className="m-auto text-center text-[calc(13px*var(--transcript-text-scale,1))] text-ink3">
            {tr('chat.transcript.loading')}
          </div>
        )}
        {isEmpty && (
          <div className="m-auto text-center text-[calc(13px*var(--transcript-text-scale,1))] text-ink3">
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
                      transcriptPolicy={transcriptPolicy}
                      toolResults={workResults?.get(exchange.startIndex)}
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
            transcriptPolicy={transcriptPolicy}
            toolResults={workResults?.get(tail.startIndex)}
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
