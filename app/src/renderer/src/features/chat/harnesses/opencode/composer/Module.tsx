import type { ComposerControlProps, ComposerModule } from '../../contracts'
import { composerAppearance } from './appearance'
import { ComposerChip } from './Chip'
import { SubmitButton } from './SubmitButton'
import { OpenCodeAgentControl, OpenCodeVariantControl } from './Controls'
import { selectOpenCodeRequest } from './requestQueue'
import { modelKey } from '../../../components/composer/modelSelection'
import { AboveInput } from './AboveInput'
export const composerModule: ComposerModule = {
  appearance: composerAppearance,
  includeExtensions: false,
  controlsPlacement: 'end',
  harness: 'opencode',
  placeholder: () => 'harness.promptPlaceholder',
  label: 'OpenCode',
  Chip: ComposerChip,
  SubmitButton,
  landingContextBelow: true,
  Status: () => null,
  Requests: () => null,
  AboveInput,
  inputBlocked: (state) => !!selectOpenCodeRequest(state),
  ModeControl: ({ agents, providerKey }: ComposerControlProps) => (
    <OpenCodeAgentControl agents={agents.find((a) => a.key === providerKey)?.agents} />
  ),
  EffortControl: ({ agents, providerKey, modelFamily }: ComposerControlProps) => (
    <OpenCodeVariantControl
      variants={
        agents
          .find((a) => a.key === providerKey)
          ?.models.find((model) => modelKey(model) === modelFamily)?.variants ?? []
      }
    />
  )
}
