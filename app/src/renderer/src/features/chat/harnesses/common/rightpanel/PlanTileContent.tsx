import { useCallback, useRef, type ReactNode } from 'react'
import { Icon } from '../../../../../shared/ui/Icon'
import { CopyIconButton } from '../../../../../shared/ui/CopyIconButton'
import { Markdown } from '../../../../../shared/ui/markdown/Markdown'
import { chatActions, useChatSession } from '../../../store/chatStore'
import { usePlanCommentSelection } from '../../../hooks/usePlanCommentSelection'
import type { PlanCommentIndex } from '../../../lib/planCommentDom'
import { usePlanCommentGeometry } from '../../../hooks/usePlanCommentGeometry'
import { PlanCommentOverlay } from './PlanCommentOverlay'
import { PlanCommentPopover } from './PlanCommentPopover'
import { useI18n, type MessageKey } from '../../../../../shared/i18n'
import { TaskProgressList } from './TaskProgressList'
import { useTaskBoard } from '../../../hooks/useTaskBoard'
import { TaskPanelContent } from './TaskPanelContent'

// 계획 타일 헤더 액션 — 본문이 아닌 타일 헤더(RightPanelTile)에서 렌더된다.
// planContent 를 직접 구독하므로 RightPanelTile 은 타일별 액션을 모른 채 슬롯만 받는다.
export function PlanTileHeaderActions(): React.JSX.Element {
  const { tr } = useI18n()
  const planContent = useChatSession((s) => s.planContent)
  return <CopyIconButton text={planContent ?? ''} title={tr('chat.rightpanel.planCopy')} />
}

export function PlanTileContent(copy: {
  emptyDescriptionKey: MessageKey
  selectHintKey: MessageKey
}): React.JSX.Element {
  const { tr } = useI18n()
  const items = useTaskBoard()
  const planContent = useChatSession((s) => s.planContent)
  const pendingPlanReview = useChatSession((s) => s.pendingPlanReview)
  const agentTools = useChatSession((s) => s.agentTools)
  const cliVersion = useChatSession((s) => s.cliVersion)
  const hasTasks = items.length > 0
  // 승인 대기의 본문 해소 실패는 빈 계획과 다르므로 작업만 있어도 감추지 않는다.
  const showPlan = Boolean(planContent) || pendingPlanReview != null || !hasTasks
  const unsupported = !hasTasks && agentTools != null && !agentTools.includes('TaskCreate')
  return (
    <TaskPanelContent
      items={items}
      mode="plan"
      overviewClassName="flex flex-1 flex-col overflow-y-auto px-p5 py-p4 [scrollbar-gutter:stable]"
    >
      <div className="mx-auto w-full max-w-[68ch] text-[13px] text-ink">
        {showPlan && (
          <PlanDocument
            {...copy}
            emptySupplement={
              unsupported ? (
                <TaskProgressList items={items} agentTools={agentTools} cliVersion={cliVersion} />
              ) : null
            }
          />
        )}
        {hasTasks && (
          <section
            aria-label={tr('chat.taskTile.headerTitle')}
            className={showPlan ? 'mt-5' : undefined}
          >
            <h3 className="mb-g2 text-caption font-normal text-t6">
              {tr('chat.taskTile.headerTitle')}
            </h3>
            <TaskProgressList items={items} />
          </section>
        )}
      </div>
    </TaskPanelContent>
  )
}

// 댓글 오프셋은 이 문서 본문만 기준으로 삼는다. 아래 작업 목록·상세는 ref 밖의 형제다.
function PlanDocument({
  emptySupplement,
  emptyDescriptionKey,
  selectHintKey
}: {
  emptySupplement: ReactNode
  emptyDescriptionKey: MessageKey
  selectHintKey: MessageKey
}): React.JSX.Element {
  const { tr } = useI18n()
  const planContent = useChatSession((s) => s.planContent)
  // 계획 검토 중일 때만 드래그→코멘트 활성(전송 가능한 상태와 일치).
  const enabled = useChatSession((s) => s.pendingPlanReview != null)
  const comments = useChatSession((s) => s.planComments)
  const activeId = useChatSession((s) => s.activePlanCommentId)

  const contentRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const indexRef = useRef<PlanCommentIndex | null>(null)
  const { draft, clear } = usePlanCommentSelection(
    contentRef,
    enabled,
    indexRef,
    planContent,
    overlayRef
  )
  const activeComment = comments.find((comment) => comment.id === activeId) ?? null
  const geometry = usePlanCommentGeometry(
    contentRef,
    overlayRef,
    planContent,
    comments,
    activeComment,
    draft,
    indexRef
  )
  const editAnchor = geometry?.activeId === activeId ? geometry?.anchor : null
  const closeEdit = useCallback(() => chatActions.setActivePlanComment(null), [])

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
    // **승인 대기 중인데 본문이 없으면 그것은 빈 계획이 아니라 해소 실패다**(0215 D-002).
    // 같은 "아직 플랜이 없습니다" 를 내면 사용자는 카드가 왜 떠 있는지 알 수 없고, 실패가
    // 화면에서 "아무 일도 안 일어남" 으로 보인다.
    const unavailable = enabled
    return (
      <div className="flex min-h-[144px] flex-col py-p4">
        <div className="m-auto flex max-w-[240px] flex-col items-center gap-g3 text-center text-t6">
          <Icon
            name={unavailable ? 'alert' : 'board'}
            size={28}
            style={{ color: 'var(--color-t6)' }}
          />
          <p className="text-footnote font-medium text-t6">
            {tr(
              unavailable
                ? 'chat.rightpanel.planUnavailableTitle'
                : 'chat.rightpanel.planEmptyTitle'
            )}
          </p>
          <p className="text-caption text-ink3">
            {tr(unavailable ? 'chat.rightpanel.planUnavailableDesc' : emptyDescriptionKey)}
          </p>
          {emptySupplement}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-[var(--chat-item-gap)] flex items-center gap-g3 text-caption text-t6">
        <Icon name="doc" size={13} />
        <span>{tr(selectHintKey)}</span>
      </div>
      <div ref={overlayRef} className="relative">
        <div ref={contentRef}>
          <Markdown source={planContent} />
        </div>
        <PlanCommentOverlay
          rectsByComment={geometry?.comments ?? []}
          draftRects={geometry?.draft ?? []}
          activeId={activeId}
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
              onClose={closeEdit}
            />
          )
        )}
      </div>
    </div>
  )
}
