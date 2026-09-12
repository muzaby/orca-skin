import { createHash, randomUUID } from 'node:crypto'
import type {
  BackgroundCallPatch,
  BackgroundEvent,
  BackgroundEventSource,
  BackgroundOutputRef,
  BackgroundTaskPatch,
  ProviderMessageEvent
} from '../../shared/background-task'
import { isRecord } from '../../shared/obj'

type RecordValue = Record<string, unknown>
const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)
const finite = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
const bool = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined
const present = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (isRecord(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(',')}}`
  return JSON.stringify(value) ?? 'null'
}

/** One query/process owns the correlation and replay-deduplication boundary. */
export class ClaudeBackgroundMapper {
  readonly generation = randomUUID()
  private sequence = 0
  private seen = new Set<string>()
  private tools = new Map<string, string>()
  private taskTools = new Map<string, string>()

  constructor(private readonly identity: { sdkVersion?: string; cliPath?: string } = {}) {}

  map(
    raw: unknown,
    fallbackSessionId: string
  ):
    | { source: BackgroundEventSource; events: (BackgroundEvent | ProviderMessageEvent)[] }
    | undefined {
    const msg = isRecord(raw) ? raw : {}
    const uuid = text(msg.uuid)
    if (uuid) {
      const key = `${uuid}:${createHash('sha256').update(stable(raw)).digest('hex')}`
      if (this.seen.has(key)) return undefined
      this.seen.add(key)
    }
    const source: BackgroundEventSource = {
      generation: this.generation,
      sequence: this.sequence++,
      receivedAt: Date.now(),
      replay: msg.isReplay === true,
      ...(uuid ? { uuid } : {})
    }
    const sessionId = text(msg.session_id) ?? fallbackSessionId
    const errors: string[] = []
    let events: BackgroundEvent[] = []
    try {
      events = this.interpret(msg, sessionId, source, errors)
    } catch {
      errors.push('message interpretation failed')
    }
    const journal: ProviderMessageEvent = {
      type: 'provider.message',
      sessionId,
      source,
      raw,
      ...(errors.length ? { interpretationErrors: errors } : {})
    }
    return { source, events: [journal, ...events] }
  }

  private outputRef(
    source: BackgroundEventSource,
    owner: string,
    field: string,
    value: unknown,
    canRead?: boolean,
    kind: BackgroundOutputRef['kind'] = 'file'
  ): BackgroundOutputRef | undefined {
    if (typeof value !== 'string' || value.length === 0) return undefined
    const actualKind = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? 'uri' : kind
    return present({
      id: JSON.stringify([source.generation, owner, field, value]),
      field,
      value,
      kind: actualKind,
      canRead
    })
  }

  private refs(
    source: BackgroundEventSource,
    owner: string,
    output: RecordValue,
    fields: string[],
    canRead?: boolean
  ): BackgroundOutputRef[] {
    const refs: BackgroundOutputRef[] = []
    for (const field of fields) {
      const ref = this.outputRef(
        source,
        owner,
        field,
        output[field],
        canRead,
        field === 'transcriptDir' ? 'directory' : 'file'
      )
      if (ref) refs.push(ref)
    }
    for (const field of ['resourceLinks', 'resource_links']) {
      if (!Array.isArray(output[field])) continue
      for (const link of output[field]) {
        if (!isRecord(link)) continue
        const ref = this.outputRef(source, owner, field, link.uri, canRead, 'uri')
        if (ref && !refs.some((prev) => prev.id === ref.id)) refs.push(ref)
      }
    }
    return refs
  }

  private interpret(
    msg: RecordValue,
    sessionId: string,
    source: BackgroundEventSource,
    errors: string[]
  ): BackgroundEvent[] {
    const common = { sessionId, source }
    if (msg.type === 'system') {
      if (msg.subtype === 'init')
        return [
          {
            type: 'background.connection',
            ...common,
            state: 'connected',
            ...this.identity,
            ...(text(msg.claude_code_version) !== undefined
              ? { cliVersion: text(msg.claude_code_version) }
              : {})
          }
        ]
      if (msg.subtype === 'worker_shutting_down')
        return [
          {
            type: 'background.connection',
            ...common,
            state: 'disconnected',
            ...(text(msg.reason) !== undefined ? { reason: text(msg.reason) } : {})
          }
        ]
      if (msg.subtype === 'background_tasks_changed') {
        if (!Array.isArray(msg.tasks)) {
          errors.push('tasks must be an array')
          return []
        }
        const tasks = msg.tasks.flatMap((entry) => {
          if (!isRecord(entry) || typeof entry.task_id !== 'string') {
            errors.push('tasks[].task_id must be a string')
            return []
          }
          return [
            present({
              taskId: entry.task_id,
              taskType: text(entry.task_type),
              description: text(entry.description),
              ambient: bool(entry.ambient)
            })
          ]
        })
        // A malformed member makes membership incomplete; do not emit a false full replacement.
        if (errors.length) return []
        return [{ type: 'background.snapshot', ...common, tasks }]
      }
      const phases = {
        task_started: 'started',
        task_progress: 'progress',
        task_updated: 'updated',
        task_notification: 'notification'
      } as const
      const phase = phases[msg.subtype as keyof typeof phases]
      if (phase) {
        if (typeof msg.task_id !== 'string') {
          errors.push('task_id must be a string')
          return []
        }
        const value = phase === 'updated' ? msg.patch : msg
        if (!isRecord(value)) {
          errors.push('patch must be an object')
          return []
        }
        const id = text(msg.tool_use_id)
        if (id) this.taskTools.set(msg.task_id, id)
        const toolUseId = id ?? this.taskTools.get(msg.task_id)
        const usage = isRecord(value.usage) ? value.usage : {}
        const patch: BackgroundTaskPatch = present({
          taskType: text(value.task_type),
          description: text(value.description),
          status: text(value.status) ?? (phase === 'started' ? 'running' : undefined),
          isBackgrounded: bool(value.is_backgrounded),
          ambient: bool(value.ambient) ?? (value.skip_transcript === true ? true : undefined),
          spawnDepth: finite(value.spawn_depth),
          subagentType: text(value.subagent_type),
          endTime: finite(value.end_time),
          totalPausedMs: finite(value.total_paused_ms),
          error: text(value.error),
          summary: text(value.summary),
          lastToolName: text(value.last_tool_name),
          totalTokens: finite(usage.total_tokens),
          toolUses: finite(usage.tool_uses),
          durationMs: finite(usage.duration_ms),
          usage: value.usage,
          outputFile: text(value.output_file),
          resourceLinks: value.resource_links,
          parentToolUseId: text(value.parent_tool_use_id),
          parentAgentId: text(value.parent_agent_id)
        })
        for (const [key, item] of Object.entries(value)) {
          if (
            ['status', 'description', 'error', 'summary'].includes(key) &&
            typeof item !== 'string'
          )
            errors.push(`${key} must be a string`)
          if (['is_backgrounded', 'ambient'].includes(key) && typeof item !== 'boolean')
            errors.push(`${key} must be a boolean`)
        }
        const outputRefs = this.refs(source, msg.task_id, value, ['output_file'])
        if (outputRefs.length) patch.outputRefs = outputRefs
        return [
          {
            type: 'background.task',
            ...common,
            taskId: msg.task_id,
            ...(toolUseId ? { toolUseId } : {}),
            phase,
            patch
          }
        ]
      }
    }
    if (msg.type === 'tool_progress') {
      const toolUseId = text(msg.tool_use_id)
      if (!toolUseId) {
        errors.push('tool_use_id must be a string')
        return []
      }
      const patch: BackgroundCallPatch = present({
        taskId: text(msg.task_id),
        heartbeat: bool(msg.heartbeat),
        elapsedTimeSeconds: finite(msg.elapsed_time_seconds),
        ...(msg.subagent_retry !== undefined
          ? { retry: msg.subagent_retry }
          : msg.heartbeat === true
            ? {}
            : { retry: null })
      })
      return [
        {
          type: 'background.call',
          ...common,
          toolUseId,
          ...present({
            toolName: text(msg.tool_name),
            parentToolUseId: text(msg.parent_tool_use_id)
          }),
          phase: 'progress',
          patch
        }
      ]
    }
    if (msg.type !== 'assistant' && msg.type !== 'user') return []
    const message = isRecord(msg.message) ? msg.message : {}
    if (!Array.isArray(message.content)) {
      if (typeof message.content !== 'string')
        errors.push('message.content must be a string or array')
      return []
    }
    const parentToolUseId = text(msg.parent_tool_use_id)
    const resultCount = message.content.filter(
      (p) => isRecord(p) && p.type === 'tool_result'
    ).length
    const out: BackgroundEvent[] = []
    for (const part of message.content) {
      if (!isRecord(part)) {
        errors.push('message.content[] must be an object')
        continue
      }
      if (
        part.type === 'tool_use' &&
        typeof part.id === 'string' &&
        typeof part.name === 'string'
      ) {
        this.tools.set(part.id, part.name)
        out.push({
          type: 'background.call',
          ...common,
          toolUseId: part.id,
          toolName: part.name,
          ...(parentToolUseId ? { parentToolUseId } : {}),
          phase: 'started',
          input: part.input
        })
      } else if (part.type === 'tool_result' && typeof part.tool_use_id === 'string') {
        const toolUseId = part.tool_use_id
        const toolName = this.tools.get(toolUseId)
        const structuredOutput = resultCount === 1 ? msg.tool_use_result : undefined
        const patch = this.callPatch(
          source,
          toolUseId,
          toolName,
          structuredOutput,
          part.is_error === true
        )
        out.push({
          type: 'background.call',
          ...common,
          toolUseId,
          ...(toolName ? { toolName } : {}),
          ...(parentToolUseId ? { parentToolUseId } : {}),
          phase: 'returned',
          result: part.content,
          ...(structuredOutput !== undefined ? { structuredOutput } : {}),
          ...(resultCount === 1 && msg.tool_result_meta !== undefined
            ? { meta: msg.tool_result_meta }
            : {}),
          patch
        })
      }
    }
    return out
  }

  private callPatch(
    source: BackgroundEventSource,
    owner: string,
    toolName: string | undefined,
    output: unknown,
    isError: boolean
  ): BackgroundCallPatch {
    const value = isRecord(output) ? output : {}
    const patch: BackgroundCallPatch = { ...(isError ? { status: 'failed' } : {}) }
    let fields: string[] = []
    if (toolName === 'Agent' || toolName === 'Task') {
      Object.assign(
        patch,
        present({
          agentId: text(value.agentId),
          status: text(value.status),
          mode:
            value.status === 'async_launched'
              ? 'background'
              : value.status === 'remote_launched'
                ? 'remote'
                : value.status === 'completed'
                  ? 'foreground'
                  : undefined,
          taskId: value.status === 'remote_launched' ? text(value.taskId) : undefined,
          canReadOutputFile: bool(value.canReadOutputFile),
          outputFile: text(value.outputFile),
          usage: value.usage
        })
      )
      fields = ['outputFile']
    } else if (toolName === 'Bash') {
      Object.assign(
        patch,
        present({
          taskId: text(value.backgroundTaskId),
          mode: typeof value.backgroundTaskId === 'string' ? 'background' : undefined,
          status:
            value.interrupted === true
              ? 'stopped'
              : isError
                ? 'failed'
                : typeof value.backgroundTaskId === 'string'
                  ? undefined
                  : 'completed'
        })
      )
      fields = ['rawOutputPath', 'persistedOutputPath']
    } else if (toolName === 'Monitor') {
      Object.assign(
        patch,
        present({
          taskId: text(value.taskId),
          mode: typeof value.taskId === 'string' ? 'background' : undefined
        })
      )
    } else if (toolName === 'Workflow') {
      Object.assign(
        patch,
        present({
          taskId: text(value.taskId),
          runId: text(value.runId),
          status: typeof value.error === 'string' ? 'failed' : text(value.status),
          mode:
            typeof value.error === 'string'
              ? undefined
              : value.status === 'remote_launched'
                ? 'remote'
                : value.status === 'async_launched'
                  ? 'background'
                  : undefined,
          summary: text(value.summary)
        })
      )
      fields = ['transcriptDir']
    } else if (toolName === 'Skill' && value.background === true) patch.mode = 'background'
    const refs = this.refs(source, owner, value, fields, patch.canReadOutputFile)
    if (refs.length) patch.outputRefs = refs
    return patch
  }
}
