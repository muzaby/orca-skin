import { chatApi } from '../../../shared/api/ipc'
import {
  isBackgroundTerminal,
  type BackgroundCallRecord,
  type BackgroundSessionState,
  type BackgroundTaskRecord
} from '../../../../../shared/background-task'
import type { ToolCall } from '../reducer/chatReducer'

export function hasCanonicalBackground(state: BackgroundSessionState): boolean {
  return Boolean(
    state.generation || Object.keys(state.tasks).length || Object.keys(state.calls).length
  )
}

export function backgroundCallTitle(call: BackgroundCallRecord): string {
  const input =
    typeof call.input === 'object' && call.input !== null
      ? (call.input as Record<string, unknown>)
      : undefined
  for (const key of ['description', 'prompt', 'command']) {
    const value = input?.[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return call.toolName || call.toolUseId
}

export function backgroundCallToToolCall(call: BackgroundCallRecord): ToolCall {
  const failed = Boolean(call.launchFailure || call.status === 'failed')
  const returned = call.phase === 'returned'
  const output = call.result ?? call.structuredOutput ?? call.launchFailure?.receipt
  return {
    toolUseId: call.toolUseId,
    name: call.toolName || 'BackgroundTask',
    input: call.input,
    ...(call.parentToolUseId ? { parentToolRunId: call.parentToolUseId } : {}),
    ...(returned || output !== undefined
      ? {
          result: {
            output,
            isError: failed,
            ...(call.structuredOutput !== undefined
              ? { structuredOutput: call.structuredOutput }
              : {}),
            ...(call.parentToolUseId ? { parentToolRunId: call.parentToolUseId } : {})
          }
        }
      : {})
  }
}

export function backgroundElapsedSeconds(task: BackgroundTaskRecord, now = Date.now()): number {
  if (isBackgroundTerminal(task.status)) {
    if (task.durationMs !== undefined) return Math.max(0, Math.floor(task.durationMs / 1000))
    const terminalAt = task.terminalEvidence[0]?.source.receivedAt ?? task.lastSeenAt
    return Math.max(0, Math.floor((terminalAt - task.firstSeenAt) / 1000))
  }
  return Math.max(0, Math.floor((now - task.firstSeenAt) / 1000))
}

export function requestBackgroundTaskStop(
  sessionId: string,
  task: Pick<BackgroundTaskRecord, 'generation' | 'taskId'>
): Promise<void> {
  return chatApi.stopBackgroundTask({
    sessionId,
    generation: task.generation,
    taskId: task.taskId
  })
}

export function shouldActivateBackgroundCard(event: {
  key: string
  target: unknown
  currentTarget: unknown
}): boolean {
  return event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')
}
