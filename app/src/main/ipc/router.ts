// IpcRouter — main 측 컴포지션 루트. 의존성 생성 + 부팅 시퀀스 + 핸들러 등록 위임만 담당한다.
// 도메인 핸들러는 ipc/handlers/, chat 턴 파이프라인은 ipc/chat/ 참조 (handoff 0011 분해).

import { webContents } from 'electron'
import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { CHANNELS, type DebugMockState, type SkillInfo } from '../../shared/ipc'
import { AdapterRegistry } from '../adapters/registry'
import { MockAdapter } from '../adapters/mock'
import { Installer } from '../installer'
import { SettingsStore } from '../settings/store'
import { McpStore } from '../mcp/store'
import { ensureConfigDir, getWorkspacePath, sourcesSkillsDir } from '../config/paths'
import { loadOrcaConfig } from '../config/orca-config'
import { SecretStore } from '../config/secret-store'
import { deploy } from '../deploy/deployer'
import { syncWorkspaceExtensions } from '../deploy/workspace-sync'
import { scaffoldProviderSettings } from '../deploy/scaffold'
import { ProviderSettingsService } from '../settings/provider-settings'
import { loadClaudeProviderSettings } from '../adapters/claude-settings'
import { scanSkills, type SkillScanRoot } from '../skills/scan'
import { initDb } from '../db'
import { CostTracker } from '../cost/tracker'
import { ExtensionBuilder } from '../extensions/builder'
import { buildAppend, loadPolicies } from '../prompts'
import { PermissionModeController } from '../runtime-events/permission-mode-controller'
import type { RouterContext } from './context'
import { registerSessionHandlers } from './handlers/session'
import { registerProjectHandlers } from './handlers/project'
import { registerMcpHandlers } from './handlers/mcp'
import { registerEngineHandlers } from './handlers/engine'
import { registerMiscHandlers } from './handlers/misc'
import { registerChatHandlers, settleOpenToolRuns } from './chat/send'
import { RuntimeSupervisor } from '../lifecycle/supervisor'
import { AdmissionController, RejectDuplicatePolicy } from '../lifecycle/admission-controller'
import { ConcurrencyRegistry } from '../orchestration/concurrency'
import { ApprovalCoordinator } from './chat/approvals'
import { TurnPersistence } from './chat/persist'
import { TitleGenerator } from './chat/title-generation'
import { recoverDanglingToolCalls } from '../lifecycle/recovery'
import { broadcastConcurrency } from './context'

export class IpcRouter {
  readonly settings = new SettingsStore()
  readonly mcp = new McpStore(this.settings)
  // resolver 팩토리를 lazy arrow 로 넘긴다 — 호출은 턴 실행 시점이라 this.mcp 가 이미 할당돼 있다
  // (field-init 순서 무관). 비밀 확장은 어댑터의 어댑트 시점에만.
  private readonly registry = new AdapterRegistry(() => this.mcp.resolver())
  // 부팅 시 1회 스캔하여 메모리에 캐시. fs.watch hot-reload 는 본 PR 범위 밖 (재시작).
  private skillsCache: SkillInfo[] = []
  // chat send 와 files list, session cwd 노출에서 모두 동일하게 사용하는 단일
  // cwd. 기본은 ~/.config/orca/workspace — 향후 사용자 선택 디렉토리로 확장 가능.
  private defaultCwd: string = ''
  // 이미 dist→cwd 파일 싱크를 끝낸 cwd 집합. 턴 시작 시 cwd 단위로 1회만 싱크하기 위한 게이트.
  // boot 1회가 아니라 cwd 단위로 추적해 향후 세션별 cwd 분리 시 각 cwd 첫 턴마다 싱크된다.
  private readonly syncedCwds = new Set<string>()
  private readonly debugMock: DebugMockState = {
    enabled: false,
    scenarioId: 'full',
    contextUsageRatio: 0.3,
    wireLog: false
  }
  // 앱 종료(will-quit) 정리용 참조 — register() 에서 채워진다. 종료 시 진행 중 턴의 열린 도구를
  // 정착하고 controller 를 abort 한다(shutdown).
  private supervisor?: RuntimeSupervisor<Electron.WebContents>
  private persistence?: TurnPersistence

  private skillRoots(): SkillScanRoot[] {
    return [
      {
        sourceId: 'orca',
        sourceLabel: 'Orca 스킬',
        sourceKind: 'orca',
        rootDir: sourcesSkillsDir()
      },
      {
        sourceId: 'adapter:claude',
        sourceLabel: 'CLAUDE 스킬',
        sourceKind: 'adapter',
        rootDir: join(homedir(), '.claude', 'skills')
      }
    ]
  }

  private async refreshSkills(): Promise<SkillInfo[]> {
    this.skillsCache = await scanSkills(
      this.skillRoots(),
      this.settings.getAll().skillEnabled
    ).catch(() => [])
    return this.skillsCache
  }

  // 강제 싱크 — dist 재렌더 + 지정 cwd(기본 defaultCwd)로 overwrite-merge. boot·스킬 CRUD 가
  // 호출한다. 싱크한 cwd 를 syncedCwds 에 기록해 이후 턴 게이트가 중복 싱크를 건너뛰게 한다.
  private syncExtensions(cwd: string = this.defaultCwd): void {
    try {
      const r = deploy('claude', {
        skillRoots: this.skillRoots(),
        mcpConfig: this.mcp.enabledConfig()
      })
      if (!r.validation.ok) {
        for (const err of r.validation.errors) console.warn('[deploy] 검증 경고:', err)
      }
      syncWorkspaceExtensions('claude', cwd)
      this.syncedCwds.add(cwd)
    } catch (e) {
      console.warn('[sync] 확장 싱크 건너뜀:', e)
    }
  }

  // 턴 시작 게이트 — 해당 cwd 가 이번 실행에서 아직 싱크되지 않았을 때만 1회 싱크한다.
  // (세션별 cwd 분리 시 각 cwd 첫 턴에 싱크. 동일 cwd 공유면 사실상 부팅 후 첫 턴 1회.)
  private syncExtensionsForTurn(cwd: string): void {
    if (this.syncedCwds.has(cwd)) return
    this.syncExtensions(cwd)
  }

  async start(): Promise<void> {
    const db = initDb()
    const recovered = recoverDanglingToolCalls(db)
    if (recovered.toolResultsWritten > 0 && is.dev) {
      console.log('[recovery] dangling tools settled:', recovered)
    }
    // 비용 요약 IPC 송출 배선 — domain(CostTracker)은 electron 비의존, 송출은 여기(컴포지션 루트)서.
    const cost = new CostTracker(db, (summary) => {
      for (const wc of webContents.getAllWebContents()) {
        if (!wc.isDestroyed()) wc.send(CHANNELS.costSummaryEvent, summary)
      }
    })
    cost.recompute()
    // 정적 정책 본문(prompts/)을 startup 1회 조립. 조건은 startup-known 값(platform)만 — 조건부
    // 블록이 per-turn ctx 를 요구하면 그 시점에 빌더로 옮긴다. DB 프로젝트 지침은 빌더가 매 턴
    // 조회하므로(무캐시) 지침 편집 즉시 반영 불변.
    const stableAppend = buildAppend({ platform: process.platform }, loadPolicies())
    // 빌더는 db 인스턴스가 필요해 여기서 생성. skills 는 lazy getter 라 스캔
    // 완료 전에 만들어도 무방 — 턴 실행 시점에 최신 skillsCache 를 읽는다.
    const extensions = new ExtensionBuilder(db, this.mcp, () => this.skillsCache, stableAppend)
    await this.registry.refreshInstallState()
    this.defaultCwd = getWorkspacePath(null)
    await mkdir(this.defaultCwd, { recursive: true }).catch((e) =>
      console.warn('[boot] workspace 생성 실패:', e)
    )
    // ~/.config/orca 보장 → orca.json 로드 → provider settings 스캐폴드(최초 1회) →
    // dist/<engine> 배포(ExtensionDeployer) → settings 해석 캐시 무효화.
    // 어느 단계 실패도 부팅을 막지 않는다(채팅/세션 기능은 독립).
    await ensureConfigDir().catch((e) => console.warn('[boot] ensureConfigDir 실패:', e))
    try {
      loadOrcaConfig()
    } catch (e) {
      console.warn('[boot] orca.json 로드 건너뜀:', e)
    }
    const secretStore = new SecretStore()
    const providerSettings = new ProviderSettingsService({ claude: loadClaudeProviderSettings })
    try {
      const s = scaffoldProviderSettings('claude')
      for (const path of s.created) console.log('[scaffold] 생성:', path)
    } catch (e) {
      console.warn('[boot] provider settings 스캐폴드 건너뜀:', e)
    }
    // dist 렌더 + defaultCwd 싱크를 1회 수행(syncExtensions 가 deploy+sync+게이트 마킹을 묶는다).
    // 첫 턴의 syncExtensionsForTurn 은 이로써 이미 마킹된 defaultCwd 를 건너뛴다.
    this.syncExtensions()
    providerSettings.invalidateAll()
    // ClaudeAdapter 가 사용하는 cwd 와 동일한 값으로 스킬 스캔.
    await this.refreshSkills()

    const ctx: RouterContext = {
      db,
      settings: this.settings,
      mcp: this.mcp,
      registry: this.registry,
      installer: new Installer(this.registry),
      cost,
      secretStore,
      extensions,
      providerSettings,
      getSkills: () => this.skillsCache,
      refreshSkills: () => this.refreshSkills(),
      syncExtensions: () => this.syncExtensions(),
      syncExtensionsForTurn: (cwd) => this.syncExtensionsForTurn(cwd),
      getCwd: (projectId) => getWorkspacePath(projectId ? db.getProject(projectId) : null),
      debugMock: this.debugMock,
      mockAdapter: import.meta.env.DEV ? new MockAdapter(() => this.debugMock) : null
    }
    this.register(ctx)
  }

  // 앱 종료 정리(index.ts will-quit → closeDb 직전 동기 호출). 진행 중 모든 턴의 열린 도구를
  // 'aborted' 합성 tool_result 로 정착(persist)해 재시작 시 "실행 중" 잔재를 막고, controller 를
  // abort 해 SDK 서브프로세스를 깨끗이 종료한다. persist 는 better-sqlite3 동기라 종료 시간 내
  // 완료된다. start() 이전(register 미실행)이면 no-op.
  shutdown(): void {
    if (!this.supervisor || !this.persistence) return
    for (const turn of this.supervisor.all()) {
      try {
        settleOpenToolRuns(turn, this.persistence, 'aborted')
      } catch (e) {
        console.warn('[shutdown] 턴 정리 실패:', e)
      }
      turn.controller.abort()
    }
    // idle 로 보존된 Persistent 핸들(진행 턴 아님) 일괄 close(0054). 게이트 OFF 면 풀이 비어 no-op.
    this.supervisor.closeIdleRuntimes()
  }

  private register(ctx: RouterContext): void {
    // chat 턴 파이프라인 조립 — 레지스트리(세션 키잉) · persist · 제목 생성 · 승인 조정.
    const supervisor = (this.supervisor = new RuntimeSupervisor<Electron.WebContents>({
      concurrency: new ConcurrencyRegistry((projectId, count) =>
        broadcastConcurrency({ projectId, count })
      )
    }))
    const titles = new TitleGenerator(ctx.db)
    const persistence = (this.persistence = new TurnPersistence(ctx.db, ctx.cost, (turn) =>
      titles.maybeStart(turn)
    ))
    const approvals = new ApprovalCoordinator()
    const permissionModes = new PermissionModeController()
    const admission = new AdmissionController<Electron.WebContents>(new RejectDuplicatePolicy())
    registerChatHandlers({
      ctx,
      supervisor,
      approvals,
      persistence,
      titles,
      permissionModes,
      admission
    })
    approvals.registerHandlers(supervisor, permissionModes)

    registerSessionHandlers(ctx)
    registerProjectHandlers(ctx)
    registerMcpHandlers(ctx)
    registerEngineHandlers(ctx)
    registerMiscHandlers(ctx)
  }
}
