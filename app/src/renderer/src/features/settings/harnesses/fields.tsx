import type { Backend } from '../../../../../shared/ipc'
import { OpenCodeFields, OpenCodeDescription } from './opencode/Fields'
export function HarnessFields({
  backend,
  ...props
}: {
  backend: Backend
  executablePath: string
  setExecutablePath: (value: string) => void
}): React.JSX.Element | null {
  return backend === 'opencode' ? <OpenCodeFields {...props} /> : null
}
export function HarnessDescription({ backend }: { backend: Backend }): React.JSX.Element | null {
  return backend === 'opencode' ? <OpenCodeDescription /> : null
}
