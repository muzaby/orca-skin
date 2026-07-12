import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { CopyIconButton } from '../../../../shared/ui/CopyIconButton'
import { Markdown } from '../../../../shared/ui/markdown/Markdown'
import { chatActions, useChatSession } from '../../store/chatStore'
import { usePlanCommentSelection } from '../../hooks/usePlanCommentSelection'
import { rangeFromOffsets, rectsForRange } from '../../lib/planCommentDom'
import { PlanCommentOverlay } from './PlanCommentOverlay'
import { PlanCommentPopover, type PopoverAnchorPoint } from './PlanCommentPopover'
import { useI18n } from '../../../../shared/i18n'

// 계획 타일 헤더 액션 — 본문이 아닌 타일 헤더(RightPanelTile)에서 렌더된다.
// planContent 를 직접 구독하므로 RightPanelTile 은 타일별 액션을 모른 채 슬롯만 받는다.
export function PlanTileHeaderActions(): React.JSX.Element {
  const { tr } = useI18n()
  const planContent = useChatSession((s) => s.planContent)
  return <CopyIconButton text={planContent ?? ''} title={tr('chat.rightpanel.planCopy')} />
}

export function PlanTileContent(): React.JSX.Element {
  const { tr } = useI18n()
  const planContent = useChatSession((s) => s.planContent)
  // 계획 검토 중일 때만 드래그→코멘트 활성(전송 가능한 상태와 일치).
  const enabled = useChatSession((s) => s.pendingPlanReview != null)
  const comments = useChatSession((s) => s.planComments)
  const activeId = useChatSession((s) => s.activePlanCommentId)

  // 마크다운 본문만 감싸는 컨테이너(힌트 제외) — 선택 오프셋·하이라이트 rect 기준.
  const contentRef = useRef<HTMLDivElement>(null)
  const { draft, clear } = usePlanCommentSelection(contentRef, enabled)
  const [editAnchor, setEditAnchor] = useState<PopoverAnchorPoint | null>(null)

  const activeComment = comments.find((c) => c.id === activeId) ?? null

  // 편집 대상 코멘트 선택 시 해당 구간으로 스크롤 + 팝오버 앵커 rect 계산. setState 는 rAF
  // (비동기) 안에서만 — effect 본문 동기 setState 회피. activeComment 가 없을 땐 아래 렌더
  // 가드(activeComment && editAnchor)가 팝오버를 숨기므로 editAnchor 를 비울 필요가 없다.
  useLayoutEffect(() => {
    if (!activeComment) return
    const container = contentRef.current
    if (!container) return
    const range = rangeFromOffsets(container, activeComment.start, activeComment.end)
    if (!range) return
    range.startContainer.parentElement?.scrollIntoView({ block: 'nearest' })
    const id = requestAnimationFrame(() => {
      const rects = rectsForRange(range, container)
      const first = rects[0]
      if (!first) return
      setEditAnchor({
        x: first.left + first.width / 2,
        top: first.top,
        bottom: first.top + first.height,
        containerWidth: container.clientWidth
      })
    })
    return () => cancelAnimationFrame(id)
  }, [activeComment])

  const onCreateSave = useCallback(
    (body: string): void => {
      if (!draft) return
      chatActions.addPlanComment({
        id: crypto.randomUUID(),
        quote: draft.quote,
        start: draft.start,
        end: draft.end,
        body,
        createdAt: Date.now()
      })
      clear()
    },
    [draft, clear]
  )

  if (!planContent) {
    return (
      <div
        className="flex flex-1 flex-col overflow-y-auto px-4 py-3"
        style={{ scrollbarGutter: 'stable' }}
      >
        <div className="m-auto flex max-w-[240px] flex-col items-center gap-g3 text-center text-t6">
          <Icon name="board" size={28} style={{ color: 'var(--color-t6)' }} />
          <p className="text-footnote font-medium text-t6">
            {tr('chat.rightpanel.planEmptyTitle')}
          </p>
          <p className="text-caption text-ink3">{tr('chat.rightpanel.planEmptyDesc')}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-1 flex-col overflow-y-auto px-4 py-3"
      style={{ scrollbarGutter: 'stable' }}
    >
      <div className="mx-auto w-full max-w-[68ch] text-[13px] text-ink">
        <div className="mb-[var(--chat-item-gap)] flex items-center gap-g3 text-caption text-t6">
          <Icon name="doc" size={13} />
          <span>{tr('chat.rightpanel.planSelectHint')}</span>
        </div>
        <div ref={contentRef} className="relative">
          <Markdown source={planContent} />
          <PlanCommentOverlay
            containerRef={contentRef}
            comments={comments}
            activeId={activeId}
            draft={draft ? { start: draft.start, end: draft.end } : null}
            contentKey={planContent}
            onSelect={(id) => chatActions.setActivePlanComment(id)}
          />
          {draft ? (
            <PlanCommentPopover
              key="create"
              anchor={draft.anchor}
              quote={draft.quote}
              mode="create"
              onSave={onCreateSave}
              onClose={clear}
            />
          ) : (
            activeComment &&
            editAnchor && (
              <PlanCommentPopover
                key={activeComment.id}
                anchor={editAnchor}
                quote={activeComment.quote}
                mode="edit"
                initialBody={activeComment.body}
                onSave={(body) => {
                  chatActions.updatePlanComment(activeComment.id, body)
                  chatActions.setActivePlanComment(null)
                }}
                onDelete={() => chatActions.removePlanComment(activeComment.id)}
                onClose={() => chatActions.setActivePlanComment(null)}
              />
            )
          )}
        </div>
      </div>
    </div>
  )
}
