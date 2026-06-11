import { useCallback, useRef } from 'react'
import { useDragResize } from '../../../shared/hooks/useDragResize'
import { ChatTitleBar } from './ChatTitleBar'
import { TranscriptView } from './transcript/TranscriptView'
import { Composer } from './Composer'
import { PlanTile } from './PlanTile'
import { useScrollAnchor } from '../hooks/useScrollAnchor'
import { chatActions, useChatSession } from '../store/chatStore'
import { PLAN_TILE_MIN_WIDTH, PLAN_TILE_MAX_WIDTH } from '../reducer/chatReducer'

interface ChatTileProps {
  backendLabel: string
  // 활성 백엔드의 중단 지원 여부(§15). page → ChatView 를 거쳐 Composer 로 전달.
  canAbort: boolean
  costToday?: string
}

// 채팅 타일 셸 — 레이아웃 조립(타이틀바·transcript·컴포저·우측 계획 타일 도킹)과
// 스크롤 앵커 훅 호스팅만 담당한다. 커밋 슬라이스(session)만 selector 로 구독하므로
// 스트리밍 델타 프레임에는 재렌더되지 않고, 커밋 프레임에도 자식(ChatTitleBar·
// TranscriptView·Composer)이 각자 memo/selector 로 bail 한다 (0008).
export function ChatTile({ backendLabel, canAbort, costToday }: ChatTileProps): React.JSX.Element {
  const messages = useChatSession((s) => s.messages)
  const sessionId = useChatSession((s) => s.sessionId)
  const sendCount = useChatSession((s) => s.sendCount)
  const inflight = useChatSession((s) => s.inflight)
  const loadingSession = useChatSession((s) => s.loadingSession)
  const error = useChatSession((s) => s.error)
  const planTileOpen = useChatSession((s) => s.planTileOpen)
  const planTileWidth = useChatSession((s) => s.planTileWidth)

  const rowRef = useRef<HTMLDivElement>(null)
  const { scrollRef, contentRef, onScroll, showJump, scrollToBottom, anchored } = useScrollAnchor({
    messages,
    sessionId,
    sendCount,
    inflight
  })

  // 우측 계획 타일은 행의 오른쪽 끝에 도킹 — 커서를 왼쪽으로 끌수록 폭이 커지므로 invert.
  const getRowRight = useCallback(
    (): number => rowRef.current?.getBoundingClientRect().right ?? 0,
    []
  )
  const { startResize } = useDragResize({
    getOrigin: getRowRight,
    min: PLAN_TILE_MIN_WIDTH,
    max: PLAN_TILE_MAX_WIDTH,
    invert: true,
    onChange: chatActions.setPlanTileWidth
  })

  return (
    <section className="app-frame-pane-host flex min-h-0 min-w-0 flex-1 flex-col bg-bg">
      <div ref={rowRef} className="app-frame-pane-row relative flex min-h-0 flex-1">
        {/* Claude Code 룩: transcript 는 별도 카드 없이 bg 평면 위에 그대로 — 우측
            plan tile 만 보더 카드로 분리된다. */}
        <div
          className="app-frame-tile flex min-w-0 flex-1 flex-col overflow-hidden bg-bg"
          data-behavior="resizable"
        >
          <ChatTitleBar backendLabel={backendLabel} />

          {/* transcript 상·하단 soft fade — 타이틀 아래/컴포저 위 경계에서 스크롤되는
              내용이 배경색(from-bg)으로 흐려진다. pointer-events-none 으로 스크롤·선택·
              클릭을 방해하지 않는다. */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-bg to-transparent" />
            <TranscriptView
              messages={messages}
              inflight={inflight}
              loadingSession={loadingSession}
              error={error}
              anchored={anchored}
              scrollRef={scrollRef}
              contentRef={contentRef}
              onScroll={onScroll}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-bg to-transparent" />
          </div>

          <Composer
            backendLabel={backendLabel}
            canAbort={canAbort}
            showScrollToBottom={showJump}
            onScrollToBottom={scrollToBottom}
            costToday={costToday}
          />
        </div>

        {planTileOpen && (
          <>
            <div
              className="app-frame-tile-separator group/sep relative w-3 shrink-0 cursor-col-resize"
              data-behavior="resizable"
              data-axis="vertical"
              data-context="tile"
              data-state="visible"
              onMouseDown={startResize}
              aria-label="Resize plan panel"
            >
              <span
                aria-hidden
                className="absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border-strong opacity-0 transition-opacity duration-150 group-hover/sep:opacity-100 group-active/sep:opacity-100 group-active/sep:bg-ink3"
              />
            </div>
            <div
              className="app-frame-tile effect-primary-elevated my-2 mr-2 flex shrink-0 flex-col overflow-hidden rounded-r6 border border-border bg-panel"
              style={{ width: planTileWidth }}
              data-context="plan"
            >
              <PlanTile />
            </div>
          </>
        )}
      </div>
    </section>
  )
}
