import { writeScrollTop } from '../../../components/transcript/TranscriptViewport'
import type { ScrollAnchor } from '../../common/transcript/scrollTypes'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Message } from '../../../reducer/chatReducer'
import { CLAUDE_PIN_POLICY, pinPolicy } from '../../../lib/transcript/viewport/pin'
import { entryPolicy } from '../../../lib/transcript/viewport/entry'
import { consumeEntryIntent } from '../../../store/chatStore'

const claudePin = pinPolicy(CLAUDE_PIN_POLICY)

interface UseScrollAnchorArgs {
  messages: Message[]
  sessionId: string | null
  // 라이브 전송 카운터(reducer sendCount) — 메시지 휴리스틱 없이 SEND 만 정확히 감지.
  sendCount: number
  inflight: boolean
}

export function useScrollAnchor({
  messages,
  sessionId,
  sendCount,
  inflight
}: UseScrollAnchorArgs): ScrollAnchor {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)
  const inflightRef = useRef(inflight)
  const [showJump, setShowJump] = useState(false)
  const [anchored, setAnchored] = useState(false)
  const programmaticRef = useRef(false)

  useEffect(() => {
    inflightRef.current = inflight
  }, [inflight])

  const scrollRafRef = useRef<number | null>(null)
  const onScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null
      const el = scrollRef.current
      if (!el) return
      const next = claudePin.onScroll({
        scrollTop: el.scrollTop,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight
      })
      pinnedRef.current = next.pinned
      setShowJump(
        !programmaticRef.current && !next.pinned && el.scrollHeight > el.clientHeight + 24
      )
    })
  }, [])

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current)
    }
  }, [])

  // EP-11 ① (p9): Upward wheel/key unpins immediately even when scroll event does not fire (short latest turn).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onEnd = (): void => {
      programmaticRef.current = false
    }
    const onWheel = (e: WheelEvent): void => {
      const next = claudePin.onUserInput(
        { pinned: pinnedRef.current },
        { type: 'wheel', deltaY: e.deltaY }
      )
      pinnedRef.current = next.pinned
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      const next = claudePin.onUserInput({ pinned: pinnedRef.current }, { type: 'key', key: e.key })
      pinnedRef.current = next.pinned
    }
    el.addEventListener('scrollend', onEnd)
    el.addEventListener('wheel', onWheel, { passive: true })
    el.addEventListener('keydown', onKeyDown)
    return () => {
      el.removeEventListener('scrollend', onEnd)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    writeScrollTop(el, el.scrollHeight)
    pinnedRef.current = true
    setShowJump(false)
  }, [])

  useEffect(() => {
    const content = contentRef.current
    const el = scrollRef.current
    if (!content || !el) return
    const ro = new ResizeObserver(() => {
      if (!claudePin.shouldFollowGrowth({ pinned: pinnedRef.current }, inflightRef.current)) return
      writeScrollTop(el, el.scrollHeight)
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
        writeScrollTop(el, el.scrollHeight, 'smooth')
      }
      return
    }
    if (sessionSwapped) setAnchored(false)
    const intent = sessionId ? consumeEntryIntent(sessionId) : null
    if (intent) {
      const placement = entryPolicy(intent.cause, 'claude')
      if (placement.action === 'scroll-bottom') {
        pinnedRef.current = true
        writeScrollTop(el, el.scrollHeight)
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sync jump button with layout scroll-bottom placement
        setShowJump(false)
        return
      }
    }
    if (messagesReplaced && !inflightRef.current && pinnedRef.current) {
      writeScrollTop(el, el.scrollHeight)
      setShowJump(false)
    }
  }, [messages, sessionId, sendCount])

  return { scrollRef, contentRef, onScroll, showJump, scrollToBottom, anchored }
}
