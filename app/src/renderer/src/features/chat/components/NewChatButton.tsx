import { Icon } from '../../../shared/ui/Icon'
import { useChatContext } from '../providers/ChatProvider'

// Sidebar 의 '새 대화' 슬롯에 주입되는 도메인 버튼. ChatContext 를 자체 구독.
export function NewChatButton(): React.JSX.Element {
  const { newChat } = useChatContext()
  return (
    <button
      onClick={() => newChat()}
      className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-panel px-2.5 py-2 font-medium text-ink"
    >
      <Icon name="plus" size={14} /> 새 대화
      <span className="ml-auto flex gap-[3px]">
        <span className="kbd text-[10px]">⌘</span>
        <span className="kbd text-[10px]">N</span>
      </span>
    </button>
  )
}
