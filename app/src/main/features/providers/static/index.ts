import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { writeJsonAtomic } from '../../../infra/config/json-file'
import { orcaConfigDir } from '../../../infra/config/paths'
import type { StaticUsageProviderModule } from '../../../contracts/usage-report'

const emptyClaudeSettings = { env: {} }

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
