import type { Event } from '@opencode-ai/sdk/v2'
import type { NormalizedEvent } from '../../../../shared/ipc'
import type { BackgroundEvent } from '../../../../shared/background-task'
import { OpenCodeEventMapper } from './map'
import { nativeTaskCompletion, OpenCodeNativeInputs } from './native-input'

const OUTPUT_LIMIT = 64 * 1024
type Child = {
  mapper: OpenCodeEventMapper
  parent: string
  owner: string
  background: boolean
  taskId: string
  nativeId: string
  settled: boolean
}

function taskIdentity(nativeId: string, parent: string): string {
  return `opencode:${JSON.stringify([nativeId, parent])}`
}

function childEvents(
  events: NormalizedEvent[],
  child: Child,
  sessionId: string,
  nativeId: string
): NormalizedEvent[] {
  return events.flatMap((value): NormalizedEvent[] => {
    switch (value.type) {
      case 'message.delta':
      case 'message.completed':
      case 'message.reasoning':
      case 'message.reasoning.delta':
        return [{ ...value, sessionId, parentToolRunId: child.parent }]
      case 'tool.call.started':
      case 'tool.call.completed':
        return [
          {
            ...value,
            sessionId,
            toolRunId: `${nativeId}:${value.toolRunId}`,
            parentToolRunId: child.parent
          }
        ]
      default:
        return []
    }
  })
}

/** Only task metadata from a currently accepted message can register a child session. */
export class OpenCodeActivityMapper {
  readonly root: OpenCodeEventMapper
  private readonly children = new Map<string, Child>()
  private readonly snapshots = new Map<string, string>()
  private sequence = 0
  private readonly inputs: OpenCodeNativeInputs

  constructor(
    readonly sessionId: string,
    promptId: string,
    private readonly generation: string = promptId,
    config: Record<string, unknown> = {}
  ) {
    this.root = new OpenCodeEventMapper(sessionId, promptId, config)
    this.inputs = new OpenCodeNativeInputs(sessionId, promptId)
  }

  acceptPrompt(id: string): void {
    this.inputs.acceptPrompt(id, this.root.terminal)
    this.root.acceptPrompt(id)
  }

  ownedSessions(): string[] {
    return [
      this.sessionId,
      ...[...this.children].filter(([, child]) => !child.settled).map(([id]) => id)
    ]
  }

  ownsSession(id: string): boolean {
    return id === this.sessionId || this.children.has(id)
  }

  finish(): NormalizedEvent[] {
    const children = [...this.children].flatMap(([id, child]) =>
      child.background ? [] : childEvents(child.mapper.finish(), child, this.sessionId, id)
    )
    return [...children, ...this.root.finish()]
  }

  map(event: Event): { events: NormalizedEvent[]; providerEvents: BackgroundEvent[] } {
    const result: { events: NormalizedEvent[]; providerEvents: BackgroundEvent[] } = {
      events: [],
      providerEvents: []
    }
    if (!('sessionID' in event.properties) || typeof event.properties.sessionID !== 'string')
      return result
    const id = event.properties.sessionID
    const received = this.inputs.observe(event, this.root.terminal)
    if (received.userId) this.root.acceptPrompt(received.userId)
    result.events.push(...received.events)
    for (const input of received.events) {
      if (input.type !== 'input.received') continue
      const completion = nativeTaskCompletion(input.text)
      if (!completion) continue
      const target =
        this.children.get(completion.id) ??
        [...this.children.values()].find((value) => value.nativeId === completion.id)
      if (!target?.background || target.settled) continue
      target.settled = true
      result.providerEvents.push({
        type: 'background.task',
        sessionId: this.sessionId,
        taskId: target.taskId,
        toolUseId: target.parent,
        phase: 'notification',
        patch: { status: completion.status, isBackgrounded: true },
        source: this.source()
      })
    }
    const child = this.children.get(id)
    const mapper = id === this.sessionId ? this.root : child?.mapper
    if (!mapper || mapper.terminal) return result
    const toolId = (callId: string): string => (child ? `${id}:${callId}` : callId)
    const mapped = mapper.map(event)
    if (child) {
      if (
        event.type === 'session.idle' ||
        (event.type === 'session.status' && event.properties.status.type === 'idle')
      ) {
        mapped.push(...mapper.finish())
      }
      // Child failure is reported by its parent Task result; it must not end the root turn.
      result.events.push(...childEvents(mapped, child, this.sessionId, id))
    } else result.events.push(...mapped)
    if (event.type !== 'message.part.updated') return result
    const part = event.properties.part
    if (
      part.type !== 'tool' ||
      part.state.status === 'pending' ||
      !mapper.ownsMessage(part.messageID)
    )
      return result
    const state = part.state
    const metadata = state.metadata
    if (
      part.tool === 'task' &&
      typeof metadata?.sessionId === 'string' &&
      metadata.sessionId !== this.sessionId &&
      metadata.sessionId !== id
    ) {
      const prior = this.children.get(metadata.sessionId)
      const parent = toolId(part.callID)
      const nativeId = typeof metadata.jobId === 'string' ? metadata.jobId : metadata.sessionId
      if (!prior || (prior.owner === id && prior.parent !== parent)) {
        this.children.set(metadata.sessionId, {
          mapper: new OpenCodeEventMapper(metadata.sessionId),
          parent,
          owner: id,
          background: metadata.background === true,
          taskId: taskIdentity(nativeId, parent),
          nativeId,
          settled: false
        })
      }
      const target = this.children.get(metadata.sessionId)
      if (target?.parent === parent && metadata.background === true) {
        target.background = true
        target.nativeId = nativeId
        target.taskId = taskIdentity(nativeId, parent)
        if (!target.settled)
          result.providerEvents.push({
            type: 'background.task',
            sessionId: this.sessionId,
            taskId: target.taskId,
            toolUseId: parent,
            phase: state.status === 'error' ? 'notification' : 'started',
            patch: {
              status: state.status === 'error' ? 'error' : 'running',
              isBackgrounded: true,
              agentId: metadata.sessionId
            },
            source: this.source()
          })
        if (state.status === 'error') target.settled = true
      }
      if (target?.parent === parent && !target.background && state.status !== 'running') {
        target.settled = true
        result.events.push(
          ...childEvents(target.mapper.finish(), target, this.sessionId, metadata.sessionId)
        )
      }
    }
    if (part.tool !== 'bash' && part.tool !== 'task') return result
    const output =
      state.status === 'completed'
        ? state.output
        : state.status === 'error'
          ? state.error
          : typeof metadata?.output === 'string'
            ? metadata.output
            : ''
    const snapshot = JSON.stringify([
      state.status,
      output,
      metadata?.model,
      metadata?.background,
      metadata?.jobId
    ])
    const key = toolId(part.callID)
    if (this.snapshots.get(key) === snapshot) return result
    this.snapshots.set(key, snapshot)
    const model = metadata?.model
    const modelName =
      model && typeof model === 'object' && 'modelID' in model && typeof model.modelID === 'string'
        ? model.modelID
        : undefined
    result.providerEvents.push({
      type: 'background.call',
      sessionId: this.sessionId,
      toolUseId: key,
      toolName: part.tool === 'bash' ? 'Bash' : 'Task',
      ...(child ? { parentToolUseId: child.parent } : {}),
      phase: state.status === 'running' ? 'progress' : 'returned',
      input: state.input,
      result: output.slice(-OUTPUT_LIMIT),
      meta: { truncated: output.length > OUTPUT_LIMIT },
      patch: {
        status: state.status,
        mode: metadata?.background === true ? 'background' : 'foreground',
        ...(metadata?.background === true && typeof metadata.sessionId === 'string'
          ? {
              taskId: taskIdentity(
                typeof metadata.jobId === 'string' ? metadata.jobId : metadata.sessionId,
                key
              ),
              agentId: metadata.sessionId
            }
          : {}),
        ...(modelName ? { model: modelName } : {})
      },
      source: this.source()
    })
    return result
  }

  private source(): BackgroundEvent['source'] {
    return {
      generation: this.generation,
      sequence: ++this.sequence,
      receivedAt: Date.now(),
      replay: false
    }
  }
}
