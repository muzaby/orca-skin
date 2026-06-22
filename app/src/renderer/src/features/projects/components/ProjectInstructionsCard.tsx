import { SidebarCard } from './SidebarCard'

interface ProjectInstructionsCardProps {
  instructions: string
  onEdit: () => void
}

// 우측 패널 "지침" 카드 — 카드 셸 + 헤더 "+" 버튼(편집 모달 트리거).
// 지침이 있으면 미리보기(3줄 말줄임), 없으면 안내 카피.
export function ProjectInstructionsCard({
  instructions,
  onEdit
}: ProjectInstructionsCardProps): React.JSX.Element {
  return (
    <SidebarCard title="지침" onAdd={onEdit} addTitle="지침 편집">
      {instructions.trim() ? (
        <div className="line-clamp-3 whitespace-pre-wrap break-words font-sans text-[12px] leading-[1.6] text-ink2">
          {instructions}
        </div>
      ) : (
        <div className="text-[12px] leading-[1.5] text-ink3">
          응답을 맞춤화하는 지침을 추가하세요.
        </div>
      )}
    </SidebarCard>
  )
}
