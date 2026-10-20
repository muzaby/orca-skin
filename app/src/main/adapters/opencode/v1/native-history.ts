import { createHash } from 'node:crypto'
import type {
  Part,
  Session,
  SessionMessagesResponses,
  OpencodeClient
} from '@opencode-ai/sdk/v2/client'
import type { AppMessagePart, NormalizedEvent } from '../../../../shared/ipc'
import type {
  NativeHistoryMessage,
  NativeHistoryRequest,
  NativeHistoryResult
} from '../../common/native-history'
import { withReceivedInputFormat } from '../../../../shared/received-input'
import { sameNativePath } from './native-storage'
import { OpenCodeEventMapper } from './map'

export type NativeMessages = SessionMessagesResponses[200]
export function nativeRevision(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

/** Native status is process-local; closed message evidence also detects another CLI's work. */
export function nativeHistoryBusy(messages: NativeMessages): boolean {
  const lastUserIndex = messages.findLastIndex((value) => value.info.role === 'user')
  const current = lastUserIndex < 0 ? messages : messages.slice(lastUserIndex)
  if (
    current.some(
      ({ info, parts }) =>
        (info.role === 'assistant' && !info.error && (!info.time.completed || !info.finish)) ||
        parts.some(
          (part) =>
            part.type === 'tool' &&
            (part.state.status === 'pending' || part.state.status === 'running')
        )
    )
  )
    return true
  const lastUser = messages.findLast((value) => value.info.role === 'user')
  if (!lastUser) return false
  const lastAnswer = messages.findLast(
    (value) => value.info.role === 'assistant' && value.info.parentID === lastUser.info.id
  )
  return (
    !lastAnswer ||
    (lastAnswer.info.role === 'assistant' &&
      !lastAnswer.info.error &&
      (!lastAnswer.info.time.completed ||
        !lastAnswer.info.finish ||
        lastAnswer.info.finish === 'tool-calls'))
  )
}

function projectedPart(event: NormalizedEvent): AppMessagePart | undefined {
  switch (event.type) {
    case 'message.completed':
      return { type: 'text', text: event.message.text }
    case 'message.reasoning':
      return { type: 'reasoning', text: event.text }
    case 'tool.call.started':
      return {
        type: 'tool_call',
        toolRunId: event.toolRunId,
        toolName: event.toolName,
        args: event.args,
        ...(event.providerTool ? { providerTool: event.providerTool } : {})
      }
    case 'tool.call.completed':
      return {
        type: 'tool_result',
        toolRunId: event.toolRunId,
        result: event.result,
        isError: event.isError ?? false,
        ...(event.durationMs !== undefined ? { durationMs: event.durationMs } : {}),
        ...(event.structuredOutput !== undefined
          ? { structuredOutput: event.structuredOutput }
          : {})
      }
    case 'error':
      return { type: 'error', error: event.error }
    default:
      return undefined
  }
}

function userParts(parts: Part[]): AppMessagePart[] {
  return parts.flatMap((part): AppMessagePart[] => {
    if (part.type === 'text' && !part.ignored)
      return [
        {
          type: 'text',
          text: part.text,
          ...(part.synthetic
            ? { origin: withReceivedInputFormat(part.text, { kind: 'automatic' }) }
            : {})
        }
      ]
    if (part.type === 'file') return [{ type: 'file', path: part.url }]
    if (part.type === 'compaction')
      return [{ type: 'compact_boundary', trigger: part.auto ? 'auto' : 'manual' }]
    return []
  })
}

/** Uses the live v1 tool normalization; no history event is emitted to runtime/usage. */
export function projectNativeMessages(
  sessionId: string,
  messages: NativeMessages
): NativeHistoryMessage[] {
  const result: NativeHistoryMessage[] = []
  let parent: string | undefined
  for (const { info, parts } of messages) {
    if (info.role === 'user') {
      result.push({
        id: info.id,
        role: 'user',
        parts: userParts(parts),
        createdAt: info.time.created
      })
      parent = undefined
      continue
    }
    const mapper = new OpenCodeEventMapper(sessionId)
    // The live stream delivered existing parts before this terminal error. Reproduce that order.
    const events = mapper.map({
      id: info.id,
      type: 'message.updated',
      properties: { sessionID: sessionId, info: { ...info, error: undefined } }
    })
    for (const part of parts)
      events.push(
        ...mapper.map({
          id: part.id,
          type: 'message.part.updated',
          properties: { sessionID: sessionId, part, time: info.time.created }
        })
      )
    events.push(...mapper.finish())
    if (info.error) {
      const errorMapper = new OpenCodeEventMapper(sessionId)
      events.push(
        ...errorMapper.map({
          id: info.id,
          type: 'message.updated',
          properties: { sessionID: sessionId, info }
        })
      )
    }
    const rendered = events.map(projectedPart).filter((part): part is AppMessagePart => !!part)
    // Preserve native compaction and file parts that do not produce a live text/tool event.
    for (const part of parts) {
      if (part.type === 'compaction')
        rendered.push({ type: 'compact_boundary', trigger: part.auto ? 'auto' : 'manual' })
      if (part.type === 'file') rendered.push({ type: 'file', path: part.url })
    }
    const previous = result.at(-1)
    if (previous?.role === 'assistant' && parent === info.parentID) {
      previous.parts.push(...rendered)
      ;(previous.sourceIds ??= [previous.id]).push(info.id)
    } else {
      result.push({ id: info.id, role: 'assistant', parts: rendered, createdAt: info.time.created })
    }
    parent = info.parentID
  }
  return result
}

export interface NativeReadDependencies {
  client(request: NativeHistoryRequest): Promise<OpencodeClient>
  probe?(): Promise<Record<string, unknown> | undefined>
  sourceKey(request: NativeHistoryRequest): Promise<string>
  migrate?(
    request: NativeHistoryRequest
  ): Promise<{ status: 'migrated' } | Exclude<NativeHistoryResult, { status: 'ready' }>>
}

const unavailable = (): NativeHistoryResult => ({
  status: 'unavailable',
  message: 'OpenCode 원본 대화를 읽지 못했습니다. 저장 경로와 서버 연결을 확인해 주세요.'
})
export async function readOpenCodeHistory(
  request: NativeHistoryRequest,
  deps: NativeReadDependencies
): Promise<NativeHistoryResult> {
  try {
    const client = await deps.client(request)
    const query = { sessionID: request.sessionId, directory: request.cwd }
    let session = await client.session.get(query, { throwOnError: false })
    if (session.response.status === 404) {
      const migrated = await deps.migrate?.(request)
      if (!migrated) return { status: 'missing', message: 'OpenCode 원본 세션을 찾을 수 없습니다.' }
      // Here 404 proved the target absent. Legacy busy does not prove native existence.
      if (migrated.status === 'busy')
        return { status: 'migration-required', message: migrated.message }
      if (migrated.status !== 'migrated') return migrated
      session = await client.session.get(query, { throwOnError: false })
    }
    if (!session.response.ok || !session.data) return unavailable()
    if (
      session.data.id !== request.sessionId ||
      !sameNativePath(session.data.directory, request.cwd)
    )
      return {
        status: 'migration-required',
        message: 'OpenCode 원본 세션의 작업 폴더가 다릅니다. 원래 작업 폴더에서 다시 열어 주세요.'
      }
    const sourceKey = await deps.sourceKey(request)
    const checkpoint = await deps.probe?.()
    const previous = request.previous
    const reusable =
      previous?.cursor?.version === 1 &&
      previous.cursor.sourceKey === sourceKey &&
      previous.snapshot.sourceKey === sourceKey &&
      previous.cursor.revision === previous.snapshot.revision
    if (
      checkpoint &&
      reusable &&
      nativeRevision(checkpoint) === nativeRevision(previous.cursor?.checkpoint)
    )
      return { status: 'unchanged' }
    const read = async (): Promise<{ session: Session; messages: NativeMessages } | undefined> => {
      const [header, body] = await Promise.all([
        client.session.get(query, { throwOnError: false }),
        client.session.messages(query, { throwOnError: false })
      ])
      if (!header.response.ok || !header.data || !body.response.ok || !body.data) return undefined
      return { session: header.data, messages: body.data }
    }
    const first = await read()
    const second = await read()
    if (!first || !second) return unavailable()
    if (
      second.session.id !== request.sessionId ||
      !sameNativePath(second.session.directory, request.cwd)
    )
      return {
        status: 'migration-required',
        message:
          'OpenCode 원본 세션의 작업 폴더가 변경되었습니다. 원래 작업 폴더에서 다시 열어 주세요.'
      }
    const after = await deps.probe?.()
    if (nativeRevision(checkpoint ?? null) !== nativeRevision(after ?? null))
      return {
        status: 'busy',
        message: 'OpenCode 원본 이력이 변경 중이어서 갱신을 보류했습니다.'
      }
    const revision = nativeRevision(second)
    if (nativeRevision(first) !== revision || nativeHistoryBusy(second.messages))
      return {
        status: 'busy',
        message: 'OpenCode 원본 응답이 진행 중이어서 대화 갱신을 잠시 보류했습니다.'
      }
    if (
      reusable &&
      previous.cursor?.revision === revision &&
      nativeRevision(checkpoint ?? { kind: 'opencode-api' }) ===
        nativeRevision(previous.cursor.checkpoint)
    )
      return { status: 'unchanged' }
    return {
      status: 'ready',
      cursor: {
        version: 1,
        sourceKey,
        revision,
        checkpoint: checkpoint ?? { kind: 'opencode-api' }
      },
      snapshot: {
        sessionId: request.sessionId,
        cwd: request.cwd,
        sourceKey,
        revision,
        messages: projectNativeMessages(request.sessionId, second.messages),
        raw: second
      }
    }
  } catch {
    // The error may contain auth headers or provider bodies. Only the safe status crosses this port.
    return unavailable()
  }
}
