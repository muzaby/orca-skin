// /v2/client는 OpenCode 1.x의 flat-parameter SDK export다. 제품 2.x의 client.v2 API는 쓰지 않는다.
import { createOpencodeClient, type Event, type OpencodeClient } from '@opencode-ai/sdk/v2/client'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import type {
  AgentEnvironment,
  ClassifiedError,
  NormalizedEvent,
  PermissionAction
} from '../../../../shared/ipc'
import { isRecord } from '../../../../shared/obj'
import type { CompleteRequest, LiveTurn, ProviderMessageBatch, SessionAdapter } from '../../types'
import type { TurnRequest } from '../../turn'
import type { OpenCodeServer } from '../implementation'
import { OPENCODE_DESCRIPTOR } from './descriptor'
import { normalizeOpenCodeTool } from './map'
import { OpenCodeActivityMapper } from './activity'
import { openCodeCatalog } from './catalog'
import { classifyOpenCodeError } from './errors'

export class OpenCodeAdapter implements SessionAdapter {
  private readonly catalogs = new WeakMap<
    object,
    { expires: number; result: Promise<AgentEnvironment> }
  >()
  readonly id = 'opencode' as const
  constructor(
    private readonly servers: OpenCodeServer,
    private readonly fetchImpl: typeof fetch
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
    env?: Record<string, string>
  ): Promise<OpencodeClient> {
    const server = await this.servers.acquire(config, env)
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
    refresh = false
  ): Promise<AgentEnvironment> {
    const server = await this.servers.acquire(config)
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
    const client = await this.client(req.providerSettings?.settings, req.env)
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
    const controller = new AbortController()
    const signal = req.signal ? AbortSignal.any([req.signal, controller.signal]) : controller.signal
    let client: OpencodeClient | undefined
    let sessionId = req.sessionId
    let finished = false
    let interrupting: Promise<void> | undefined
    const abort = (): Promise<void> => {
      interrupting ??= (async () => {
        if (client && sessionId && !finished) {
          await client.session.abort(
            { sessionID: sessionId, directory: req.cwd },
            { signal: AbortSignal.timeout(5000), throwOnError: true }
          )
        }
      })()
      return interrupting
    }
    const onAbort = (): void => {
      void abort().catch(() => undefined)
    }
    signal.addEventListener('abort', onAbort, { once: true })
    const connect = this.client.bind(this)
    const classify = this.classifyError.bind(this)
    const backend = this.id
    async function* batches(): AsyncGenerator<ProviderMessageBatch> {
      let sequence = 0
      let iterator: AsyncGenerator<Event> | undefined
      const emit = (events: NormalizedEvent[]): ProviderMessageBatch => ({
        sequence: ++sequence,
        events
      })
      try {
        signal.throwIfAborted()
        if (req.forkFrom) throw new Error('OpenCode 세션 분기는 지원하지 않습니다.')
        client = await connect(req.providerSettings?.settings, req.env)
        signal.throwIfAborted()
        if (!sessionId) {
          const created = await client.session.create(
            { directory: req.cwd, permission: [{ permission: '*', pattern: '*', action: 'ask' }] },
            { signal, throwOnError: true }
          )
          sessionId = created.data?.id ?? null
        }
        if (!sessionId) throw new Error('OpenCode 세션 생성 실패')
        yield emit([
          {
            type: 'session.updated',
            sessionId,
            patch: { backend: backend, cwd: req.cwd, ...(req.model ? { model: req.model } : {}) }
          }
        ])
        const subscription = await client.event.subscribe(
          { directory: req.cwd },
          { signal, sseMaxRetryAttempts: 0 }
        )
        iterator = subscription.stream
        // SSE is lazy. Await its connected event before sending the prompt.
        const readyTimer = setTimeout(
          () => controller.abort(new Error('OpenCode 이벤트 연결 시간 초과')),
          15000
        )
        try {
          const first = await iterator.next()
          if (first.done) throw new Error('OpenCode 이벤트 스트림 연결 실패')
        } finally {
          clearTimeout(readyTimer)
        }
        // SessionRuntime already admitted this input before consuming eventBatches.
        // Rechecking the queue here would reject its now-submitted reservation.
        const promptId = `msg_${randomUUID().replaceAll('-', '')}`
        const promptText = [...(req.preludes ?? []).map((part) => part.text), req.text].join('\n\n')
        const system = [
          req.extensions.systemPromptAppend,
          req.extraDirs?.length
            ? `Additional context directories selected for this session (JSON): ${JSON.stringify(req.extraDirs)}`
            : undefined
        ]
          .filter(Boolean)
          .join('\n\n')
        try {
          await client.session.promptAsync(
            {
              sessionID: sessionId,
              directory: req.cwd,
              messageID: promptId,
              ...(req.model ? { model: modelRef(req.model) } : {}),
              ...(req.harnessAgent ? { agent: req.harnessAgent } : {}),
              ...(req.modelVariant ? { variant: req.modelVariant } : {}),
              ...(system ? { system } : {}),
              parts: [
                { type: 'text', text: promptText },
                ...(req.attachmentTexts ?? []).map((a) => ({
                  type: 'file' as const,
                  mime: a.mimeType,
                  filename: a.name,
                  url: pathToFileURL(a.path).href
                })),
                ...(req.attachmentImages ?? []).map((a) => ({
                  type: 'file' as const,
                  mime: a.mimeType,
                  filename: a.name,
                  url: `data:${a.mimeType};base64,${a.data}`
                }))
              ]
            },
            { signal, throwOnError: true }
          )
        } catch (error) {
          req.rollbackInitialSubmission?.()
          throw error
        }
        for (const prelude of req.preludes ?? [])
          yield emit([{ type: 'input.echo', sessionId, text: prelude.text, uuid: prelude.uuid }])
        yield emit([
          {
            type: 'input.echo',
            sessionId,
            text: req.text,
            ...(req.promptUuid ? { uuid: req.promptUuid } : {})
          }
        ])
        const activity = new OpenCodeActivityMapper(sessionId, promptId)
        const mapper = activity.root
        const approvals = new Set<Promise<void>>()
        const requestedApprovals = new Set<string>()
        let approvalError: unknown
        for await (const event of { [Symbol.asyncIterator]: () => iterator! }) {
          signal.throwIfAborted()
          if (approvalError) throw approvalError
          if (
            'sessionID' in event.properties &&
            typeof event.properties.sessionID === 'string' &&
            activity.ownsSession(event.properties.sessionID) &&
            (event.type === 'permission.asked' || event.type === 'question.asked') &&
            !requestedApprovals.has(event.properties.id)
          ) {
            requestedApprovals.add(event.properties.id)
            const pending = replyToApproval(client, event, req, signal)
              .catch((error) => {
                approvalError = error
                controller.abort(error)
              })
              .finally(() => approvals.delete(pending))
            approvals.add(pending)
          }
          const mapped = activity.map(event)
          if (mapped.events.length || mapped.providerEvents.length)
            yield { ...emit(mapped.events), providerEvents: mapped.providerEvents }
          if (mapper.terminal) {
            finished = true
            return
          }
          const idle =
            event.type === 'session.idle' ||
            (event.type === 'session.status' && event.properties.status.type === 'idle')
          if (
            idle &&
            'sessionID' in event.properties &&
            event.properties.sessionID === sessionId &&
            mapper.sawAssistant
          ) {
            await Promise.all(approvals)
            if (approvalError) throw approvalError
            finished = true
            yield emit(activity.finish())
            return
          }
        }
        throw new Error('OpenCode 이벤트 연결이 응답 완료 전에 끊겼습니다.')
      } catch (error) {
        if (signal.aborted && (req.signal?.aborted || signal.reason?.name === 'AbortError')) {
          yield emit([
            { type: 'turn.aborted', ...(sessionId ? { sessionId } : {}), reason: 'user_cancelled' }
          ])
        } else {
          yield emit([
            {
              type: 'error',
              ...(sessionId ? { sessionId } : {}),
              error: classify(error)
            }
          ])
        }
      } finally {
        if (!finished) await abort().catch(() => undefined)
        signal.removeEventListener('abort', onAbort)
        controller.abort()
        await iterator?.return(undefined).catch(() => undefined)
      }
    }
    return {
      eventBatches: batches(),
      close: () => {
        controller.abort()
      },
      interrupt: async () => {
        await abort()
        controller.abort()
        return { stillQueued: [] }
      },
      setPermissionMode: async () => {
        throw new Error('OpenCode 권한은 도구 요청마다 승인합니다.')
      },
      setModel: async () => undefined,
      stopTask: async () => {
        throw new Error('OpenCode 개별 하위 작업 중단은 지원하지 않습니다.')
      },
      backgroundTask: async () => false
    }
  }

  classifyError(error: unknown): ClassifiedError {
    return classifyOpenCodeError(error, 'provider_connection_error')
  }
}

function modelRef(model: string): { providerID: string; modelID: string } {
  const slash = model.indexOf('/')
  if (slash < 1 || slash === model.length - 1)
    throw new Error('OpenCode 모델은 provider/model 형식이어야 합니다.')
  return { providerID: model.slice(0, slash), modelID: model.slice(slash + 1) }
}

async function replyToApproval(
  client: OpencodeClient,
  event: Extract<Event, { type: 'permission.asked' | 'question.asked' }>,
  req: TurnRequest,
  signal: AbortSignal
): Promise<void> {
  const p = event.properties
  const action: PermissionAction =
    event.type === 'permission.asked'
      ? {
          kind: 'tool_approval',
          toolName: normalizeOpenCodeTool(event.properties.permission, {}).name,
          input: { patterns: event.properties.patterns, ...event.properties.metadata }
        }
      : {
          kind: 'ask_question',
          request: {
            requestId: p.id,
            questions: event.properties.questions.map((question) => ({
              header: question.header,
              question: question.question,
              multiSelect: question.multiple ?? false,
              options: question.options.map((option) => ({
                label: option.label,
                description: option.description
              }))
            }))
          }
        }
  const resolution = (await req.requestApproval?.(action, signal)) ?? { behavior: 'deny' as const }
  signal.throwIfAborted()
  if (event.type === 'permission.asked') {
    await client.permission.reply(
      {
        requestID: p.id,
        directory: req.cwd,
        reply:
          resolution.behavior === 'allow'
            ? resolution.updatedPermissions?.length
              ? 'always'
              : 'once'
            : 'reject'
      },
      { signal, throwOnError: true }
    )
  } else if (resolution.behavior === 'deny') {
    await client.question.reject(
      { requestID: p.id, directory: req.cwd },
      { signal, throwOnError: true }
    )
  } else {
    const input = isRecord(resolution.updatedInput) ? resolution.updatedInput : {}
    const answers = isRecord(input.answers) ? input.answers : {}
    await client.question.reply(
      {
        requestID: p.id,
        directory: req.cwd,
        answers: event.properties.questions.map((question) => {
          const answer = answers[question.question]
          return Array.isArray(answer)
            ? answer.filter((x): x is string => typeof x === 'string')
            : typeof answer === 'string'
              ? [answer]
              : []
        })
      },
      { signal, throwOnError: true }
    )
  }
}
