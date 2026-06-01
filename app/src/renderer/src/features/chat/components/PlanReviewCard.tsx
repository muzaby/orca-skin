import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Markdown } from './markdown/Markdown'
import type { PlanReviewRequest } from '../../../../../shared/ipc'

interface PlanReviewCardProps {
  review: PlanReviewRequest
  // 승인 → 같은 턴에서 계획 실행.
  onApprove: () => void
  // 수정 제안 → 피드백을 에이전트에 전달해 계획 재작성.
  onRevise: (feedback: string) => void
  // 거부 → 턴 중단(에이전트 재제안 없음).
  onReject: () => void
}

// plan 모드에서 에이전트가 제출한 계획(ExitPlanMode)을 검토하는 인라인 카드. Composer 의
// .app-frame-composer 하위, 입력 패널 위에 in-flow 위젯으로 렌더한다(모달 아님).
// 3액션: 승인 / 수정 제안(피드백 입력 후에만 활성) / 거부. Esc=거부(실수 실행 방지로
// Enter=승인은 바인딩하지 않음).
export function PlanReviewCard({
  review,
  onApprove,
  onRevise,
  onReject
}: PlanReviewCardProps): React.JSX.Element {
  const [feedback, setFeedback] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const canRevise = feedback.trim() !== ''

  // 마운트 시 카드에 포커스(Esc=거부 수신). Composer 가 key={requestId} 로 계획마다 새로
  // 마운트하므로 feedback 은 초기화된다.
  useEffect(() => {
    queueMicrotask(() => rootRef.current?.focus())
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape' && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault()
      onReject()
    }
  }

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="app-frame-plan-review mb-2 rounded-[14px] border border-border bg-panel px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,.03)] outline-none"
      data-ask-user-input
      data-behavior="interactive"
      role="group"
      aria-label="계획 검토"
      onKeyDown={onKeyDown}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="rounded bg-rust-soft px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-rust">
          계획 검토
        </span>
        <span className="text-[10.5px] text-ink3">승인하면 실행됩니다</span>
      </div>

      <div className="max-h-[280px] overflow-y-auto rounded-[10px] border border-border bg-bg px-3 py-2 text-[13px] text-ink">
        <Markdown source={review.plan || '_제출된 계획 내용이 없습니다._'} />
      </div>

      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="수정 제안 내용을 입력하세요… (입력 후 ‘수정 제안’)"
        rows={2}
        aria-label="수정 제안 내용"
        className="mt-2 w-full resize-y rounded-[10px] border border-border bg-bg px-3 py-1.5 text-[13px] text-ink placeholder:text-ink3 focus:border-border-strong focus:outline-none"
      />

      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={onApprove}
          className="rounded-lg border-0 bg-rust px-3.5 py-1.5 text-[13px] font-medium text-white"
          data-behavior="action:send"
        >
          승인
        </button>
        <button
          type="button"
          onClick={() => onRevise(feedback)}
          disabled={!canRevise}
          className="rounded-lg border border-border bg-bg px-3 py-1.5 text-[13px] text-ink2 hover:bg-sidebar disabled:cursor-not-allowed disabled:opacity-40"
          title={canRevise ? undefined : '수정 제안 내용을 먼저 입력하세요'}
        >
          수정 제안
        </button>
        <button
          type="button"
          onClick={onReject}
          className="cursor-pointer rounded-lg border border-border bg-transparent px-3 py-1.5 text-[13px] text-ink2 hover:bg-sidebar"
          data-behavior="dismissible"
        >
          거부
        </button>
        <span className="ml-auto text-[11px] text-ink3">
          <kbd>Esc</kbd> 거부
        </span>
      </div>
    </div>
  )
}
