import type { Backend } from '../../../../../../shared/ipc'
import { ClaudeLogo } from '../claude/Logo'
import { OpenCodeLogo } from '../opencode/Logo'

const brands = { claude: ClaudeLogo, opencode: OpenCodeLogo }
export function HarnessLogo({
  backend,
  className
}: {
  backend: Backend
  className?: string
}): React.JSX.Element {
  const Logo = brands[backend]
  return <Logo className={className} />
}
