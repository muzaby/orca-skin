import { SubmitButton as ClaudeSubmitButton } from './claude/composer/SubmitButton'
import { SubmitButton as OpenCodeSubmitButton } from './opencode/composer/SubmitButton'
import type { ComposerSubmitProps } from './types'
export function HarnessSubmitButton({
  openCode,
  ...props
}: ComposerSubmitProps & { openCode: boolean }): React.JSX.Element {
  return openCode ? <OpenCodeSubmitButton {...props} /> : <ClaudeSubmitButton {...props} />
}
