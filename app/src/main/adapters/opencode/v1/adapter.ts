// /v2/client is the flat-parameter client export used by OpenCode 1.x.
import type { AgentEnvironment, ClassifiedError } from '../../../../shared/ipc'
import type { CompleteRequest, LiveTurn, SessionAdapter } from '../../common/types'
import type { TurnRequest } from '../../common/turn'
import type { OpenCodeServer } from '../implementation'
import { OPENCODE_DESCRIPTOR } from './descriptor'
import { openCodeCatalog } from './catalog'
import { classifyOpenCodeError } from './errors'
import { openCodeChannel } from './channel'
import { routeNativeSession } from '../../common/recovery'
import { modelRef } from './model-ref'
import type { NativeHistoryRequest, NativeHistoryResult } from '../../common/native-history'
import { readOpenCodeHistory, nativeRevision } from './native-history'
import {
  nativeOpenCodeData,
  nativeOpenCodeEnvironment,
  nativeWorkingDirectory
} from './native-storage'
import { OpenCodeSessionContexts, type OpenCodeClientLease } from './session-context'
import { probeNativeCursor } from './native-cursor'
import type { openFileDatabase } from '../../../infra/db/file-database'
import type { LegacyStorageMigration } from './legacy-storage-migration'
import { reportError } from '../../../infra/error-report'
import type { ComposerCatalogData } from '../../../../shared/composer-catalog'
import type { ManagedMcpRuntime, ManagedMcpSnapshot } from '../../common/managed-mcp'
import { mapManagedMcpResources, projectManagedMcp } from './managed-mcp'
import { configuredOpenCodeResources } from './configured-resources'
import { openCodeDiscovery } from './discovery-cache'

export class OpenCodeAdapter implements SessionAdapter {
  readonly id = 'opencode' as const
  private readonly contexts: OpenCodeSessionContexts
  private readonly reportedMcpFailures = new Set<string>()
  private reportMcpFailure(key: string, sourceId: string): void {
    if (this.reportedMcpFailures.has(key)) return
    if (this.reportedMcpFailures.size >= 128)
      this.reportedMcpFailures.delete(this.reportedMcpFailures.values().next().value!)
    this.reportedMcpFailures.add(key)
    reportError({
      event: 'managed-mcp.connection.failed',
      scope: 'engine',
      title: 'engineInternal',
      level: 'warn',
      detail: '일부 MCP 연결을 완료하지 못했습니다. 플러그인 설정을 확인해 주세요.',
      data: { sourceId }
    })
  }
  constructor(
    private readonly servers: OpenCodeServer,
    fetchImpl: typeof fetch,
    private readonly migration?: LegacyStorageMigration,
    private readonly openDatabase?: typeof openFileDatabase,
    extensionControl?: import('../../common/extension-control').ExtensionControl,
    private readonly preferences?: () =>
      import('../../../../shared/harness').OpenCodePreferences | undefined,
    private readonly managedMcp?: ManagedMcpRuntime
  ) {
    this.contexts = new OpenCodeSessionContexts(fetchImpl, 4096, extensionControl, undefined, () =>
      reportError({
        event: 'opencode.instance.dispose.failed',
        scope: 'engine',
        title: 'engineInternal',
        level: 'warn',
        detail: 'OpenCode 프로젝트 정리를 완료하지 못했습니다. 새 연결로 다시 시작해 주세요.'
      })
    )
  }
  agentSpawnEnv(): Record<string, never> {
    return {}
  }
  describe(): typeof OPENCODE_DESCRIPTOR {
    return OPENCODE_DESCRIPTOR
  }
  isInstalled(): ReturnType<OpenCodeServer['installed']> {
    return this.servers.installed()
  }
  async *install(): AsyncIterable<{ step: string; error?: string; done?: boolean }> {
    yield {
      step: 'failed',
      error: 'OpenCode CLI를 설치한 뒤 하네스 설정에서 실행 파일을 지정해 주세요.',
      done: true
    }
  }
  extensionsChanged(): void {
    this.contexts.retireAll()
    this.servers.retireAll?.()
  }

  restartRevision(snapshot: ManagedMcpSnapshot | undefined): number | undefined {
    return snapshot?.definitionRevision ?? snapshot?.revision
  }
  configureResourceActivity(idle: (cwd: string, beforeSubmit: boolean) => boolean): void {
    this.contexts.configureResourceActivity(idle)
  }
  reconcileConnections(): Promise<void> {
    return this.contexts.reconcileConnections()
  }

  close(): void {
    this.contexts.close()
    this.servers.close()
  }

  async client(
    config: Record<string, unknown> = {},
    env?: Record<string, string>,
    cwd?: string,
    snapshot: ManagedMcpSnapshot | undefined = this.managedMcp?.snapshot()
  ): Promise<OpenCodeClientLease> {
    const bridge = snapshot && this.managedMcp ? await this.managedMcp.acquire(snapshot) : undefined
    let projection: ReturnType<typeof projectManagedMcp> | undefined
    let server: Awaited<ReturnType<OpenCodeServer['acquire']>>
    try {
      const native = await configuredOpenCodeResources(cwd || nativeWorkingDirectory(), {
        ...process.env,
        ...env
      })
      if (snapshot && bridge) {
        projection = projectManagedMcp(
          snapshot,
          bridge,
          config,
          native.filter((item) => item.kind === 'mcp').map((item) => item.id)
        )
        for (const failure of projection.failures)
          this.reportMcpFailure(
            `${snapshot.revision}:${failure.sourceId}:collision`,
            failure.sourceId
          )
      }
      server = await this.servers.acquire(
        projection?.config ?? config,
        projection ? { ...env, ...projection.env } : env,
        cwd
      )
    } catch (error) {
      await bridge?.release()
      throw error
    }
    try {
      const identities = projection?.identities ?? new Map()
      const choices = (): Record<string, boolean> => {
        const current = this.managedMcp?.snapshot()
        return Object.fromEntries(
          [...identities].map(([id, identity]) => [
            id,
            !!current &&
              this.restartRevision(current) === this.restartRevision(snapshot) &&
              (identity.kind === 'user'
                ? Object.hasOwn(current.users, identity.sourceId)
                : [...current.plugins.values()].some(
                    (plugin) =>
                      plugin.identity.sourceId === identity.sourceId && plugin.authorized()
                  ))
          ])
        )
      }
      const lease = await this.contexts.acquire(
        server,
        cwd || nativeWorkingDirectory(),
        () => {
          server.release?.()
          void bridge?.release().catch(() => undefined)
        },
        projection ? { choices } : undefined,
        openCodeDiscovery.key(
          'configured',
          cwd || nativeWorkingDirectory(),
          { ...process.env, ...env },
          'false'
        )
      )
      const mapMcpResources = (
        items: import('../../../../shared/native-resources').NativeResource[]
      ): import('../../../../shared/native-resources').NativeResource[] => {
        const current = this.managedMcp?.snapshot()
        return mapManagedMcpResources(items, identities).filter((item) => {
          if (!item.managedSource) return true
          if (item.status === 'failed' || item.status === 'needs-auth')
            this.reportMcpFailure(
              `${snapshot?.revision}:${item.id}:${item.status}`,
              item.managedSource.sourceId
            )
          if (!current || this.restartRevision(current) !== this.restartRevision(snapshot))
            return false
          if (item.managedSource.kind === 'user')
            return Object.hasOwn(current.users, item.managedSource.sourceId)
          return [...current.plugins.values()].some(
            (plugin) =>
              plugin.identity.sourceId === item.managedSource?.sourceId && plugin.authorized()
          )
        })
      }
      let releasing: Promise<void> | undefined
      return {
        ...lease,
        get managedMcpMentions() {
          const enabled = choices()
          return Object.fromEntries(
            [...identities]
              .filter(([id]) => enabled[id])
              .map(([id, source]) => [source.mentionId, id])
          )
        },
        mapMcpResources,
        mcp: async (signal, refresh) => mapMcpResources(await lease.mcp(signal, refresh)),
        release: () => {
          releasing ??= lease.release().catch(() =>
            reportError({
              event: 'opencode.instance.dispose.failed',
              scope: 'engine',
              title: 'engineInternal',
              detail: 'OpenCode 프로젝트 정리를 완료하지 못했습니다. 새 연결로 다시 시작해 주세요.',
              level: 'warn'
            })
          )
          return releasing
        }
      }
    } catch (error) {
      server.release?.()
      await bridge?.release()
      throw error
    }
  }

  catalog: NonNullable<SessionAdapter['catalog']> = async (
    entry,
    config
  ): Promise<AgentEnvironment> => openCodeCatalog(entry, config)

  prepareComposer: NonNullable<SessionAdapter['prepareComposer']> = async (req) => {
    const lease = await this.client(req.providerSettings?.settings, req.env, req.cwd)
    const readers: {
      [K in keyof ComposerCatalogData]: (
        signal: AbortSignal,
        refresh?: boolean
      ) => Promise<ComposerCatalogData[K]>
    } = {
      agents: lease.agents,
      models: lease.models,
      mcp: lease.mcp,
      plugins: (signal, refresh) => lease.plugins(signal, refresh, { ...process.env, ...req.env })
    }
    return {
      generation: lease.generation,
      activate: lease.activate,
      signal: lease.signal,
      read: (part, signal, refresh) => readers[part](signal, refresh),
      release: lease.release
    }
  }

  async complete(req: CompleteRequest): Promise<string> {
    const { client, release } = await this.client(req.providerSettings?.settings, req.env, req.cwd)
    try {
      const session = (
        await client.session.create(
          { directory: req.cwd, permission: [{ permission: '*', pattern: '*', action: 'deny' }] },
          { signal: req.signal, throwOnError: true }
        )
      ).data
      if (!session) throw new Error('OpenCode 보조 세션 생성 실패')
      try {
        const answer = await client.session.prompt(
          {
            sessionID: session.id,
            directory: req.cwd,
            ...(req.model ? { model: modelRef(req.model) } : {}),
            tools: {},
            parts: [{ type: 'text', text: req.prompt }]
          },
          { signal: req.signal, throwOnError: true }
        )
        if (answer.data?.info.error) {
          throw new Error(classifyOpenCodeError(answer.data.info.error).message, {
            cause: answer.data.info.error
          })
        }
        return (
          answer.data?.parts
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('') ?? ''
        )
      } finally {
        await client.session
          .delete(
            { sessionID: session.id, directory: req.cwd },
            { signal: AbortSignal.timeout(5000) }
          )
          .catch(() => undefined)
      }
    } finally {
      await release()
    }
  }

  async recoverSession(
    req: NativeHistoryRequest
  ): Promise<{ sessionId: string; freshStart: boolean }> {
    const { client, release } = await this.client(req.providerSettings?.settings, req.env, req.cwd)
    try {
      const created = await client.session.create(
        {
          directory: req.cwd,
          permission: [{ permission: '*', pattern: '*', action: 'ask' }]
        },
        { throwOnError: true }
      )
      if (!created.data?.id) throw new Error('OpenCode 복구 세션 생성 실패')
      return { sessionId: created.data.id, freshStart: false }
    } finally {
      await release()
    }
  }

  sendMessage(req: TurnRequest): LiveTurn {
    const nativeId = req.nativeSessionId ?? req.sessionId
    let release: () => void | Promise<void> = () => undefined
    const live = openCodeChannel(
      { ...req, sessionId: nativeId },
      async () => {
        const connection = await this.client(
          req.providerSettings?.settings,
          req.env,
          req.cwd,
          req.extensions.managedMcp
        )
        release = connection.release
        return connection
      },
      () => release(),
      this.preferences
    )
    return nativeId && req.sessionId ? routeNativeSession(live, nativeId, req.sessionId) : live
  }

  async readHistory(req: NativeHistoryRequest): Promise<NativeHistoryResult> {
    const config = req.providerSettings?.settings ?? {}
    let resolvedPath: Promise<string> | undefined
    const databasePath = (): Promise<string> => {
      if (resolvedPath) return resolvedPath
      if (!this.servers.databasePath)
        return Promise.resolve(
          nativeOpenCodeData(nativeOpenCodeEnvironment(config, req.env), req.cwd)
        )
      return (resolvedPath = this.servers.databasePath(config, req.env, req.cwd))
    }
    let connection: Awaited<ReturnType<OpenCodeAdapter['client']>> | undefined
    try {
      return await readOpenCodeHistory(req, {
        client: async () => {
          connection ??= await this.client(config, req.env, req.cwd)
          return connection.client
        },
        probe:
          this.openDatabase && this.servers.databasePath
            ? async () => probeNativeCursor(this.openDatabase!, await databasePath(), req.sessionId)
            : undefined,
        sourceKey: async () => nativeRevision([await databasePath(), req.cwd]),
        ...(this.migration && this.servers.databasePath
          ? {
              migrate: async () =>
                this.migration!.migrate({
                  sessionId: req.sessionId,
                  cwd: req.cwd,
                  targetDatabase: await databasePath(),
                  nativeData: nativeOpenCodeData(
                    nativeOpenCodeEnvironment(config, req.env),
                    req.cwd
                  )
                })
            }
          : {})
      })
    } finally {
      await connection?.release()
    }
  }

  classifyError(error: unknown): ClassifiedError {
    return classifyOpenCodeError(error, 'provider_connection_error')
  }
}
