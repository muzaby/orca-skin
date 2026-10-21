import type { Backend } from '../../../../../../shared/ipc'
import type { ComposerModule } from '../contracts'
import { composerModule as claude } from '../claude/composer/Module'
import { composerModule as opencode } from '../opencode/composer/Module'
import { createElement } from 'react'
import { HarnessLogo } from './brand'
import { OrcaLogo } from '../../../../shared/ui/OrcaLogo'
import { Icon } from '../../../../shared/ui/Icon'
function sourceIcon(backend: Backend): ComposerModule['sourceIcon'] {
  return function renderSourceIcon(source) {
    if (source === 'agents') return createElement(Icon, { name: 'folder', size: 14 })
    const sourceBackend = source.endsWith(':claude')
      ? 'claude'
      : source.endsWith(':opencode')
        ? 'opencode'
        : backend
    return source === 'orca'
      ? createElement(OrcaLogo, { className: 'h-3.5 w-4 shrink-0' })
      : createElement(HarnessLogo, {
          backend: sourceBackend,
          className: `size-3.5 shrink-0 ${sourceBackend === 'claude' ? 'text-spinner' : 'text-oc-ink'}`
        })
  }
}
const modules = {
  claude: { ...claude, sourceIcon: sourceIcon('claude') },
  opencode: { ...opencode, sourceIcon: sourceIcon('opencode') }
} satisfies Record<Backend, ComposerModule>
export function composerHarness(backend: Backend | null | undefined): ComposerModule {
  return modules[backend ?? 'claude']
}
