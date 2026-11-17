// Claude 구성 — 실행 없이 읽는 부분 (0324 EP-1 (e3)). 어댑터·SDK 를 끌어오지 않는다.
import { claudeNativePaths } from '../../../adapters/claude/native-paths'
import {
  loadClaudeProviderSettings,
  readUserClaudeSettings
} from '../../../adapters/claude/settings'
import { scaffoldProviderSettings } from '../../../features/extensions/claude/scaffold'
import type { SkillScanRoot } from '../../../features/extensions/common/skills/scan'
import {
  parseClaudeModels,
  parseRuntimeModels
} from '../../../features/harnesses/claude/model-parser'
import { getLogger } from '../../../infra/log'
import type { HarnessConfigModule } from '../common/contracts'

export const claudeConfigModule: HarnessConfigModule = {
  id: 'claude',
  loadSettings: loadClaudeProviderSettings,
  parseSettingsModels: parseClaudeModels,
  parseRuntimeModels
}

export function claudeSkillRoots(): SkillScanRoot[] {
  return [
    {
      sourceId: 'adapter:claude',
      sourceLabel: 'Claude 스킬',
      sourceKind: 'adapter',
      rootDir: claudeNativePaths().skills
    }
  ]
}

export function scaffoldClaudeSettings(): void {
  const userSettings = readUserClaudeSettings()
  const result = scaffoldProviderSettings(
    'claude',
    undefined,
    userSettings.exists ? userSettings.settingsJson : null
  )
  const log = getLogger().child('providers')
  for (const path of result.created) log.debug('providers.scaffold.created', { path })
}
