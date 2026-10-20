import type { Backend } from '../../../../../../shared/ipc'
import type { ComposerModule } from '../contracts'
import { composerModule as claude } from '../claude/composer/Module'
import { composerModule as opencode } from '../opencode/composer/Module'
import { createElement } from 'react'
import { HarnessLogo } from './brand'
import { OrcaLogo } from '../../../../shared/ui/OrcaLogo'
function sourceIcon(backend: Backend): ComposerModule['sourceIcon'] {
  return function renderSourceIcon(source) {
    return source === 'orca'
      ? createElement(OrcaLogo, { className: 'h-3.5 w-4 shrink-0' })
      : createElement(HarnessLogo, {
          backend: source === 'adapter:claude' ? 'claude' : backend,
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
