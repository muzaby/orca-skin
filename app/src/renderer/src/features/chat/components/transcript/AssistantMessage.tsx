import { memo } from 'react'
import { AssistantMessage as MessageBody } from '../../harnesses/common/transcript/AssistantMessage'
import { TranscriptRuntimeProvider } from '../../harnesses/common/transcript/TranscriptRuntime'
import { assistantRuntime } from '../../harnesses/registries/assistant'
import type { Message } from '../../reducer/chatReducer'
import type { AgentTranscriptPresentation } from '../../harnesses/contracts'
export const AssistantMessage = memo(function AssistantMessage(props: {
  message: Message
  transcriptPolicy: AgentTranscriptPresentation
}): React.JSX.Element {
  const runtime = assistantRuntime(props.transcriptPolicy.surface)
  return (
    <TranscriptRuntimeProvider value={runtime}>
      <MessageBody {...props} />
    </TranscriptRuntimeProvider>
  )
})
