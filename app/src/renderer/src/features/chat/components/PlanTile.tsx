import { Icon } from '../../../shared/ui/Icon'
import { Button } from '../../../shared/ui/Button'
import { CopyIconButton } from '../../../shared/ui/CopyIconButton'
import { Markdown } from './markdown/Markdown'
import type { UseChat } from '../hooks/useChat'

const ICON_BTN =
  'grid h-7 w-7 cursor-default place-items-center rounded-r4 border-0 bg-transparent text-t6 outline-none hide-focus-ring ring-focus hover:bg-fill-uncontained-hover hover:text-t7'

interface PlanTileProps {
  chat: UseChat
}

// 채팅 타일 우측의 분할 tile. ExitPlanMode 가 제출한 계획(plan 마크다운)을 *내용 전용*으로
// 표시한다. 승인/수정/거부 액션은 Composer 의 입력창 교체형 승인 카드(PlanApprovalCard)로
// 이전됨 — 여기엔 헤더 복사/닫기 + 본문만 남는다.
export function PlanTile({ chat }: PlanTileProps): React.JSX.Element {
  const { state, closePlanTile } = chat

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg" data-context="plan">
      {/* 헤더 — 채팅 타일 titlebar 와 동일한 높이/패딩 */}
      <div className="app-frame-tile-header flex items-center gap-2 border-b border-t5 px-4 pb-2.5 pt-3.5">
        <span className="font-serif text-[15px] font-semibold tracking-tight text-t9">계획</span>
        <div className="ml-auto flex items-center gap-g2">
          <CopyIconButton text={state.planContent ?? ''} title="플랜 복사" className={ICON_BTN} />
          <Button
            iconOnly
            size="small"
            leadingIcon="x"
            onClick={closePlanTile}
            title="계획 패널 닫기"
            aria-label="계획 패널 닫기"
          />
        </div>
      </div>

      {/* 본문 — 계획 마크다운 또는 빈 상태 */}
      <div
        className="flex flex-1 flex-col overflow-y-auto px-4 py-3"
        style={{ scrollbarGutter: 'stable' }}
      >
        {state.planContent ? (
          <div className="mx-auto w-full max-w-[68ch] text-[13px] text-ink">
            <div className="mb-[var(--chat-item-gap)] flex items-center gap-g3 text-caption text-t6">
              <Icon name="doc" size={13} />
              <span>텍스트를 선택해 Claude에게 의견을 남기세요</span>
            </div>
            <Markdown source={state.planContent} />
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
    </div>
  )
}
