import { ChatTile, Composer, useChatContext } from '../features/chat'
import { useBackendContext } from '../features/backend'
import { formatApproxCost, useCost } from '../features/cost'

// `/new` 라우트의 랜딩 페이지.
// - 메시지가 아예 없을 때: 빈 화면 중앙에 Composer 만 노출 (ChatGPT 스타일).
// - 메시지가 한 번이라도 추가되면 (= 사용자가 첫 메시지를 송신한 직후): 일반
//   ChatTile 레이아웃으로 자연 전환. init 이벤트로 `sessionId` 가 발급되는 즉시
//   `useChatRouteSync` Direction 2 가 URL 을 `/chat/<id>` 로 replace 하여 ChatPage
//   가 인계받는다.
export function NewChatLandingPage(): React.JSX.Element {
  const chat = useChatContext()
  const { backendLabel, capabilities } = useBackendContext()
  const { summary } = useCost()
  // 능력 서술자가 로드됐는데 sessionAbort 가 아니면 중단 게이팅(미로드면 현행 동작 유지).
  const canAbort = capabilities ? capabilities.cancellation.sessionAbort === true : true
  const isEmpty = chat.state.messages.length === 0 && !chat.state.loadingSession
  const costToday = summary ? formatApproxCost(summary.day.totalCostUsd) : undefined

  if (isEmpty) {
    return (
      <section className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-bg">
        <div className="w-full max-w-[720px]">
          <div className="mb-3 text-center font-serif text-[24px] font-semibold tracking-tight text-ink">
            무엇을 도와드릴까요?
          </div>
          <Composer
            chat={chat}
            backendLabel={backendLabel}
            canAbort={canAbort}
            costToday={costToday}
          />
        </div>
      </section>
    )
  }
  return (
    <ChatTile chat={chat} backendLabel={backendLabel} canAbort={canAbort} costToday={costToday} />
  )
}
