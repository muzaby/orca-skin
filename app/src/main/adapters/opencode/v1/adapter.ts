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

export class OpenCodeAdapter implements SessionAdapter {
  readonly id = 'opencode' as const
  private readonly contexts: OpenCodeSessionContexts
  constructor(
    private readonly servers: OpenCodeServer,
    fetchImpl: typeof fetch,
    private readonly migration?: LegacyStorageMigration,
    private readonly openDatabase?: typeof openFileDatabase
  ) {
    this.contexts = new OpenCodeSessionContexts(fetchImpl)
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
  close(): void {
    this.contexts.close()
    this.servers.close()
  }

  async client(
    config: Record<string, unknown> = {},
    env?: Record<string, string>,
    cwd?: string
  ): Promise<OpenCodeClientLease> {
    const server = await this.servers.acquire(config, env, cwd)
    try {
      const lease = await this.contexts.acquire(server, cwd || nativeWorkingDirectory())
      let releasing: Promise<void> | undefined
      return {
        ...lease,
        release: () => {
          releasing ??= lease
            .release()
            .catch(() =>
              reportError({
                event: 'opencode.instance.dispose.failed',
                scope: 'engine',
                title: 'engineInternal',
                detail:
                  'OpenCode 프로젝트 정리를 완료하지 못했습니다. 새 연결로 다시 시작해 주세요.',
                level: 'warn'
              })
            )
            .finally(() => server.release?.())
          return releasing
        }
      }
    } catch (error) {
      server.release?.()
      throw error
    }
  }

  catalog: NonNullable<SessionAdapter['catalog']> = async (
    entry,
    config
  ): Promise<AgentEnvironment> => openCodeCatalog(entry, config)

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
        const connection = await this.client(req.providerSettings?.settings, req.env, req.cwd)
        release = connection.release
        return connection
      },
      () => release()
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
