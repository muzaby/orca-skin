import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '../../../shared/ui/Button'
import { chatActions, useChatSession } from '../store/chatStore'
import { columnsContain } from '../lib/rightPanelLayout'
import { quoteSnippet } from '../lib/planComments'
import type { PlanComment } from '../reducer/chatReducer'
import { useI18n } from '../../../shared/i18n'

// ApprovalCard — Composer 의 입력 패널을 *대체*하는 **계획(plan_review)** 승인 게이트
// (rendering.md §7.6). 입력 위 additive 패턴인 tool_approval/ask_question 은 Composer 가
// 각각 ToolApprovalBody/AskUserQuestionCard 를 직접 배치한다(본 컴포넌트는 plan 전용).
//
// Composer 가 key={requestId} 로 재마운트하므로 로컬 state 는 요청마다 리셋된다.
export function ApprovalCard(): React.JSX.Element | null {
  const hasPlanReview = useChatSession((s) => s.pendingPlanReview != null)
  if (hasPlanReview) return <PlanApprovalBody />
  return null
}

// 도구 input 을 1~2줄로 요약. Bash 는 command, Write/Edit 는 file_path 를 우선 노출하고,
// 그 외는 JSON 직렬화 후 truncate. 렌더링 전용이라 누락 필드는 조용히 무시.
function summarizeToolInput(input: unknown): string {
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>
    if (typeof o.command === 'string') return o.command
    if (typeof o.file_path === 'string') return o.file_path
    if (typeof o.path === 'string') return o.path
  }
  try {
    return JSON.stringify(input)
  } catch {
    return String(input)
  }
}

// 도구 input 의 부가 설명(있으면). Bash 등은 `description` 으로 의도를 전달한다 —
// 본문에 요약(summarizeToolInput) 위 보조 줄로 노출. 비문자열/공백은 무시.
function toolDescription(input: unknown): string | null {
  if (input && typeof input === 'object') {
    const d = (input as Record<string, unknown>).description
    if (typeof d === 'string' && d.trim() !== '') return d.trim()
  }
  return null
}

// 동시(서브에이전트·병렬) 도구 승인은 큐(pendingToolApprovals)로 모델링되어 Composer 가
// 항목마다 본 컴포넌트를 스택으로 렌더한다 — 각 카드는 자신의 승인 항목을 prop 으로 받아
// 자기 approvalId 로 응답한다.
export function ToolApprovalBody({
  approvalId,
  toolName,
  input
}: {
  approvalId: string
  toolName: string
  input: unknown
}): React.JSX.Element {
  const { tr } = useI18n()
  const { approveTool, approveToolForSession, denyTool } = chatActions

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
      e.preventDefault()
      approveTool(approvalId)
    }
  }

  const summary = summarizeToolInput(input)
  const description = toolDescription(input)

  return (
    <div
      className="app-frame-plan-approval rounded-r7 border border-t5 bg-surface-primary-elevated px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,.03)]"
      data-surface="prompt"
      data-behavior="interactive"
      role="group"
      aria-label={tr('chat.approval.toolAria')}
      onKeyDown={onKeyDown}
    >
      <div className="flex items-center gap-g3">
        <span className="text-footnote font-medium text-t9">
          {tr('chat.approval.toolRequest', { tool: toolName })}
        </span>
      </div>

      {description && <p className="mt-1 text-caption text-t6">{description}</p>}

      <div className="mt-2 line-clamp-2 break-all rounded-r5 bg-bg px-3 py-1.5 font-mono text-caption text-t7">
        {summary}
      </div>

      <div className="mt-3 flex items-center justify-between gap-g3">
        <Button
          variant="contained"
          onClick={() => denyTool(approvalId)}
          data-behavior="dismissible"
        >
          {tr('chat.approval.deny')}
        </Button>
        <div className="flex items-center gap-g3">
          <Button
            variant="uncontained"
            onClick={() => approveToolForSession(approvalId, toolName)}
            title={tr('chat.approval.allowSessionTitle')}
          >
            {tr('chat.approval.allowSession')}
          </Button>
          <Button
            variant="primary"
            onClick={() => approveTool(approvalId)}
            data-behavior="action:send"
          >
            {tr('chat.approval.allow')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// 계획 본문에 남긴 인라인 코멘트 칩 목록 — 인용 스니펫 + 의견 미리보기. 클릭=패널에서 해당
// 코멘트 편집 팝오버 열기, x=삭제. 자체 hover 격리(group/plancomment).
function PlanCommentChips({
  comments,
  onOpen,
  onRemove
}: {
  comments: PlanComment[]
  onOpen: (id: string) => void
  onRemove: (id: string) => void
}): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div className="mt-2 flex flex-col gap-1">
      {comments.map((c) => (
        <div
          key={c.id}
          className="group/plancomment flex items-start gap-2 rounded-r5 border border-t5 bg-bg px-2 py-1.5"
        >
          <button
            type="button"
            onClick={() => onOpen(c.id)}
            className="min-w-0 flex-1 cursor-default text-left outline-none hide-focus-ring ring-focus"
            title={tr('chat.approval.commentEditTitle')}
          >
            <div className="truncate text-caption text-t6">“{quoteSnippet(c.quote, 48)}”</div>
            <div className="truncate text-footnote text-t9">{c.body}</div>
          </button>
          <Button
            iconOnly
            size="small"
            leadingIcon="x"
            onClick={() => onRemove(c.id)}
            title={tr('chat.approval.commentDelete')}
            aria-label={tr('chat.approval.commentDelete')}
            className="shrink-0 opacity-0 group-hover/plancomment:opacity-100"
          />
        </div>
      ))}
    </div>
  )
}

function PlanApprovalBody(): React.JSX.Element | null {
  const { tr } = useI18n()
  const { approvePlan, revisePlanWithComments, rejectPlan, setRightPanelTileActive } = chatActions
  const review = useChatSession((s) => s.pendingPlanReview)
  const planTileOpen = useChatSession((s) => columnsContain(s.rightPanelTiles, 'plan'))
  const comments = useChatSession((s) => s.planComments)
  const [feedback, setFeedback] = useState('')
  // 수정 영역 확장 여부를 "사용자가 마지막으로 접었을 때의 코멘트 수"로 표현한다(null = 명시적 펼침).
  // 코멘트가 그 수를 넘어서면 다시 펼쳐지므로, 코멘트가 확장을 *강제*하던 종전 규칙(reviseOpen ||
  // hasComments)과 달리 '뒤로'가 코멘트 유무와 무관하게 항상 접을 수 있다. effect 없는 순수 파생.
  const [collapsedAtCount, setCollapsedAtCount] = useState<number | null>(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasComments = comments.length > 0
  const reviseExpanded = collapsedAtCount === null || comments.length > collapsedAtCount
  const canRevise = feedback.trim() !== '' || hasComments

  useEffect(() => {
    if (comments.length === 0) return
    const id = requestAnimationFrame(() => textareaRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [comments.length])

  if (!review) return null
  const rid = review.requestId

  const submitRevise = (): void => {
    if (canRevise) revisePlanWithComments(rid, comments, feedback)
  }

  const onReviseClick = (): void => {
    if (!reviseExpanded) {
      setCollapsedAtCount(null)
      return
    }
    submitRevise()
  }

  // 뒤로 = 수정 영역만 접는다. feedback(로컬)·planComments(store) 는 손대지 않아 재진입 시 복원되고,
  // 코멘트를 단 뒤에도 수락/거부에 도달할 수 있게 된다(접기 전에는 좌측 그룹이 통째로 숨겨졌다).
  const collapseRevise = (): void => setCollapsedAtCount(comments.length)

  const openComment = (id: string): void => {
    setRightPanelTileActive('plan', true)
    chatActions.setActivePlanComment(id)
  }

  // 수정 textarea: Enter=전송, Shift+Enter=줄바꿈. 카드 레벨 Ctrl+Enter(수락)와 분리(stopPropagation).
  const onTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      e.stopPropagation()
      submitRevise()
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    // Esc=뒤로(확장 상태에서만 소비 — 접힌 상태에선 상위 핸들러에 양보). textarea 는 Enter 만
    // stopPropagation 하므로 입력 중에도 여기까지 버블링된다(AskUserQuestionCard 와 같은 패턴).
    if (e.key === 'Escape' && reviseExpanded) {
      e.preventDefault()
      collapseRevise()
      return
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
      e.preventDefault()
      approvePlan(rid)
    }
  }

  return (
    <div
      className="app-frame-plan-approval rounded-r7 border border-t5 bg-surface-primary-elevated px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,.03)]"
      data-surface="prompt"
      data-behavior="interactive"
      role="group"
      aria-label={tr('chat.approval.planAria')}
      onKeyDown={onKeyDown}
    >
      <div className="flex items-center gap-g3">
        <span className="text-footnote font-medium text-t9">
          {tr('chat.approval.planProposed')}
        </span>
        {!planTileOpen && (
          <button
            type="button"
            onClick={() => setRightPanelTileActive('plan', true)}
            className="ml-auto cursor-default border-0 bg-transparent text-footnote font-medium text-t8 outline-none hide-focus-ring ring-focus hover:underline"
          >
            {tr('chat.approval.openPlan')}
          </button>
        )}
      </div>

      <div
        className="mt-2 grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: reviseExpanded ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          {/* 작성한 코멘트는 textarea 위에 스택. */}
          {hasComments && (
            <PlanCommentChips
              comments={comments}
              onOpen={openComment}
              onRemove={chatActions.removePlanComment}
            />
          )}
          <div
            className={`relative mb-1 rounded-r5 border border-t5 bg-bg focus-within:border-border-strong ${hasComments ? 'mt-2' : ''}`}
          >
            <div
              aria-hidden
              className="min-h-[72px] max-h-56 w-full overflow-hidden whitespace-pre-wrap break-words px-3 py-1.5 text-footnote text-transparent"
            >
              {feedback === '' ? tr('chat.approval.revisePlaceholder') : feedback}
              {feedback.endsWith('\n') ? '​' : ''}
            </div>
            <textarea
              ref={textareaRef}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onKeyDown={onTextareaKeyDown}
              placeholder={tr('chat.approval.revisePlaceholder')}
              aria-label={tr('chat.approval.reviseInputAria')}
              className="absolute inset-0 h-full max-h-56 w-full resize-none overflow-y-auto rounded-r5 border-0 bg-transparent px-3 py-1.5 text-footnote text-t9 outline-none ring-0 placeholder:text-t6 focus:border-transparent focus:ring-0"
            />
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-g3">
        {/* 좌측 슬롯은 항상 채운다 — 펼친 상태에선 '뒤로'(빠져나갈 길), 접힌 기본 상태에선
            거부 + 수정 진입. 우측은 펼침=수정 제출 / 접힘=수락.
            좌측 보조 액션은 전부 contained 로 통일한다 — 나란히 놓이는 버튼끼리 테두리 유무가
            갈리면 한쪽만 떠 보인다(danger-ghost 가 contained 테두리를 따라간 것과 같은 이유). */}
        {reviseExpanded ? (
          <Button variant="contained" leadingIcon="arrowL" onClick={collapseRevise}>
            {tr('chat.approval.reviseBack')}
          </Button>
        ) : (
          <div className="flex items-center gap-g3">
            <Button variant="contained" onClick={() => rejectPlan(rid)} data-behavior="dismissible">
              {tr('chat.approval.deny')}
            </Button>
            <Button variant="contained" onClick={onReviseClick}>
              {tr('chat.approval.reviseOpen')}
            </Button>
          </div>
        )}
        {reviseExpanded ? (
          <Button
            variant="primary"
            onClick={onReviseClick}
            disabled={!canRevise}
            kbd="Enter"
            title={!canRevise ? tr('chat.approval.reviseFirst') : undefined}
            data-behavior="action:send"
          >
            {tr('chat.approval.revise')}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => approvePlan(rid)}
            data-behavior="action:send"
            kbd="Ctrl+Enter"
          >
            {tr('chat.approval.accept')}
          </Button>
        )}
      </div>
    </div>
  )
}
