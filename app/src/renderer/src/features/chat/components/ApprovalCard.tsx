import { useState, type KeyboardEvent } from 'react'
import { Button } from '../../../shared/ui/Button'
import { YellowDot } from './transcript/YellowDot'
import type { UseChat } from '../hooks/useChat'

// ApprovalCard — Composer 의 입력 패널을 *대체*하는 승인 게이트(rendering.md §7.6 일반화).
// permission.requested 의 action.kind 별로 분기한다:
//   - plan_review   : ExitPlanMode 계획 승인(거부/수정…/수락). PlanApprovalBody.
//   - tool_approval : 위험 도구(Bash/Write/Edit 등) 실행 승인(거부/세션허용/허용). ToolApprovalBody.
//   - ask_question  : 질문 카드는 입력 *위*에 additive 로 뜨는 별도 패턴(AskUserQuestionCard)이라
//                     입력-대체형인 본 컴포넌트가 아니라 Composer 가 직접 배치한다.
//
// Composer 가 key={requestId/approvalId} 로 재마운트하므로 로컬 state 는 요청마다 리셋된다.
export function ApprovalCard({ chat }: { chat: UseChat }): React.JSX.Element | null {
  if (chat.state.pendingPlanReview) return <PlanApprovalBody chat={chat} />
  if (chat.state.pendingToolApproval) return <ToolApprovalBody chat={chat} />
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

function ToolApprovalBody({ chat }: { chat: UseChat }): React.JSX.Element | null {
  const { state, approveTool, approveToolForSession, denyTool } = chat
  const pending = state.pendingToolApproval
  if (!pending) return null
  const { approvalId, toolName } = pending

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
      e.preventDefault()
      approveTool(approvalId)
    }
  }

  const summary = summarizeToolInput(pending.input)

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

      <div className="mt-1.5 line-clamp-2 break-all rounded-r5 bg-bg px-3 py-1.5 font-mono text-caption text-t7">
        {summary}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-g3">
        <div className="flex items-center gap-g3">
          <Button
            variant="contained"
            onClick={() => denyTool(approvalId)}
            data-behavior="dismissible"
          >
            거부
          </Button>
          <Button
            variant="uncontained"
            onClick={() => approveToolForSession(approvalId, toolName)}
            title="이 세션 동안 같은 도구를 자동 허용"
          >
            세션 동안 허용
          </Button>
        </div>
        <Button
          variant="primary"
          onClick={() => approveTool(approvalId)}
          data-behavior="action:send"
          kbd="Ctrl+Enter"
        >
          허용
        </Button>
      </div>
    </div>
  )
}

function PlanApprovalBody({ chat }: { chat: UseChat }): React.JSX.Element | null {
  const { state, approvePlan, revisePlan, rejectPlan, openPlanTile } = chat
  const review = state.pendingPlanReview
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
        {!state.planTileOpen && (
          <button
            type="button"
            onClick={openPlanTile}
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
