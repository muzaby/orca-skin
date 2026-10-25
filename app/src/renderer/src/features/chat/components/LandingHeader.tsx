import type { Backend } from '../../../../../shared/ipc'
import { harnessLanding } from '../harnesses/registries/landing'

export function LandingHeader({
  backend,
  framed = false
}: {
  backend: Backend | null
  framed?: boolean
}): React.JSX.Element {
  const Header = harnessLanding(backend).Header
  return <Header framed={framed} />
}
