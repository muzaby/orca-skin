import type { Backend } from '../../../../../../shared/ipc'
import { ClaudeSpinner } from '../claude/Spinner'
import { OpenCodeSpinner } from '../opencode/Spinner'
const spinners = { claude: ClaudeSpinner, opencode: OpenCodeSpinner } satisfies Record<
  Backend,
  React.ComponentType
>
export function statusSpinner(backend: Backend | null | undefined): React.ComponentType {
  return spinners[backend ?? 'claude']
}
export function statusStreamingLabel(
  backend: Backend | null | undefined
): 'chat.activity.thinking' | undefined {
  return backend === 'opencode' ? 'chat.activity.thinking' : undefined
}
