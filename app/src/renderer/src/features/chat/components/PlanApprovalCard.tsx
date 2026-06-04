import { useState, type KeyboardEvent } from 'react'
import { Button } from '../../../shared/ui/Button'
import { YellowDot } from './transcript/YellowDot'
import type { UseChat } from '../hooks/useChat'

interface PlanApprovalCardProps {
  chat: UseChat
}

// plan 모드에서 에이전트가 계획(ExitPlanMode)을 제출하면 Composer 의 입력 패널을 *대체*하는
// 승인 카드. Claude Code 웹의 .epitaxy-approval-card 미러.
// - 헤더: amber dot + 상태 문구 + (패널이 닫혀 있으면) "플랜 열기".
// - 액션: 거부(턴 중단) / 수정…(피드백 textarea expand → 에이전트 재계획) / 수락(실행).
// - Ctrl/Cmd+Enter = 수락. (오발 방지로 단순 Enter 는 바인딩하지 않는다.)
// Composer 가 key={requestId} 로 재마운트하므로 feedback/reviseOpen 은 계획마다 리셋된다.
export function PlanApprovalCard({ chat }: PlanApprovalCardProps): React.JSX.Element | null {
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
