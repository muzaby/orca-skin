import type { AgentModelView, EngineUserSettingsResult } from '../../../shared/ipc'
import type { HarnessPreferences } from '../../../shared/harness'
import type { HarnessSettingsLoader } from '../common/harness-config'
import type { SessionAdapter } from '../common/types'
import type { openFileDatabase } from '../../infra/db/file-database'

// 앱이 소유하는 수명/전송 포트. SDK client와 버전별 설정 형상은 구현에서만 해석한다.
export interface OpenCodeServer {
  acquire(
    config?: Record<string, unknown>,
    env?: Record<string, string>,
    cwd?: string
  ): Promise<{
    url: string
    headers: Record<string, string>
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
  contextWindow: (config: Record<string, unknown>, model?: string) => number
}
