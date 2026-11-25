import { useHistoryControls } from '../../hooks/useHistoryControls'
import { useActiveSessionKey, useChatStore } from '../../store/chatStore'
import { TranscriptRuntimeProvider } from '../../harnesses/common/transcript/TranscriptRuntime'
import { assistantRuntime } from '../../harnesses/registries/assistant'
import { memo } from 'react'
import { transcriptHarness } from '../../harnesses/registries/transcript'
import type { TranscriptViewProps } from '../../harnesses/contracts'
import { useAutomaticFeedVisibility } from '../../store/automaticFeedDebug'
export type { TranscriptViewProps } from '../../harnesses/contracts'
const transcriptTextScaleClassName = '[--transcript-text-scale:var(--chat-text-scale,1)]'
export const TranscriptView = memo(function TranscriptView(
  props: TranscriptViewProps
): React.JSX.Element {
  const key = useActiveSessionKey()
  const selection = useChatStore((s) => s.sessions?.[key]?.search)
  const view = selection?.view
  const history = useHistoryControls(key)
  const { Timeline } = transcriptHarness(props.backend)
  const showAutomaticFeeds = useAutomaticFeedVisibility()
  return (
    <TranscriptRuntimeProvider value={assistantRuntime(props.backend)}>
      <Timeline
        {...props}
        history={props.history ?? history}
        search={selection}
        messages={view?.messages ?? props.messages}
        inflight={view ? false : props.inflight}
        pendingSteer={view ? [] : props.pendingSteer}
        anchored={view ? false : props.anchored}
        isPinned={view ? () => false : props.isPinned}
        textScaleClassName={transcriptTextScaleClassName}
        showAutomaticFeeds={showAutomaticFeeds}
      />
    </TranscriptRuntimeProvider>
  )
})
