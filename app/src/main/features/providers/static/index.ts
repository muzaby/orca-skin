import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { writeJsonAtomic } from '../../../infra/config/json-file'
import { orcaConfigDir } from '../../../infra/config/paths'
import type { StaticUsageProviderModule } from '../../../contracts/usage-report'
import { STATIC_USAGE_PROVIDER_MODULES } from './modules'

/**
 * Static provider integration contract (0099):
 *
 * - Static usage providers are opt-in extension modules. A fresh Orca install
 *   ships with zero active static providers; bedrock/vertex/custom settings are
 *   not scaffolded unless a deployment explicitly registers a module.
 * - Provider-local settings live under the existing registry SSOT:
 *   `sources/settings/<adapter>/<provider>/settings.json`.
 * - To activate a provider, add its module under `modules/<name>/` and export it
 *   from `modules/index.ts`. Core usage services, scheduler, IPC handlers,
 *   tracker, provider enumeration, and this materializer must remain
 *   provider-agnostic and branch-free.
 * - Hook internals intentionally remain provider-owned. OAuth, STS/SigV4,
 *   pagination, retries, and response mapping are not framework concepts; the
 *   framework only provides `ExternalUsageContext` and consumes
 *   `ExternalUsageReport | null`.
 */
export const STATIC_USAGE_PROVIDERS: StaticUsageProviderModule[] = STATIC_USAGE_PROVIDER_MODULES

interface StaticProviderMaterializeResult {
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
