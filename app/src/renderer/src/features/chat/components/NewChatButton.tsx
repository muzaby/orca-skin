import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../shared/ui/Icon'

// Sidebar 의 '새 대화' 슬롯에 주입되는 도메인 버튼. URL `/new` 로 이동시켜
// useChatRouteSync 가 state 리셋을 처리하게 한다 (라우팅을 진실의 출처로).
export function NewChatButton(): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate('/new')}
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
