// Bootstrap — main 측 컴포지션 루트(app 레이어). 의존성 생성 + 부팅 시퀀스 + 핸들러 등록 위임만
// 담당한다. 도메인 핸들러는 app/handlers/, chat 턴 셋업은 app/chat-turn.ts, 턴 파이프라인 협력자는
// features/{chat,history,approvals,sessions,usage} 참조 (handoff 0062 수직 슬라이스 재구성).

import { app, webContents } from 'electron'
import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  CHANNELS,
  type DebugMockState,
  type NormalizedEvent,
  type SkillInfo
} from '../../shared/ipc'
import type { PluginDiagnostic } from '../../shared/protocol'
import type { RestartGateState } from '../../shared/update-restart'
import type { TurnContext } from '../contracts/turn'
import { AdapterRegistry } from '../adapters/registry'
import { MockAdapter } from '../adapters/mock'
import { SettingsStore } from '../infra/settings-store'
import { McpStore } from '../features/extensions/mcp/store'
import {
  ensureConfigDir,
  getWorkspacePath,
  orcaConfigDir,
  sourcesSkillsDir
} from '../infra/config/paths'
import { orcaPluginRoot } from '../features/extensions/claude-plugin-package'
import { userClaudePluginRoot } from '../features/extensions/claude-user-skills-plugin'
import { loadOrcaConfig } from '../infra/config/orca-config'
import { SecretStore } from '../infra/config/secret-store'
import { createSecretFacade as createProviderSecretFacade } from '../features/usage/external-usage'
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
import { createUsageSourcePort } from './usage-source'
import { netFetch } from '../infra/auth/net-fetch'
import { loadClaudeProviderSettings, readUserClaudeSettings } from '../adapters/claude-settings'
import { scanSkills, type SkillScanRoot } from '../features/extensions/skills/scan'
import { seedBuiltinSkills } from '../features/extensions/skills/seed'
import { initDb } from '../infra/db'
import { getLogger, setLogDebug } from '../infra/log'
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
import { registerAuthHandlers } from './handlers/auth'
import { registerPluginHandlers } from './handlers/plugins'
import { registerBootHandlers } from './handlers/boot'
import { registerUpdateHandlers } from './handlers/update'
import { registerLogHandlers } from './handlers/log'
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
import { recoverSessionHistory } from '../features/chat/recovery'
import {
  broadcastConcurrency,
  broadcastAuthState,
  broadcastChatEvent,
  sendChatEvent
} from '../infra/ipc/send'
import { AuthBroker } from '../features/auth-platform/broker'
import { restoreConnections } from './auth-restore'
import { PluginHost } from '../features/auth-platform/plugin-host'
import { AuthRegistry } from '../features/auth-platform/registry'
import { AUTH_PLUGIN_PACKAGES } from '../features/auth-platform/modules'
import { ConnectionRegistry } from '../features/connectors/registry'
import { ConnectorInstanceLifecycle } from '../features/connectors/instance-lifecycle'
import { ConnectorInstanceStore } from '../features/connectors/instance-store'
import { ConnectorTemplateRegistry } from '../features/connectors/templates'
import { confluenceTemplate } from '../features/auth-platform/modules/confluence'
import { ConnectorHost } from '../features/connectors/runtime'
import { RuntimeToolRegistry } from '../features/extensions/runtime-tool-registry'
import { BrowserSessionStore } from '../infra/auth/browser-session-store'
import { createBindingPersistence } from '../infra/auth/binding-store-file'
import { createCredentialVault } from '../infra/auth/credential-vault'
import { resolveBuiltinSkillsDir } from './builtin-resources'
import { BackgroundTaskTracker } from '../features/chat/background-tasks'
import { SessionActivityProjector } from '../features/chat/session-activity-projector'
import { clientLeaseKey } from '../features/sessions/session-chain-lease'
import { deriveLeaseGateState } from '../features/sessions/restart-gate'

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
    log: false
  }
  // 앱 종료(will-quit) 정리용 참조 — register() 에서 채워진다. 종료 시 진행 중 턴의 열린 도구를
  // 정착하고 controller 를 abort 한다(shutdown).
  private supervisor?: RuntimeSupervisor<Electron.WebContents>
  private bus?: MainBus<Electron.WebContents>
  private activeDbWriteCount = 0
  private isIndexing = false
  private updates: UpdateController | null = null
  private scheduler?: Scheduler
  // 0151 — 종료 시 admission freeze + payload 스크럽을 위해 루트가 참조를 보관한다.
  private pendingMessages?: PendingMessageQueue
  private activity?: SessionActivityProjector

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
    const log = getLogger().child('extensions')
    return new ExtensionDeploymentService({
      deploy: async () => {
        const { config, dropped } = toClaudeConfig(this.mcp.enabledConfig(), this.mcp.resolver())
        for (const d of dropped) {
          log.warn('mcp.server.skipped', { name: d.name, reason: d.reason })
        }
        const result = await deploy('claude', {
          skillRoots: this.skillRoots(),
          mcpConfig: config
        })
        // 확장 배포 경계(0124 카탈로그) — 실패는 서비스가 삼키고 onWarning 으로 회귀하므로
        // extensions.deploy.failed 는 아래 onWarning 배선(warn)이 담당한다.
        log.info('extensions.deploy.completed', {
          standard: 'claude',
          validationOk: result.validation.ok
        })
        return result
      },
      onWarning: (message) => log.warn('extensions.deploy.warning', { message })
    })
  }

  // 인증 플랫폼 조립 (0157). 여기가 유일한 구체 배선 지점이다 — broker·registry·provider 는
  // 서로를 직접 만들지 않는다. connector runtime 은 `AuthenticatedFetch` 구조적 포트로만
  // broker 에 닿는다(features 교차 import 회피, src/main/AGENTS.md §해소책 2+3).
  private createAuthPlatform(secretStore: SecretStore): {
    broker: AuthBroker
    connectors: ConnectorHost
    pluginHost: PluginHost
    runtimeTools: RuntimeToolRegistry
    sessions: BrowserSessionStore
    templates: ConnectorTemplateRegistry
    instances: ConnectorInstanceLifecycle
    diagnostics: PluginDiagnostic[]
  } {
    const log = getLogger().child('auth')
    const registry = new AuthRegistry()
    const sessions = new BrowserSessionStore()
    // 거부 사유를 모아 renderer 로 올린다(0164 r2). 등록은 패키지 단위 all-or-nothing 이라
    // `baseUrl` 하나가 잘못되면 그 패키지의 서버가 **전부** 사라진다 — 흔적이 로그뿐이면
    // 사용자에게는 "servers.ts 에 넣었는데 UI 에 없다" 로만 보인다.
    const diagnostics: PluginDiagnostic[] = []

    // opt-in 패키지 등록. 신규 설치는 빈 배열 = 게이트 없음(현행 동작 보존).
    for (const pkg of AUTH_PLUGIN_PACKAGES) {
      const errors = registry.register({
        manifest: pkg.manifest,
        ...(pkg.providers !== undefined ? { providers: pkg.providers } : {}),
        ...(pkg.connectors !== undefined ? { connectors: pkg.connectors } : {}),
        ...(pkg.runtimeTools !== undefined ? { runtimeTools: pkg.runtimeTools } : {})
      })
      for (const e of errors) {
        log.warn('auth.package.rejected', {
          pluginId: e.pluginId,
          ...(e.contributionId !== undefined ? { contributionId: e.contributionId } : {}),
          message: e.message
        })
        diagnostics.push({ kind: 'package', subject: e.pluginId, message: e.message })
      }
    }
    // 0161 — 템플릿 공용 패키지 + 사용자가 추가한 인스턴스를 복원한다. 정적 opt-in 패키지
    // (위 루프)와 **공존**한다(사용자 결정). cross-reference 검사 **앞**에 둬야 인스턴스
    // connector 의 provider 참조까지 같은 패스에서 검증된다.
    const templates = new ConnectorTemplateRegistry([confluenceTemplate])
    const instanceStore = new ConnectorInstanceStore({
      read: () => this.settings.getAll().connectorInstances,
      write: (list) => void this.settings.patch({ connectorInstances: [...list] })
    })
    const composition: { pluginHost: PluginHost | null } = { pluginHost: null }
    const instances = new ConnectorInstanceLifecycle({
      store: instanceStore,
      templates,
      registry,
      host: {
        disconnectIfConnected: async (connectorId) => {
          await composition.pluginHost?.disconnectIfConnected(connectorId)
        }
      },
      logger: (message, meta) => log.warn(message, meta)
    })
    for (const failure of instances.restore().failed) {
      log.warn('connector.instance.rejected', {
        connectorId: failure.instance.connectorId,
        message: failure.message
      })
      diagnostics.push({
        kind: 'instance',
        subject: failure.instance.connectorId,
        message: failure.message
      })
    }

    for (const e of registry.validateCrossReferences()) {
      log.warn('auth.package.cross-reference-failed', {
        pluginId: e.pluginId,
        message: e.message
      })
      diagnostics.push({ kind: 'cross-reference', subject: e.pluginId, message: e.message })
    }

    // browser_session capability 를 선언한 provider 의 session group 을 미리 등록한다.
    for (const provider of registry.listProviders()) {
      const { sessionGroup, allowedOrigins } = provider.descriptor
      if (sessionGroup) sessions.register({ sessionGroup, allowedOrigins })
    }

    const runtimeTools = new RuntimeToolRegistry()
    const broker = new AuthBroker({
      registry,
      vaultFor: (prefix) => createCredentialVault(secretStore, prefix),
      // 재시작 후에도 연결이 남게 한다 (0170). 비밀은 이 파일이 아니라 vault 에 있다.
      bindingPersistence: createBindingPersistence(),
      // main 의 원격 요청은 전부 Chromium 네트워크 스택을 탄다 (0173) — 사내 프록시·사설 CA.
      fetchImpl: netFetch,
      browserSessions: {
        acquire: async (group) => sessions.acquire(group),
        openLoginWindow: (handleId, opts) => sessions.openLoginWindow(handleId, opts),
        probe: (handleId, url) => sessions.probe(handleId, url),
        clear: (handleId, opts) => sessions.clear(handleId, opts)
      },
      broadcast: broadcastAuthState,
      onBindingsEnded: async (bindingIds) => {
        const host = composition.pluginHost
        if (!host) throw new Error('auth platform composition is not ready')
        await host.onBindingsEnded(bindingIds)
      }
    })

    const connections = new ConnectionRegistry()
    const connectors = new ConnectorHost({
      connections,
      lookup: registry,
      authenticatedFetch: (req, signal) => broker.authenticatedFetch(req, signal)
    })
    const pluginHost = new PluginHost({
      registry,
      bindings: { getBinding: (bindingId) => broker.getBinding(bindingId) },
      connectors,
      logout: { logout: (bindingId, cascade) => broker.logout(bindingId, cascade) },
      runtimeTools,
      // 목록 DTO 의 `source` 판정 — 사용자가 추가한 서버만 UI 에서 삭제할 수 있다.
      instances: { isUserInstance: (connectorId) => instances.isUserInstance(connectorId) },
      logger: (message, meta) => log.warn(message, meta)
    })
    composition.pluginHost = pluginHost
    return {
      broker,
      connectors,
      pluginHost,
      runtimeTools,
      sessions,
      templates,
      instances,
      diagnostics
    }
  }

  // 복원 → 재연결. 예외는 여기서 끝난다 — 부팅 경로가 이 실패로 죽지 않아야 한다.
  private async restoreAuthConnections(auth: {
    broker: AuthBroker
    pluginHost: PluginHost
  }): Promise<void> {
    const log = getLogger().child('auth')
    try {
      const restored = auth.broker.restore()
      if (restored.length === 0) return
      await restoreConnections({
        restored,
        connect: (input) => auth.pluginHost.connect(input),
        logout: (bindingId, cascade) => auth.broker.logout(bindingId, cascade),
        logger: (message, meta) => log.warn(message, meta)
      })
      log.info('auth.restore.done', { count: restored.length })
    } catch (error) {
      log.warn('auth.restore.failed', { message: String(error) })
    }
  }

  private async deployExtensions(): Promise<void> {
    await this.deployment?.deployNow()
  }

  private async ensureExtensionsDeployedForTurn(): Promise<void> {
    await this.deployment?.ensureDeployed()
  }

  async start(): Promise<void> {
    // 인증 게이트는 창 오픈 직후 renderer 가 status 를 invoke 하므로(0109/0157) 부팅 최상단에서
    // 플랫폼 조립 + 핸들러 조기 등록.
    const secretStore = new SecretStore()
    const auth = this.createAuthPlatform(secretStore)
    registerAuthHandlers(auth.broker)
    registerPluginHandlers({
      pluginHost: auth.pluginHost,
      templates: auth.templates,
      instances: auth.instances,
      diagnostics: auth.diagnostics
    })
    // MCP `${BINDING:<id>}` 해석을 broker 로 잇는다 (0157). 이 배선이 없으면 binding 참조는
    // 미해결로 남아 해당 MCP 서버가 드롭된다(fail-closed).
    this.mcp.attachBindings(auth.broker)

    // 저장된 connector 연결을 되살린다 (0170). **부팅을 막지 않는다** — 사내망 밖이면
    // connector `start()` 가 타임아웃까지 가므로 await 하지 않고, 실패는 restoreConnections 가
    // 삼켜 해당 binding 만 정리한다.
    void this.restoreAuthConnections(auth)

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
      () => recoverSessionHistory(db)
    )
    if (recovered.toolResultsWritten > 0) {
      // dev 진단(구 is.dev 콘솔) — debug 레벨 자체가 dev 전용이라 별도 가드 불요.
      getLogger()
        .child('chat')
        .debug('chat.recovery.settled', { ...recovered })
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
    // 주기 업데이트 확인(0156). this.updates 는 아직 null 이지만 액션은 *발화 시점* 에 평가되고
    // 첫 발화는 최소 1시간 뒤라 ctx 조립(createUpdateController)을 기다린다 — 등록을 뒤로 미루면
    // 아래 applySettings 가 미등록 key 로 throw 하므로 순서를 바꾸지 말 것.
    scheduler.register('update-check', () => this.runBackgroundUpdateCheck())
    try {
      scheduler.applySettings(this.settings.getAll().scheduler)
    } catch (e) {
      getLogger()
        .child('scheduler')
        .warn('scheduler.settings.failed', {
          message: String(e),
          reason: 'starting with periodic jobs disabled'
        })
    }

    const extensions = new ExtensionBuilder(
      db,
      this.mcp,
      () => this.skillsCache,
      () => this.settings.getAll(),
      app.getVersion(),
      // Orca plugin + 사용자 ~/.claude/skills 래퍼 plugin(0117) — 존재 검증은 adaptPlugins 몫.
      // 경로는 각 플러그인 레이아웃을 소유한 feature 렌더러의 헬퍼에서 파생한다(이중 정의 방지).
      () => [
        orcaPluginRoot(orcaConfigDir(), 'claude'),
        userClaudePluginRoot(orcaConfigDir(), 'claude')
      ],
      auth.runtimeTools
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
    this.bootReport.stepSync('orca-config', { critical: false, label: 'orca.json 로드' }, () => {
      const cfg = loadOrcaConfig()
      // orca.json "debug":true 면 prod 파일 레벨을 info→debug 로 올린다(0144). dev 는 항상 debug.
      setLogDebug(cfg.debug === true)
    })
    await this.bootReport.step(
      'builtin-skill-seed',
      { critical: false, label: '기본 스킬 seed' },
      async () => {
        const result = await seedBuiltinSkills(this.builtinSkillsDir(), sourcesSkillsDir())
        const seedLog = getLogger().child('extensions')
        for (const name of result.seeded) seedLog.debug('extensions.skill.seeded', { name })
        for (const name of result.pruned) seedLog.debug('extensions.skill.pruned', { name })
      }
    )
    const providerSettings = new ProviderSettingsService({ claude: loadClaudeProviderSettings })
    // 0157: 구 SSO 의 setProviderEnv sink 를 제거했다. 획득 토큰을 provider settings.json 의
    // env 블록에 **평문으로 병합 기록**하던 경로였다(보고서 위험 #5). 이제 credential 은
    // binding·vault 가 소유하고, LLM 백엔드로 나가는 값은 사용자가 직접 적은 것만 남는다.
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
        const scaffoldLog = getLogger().child('providers')
        for (const path of s.created) scaffoldLog.debug('providers.scaffold.created', { path })
        const staticProviders = materializeStaticProviderSettings()
        for (const path of staticProviders.created) {
          scaffoldLog.debug('providers.static.created', { path })
        }
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
      // 0157 — raw SecretStore 를 넘기지 않는다. provider 별 네임스페이스 뷰만 준다.
      secretFor: (providerKey) => createProviderSecretFacade(secretStore, providerKey),
      providers: STATIC_USAGE_PROVIDERS,
      // 원격 사용량 보고서도 Chromium 스택으로 나간다 (0173).
      fetchImpl: netFetch,
      // 0176 — 인증이 필요한 사용량 API 는 usage connector 가 부르고, 그 결과 표본을 usage
      // provider 가 구독한다. 여기가 두 슬라이스를 잇는 유일한 지점이다.
      sources: createUsageSourcePort({
        list: () => auth.pluginHost.list(),
        invokeConnector: (connectorId, request, signal) =>
          auth.pluginHost.invokeConnector(connectorId, request, signal)
      })
    })
    scheduler.register('provider-usage-report-refresh', async () => {
      const providerKeys = providerSettings
        .adapters()
        .flatMap((adapter) => providerSettings.list(adapter).map((entry) => entry.key))
      await externalUsage.refreshAll(providerKeys)
    })
    // 1분 주기 (사용자 결정 2026-08-05, 구 `*/5`). 한 틱이 겹쳐도 원격 호출은 늘지 않는다 —
    // providerKey 단위 in-flight 병합 + 표본 단위 dedupe(0176)가 중복 호출을 접고, 각 호출은
    // 5초 타임아웃을 건다.
    scheduler.schedule('provider-usage-report-refresh', { enabled: true, cron: '* * * * *' })
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
      externalUsage,
      auth: auth.broker,
      connectors: auth.connectors,
      pluginHost: auth.pluginHost,
      runtimeTools: auth.runtimeTools
    }
    this.register(ctx)
  }

  restartGateState(): RestartGateState {
    // lease 파생은 순수 모듈이 소유한다(features/sessions/restart-gate) — 회귀 테스트 가능해야
    // "작업 중 업데이트 설치" 가 다시 열리는 것을 잡는다.
    const gate = deriveLeaseGateState(this.supervisor?.allLeases() ?? [])
    return {
      ...gate,
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

  // 사용자가 부르지 않은 업데이트 확인의 단일 진입점 — 부팅 1회(index.ts)와 주기 잡이 함께 쓴다.
  // background=true 결정을 여기 한 곳이 소유해, 호출부마다 벌거벗은 불리언이 흩어지지 않게 한다.
  async runBackgroundUpdateCheck(): Promise<void> {
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
    // admission freeze 를 **가장 먼저**(0151 AC9) — 이후 send/steer 예약을 거부해, 종료 중
    // 게이트 flush·자동 연속 턴이 큐 폐기와 경합하며 메시지를 뒤늦게 제출하는 것을 막는다.
    this.pendingMessages?.freeze()
    this.scheduler?.stopAll()
    if (!this.supervisor || !this.bus) {
      // 조기 반환 경로에서도 미커밋 payload 는 반드시 스크럽한다.
      this.pendingMessages?.disposeAll()
      this.activity?.dispose()
      return
    }
    const bus = this.bus
    // 열린 도구를 'aborted' 합성 tool_result 로 정착 → turn.event 버스로 방출(history 구독자가 영속).
    const emit = (turn: TurnContext<Electron.WebContents>, ev: NormalizedEvent): void => {
      try {
        bus.emit('turn.event', { turn, ev })
      } catch (e) {
        getLogger()
          .child('chat')
          .warn('chat.turn-event.emit-failed', { phase: 'shutdown', message: String(e) })
      }
    }
    for (const turn of this.supervisor.all()) {
      settleOpenToolRuns(turn, emit, 'aborted')
      turn.controller.abort()
    }
    this.supervisor.closeAllLeaseRuntimes()
    // idle 로 보존된 Persistent 핸들(진행 턴 아님) 일괄 close(0054). 게이트 OFF 면 풀이 비어 no-op.
    this.supervisor.closeIdleRuntimes()
    // 런타임을 모두 닫은 **뒤** 미커밋 pending 을 스크럽하고 맵을 비운다(0151 AC8) — pending 은
    // 비영속이 정책이라 다음 실행에서 복원하지 않는다. 순서가 중요하다: 채널이 살아 있는 동안
    // 지우면 진행 중 flush 가 빈 큐를 보고 조용히 유실될 수 있다.
    this.pendingMessages?.disposeAll()
    this.activity?.dispose()
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
    supervisor.subscribeLeases(() => this.updateStateChanged())
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
    const pendingMessages = (this.pendingMessages = new PendingMessageQueue())
    const backgroundTasks = new BackgroundTaskTracker()
    const activity = (this.activity = new SessionActivityProjector({
      queue: pendingMessages,
      backgroundTasks,
      leases: {
        subscribe: (listener) => supervisor.subscribeLeases(listener),
        foreground: (sessionId, transport) => {
          const lease =
            supervisor.getChainBySession(sessionId) ??
            supervisor.getChainByKey(clientLeaseKey(sessionId))
          if (!lease) return 'idle'
          if (lease.kind === 'preparing') return 'preparing'
          if (lease.kind === 'active' && lease.activeChild && transport === 'idle') {
            return 'streaming'
          }
          return 'idle'
        }
      },
      emit: broadcastChatEvent
    }))
    registerChatHandlers({
      ctx,
      supervisor,
      bus,
      approvals,
      persistence,
      permissionModes,
      pendingMessages,
      backgroundTasks,
      activity,
      isUpdateInstallPending: () => this.isUpdateInstallPending()
    })
    approvals.registerHandlers(supervisor, permissionModes)

    // 세션 삭제 시 미커밋 pending 도 함께 폐기한다(0151 AC8) — 루트가 chat 큐를 주입해
    // session 슬라이스가 chat 슬라이스를 참조하지 않게 한다.
    registerSessionHandlers(ctx, {
      onSessionDisposed: (sessionId) => {
        // DB 행을 지우기 전에 호출되는 hook에서 active/idle provider 수명도 함께 끊는다. lease가
        // child 교체 중이어도 runtime을 직접 소유하므로 삭제된 세션이 뒤늦게 영속화를 재개하지 않는다.
        supervisor.discardRuntime(sessionId)
        pendingMessages.dispose(sessionId)
        backgroundTasks.clear(sessionId)
        activity.clear(sessionId)
      },
      getActivity: (sessionId) => activity.current(sessionId)
    })
    registerProjectHandlers(ctx)
    registerMcpHandlers(ctx)
    registerEngineHandlers(ctx)
    registerBootHandlers(ctx)
    registerUpdateHandlers(ctx)
    registerMiscHandlers(ctx)
    registerLogHandlers()
  }
}
