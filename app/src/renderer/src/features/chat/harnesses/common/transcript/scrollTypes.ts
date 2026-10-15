import type { ReactNode } from 'react'
import type { Message } from '../../../reducer/chatReducer'

export interface ScrollAnchor {
  scrollRef: React.RefObject<HTMLDivElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
  onScroll: () => void
  showJump: boolean
  scrollToBottom: () => void
  anchored: boolean
}
export type ScrollControls = Pick<ScrollAnchor, 'showJump' | 'scrollToBottom'>
export interface ScrollControllerProps {
  sessionKey: string
  sessionId: string | null
  messages: Message[]
  sendCount: number
  inflight: boolean
  children: (scroll: ScrollAnchor) => ReactNode
}
