import { Icon } from '../../../shared/ui/Icon'

interface ProjectInstructionsCardProps {
  instructions: string
  onEdit: () => void
}

// 우측 패널 "지침" 카드 — 테두리+라운드 카드 chrome + 헤더 "+" 버튼(편집 모달 트리거).
// 지침이 있으면 미리보기(3줄 말줄임), 없으면 안내 카피.
export function ProjectInstructionsCard({
  instructions,
  onEdit
}: ProjectInstructionsCardProps): React.JSX.Element {
  const hasInstructions = instructions.trim().length > 0
  return (
    <section className="rounded-r6 border border-border bg-panel px-4 py-3.5">
      <div className="mb-2 flex items-center">
        <div className="font-serif text-[13px] font-semibold text-ink">지침</div>
        <button
          onClick={onEdit}
          className="ml-auto grid h-6 w-6 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-ink2 hover:bg-fill-uncontained-hover hover:text-ink"
          title="지침 편집"
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
      {hasInstructions ? (
        <div className="line-clamp-3 whitespace-pre-wrap break-words font-sans text-[12px] leading-[1.6] text-ink2">
          {instructions}
        </div>
      ) : (
        <div className="text-[12px] leading-[1.5] text-ink3">
          Claude 의 응답을 맞춤화하는 지침 추가
        </div>
      )}
    </section>
  )
}
