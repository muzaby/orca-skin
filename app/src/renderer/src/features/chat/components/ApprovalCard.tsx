import { useState, type KeyboardEvent } from 'react'
import { Button } from '../../../shared/ui/Button'
import { YellowDot } from './transcript/YellowDot'
import type { UseChat } from '../hooks/useChat'

// ApprovalCard — Composer 의 입력 패널을 *대체*하는 승인 게이트(rendering.md §7.6 일반화).
// permission.requested 의 action.kind 별로 분기한다:
//   - plan_review   : ExitPlanMode 계획 승인(거부/수정…/수락). 현재 구현(아래 PlanApprovalBody).
//   - tool_approval : 일반 도구 게이트 승인 — seam. 현재 router 는 일반 도구를 자동 통과시키므로
//                     렌더러까지 도달하지 않는다(B2). pendingApprovals 큐 + 일반 approve/deny 핸들러
//                     도입 시 활성(후속). 그 전까지는 null.
//   - ask_question  : 질문 카드는 입력 *위*에 additive 로 뜨는 별도 패턴(AskUserQuestionCard)이라
//                     입력-대체형인 본 컴포넌트가 아니라 Composer 가 직접 배치한다.
//
// Composer 가 key={requestId} 로 재마운트하므로 feedback/reviseOpen 은 계획마다 리셋된다.
export function ApprovalCard({ chat }: { chat: UseChat }): React.JSX.Element | null {
  if (chat.state.pendingPlanReview) return <PlanApprovalBody chat={chat} />
  // tool_approval seam — 활성 시 여기서 일반 승인 본문을 렌더.
  return null
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
