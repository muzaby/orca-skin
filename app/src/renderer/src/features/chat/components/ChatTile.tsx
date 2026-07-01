import { useState } from 'react'
import { ChatTitleBar } from './ChatTitleBar'
import { TranscriptView } from './transcript/TranscriptView'
import { Composer } from './Composer'
import { RightPanel } from './rightpanel/RightPanel'
import { useScrollAnchor } from '../hooks/useScrollAnchor'
import { useChatSession, useFlushedSteer, usePendingSteer } from '../store/chatStore'

interface ChatTileProps {
  backendLabel: string
  // 활성 백엔드의 중단 지원 여부(§15). page → ChatView 를 거쳐 Composer 로 전달.
  canAbort: boolean
  costToday?: string
  // 컴포저 초기 입력 시드(Skills "채팅에서 사용해보기"). page 가 nav state 로 주입.
  initialDraft?: string
}

// 채팅 타일 셸 — 레이아웃 조립(타이틀바·transcript·컴포저·우측 계획 타일 도킹)과
// 스크롤 앵커 훅 호스팅만 담당한다. 커밋 슬라이스(session)만 selector 로 구독하므로
// 스트리밍 델타 프레임에는 재렌더되지 않고, 커밋 프레임에도 자식(ChatTitleBar·
// TranscriptView·Composer)이 각자 memo/selector 로 bail 한다 (0008).
export function ChatTile({
  backendLabel,
  canAbort,
  costToday,
  initialDraft
}: ChatTileProps): React.JSX.Element {
  const messages = useChatSession((s) => s.messages)
  const sessionId = useChatSession((s) => s.sessionId)
  const sendCount = useChatSession((s) => s.sendCount)
  const inflight = useChatSession((s) => s.inflight)
  const loadingSession = useChatSession((s) => s.loadingSession)
  const error = useChatSession((s) => s.error)
  const pendingSteer = usePendingSteer()
  const flushedSteer = useFlushedSteer()
  const [restoredDraft, setRestoredDraft] = useState<{ id: number; text: string } | undefined>()
  const { scrollRef, contentRef, onScroll, showJump, scrollToBottom, anchored } = useScrollAnchor({
    messages,
    sessionId,
    sendCount,
    inflight
  })

  return (
    <section className="app-frame-pane-host flex min-h-0 min-w-0 flex-1 flex-col bg-bg">
      <div className="app-frame-pane-row relative flex min-h-0 flex-1">
        {/* Claude Code 룩: transcript 는 별도 카드 없이 bg 평면 위에 그대로 — 우측
            plan tile 만 보더 카드로 분리된다. */}
        <div
          className="app-frame-tile flex min-w-0 flex-1 flex-col overflow-hidden bg-bg"
          data-behavior="resizable"
        >
          <ChatTitleBar />

          {/* transcript 상·하단 soft fade — 타이틀 아래/컴포저 위 경계에서 스크롤되는
              내용이 배경색(from-bg)으로 흐려진다. pointer-events-none 으로 스크롤·선택·
              클릭을 방해하지 않는다. */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-bg to-transparent" />
            <TranscriptView
              messages={messages}
              pendingSteer={pendingSteer}
              flushedSteer={flushedSteer}
              onRestoreSteerDraft={(text) => setRestoredDraft({ id: Date.now(), text })}
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
            initialDraft={initialDraft}
            restoredDraft={restoredDraft}
          />
        </div>

        <RightPanel />
      </div>
    </section>
  )
}
