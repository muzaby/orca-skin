import { Icon } from '../../../../shared/ui/Icon'
import { CopyIconButton } from '../../../../shared/ui/CopyIconButton'
import { Markdown } from '../markdown/Markdown'
import { useChatSession } from '../../store/chatStore'

export function PlanTileContent(): React.JSX.Element {
  const planContent = useChatSession((s) => s.planContent)

  return (
    <>
      <div className="flex items-center justify-end px-4 pt-3">
        <CopyIconButton text={planContent ?? ''} title="플랜 복사" />
      </div>
      <div
        className="flex flex-1 flex-col overflow-y-auto px-4 pb-3 pt-2"
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
    </>
  )
}
