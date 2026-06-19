// RouterContext — IPC 핸들러 도메인 모듈들이 공유하는 main 측 의존성 묶음.
// IpcRouter(컴포지션 루트)가 부팅 시 1회 조립해 각 register* 함수에 주입한다.
// 핸들러가 라우터 클래스 필드를 직접 만지지 않게 하는 단일 경계.

import { webContents, type WebContents } from 'electron'
import {
  CHANNELS,
  type DebugMockState,
  type InstallStatus,
  type NormalizedEvent,
  type SessionTitleEvent,
  type SkillInfo
} from '../../shared/ipc'
import type { DbQueries } from '../db'
import type { SettingsStore } from '../settings/store'
import type { McpStore } from '../mcp/store'
import type { AdapterRegistry } from '../adapters/registry'
import type { MockAdapter } from '../adapters/mock'
import type { Installer } from '../installer'
import type { CostTracker } from '../cost/tracker'
import type { PythonRuntime } from '../runtime'
import type { SecretStore } from '../config/secret-store'
import type { ExtensionBuilder } from '../extensions/builder'
import type { ProviderSettingsService } from '../settings/provider-settings'

export interface RouterContext {
  db: DbQueries
  settings: SettingsStore
  mcp: McpStore
  registry: AdapterRegistry
  installer: Installer
  cost: CostTracker
  runtime: PythonRuntime
  secretStore: SecretStore
  extensions: ExtensionBuilder
  // provider settings 해석 서비스 (handoff 0014) — 열거(sources/settings 트리) + 해석 캐시.
  providerSettings: ProviderSettingsService
  // 부팅 1회 스캔 캐시 — 턴 실행 시점에 최신 값을 읽도록 getter 로 노출.
  getSkills(): SkillInfo[]
  refreshSkills(): Promise<SkillInfo[]>
  syncExtensions(): void
  // 턴 시작 게이트 — 해당 cwd 가 이번 실행에서 미싱크면 1회 dist→cwd 싱크(세션별 cwd 대비).
  syncExtensionsForTurn(cwd: string): void
  // chat send · files list · session cwd 가 공유하는 단일 cwd.
  getCwd(): string
  debugMock: DebugMockState
  mockAdapter: MockAdapter | null
}

// 디버그 패널의 "Wire 메시지" 토글 상태(dev 전용). sendChatEvent 는 자유 함수라
// ctx 접근이 없어 모듈 스코프 플래그로 둔다 — debugSetMock 핸들러가 동기화한다.
// 기본 false + 토글 핸들러가 DEV 전용이라 프로덕션 경로는 항상 무출력.
let wireLogEnabled = false

export function setWireLog(on: boolean): void {
  wireLogEnabled = on
}

export function sendChatEvent(wc: WebContents, ev: NormalizedEvent): void {
  if (wireLogEnabled) console.log('[wire]', ev.type, ev)
  if (!wc.isDestroyed()) wc.send(CHANNELS.chatEvent, ev)
}

export function sendInstallStatus(wc: WebContents, st: InstallStatus): void {
  if (!wc.isDestroyed()) wc.send(CHANNELS.installStatus, st)
}

export function broadcastSessionTitle(ev: SessionTitleEvent): void {
  for (const wc of webContents.getAllWebContents()) {
    if (!wc.isDestroyed()) wc.send(CHANNELS.sessionTitleEvent, ev)
  }
}
