import type { Backend } from '../../../../shared/ipc'
import { ClaudeLogo } from './ClaudeLogo'
import { OpenCodeLogo } from './OpenCodeLogo'

export function HarnessLogo({ backend, className = '', tone }: {
  backend: Backend
  className?: string
  tone?: string
}): React.JSX.Element {
  const color = tone ?? (backend === 'claude' ? 'text-spinner' : 'text-oc-ink')
  const classes = [className, color].filter(Boolean).join(' ')
  return backend === 'claude' ? <ClaudeLogo className={classes} /> : <OpenCodeLogo className={classes} />
}
