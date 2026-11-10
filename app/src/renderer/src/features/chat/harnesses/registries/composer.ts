import { createElement } from 'react'
import type { Backend } from '../../../../../../shared/ipc'
import { HarnessLogo } from '../../../../shared/ui/HarnessLogo'
import { Icon } from '../../../../shared/ui/Icon'
import { OoLogo } from '../../../../shared/ui/OoLogo'
import { composerModule as claude } from '../claude/composer/Module'
import type { ComposerModule } from '../contracts'
import { composerModule as opencode } from '../opencode/composer/Module'
function sourceIcon(backend: Backend): ComposerModule['sourceIcon'] {
  return function renderSourceIcon(source) {
    if (source === 'agents') return createElement(Icon, { name: 'folder', size: 14 })
    const sourceBackend = source.endsWith(':claude')
      ? 'claude'
      : source.endsWith(':opencode')
        ? 'opencode'
        : backend
    return source === 'orcinus-orca'
      ? createElement(OoLogo, { className: 'h-3.5 w-auto shrink-0' })
      : createElement(HarnessLogo, {
          backend: sourceBackend,
          className: 'size-3.5 shrink-0'
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
