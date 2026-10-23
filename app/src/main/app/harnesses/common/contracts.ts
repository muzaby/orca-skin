import type { Backend, EngineUserSettingsResult } from '../../../../shared/ipc'
import type { HarnessPreferences } from '../../../../shared/harness'
import type { NativeCommand, NativeResource } from '../../../../shared/native-resources'
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
  pluginSnapshots?: import('../../../adapters/common/plugin-snapshots').PluginSnapshotPort
  dataDirectory: string
  preferences: (harnessId: Backend) => HarnessPreferences | undefined
  fetchImpl: typeof fetch
  extensionControl?: import('../../../adapters/common/extension-control').ExtensionControl
}

export interface MainHarnessModule {
  globalResourceControl?(records: {
    get(): import('../../../../shared/native-resources').OpenCodeDisabledPlugin[]
    set(records: import('../../../../shared/native-resources').OpenCodeDisabledPlugin[]): void
  }): {
    reconcile(): Promise<NativeResource[]>
    set(item: NativeResource, enabled: boolean): Promise<void>
  }
  projectResources?: import('../../../adapters/common/project-resources').ProjectResourcePolicy
  readonly id: Backend
  createAdapter(options: HarnessRuntimeOptions): SessionAdapter
  loadSettings: HarnessSettingsLoader
  parseSettingsModels: SettingsModelParser
  parseRuntimeModels?: (config: HarnessRuntimeConfig) => ParsedModel[]
  readUserSettings(): EngineUserSettingsResult
  configuredResources?(cwd: string, choices: Record<string, boolean>): Promise<NativeResource[]>
  nativeResourceScope?(cwd: string): string
  /** Discovery for management/drafts; not authoritative over a live process. */
  draftResources?(cwd: string, choices: Record<string, boolean>): Promise<NativeResource[]>
  globalResources?(): Promise<NativeResource[]>
  globalResourcePath?(id: string, kind: NativeResource['kind']): Promise<string | undefined>
  configuredCommands?(cwd: string, choices: Record<string, boolean>): Promise<NativeCommand[]>
  configuredPluginDirectory?(cwd: string, id: string): Promise<string | undefined>
  configuredMcpFile?(cwd: string, id: string): Promise<string | undefined>
  resolveTitleModel(models: ParsedModel[]): string | undefined
  recoveryContextWindow(settings: Record<string, unknown>, model?: string): number
  defaultProvider<T extends { modelProviderId: string }>(entries: readonly T[]): T | undefined
}
