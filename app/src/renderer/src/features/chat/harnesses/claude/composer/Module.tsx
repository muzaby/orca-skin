import type { ComposerControlProps, ComposerModule } from '../../contracts'
import { composerAppearance } from './appearance'
import { ComposerChip } from '../../common/composer/ComposerChip'
import { SubmitButton } from './SubmitButton'
import { agentPresentation } from '../presentation'
import { ClaudeConversationStatus } from './ConversationStatus'
import { ClaudeModeControl, ClaudeEffortControl } from './Controls'
import { Requests } from './Requests'
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
