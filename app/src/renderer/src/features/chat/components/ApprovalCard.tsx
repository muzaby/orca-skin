import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '../../../shared/ui/Button'
import { YellowDot } from './transcript/YellowDot'
import { chatActions, useChatSession } from '../store/chatStore'
import { columnsContain } from '../lib/rightPanelLayout'
import { quoteSnippet } from '../lib/planComments'
import type { PlanComment } from '../reducer/chatReducer'

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
      aria-label="도구 실행 승인"
      onKeyDown={onKeyDown}
    >
      <div className="flex items-center gap-g3">
        <YellowDot />
        <span className="text-footnote font-medium text-t9">
          Claude가 {toolName} 실행 권한을 요청합니다
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
          거부
        </Button>
        <div className="flex items-center gap-g3">
          <Button
            variant="uncontained"
            onClick={() => approveToolForSession(approvalId, toolName)}
            title="이 세션 동안 같은 도구를 자동 허용"
          >
            세션 동안 허용
          </Button>
          <Button
            variant="primary"
            onClick={() => approveTool(approvalId)}
            data-behavior="action:send"
          >
            허용
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
            title="코멘트 편집"
          >
            <div className="truncate text-caption text-t6">“{quoteSnippet(c.quote, 48)}”</div>
            <div className="truncate text-footnote text-t9">{c.body}</div>
          </button>
          <Button
            iconOnly
            size="small"
            leadingIcon="x"
            onClick={() => onRemove(c.id)}
            title="코멘트 삭제"
            aria-label="코멘트 삭제"
            className="shrink-0 opacity-0 group-hover/plancomment:opacity-100"
          />
        </div>
      ))}
    </div>
  )
}

function PlanApprovalBody(): React.JSX.Element | null {
  const { approvePlan, revisePlanWithComments, rejectPlan, setRightPanelTileActive } = chatActions
  const review = useChatSession((s) => s.pendingPlanReview)
  const planTileOpen = useChatSession((s) => columnsContain(s.rightPanelTiles, 'plan'))
  const comments = useChatSession((s) => s.planComments)
  const [feedback, setFeedback] = useState('')
  const [reviseOpen, setReviseOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasComments = comments.length > 0
  // 코멘트가 추가되면 composer 수정 영역을 파생 활성화해 칩과 추가 textarea 를 즉시 노출한다.
  const reviseExpanded = reviseOpen || hasComments
  const commentFeedbackActive = hasComments
  const canRevise = feedback.trim() !== '' || hasComments

  useEffect(() => {
    if (!hasComments) return
    const id = requestAnimationFrame(() => textareaRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [hasComments])

  if (!review) return null
  const rid = review.requestId

  const submitRevise = (): void => {
    if (canRevise) revisePlanWithComments(rid, comments, feedback)
  }

  const onReviseClick = (): void => {
    if (!reviseExpanded) {
      setReviseOpen(true)
      return
    }
    submitRevise()
  }

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
      aria-label="계획 승인"
      onKeyDown={onKeyDown}
    >
      <div className="flex items-center gap-g3">
        <YellowDot />
        <span className="text-footnote font-medium text-t9">Claude가 계획을 제안했습니다</span>
        {!planTileOpen && (
          <button
            type="button"
            onClick={() => setRightPanelTileActive('plan', true)}
            className="ml-auto cursor-default border-0 bg-transparent text-footnote font-medium text-rust outline-none hide-focus-ring ring-focus hover:underline"
          >
            플랜 열기
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
          <div className={`relative mb-1 rounded-r5 bg-white ${hasComments ? 'mt-2' : ''}`}>
            <div
              aria-hidden
              className="min-h-[72px] max-h-56 w-full overflow-hidden whitespace-pre-wrap break-words px-3 py-1.5 text-footnote text-transparent"
            >
              {feedback === '' ? '더 추가할 내용이 있으신가요?' : feedback}
              {feedback.endsWith('\n') ? '​' : ''}
            </div>
            <textarea
              ref={textareaRef}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onKeyDown={onTextareaKeyDown}
              placeholder="더 추가할 내용이 있으신가요?"
              aria-label="수정 제안 내용"
              className="absolute inset-0 h-full max-h-56 w-full resize-none overflow-y-auto rounded-r5 border-0 bg-transparent px-3 py-1.5 text-footnote text-t9 outline-none ring-0 placeholder:text-t6 focus:border-transparent focus:ring-0"
            />
          </div>
        </div>
      </div>

      <div
        className={`mt-2.5 flex items-center gap-g3 ${commentFeedbackActive ? 'justify-end' : 'justify-between'}`}
      >
        {!commentFeedbackActive && (
          <div className="flex items-center gap-g3">
            <Button variant="contained" onClick={() => rejectPlan(rid)} data-behavior="dismissible">
              거부
            </Button>
            {reviseExpanded ? (
              <Button variant="uncontained" onClick={() => approvePlan(rid)} kbd="Ctrl+Enter">
                수락
              </Button>
            ) : (
              <Button variant="uncontained" onClick={onReviseClick}>
                {hasComments ? (
                  <>
                    수정
                    <span className="ml-1 rounded-full bg-rust/15 px-1.5 text-caption font-medium text-rust">
                      {comments.length}
                    </span>
                  </>
                ) : (
                  '수정…'
                )}
              </Button>
            )}
          </div>
        )}
        {reviseExpanded ? (
          <Button
            variant="primary"
            onClick={onReviseClick}
            disabled={!canRevise}
            kbd="Enter"
            title={!canRevise ? '수정 제안 내용을 먼저 입력하세요' : undefined}
            data-behavior="action:send"
          >
            수정
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => approvePlan(rid)}
            data-behavior="action:send"
            kbd="Ctrl+Enter"
          >
            수락
          </Button>
        )}
      </div>
    </div>
  )
}
