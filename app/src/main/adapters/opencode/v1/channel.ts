import {
  openCodeNativeCommands,
  openCodeNativeResources,
  openCodeNativePluginDirectory
} from './native-resources'
import type { Event, OpencodeClient } from '@opencode-ai/sdk/v2/client'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import type { LiveTurn, ProviderMessageBatch } from '../../common/types'
import type { TurnContinuation, TurnRequest } from '../../common/turn'
import type { NormalizedEvent } from '../../../../shared/ipc'
import { OpenCodeActivityMapper } from './activity'
import { createOpenCodeMessageId } from './message-id'
import { classifyOpenCodeError } from './errors'
import { replyToApproval } from './approval'
import { recoveredPrompt } from '../../common/recovery'
import { modelRef } from './model-ref'
import { reportError } from '../../../infra/error-report'
import { openCodeComposerCatalog } from './composer-catalog'
import type { NativeComposerCatalog } from '../../../../shared/native-resources'

/** One SDK subscription feeds the existing SessionRuntime pump for its entire lifetime. */
export function openCodeChannel(
  req: TurnRequest,
  connect: () => Promise<OpencodeClient>,
  release: () => void = () => undefined
): LiveTurn {
  const generation = randomUUID()
  const controller = new AbortController()
  const signal = req.signal ? AbortSignal.any([req.signal, controller.signal]) : controller.signal
  let mainApproval = new AbortController()
  let client: OpencodeClient | undefined
  let composerCatalog: NativeComposerCatalog | undefined
  let composerFlight: Promise<NativeComposerCatalog | undefined> | undefined
  const refreshComposer = (): Promise<NativeComposerCatalog | undefined> => {
    if (composerFlight) return composerFlight
    if (!client || closed) return Promise.resolve(undefined)
    const flight = openCodeComposerCatalog(client, req.cwd)
      .then((catalog) => {
        if (!closed) composerCatalog = catalog
        return catalog
      })
      .catch(() => undefined)
      .finally(() => {
        if (composerFlight === flight) composerFlight = undefined
      })
    composerFlight = flight
    return flight
  }
  let sessionId = req.sessionId
  let activity: OpenCodeActivityMapper | undefined
  let iterator: AsyncGenerator<Event> | undefined
  let closed = false
  let ended = false
  let interrupted = false
  let responseOpen = false
  let submissionEpoch = 0
  let sequence = 0
  let cleanup: Promise<void> | undefined
  const queue: ProviderMessageBatch[] = []
  let submitting: ProviderMessageBatch[] | undefined
  let wake: (() => void) | undefined
  const publish = (
    events: NormalizedEvent[],
    providerEvents?: ProviderMessageBatch['providerEvents']
  ): void => {
    if (closed) return
    const batch = {
      sequence: ++sequence,
      events,
      ...(providerEvents?.length ? { providerEvents } : {})
    }
    if (submitting) {
      submitting.push(batch)
      return
    }
    queue.push(batch)
    wake?.()
    wake = undefined
  }
  const abortSession = async (id: string): Promise<void> => {
    await client?.session.abort(
      { sessionID: id, directory: req.cwd },
      {
        signal: AbortSignal.timeout(5000),
        throwOnError: true
      }
    )
  }
  const cleanupOwned = (): Promise<void> => {
    cleanup ??= (async () => {
      const ids = (activity?.ownedSessions() ?? (sessionId ? [sessionId] : [])).filter(
        (id) => id !== sessionId || responseOpen
      )
      // Retirement invalidates callbacks immediately; a failed abort must not claim task success.
      const results = await Promise.allSettled(ids.map(abortSession))
      if (results.some((result) => result.status === 'rejected'))
        reportError({
          event: 'opencode.channel.abort.failed',
          scope: 'engine',
          title: 'engineInternal',
          level: 'error',
          error: undefined,
          detail: null,
          data: {
            provider: 'opencode',
            failedCount: results.filter((result) => result.status === 'rejected').length
          }
        })
    })()
    return cleanup
  }
  const close = (): void => {
    if (closed) return
    closed = true
    mainApproval.abort()
    controller.abort()
    void cleanupOwned()
    ended = true
    wake?.()
    wake = undefined
  }
  const submit = async (next: TurnContinuation, initial = false): Promise<void> => {
    signal.throwIfAborted()
    if (!client || !sessionId || !activity)
      throw new Error('OpenCode 이벤트 채널이 준비되지 않았습니다.')
    // Catalog membership is authoritative only after a successful live read.
    const agent =
      composerCatalog &&
      next.harnessAgent &&
      !composerCatalog.agents.some((item) => item.name === next.harnessAgent)
        ? undefined
        : next.harnessAgent
    const variant =
      composerCatalog &&
      next.modelVariant &&
      !composerCatalog.models
        .find((item) => item.id === next.model)
        ?.variants.includes(next.modelVariant)
        ? undefined
        : next.modelVariant
    const messageID = createOpenCodeMessageId()
    const submission = ++submissionEpoch
    if (initial) req.recovery?.onPrompt(messageID)
    activity.acceptPrompt(messageID)
    interrupted = false
    responseOpen = true
    mainApproval = new AbortController()
    const system = [
      req.extensions.systemPromptAppend,
      req.extraDirs?.length
        ? `Additional context directories selected for this session (JSON): ${JSON.stringify(req.extraDirs)}`
        : undefined
    ]
      .filter(Boolean)
      .join('\n\n')
    const pending: ProviderMessageBatch[] = []
    submitting = pending
    try {
      const slash = /^\s*\/([^\s]+)(?:\s+([\s\S]*))?$/.exec(next.text)
      const command = slash
        ? (await openCodeNativeCommands(client, req.cwd)).find((item) => item.name === slash[1])
        : undefined
      const files = [
        ...(next.attachmentTexts ?? []).map((part) => ({
          type: 'file' as const,
          mime: part.mimeType,
          filename: part.name,
          url: pathToFileURL(part.path).href
        })),
        ...(next.attachmentImages ?? []).map((part) => ({
          type: 'file' as const,
          mime: part.mimeType,
          filename: part.name,
          url: `data:${part.mimeType};base64,${part.data}`
        }))
      ]
      if (command) {
        const context = [
          system,
          ...(initial ? (req.preludes ?? []) : []).map((part) => part.text),
          initial && req.recovery ? recoveredPrompt(req.recovery.history, '') : ''
        ]
          .filter(Boolean)
          .join('\n\n')
        if (context)
          await client.session.prompt(
            {
              sessionID: sessionId,
              directory: req.cwd,
              noReply: true,
              parts: [{ type: 'text', text: context, synthetic: true }]
            },
            { signal, throwOnError: true }
          )
        // command waits for the full model response. Keep the event pump free to process approvals.
        void client.session
          .command(
            {
              sessionID: sessionId,
              directory: req.cwd,
              messageID,
              command: command.name,
              arguments: slash?.[2] ?? '',
              model: next.model,
              agent,
              variant,
              parts: files
            },
            { signal, throwOnError: true }
          )
          .catch((error: unknown) => {
            if (!closed && !signal.aborted && submission === submissionEpoch)
              controller.abort(error)
          })
      } else
        await client.session.promptAsync(
          {
            sessionID: sessionId,
            directory: req.cwd,
            messageID,
            ...(next.model ? { model: modelRef(next.model) } : {}),
            ...(agent ? { agent } : {}),
            ...(variant ? { variant } : {}),
            ...(system ? { system } : {}),
            parts: [
              {
                type: 'text',
                text: [
                  ...(initial ? (req.preludes ?? []) : []).map((part) => part.text),
                  recoveredPrompt(initial ? req.recovery?.history : undefined, next.text)
                ].join('\n\n')
              },
              ...files
            ]
          },
          { signal, throwOnError: true }
        )
    } finally {
      submitting = undefined
    }
    if (closed) return
    for (const prelude of initial ? (req.preludes ?? []) : [])
      publish([
        {
          type: 'input.echo',
          sessionId,
          text: prelude.text,
          uuid: prelude.uuid,
          nativeMessageId: messageID
        }
      ])
    publish([
      {
        type: 'input.echo',
        sessionId,
        text: next.text,
        nativeMessageId: messageID,
        ...(next.promptUuid ? { uuid: next.promptUuid } : {})
      }
    ])
    for (const batch of pending) publish(batch.events, batch.providerEvents)
  }
  const run = async (): Promise<void> => {
    const requested = new Set<string>()
    try {
      signal.throwIfAborted()
      if (req.forkFrom) throw new Error('OpenCode 세션 분기는 지원하지 않습니다.')
      client = await connect()
      signal.throwIfAborted()
      const catalog = refreshComposer()
      if (!sessionId)
        sessionId =
          (
            await client.session.create(
              {
                directory: req.cwd,
                permission: [{ permission: '*', pattern: '*', action: 'ask' }]
              },
              { signal, throwOnError: true }
            )
          ).data?.id ?? null
      if (!sessionId) throw new Error('OpenCode 세션 생성 실패')
      publish([
        {
          type: 'session.updated',
          sessionId,
          patch: { backend: 'opencode', cwd: req.cwd, ...(req.model ? { model: req.model } : {}) }
        }
      ])
      iterator = (
        await client.event.subscribe({ directory: req.cwd }, { signal, sseMaxRetryAttempts: 0 })
      ).stream
      const timer = setTimeout(
        () => controller.abort(new Error('OpenCode 이벤트 연결 시간 초과')),
        15000
      )
      try {
        if ((await iterator.next()).done) throw new Error('OpenCode 이벤트 스트림 연결 실패')
      } finally {
        clearTimeout(timer)
      }
      activity = new OpenCodeActivityMapper(
        sessionId,
        createOpenCodeMessageId(),
        generation,
        req.providerSettings?.settings
      )
      // Defaults require no catalog validation. Do not hold up the first prompt for menu metadata.
      if (req.harnessAgent || req.modelVariant) await catalog
      try {
        await submit(req, true)
      } catch (error) {
        req.rollbackInitialSubmission?.()
        throw error
      }
      for await (const event of { [Symbol.asyncIterator]: () => iterator! }) {
        signal.throwIfAborted()
        if (closed) return
        if (
          (event.type === 'permission.asked' || event.type === 'question.asked') &&
          activity.ownsSession(event.properties.sessionID) &&
          !requested.has(event.properties.id)
        ) {
          requested.add(event.properties.id)
          const isRoot = event.properties.sessionID === sessionId
          const mainSignal = isRoot ? req.getMainApprovalSignal?.() : undefined
          const approvalSignal = isRoot
            ? AbortSignal.any([signal, mainApproval.signal, ...(mainSignal ? [mainSignal] : [])])
            : signal
          void replyToApproval(client, event, req, approvalSignal).catch((error: unknown) => {
            if (!approvalSignal.aborted) controller.abort(error)
          })
        }
        const mapped = activity.map(event)
        if (mapped.events.some((value) => value.type === 'input.received')) {
          responseOpen = true
          if (mainApproval.signal.aborted) mainApproval = new AbortController()
        }
        if (mapped.events.length || mapped.providerEvents.length)
          publish(mapped.events, mapped.providerEvents)
        if (activity.root.terminal && mapped.events.some((value) => value.type === 'error')) return
        const idle =
          event.type === 'session.idle' ||
          (event.type === 'session.status' && event.properties.status.type === 'idle')
        if (
          idle &&
          'sessionID' in event.properties &&
          event.properties.sessionID === sessionId &&
          responseOpen &&
          (activity.root.sawAssistant || interrupted)
        ) {
          responseOpen = false
          const events = activity.finish()
          publish(
            interrupted ? [{ type: 'turn.aborted', sessionId, reason: 'user_cancelled' }] : events
          )
          interrupted = false
        }
      }
      throw new Error('OpenCode 이벤트 연결이 끊겼습니다.')
    } catch (error) {
      if (!closed)
        publish(
          signal.aborted && (req.signal?.aborted || signal.reason?.name === 'AbortError')
            ? [
                {
                  type: 'turn.aborted',
                  ...(sessionId ? { sessionId } : {}),
                  reason: 'user_cancelled'
                }
              ]
            : [
                {
                  type: 'error',
                  ...(sessionId ? { sessionId } : {}),
                  error: classifyOpenCodeError(error, 'provider_connection_error')
                }
              ]
        )
    } finally {
      mainApproval.abort()
      controller.abort()
      await cleanupOwned()
      await iterator?.return(undefined).catch(() => undefined)
      release()
      ended = true
      wake?.()
      wake = undefined
    }
  }
  async function* batches(): AsyncGenerator<ProviderMessageBatch> {
    const pumping = run()
    try {
      while (!ended || queue.length) {
        if (queue.length) {
          yield queue.shift()!
          continue
        }
        await new Promise<void>((resolve) => {
          wake = resolve
        })
      }
    } finally {
      close()
      await pumping
    }
  }
  return {
    providerGeneration: generation,
    nativePluginDirectory: async (id) => {
      if (!client || closed || ended) return undefined
      return openCodeNativePluginDirectory(client, req.cwd, id, { ...process.env, ...req.env })
    },
    nativeResources: async () => {
      if (!client || closed || ended) return { state: 'disconnected', items: [] }
      const [items, commands, composer] = await Promise.all([
        openCodeNativeResources(client, req.cwd, { ...process.env, ...req.env }),
        openCodeNativeCommands(client, req.cwd, true, { ...process.env, ...req.env }).catch(
          () => undefined
        ),
        refreshComposer()
      ])
      if (closed || ended) return { state: 'disconnected', items: [] }
      composerCatalog = composer ?? composerCatalog
      return {
        state: 'connected',
        generation,
        items,
        ...(commands !== undefined ? { commands } : {}),
        ...(composerCatalog !== undefined ? { composer: composerCatalog } : {}),
        ...(commands === undefined || composer === undefined ? { partial: true } : {})
      }
    },
    eventBatches: batches(),
    close,
    pushTurn: async (next) => {
      if (closed || ended || signal.aborted)
        return { kind: 'rejectedBeforeAccept', reason: 'stream_closed' }
      try {
        await submit(next)
      } catch (error) {
        // HTTP failure leaves acceptance uncertain. Retire this generation; the
        // runtime may open a new channel only for a later explicit input.
        close()
        throw error
      }
      return { kind: 'accepted' }
    },
    interrupt: async () => {
      if (!sessionId || closed) return { stillQueued: [] }
      interrupted = responseOpen
      submissionEpoch++
      mainApproval.abort()
      await abortSession(sessionId)
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
