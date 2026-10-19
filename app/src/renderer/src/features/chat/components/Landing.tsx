import type { ComponentProps } from 'react'
import type { Backend } from '../../../../../shared/ipc'
import { harnessLanding } from '../harnesses/registries/landing'
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
      className={`flex min-h-0 min-w-0 flex-1 bg-bg ${presentation.root}`}
      data-surface="new-chat-landing"
      data-harness={backend ?? 'claude'}
    >
      <div className={`flex min-w-0 flex-1 justify-center ${presentation.align}`}>
        <div className={`w-full max-w-[720px] ${presentation.column}`}>
          <LandingHeader backend={backend} />
          <Composer {...composerProps} showLandingCwdPanel {...presentation.composer} />
        </div>
      </div>
    </section>
  )
}
