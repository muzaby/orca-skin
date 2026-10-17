import { useLayoutEffect } from 'react'
import type { Backend } from '../../../../../../shared/ipc'
import { transcriptHarness } from '../../harnesses/registries/transcript'
import type {
  ScrollAnchor,
  ScrollControls,
  ScrollControllerProps
} from '../../harnesses/common/transcript/scrollTypes'

export type { ScrollControls } from '../../harnesses/common/transcript/scrollTypes'
interface Props extends ScrollControllerProps {
  backend: Backend | null
  onControls?: (controls: ScrollControls) => void
}
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
export function HarnessScrollController(props: Props): React.JSX.Element {
  const { ScrollController, remountScrollBySession } = transcriptHarness(props.backend)
  return (
    <ScrollController {...props} key={remountScrollBySession ? props.sessionKey : undefined}>
      {(scroll) => (
        <>
          <ScrollControlsPublisher scroll={scroll} onControls={props.onControls} />
          {props.children(scroll)}
        </>
      )}
    </ScrollController>
  )
}
