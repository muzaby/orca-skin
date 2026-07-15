// Bootstrap — main 측 컴포지션 루트(app 레이어). 의존성 생성 + 부팅 시퀀스 + 핸들러 등록 위임만
// 담당한다. 도메인 핸들러는 app/handlers/, chat 턴 셋업은 app/chat-turn.ts, 턴 파이프라인 협력자는
// features/{chat,history,approvals,sessions,usage} 참조 (handoff 0062 수직 슬라이스 재구성).

import { app, webContents } from 'electron'
import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import {
  CHANNELS,
  type DebugMockState,
  type NormalizedEvent,
  type SkillInfo
} from '../../shared/ipc'
import type { RestartGateState } from '../../shared/update-restart'
import type { TurnContext } from '../contracts/turn'
import { AdapterRegistry } from '../adapters/registry'
import { MockAdapter } from '../adapters/mock'
import { SettingsStore } from '../infra/settings-store'
import { McpStore } from '../features/extensions/mcp/store'
import {
  distOrcaPluginDir,
  ensureConfigDir,
  getWorkspacePath,
  sourcesSkillsDir
} from '../infra/config/paths'
import { loadOrcaConfig } from '../infra/config/orca-config'
import { SecretStore } from '../infra/config/secret-store'
import { deploy } from '../features/extensions/deployer'
import { ExtensionDeploymentService } from '../features/extensions/extension-deployment-service'
import { toClaudeConfig } from '../features/extensions/mcp/convert'
import { scaffoldProviderSettings } from '../features/extensions/scaffold'
import { ProviderSettingsService } from '../features/providers/provider-settings'
import {
  STATIC_USAGE_PROVIDERS,
  materializeStaticProviderSettings
} from '../features/providers/static'
import { ExternalUsageService } from '../features/usage/external-usage-service'
import { loadClaudeProviderSettings, readUserClaudeSettings } from '../adapters/claude-settings'
import { scanSkills, type SkillScanRoot } from '../features/extensions/skills/scan'
import { seedBuiltinSkills } from '../features/extensions/skills/seed'
import { initDb } from '../infra/db'
import { UsageTracker } from '../features/usage/tracker'
import { DbRunRecorder, Scheduler } from '../features/scheduler'
import { ExtensionBuilder } from '../features/extensions/builder'
import { PermissionModeController } from '../features/approvals/permission-mode-controller'
import type { RouterContext } from './context'
import { registerSessionHandlers } from './handlers/session'
import { registerProjectHandlers } from './handlers/project'
import { registerMcpHandlers } from './handlers/mcp'
import { registerEngineHandlers } from './handlers/engine'
import { registerMiscHandlers } from './handlers/misc'
import { registerBootHandlers } from './handlers/boot'
import { registerUpdateHandlers } from './handlers/update'
import { createNoopUpdater, loadElectronAutoUpdater, UpdateController } from './updater'
import { registerChatHandlers } from './chat-turn'
import { createBootReportRecorder } from './boot-report'
import { RuntimeSupervisor } from '../features/sessions/supervisor'
import { BoundedRuntimeCapPolicy } from '../features/sessions/runtime-cap-policy'
import { PendingMessageQueue } from '../features/chat/pending-message-queue'
import { ActiveTurnTracker } from '../features/sessions/active-turn-tracker'
import { TypedBus } from '../infra/bus'
import type { MainBus, OrcaBusEvents } from '../contracts/bus-events'
import { settleOpenToolRuns } from '../features/chat/settle'
import { recordTurnUsage } from '../features/usage/subscriber'
import { ApprovalCoordinator } from '../features/approvals/coordinator'
import { HistoryWriter } from '../features/history/writer'
import { materializeContinuityArrival } from '../features/orchestration/fork'
import { TitleGenerator } from '../features/chat/title-generation'
import {
  recoverDanglingToolCalls,
  rebuildIncompleteMessageContent
} from '../features/chat/recovery'
import { broadcastConcurrency, sendChatEvent } from '../infra/ipc/send'
import { resolveBuiltinSkillsDir } from './builtin-resources'

export class Bootstrap {
  private readonly bootReport = createBootReportRecorder()
  readonly settings = new SettingsStore(app.getVersion())
  readonly mcp = new McpStore(this.settings)
  private readonly registry = new AdapterRegistry()
  // 부팅 시 1회 스캔하여 메모리에 캐시. fs.watch hot-reload 는 본 PR 범위 밖 (재시작).
  private skillsCache: SkillInfo[] = []
  // chat send 와 files list, session cwd 노출에서 모두 동일하게 사용하는 단일
  // cwd. 기본은 ~/.config/orca/workspace — 향후 사용자 선택 디렉토리로 확장 가능.
  private defaultCwd: string = ''
  // sources→dist plugin 배포 freshness 관리. boot/CRUD/턴 진입 전 최신화를 보장한다.
  private deployment?: ExtensionDeploymentService
  private readonly debugMock: DebugMockState = {
    enabled: false,
    scenarioId: 'full',
    contextUsageRatio: 0.3,
    wireLog: false
  }
  // 앱 종료(will-quit) 정리용 참조 — register() 에서 채워진다. 종료 시 진행 중 턴의 열린 도구를
  // 정착하고 controller 를 abort 한다(shutdown).
  private supervisor?: RuntimeSupervisor<Electron.WebContents>
  private bus?: MainBus<Electron.WebContents>
  private activeDbWriteCount = 0
  private isIndexing = false
  private updates: UpdateController | null = null
  private scheduler?: Scheduler

  private builtinSkillsDir(): string {
    return resolveBuiltinSkillsDir({
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      appPath: app.getAppPath()
    })
  }

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

  private createDeploymentService(): ExtensionDeploymentService {
    return new ExtensionDeploymentService({
      deploy: async () => {
        const { config, dropped } = toClaudeConfig(this.mcp.enabledConfig(), this.mcp.resolver())
        for (const d of dropped) console.warn(`[mcp] 서버 '${d.name}' 를 건너뜀: ${d.reason}`)
        return deploy('claude', {
          skillRoots: this.skillRoots(),
          mcpConfig: config
        })
      },
      onWarning: (message) => console.warn(message)
    })
  }

  private async deployExtensions(): Promise<void> {
    await this.deployment?.deployNow()
  }

  private async ensureExtensionsDeployedForTurn(): Promise<void> {
    await this.deployment?.ensureDeployed()
  }

  async start(): Promise<void> {
    const db = this.bootReport.stepSync('db-init', { critical: true, label: 'DB 초기화' }, () =>
      initDb({
        onBackupStart: () => {
          this.activeDbWriteCount += 1
        },
        onBackupEnd: () => {
          this.activeDbWriteCount = Math.max(0, this.activeDbWriteCount - 1)
        }
      })
    )
    const recovered = this.bootReport.stepSync(
      'chat-recovery',
      { critical: true, label: '미완료 도구 호출 복구' },
      () => {
        // content 재구성이 먼저다(0107) — recover 가 complete 를 올리면 대상 식별 불가.
        rebuildIncompleteMessageContent(db)
        return recoverDanglingToolCalls(db)
      }
    )
    if (recovered.toolResultsWritten > 0 && is.dev) {
      console.log('[recovery] dangling tools settled:', recovered)
    }
    // 비용 요약 IPC 송출 배선 — domain(UsageTracker)은 electron 비의존, 송출은 여기(컴포지션 루트)서.
    const cost = new UsageTracker(db, (summary) => {
      for (const wc of webContents.getAllWebContents()) {
        if (!wc.isDestroyed()) wc.send(CHANNELS.costSummaryEvent, summary)
      }
    })
    this.bootReport.stepSync('cost-recompute', { critical: true, label: '비용 요약 재계산' }, () =>
      cost.recompute()
    )
    // 빌더는 db 인스턴스가 필요해 여기서 생성. skills 는 lazy getter 라 스캔 완료 전에 만들어도
    // 무방 — 턴 실행 시점에 최신 skillsCache 를 읽는다. DB 프로젝트 지침은 빌더가 매 턴 조회하므로
    // (무캐시) 지침 편집이 같은 세션 다음 메시지부터 즉시 반영된다.
    const scheduler = (this.scheduler = new Scheduler(new DbRunRecorder(db)))
    scheduler.register('usage-recompute', () => {
      cost.recordAndBroadcast()
    })
    try {
      scheduler.applySettings(this.settings.getAll().scheduler)
    } catch (e) {
      console.warn('[scheduler] 설정 적용 실패, 주기 작업을 비활성 상태로 시작:', e)
    }

    const extensions = new ExtensionBuilder(
      db,
      this.mcp,
      () => this.skillsCache,
      () => this.settings.getAll(),
      app.getVersion(),
      () => distOrcaPluginDir('claude')
    )
    await this.bootReport.step(
      'adapter-registry',
      { critical: true, label: '어댑터 설치 상태 갱신' },
      () => this.registry.refreshInstallState()
    )
    this.defaultCwd = getWorkspacePath(null)
    await this.bootReport.step('workspace', { critical: false, label: '기본 작업공간 보장' }, () =>
      mkdir(this.defaultCwd, { recursive: true })
    )
    // ~/.config/orca 보장 → orca.json 로드 → provider settings 스캐폴드(최초 1회) →
    // dist/<engine> 배포(ExtensionDeployer) → settings 해석 캐시 무효화.
    // 어느 단계 실패도 부팅을 막지 않는다(채팅/세션 기능은 독립).
    await this.bootReport.step(
      'config-dir',
      { critical: false, label: 'Orca 설정 디렉터리 보장' },
      () => ensureConfigDir()
    )
    this.bootReport.stepSync('orca-config', { critical: false, label: 'orca.json 로드' }, () =>
      loadOrcaConfig()
    )
    await this.bootReport.step(
      'builtin-skill-seed',
      { critical: false, label: '기본 스킬 seed' },
      async () => {
        const result = await seedBuiltinSkills(this.builtinSkillsDir(), sourcesSkillsDir())
        for (const name of result.seeded) console.log('[seed] builtin skill:', name)
        for (const name of result.pruned) console.log('[seed] prune builtin skill:', name)
      }
    )
    const secretStore = new SecretStore()
    const providerSettings = new ProviderSettingsService({ claude: loadClaudeProviderSettings })
    this.bootReport.stepSync(
      'provider-scaffold',
      { critical: false, label: 'provider settings 스캐폴드' },
      () => {
        // 첫 시작(빈 상태)이면 사용자 전역 ~/.claude/settings.json 을 시드로 쓴다 (0090).
        const userSettings = readUserClaudeSettings()
        const s = scaffoldProviderSettings(
          'claude',
          undefined,
          userSettings.exists ? userSettings.settingsJson : null
        )
        for (const path of s.created) console.log('[scaffold] 생성:', path)
        const staticProviders = materializeStaticProviderSettings()
        for (const path of staticProviders.created) console.log('[static-provider] 생성:', path)
      }
    )
    // dist/claude/plugins/orca 렌더를 boot 1회 수행한다. CRUD 는 즉시 재배포, 턴 진입은
    // ensureDeployed 로 실패/dirty 상태를 한 번 더 보장한다.
    this.deployment = this.createDeploymentService()
    await this.bootReport.step('extension-deploy', { critical: false, label: '확장 배포' }, () =>
      this.deployExtensions()
    )
    providerSettings.invalidateAll()
    const externalUsage = new ExternalUsageService({
      db,
      secretStore,
      providers: STATIC_USAGE_PROVIDERS
    })
    scheduler.register('provider-usage-report-refresh', async () => {
      const providerKeys = providerSettings
        .adapters()
        .flatMap((adapter) => providerSettings.list(adapter).map((entry) => entry.key))
      await externalUsage.refreshAll(providerKeys)
    })
    scheduler.schedule('provider-usage-report-refresh', { enabled: true, cron: '*/5 * * * *' })
    // ClaudeAdapter 가 사용하는 cwd 와 동일한 값으로 스킬 스캔.
    await this.bootReport.step('skill-scan', { critical: false, label: '스킬 스캔' }, () =>
      this.refreshSkills()
    )
    this.bootReport.finish()

    const ctx: RouterContext = {
      db,
      settings: this.settings,
      mcp: this.mcp,
      registry: this.registry,
      cost,
      secretStore,
      extensions,
      providerSettings,
      getSkills: () => this.skillsCache,
      refreshSkills: () => this.refreshSkills(),
      deployExtensions: () => this.deployExtensions(),
      ensureExtensionsDeployedForTurn: () => this.ensureExtensionsDeployedForTurn(),
      getCwd: (projectId) => getWorkspacePath(projectId ? db.getProject(projectId) : null),
      getBootReport: () => this.bootReport.getReport(),
      debugMock: this.debugMock,
      mockAdapter: import.meta.env.DEV ? new MockAdapter(() => this.debugMock) : null,
      updates: this.createUpdateController(),
      scheduler,
      externalUsage
    }
    this.register(ctx)
  }

  restartGateState(): RestartGateState {
    const turns = this.supervisor?.all() ?? []
    return {
      isGenerating: turns.length > 0,
      activeToolCallCount: turns.reduce((sum, turn) => sum + turn.openToolRuns.size, 0),
      activeDbWriteCount: this.activeDbWriteCount,
      isIndexing: this.isIndexing
    }
  }

  prepareForUpdateInstall(): void {
    this.supervisor?.closeIdleRuntimes()
  }

  updateStateChanged(): void {
    this.updates?.refreshGate()
  }

  isUpdateInstallPending(): boolean {
    return this.updates?.isInstallPending() ?? false
  }

  async checkForUpdatesOnStartup(): Promise<void> {
    await this.updates?.check(true)
  }

  private createUpdateController(): UpdateController {
    if (this.updates) return this.updates
    const updater = loadElectronAutoUpdater() ?? createNoopUpdater()
    this.updates = new UpdateController({
      updater,
      restartGateState: () => this.restartGateState(),
      prepareForUpdateInstall: () => this.prepareForUpdateInstall()
    })
    return this.updates
  }

  // 앱 종료 정리(index.ts will-quit → closeDb 직전 동기 호출). 진행 중 모든 턴의 열린 도구를
  // 'aborted' 합성 tool_result 로 정착(persist)해 재시작 시 "실행 중" 잔재를 막고, controller 를
  // abort 해 SDK 서브프로세스를 깨끗이 종료한다. persist 는 better-sqlite3 동기라 종료 시간 내
  // 완료된다. start() 이전(register 미실행)이면 no-op.
  shutdown(): void {
    this.scheduler?.stopAll()
    if (!this.supervisor || !this.bus) return
    const bus = this.bus
    // 열린 도구를 'aborted' 합성 tool_result 로 정착 → turn.event 버스로 방출(history 구독자가 영속).
    const emit = (turn: TurnContext<Electron.WebContents>, ev: NormalizedEvent): void => {
      try {
        bus.emit('turn.event', { turn, ev })
      } catch (e) {
        console.warn('[shutdown] turn.event 방출 실패:', e)
      }
    }
    for (const turn of this.supervisor.all()) {
      settleOpenToolRuns(turn, emit, 'aborted')
      turn.controller.abort()
    }
    // idle 로 보존된 Persistent 핸들(진행 턴 아님) 일괄 close(0054). 게이트 OFF 면 풀이 비어 no-op.
    this.supervisor.closeIdleRuntimes()
  }

  private register(ctx: RouterContext): void {
    // chat 턴 파이프라인 조립 — 레지스트리(세션 키잉) · persist · 제목 생성 · 승인 조정.
    const supervisor = (this.supervisor = new RuntimeSupervisor<Electron.WebContents>({
      activeTurns: new ActiveTurnTracker((projectId, count) => {
        broadcastConcurrency({ projectId, count })
        this.updateStateChanged()
      }),
      // 0067: 장수명 채널 거버넌스 — 동시 생존 런타임 cap 5(사용자 확정), 초과 시 idle LRU 축출.
      // 세션 수명 = 프로그램 종료(shutdown→closeIdleRuntimes) or 이 축출뿐(IdleCloseTimer 폐기).
      capPolicy: new BoundedRuntimeCapPolicy(),
      capacity: 5
    }))
    // turn.event 단일 파이프라인(스펙 §4.2). **구독 순서 = SSOT**: usage(집계) → history(영속) →
    // title(제목) → relay(renderer 중계). usage 가 history 의 currentAssistantMessageId reset *전* 에
    // 그 messageId 를 읽고, title 이 relay 전에 트리거되는 순서 불변식을 이 등록 순서 한 곳이 소유한다.
    // usage·history 는 critical(throw=턴 실패 전파), title·relay 는 격리(실패가 파이프라인을 안 죽임).
    const bus = (this.bus = new TypedBus<OrcaBusEvents<Electron.WebContents>>())
    const titles = new TitleGenerator(ctx.db)
    // continuity 도착 물질화(0064 fork/handoff)는 orchestration 슬라이스 구현을 여기서 주입
    // — history↔orchestration 교차 import 차단.
    const persistence = new HistoryWriter(ctx.db, (arrival) =>
      materializeContinuityArrival(ctx.db, arrival)
    )
    bus.on(
      'turn.event',
      ({ turn, ev }) => {
        if (ev.type === 'telemetry') recordTurnUsage(ctx.db, ctx.cost, turn, ev)
      },
      { critical: true }
    )
    bus.on('turn.event', ({ turn, ev }) => persistence.persist(turn, ev), { critical: true })
    bus.on('turn.event', ({ turn, ev }) => {
      if (ev.type === 'session.updated' || ev.type === 'telemetry') titles.maybeStart(turn)
    })
    bus.on('turn.event', ({ turn, ev }) => sendChatEvent(turn.owner, ev))

    const approvals = new ApprovalCoordinator()
    const permissionModes = new PermissionModeController()
    // 0067 AC10: AdmissionController 폐기 — busy send = pending queue 예약(chat-turn 소유).
    const pendingMessages = new PendingMessageQueue()
    registerChatHandlers({
      ctx,
      supervisor,
      bus,
      approvals,
      persistence,
      permissionModes,
      pendingMessages,
      isUpdateInstallPending: () => this.isUpdateInstallPending()
    })
    approvals.registerHandlers(supervisor, permissionModes)

    registerSessionHandlers(ctx)
    registerProjectHandlers(ctx)
    registerMcpHandlers(ctx)
    registerEngineHandlers(ctx)
    registerBootHandlers(ctx)
    registerUpdateHandlers(ctx)
    registerMiscHandlers(ctx)
  }
}
