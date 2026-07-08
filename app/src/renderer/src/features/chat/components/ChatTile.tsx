import { useState } from 'react'
import { ChatTitleBar } from './ChatTitleBar'
import { LineageBanner } from './transcript/LineageBanner'
import { TranscriptView } from './transcript/TranscriptView'
import { Composer } from './Composer'
import { RightPanel } from './rightpanel/RightPanel'
import { useScrollAnchor } from '../hooks/useScrollAnchor'
import { useChatSession, useChatStore, usePendingSteer } from '../store/chatStore'
import type { UsageLimitsView } from '../../../../../shared/usage/limits'

interface ChatTileProps {
  backendLabel: string
  // 활성 백엔드의 중단 지원 여부(§15). page → ChatView 를 거쳐 Composer 로 전달.
  canAbort: boolean
  costToday?: string
  // 사용량 한도 뷰모델·설정 이동 콜백 — page → ChatView 를 거쳐 Composer 도넛 팝오버로.
  usageLimits?: UsageLimitsView | null
  // providerKey = 도넛에서 현재 선택된 provider(있으면 그 서브탭으로, 없으면 전역 사용량 탭).
  onOpenUsageSettings?: (providerKey?: string) => void
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
  usageLimits,
  onOpenUsageSettings,
  initialDraft
}: ChatTileProps): React.JSX.Element {
  const messages = useChatSession((s) => s.messages)
  const sessionId = useChatSession((s) => s.sessionId)
  const sendCount = useChatSession((s) => s.sendCount)
  const inflight = useChatSession((s) => s.inflight)
  const loadingSession = useChatSession((s) => s.loadingSession)
  const error = useChatSession((s) => s.error)
  const pendingSteer = usePendingSteer()
  const [restoredDraft, setRestoredDraft] = useState<{ id: number; text: string } | undefined>()
  // 중단 버튼 held 전량 취소(0067 확정 5) — store 의 draftRestore 신호를 파생값으로 합류해
  // Composer 입력에 편집 가능한 텍스트로 복원한다(활성 세션 것만, 최신 id 우선 — effect 불요).
  const draftRestore = useChatStore((s) => s.draftRestore)
  const activeKey = useChatStore((s) => s.activeKey)
  const storeRestore =
    draftRestore && draftRestore.key === activeKey
      ? { id: draftRestore.seq, text: draftRestore.text }
      : undefined
  const effectiveRestore =
    storeRestore && (!restoredDraft || storeRestore.id >= restoredDraft.id)
      ? storeRestore
      : restoredDraft
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

          {/* 0064 continuity — fork/handoff 파생 세션의 출처 안내(원본 링크). 비파생이면 null. */}
          <LineageBanner />

          {/* transcript 상·하단 soft fade — 타이틀 아래/컴포저 위 경계에서 스크롤되는
              내용이 배경색(from-bg)으로 흐려진다. pointer-events-none 으로 스크롤·선택·
              클릭을 방해하지 않는다. */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-bg to-transparent" />
            <TranscriptView
              messages={messages}
              pendingSteer={pendingSteer}
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
            usageLimits={usageLimits}
            onOpenUsageSettings={onOpenUsageSettings}
            initialDraft={initialDraft}
            restoredDraft={effectiveRestore}
          />
        </div>

        <RightPanel />
      </div>
    </section>
  )
}
