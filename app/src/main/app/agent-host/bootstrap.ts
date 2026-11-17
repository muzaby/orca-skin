// 에이전트 호스트(실행)의 조립 (0324 D-034~D-042 · §7-F 4c · EP-20).
//
// 어댑터·SDK·하네스 프로세스 · 세션 런타임 · 턴 정규화·버스·창 중계 · 제목 생성 · git·셸 도구 프로세스 ·
// 하네스 네이티브 자원 · 확장 배포 · 하네스 설치와 가용성이 여기 있다. DB 연결·설정/비밀/인증 파일은
// 없다 — 데이터 링크로 묻고(F2·F4), 설정은 사본으로 읽고(F3), 턴 저장은 저장 스트림으로 보낸다(F1).
//
// 버스의 `turn.event` 구독 순서(SD-05′): 저장 송신(critical) → 제목 → 중계(격리).
// 피어 포트는 두 호스트가 모두 준비된 뒤에 온다(EP-19) — 데이터 호스트가 필요한 기동 일(배포·스킬
// 사본·설정 반응)은 첫 연결에서 돈다.

import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import type { HostToShell } from '../../../shared/host-protocol'
import { parseAgentKind } from '../../../shared/agent-kind'
import type { Backend, DebugMockState, NormalizedEvent, SkillInfo } from '../../../shared/ipc'
import { loadClaudeSdk } from '../../adapters/claude/sdk'
import { claudeNativePaths } from '../../adapters/claude/native-paths'
import {
  invalidateOpenCodeDiscovery,
  openCodeGlobalConfigFiles,
  openCodeGlobalPluginFingerprint
} from '../../adapters/opencode'
import type { MainBus, OoBusEvents } from '../../contracts/bus-events'
import type { ClientRef } from '../../contracts/client'
import type { TurnContext } from '../../contracts/turn'
import { ApprovalCoordinator } from '../../features/approvals/coordinator'
import { PermissionModeController } from '../../features/approvals/permission-mode-controller'
import { prepareOutputDirectory } from '../../features/artifacts/files'
import { BackgroundTaskTracker } from '../../features/chat/background-tasks'
import { PendingMessageQueue } from '../../features/chat/pending-message-queue'
import {
  SessionActivityProjector,
  sessionForeground
} from '../../features/chat/session-activity-projector'
import { settleOpenToolRuns } from '../../features/chat/settle'
import { TitleGenerator } from '../../features/chat/title-generation'
import { ExtensionBuilder } from '../../features/extensions/common/builder'
import type { ExtensionDeploymentService } from '../../features/extensions/common/extension-deployment-service'
import type { SkillScanRoot } from '../../features/extensions/common/skills/scan'
import { ActiveTurnTracker } from '../../features/sessions/active-turn-tracker'
import { BoundedRuntimeCapPolicy } from '../../features/sessions/runtime-cap-policy'
import { clientLeaseKey } from '../../features/sessions/session-chain-lease'
import { RuntimeSupervisor } from '../../features/sessions/supervisor'
import { WorktreeService } from '../../features/worktrees/service'
import { TypedBus } from '../../infra/bus'
import { nativeFileMutations } from '../../infra/config/file-mutation'
import { FingerprintWatch } from '../../infra/config/fingerprint-watch'
import { managedWorktreesDir, sourcesSkillsDir } from '../../infra/config/paths'
import { PluginSnapshots } from '../../infra/config/plugin-snapshots'
import { reportError } from '../../infra/error-report'
import { hostEnvironment } from '../../infra/host-environment'
import {
  broadcastChatEvent,
  broadcastConcurrency,
  broadcastExtensionsChanged,
  broadcastHarnessAvailability,
  broadcastManagedMcpChanged,
  broadcastNativeResourcesChanged,
  broadcastOpenCodePluginsChanged,
  sendChatEvent
} from '../../infra/ipc/send'
import type { PeerPort } from '../../infra/ipc/peer-link'
import { getLogger } from '../../infra/log'
import { netFetch } from '../../infra/net/net-fetch'
import { runShellCommand } from '../../infra/shell/shell-runner'
import { shellServices } from '../../infra/shell-services'
import { createBootReportRecorder } from '../boot-report'
import { resolveWorkProfilePluginDir } from '../builtin-resources'
import { registerChatHandlers } from '../chat-turn'
import { discardSessionWork } from '../chat-turn/discard'
import { createComposerPreparation } from '../composer-preparation'
import type { ComposerPreparationService } from '../composer-preparation-service'
import { harnessConfigPort, type AgentContext, type DataPort } from '../context'
import { extensionControl } from '../extension-control'
import { registerEngineHandlers } from '../handlers/engine'
import { registerExtensionCatalogHandlers } from '../handlers/extension-catalog'
import { registerGitHandlers } from '../handlers/git'
import { registerMiscHandlers } from '../handlers/misc'
import { registerSessionResourceHandlers } from '../handlers/session-resources'
import { createHostHarnessPort } from '../harness-host'
import { createClaudeProcessReset } from '../harnesses/claude/processes'
import { OpenCodeGlobalWatch } from '../harnesses/opencode/global-watch'
import { OpenCodeMcpReconcile } from '../harnesses/opencode/mcp-reconcile'
import type { PreparedMcpResources } from '../harnesses/opencode/prepared-mcp-resources'
import { OpenCodeWarmup } from '../harnesses/opencode/warmup'
import {
  createAdapterRegistry,
  createHarnessDeploymentService,
  harnessModule,
  harnessPluginRoots,
  harnessSkillRoots,
  MockAdapter
} from '../harnesses/registry'
import type { HostAssembly, HostProcessContext } from '../host-process'
import type { DataQueryOps, McpResolution } from '../data-host/data-ops'
import { nativeSettingsShutdown } from '../native-settings-lifecycle'
import { createNativeHistoryReader } from '../native-history'
import type { NativeHistoryResult } from '../../adapters/common/native-history'
import { sessionActivityBusy as nativeHistoryBusy } from '../session-activity-busy'
import {
  projectResourcesIdle,
  ProjectResourceSync,
  type ProjectResourceTarget,
  type ResourceRequest
} from '../project-resource-sync'
import {
  createRemoteManagedMcp,
  createRemoteRuntimeTools,
  type RemoteManagedMcpSnapshot,
  type RemoteToolSnapshot
} from '../remote-tools'
import { sameSessionBinding } from '../session-binding'
import { registerSettingsReactions } from '../settings-reactions'
import { createAgentCallOps } from './agent-ops'
import { createDataLink, type DataLink } from './data-link'
import { createLifecycleEmitter, type LifecycleEmitter } from './lifecycle-emitter'
import { createPersistenceSender, type PersistenceSender } from './persistence-sender'
import { createSettingsMirror, type SettingsMirror } from './settings-mirror'

type SessionRow = NonNullable<Awaited<ReturnType<DataQueryOps['getSessionById']>>>

export class AgentBootstrap implements HostAssembly {
  private readonly bootReport = createBootReportRecorder()
  private readonly dataDirectory = hostEnvironment().userData
  private readonly mirror: SettingsMirror
  private readonly dataLink: DataLink
  private readonly data: DataPort
  private readonly sender: PersistenceSender
  private readonly remoteTools
  private readonly remoteMcp
  private readonly lifecycle: LifecycleEmitter
  private readonly pluginSnapshots = new PluginSnapshots(join(this.dataDirectory, 'runtime-plugins'))
  private readonly extensionChoices
  private readonly registry
  private readonly debugMock: DebugMockState = {
    enabled: false,
    scenarioId: 'full',
    contextUsageRatio: 0.3,
    log: false
  }
  private stopped = false
  private skillsCache: SkillInfo[] = []
  private mcpResolution: McpResolution = { config: {} as McpResolution['config'], values: {} }
  private deployment?: ExtensionDeploymentService
  private supervisor?: RuntimeSupervisor<ClientRef>
  private bus?: MainBus<ClientRef>
  private pendingMessages?: PendingMessageQueue
  private activity?: SessionActivityProjector
  private titles?: TitleGenerator
  private composerPreparation?: ComposerPreparationService
  private closeComposerCatalog?: import('../handlers/composer-catalog').ComposerCatalogRegistration
  private preparedMcpResources?: PreparedMcpResources
  private openCodeMcpReconcile?: OpenCodeMcpReconcile
  private openCodeWarmup?: OpenCodeWarmup
  private openCodeGlobalWatch?: OpenCodeGlobalWatch
  private openCodePluginsRevision = 0
  private claudeGlobalWatch?: FingerprintWatch
  private projectResourceSync?: ProjectResourceSync
  private background?: { dispose(sessionId: string): void }
  private readonly shellRuns = new Map<string, AbortController>()
  // 실행 쪽 동기 판정이 읽는 세션 메타 — 비동기 진입점에서 데이터 호스트에 다시 묻고 채운다.
  private readonly sessionRows = new Map<string, SessionRow>()
  private authState = { passed: false, resuming: false }
  private firstConnection = true
  private readonly stops: Array<() => void> = []
  readonly prepareShutdown: () => Promise<void>

  constructor(private readonly host: HostProcessContext) {
    this.mirror = createSettingsMirror({ requestWrite: (patch) => this.dataLink.writeSettings(patch) })
    this.dataLink = createDataLink({
      mirror: this.mirror,
      agentOps: createAgentCallOps({
        sessionActivity: (sessionId) => this.requireActivity().current(sessionId),
        discardSession: (sessionId) => this.discardSession(sessionId),
        readNativeHistory: (sessionId) => this.readNativeHistory(sessionId),
        runShell: (request) => {
          const controller = new AbortController()
          this.shellRuns.set(request.runId, controller)
          return runShellCommand({
            command: request.command,
            cwd: request.cwd,
            timeoutMs: request.timeoutMs,
            maxOutputBytes: request.maxOutputBytes,
            signal: controller.signal
          }).finally(() => this.shellRuns.delete(request.runId))
        },
        cancelShell: (runId) => this.shellRuns.get(runId)?.abort(),
        sessionBusy: (sessionId) => this.sessionBusy(sessionId),
        harnessInstalled: (harnessId) => createHostHarnessPort(this.registry).installed(harnessId),
        harnessListModels: (harnessId, provider, env) =>
          createHostHarnessPort(this.registry).listModels(harnessId, provider, {
            signal: new AbortController().signal,
            ...(env ? { env } : {})
          }),
        deployExtensions: (options) => this.deployExtensions(options)
      }),
      onNotify: (method, payload) => this.onDataNotify(method, payload),
      onInvalid: () => getLogger().child('peer').warn('peer.message.invalid', { side: 'agent' })
    })
    this.data = { query: this.dataLink.query, write: this.dataLink.write }
    const toolPort = {
      call: (request: Parameters<typeof this.data.query.runtimeToolCall>[0]) =>
        this.data.query.runtimeToolCall(request),
      cancel: (callId: string) => void this.data.write.runtimeToolCancel(callId).catch(() => undefined)
    }
    this.remoteTools = createRemoteRuntimeTools(toolPort)
    this.remoteMcp = createRemoteManagedMcp(toolPort, {
      acquire: (revision) => this.data.query.managedMcpAcquire(revision),
      release: (leaseId) => this.data.write.managedMcpRelease(leaseId)
    })
    this.sender = createPersistenceSender({
      link: this.dataLink.link,
      send: (owner, ev) => sendChatEvent(owner, ev),
      failTurn: (turn, message) => {
        turn.controller.abort()
        sendChatEvent(turn.owner, {
          type: 'error',
          sessionId: turn.dbSessionId ?? '',
          error: { category: 'stream_error', message, retryable: false }
        })
      }
    })
    this.lifecycle = createLifecycleEmitter({
      leases: () => this.supervisor?.allLeases() ?? [],
      emit: (message) => this.host.toShell(message)
    })
    this.extensionChoices = extensionControl({
      get: () => this.mirror.getAll().nativeExtensionChoices,
      set: (choices) => void this.mirror.patch({ nativeExtensionChoices: choices })
    })
    this.registry = createAdapterRegistry({
      managedMcp: {
        snapshot: () => this.remoteMcp.snapshot(),
        peek: () => this.remoteMcp.peek(),
        acquire: (snapshot) => this.remoteMcp.acquire(snapshot)
      },
      dataDirectory: this.dataDirectory,
      preferences: (harnessId) => (this.mirror.ready() ? this.mirror.getAll().harnesses?.[harnessId] : undefined),
      fetchImpl: netFetch,
      extensionControl: this.extensionChoices,
      pluginSnapshots: this.pluginSnapshots
    })
    this.prepareShutdown = nativeSettingsShutdown({
      freeze: () => this.pendingMessages?.freeze(),
      drain: async () => {
        await Promise.all([nativeFileMutations.close(), this.deployment?.close()])
      },
      shutdown: () => this.stopRuntimes(),
      cleanup: () => this.pluginSnapshots.close()
    })
  }

  private requireActivity(): SessionActivityProjector {
    if (!this.activity) throw new Error('세션 활동 투영이 아직 없다')
    return this.activity
  }

  private onDataNotify(method: string, payload: unknown): void {
    switch (method) {
      case 'tools.snapshot':
        this.remoteTools.apply(payload as RemoteToolSnapshot)
        return
      case 'mcp.snapshot':
        this.remoteMcp.apply(payload as RemoteManagedMcpSnapshot)
        return
      case 'auth.state':
        this.authState = payload as { passed: boolean; resuming: boolean }
        this.openCodeWarmup?.update()
        return
      case 'chat.relay':
        broadcastChatEvent(payload as Parameters<typeof broadcastChatEvent>[0])
        return
      default:
        this.sender.onNotify(method, payload)
    }
  }

  private skillRoots(): SkillScanRoot[] {
    return [
      {
        sourceId: 'orcinus-orca',
        sourceLabel: 'Orcinus orca 스킬',
        sourceKind: 'orcinus-orca',
        rootDir: sourcesSkillsDir()
      },
      ...harnessSkillRoots()
    ]
  }

  // 배포에 앞서 MCP 해석값과 스킬 목록 사본을 데이터 호스트에서 받는다.
  private async refreshDataCopies(): Promise<void> {
    const [resolution, skills] = await Promise.all([
      this.data.query.mcpResolution(),
      this.data.query.skills()
    ])
    this.mcpResolution = resolution
    this.skillsCache = skills
  }

  private async deployExtensions(options?: { throwOnFailure?: boolean }): Promise<void> {
    await this.refreshDataCopies()
    await this.deployment?.deployNow(options)
    await this.data.write.extensionsDeployed()
  }

  private async ensureExtensionsDeployedForTurn(): Promise<void> {
    await this.refreshDataCopies()
    await this.deployment?.ensureDeployed()
  }

  private async sessionRow(sessionId: string): Promise<SessionRow | undefined> {
    const row = await this.data.query.getSessionById(sessionId)
    if (row) this.sessionRows.set(sessionId, row)
    else this.sessionRows.delete(sessionId)
    return row ?? undefined
  }

  private sessionBusy(sessionId: string): boolean {
    const supervisor = this.supervisor
    if (!supervisor) return false
    return (
      supervisor.hasSession(sessionId) ||
      !!supervisor.peekRuntime(sessionId)?.providerGeneration ||
      (this.activity ? nativeHistoryBusy(this.activity.current(sessionId)) : false)
    )
  }

  private discardSession(sessionId: string): void {
    this.background?.dispose(sessionId)
    this.sender.forgetProviderSession(sessionId)
    this.supervisor?.discardRuntime(sessionId)
    this.pendingMessages?.dispose(sessionId)
    this.activity?.clear(sessionId)
    this.sessionRows.delete(sessionId)
    this.lifecycle.sessionEnded(sessionId)
  }

  // 세션 갱신의 하네스 원본 읽기(F4).
  private readNativeHistory(sessionId: string): Promise<NativeHistoryResult> {
    return createNativeHistoryReader(this.agentContext())(sessionId)
  }

  private agentContext(): AgentContext {
    return {
      registry: this.registry,
      extensions: this.extensions!,
      workProfilePluginPath: resolveWorkProfilePluginDir({
        isPackaged: hostEnvironment().isPackaged,
        resourcesPath: process.resourcesPath,
        appPath: hostEnvironment().appPath
      }),
      deployExtensions: (options) => this.deployExtensions(options),
      ensureExtensionsDeployedForTurn: () => this.ensureExtensionsDeployedForTurn(),
      debugMock: this.debugMock,
      mockAdapter: import.meta.env.DEV ? new MockAdapter(() => this.debugMock) : null,
      data: this.data,
      settings: this.mirror,
      harness: harnessConfigPort(this.data),
      defaultCwd: () => hostEnvironment().desktop
    }
  }

  private extensions?: ExtensionBuilder

  async start(): Promise<Extract<HostToShell, { type: 'ready' }>> {
    const installation = this.bootReport.step(
      'adapter-registry',
      { critical: true, label: '어댑터 설치 상태 갱신' },
      () => this.registry.refreshInstallState()
    )
    void installation.catch(() => undefined)
    this.extensions = new ExtensionBuilder(
      {
        getProjectContextForSession: (sessionId) =>
          this.data.query.getProjectContextForSession(sessionId),
        getProject: (projectId) => this.data.query.getProject(projectId)
      },
      () => this.skillsCache,
      () => this.mirror.getAll(),
      hostEnvironment().appVersion,
      harnessPluginRoots,
      this.remoteTools,
      this.remoteMcp
    )
    this.deployment = createHarnessDeploymentService(
      {
        enabledConfig: () => this.mcpResolution.config,
        resolver: () => (name) => this.mcpResolution.values[name]
      },
      () => this.skillRoots(),
      (roots) => this.pluginSnapshots.publish(roots)
    )
    this.register()
    // 데이터 호스트가 필요한 기동 일 — 연결될 때마다(첫 연결에서 배포).
    this.mirror.onSnapshot(() => {
      if (!this.firstConnection) return
      this.firstConnection = false
      registerSettingsReactions(this.mirror, {
        openCodeExecutablePath: this.mirror.getAll().harnesses?.opencode?.executablePath,
        recheckOpenCode: () => {
          if (!this.stopped)
            void this.registry.refreshInstallState('opencode').catch(() => undefined)
        }
      })
      void this.deployExtensions().catch((error: unknown) =>
        reportError({ event: 'extensions.deploy.failed', scope: 'extensions', title: 'saveFailed', error })
      )
      this.publishAvailability()
    })
    await installation
    this.bootReport.finish()
    void loadClaudeSdk().catch(() => undefined)
    this.stops.push(
      this.registry.onAvailabilityChange((state) => {
        if (this.stopped) return
        broadcastHarnessAvailability(state)
        this.publishAvailability()
        if (state.id !== 'opencode') return
        this.composerPreparation?.invalidate()
        this.openCodeWarmup?.update()
        this.updateOpenCodeGlobalWatch(false)
      }),
      // 창 포커스만 본다 — 절전 해제는 이 재확인의 원인이 아니다(EP-10).
      shellServices().onWake((reason) => {
        if (reason === 'window-focus') this.registry.focusRecheck()
      })
    )
    return { type: 'ready' }
  }

  private publishAvailability(): void {
    this.dataLink.link.notify('harness.availability', { states: this.registry.list() })
  }

  private register(): void {
    const ctx = this.agentContext()
    const supervisor = (this.supervisor = new RuntimeSupervisor<ClientRef>({
      activeTurns: new ActiveTurnTracker((event) => broadcastConcurrency(event)),
      capPolicy: new BoundedRuntimeCapPolicy(),
      capacity: 5
    }))
    supervisor.subscribeLeases(() => {
      this.lifecycle.leasesChanged()
      this.projectResourceSync?.leasesChanged()
    })
    const bus = (this.bus = new TypedBus<OoBusEvents<ClientRef>>())
    // 구독 순서 = 불변식(SD-05′): 저장 송신(critical) → 제목 → 중계.
    const titles = (this.titles = new TitleGenerator({
      getTitleSource: (sessionId) => this.data.query.getTitleSource(sessionId),
      updateSessionTitleAuto: (sessionId, title, updatedAt) =>
        this.data.write.updateSessionTitleAuto(sessionId, title, updatedAt)
    }))
    bus.on('turn.event', ({ turn, ev }) => this.sender.onTurnEvent(turn, ev), { critical: true })
    bus.on('turn.event', ({ turn, ev }) => {
      if (ev.type === 'session.updated' || ev.type === 'telemetry') titles.maybeStart(turn)
    })
    bus.on('turn.event', ({ turn, ev }) => this.sender.relay(turn, ev))

    const approvals = new ApprovalCoordinator((sessionId) => this.lifecycle.approvalPending(sessionId))
    const permissionModes = new PermissionModeController()
    const pendingMessages = (this.pendingMessages = new PendingMessageQueue())
    const backgroundTasks = new BackgroundTaskTracker()
    const activity = (this.activity = new SessionActivityProjector({
      queue: pendingMessages,
      backgroundTasks,
      leases: {
        subscribe: (listener) => supervisor.subscribeLeases(listener),
        foreground: (sessionId, transport) =>
          sessionForeground(
            supervisor.getChainBySession(sessionId) ??
              supervisor.getChainByKey(clientLeaseKey(sessionId)),
            transport
          )
      },
      emit: (event) => {
        broadcastChatEvent(event)
        this.projectResourceSync?.activityChanged()
        this.registry.get('opencode')?.resourceActivityChanged?.()
      }
    }))
    const worktrees = new WorktreeService(
      {
        insertManagedWorktree: (row) => this.data.write.insertManagedWorktree(row),
        getManagedWorktreeBySession: (sessionId) =>
          this.data.query.getManagedWorktreeBySession(sessionId),
        updateSessionCwd: (sessionId, cwd, updatedAt) =>
          this.data.write.updateSessionCwd(sessionId, cwd, updatedAt),
        deleteManagedWorktree: (id) => this.data.write.deleteManagedWorktree(id)
      },
      managedWorktreesDir(import.meta.env.DEV)
    )
    this.background = registerChatHandlers({
      ctx,
      supervisor,
      bus,
      approvals,
      persistence: this.sender as never,
      loadBackgroundEvents: (sessionId) => this.backgroundEventsCache.get(sessionId) ?? [],
      prefetchBackgroundEvents: async (sessionId) => {
        if (this.backgroundEventsCache.has(sessionId)) return
        this.backgroundEventsCache.set(sessionId, await this.data.query.backgroundEvents(sessionId))
      },
      permissionModes,
      pendingMessages,
      backgroundTasks,
      activity,
      onHarnessExited: (sessionId) => this.lifecycle.harnessExited(sessionId),
      isUpdateInstallPending: () => false,
      prepareOutputFiles: async (cwd) => {
        const directory = await prepareOutputDirectory(cwd)
        return {
          directory,
          capture: async (path, context, expectedContent) => {
            const signal = context.getSignal()
            const sessionId = await context.waitForSession(signal)
            const file = await this.data.query.captureOutput({
              path,
              directory,
              sessionId,
              cwd: context.cwd,
              extraDirs: [...context.extraDirs],
              ...(expectedContent !== undefined ? { expectedContent } : {})
            })
            if (file && !signal.aborted) {
              broadcastChatEvent({ type: 'artifact.published', sessionId, artifact: file })
            }
            return file ?? undefined
          }
        }
      },
      worktrees
    })
    approvals.registerHandlers(supervisor, permissionModes, (sessionId) => {
      const kind = this.sessionRows.get(sessionId)?.agent_kind
      return kind === undefined ? undefined : parseAgentKind(kind)
    })

    const preparation = createComposerPreparation(ctx)
    this.composerPreparation = preparation.service
    this.closeComposerCatalog = preparation.close
    const preparedMcp = (this.preparedMcpResources = preparation.resources)
    this.stops.push(
      this.remoteMcp.subscribe((revision, kind) => {
        if (kind !== 'connections') {
          this.registry.get('opencode')?.extensionsChanged?.()
          this.closeComposerCatalog?.invalidate()
          preparedMcp.invalidate()
        } else this.openCodeMcpReconcile?.changed()
        broadcastManagedMcpChanged(revision)
      })
    )
    const resolveResourceTarget = (request: ResourceRequest): ProjectResourceTarget | undefined => {
      const session = 'sessionId' in request ? this.sessionRows.get(request.sessionId) : undefined
      if ('sessionId' in request && !session) return undefined
      const scope = session
        ? { backend: session.backend, cwd: session.cwd, projectId: session.project_id }
        : (request as import('../../../shared/native-resources').DraftNativeResourcesRequest)
      const cwd = scope.cwd ?? (scope.projectId ? null : hostEnvironment().desktop)
      if (!cwd || !isAbsolute(cwd)) return undefined
      return {
        backend: scope.backend,
        cwd,
        request,
        key: JSON.stringify([
          scope.backend,
          'directory',
          harnessModule(scope.backend).nativeResourceScope?.(cwd) ?? cwd
        ]),
        runtime: 'sessionId' in request ? supervisor.peekRuntime(request.sessionId) : undefined
      }
    }
    const projectSync = (this.projectResourceSync = new ProjectResourceSync({
      resolve: resolveResourceTarget,
      targets: () =>
        supervisor
          .runtimeEntries()
          .flatMap(({ sessionId }) => resolveResourceTarget({ sessionId }) ?? []),
      policy: (backend) => harnessModule(backend).projectResources,
      idle: (target) =>
        !target.runtime ||
        ('sessionId' in target.request &&
          projectResourcesIdle(activity.current(target.request.sessionId), target.runtime)),
      read: (request) => readResources(request),
      emit: (sessionId, resources) => broadcastNativeResourcesChanged({ sessionId, resources })
    }))
    const sessionDirectory = async (sessionId: string): Promise<{ row: SessionRow; cwd: string } | undefined> => {
      const row = await this.sessionRow(sessionId)
      if (!row) return undefined
      const cwd =
        row.cwd ??
        (await this.data.query.workspacePaths([row.project_id ?? null]))[0]?.[1] ??
        hostEnvironment().desktop
      return { row, cwd }
    }
    const readResources = registerSessionResourceHandlers({
      lookup: (sessionId) => supervisor.peekRuntime(sessionId),
      configuredResources: async (sessionId) => {
        const found = await sessionDirectory(sessionId)
        if (!found) return []
        const items = await harnessModule(found.row.backend).configuredResources?.(
          found.cwd,
          this.extensionChoices.global(found.row.backend)
        )
        if (!sameSessionBinding(await this.sessionRow(sessionId), found.row))
          throw new Error('대화가 바뀌었습니다. 메뉴를 다시 열어 주세요.')
        return items
      },
      configuredCommands: async (sessionId) => {
        const found = await sessionDirectory(sessionId)
        if (!found) return []
        const commands = await harnessModule(found.row.backend).configuredCommands?.(
          found.cwd,
          this.extensionChoices.global(found.row.backend)
        )
        if (!sameSessionBinding(await this.sessionRow(sessionId), found.row))
          throw new Error('대화가 바뀌었습니다. 메뉴를 다시 열어 주세요.')
        return commands
      },
      draftCommands: async ({ backend, cwd, projectId }) => {
        const directory =
          cwd ?? (await this.data.query.workspacePaths([projectId ?? null]))[0]?.[1] ?? ''
        if (!isAbsolute(directory)) throw new Error('작업 폴더는 절대 경로여야 합니다.')
        return (
          (await harnessModule(backend).configuredCommands?.(
            directory,
            this.extensionChoices.global(backend)
          )) ?? []
        )
      },
      draftResources: async ({ backend, cwd, projectId }) => {
        const directory =
          cwd ?? (await this.data.query.workspacePaths([projectId ?? null]))[0]?.[1] ?? ''
        if (!isAbsolute(directory)) throw new Error('작업 폴더는 절대 경로여야 합니다.')
        const module = harnessModule(backend)
        return (module.draftResources ?? module.configuredResources)?.(
          directory,
          this.extensionChoices.global(backend)
        )
      },
      projectSync,
      preparedMcp,
      // 세션 범위 요청 전에 세션 메타 사본을 채운다(동기 판정이 읽는다).
      prefetch: async (request) => {
        if ('sessionId' in request) await this.sessionRow(request.sessionId)
      }
    })
    const openCode = this.registry.get('opencode')
    if (openCode)
      this.openCodeMcpReconcile = new OpenCodeMcpReconcile({
        adapter: openCode,
        peers: () =>
          supervisor.runtimeEntries().flatMap(({ sessionId }) => {
            const target = resolveResourceTarget({ sessionId })
            return target?.backend === 'opencode' && target.runtime
              ? [{ cwd: target.cwd, runtime: target.runtime, activity: activity.current(sessionId) }]
              : []
          }),
        changed: () => projectSync.connectionsChanged('opencode')
      })
    this.openCodeWarmup = new OpenCodeWarmup({
      service: preparation.service,
      allowed: () =>
        !this.stopped &&
        this.registry.availability('opencode').usable &&
        this.authState.passed &&
        !this.authState.resuming,
      settings: () => this.mirror.getAll(),
      cwd: () => hostEnvironment().desktop,
      installed: async () => ({ installed: (await this.registry.settled('opencode')).usable })
    })
    registerEngineHandlers(ctx)
    registerMiscHandlers(ctx)
    this.updateOpenCodeGlobalWatch(true)
    const nativeClaude = claudeNativePaths()
    this.claudeGlobalWatch = new FingerprintWatch({
      files: [
        nativeClaude.settings,
        join(nativeClaude.root, 'plugins', 'installed_plugins.json'),
        process.env.CLAUDE_CONFIG_DIR?.trim()
          ? join(nativeClaude.root, '.claude.json')
          : join(homedir(), '.claude.json')
      ],
      changed: () => broadcastExtensionsChanged({ backend: 'claude' }),
      failed: (error) =>
        reportError({ event: 'claude.extensions.watch-failed', scope: 'engine', title: 'saveFailed', error })
    })
    registerExtensionCatalogHandlers(
      this.extensionChoices,
      createClaudeProcessReset({
        supervisor,
        backendOf: (sessionId) => this.sessionRows.get(sessionId)?.backend as Backend | undefined,
        activity: (sessionId) => activity.current(sessionId),
        discardSession: (sessionId) =>
          discardSessionWork({ activity, supervisor, pendingMessages }, sessionId, broadcastChatEvent),
        failed: (error) =>
          reportError({
            event: 'extensions.claude-processes.close-failed',
            scope: 'native-resources',
            title: 'claudeSessionsCloseFailed',
            error
          })
      }),
      (backend) => {
        if (backend === 'opencode') this.openCodeMcpReconcile?.changed()
        broadcastExtensionsChanged({ backend })
      }
    )
    registerGitHandlers({
      getSessionBaseline: (sessionId) => this.data.query.sessionBaseline(sessionId)
    })
  }

  // 백그라운드 작업 기록의 복원 읽기 — 동기 계약이라 첫 관찰 전에 데이터 호스트에서 받아 둔다.
  private readonly backgroundEventsCache = new Map<string, import('../../../shared/background-task').BackgroundEvent[]>()

  private updateOpenCodeGlobalWatch(initial: boolean): void {
    if (!this.registry.availability('opencode').usable || this.stopped) {
      this.openCodeGlobalWatch?.close()
      this.openCodeGlobalWatch = undefined
      return
    }
    if (this.openCodeGlobalWatch) return
    if (!initial) invalidateOpenCodeDiscovery()
    this.openCodeGlobalWatch = new OpenCodeGlobalWatch({
      files: openCodeGlobalConfigFiles(),
      fingerprint: openCodeGlobalPluginFingerprint,
      dirty: invalidateOpenCodeDiscovery,
      changed: () => {
        this.registry.get('opencode')?.extensionsChanged?.()
        this.composerPreparation?.invalidate()
        this.preparedMcpResources?.invalidate()
        broadcastOpenCodePluginsChanged({ revision: ++this.openCodePluginsRevision })
      },
      extensionsChanged: () => broadcastExtensionsChanged({ backend: 'opencode' }),
      failed: (error) =>
        reportError({ event: 'opencode.plugins.watch-failed', scope: 'engine', title: 'saveFailed', error })
    })
    if (!initial) broadcastOpenCodePluginsChanged({ revision: ++this.openCodePluginsRevision })
  }

  attachPeer(port: PeerPort): void {
    this.dataLink.attach(port)
  }

  prepareInstall(): void {
    this.supervisor?.closeIdleRuntimes()
  }

  // 런타임 정지 — 열린 도구를 'aborted' 로 정착하고(저장 스트림으로 간다) 하네스를 닫는다.
  private stopRuntimes(): void {
    if (this.stopped) return
    this.stopped = true
    for (const stop of this.stops) stop()
    this.pendingMessages?.freeze()
    this.openCodeWarmup?.close()
    this.openCodeGlobalWatch?.close()
    this.claudeGlobalWatch?.close()
    this.openCodeMcpReconcile?.close()
    this.closeComposerCatalog?.()
    this.preparedMcpResources?.close()
    this.projectResourceSync?.close()
    this.registry.close()
    this.titles?.dispose()
    for (const controller of this.shellRuns.values()) controller.abort()
    const supervisor = this.supervisor
    const bus = this.bus
    if (supervisor && bus) {
      const emit = (turn: TurnContext<ClientRef>, ev: NormalizedEvent): void => {
        try {
          bus.emit('turn.event', { turn, ev })
        } catch (e) {
          getLogger()
            .child('chat')
            .warn('chat.turn-event.emit-failed', { phase: 'shutdown', message: String(e) })
        }
      }
      for (const turn of supervisor.all()) {
        settleOpenToolRuns(turn, emit, 'aborted')
        turn.controller.abort()
      }
      supervisor.closeAllLeaseRuntimes()
      supervisor.closeIdleRuntimes()
    }
    this.pendingMessages?.disposeAll()
    this.activity?.dispose()
  }

  // 앱 종료(AC32′) — 런타임 정지 → 저장 스트림 비움. 데이터 호스트는 이 뒤에 내려간다.
  async shutdown(): Promise<void> {
    await this.prepareShutdown()
  }
}
