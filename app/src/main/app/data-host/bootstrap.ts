// 데이터 호스트(상태)의 조립 (0324 D-034~D-042 · §7-F 4b · EP-20).
//
// DB·설정·비밀·인증 파일을 여는 유일한 프로세스다. 인증·게이트·사용량·플러그인(D-038) · 턴 저장 ·
// 세션·프로젝트·검색·산출물·첨부·예약 작업·MCP·스킬 핸들러 · 하네스 실행 구성(인증에 묶여 있다, 구현
// 보고 G-B) · 오류 보고와 부팅 단계 모음(D-042)이 여기 있다. 하네스·SDK·git·셸 프로세스는 없다 —
// 실행이 필요한 일은 에이전트 링크로 부탁한다(F4 · EP-21).
//
// 시작 순서: 설정 읽기 핸들러(0244) → 비밀 해제(D-040) → 인증 스택(DB 앞, 0109) → DB·복구 → 에이전트
// 링크 → 하네스 실행 구성·사용량·스케줄러 → 설정 디렉터리·스킬 seed·스캐폴드 → 카탈로그 → 스킬 스캔 →
// 핸들러 → `ready`(셸이 창 포트와 에이전트 호스트를 그 뒤에 붙인다).

import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { HostToShell } from '../../../shared/host-protocol'
import type { HarnessAvailability, NormalizedEvent, SkillInfo } from '../../../shared/ipc'
import { PRODUCT_DISPLAY_NAME, PRODUCT_SLUG } from '../../../shared/product'
import type { AuthRuntime, AuthSecretReader } from '../../contracts/auth'
import { ArtifactCatalog } from '../../features/artifacts/catalog'
import { ArtifactService } from '../../features/artifacts/service'
import { createArtifactToolServer } from '../../features/artifacts/tool'
import { SessionRunner } from '../../features/auth/browser-session/runner'
import { OAuthStateStore } from '../../features/auth/oauth'
import { OAuthRunner } from '../../features/auth/oauth-runner'
import { createAuthRuntime } from '../../features/auth/runtime'
import { createGrantPersistence, createOAuthStatePersistence } from '../../features/auth/store-file'
import { recoverSessionHistory } from '../../features/chat/recovery'
import { McpStore } from '../../features/extensions/common/mcp/store'
import { RuntimeToolRegistry } from '../../features/extensions/common/runtime-tool-registry'
import type { SkillScanRoot } from '../../features/extensions/common/skills/scan'
import { seedBuiltinSkills } from '../../features/extensions/common/skills/seed'
import { createGate, selectGateMembers } from '../../features/gate'
import {
  createRuntimeModelCatalog,
  createRuntimeModelCatalogBridge,
  type RuntimeModelCatalog
} from '../../features/harnesses/common/runtime-catalog'
import { createHarnessRuntimeConfigService } from '../../features/harnesses/common/runtime-config'
import { DbRunRecorder, Scheduler } from '../../features/scheduler'
import type { UsageFetcher } from '../../features/usage/fetcher'
import { registerUsageJobs } from '../../features/usage/jobs'
import { UsageTracker } from '../../features/usage/tracker'
import { loadOoConfig } from '../../infra/config/oo-config'
import {
  ensureConfigDir,
  getWorkspacePath,
  ooConfigDir,
  sourcesSkillsDir
} from '../../infra/config/paths'
import { openSecretFile } from '../../infra/config/secret-file'
import { SecretStore, type Sealer } from '../../infra/config/secret-store'
import { closeDb, initDb, type DbQueries } from '../../infra/db'
import { errorReportHub, reportError } from '../../infra/error-report'
import { errorMessage } from '../../infra/errors'
import { hostEnvironment } from '../../infra/host-environment'
import {
  broadcastProviderState,
  broadcastScheduledTasksChanged,
  broadcastUsageDelta,
  sendScheduledPromptStart
} from '../../infra/ipc/send'
import type { PeerPort } from '../../infra/ipc/peer-link'
import { getLogger, setLogDebug } from '../../infra/log'
import { netFetch } from '../../infra/net/net-fetch'
import { shellServices } from '../../infra/shell-services'
import { SettingsStore } from '../../infra/settings-store'
import { createVault } from '../../infra/vault'
import { createAuthResume } from '../auth-resume'
import { createBootReportRecorder } from '../boot-report'
import { resolveBuiltinSkillsDir } from '../builtin-resources'
import type { ConnectionViewSource } from '../connection-views'
import { connectionState, duplicateConnectionAuthIds } from '../connection-views'
import { startDailyGate } from '../daily-gate'
import { AUTH_DEFINITIONS, LOGIN_FREE_DEFINITIONS } from '../deployment/auth-definitions'
import { createConnectionSources } from '../deployment/connections'
import { GATE_AUTH_DEFINITIONS, remainingAuthDefinitions } from '../deployment/gate-auth'
import {
  AUTH_INVALIDATED_HARNESS_KEYS,
  createRuntimeConfigAugmenters,
  DIRECT_CREDENTIAL_AUTH_IDS,
  RUNTIME_MODEL_CONTRIBUTIONS
} from '../deployment/harness-runtime'
import { createPluginBindings } from '../deployment/plugins'
import { createUsageFetcher } from '../deployment/usage-fetcher'
import { installErrorReportSink } from '../error-report-sink'
import { registerArtifactHandlers } from '../handlers/artifacts'
import { registerBootHandlers } from '../handlers/boot'
import { registerCostHandlers } from '../handlers/cost'
import { registerErrorHandlers } from '../handlers/error'
import { registerFilesHandlers } from '../handlers/files'
import { registerMcpHandlers } from '../handlers/mcp'
import { registerProjectHandlers } from '../handlers/project'
import { registerConnectionHandlers } from '../handlers/providers'
import { registerScheduledTaskHandlers } from '../handlers/scheduled-tasks'
import { registerSessionHandlers } from '../handlers/session'
import { registerSettingsHandlers, registerSettingsReadHandler } from '../handlers/settings'
import { registerSkillsHandlers } from '../handlers/skills'
import {
  createHarnessSettingsService,
  harnessSkillRoots,
  parseHarnessRuntimeModels,
  scaffoldHarnessSettings
} from '../harnesses/config-registry'
import type { HostAssembly, HostProcessContext } from '../host-process'
import { createManagedMcp } from '../managed-mcp'
import {
  createManagedMcpLeaseHost,
  createToolCallHost,
  serializeManagedMcp,
  serializeRuntimeTools,
  type RemoteToolCall
} from '../remote-tools'
import {
  createRuntimeModelAuthChangeHandler,
  createRuntimeModelAuthInvalidator,
  createRuntimeModelAuthResume,
  createRuntimeModelReconcileSnapshot,
  createRuntimeModelReconcileVerified,
  createRuntimeModelSnapshotReader,
  startRuntimeModelCatalogAfterDeploy
} from '../runtime-model-startup'
import { createScheduledTasks, type ScheduledTasks } from '../scheduled-tasks'
import { registerSettingsReactions } from '../settings-reactions'
import { readSkillCatalog } from '../skill-catalog'
import { createSessionHooks } from './session-hooks'
import { createAgentLink, type AgentLink } from './agent-link'
import {
  createRemoteExtensionDeploy,
  createRemoteHarnessHost,
  createRemoteShellRunner
} from './agent-requests'
import { watchShellLocale } from './shell-locale'
import { createAgentReports } from './agent-reports'
import { createDataQueryOps, createDataWriteOps, type CaptureOutputRequest } from './data-ops'
import { createPersistenceReceiver, type PersistenceReceiver } from './persistence-receiver'
import { createShellBrowserSessions } from './shell-browser-session'

// 셸 서비스의 봉인·해제 세 가지 — 비밀 저장소는 Electron 을 모른다(0324 D-018).
function shellSealer(): Sealer {
  return {
    isAvailable: () => shellServices().call('secrets.isAvailable'),
    encrypt: (plain) => shellServices().call('secrets.encrypt', plain),
    decrypt: (cipher) => shellServices().call('secrets.decrypt', cipher)
  }
}

// `redirect:'window'` OAuth 가 쓰는 세션 그룹. 게이트(ADFS)와 분리한다.
const OAUTH_WINDOW_GROUP = 'oauth'

export class DataBootstrap implements HostAssembly {
  private readonly bootReport = createBootReportRecorder()
  // 에이전트 호스트가 보낸 오류 보고는 이 프로세스의 허브로, 부팅 보고는 사본으로(AC47).
  private readonly agentReports = createAgentReports({
    publish: (report) => errorReportHub.publish(report),
    onInvalid: (method) => getLogger().child('peer').warn('peer.report.invalid', { method })
  })
  private readonly dataDirectory = hostEnvironment().userData
  readonly settings = new SettingsStore(hostEnvironment().appVersion, { cwd: this.dataDirectory })
  // 비밀 저장소는 하나다 — vault 와 MCP 가 같은 사본을 쓴다(EP-18).
  private readonly secrets = new SecretStore(openSecretFile(this.dataDirectory), shellSealer())
  readonly mcp = new McpStore(this.settings, this.secrets)
  private readonly runtimeTools = new RuntimeToolRegistry()
  private stopped = false
  private skillsCache: SkillInfo[] = []
  private skillsRevision = 0
  private defaultCwd = ''
  private db?: DbQueries
  private agentLink?: AgentLink
  private managedMcp?: ReturnType<typeof createManagedMcp>
  private readonly leases = createManagedMcpLeaseHost({
    current: () => this.requireManagedMcp().source.snapshot(),
    acquire: (snapshot) => this.requireManagedMcp().mcpBridge.acquire(snapshot)
  })
  private readonly toolCalls = createToolCallHost({
    tools: this.runtimeTools,
    managedPlugins: () => this.managedMcp?.source.peek().plugins ?? new Map()
  })
  private receiver?: PersistenceReceiver
  private cost?: UsageTracker
  private scheduler?: Scheduler
  private scheduledTasks?: ScheduledTasks
  private artifacts?: ArtifactService
  private dailyGate?: { dispose(): void }
  private gateState: { passed: boolean; resuming: boolean } = { passed: false, resuming: false }
  // 에이전트 호스트가 알린 하네스 가용성(카탈로그의 지원 판정).
  private readonly availability = new Map<string, HarnessAvailability>()
  private readonly stops: Array<() => void> = []
  private activeDbWriteCount = 0

  constructor(private readonly host: HostProcessContext) {}

  private requireManagedMcp(): ReturnType<typeof createManagedMcp> {
    if (!this.managedMcp) throw new Error('관리형 MCP 가 아직 없다')
    return this.managedMcp
  }

  private requireAgentLink(): AgentLink {
    if (!this.agentLink) throw new Error('에이전트 링크가 아직 없다')
    return this.agentLink
  }

  private skillRoots(): SkillScanRoot[] {
    return [
      {
        sourceId: 'orcinus-orca',
        sourceLabel: `${PRODUCT_DISPLAY_NAME} 스킬`,
        sourceKind: 'orcinus-orca',
        rootDir: sourcesSkillsDir()
      },
      ...harnessSkillRoots()
    ]
  }

  private async refreshSkills(): Promise<SkillInfo[]> {
    const revision = ++this.skillsRevision
    const skills = await readSkillCatalog(
      this.skillRoots(),
      this.settings.getAll().skillEnabled
    ).catch(() => [])
    if (revision === this.skillsRevision) this.skillsCache = skills
    return skills
  }

  // MCP·스킬이 바뀌었다 — 관리형 MCP 를 다시 계산하고 하네스 플러그인 배포를 에이전트 호스트에 부탁한다.
  private readonly deployExtensions = createRemoteExtensionDeploy(
    () => this.requireAgentLink(),
    () => this.managedMcp?.source.refresh()
  )

  private getCwd(projectId?: string | null): string {
    return getWorkspacePath(
      projectId && this.db ? this.db.getProject(projectId) : null,
      this.defaultCwd || hostEnvironment().desktop
    )
  }

  // ── 인증 스택 (0188 — DB 보다 먼저) ─────────────────────────────────────────────────────────
  private createAuthStack(): { auth: AuthRuntime; secretReader: AuthSecretReader } {
    const log = getLogger().child('auth')
    const persistence = createGrantPersistence(this.dataDirectory, (error) => {
      reportError({
        event: 'auth.persistence.unavailable',
        scope: 'auth',
        title: 'authPersistenceUnavailable',
        level: 'warn',
        error,
        data: { reason: errorMessage(error) }
      })
    })
    // 파티션 세션(쿠키 jar·로그인 창)은 셸만 연다(AC27′).
    const sessions = createShellBrowserSessions(this.host.shell, {
      onRegisterError: (error) =>
        log.warn('auth.session.register-failed', { reason: errorMessage(error) })
    })
    const oauthStates = createOAuthStatePersistence(this.dataDirectory, (error) => {
      reportError({
        event: 'auth.oauth.persistence.unavailable',
        scope: 'auth',
        title: 'authPersistenceUnavailable',
        level: 'warn',
        error,
        data: { reason: errorMessage(error) }
      })
    })
    const created = createAuthRuntime({
      definitions: AUTH_DEFINITIONS,
      loginFreeDefinitions: LOGIN_FREE_DEFINITIONS,
      persistence,
      vault: createVault(this.secrets),
      fetchImpl: netFetch,
      sessions,
      // 로그인 프리 연결의 하네스 능력(0291) — 하네스는 에이전트 호스트에 있다. 없으면 띄운다.
      loginFreeHost: createRemoteHarnessHost(() => this.requireAgentLink()),
      oauth: new OAuthRunner({
        states: new OAuthStateStore(oauthStates),
        openExternal: (url) => shellServices().call('external.openExternal', url),
        window: {
          open: async ({ url, isDone }) => {
            sessions.register({
              sessionGroup: OAUTH_WINDOW_GROUP,
              allowedOrigins: [new URL(url).origin]
            })
            const handleId = sessions.acquire(OAUTH_WINDOW_GROUP)
            try {
              return (await sessions.openLoginWindow(handleId, { url, isDone })).finalUrl
            } catch {
              return null
            }
          }
        },
        logger: (event, data) => log.warn(event, data)
      }),
      session: new SessionRunner({ sessions, logger: (event, data) => log.info(event, data) }),
      logger: (event, data) => log.warn(event, data),
      onOrphan: (authId) => log.info('auth.grant.orphaned', { authId })
    })
    for (const rejection of created.rejected) {
      reportError({
        event: 'auth.declaration.rejected',
        scope: 'auth',
        title: 'authDeclarationRejected',
        level: 'warn',
        detail: rejection.message,
        data: {
          authId: rejection.id,
          scheme: rejection.scheme,
          reason: rejection.reason,
          message: rejection.message
        }
      })
    }
    return { auth: created.runtime, secretReader: created.secretReader }
  }

  private gateMembers(auth: AuthRuntime): ReturnType<typeof selectGateMembers> {
    const selection = selectGateMembers(GATE_AUTH_DEFINITIONS, (authId) => auth.tryBind(authId))
    const log = getLogger().child('auth')
    for (const blocked of selection.blocked) {
      log.warn('auth.gate.blocked', { authId: blocked.authId, reason: blocked.reason })
    }
    return selection
  }

  async start(): Promise<Extract<HostToShell, { type: 'ready' }>> {
    // 창이 붙자마자 설정을 읽는다(0244) — 첫 await 앞에서 등록한다.
    registerSettingsReadHandler(this.settings)
    installErrorReportSink()
    registerErrorHandlers()
    // 셸의 UI 언어 사본(D-032 · F5) — 바뀔 때마다 알린다.
    watchShellLocale(this.settings, (message) => this.host.toShell(message))

    // 비밀은 기동 때 한 번 풀어 둔다(D-040). 못 푼 비밀은 절전 해제·화면 잠금 해제마다 다시 푼다.
    await this.secrets.load()
    this.stops.push(
      shellServices().onWake((reason) => {
        if (reason !== 'window-focus') void this.secrets.retryUndecryptable()
      })
    )

    const { auth, secretReader } = this.bootReport.stepSync(
      'provider-platform',
      { critical: true, label: '인증 스택' },
      () => this.createAuthStack()
    )
    this.mcp.attachTokenSource((authId) => secretReader.read(authId))
    const gateSelection = this.gateMembers(auth)
    const gate = createGate({
      members: gateSelection.members,
      blockedMembers: gateSelection.blocked.length,
      bypass: () => import.meta.env.DEV && this.settings.getAll().authBypass,
      alwaysRequired: import.meta.env.DEV
    })
    const plugins = createPluginBindings({
      auth,
      registry: this.runtimeTools,
      logger: (event, data) => getLogger().child('plugin').info(event, data)
    })
    for (const plugin of plugins) plugin.sync()
    this.managedMcp = createManagedMcp(this.mcp, plugins)
    const connections: readonly ConnectionViewSource[] = createConnectionSources({
      auth,
      gateMembers: gateSelection.members,
      plugins
    })
    for (const duplicate of duplicateConnectionAuthIds(connections)) {
      getLogger().child('auth').warn('auth.connection.duplicate-row', { authId: duplicate })
    }
    let authResumeRef: { resuming: () => boolean } | undefined = undefined
    const resuming = (): boolean => authResumeRef?.resuming() ?? false
    const pushConnectionState = (): void => {
      broadcastProviderState(connectionState(auth, gate, connections, resuming()))
      this.publishAuthState({ passed: gate.state().passed, resuming: resuming() })
    }
    this.stops.push(this.secrets.onChange(pushConnectionState))
    this.dailyGate = startDailyGate({
      gate,
      pushConnectionState,
      now: Date.now,
      setTimer: (callback, ms) => setTimeout(callback, ms),
      clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      subscribeWake: (check) => shellServices().onWake(() => check())
    })
    const runtimeModelSnapshotOf = createRuntimeModelSnapshotReader(auth)
    const runtimeModelCatalogBridge = createRuntimeModelCatalogBridge({
      contributions: RUNTIME_MODEL_CONTRIBUTIONS,
      snapshotOf: runtimeModelSnapshotOf
    })
    const reconcileRuntimeModelSnapshot =
      createRuntimeModelReconcileSnapshot(runtimeModelCatalogBridge)
    registerConnectionHandlers({ auth, gate, connections, resuming })
    const authResume = createAuthResume({
      auth,
      gateDefinitions: GATE_AUTH_DEFINITIONS,
      remainingDefinitions: remainingAuthDefinitions(AUTH_DEFINITIONS, GATE_AUTH_DEFINITIONS),
      pushConnectionState,
      reconcileVerified: createRuntimeModelReconcileVerified({
        bridge: runtimeModelCatalogBridge,
        snapshotOf: runtimeModelSnapshotOf
      }),
      logger: (event, data) => getLogger().child('auth').info(event, data)
    })
    authResumeRef = authResume

    const db = (this.db = this.bootReport.stepSync(
      'db-init',
      { critical: true, label: 'DB 초기화' },
      () =>
        initDb({
          onBackupStart: () => {
            this.activeDbWriteCount += 1
          },
          onBackupEnd: () => {
            this.activeDbWriteCount = Math.max(0, this.activeDbWriteCount - 1)
          }
        })
    ))
    const recovered = this.bootReport.stepSync(
      'chat-recovery',
      { critical: true, label: '미완료 도구 호출 복구' },
      () => recoverSessionHistory(db)
    )
    if (recovered.toolResultsWritten > 0)
      getLogger()
        .child('chat')
        .debug('chat.recovery.settled', { ...recovered })

    // ── 하네스 실행 구성 — 인증에 묶여 여기 있다(구현 보고 G-B) ──
    const harnessSettings = createHarnessSettingsService()
    const harnessRuntime = createHarnessRuntimeConfigService({
      settings: harnessSettings,
      augmenters: createRuntimeConfigAugmenters({
        auth,
        secrets: Object.fromEntries(
          DIRECT_CREDENTIAL_AUTH_IDS.map((authId) => [authId, () => secretReader.read(authId)])
        )
      }),
      logger: (event, data) => getLogger().child('harness').debug(event, data)
    })
    const invalidateHarnessForAuth = createRuntimeModelAuthInvalidator({
      invalidatedKeys: AUTH_INVALIDATED_HARNESS_KEYS,
      contributions: RUNTIME_MODEL_CONTRIBUTIONS,
      invalidate: (key) => harnessRuntime.invalidate(key, 'auth-change'),
      snapshotOf: runtimeModelSnapshotOf,
      reconcile: reconcileRuntimeModelSnapshot
    })
    const catalog = createRuntimeModelCatalog({
      availability: (id) =>
        this.availability.get(id) ?? {
          id: id as HarnessAvailability['id'],
          installed: false,
          usable: false,
          unavailableReason: 'missing'
        },
      parseModels: parseHarnessRuntimeModels,
      contributions: RUNTIME_MODEL_CONTRIBUTIONS,
      runtime: harnessRuntime,
      snapshotOf: runtimeModelSnapshotOf,
      onChange: pushConnectionState
    })

    this.connectAgent(db, { harnessSettings, harnessRuntime, catalog })

    const usageFetcher: UsageFetcher | undefined = createUsageFetcher({ auth })
    const cost = (this.cost = new UsageTracker(db.usage, (delta) => broadcastUsageDelta(delta), {
      spendingLimitUsd: () => this.settings.getAll().spendingLimitUsd,
      fetcher: usageFetcher
    }))
    this.bootReport.stepSync('cost-recompute', { critical: true, label: '비용 요약 재계산' }, () =>
      cost.recompute()
    )
    registerSettingsReactions(this.settings, { pushConnectionState, cost })
    const scheduler = (this.scheduler = new Scheduler(new DbRunRecorder(db)))
    registerUsageJobs(scheduler, cost, {
      fetcher: usageFetcher,
      providerKeys: () =>
        harnessSettings
          .adapters()
          .flatMap((harnessId) => harnessSettings.list(harnessId))
          .map((entry) => entry.key)
    })
    // 주기 업데이트 확인 — 업데이트는 셸이 소유한다.
    scheduler.register('update-check', () => {
      this.host.toShell({ type: 'update.check' })
    })
    try {
      scheduler.applySettings(this.settings.getAll().scheduler)
    } catch (e) {
      reportError({
        event: 'scheduler.settings.failed',
        scope: 'scheduler',
        title: 'scheduledJobFailed',
        level: 'warn',
        error: e,
        data: { message: String(e), reason: 'starting with periodic jobs disabled' }
      })
    }

    this.defaultCwd = hostEnvironment().desktop
    await this.bootReport.step('workspace', { critical: false, label: '기본 작업공간 보장' }, () =>
      mkdir(this.defaultCwd, { recursive: true })
    )
    await this.bootReport.step(
      'config-dir',
      { critical: false, label: `${PRODUCT_DISPLAY_NAME} 설정 디렉터리 보장` },
      () => ensureConfigDir()
    )
    this.bootReport.stepSync(
      'orcinus-orca-config',
      { critical: false, label: `${PRODUCT_SLUG}.json 로드` },
      () => setLogDebug(loadOoConfig().debug === true)
    )
    await this.bootReport.step(
      'builtin-skill-seed',
      { critical: false, label: '기본 스킬 seed' },
      async () => {
        const result = await seedBuiltinSkills(
          resolveBuiltinSkillsDir({
            isPackaged: hostEnvironment().isPackaged,
            resourcesPath: process.resourcesPath,
            appPath: hostEnvironment().appPath
          }),
          sourcesSkillsDir()
        )
        const seedLog = getLogger().child('extensions')
        for (const name of result.seeded) seedLog.debug('extensions.skill.seeded', { name })
        for (const name of result.pruned) seedLog.debug('extensions.skill.pruned', { name })
      }
    )
    this.bootReport.stepSync(
      'provider-scaffold',
      { critical: false, label: 'provider settings 스캐폴드' },
      scaffoldHarnessSettings
    )
    // 배포(에이전트 호스트)는 이 호스트가 준비된 뒤에 돈다 — 배포가 끝나면 `extensionsDeployed` 가
    // 두 캐시를 다시 비우고 카탈로그를 맞춘다.
    await startRuntimeModelCatalogAfterDeploy({
      invalidateSettings: () => harnessSettings.invalidateAll(),
      invalidateRuntime: () => harnessRuntime.invalidate(undefined, 'settings-deploy'),
      catalog,
      bridge: runtimeModelCatalogBridge,
      resumeAuth: createRuntimeModelAuthResume({
        auth,
        onChange: createRuntimeModelAuthChangeHandler({
          recordGateLogin: (authId, revision) => gate.noteLoginCommit(authId, revision),
          pushConnectionState,
          syncPlugins: (authId) => {
            for (const plugin of plugins) if (plugin.auth.authId === authId) plugin.sync()
            this.managedMcp?.source.refresh()
          },
          invalidateForAuth: invalidateHarnessForAuth,
          reconcileSnapshot: reconcileRuntimeModelSnapshot
        }),
        onGateChange: (authId) => authResume.onGateChange(authId),
        run: () => {
          void authResume.run()
          void auth.connectAll()
        }
      })
    })
    await this.bootReport.step('skill-scan', { critical: false, label: '스킬 스캔' }, () =>
      this.refreshSkills()
    )
    this.bootReport.finish()

    this.registerArtifacts(db)
    this.startScheduledTasks(db)
    this.register(db)
    // 런타임 도구·관리형 MCP 가 바뀌면 사본을 보낸다.
    this.stops.push(
      this.runtimeTools.subscribe(() => this.publishTools()),
      this.managedMcp.source.subscribe((_revision, kind) => this.publishManagedMcp(kind))
    )
    return { type: 'ready', mirror: { uiLocale: this.settings.getAll().uiLocale } }
  }

  // 에이전트 호스트와의 피어 링크(F1~F4) — 연산 표·저장 수신기·사본.
  private connectAgent(
    db: DbQueries,
    harness: {
      harnessSettings: ReturnType<typeof createHarnessSettingsService>
      harnessRuntime: ReturnType<typeof createHarnessRuntimeConfigService>
      catalog: RuntimeModelCatalog
    }
  ): void {
    const deps = {
      db,
      defaultCwd: () => this.defaultCwd || hostEnvironment().desktop,
      harness: {
        settings: harness.harnessSettings,
        runtime: harness.harnessRuntime,
        catalog: harness.catalog
      },
      mcp: this.mcp,
      host: {
        skills: (): SkillInfo[] => this.skillsCache,
        runtimeToolCall: (request: RemoteToolCall) => this.toolCalls.call(request),
        runtimeToolCancel: (callId: string): void => this.toolCalls.cancel(callId),
        managedMcpAcquire: (revision: number) => this.leases.acquire(revision),
        managedMcpRelease: (leaseId: string) => this.leases.release(leaseId),
        // 실행 쪽 작업 파일을 산출물로 담는다 — 게시 통지는 실행 쪽이 낸다(채팅 통지 채널 소유).
        captureOutput: async (input: CaptureOutputRequest) =>
          this.artifacts
            ? ((await this.artifacts.captureOutput(
                input.path,
                input.directory,
                {
                  sessionId: input.sessionId,
                  cwd: input.cwd,
                  extraDirs: input.extraDirs,
                  signal: new AbortController().signal,
                  isCurrent: () => true
                },
                input.expectedContent
              )) ?? null)
            : null,
        // 에이전트 호스트가 하네스 플러그인을 다시 배포했다 — 설정 트리 캐시를 비우고 카탈로그를 맞춘다.
        extensionsDeployed: async (): Promise<void> => {
          harness.harnessSettings.invalidateAll()
          harness.harnessRuntime.invalidate(undefined, 'settings-deploy')
          await harness.catalog.invalidate()
        }
      }
    }
    const queryOps = createDataQueryOps(deps)
    const writeOps = createDataWriteOps(deps)
    const receiver = (this.receiver = createPersistenceReceiver({
      db,
      usage: () => this.cost,
      notifyAgent: (method, payload) => this.agentLink?.link.notify(method, payload),
      clock: () => performance.now()
    }))
    this.agentLink = createAgentLink({
      queryOps,
      writeOps,
      settings: this.settings,
      ensureAgent: () => this.host.toShell({ type: 'peer.ensure' }),
      onRequest: (method, payload) => receiver.request(method, payload),
      onNotify: (method, payload) => {
        if (method === 'harness.availability') {
          for (const state of (payload as { states?: HarnessAvailability[] }).states ?? [])
            this.availability.set(state.id, state)
          return
        }
        if (this.agentReports.notify(method, payload)) return
        receiver.notify(method, payload)
      },
      onInvalid: () => getLogger().child('peer').warn('peer.message.invalid', { side: 'data' })
    })
    // 연결될 때마다 사본을 처음부터 보낸다(설정 사본은 링크가 보낸다).
    this.agentLink.link.onConnected(() => {
      this.publishTools()
      this.publishManagedMcp()
      this.publishAuthState(this.gateState)
    })
    // 에이전트 호스트가 죽으면 그 호스트의 열린 턴을 바로 마감한다(AC29′).
    this.agentLink.link.onClosed(() => {
      receiver.peerClosed()
      this.agentReports.peerClosed()
    })
  }

  private publishTools(): void {
    this.agentLink?.link.notify(
      'tools.snapshot',
      serializeRuntimeTools(this.runtimeTools.snapshot())
    )
  }

  private publishManagedMcp(kind?: 'definitions' | 'connections'): void {
    if (!this.managedMcp) return
    const snapshot = this.managedMcp.source.snapshot()
    this.leases.remember(snapshot)
    this.agentLink?.link.notify('mcp.snapshot', serializeManagedMcp(snapshot, kind))
  }

  private publishAuthState(state: { passed: boolean; resuming: boolean }): void {
    this.gateState = state
    this.agentLink?.link.notify('auth.state', state)
  }

  // 산출물 게시 통지는 채팅 통지 채널(에이전트 호스트 몫)로 간다 — 피어로 중계한다.
  private relayChatEvent(event: NormalizedEvent): void {
    this.agentLink?.link.notify('chat.relay', event)
  }

  private registerArtifacts(db: DbQueries): void {
    const artifacts = (this.artifacts = new ArtifactService({
      queries: db.artifacts,
      rootDir: join(ooConfigDir(), 'artifacts', ...(import.meta.env.DEV ? ['.dev'] : [])),
      isInputFile: (sessionId, inputSource, hash) =>
        db
          .listSessionAttachmentFiles(sessionId)
          .some(
            (file) =>
              (process.platform === 'win32' ? file.path.toLowerCase() : file.path) ===
                inputSource && file.sha256 === hash
          ),
      trashItem: (path) => shellServices().call('external.trashItem', path)
    }))
    this.runtimeTools.add(
      createArtifactToolServer(artifacts, (sessionId, artifact) =>
        this.relayChatEvent({ type: 'artifact.published', sessionId, artifact } as NormalizedEvent)
      )
    )
    registerArtifactHandlers(artifacts, (event) => event.trusted, new ArtifactCatalog(db.artifacts))
  }

  // 사용자 예약 작업 — 셸 명령은 에이전트 호스트가 실행한다(F4 · EP-21: 없으면 띄운다).
  private startScheduledTasks(db: DbQueries): void {
    const scheduledTasks = (this.scheduledTasks = createScheduledTasks({
      store: db.scheduledTasks,
      projects: (projectId) => {
        const project = db.getProject(projectId)
        return project ? { cwd: project.cwd ?? null } : undefined
      },
      runShell: createRemoteShellRunner(() => this.requireAgentLink()),
      sendPromptStart: sendScheduledPromptStart,
      onChanged: broadcastScheduledTasksChanged,
      onRestoreError: (task, error) =>
        getLogger()
          .child('scheduler')
          .warn('scheduler.task.restore.failed', { taskId: task.id, message: String(error) })
    }))
    scheduledTasks.service.start()
    registerScheduledTaskHandlers(scheduledTasks.service, scheduledTasks.relay)
  }

  private register(db: DbQueries): void {
    const link = this.requireAgentLink()
    const ctx = {
      db,
      settings: this.settings,
      mcp: this.mcp,
      cost: this.cost!,
      scheduler: this.scheduler!,
      getSkills: () => this.skillsCache,
      refreshSkills: () => this.refreshSkills(),
      deployExtensions: (options?: { throwOnFailure?: boolean }) => this.deployExtensions(options),
      getCwd: (projectId?: string | null) => this.getCwd(projectId),
      // 두 호스트의 부팅 단계를 한 보고로 준다(AC47).
      getBootReport: () => this.agentReports.bootReport(this.bootReport.getReport())
    }
    // 실행 상태는 에이전트 호스트에 묻는다. 없으면 쉬는 상태다(AC19′ · AC43 — 띄우지 않는다).
    // 원본 읽기는 에이전트 호스트(하네스 어댑터), 기록은 여기다(F4 · EP-21: 없으면 띄운다).
    registerSessionHandlers(
      ctx,
      createSessionHooks({
        link,
        db,
        forgetSession: (sessionId) => this.receiver?.forgetSession(sessionId)
      })
    )
    registerProjectHandlers(ctx)
    registerMcpHandlers(ctx)
    registerBootHandlers(ctx)
    registerSettingsHandlers(ctx)
    registerSkillsHandlers(ctx)
    registerFilesHandlers(ctx)
    registerCostHandlers(ctx)
  }

  attachPeer(port: PeerPort): void {
    this.requireAgentLink().attach(port)
  }

  peerUnavailable(): void {
    this.agentLink?.unavailable()
  }

  // 앱 종료(AC32′) — 예약 작업 → 스케줄러 → DB 닫기. 에이전트 호스트가 먼저 내려가 저장 스트림이 비었다.
  async shutdown(): Promise<void> {
    if (this.stopped) return
    this.stopped = true
    for (const stop of this.stops) stop()
    this.dailyGate?.dispose()
    void this.managedMcp?.mcpBridge.close()
    await this.leases.releaseAll()
    void this.artifacts?.close()
    this.scheduledTasks?.dispose()
    this.scheduler?.stopAll()
    this.receiver?.peerClosed()
    closeDb()
  }
}
