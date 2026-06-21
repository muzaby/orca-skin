import { useState, type KeyboardEvent } from 'react'
import { Button } from '../../../shared/ui/Button'
import { YellowDot } from './transcript/YellowDot'
import { chatActions, useChatSession } from '../store/chatStore'

// ApprovalCard — Composer 의 입력 패널을 *대체*하는 계획 승인 게이트(rendering.md §7.6).
// permission.requested 의 action.kind 별로 분기한다:
//   - plan_review   : ExitPlanMode 계획 승인(거부/수정…/수락). PlanApprovalBody.
//   - tool_approval : 위험 도구(Bash/Write/Edit 등) 실행 승인은 입력 위 additive 카드
//                     패턴이라 Composer 가 ToolApprovalBody 를 직접 배치한다.
//   - ask_question  : 질문 카드는 입력 *위*에 additive 로 뜨는 별도 패턴(AskUserQuestionCard)이라
//                     입력-대체형인 본 컴포넌트가 아니라 Composer 가 직접 배치한다.
//
// Composer 가 key={requestId/approvalId} 로 재마운트하므로 로컬 state 는 요청마다 리셋된다.
export function ApprovalCard(): React.JSX.Element | null {
  const hasPlanReview = useChatSession((s) => s.pendingPlanReview != null)
  const hasToolApproval = useChatSession((s) => s.pendingToolApproval != null)
  if (hasPlanReview) return <PlanApprovalBody />
  if (hasToolApproval) return <ToolApprovalBody />
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

export function ToolApprovalBody(): React.JSX.Element | null {
  const { approveTool, approveToolForSession, denyTool } = chatActions
  const pending = useChatSession((s) => s.pendingToolApproval)
  if (!pending) return null
  const { approvalId, toolName } = pending

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
      e.preventDefault()
      approveTool(approvalId)
    }
  }

  const summary = summarizeToolInput(pending.input)
  const description = toolDescription(pending.input)

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

function PlanApprovalBody(): React.JSX.Element | null {
  const { approvePlan, revisePlan, rejectPlan, setRightPanelTileActive } = chatActions
  const review = useChatSession((s) => s.pendingPlanReview)
  const planTileOpen = useChatSession((s) => s.rightPanelTiles.includes('plan'))
  const [feedback, setFeedback] = useState('')
  const [reviseOpen, setReviseOpen] = useState(false)
  const canRevise = feedback.trim() !== ''

  if (!review) return null
  const rid = review.requestId

  const onReviseClick = (): void => {
    if (!reviseOpen) {
      setReviseOpen(true)
      return
    }
    if (canRevise) revisePlan(rid, feedback)
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
        style={{ gridTemplateRows: reviseOpen ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="수정 제안 내용을 입력하세요… (입력 후 ‘수정 요청 보내기’)"
            rows={3}
            aria-label="수정 제안 내용"
            className="mb-1 w-full resize-y rounded-r5 border border-t5 bg-bg px-3 py-1.5 text-footnote text-t9 outline-none ring-focus placeholder:text-t6 focus:border-border-strong"
          />
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-g3">
        <div className="flex items-center gap-g3">
          <Button variant="contained" onClick={() => rejectPlan(rid)} data-behavior="dismissible">
            거부
          </Button>
          <Button
            variant="uncontained"
            onClick={onReviseClick}
            disabled={reviseOpen && !canRevise}
            title={reviseOpen && !canRevise ? '수정 제안 내용을 먼저 입력하세요' : undefined}
          >
            {reviseOpen ? '수정 요청 보내기' : '수정…'}
          </Button>
        </div>
        <Button
          variant="primary"
          onClick={() => approvePlan(rid)}
          data-behavior="action:send"
          kbd="Ctrl+Enter"
        >
          수락
        </Button>
      </div>
    </div>
  )
}
