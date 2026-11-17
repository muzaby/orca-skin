import type { Backend } from '../../../shared/ipc'
import { AdapterRegistry } from '../../adapters/common/registry'
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

export function harnessModule(harnessId: Backend): MainHarnessModule {
  return mainHarnessModules[harnessId]
}

// The previous env preparation applied this compatibility rule to every native blob.
export const legacySettingsEnvHoist = claudeSettingsEnvHoist

export { MockAdapter } from '../../adapters/claude/mock'
export { prepareAgentExtensionProfile } from './claude/extension-profile'
export {
  createClaudeDeploymentService as createHarnessDeploymentService,
  claudePluginRoots as harnessPluginRoots
} from './claude/extensions'
// 실행 없이 읽는 구성은 `config-registry.ts` 가 정본이다 — 실행 쪽 소비자가 한 곳에서 받도록 다시 낸다.
export {
  createHarnessSettingsService,
  harnessSkillRoots,
  parseHarnessRuntimeModels,
  parseHarnessSettingsModels,
  scaffoldHarnessSettings
} from './config-registry'
