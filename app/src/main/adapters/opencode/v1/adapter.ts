// /v2/client is the flat-parameter client export used by OpenCode 1.x.
import { createOpencodeClient, type OpencodeClient } from '@opencode-ai/sdk/v2/client'
import type { AgentEnvironment, ClassifiedError } from '../../../../shared/ipc'
import type { CompleteRequest, LiveTurn, SessionAdapter } from '../../common/types'
import type { TurnRequest } from '../../common/turn'
import type { OpenCodeServer } from '../implementation'
import { OPENCODE_DESCRIPTOR } from './descriptor'
import { openCodeCatalog } from './catalog'
import { classifyOpenCodeError } from './errors'
import { openCodeChannel } from './channel'
import { modelRef } from './model-ref'
import type { NativeHistoryRequest, NativeHistoryResult } from '../../common/native-history'
import { readOpenCodeHistory, nativeRevision } from './native-history'
import { nativeOpenCodeData, nativeOpenCodeEnvironment } from './native-storage'
import type { LegacyStorageMigration } from './legacy-storage-migration'

export class OpenCodeAdapter implements SessionAdapter {
  private readonly catalogs = new WeakMap<
    object,
    { expires: number; result: Promise<AgentEnvironment> }
  >()
  readonly id = 'opencode' as const
  constructor(
    private readonly servers: OpenCodeServer,
    private readonly fetchImpl: typeof fetch,
    private readonly migration?: LegacyStorageMigration
  ) {}
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
  close(): void {
    this.servers.close()
  }

  async client(
    config: Record<string, unknown> = {},
    env?: Record<string, string>,
    cwd?: string
  ): Promise<OpencodeClient> {
    const server = await this.servers.acquire(config, env, cwd)
    return createOpencodeClient({
      baseUrl: server.url,
      headers: server.headers,
      fetch: this.fetchImpl,
      throwOnError: true
    })
  }

  async catalog(
    entry: AgentEnvironment,
    config: Record<string, unknown>,
    refresh = false,
    env?: Record<string, string>
  ): Promise<AgentEnvironment> {
    const server = await this.servers.acquire(config, env)
    const cached = this.catalogs.get(server)
    if (!refresh && cached && cached.expires > Date.now())
      return { ...entry, ...(await cached.result), key: entry.key, provider: entry.provider }
    const client = createOpencodeClient({
      baseUrl: server.url,
      headers: server.headers,
      fetch: this.fetchImpl,
      throwOnError: true
    })
    const result = (async (): Promise<AgentEnvironment> => {
      const [providers, agents] = await Promise.all([
        client.config.providers({}, { signal: AbortSignal.timeout(15000), throwOnError: true }),
        client.app.agents({}, { signal: AbortSignal.timeout(15000), throwOnError: true })
      ])
      if (!providers.data || !agents.data) throw new Error('OpenCode 모델 목록을 읽을 수 없습니다.')
      return openCodeCatalog(entry, providers.data.providers, agents.data, providers.data.default)
    })()
    const cache = { expires: Date.now() + 60000, result }
    this.catalogs.set(server, cache)
    try {
      return await result
    } catch (error) {
      if (this.catalogs.get(server) === cache) this.catalogs.delete(server)
      throw error
    }
  }

  async complete(req: CompleteRequest): Promise<string> {
    const client = await this.client(req.providerSettings?.settings, req.env, req.cwd)
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
  }

  sendMessage(req: TurnRequest): LiveTurn {
    return openCodeChannel(req, () => this.client(req.providerSettings?.settings, req.env, req.cwd))
  }

  readHistory(req: NativeHistoryRequest): Promise<NativeHistoryResult> {
    const config = req.providerSettings?.settings ?? {}
    const databasePath = (): Promise<string> => {
      if (!this.servers.databasePath)
        return Promise.resolve(
          nativeOpenCodeData(nativeOpenCodeEnvironment(config, req.env), req.cwd)
        )
      return this.servers.databasePath(config, req.env, req.cwd)
    }
    return readOpenCodeHistory(req, {
      client: () => this.client(config, req.env, req.cwd),
      sourceKey: async () => nativeRevision([await databasePath(), req.cwd]),
      ...(this.migration && this.servers.databasePath
        ? {
            migrate: async () =>
              this.migration!.migrate({
                sessionId: req.sessionId,
                cwd: req.cwd,
                targetDatabase: await databasePath(),
                nativeData: nativeOpenCodeData(nativeOpenCodeEnvironment(config, req.env), req.cwd)
              })
          }
        : {})
    })
  }

  classifyError(error: unknown): ClassifiedError {
    return classifyOpenCodeError(error, 'provider_connection_error')
  }
}
