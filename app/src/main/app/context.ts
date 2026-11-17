// RouterContext — IPC 핸들러 도메인 모듈들이 공유하는 main 측 의존성 묶음.
// 컴포지션 루트(bootstrap.ts)가 부팅 시 1회 조립해 각 register* 함수에 주입한다.
// 핸들러가 부팅 배선 클래스 필드를 직접 만지지 않게 하는 단일 경계.

import type { BootReport, DebugMockState, SkillInfo } from '../../shared/ipc'
import type { DbQueries } from '../infra/db'
import type { SettingsStore } from '../infra/settings-store'
import type { McpStore } from '../features/extensions/common/mcp/store'
import type { AdapterRegistry } from '../adapters/common/registry'
import type { MockAdapter } from './harnesses/registry'
import type { UsageTracker } from '../features/usage/tracker'
import type { ExtensionBuilder } from '../features/extensions/common/builder'
import type { HarnessSettingsService } from '../features/harnesses/common/settings'
import type { HarnessRuntimeConfigService } from '../features/harnesses/common/runtime-config'
import type { RuntimeModelCatalog } from '../features/harnesses/common/runtime-catalog'
import type { Scheduler } from '../features/scheduler'
import type { RuntimeToolRegistry } from '../features/extensions/common/runtime-tool-registry'
import type { UpdateController } from './updater'
import type { Settings } from '../../shared/protocol'
import type { RemoteOps } from '../infra/ipc/peer-ops'
import type { DataQueryOps, DataWriteOps } from './data-host/data-ops'

// 실행 쪽 코드가 데이터 호스트에 닿는 길(0324 EP-16). DB 를 직접 부르지 않고 이 요청으로 읽고 쓴다.
export interface DataPort {
  query: RemoteOps<DataQueryOps>
  write: RemoteOps<DataWriteOps>
}

// 실행 쪽이 읽는 설정 — 데이터 호스트가 보낸 사본이다(0324 EP-17).
export interface SettingsReader {
  getAll(): Settings
}

// 에이전트 호스트(실행)의 조립이 핸들러·턴 코드에 넘기는 의존 묶음(0324 D-034). `db` 가 없다 —
// 실행 쪽 코드가 DB 를 직접 부르면 컴파일되지 않는다.
export interface AgentContext
  extends Pick<
    RouterContext,
    | 'registry'
    | 'extensions'
    | 'workProfilePluginPath'
    | 'harnessSettings'
    | 'deployExtensions'
    | 'ensureExtensionsDeployedForTurn'
    | 'debugMock'
    | 'mockAdapter'
    | 'harnessRuntime'
    | 'runtimeModelCatalog'
    | 'mcp'
  > {
  data: DataPort
  settings: SettingsReader
  // 프로젝트 미소속 세션의 기본 작업 폴더 — DB 없이 안다.
  defaultCwd(): string
}

export interface RouterContext {
  db: DbQueries
  settings: SettingsStore
  mcp: McpStore
  registry: AdapterRegistry
  cost: UsageTracker
  extensions: ExtensionBuilder
  readonly workProfilePluginPath: string
  // Harness settings 해석 서비스 (0014 → 0188) — 열거(sources/settings 트리) + 해석 캐시.
  harnessSettings: HarnessSettingsService
  // 부팅 1회 스캔 캐시 — 턴 실행 시점에 최신 값을 읽도록 getter 로 노출.
  getSkills(): SkillInfo[]
  refreshSkills(): Promise<SkillInfo[]>
  // 비동기 배포(0109) — invoke 핸들러가 await 해도 재귀 복사가 이벤트 루프를 막지 않는다.
  deployExtensions(options?: { throwOnFailure?: boolean }): Promise<void>
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
  // 연결 상태에 따라 활성 plugin 도구를 반영하고, 턴에는 현재 snapshot을 전달한다.
  runtimeTools: RuntimeToolRegistry
  // Harness 실행 구성. 인증·게이트는 연결 핸들러에 별도 주입한다.
  //
  // **`secretReader` 는 여기 없다.** raw credential 은 컴포지션 루트에 머물고 MCP·Harness
  // augmenter 에만 AuthId 를 닫은 closure 로 간다(D-010).
  //
  // 동적 구성이 없는 하네스의 기존 동작을 유지한다.
  harnessRuntime: HarnessRuntimeConfigService
  runtimeModelCatalog: RuntimeModelCatalog
  // ── 실행 쪽 조립이 가져가는 것(0324) — 조립이 한 프로세스에 있는 동안 여기 함께 실린다 ──
  data: DataPort
  // 실행 쪽이 읽는 설정 사본.
  agentSettings: SettingsReader
  defaultCwd(): string
}

// 실행 쪽 코드에 넘길 묶음을 고른다 — `db`·설정 저장소는 넘어가지 않는다.
export function agentContextOf(ctx: RouterContext): AgentContext {
  return {
    registry: ctx.registry,
    extensions: ctx.extensions,
    workProfilePluginPath: ctx.workProfilePluginPath,
    harnessSettings: ctx.harnessSettings,
    deployExtensions: ctx.deployExtensions,
    ensureExtensionsDeployedForTurn: ctx.ensureExtensionsDeployedForTurn,
    debugMock: ctx.debugMock,
    mockAdapter: ctx.mockAdapter,
    harnessRuntime: ctx.harnessRuntime,
    runtimeModelCatalog: ctx.runtimeModelCatalog,
    mcp: ctx.mcp,
    data: ctx.data,
    settings: ctx.agentSettings,
    defaultCwd: ctx.defaultCwd
  }
}
