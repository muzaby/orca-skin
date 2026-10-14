import type { Event, Part, AssistantMessage } from '@opencode-ai/sdk/v2'
import type { NormalizedEvent, ProviderReportedTelemetry } from '../../../../shared/ipc'
import { classifyOpenCodeError } from './errors'

const TOOL_NAMES: Record<string, string> = {
  read: 'Read',
  write: 'Write',
  edit: 'Edit',
  bash: 'Bash',
  glob: 'Glob',
  grep: 'Grep',
  webfetch: 'WebFetch',
  websearch: 'WebSearch',
  task: 'Task',
  todowrite: 'TodoWrite',
  question: 'AskUserQuestion',
  skill: 'Skill'
}

export function normalizeOpenCodeTool(
  name: string,
  input: Record<string, unknown>
): {
  name: string
  input: Record<string, unknown>
} {
  const mapped = { ...input }
  if ('filePath' in input) mapped.file_path = input.filePath
  if ('oldString' in input) mapped.old_string = input.oldString
  if ('newString' in input) mapped.new_string = input.newString
  if ('replaceAll' in input) mapped.replace_all = input.replaceAll
  if (name === 'task') mapped.subagent_type = input.subagent_type ?? input.agent
  return { name: TOOL_NAMES[name] ?? name, input: mapped }
}

/** Per-turn state. Repeated snapshots cannot duplicate persisted parts or usage. */
export class OpenCodeEventMapper {
  private readonly messages = new Map<string, 'assistant' | 'user'>()
  private readonly texts = new Map<string, { type: 'text' | 'reasoning'; text: string }>()
  private readonly completed = new Set<string>()
  private readonly startedTools = new Set<string>()
  private readonly finishedTools = new Set<string>()
  private readonly usage = new Map<string, AssistantMessage>()
  private readonly seenEvents = new Set<string>()
  private readonly promptMessages = new Set<string>()
  private promptCreatedAt: number | undefined
  terminal = false
  sawAssistant = false

  constructor(
    readonly sessionId: string,
    private readonly promptId?: string
  ) {
    if (promptId) this.promptMessages.add(promptId)
  }

  map(event: Event): NormalizedEvent[] {
    if (this.terminal) return []
    const props = event.properties
    if (!('sessionID' in props) || props.sessionID !== this.sessionId) return []
    if (event.id && this.seenEvents.has(event.id)) return []
    if (event.id) this.seenEvents.add(event.id)
    switch (event.type) {
      case 'message.updated': {
        const message = event.properties.info
        // A resumed session may still emit updates for an earlier turn. Synthetic
        // user messages created by compaction after this prompt remain in scope.
        if (this.promptId) {
          if (message.role === 'user') {
            if (message.id === this.promptId) this.promptCreatedAt = message.time.created
            if (
              this.promptCreatedAt !== undefined &&
              message.time.created >= this.promptCreatedAt
            ) {
              this.promptMessages.add(message.id)
            }
          } else if (!this.promptMessages.has(message.parentID)) return []
        }
        this.messages.set(message.id, message.role)
        if (message.role !== 'assistant') return []
        this.sawAssistant = true
        this.usage.set(message.id, message)
        if (message.error) {
          this.terminal = true
          return [
            {
              type: 'error',
              sessionId: this.sessionId,
              error: classifyOpenCodeError(message.error)
            }
          ]
        }
        return []
      }
      case 'message.part.updated':
        return this.part(event.properties.part)
      case 'message.part.delta': {
        const p = event.properties
        if (
          this.messages.get(p.messageID) !== 'assistant' ||
          p.field !== 'text' ||
          this.completed.has(p.partID)
        )
          return []
        const current = this.texts.get(p.partID)
        if (!current) return []
        current.text += p.delta
        return [
          {
            type: current.type === 'reasoning' ? 'message.reasoning.delta' : 'message.delta',
            sessionId: this.sessionId,
            delta: { text: p.delta }
          }
        ]
      }
      case 'session.error':
        this.terminal = true
        return [
          {
            type: 'error',
            sessionId: this.sessionId,
            error: classifyOpenCodeError(event.properties.error)
          }
        ]
      case 'session.compacted':
        return [{ type: 'session.compacted', sessionId: this.sessionId }]
      default:
        return []
    }
  }

  private part(part: Part): NormalizedEvent[] {
    if (this.messages.get(part.messageID) !== 'assistant') return []
    this.sawAssistant = true
    if (part.type === 'text' || part.type === 'reasoning') {
      if (this.completed.has(part.id)) return []
      const previous = this.texts.get(part.id)?.text ?? ''
      this.texts.set(part.id, { type: part.type, text: part.text })
      const events: NormalizedEvent[] = []
      if (part.text.startsWith(previous) && part.text.length > previous.length) {
        events.push({
          type: part.type === 'text' ? 'message.delta' : 'message.reasoning.delta',
          sessionId: this.sessionId,
          delta: { text: part.text.slice(previous.length) }
        })
      }
      if (part.time?.end !== undefined) events.push(...this.finishText(part.id))
      return events
    }
    if (part.type !== 'tool' || part.state.status === 'pending') return []
    const events: NormalizedEvent[] = []
    if (!this.startedTools.has(part.callID)) {
      this.startedTools.add(part.callID)
      const normalized = normalizeOpenCodeTool(part.tool, part.state.input)
      events.push({
        type: 'tool.call.started',
        sessionId: this.sessionId,
        toolRunId: part.callID,
        toolName: normalized.name,
        args: normalized.input,
        providerTool: { name: part.tool, input: part.state.input }
      })
    }
    if (
      (part.state.status === 'completed' || part.state.status === 'error') &&
      !this.finishedTools.has(part.callID)
    ) {
      this.finishedTools.add(part.callID)
      events.push({
        type: 'tool.call.completed',
        sessionId: this.sessionId,
        toolRunId: part.callID,
        result: part.state.status === 'completed' ? part.state.output : part.state.error,
        isError: part.state.status === 'error',
        durationMs: Math.max(0, part.state.time.end - part.state.time.start),
        ...(part.state.metadata ? { structuredOutput: part.state.metadata } : {})
      })
    }
    return events
  }

  private finishText(id: string): NormalizedEvent[] {
    const part = this.texts.get(id)
    if (!part || this.completed.has(id)) return []
    this.completed.add(id)
    if (!part.text) return []
    return part.type === 'text'
      ? [{ type: 'message.completed', sessionId: this.sessionId, message: { text: part.text } }]
      : [{ type: 'message.reasoning', sessionId: this.sessionId, text: part.text }]
  }

  finish(): NormalizedEvent[] {
    if (this.terminal) return []
    this.terminal = true
    const events = [...this.texts.keys()].flatMap((id) => this.finishText(id))
    const usage: ProviderReportedTelemetry = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      costUsd: 0
    }
    for (const message of this.usage.values()) {
      usage.model = `${message.providerID}/${message.modelID}`
      usage.inputTokens! += message.tokens.input
      usage.outputTokens! += message.tokens.output
      usage.cacheReadTokens! += message.tokens.cache.read
      usage.cacheCreationTokens! += message.tokens.cache.write
      usage.costUsd! += message.cost
    }
    return [
      ...events,
      { type: 'telemetry', sessionId: this.sessionId, usage },
      { type: 'turn.ended', sessionId: this.sessionId }
    ]
  }
}
