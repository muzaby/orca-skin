import type { Backend } from '../../../../../../shared/ipc'
import type { ComposerModule } from '../contracts'
import { composerModule as claude } from '../claude/composer/Module'
import { composerModule as opencode } from '../opencode/composer/Module'
const modules = { claude, opencode } satisfies Record<Backend, ComposerModule>
export function composerHarness(backend: Backend | null | undefined): ComposerModule {
  return modules[backend ?? 'claude']
}
