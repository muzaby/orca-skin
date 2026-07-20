// RouterContext — IPC 핸들러 도메인 모듈들이 공유하는 main 측 의존성 묶음.
// 컴포지션 루트(bootstrap.ts)가 부팅 시 1회 조립해 각 register* 함수에 주입한다.
// 핸들러가 부팅 배선 클래스 필드를 직접 만지지 않게 하는 단일 경계.

import type { BootReport, DebugMockState, SkillInfo } from '../../shared/ipc'
import type { DbQueries } from '../infra/db'
import type { SettingsStore } from '../infra/settings-store'
import type { McpStore } from '../features/extensions/mcp/store'
import type { AdapterRegistry } from '../adapters/registry'
import type { MockAdapter } from '../adapters/mock'
import type { UsageTracker } from '../features/usage/tracker'
import type { SecretStore } from '../infra/config/secret-store'
import type { ExtensionBuilder } from '../features/extensions/builder'
import type { ProviderSettingsService } from '../features/providers/provider-settings'
import type { Scheduler } from '../features/scheduler'
import type { ExternalUsageService } from '../features/usage/external-usage-service'
import type { SsoService } from '../features/sso/service'
import type { UpdateController } from './updater'

export interface RouterContext {
  db: DbQueries
  settings: SettingsStore
  mcp: McpStore
  registry: AdapterRegistry
  cost: UsageTracker
  secretStore: SecretStore
  extensions: ExtensionBuilder
  // provider settings 해석 서비스 (handoff 0014) — 열거(sources/settings 트리) + 해석 캐시.
  providerSettings: ProviderSettingsService
  // 부팅 1회 스캔 캐시 — 턴 실행 시점에 최신 값을 읽도록 getter 로 노출.
  getSkills(): SkillInfo[]
  refreshSkills(): Promise<SkillInfo[]>
  // 비동기 배포(0109) — invoke 핸들러가 await 해도 재귀 복사가 이벤트 루프를 막지 않는다.
  deployExtensions(): Promise<void>
  // 턴 시작 게이트 — query 호출 전 sources→dist plugin 배포 최신성을 멱등 보장한다.
  ensureExtensionsDeployedForTurn(): Promise<void>
  // chat send · files list · session cwd 가 공유하는 단일 cwd. 프로젝트 미소속이면
  // projects/default, 소속이면 projects/<이름>-<프로젝트ID8> (DB 에서 이름 조회).
  getCwd(projectId?: string | null): string
  // main bootstrap 은 BrowserWindow/renderer 이전에 완료된다. renderer 에는 진행률이 아니라
  // 완료된 diagnostic snapshot 만 노출한다.
  getBootReport(): BootReport
  debugMock: DebugMockState
  mockAdapter: MockAdapter | null
  updates: UpdateController
  scheduler: Scheduler
  externalUsage: ExternalUsageService
  // SSO 게이트(0130) — 핸들러는 부팅 초기에 이미 등록됨(bootstrap 조기 등록). ctx 노출은
  // 다른 도메인이 인증 상태를 조회할 때를 위한 균일성 목적.
  sso: SsoService
}
