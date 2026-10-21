import type { AgentModelView, EngineUserSettingsResult } from '../../../shared/ipc'
import type { HarnessPreferences } from '../../../shared/harness'
import type { HarnessSettingsLoader } from '../common/harness-config'
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
  close(): void
}

export interface OpenCodeRuntimeOptions {
  dataDirectory: string
  preferences: () => HarnessPreferences | undefined
  fetchImpl: typeof fetch
  server?: OpenCodeServer
  openDatabase?: typeof openFileDatabase
}

export interface OpenCodeImplementation {
  createAdapter: (options: OpenCodeRuntimeOptions) => SessionAdapter
  loadSettings: HarnessSettingsLoader
  parseModels: (config: Record<string, unknown>) => AgentModelView[]
  readUserSettings: (configRoot?: string) => EngineUserSettingsResult
  configuredMcpFile: (cwd: string, id: string) => Promise<string | undefined>
  configuredResources: (cwd: string) => Promise<NativeResource[]>
  skillDirectories: (home?: string, env?: NodeJS.ProcessEnv) => string[]
  pluginSkillDirectories: (home?: string, env?: NodeJS.ProcessEnv) => Promise<string[]>
  contextWindow: (config: Record<string, unknown>, model?: string) => number
}
