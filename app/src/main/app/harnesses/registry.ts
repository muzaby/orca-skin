import type { Backend } from '../../../shared/ipc'
import { AdapterRegistry } from '../../adapters/common/registry'
import { HarnessSettingsService } from '../../features/harnesses/common/settings'
import type { HarnessRuntimeConfig } from '../../adapters/common/harness-config'
import type { ParsedModel } from '../../features/harnesses/common/model-types'
import type { MainHarnessModule, HarnessRuntimeOptions } from './common/contracts'
import { claudeMainModule, claudeSettingsEnvHoist } from './claude/module'
import { openCodeMainModule } from './opencode/module'

export const mainHarnessModules: Readonly<Record<Backend, MainHarnessModule>> = {
  claude: claudeMainModule,
  opencode: openCodeMainModule
}

export function createAdapterRegistry(options: HarnessRuntimeOptions): AdapterRegistry {
  return new AdapterRegistry(
    Object.values(mainHarnessModules).map((module) => module.createAdapter(options)),
    'claude'
  )
}

// Preserve unsupported source-directory rows and existing runtime contributions explicitly.
// Native settings parsing for a registered harness never falls back to a sibling module.
function moduleFor(harnessId: string): MainHarnessModule {
  return mainHarnessModules[harnessId as Backend] ?? claudeMainModule
}

export function parseHarnessSettingsModels(
  harnessId: string,
  settings: Record<string, unknown>
): ParsedModel[] {
  return moduleFor(harnessId).parseSettingsModels(settings)
}

export function parseHarnessRuntimeModels(config: HarnessRuntimeConfig): ParsedModel[] {
  const parse =
    moduleFor(config.harnessId).parseRuntimeModels ?? claudeMainModule.parseRuntimeModels!
  return parse(config)
}

export function createHarnessSettingsService(root?: string): HarnessSettingsService {
  return new HarnessSettingsService(
    Object.fromEntries(
      Object.values(mainHarnessModules).map((module) => [module.id, module.loadSettings])
    ),
    root,
    parseHarnessSettingsModels
  )
}

export function harnessModule(harnessId: Backend): MainHarnessModule {
  return mainHarnessModules[harnessId]
}

// The previous env preparation applied this compatibility rule to every native blob.
export const legacySettingsEnvHoist = claudeSettingsEnvHoist

export { MockAdapter } from '../../adapters/claude/mock'
export { prepareAgentExtensionProfile } from './claude/extension-profile'
export {
  createClaudeDeploymentService as createHarnessDeploymentService,
  claudePluginRoots as harnessPluginRoots,
  claudeSkillRoots as harnessSkillRoots,
  scaffoldClaudeSettings as scaffoldHarnessSettings
} from './claude/extensions'
