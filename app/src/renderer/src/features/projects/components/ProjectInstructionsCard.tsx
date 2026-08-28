import { SidebarCard } from './SidebarCard'
import { useI18n } from '../../../shared/i18n'

interface ProjectInstructionsCardProps {
  instructions: string
  onEdit: () => void
}

// 우측 패널 "지침" 카드 — 카드 셸 + 헤더 "+" 버튼(편집 모달 트리거).
//
// 0208 — 아래 있던 파일 첨부 카드(동작 0 인 placeholder)를 제거하고 그 세로 공간을 본문이
// 가져갔다. min-h 280px 유도: 기존 3줄 본문 ≈58px + 되찾은 ≈226px(파일 카드 ≈210 + gap-4 16).
// 그래서 3줄 말줄임(line-clamp-3)도 걷어냈다 — 카드가 커진 만큼 지침 전문을 보이고 넘치면
// 카드 안에서 스크롤한다.
export function ProjectInstructionsCard({
  instructions,
  onEdit
}: ProjectInstructionsCardProps): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <SidebarCard
      title={tr('projects.instructionsCard.title')}
      onAdd={onEdit}
      addTitle={tr('projects.instructionsCard.editTitle')}
      bodyClassName="min-h-[280px] overflow-y-auto"
    >
      {instructions.trim() ? (
        <div className="whitespace-pre-wrap break-words font-sans text-[12px] leading-[1.6] text-ink2">
          {instructions}
        </div>
      ) : (
        <div className="text-[12px] leading-[1.5] text-ink3">
          {tr('projects.instructionsCard.emptyHint')}
        </div>
      )}
    </SidebarCard>
  )
}
