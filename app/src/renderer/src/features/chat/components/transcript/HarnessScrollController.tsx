import { useLayoutEffect, type ReactNode } from 'react'
import type { Backend } from '../../../../../../shared/ipc'
import type { Message } from '../../reducer/chatReducer'
import { useScrollAnchor, type ScrollAnchor } from '../../hooks/useScrollAnchor'
import { OpenCodeScrollController } from '../../harnesses/opencode/transcript/ScrollController'

interface Props {
  backend: Backend | null
  sessionKey: string
  sessionId: string | null
  messages: Message[]
  sendCount: number
  inflight: boolean
  onControls?: (controls: ScrollControls) => void
  children: (scroll: ScrollAnchor) => ReactNode
}
export type ScrollControls = Pick<ScrollAnchor, 'showJump' | 'scrollToBottom'>
function ScrollControlsPublisher({
  scroll,
  onControls
}: {
  scroll: ScrollAnchor
  onControls?: Props['onControls']
}): null {
  useLayoutEffect(() => {
    onControls?.({ showJump: scroll.showJump, scrollToBottom: scroll.scrollToBottom })
  }, [onControls, scroll.showJump, scroll.scrollToBottom])
  return null
}
function ClaudeScrollController({ children, onControls, ...props }: Props): React.JSX.Element {
  const scroll = useScrollAnchor(props)
  return (
    <>
      <ScrollControlsPublisher scroll={scroll} onControls={onControls} />
      {children(scroll)}
    </>
  )
}
export function HarnessScrollController(props: Props): React.JSX.Element {
  return props.backend === 'opencode' ? (
    <OpenCodeScrollController key={props.sessionKey} sessionKey={props.sessionKey}>
      {(scroll) => (
        <>
          <ScrollControlsPublisher scroll={scroll} onControls={props.onControls} />
          {props.children(scroll)}
        </>
      )}
    </OpenCodeScrollController>
  ) : (
    <ClaudeScrollController {...props} />
  )
}
