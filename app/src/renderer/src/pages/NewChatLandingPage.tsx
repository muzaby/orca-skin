import { useLocation } from 'react-router-dom'
import { ChatTile, Composer, useChatSession } from '../features/chat'
import { useBackendCapabilities, useBackendLabel } from '../features/backend'
import { formatApproxCost, useCostSummary, useUsageLimits } from '../features/cost'
import { useOpenSettings, providerTabId } from '../features/settings'

// `/new` 라우트의 랜딩 페이지.
// - 메시지가 아예 없을 때: 빈 화면 중앙에 Composer 만 노출 (ChatGPT 스타일).
// - 메시지가 한 번이라도 추가되면 (= 사용자가 첫 메시지를 송신한 직후): 일반
//   ChatTile 레이아웃으로 자연 전환. init 이벤트로 `sessionId` 가 발급되는 즉시
//   `useChatRouteSync` Direction 2 가 URL 을 `/chat/<id>` 로 replace 하여 ChatPage
//   가 인계받는다.
export function NewChatLandingPage(): React.JSX.Element {
  // 첫 send 의 낙관 커밋(0068)이 messages 를 즉시 채워 같은 렌더 사이클에 ChatTile 로
  // 전환된다. !inflight 는 이중 방어 — 어떤 경로로든 턴이 시작되면 랜딩에 갇히지 않는다.
  const isEmpty = useChatSession((s) => s.messages.length === 0 && !s.loadingSession && !s.inflight)
  const backendLabel = useBackendLabel()
  const capabilities = useBackendCapabilities()
  const summary = useCostSummary()
  // 능력 서술자가 로드됐는데 sessionAbort 가 아니면 중단 게이팅(미로드면 현행 동작 유지).
  const canAbort = capabilities ? capabilities.cancellation.sessionAbort === true : true
  const costToday = summary ? formatApproxCost(summary.day.totalCostUsd) : undefined
  const usageLimits = useUsageLimits()
  const openSettings = useOpenSettings()
  const onOpenUsageSettings = (key?: string): void =>
    openSettings(key ? providerTabId(key) : 'usage')
  // Skills 페이지의 "채팅에서 사용해보기" 가 nav state 로 전달한 컴포저 프리필(`/<스킬명> `).
  const location = useLocation()
  const composerDraft =
    typeof (location.state as { composerDraft?: unknown } | null)?.composerDraft === 'string'
      ? (location.state as { composerDraft: string }).composerDraft
      : undefined

  if (isEmpty) {
    return (
      <section className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-bg">
        <div className="w-full max-w-[720px]">
          <div className="mb-3 text-center font-serif text-[24px] font-semibold tracking-tight text-ink">
            무엇을 도와드릴까요?
          </div>
          <Composer
            backendLabel={backendLabel}
            canAbort={canAbort}
            costToday={costToday}
            usageLimits={usageLimits}
            onOpenUsageSettings={onOpenUsageSettings}
            initialDraft={composerDraft}
            showLandingCwdPanel
          />
        </div>
      </section>
    )
  }
  return (
    <ChatTile
      backendLabel={backendLabel}
      canAbort={canAbort}
      costToday={costToday}
      usageLimits={usageLimits}
      onOpenUsageSettings={onOpenUsageSettings}
      initialDraft={composerDraft}
    />
  )
}
