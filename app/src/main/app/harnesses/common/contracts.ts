import type { Backend, EngineUserSettingsResult } from '../../../../shared/ipc'
import type { NativeCommand, NativeResource } from '../../../../shared/native-resources'
import type {
  HarnessRuntimeConfig,
  HarnessSettingsLoader
} from '../../../adapters/common/harness-config'
import type { SessionAdapter } from '../../../adapters/common/types'
import type {
  ParsedModel,
  SettingsModelParser
} from '../../../features/harnesses/common/model-types'

export interface HarnessRuntimeOptions {
  managedMcp?: import('../../../adapters/common/managed-mcp').ManagedMcpRuntime
  pluginSnapshots?: import('../../../adapters/common/plugin-snapshots').PluginSnapshotPort
  dataDirectory: string
  preferences: <K extends Backend>(
    harnessId: K
  ) => import('../../../../shared/harness').HarnessSettings[K]
  fetchImpl: typeof fetch
  extensionControl?: import('../../../adapters/common/extension-control').ExtensionControl
}

// 실행 없이 읽는 구성 — 데이터 호스트(상태)도 쓴다(`config-registry.ts`, 0324 EP-1 (e3)).
export interface HarnessConfigModule {
  readonly id: Backend
  loadSettings: HarnessSettingsLoader
  parseSettingsModels: SettingsModelParser
  parseRuntimeModels?: (config: HarnessRuntimeConfig) => ParsedModel[]
}

export interface MainHarnessModule extends HarnessConfigModule {
  projectResources?: import('../../../adapters/common/project-resources').ProjectResourcePolicy
  createAdapter(options: HarnessRuntimeOptions): SessionAdapter
  readUserSettings(): EngineUserSettingsResult
  configuredResources?(cwd: string, choices: Record<string, boolean>): Promise<NativeResource[]>
  nativeResourceScope?(cwd: string): string
  /** Discovery for management/drafts; not authoritative over a live process. */
  draftResources?(cwd: string, choices: Record<string, boolean>): Promise<NativeResource[]>
  globalResources?(): Promise<NativeResource[]>
  globalResourcePath?(id: string, kind: NativeResource['kind']): Promise<string | undefined>
  configuredCommands?(cwd: string, choices: Record<string, boolean>): Promise<NativeCommand[]>
  resolveTitleModel(models: ParsedModel[]): string | undefined
  recoveryContextWindow(settings: Record<string, unknown>, model?: string): number
  defaultProvider<T extends { modelProviderId: string }>(entries: readonly T[]): T | undefined
}
