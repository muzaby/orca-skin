import type { ComponentProps } from 'react'
import type { Backend } from '../../../../../shared/ipc'
import { harnessLanding } from '../harnesses/registries/landing'
import { landingFrame } from './landingFrame'
import { Composer } from './Composer'
import { LandingHeader } from './LandingHeader'

export function Landing({
  backend,
  composerProps
}: {
  backend: Backend | null
  composerProps: ComponentProps<typeof Composer>
}): React.JSX.Element {
  const presentation = harnessLanding(backend)
  return (
    <section
      className={landingFrame.root}
      data-surface="new-chat-landing"
      data-harness={backend ?? 'claude'}
    >
      <div className={landingFrame.align}>
        <div className={landingFrame.column}>
          <div className={landingFrame.hero} data-surface="landing-hero-slot">
            <LandingHeader backend={backend} framed />
          </div>
          <Composer {...composerProps} showLandingCwdPanel {...presentation.composer} />
        </div>
      </div>
    </section>
  )
}
