import { useState, type KeyboardEvent } from 'react'
import { Icon } from '../../../shared/ui/Icon'
import { Markdown } from './markdown/Markdown'
import type { UseChat } from '../hooks/useChat'

const ICON_BTN =
  'grid h-7 w-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-ink2 hover:bg-sidebar'

interface PlanTileProps {
  chat: UseChat
}

// 채팅 타일 우측의 분할 tile. ExitPlanMode 가 제출한 계획(plan 마크다운)을 표시한다.
// - 내용: state.planContent (승인/거부 후에도 유지 — 읽기전용으로 계속 표시).
// - 액션바: state.pendingPlanReview 가 있을 때만(검토 게이트 열림). 승인 / 수정 제안(피드백
//   입력 후 활성) / 거부. 피드백 textarea 는 grid-rows 0fr→1fr 로 expand. Esc=거부.
export function PlanTile({ chat }: PlanTileProps): React.JSX.Element {
  const { state, approvePlan, revisePlan, rejectPlan, closePlanTile } = chat
  const review = state.pendingPlanReview
  const requestId = review?.requestId ?? null

  // 피드백/expand 는 계획마다 초기화돼야 한다. ChatTile 이 key={requestId} 로 새 계획마다
  // PlanTile 을 재마운트하므로 local state 가 자연히 리셋된다(useEffect setState 불필요).
  const [feedback, setFeedback] = useState('')
  const [reviseOpen, setReviseOpen] = useState(false)
  const canRevise = feedback.trim() !== ''

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape' && !(e.target instanceof HTMLTextAreaElement) && requestId) {
      e.preventDefault()
      rejectPlan(requestId)
    }
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-bg"
      data-behavior="interactive"
      role="group"
      aria-label="계획"
      onKeyDown={onKeyDown}
    >
      {/* 헤더 — 채팅 타일 titlebar 와 동일한 높이/패딩 */}
      <div className="app-frame-tile-header flex items-center gap-3 border-b border-border px-4 pb-2.5 pt-3.5">
        <span className="font-serif text-[15px] font-semibold tracking-tight text-ink">계획</span>
        <button
          type="button"
          onClick={closePlanTile}
          className={`${ICON_BTN} ml-auto`}
          title="계획 패널 닫기"
          aria-label="계획 패널 닫기"
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      {/* 본문 — 계획 마크다운 또는 빈 상태 */}
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-3">
        {state.planContent ? (
          <div className="text-[13px] text-ink">
            <Markdown source={state.planContent} />
          </div>
        ) : (
          <div className="m-auto flex max-w-[240px] flex-col items-center gap-2 text-center">
            <Icon name="board" size={28} style={{ color: 'var(--color-ink3)' }} />
            <p className="text-[13px] font-medium text-ink2">아직 플랜이 없습니다</p>
            <p className="text-[12px] text-ink3">
              Claude 가 탐색하며 계획을 세우면 여기에 표시됩니다.
            </p>
          </div>
        )}
      </div>

      {/* 액션바 — 검토 게이트가 열려 있을 때만 (승인/수정/거부) */}
      {review && (
        <div
          className="shrink-0 border-t border-border bg-panel px-4 py-3"
          data-behavior="interactive"
        >
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-out"
            style={{ gridTemplateRows: reviseOpen ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="수정 제안 내용을 입력하세요…"
                rows={3}
                aria-label="수정 제안 내용"
                className="mb-2 w-full resize-y rounded-[10px] border border-border bg-bg px-3 py-1.5 text-[13px] text-ink placeholder:text-ink3 focus:border-border-strong focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => approvePlan(review.requestId)}
              className="cursor-pointer rounded-lg border-0 bg-rust px-3.5 py-1.5 text-[13px] font-medium text-white"
              data-behavior="action:send"
            >
              승인 및 실행
            </button>
            {reviseOpen ? (
              <button
                type="button"
                onClick={() => revisePlan(review.requestId, feedback)}
                disabled={!canRevise}
                className="cursor-pointer rounded-lg border border-border bg-bg px-3 py-1.5 text-[13px] text-ink2 hover:bg-sidebar disabled:cursor-not-allowed disabled:opacity-40"
                title={canRevise ? undefined : '수정 제안 내용을 먼저 입력하세요'}
              >
                수정 요청 보내기
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setReviseOpen(true)}
                className="cursor-pointer rounded-lg border border-border bg-bg px-3 py-1.5 text-[13px] text-ink2 hover:bg-sidebar"
              >
                수정 제안
              </button>
            )}
            <button
              type="button"
              onClick={() => rejectPlan(review.requestId)}
              className="ml-auto cursor-pointer rounded-lg border border-border bg-transparent px-3 py-1.5 text-[13px] text-ink2 hover:bg-sidebar"
              data-behavior="dismissible"
            >
              거부
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
