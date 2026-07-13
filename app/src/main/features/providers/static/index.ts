import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { writeJsonAtomic } from '../../../infra/config/json-file'
import { orcaConfigDir } from '../../../infra/config/paths'
import type { StaticUsageProviderModule } from '../../../contracts/usage-report'

const emptyClaudeSettings = { env: {} }

/**
 * Static provider integration contract (0098 r2):
 *
 * - provider-local settings live under the existing registry SSOT:
 *   `sources/settings/<adapter>/<provider>/settings.json`
 * - provider-specific usage integration stays inside this module list:
 *   add a provider module with optional `usage.provider` (imperative hook) or
 *   `usage.config` (simple config sugar), then export it through this barrel.
 * - core usage services, scheduler, IPC handlers, tracker, and provider
 *   enumeration must only consume `StaticUsageProviderModule[]`; they must not
 *   add provider-name branches for bedrock/vertex/custom/etc.
 * - hook internals intentionally remain provider-owned. OAuth, STS/SigV4,
 *   pagination, retries, and response mapping are not framework concepts; the
 *   framework only provides `ExternalUsageContext` and consumes
 *   `ExternalUsageReport | null`.
 */
export const STATIC_USAGE_PROVIDERS: StaticUsageProviderModule[] = [
  { adapter: 'claude', provider: 'bedrock', defaultSettings: emptyClaudeSettings },
  { adapter: 'claude', provider: 'vertex', defaultSettings: emptyClaudeSettings },
  { adapter: 'claude', provider: 'custom', defaultSettings: emptyClaudeSettings }
]

export interface StaticProviderMaterializeResult {
  created: string[]
}

export function materializeStaticProviderSettings(
  providers: readonly StaticUsageProviderModule[] = STATIC_USAGE_PROVIDERS,
  root: string = orcaConfigDir()
): StaticProviderMaterializeResult {
  const created: string[] = []
  for (const p of providers) {
    const dir = join(root, 'sources', 'settings', p.adapter, p.provider)
    mkdirSync(dir, { recursive: true })
    const settingsPath = join(dir, 'settings.json')
    if (!existsSync(settingsPath)) {
      writeJsonAtomic(settingsPath, p.defaultSettings)
      created.push(settingsPath)
    }
  }
  return { created }
}
