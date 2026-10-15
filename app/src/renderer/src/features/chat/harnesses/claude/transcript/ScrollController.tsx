import { useScrollAnchor } from './useScrollAnchor'
import type { ScrollControllerProps } from '../../common/transcript/scrollTypes'

export function ClaudeScrollController({
  children,
  ...props
}: ScrollControllerProps): React.JSX.Element {
  return <>{children(useScrollAnchor(props))}</>
}
