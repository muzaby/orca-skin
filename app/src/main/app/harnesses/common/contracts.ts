import type { Backend, EngineUserSettingsResult } from '../../../../shared/ipc'
import type { HarnessPreferences } from '../../../../shared/harness'
import type { SessionAdapter } from '../../../adapters/common/types'
import type {
  HarnessRuntimeConfig,
  HarnessSettingsLoader
} from '../../../adapters/common/harness-config'
import type {
  ParsedModel,
  SettingsModelParser
} from '../../../features/harnesses/common/model-types'

export interface HarnessRuntimeOptions {
  dataDirectory: string
  preferences: (harnessId: Backend) => HarnessPreferences | undefined
  fetchImpl: typeof fetch
}

export interface MainHarnessModule {
  readonly id: Backend
  createAdapter(options: HarnessRuntimeOptions): SessionAdapter
  loadSettings: HarnessSettingsLoader
  parseSettingsModels: SettingsModelParser
  parseRuntimeModels?: (config: HarnessRuntimeConfig) => ParsedModel[]
  readUserSettings(): EngineUserSettingsResult
  resolveTitleModel(models: ParsedModel[]): string | undefined
  defaultProvider<T extends { modelProviderId: string }>(entries: readonly T[]): T | undefined
}
