import { useCallback, useEffect, useRef } from 'react'
import { Icon } from '../../../shared/ui/Icon'
import { Dot } from '../../../shared/ui/Status'
import { useDragResize } from '../../../shared/hooks/useDragResize'
import { AssistantMessage } from './transcript/AssistantMessage'
import { UserMessage } from './transcript/UserMessage'
import { PendingAssistant } from './transcript/PendingAssistant'
import { Composer } from './Composer'
import { PlanTile } from './PlanTile'
import { PLAN_TILE_MIN_WIDTH, PLAN_TILE_MAX_WIDTH } from '../reducer/chatReducer'
import type { UseChat } from '../hooks/useChat'

const ICON_BTN =
  'grid h-7 w-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-ink2'

interface ChatTileProps {
  chat: UseChat
  backendLabel: string
}

export function ChatTile({ chat, backendLabel }: ChatTileProps): React.JSX.Element {
  const { state } = chat
  const scrollRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [state.messages, state.pendingDelta])

  // 우측 계획 타일은 행의 오른쪽 끝에 도킹 — 커서를 왼쪽으로 끌수록 폭이 커지므로 invert.
  const getRowRight = useCallback(
    (): number => rowRef.current?.getBoundingClientRect().right ?? 0,
    []
  )
  const { startResize } = useDragResize({
    getOrigin: getRowRight,
    min: PLAN_TILE_MIN_WIDTH,
    max: PLAN_TILE_MAX_WIDTH,
    invert: true,
    onChange: chat.setPlanTileWidth
  })

  const isEmpty = state.messages.length === 0 && state.pendingDelta === '' && !state.loadingSession
  // 사이드바 메타 (state.title) 가 즉시 채워지므로 사용자가 세션을 선택한 순간부터
  // 헤더에 정확한 제목 표시. 메타가 없는 부팅 자동 복원 1회만 첫 user 메시지에서 fallback.
  const title =
    state.title?.trim() ||
    state.messages.find((m) => m.role === 'user')?.content.slice(0, 60) ||
    '새 대화'

  const showPendingAssistant = state.inflight

  return (
    <section className="app-frame-pane-host flex min-h-0 min-w-0 flex-1 flex-col bg-bg">
      <div ref={rowRef} className="app-frame-pane-row relative flex min-h-0 flex-1">
        <div className="app-frame-tile flex min-w-0 flex-1 flex-col" data-behavior="resizable">
          <div className="app-frame-titlebar flex items-center gap-3 border-b border-border px-6 pb-2.5 pt-3.5">
            <div className="min-w-0 flex-1">
              <div className="overflow-hidden text-ellipsis whitespace-nowrap font-serif text-[17px] font-semibold tracking-tight text-ink">
                {title}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink3">
                <span className="inline-flex items-center gap-1">
                  <Dot tone="green" /> {backendLabel}
                </span>
                {state.sessionId && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-[10.5px]">{state.sessionId.slice(0, 8)}</span>
                  </>
                )}
              </div>
            </div>
            <div className="ml-auto flex gap-1">
              <button className={ICON_BTN} title="검색">
                <Icon name="search" size={14} />
              </button>
              <button className={ICON_BTN} title="복사">
                <Icon name="copy" size={14} />
              </button>
              <button className={ICON_BTN} title="설정">
                <Icon name="settings" size={14} />
              </button>
              <button
                type="button"
                onClick={chat.togglePlanTile}
                aria-pressed={state.planTileOpen}
                className={`${ICON_BTN} ${state.planTileOpen ? 'text-rust' : ''}`}
                title="계획 패널"
              >
                <Icon name="panelR" size={14} />
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="app-frame-transcript flex flex-1 flex-col gap-[22px] overflow-auto px-6 py-5"
            data-behavior="virtualizable"
          >
            {state.loadingSession && (
              <div className="m-auto text-center text-[13px] text-ink3">대화 불러오는 중…</div>
            )}
            {isEmpty && (
              <div className="m-auto text-center text-[13px] text-ink3">
                Claude Code 에 첫 메시지를 보내보세요.
              </div>
            )}
            {state.messages.map((m, i) =>
              m.role === 'user' ? (
                <UserMessage key={i} message={m} />
              ) : (
                <AssistantMessage key={i} message={m} />
              )
            )}
            {showPendingAssistant && (
              <PendingAssistant
                turnStartedAt={state.turnStartedAt}
                pendingDelta={state.pendingDelta}
              />
            )}
            {state.error && (
              <div className="rounded-[10px] border border-rust bg-rust-soft px-3 py-2 text-[12.5px] text-ink">
                <div className="font-semibold">에러: {state.error.code}</div>
                <div className="mt-1 text-ink2">{state.error.message}</div>
              </div>
            )}
          </div>

          <Composer chat={chat} backendLabel={backendLabel} />
        </div>

        {state.planTileOpen && (
          <>
            <div
              className="app-frame-tile-separator w-1 shrink-0 cursor-col-resize bg-border hover:bg-border-strong"
              data-behavior="resizable"
              data-axis="vertical"
              data-context="tile"
              data-state="visible"
              onMouseDown={startResize}
              aria-label="Resize plan panel"
            />
            <div
              className="app-frame-tile flex shrink-0 flex-col"
              style={{ width: state.planTileWidth }}
              data-context="plan"
            >
              <PlanTile key={state.pendingPlanReview?.requestId ?? 'resolved'} chat={chat} />
            </div>
          </>
        )}
      </div>
    </section>
  )
}
