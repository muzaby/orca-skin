import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Message } from '../reducer/chatReducer'

// transcript 스크롤 제어 — CSS 예약공간(min-h-[50cqh]) 기반 앵커 + 로그 뷰어 pin
// (rendering.md §1.8, 0008). 스트리밍 델타 프레임에는 어떤 JS 도 실행하지 않는다:
//   · 전송 시: 마지막 교환에 예약공간이 켜진 뒤(같은 커밋) 바닥으로 smooth 1회 스크롤 —
//     스크롤 바닥 = user 버블 미드라인(50cqh)이 CSS 로 보장된다. 측정/2단 rAF 불요.
//   · fill 단계: 콘텐츠가 예약공간 내부를 채우는 동안 scrollHeight 불변 → 스크롤 정지.
//   · 초과 단계: 콘텐츠 wrapper 의 ResizeObserver 가 pinned+inflight 일 때만 바닥 추적.
//   · 예약 회수: 없음(다음 메시지까지 유지) — 새 전송에서 이전 교환이 "마지막"에서 벗어나며
//     같은 레이아웃 flush 의 새 예약+앵커 스크롤에 가려 무점프로 해제된다.

interface UseScrollAnchorArgs {
  messages: Message[]
  sessionId: string | null
  // 라이브 전송 카운터(reducer sendCount) — 메시지 휴리스틱 없이 SEND 만 정확히 감지.
  sendCount: number
  inflight: boolean
}

export interface ScrollAnchor {
  scrollRef: React.RefObject<HTMLDivElement | null>
  // ResizeObserver 대상(스크롤 콘텐츠 wrapper = ReadingColumn).
  contentRef: React.RefObject<HTMLDivElement | null>
  onScroll: () => void
  showJump: boolean
  scrollToBottom: () => void
  // 마지막 교환에 예약공간(min-height)을 적용할지 — 라이브 전송 후 세션 전환 전까지 true.
  anchored: boolean
}

const isAtBottom = (el: HTMLDivElement): boolean =>
  el.scrollHeight - el.scrollTop - el.clientHeight < 24

export function useScrollAnchor({
  messages,
  sessionId,
  sendCount,
  inflight
}: UseScrollAnchorArgs): ScrollAnchor {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  // auto-scroll pin (§1.8 ⑤ — 로그 뷰어 패턴). 맨 아래에 붙어 있을 때만 스트리밍을 따라
  // 내려간다. 사용자가 위로 올리면 해제 → 과거 대화 고정 + "맨 아래로" 버튼.
  const pinnedRef = useRef(true)
  const inflightRef = useRef(inflight)
  const [showJump, setShowJump] = useState(false)
  const [anchored, setAnchored] = useState(false)
  // 프로그래매틱 smooth 스크롤 진행 중 플래그 — 중간 프레임의 "맨 아래로" 버튼 깜빡임 억제.
  // scrollend(Chromium) 가 해제한다.
  const programmaticRef = useRef(false)

  useEffect(() => {
    inflightRef.current = inflight
  }, [inflight])

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
      setShowJump(!programmaticRef.current && !atBottom && el.scrollHeight > el.clientHeight + 24)
    })
  }, [])

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current)
    }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onEnd = (): void => {
      programmaticRef.current = false
    }
    el.addEventListener('scrollend', onEnd)
    return () => el.removeEventListener('scrollend', onEnd)
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    pinnedRef.current = true
    setShowJump(false)
  }, [])

  // 초과 단계 바닥 추적 — 스트리밍이 예약공간을 넘겨 콘텐츠가 자랄 때만 동작한다(fill 단계는
  // 높이 불변이라 발화 자체가 없다). idle 중 성장(ToolCard 펼침·shiki 교체)은 inflight 게이트로
  // 무시 — 네이티브 scroll anchoring 과 싸우지 않는다.
  useEffect(() => {
    const content = contentRef.current
    const el = scrollRef.current
    if (!content || !el) return
    const ro = new ResizeObserver(() => {
      if (!pinnedRef.current || !inflightRef.current) return
      el.scrollTop = el.scrollHeight
    })
    ro.observe(content)
    return () => ro.disconnect()
  }, [])

  // 전송 앵커 / 세션 전환 처리. 델타와 무관한 deps — 스트리밍 중에는 실행되지 않는다.
  const prevSendRef = useRef(sendCount)
  const prevSessionRef = useRef(sessionId)
  const prevMessagesRef = useRef<Message[] | null>(null)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const sentNow = sendCount > prevSendRef.current
    const messagesReplaced = messages !== prevMessagesRef.current
    // 세션 전환 = sessionId 변화 + messages 교체 동시. session.updated 의 null→id 발급은
    // messages 를 건드리지 않으므로 전환으로 보지 않는다(턴 중 예약 해제 방지).
    const sessionSwapped = sessionId !== prevSessionRef.current && messagesReplaced
    prevSendRef.current = sendCount
    prevSessionRef.current = sessionId
    prevMessagesRef.current = messages

    if (sentNow) {
      // 새 user 메시지 — 마지막 교환의 예약공간(min-h-[50cqh])이 이 커밋의 레이아웃에 이미
      // 반영돼 있어, 바닥 = 버블 미드라인. smooth 로 끌어올린다.
      setAnchored(true)
      pinnedRef.current = true
      setShowJump(false)
      if (el.scrollHeight - el.clientHeight - el.scrollTop > 1) {
        programmaticRef.current = true
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      }
      return
    }
    if (sessionSwapped) setAnchored(false)
    if (messagesReplaced && !inflightRef.current && pinnedRef.current) {
      // 세션 로드/캐시 복원/초기 마운트 — 대화 끝에서 시작(즉시). 턴 중 커밋 성장은
      // ResizeObserver 가 담당하므로 여기서 다루지 않는다.
      el.scrollTop = el.scrollHeight
      setShowJump(false)
    }
  }, [messages, sessionId, sendCount])

  return { scrollRef, contentRef, onScroll, showJump, scrollToBottom, anchored }
}
