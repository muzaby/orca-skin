import type { ComposerModule } from '../../contracts'
import { composerAppearance } from './appearance'
import { ComposerChip } from './Chip'
import { SubmitButton } from './SubmitButton'
import { OpenCodeModeControl, OpenCodeEffortControl } from './Controls'
import { selectOpenCodeRequest } from './requestQueue'
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
  ModeControl: OpenCodeModeControl,
  EffortControl: OpenCodeEffortControl
}
