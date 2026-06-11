import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../../../shared/ui/Icon'
import { Button } from '../../../shared/ui/Button'
import { Dot } from '../../../shared/ui/Status'
import { ReadingColumn } from '../../../shared/ui/ReadingColumn'
import { useDragResize } from '../../../shared/hooks/useDragResize'
import { AssistantTurn } from './transcript/AssistantTurn'
import { UserTurn } from './transcript/UserTurn'
import { PendingAssistant } from './transcript/PendingAssistant'
import { groupTurns } from '../lib/turns'
import { partsText } from '../lib/parts'
import { Composer } from './Composer'
import { PlanTile } from './PlanTile'
import { PLAN_TILE_MIN_WIDTH, PLAN_TILE_MAX_WIDTH } from '../reducer/chatReducer'
import { errorCategoryLabel } from '../lib/errorLabels'
import type { UseChat } from '../hooks/useChat'

const ICON_BTN =
  'grid h-7 w-7 cursor-default place-items-center rounded-r4 border-0 bg-transparent text-t6 outline-none hide-focus-ring ring-focus transition-colors hover:bg-fill-uncontained-hover hover:text-t7'

interface ChatTileProps {
  chat: UseChat
  backendLabel: string
  // 활성 백엔드의 중단 지원 여부(§15). page → ChatView 를 거쳐 Composer 로 전달.
  canAbort: boolean
  costToday?: string
}

export function ChatTile({
  chat,
  backendLabel,
  canAbort,
  costToday
}: ChatTileProps): React.JSX.Element {
  const { state } = chat
  const scrollRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)

  // auto-scroll pin (rendering.md §1.8 ⑤ — 로그 뷰어 패턴). 맨 아래에 붙어 있을 때만
  // 스트리밍을 따라 내려간다. 사용자가 위로 올리면 pin 해제 → 과거 대화 고정 + "맨 아래로" 버튼.
  const pinnedRef = useRef(true)
  const prevLenRef = useRef(state.messages.length)
  const prevSessionRef = useRef(state.sessionId)
  const [showJump, setShowJump] = useState(false)
  // 예약공간(ChatGPT식 앵커) — 새 user 메시지를 뷰포트 50% 라인까지 올릴 수 있도록 transcript 끝에
  // 둘 여백. React 상태가 아닌 DOM 직접 제어 — 같은 effect 안에서 높이 반영→scrollTo 를 동기로
  // 끝내 rAF/재렌더 대기를 없앤다 (rAF 는 창 occlusion 시 정지하고, 스트리밍 재렌더 부하에 밀려
  // 수백 ms 지연돼 앵커가 늦거나 아예 안 일어난다).
  const spacerRef = useRef<HTMLDivElement>(null)

  const isAtBottom = useCallback((el: HTMLDivElement): boolean => {
    return el.scrollHeight - el.scrollTop - el.clientHeight < 24
  }, [])

  // 최신 user 턴 버블의 스크롤 콘텐츠 상 top 위치(스크롤 컨테이너 기준, scrollTop 무관). 없으면 null.
  // offsetParent 가 불확실하므로 getBoundingClientRect 차이 + scrollTop 으로 견고하게 계산.
  const lastUserTop = useCallback((el: HTMLDivElement): number | null => {
    const nodes = el.querySelectorAll<HTMLElement>('[data-app-user-turn]')
    const last = nodes[nodes.length - 1]
    if (!last) return null
    return last.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop
  }, [])

  // 스크롤 이벤트는 rAF 로 스로틀 — pin 상태와 버튼 노출 여부만 갱신.
  const scrollRafRef = useRef<number | null>(null)
  const onScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null
      const el = scrollRef.current
      if (!el) return
      const atBottom = isAtBottom(el)
      pinnedRef.current = atBottom
      setShowJump(!atBottom && el.scrollHeight > el.clientHeight + 24)
    })
  }, [isAtBottom])

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current)
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    pinnedRef.current = true
    setShowJump(false)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    const spacer = spacerRef.current
    if (!el || !spacer) return
    const grew = state.messages.length > prevLenRef.current
    const lastIsUser = state.messages[state.messages.length - 1]?.role === 'user'
    const isNewUserMessage = grew && lastIsUser
    prevLenRef.current = state.messages.length

    // 세션 전환(LOAD_SESSION/_FROM_CACHE/NEW_CHAT) 시엔 앵커/예약공간 수학을 건너뛰고 여백을
    // 0 으로 수렴시킨다 — 로드된 옛 세션 하단에 직전 세션의 여백이 남지 않게. (새 대화 첫 메시지는
    // sessionId 가 session.updated 전까지 null 유지 → sessionChanged false → 앵커 경로 정상 실행.)
    const sessionChanged = state.sessionId !== prevSessionRef.current
    prevSessionRef.current = state.sessionId

    const top = lastUserTop(el)
    // 연속 수렴(B) — 예약공간을 inflight 게이트 없이 매 렌더 재계산한다. 최신 user 버블 top 부터
    // 콘텐츠 끝까지(belowTop)가 반 뷰포트보다 작으면 그만큼 여백 → 버블이 50% 라인에 머문다.
    // 답변이 그 아래를 채우면 belowTop 가 커져 needed 0 으로 자연 수렴(완료 시 스냅 회수 없음).
    const spacerH = spacer.offsetHeight
    let needed = 0
    if (!sessionChanged) {
      const realContentH = el.scrollHeight - spacerH // 현재 spacer 제외한 실제 콘텐츠 높이
      const belowTop = top != null ? realContentH - top : realContentH
      needed = Math.round(Math.max(0, 0.5 * el.clientHeight - belowTop))
    }
    // 서브픽셀 jitter 로 인한 레이아웃 루프 방지 — 1px 초과 변화만 반영.
    if (Math.abs(needed - spacerH) > 1) spacer.style.height = `${needed}px`

    if (!sessionChanged && isNewUserMessage && top != null) {
      // 사용자 버블을 뷰포트 50% 라인으로 smooth 앵커한다. 이미 미드라인보다 위에 있으면 그대로
      // 둔다(아래로 끌어내리지 않음). spacer 높이를 바로 위에서 동기 반영했으므로 scrollHeight 가
      // 이미 새 여백을 포함한다 — 목표 top 까지 클램프 없이 도달.
      pinnedRef.current = false
      const mid = 0.5 * el.clientHeight
      if (top - el.scrollTop > mid) {
        // 버블이 미드라인보다 아래일 때만 끌어올린다.
        const target = Math.min(Math.max(0, top - mid), el.scrollHeight - el.clientHeight)
        el.scrollTo({ top: target, behavior: 'smooth' })
      }
    } else if (pinnedRef.current) {
      el.scrollTop = el.scrollHeight
      setShowJump(false)
    }
  }, [state.messages, state.pendingDelta, state.inflight, state.sessionId, lastUserTop])

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

  // 델타 프레임(messages 참조 불변)에서 Turn 객체 identity 를 고정 — memo 된 턴 컴포넌트가
  // props 비교만으로 재렌더를 건너뛴다 (0007-transcript-render-memo).
  const turns = useMemo(() => groupTurns(state.messages), [state.messages])

  const isEmpty = state.messages.length === 0 && state.pendingDelta === '' && !state.loadingSession
  // 사이드바 메타 (state.title) 가 즉시 채워지므로 사용자가 세션을 선택한 순간부터
  // 헤더에 정확한 제목 표시. 메타가 없는 부팅 자동 복원 1회만 첫 user 메시지에서 fallback.
  const title =
    state.title?.trim() ||
    (() => {
      const u = state.messages.find((m) => m.role === 'user')
      return u ? partsText(u.parts).slice(0, 60) : ''
    })() ||
    '새 대화'

  const showPendingAssistant = state.inflight

  return (
    <section className="app-frame-pane-host flex min-h-0 min-w-0 flex-1 flex-col bg-bg">
      <div ref={rowRef} className="app-frame-pane-row relative flex min-h-0 flex-1">
        {/* Claude Code 룩: transcript 는 별도 카드 없이 bg 평면 위에 그대로 — 우측
            plan tile 만 보더 카드로 분리된다. */}
        <div
          className="app-frame-tile flex min-w-0 flex-1 flex-col overflow-hidden bg-bg"
          data-behavior="resizable"
        >
          <div className="app-frame-titlebar flex items-center gap-3 px-6 pb-2 pt-3">
            <div className="min-w-0 flex-1">
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium text-ink">
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
              <Button
                iconOnly
                size="small"
                leadingIcon="panelR"
                onClick={chat.togglePlanTile}
                pressed={state.planTileOpen}
                title="계획 패널"
                aria-label="계획 패널"
              />
            </div>
          </div>

          {/* 블록 흐름 유지 — flex 컨테이너로 만들면 ReadingColumn(flex-basis 0)이 콘텐츠와 함께
              자라지 않아 transcript 가 박스를 오버플로하고, 예약공간 spacer 가 콘텐츠와 겹쳐
              scrollHeight = 콘텐츠 + spacer 가정(아래 effect 의 realContentH)이 깨진다. */}
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="app-frame-transcript flex-1 overflow-auto py-5"
            data-behavior="virtualizable"
          >
            <ReadingColumn className="flex min-h-full flex-col gap-[var(--chat-turn-gap)]">
              {state.loadingSession && (
                <div className="m-auto text-center text-[13px] text-ink3">대화 불러오는 중…</div>
              )}
              {isEmpty && (
                <div className="m-auto text-center text-[13px] text-ink3">
                  Claude Code 에 첫 메시지를 보내보세요.
                </div>
              )}
              {turns.map((turn, ti, arr) =>
                turn.role === 'user' ? (
                  <UserTurn key={turn.startIndex} turn={turn} />
                ) : (
                  <AssistantTurn
                    key={turn.startIndex}
                    turn={turn}
                    // 마지막 턴이 에이전트이고 아직 inflight 면 메타 숨김(턴 종료 시 노출).
                    pending={state.inflight && ti === arr.length - 1}
                  />
                )
              )}
              {showPendingAssistant && (
                <PendingAssistant
                  turnStartedAt={state.turnStartedAt}
                  pendingDelta={state.pendingDelta}
                  pendingReasoning={state.pendingReasoning}
                />
              )}
              {state.error && (
                <div className="rounded-[10px] border border-rust bg-rust-soft px-3 py-2 text-[12.5px] text-ink">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      에러: {errorCategoryLabel(state.error.category)}
                    </span>
                    {state.error.retryable && (
                      <span className="rounded-full border border-border px-1.5 py-px text-[10.5px] text-ink3">
                        재시도 가능
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-ink2">{state.error.message}</div>
                  {state.error.retryable && (
                    <div className="mt-1 text-[11.5px] text-ink3">
                      일시적 오류일 수 있습니다. 다시 보내보세요.
                    </div>
                  )}
                </div>
              )}
            </ReadingColumn>
            {/* 예약공간 — 최신 user 버블을 50% 라인으로 앵커하기 위한 하단 여백(ChatGPT식).
                높이는 위 effect 가 DOM 으로 직접 제어한다. */}
            <div ref={spacerRef} aria-hidden />
          </div>

          <Composer
            chat={chat}
            backendLabel={backendLabel}
            canAbort={canAbort}
            showScrollToBottom={showJump}
            onScrollToBottom={scrollToBottom}
            costToday={costToday}
          />
        </div>

        {state.planTileOpen && (
          <>
            <div
              className="app-frame-tile-separator group/sep relative w-3 shrink-0 cursor-col-resize"
              data-behavior="resizable"
              data-axis="vertical"
              data-context="tile"
              data-state="visible"
              onMouseDown={startResize}
              aria-label="Resize plan panel"
            >
              <span
                aria-hidden
                className="absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border-strong opacity-0 transition-opacity duration-150 group-hover/sep:opacity-100"
              />
            </div>
            <div
              className="app-frame-tile my-2 mr-2 flex shrink-0 flex-col overflow-hidden rounded-r6 border border-border bg-panel"
              style={{ width: state.planTileWidth }}
              data-context="plan"
            >
              <PlanTile chat={chat} />
            </div>
          </>
        )}
      </div>
    </section>
  )
}
