import { ChatTile, Composer, useChatContext } from '../features/chat'
import { useBackendContext } from '../features/backend'

// `/new` 라우트의 랜딩 페이지.
// - 메시지가 아예 없을 때: 빈 화면 중앙에 Composer 만 노출 (ChatGPT 스타일).
// - 메시지가 한 번이라도 추가되면 (= 사용자가 첫 메시지를 송신한 직후): 일반
//   ChatTile 레이아웃으로 자연 전환. init 이벤트로 `sessionId` 가 발급되는 즉시
//   `useChatRouteSync` Direction 2 가 URL 을 `/chat/<id>` 로 replace 하여 ChatPage
//   가 인계받는다.
export function NewChatLandingPage(): React.JSX.Element {
  const chat = useChatContext()
  const { backendLabel } = useBackendContext()
  const isEmpty = chat.state.messages.length === 0 && !chat.state.loadingSession

  if (isEmpty) {
    return (
      <section className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-bg">
        <div className="w-full max-w-[720px]">
          <div className="mb-3 text-center font-serif text-[20px] font-semibold tracking-tight text-ink">
            무엇을 도와드릴까요?
          </div>
          <Composer chat={chat} backendLabel={backendLabel} />
        </div>
      </section>
    )
  }
  return <ChatTile chat={chat} backendLabel={backendLabel} />
}
