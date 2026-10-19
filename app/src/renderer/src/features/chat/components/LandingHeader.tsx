import type { Backend } from '../../../../../shared/ipc'
import { harnessLanding } from '../harnesses/registries/landing'

export function LandingHeader({ backend }: { backend: Backend | null }): React.JSX.Element {
  const Header = harnessLanding(backend).Header
  return <Header />
}
