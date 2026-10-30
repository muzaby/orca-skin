import type { AgentModelView, EngineUserSettingsResult } from '../../../shared/ipc'
import type { OpenCodePreferences } from '../../../shared/harness'
import type {
  HarnessListedModel,
  HarnessRuntimeConfig,
  HarnessSettingsLoader
} from '../common/harness-config'
import type { SessionAdapter } from '../common/types'
import type { openFileDatabase } from '../../infra/db/file-database'
import type { NativeResource } from '../../../shared/native-resources'

// 앱이 소유하는 수명/전송 포트. SDK client와 버전별 설정 형상은 구현에서만 해석한다.
export interface OpenCodeServer {
  acquire(
    config?: Record<string, unknown>,
    env?: Record<string, string>,
    cwd?: string
  ): Promise<{
    url: string
    headers: Record<string, string>
    /** One acquisition's ownership; idempotent. Absent only on external/test server ports. */
    release?: () => void
    /** Stop new acquisitions from joining this generation; existing owners remain alive. */
    retire?: () => void
  }>
  installed(): Promise<{ installed: boolean; binPath?: string; version?: string }>
  databasePath?(
    config: Record<string, unknown>,
    env?: Record<string, string>,
    cwd?: string
  ): Promise<string>
  retireAll?(): void
  // 호스트 설정 그대로 provider 모델 목록을 읽는다(0291). 서버와 같은 실행 파일·1.x 판정.
  listModels?(
    provider: string,
    options: { signal: AbortSignal; env?: Readonly<Record<string, string>> }
  ): Promise<HarnessListedModel[]>
  close(): void
}

export interface OpenCodeRuntimeOptions {
  managedMcp?: import('../common/managed-mcp').ManagedMcpRuntime
  dataDirectory: string
  preferences: () => OpenCodePreferences | undefined
  fetchImpl: typeof fetch
  server?: OpenCodeServer
  openDatabase?: typeof openFileDatabase
  extensionControl?: import('../common/extension-control').ExtensionControl
}

export interface OpenCodeImplementation {
  invalidateDiscovery(): void
  globalPluginFiles(): string[]
  globalPluginFingerprint(): Promise<string>
  projectResources: import('../common/project-resources').ProjectResourcePolicy
  createAdapter: (options: OpenCodeRuntimeOptions) => SessionAdapter
  loadSettings: HarnessSettingsLoader
  parseModels: (config: Record<string, unknown>) => AgentModelView[]
  parseRuntimeModels: (config: HarnessRuntimeConfig) => AgentModelView[]
  readUserSettings: (configRoot?: string) => EngineUserSettingsResult
  configuredMcpFile: (cwd: string, id: string) => Promise<string | undefined>
  configuredResources: (cwd: string) => Promise<NativeResource[]>
  globalResources: () => Promise<NativeResource[]>
  globalResourcePath: (id: string) => Promise<string | undefined>
  skillDirectories: (home?: string, env?: NodeJS.ProcessEnv) => string[]
  pluginSkillDirectories: (home?: string, env?: NodeJS.ProcessEnv) => Promise<string[]>
  contextWindow: (config: Record<string, unknown>, model?: string) => number
}
