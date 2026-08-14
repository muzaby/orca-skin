// Bootstrap — main 측 컴포지션 루트(app 레이어). 의존성 생성 + 부팅 시퀀스 + 핸들러 등록 위임만
// 담당한다. 도메인 핸들러는 app/handlers/, chat 턴 셋업은 app/chat-turn.ts, 턴 파이프라인 협력자는
// features/{chat,history,approvals,sessions,usage} 참조 (handoff 0062 수직 슬라이스 재구성).

import { app, shell, webContents } from 'electron'
import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
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
  ensureConfigDir,
  getWorkspacePath,
  orcaConfigDir,
  sourcesSkillsDir
} from '../infra/config/paths'
import { builtInHarnessPluginRoot } from '../features/extensions/harness-plugins/claude'
import { userClaudePluginRoot } from '../features/extensions/claude-user-skills-plugin'
import { loadOrcaConfig } from '../infra/config/orca-config'
import { SecretStore } from '../infra/config/secret-store'
import { deploy } from '../features/extensions/deployer'
import { ExtensionDeploymentService } from '../features/extensions/extension-deployment-service'
import { toClaudeConfig } from '../features/extensions/mcp/convert'
import { scaffoldProviderSettings } from '../features/extensions/scaffold'
import { HarnessSettingsService } from '../features/harnesses/settings'
import { netFetch } from '../infra/net/net-fetch'
import { loadClaudeProviderSettings, readUserClaudeSettings } from '../adapters/claude-settings'
import { scanSkills, type SkillScanRoot } from '../features/extensions/skills/scan'
import { seedBuiltinSkills } from '../features/extensions/skills/seed'
import { initDb } from '../infra/db'
import { getLogger, setLogDebug } from '../infra/log'
import { UsageTracker } from '../features/usage/tracker'
import { registerUsageJobs } from '../features/usage/jobs'
import type { UsageFetcher } from '../features/usage/fetcher'
import { llmProviderKey } from './llm-env'
import { DbRunRecorder, Scheduler } from '../features/scheduler'
import { ExtensionBuilder } from '../features/extensions/builder'
import { PermissionModeController } from '../features/approvals/permission-mode-controller'
import type { RouterContext } from './context'
import { registerSessionHandlers } from './handlers/session'
import { registerProjectHandlers } from './handlers/project'
import { registerMcpHandlers } from './handlers/mcp'
import { registerEngineHandlers } from './handlers/engine'
import { registerMiscHandlers } from './handlers/misc'
import { registerSettingsHandlers } from './handlers/settings'
import { registerSkillsHandlers } from './handlers/skills'
import { registerFilesHandlers } from './handlers/files'
import { registerCostHandlers } from './handlers/cost'
import { registerBootHandlers } from './handlers/boot'
import { registerUpdateHandlers } from './handlers/update'
import { registerLogHandlers } from './handlers/log'
import { registerProviderHandlers } from './handlers/providers'
import { ProviderPlatform } from './provider-platform'
import { ProviderRegistry } from '../features/auth/registry'
import { ProviderStore } from '../features/auth/store'
import { createGrantPersistence, createOAuthStatePersistence } from '../features/auth/store-file'
import { OAuthStateStore } from '../features/auth/oauth'
import { OAuthRunner } from '../features/auth/oauth-runner'
import { LoginService } from '../features/auth/login'
import { declaredProviders } from './deployment'
import { errorMessage } from '../infra/errors'
import { createVault } from '../infra/vault'
import { BrowserSessionStore } from '../infra/browser-session'
import { SessionRunner } from '../features/auth/browser-session/runner'
import { registerDeclaredSessions } from '../features/auth/session-policies'
import { ProviderApiImpl } from '../features/auth/api'
import { ServiceToolRegistrar } from './plugin-tools'
import { createNoopUpdater, loadElectronAutoUpdater, UpdateController } from './updater'
import { registerChatHandlers } from './chat-turn'
import { registerSettingsReactions } from './settings-reactions'
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
  broadcastChatEvent,
  broadcastProviderState,
  sendChatEvent
} from '../infra/ipc/send'
import { RuntimeToolRegistry } from '../features/extensions/runtime-tool-registry'
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

  private async deployExtensions(): Promise<void> {
    await this.deployment?.deployNow()
  }

  private async ensureExtensionsDeployedForTurn(): Promise<void> {
    await this.deployment?.ensureDeployed()
  }

  // `redirect:'window'` OAuth 가 쓰는 세션 그룹. 게이트(ADFS)와 **분리**한다 — 인가 창의
  // 쿠키가 사내 SSO jar 에 섞이면 로그아웃 범위가 흐려진다.
  private static readonly OAUTH_WINDOW_GROUP = 'oauth'

  // provider 플랫폼 조립 (0181). 배포 선언 → 등록(검사) → grant 복원 → 로그인 서비스.
  // **여기서 던지지 않는다** — 영속을 못 열면 메모리 폴백으로 내려앉고(이번 실행에서만 인증이
  // 유지된다) 사유를 로그로 남긴다. 게이트 자체는 계속 판정 가능해야 한다.
  private createProviderPlatform(
    secretStore: SecretStore,
    runtimeTools: RuntimeToolRegistry
  ): ProviderPlatform {
    const log = getLogger().child('providers')
    const registry = new ProviderRegistry(declaredProviders())
    for (const rejection of registry.rejected()) {
      log.warn('providers.declaration.rejected', {
        providerId: rejection.id,
        reason: rejection.reason,
        message: rejection.message
      })
    }

    // 영속을 못 열면 어댑터가 스스로 메모리로 내려앉고 사유만 알려 준다 — 게이트 판정은
    // 계속돼야 하므로 부팅을 세우지 않는다.
    const persistence = createGrantPersistence((error) => {
      log.warn('providers.persistence.unavailable', { reason: errorMessage(error) })
    })

    const vault = createVault(secretStore)
    // 브라우저 세션(cookie jar·통합 인증)은 게이트·OAuth 창·세션 grant 전송이 **함께** 쓴다.
    const sessions = new BrowserSessionStore()
    // **로그인 전에 등록한다** (0182). 0181 은 `SessionRunner.login` 에서만 등록해서, 재시작 후
    // 쿠키·grant 가 살아 있어도 group 이 미등록이라 `acquire()` 가 raw throw 로 죽었다 —
    // 401 강등 경로도 타지 않아 재인증 지점조차 뜨지 않았다. 거부된 선언은 `registry.list()` 에
    // 없으므로 그 cookie jar 는 만들어지지 않는다.
    registerDeclaredSessions(sessions, registry.list(), (event, data) => log.warn(event, data))
    const store = new ProviderStore({
      persistence,
      vault,
      // 선언에서 사라진 provider 의 grant 는 **지우지 않는다** — 선언이 일시적으로 빠진 빌드에서
      // 재로그인을 강요하지 않기 위함이다.
      onOrphan: (providerId) => log.info('providers.grant.orphaned', { providerId })
    })
    store.restore(registry.list().map((provider) => provider.id))

    // OAuth 인가 pending 은 grant 와 **다른 파일**에 앉는다(수명이 분 단위 대 재로그인까지).
    // 영속을 못 열면 메모리로 내려앉되, 그 경우 앱 재시작을 건너뛴 콜백만 대조된다.
    // 파일은 실제 OAuth 로그인이 돌 때 열린다 — 이 단계는 DB 앞으로 당겨 둔 자리다.
    const oauthStates = createOAuthStatePersistence((error) => {
      log.warn('providers.oauth.persistence.unavailable', { reason: errorMessage(error) })
    })

    // grant 상태가 바뀌면 **언제나** 이 둘이 함께 일어난다 — 도구 가시성 갱신과 상태 방송.
    // 두 벌로 적으면(401 강등 경로 / 로그인 경로) 한쪽에만 단계가 붙는다.
    const onProviderChange = (): void => {
      serviceTools.sync(registry.byKind('service'))
      broadcastProviderState(platform.state())
    }

    const api = new ProviderApiImpl({
      registry,
      store,
      // 원격 요청은 Chromium 스택으로만 나간다 (0173) — 기본값을 두지 않는다.
      fetchImpl: netFetch,
      sessions,
      logger: (event, data) => log.warn(event, data),
      // 401 강등도 도구 가시성에 영향을 준다 — 만료된 연결의 도구를 남겨두지 않는다.
      onChange: onProviderChange
    })

    // service provider 의 도구는 grant 상태를 따라간다 — 로그인하면 나타나고 해제하면 사라진다.
    const serviceTools = new ServiceToolRegistrar({
      registry: runtimeTools,
      api,
      status: (providerId) => store.status(providerId),
      logger: (event, data) => log.info(event, data)
    })

    const platform = new ProviderPlatform({
      registry,
      store,
      api,
      // dev 전용 우회다 — prod 번들에서는 `import.meta.env.DEV` 가 false 로 접혀 분기 자체가
      // 사라진다(설정 값이 켜져 있어도 게이트는 유지된다).
      bypass: () => import.meta.env.DEV && this.settings.getAll().authBypass,
      toolsOf: (providerId) => serviceTools.descriptorFor(providerId),
      // DEV 는 선언이 0개여도 게이트를 세운다 — 폐쇄망 실값 없이도 로그인 화면을 보고 고칠 수
      // 있어야 한다(0089/0130 의 동작 복원). 탈출구는 디버그 패널의 우회 토글이다.
      alwaysRequired: import.meta.env.DEV,
      login: new LoginService({
        registry,
        store,
        vault,
        // 인증 확인(`Provider.probe`)은 **사용 경로 그대로** 나간다 — grant 를 먼저 커밋하므로
        // 세션이면 cookie jar, 값형이면 `present` 로 실리는 것을 `transport()` 가 갈라 준다.
        api,
        oauth: new OAuthRunner({
          states: new OAuthStateStore(oauthStates),
          // 인가는 **기본 브라우저**에서 돈다(RFC 8252) — 사용자가 주소창과 인증서를 직접 본다.
          openExternal: (url) => shell.openExternal(url),
          // `redirect:'window'` 분기는 게이트와 **같은 창 구현**을 쓴다 — 두 벌이면 allowlist
          // 차단·ERR_ABORTED 처리 같은 규칙이 갈린다.
          window: {
            open: async ({ url, isDone }) => {
              const group = Bootstrap.OAUTH_WINDOW_GROUP
              sessions.register({ sessionGroup: group, allowedOrigins: [new URL(url).origin] })
              const handleId = sessions.acquire(group)
              try {
                return (await sessions.openLoginWindow(handleId, { url, isDone })).finalUrl
              } catch {
                return null
              }
            }
          },
          logger: (event, data) => log.warn(event, data)
        }),
        session: new SessionRunner({
          sessions,
          logger: (event, data) => log.info(event, data)
        }),
        onChange: onProviderChange,
        logger: (event, data) => log.info(event, data)
      })
    })
    // 부팅 복원 직후 1회 — 이미 인증된 service provider 의 도구가 첫 턴부터 보인다.
    serviceTools.sync(registry.byKind('service'))
    return platform
  }

  async start(): Promise<void> {
    const secretStore = new SecretStore()
    // 0181 — 런타임 도구 기여자는 `Provider{kind:'service'}.tools` 다.
    const runtimeTools = new RuntimeToolRegistry()

    // ── provider 플랫폼: **DB 보다 먼저, 최상단에서 조기 등록** (0109/0157 제약 복원) ──
    // 창은 start() 완료 전에 열리고 renderer 는 오픈 직후 게이트 판정을 위해
    // `orca:provider:state` 를 invoke 한다. 그 첫 invoke 가 부팅 완료를 기다리면 화면이 빈 채로
    // 멈춘다. **게이트 판정에는 DB 가 필요 없다** — grant 는 파일+vault 에만 산다.
    // critical=true 다 — 게이트를 판정할 수 없으면 로그인 강제 빌드가 무인증으로 열린다.
    // 영속 실패 같은 회복 가능한 사고는 팩토리 안에서 메모리 폴백으로 흡수한다.
    const providers = this.bootReport.stepSync(
      'provider-platform',
      { critical: true, label: 'provider 플랫폼' },
      () => this.createProviderPlatform(secretStore, runtimeTools)
    )
    registerProviderHandlers(providers)
    // 자동 로그인 — 복원된 세션 쿠키가 아직 유효한지 확인한다. **await 하지 않는다**: probe 는
    // 네트워크 왕복이라 부팅을 붙들면 안 되고, 그동안 게이트는 닫혀 있어 사용자는 로그인 화면에서
    // 진행을 본다. 끝나면 `onChange` 가 새 상태를 push 해 화면이 넘어가거나(성공) 수동 로그인
    // 버튼이 살아난다(실패).
    void providers.resume()
    // MCP `${BINDING:<대상>}` 의 토큰 소스를 잇는다(0181 — 0180 이 끊었던 자리).
    // 주입 전에 배포된 설정에는 인증이 필요한 서버가 빠진다(fail-closed).
    this.mcp.attachTokenSource((providerId) => providers.api.token(providerId))

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
    // ── 원격 사용량 fetcher (0186) — 이 배포에는 endpoint 가 없다 ──────────────────
    // **`undefined` 는 오류가 아니라 정상 구성이다.** 사용량은 로컬 원장만으로 완전히 동작하고,
    // 아래 `registerUsageJobs` 도 원격 잡을 등록하지 않는다.
    //
    // 폐쇄망 배포는 여기에 포트 구현을 꽂는다(선언에 슬롯을 만들지 않는다 — 0183 r2):
    //
    //   const usageFetcher: UsageFetcher = {
    //     supports: (providerKey) =>
    //       findLlmProvider(providers.declarations('llm'), providerKey)?.id === 'corp-gateway',
    //     fetchUsage: async (providerKey, signal) => {
    //       const provider = findLlmProvider(providers.declarations('llm'), providerKey)
    //       if (!provider) return null
    //       const res = await providers.api.request(provider.id, { path: '/api/usage' }, signal)
    //       if (!res.ok) throw new Error(`usage request failed: ${res.status}`)
    //       return toSnapshot(providerKey, res.body)   // 응답 매핑은 배포가 소유한다
    //     }
    //   }
    //
    // **`supports` 와 반환값은 다른 것을 표현한다.** 전자는 *이 배포가 그 provider 를 지원하는가*
    // (false 면 과거 캐시 행이 있어도 무시하고 로컬로 접는다), 후자는 *이번 호출의 결과*다 —
    // 지원 provider 가 `null` 을 주거나 던지면 **이번 갱신 실패**로 읽혀 주기 잡은 다음 틱을
    // 기다리고 수동 동기화는 reject 된다. 미인증·사내망 밖을 "정상" 으로 표현하려고 `null` 을
    // 쓰지 않는다 — 그건 `supports:false` 의 자리다.
    //
    // `baselineUsable` 은 `as_of` 가 billing aggregation watermark 임을 배포가 확인했을 때만
    // true 로 채운다 — 미지정이면 코어가 기준선을 쓰지 않고 한도만 원격에서 가져간다.
    // 절차 상세는 `docs/guides/closed-network-extensions.md` §5-b.
    const usageFetcher: UsageFetcher | undefined = undefined

    // 사용량 delta 송출 배선 — domain(UsageTracker)은 electron 비의존, 송출은 여기(컴포지션 루트)서.
    // 0186 — 전체 provider map 이 아니라 **변경된 scope 만** 나간다.
    const cost = new UsageTracker(
      db,
      (delta) => {
        for (const wc of webContents.getAllWebContents()) {
          if (!wc.isDestroyed()) wc.send(CHANNELS.costUsageEvent, delta)
        }
      },
      {
        // 전역 월 한도는 Main SettingsStore 가 소유한다(renderer Tweak 은 그 미러). 메모리 캐시라
        // 매 턴 읽어도 disk read 가 없다.
        spendingLimitUsd: () => this.settings.getAll().spendingLimitUsd,
        fetcher: usageFetcher
      }
    )
    this.bootReport.stepSync('cost-recompute', { critical: true, label: '비용 요약 재계산' }, () =>
      cost.recompute()
    )
    // 설정이 파생 상태(게이트 판정·사용량 뷰)의 입력인 자리들 — 배선은 한 모듈이 갖는다.
    registerSettingsReactions(this.settings, { providers, broadcastProviderState, cost })
    // 빌더는 db 인스턴스가 필요해 여기서 생성. skills 는 lazy getter 라 스캔 완료 전에 만들어도
    // 무방 — 턴 실행 시점에 최신 skillsCache 를 읽는다. DB 프로젝트 지침은 빌더가 매 턴 조회하므로
    // (무캐시) 지침 편집이 같은 세션 다음 메시지부터 즉시 반영된다.
    const scheduler = (this.scheduler = new Scheduler(new DbRunRecorder(db)))
    // 사용량 잡 (0186) — 코어 고정형(기간 경계 갱신·원격 갱신)과 설정 노출형
    // (`usage-recompute`, 기본 off)을 `features/usage` 가 한 자리에서 등록한다.
    registerUsageJobs(scheduler, cost, {
      fetcher: usageFetcher,
      // 발화 시점에 평가 — 선언에서 LLM provider 좌표를 파생한다(`llmProviderKey` 재사용).
      providerKeys: () =>
        providers
          .declarations('llm')
          .map((provider) => llmProviderKey(provider))
          .filter((key): key is string => key !== null)
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
        builtInHarnessPluginRoot(orcaConfigDir(), 'claude'),
        userClaudePluginRoot(orcaConfigDir(), 'claude')
      ],
      runtimeTools
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
    const providerSettings = new HarnessSettingsService({ claude: loadClaudeProviderSettings })
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
      }
    )
    // dist/claude/plugins/orca 렌더를 boot 1회 수행한다. CRUD 는 즉시 재배포, 턴 진입은
    // ensureDeployed 로 실패/dirty 상태를 한 번 더 보장한다.
    this.deployment = this.createDeploymentService()
    await this.bootReport.step('extension-deploy', { critical: false, label: '확장 배포' }, () =>
      this.deployExtensions()
    )
    providerSettings.invalidateAll()
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
      runtimeTools,
      providers
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
    registerSettingsHandlers(ctx)
    registerSkillsHandlers(ctx)
    registerFilesHandlers(ctx)
    registerCostHandlers(ctx)
    registerMiscHandlers(ctx)
    registerLogHandlers()
  }
}
