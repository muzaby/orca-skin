import { TranscriptRuntimeProvider } from '../../harnesses/common/transcript/TranscriptRuntime'
import { assistantRuntime } from '../../harnesses/registries/assistant'
import { memo } from 'react'
import { transcriptHarness } from '../../harnesses/registries/transcript'
import type { TranscriptViewProps } from '../../harnesses/contracts'
export type { TranscriptViewProps } from '../../harnesses/contracts'
const transcriptTextScaleClassName = '[--transcript-text-scale:var(--chat-text-scale,1)]'
export const TranscriptView = memo(function TranscriptView(
  props: TranscriptViewProps
): React.JSX.Element {
  const { Timeline } = transcriptHarness(props.backend)
  return (
    <TranscriptRuntimeProvider value={assistantRuntime(props.backend)}>
      <Timeline {...props} textScaleClassName={transcriptTextScaleClassName} />
    </TranscriptRuntimeProvider>
  )
})
