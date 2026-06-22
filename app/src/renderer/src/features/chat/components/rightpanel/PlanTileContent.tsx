import { Icon } from '../../../../shared/ui/Icon'
import { CopyIconButton } from '../../../../shared/ui/CopyIconButton'
import { Markdown } from '../../../../shared/ui/markdown/Markdown'
import { useChatSession } from '../../store/chatStore'

// 계획 타일 헤더 액션 — 본문이 아닌 타일 헤더(RightPanelTile)에서 렌더된다.
// planContent 를 직접 구독하므로 RightPanelTile 은 타일별 액션을 모른 채 슬롯만 받는다.
export function PlanTileHeaderActions(): React.JSX.Element {
  const planContent = useChatSession((s) => s.planContent)
  return <CopyIconButton text={planContent ?? ''} title="플랜 복사" />
}

export function PlanTileContent(): React.JSX.Element {
  const planContent = useChatSession((s) => s.planContent)

  return (
    <div
      className="flex flex-1 flex-col overflow-y-auto px-4 py-3"
      style={{ scrollbarGutter: 'stable' }}
    >
      {planContent ? (
        <div className="mx-auto w-full max-w-[68ch] text-[13px] text-ink">
          <div className="mb-[var(--chat-item-gap)] flex items-center gap-g3 text-caption text-t6">
            <Icon name="doc" size={13} />
            <span>텍스트를 선택해 Claude에게 의견을 남기세요</span>
          </div>
          <Markdown source={planContent} />
        </div>
      ) : (
        <div className="m-auto flex max-w-[240px] flex-col items-center gap-g3 text-center text-t6">
          <Icon name="board" size={28} style={{ color: 'var(--color-t6)' }} />
          <p className="text-footnote font-medium text-t6">아직 플랜이 없습니다</p>
          <p className="text-caption text-ink3">
            Claude 가 탐색하며 계획을 세우면 여기에 표시됩니다.
          </p>
        </div>
      )}
    </div>
  )
}
