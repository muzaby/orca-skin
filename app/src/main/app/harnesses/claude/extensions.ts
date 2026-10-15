import { homedir } from 'node:os'
import { join } from 'node:path'
import type { McpStore } from '../../../features/extensions/common/mcp/store'
import type { SkillScanRoot } from '../../../features/extensions/common/skills/scan'
import { ExtensionDeploymentService } from '../../../features/extensions/common/extension-deployment-service'
import { deploy } from '../../../features/extensions/claude/deployer'
import { toClaudeConfig } from '../../../features/extensions/claude/mcp/convert'
import { scaffoldProviderSettings } from '../../../features/extensions/claude/scaffold'
import { builtInHarnessPluginRoot } from '../../../features/extensions/claude/plugin'
import { userClaudePluginRoot } from '../../../features/extensions/claude/user-skills'
import { readUserClaudeSettings } from '../../../adapters/claude/settings'
import { orcaConfigDir } from '../../../infra/config/paths'
import { reportError } from '../../../infra/error-report'
import { getLogger } from '../../../infra/log'

export function claudeSkillRoots(): SkillScanRoot[] {
  return [
    {
      sourceId: 'adapter:claude',
      sourceLabel: 'CLAUDE 스킬',
      sourceKind: 'adapter',
      rootDir: join(homedir(), '.claude', 'skills')
    }
  ]
}

export function claudePluginRoots(): string[] {
  return [
    builtInHarnessPluginRoot(orcaConfigDir(), 'claude'),
    userClaudePluginRoot(orcaConfigDir(), 'claude')
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

export function createClaudeDeploymentService(
  mcp: Pick<McpStore, 'enabledConfig' | 'resolver'>,
  skillRoots: () => SkillScanRoot[]
): ExtensionDeploymentService {
  const log = getLogger().child('extensions')
  return new ExtensionDeploymentService({
    standard: 'claude',
    deploy: async () => {
      const { config, dropped } = toClaudeConfig(mcp.enabledConfig(), mcp.resolver())
      for (const d of dropped)
        reportError({
          event: 'mcp.server.skipped',
          scope: 'extensions',
          title: 'mcpServerSkipped',
          level: 'warn',
          detail: d.name + ': ' + d.reason,
          data: { name: d.name, reason: d.reason }
        })
      const result = await deploy('claude', { skillRoots: skillRoots(), mcpConfig: config })
      log.info('extensions.deploy.completed', {
        standard: 'claude',
        validationOk: result.validation.ok
      })
      return result
    },
    onWarning: (message) =>
      reportError({
        event: 'extensions.deploy.warning',
        scope: 'extensions',
        title: 'extensionsFailed',
        level: 'warn',
        detail: message,
        data: { message }
      })
  })
}
