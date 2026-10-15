import type { ComposerControlProps, ComposerModule } from '../../contracts'
import { composerAppearance } from './appearance'
import { ComposerChip } from '../../common/composer/ComposerChip'
import { SubmitButton } from './SubmitButton'
import { agentPresentation } from '../presentation'
import { ClaudeConversationStatus } from './ConversationStatus'
import { ClaudeModeControl, ClaudeEffortControl } from './Controls'
import { AskUserQuestionCard } from './QuestionCard'
import { ToolApprovalBody } from './ToolApproval'
import { chatActions, useChatSession } from '../../../store/chatStore'
function Requests(): React.JSX.Element {
  const ask = useChatSession((s) => s.pendingAsks[0])
  const approvals = useChatSession((s) => s.pendingToolApprovals)
  return (
    <>
      {ask && (
        <AskUserQuestionCard
          key={ask.requestId}
          ask={ask}
          onSubmit={(answers, response) => chatActions.answerAsk(ask.requestId, answers, response)}
          onSkip={() => chatActions.skipAsk(ask.requestId)}
        />
      )}{' '}
      {approvals.map((p) => (
        <ToolApprovalBody key={p.approvalId} {...p} />
      ))}
    </>
  )
}
export const composerModule: ComposerModule = {
  appearance: composerAppearance,
  includeExtensions: true,
  controlsPlacement: 'split',
  harness: 'claude',
  placeholder: (kind) => agentPresentation[kind].placeholder,
  Chip: ComposerChip,
  SubmitButton,
  landingContextBelow: false,
  Status: ClaudeConversationStatus,
  Requests,
  AboveInput: () => null,
  inputBlocked: () => false,
  ModeControl: ({ model }: ComposerControlProps) => <ClaudeModeControl model={model} />,
  EffortControl: ({ modelFamily }: ComposerControlProps) => (
    <ClaudeEffortControl modelFamily={modelFamily} />
  )
}
