import { chatApi } from '../../../shared/api/ipc'
import {
  backgroundKey,
  isShellBackgroundTool,
  isBackgroundTerminal,
  type BackgroundCallRecord,
  type BackgroundSessionState,
  type BackgroundTaskRecord
} from '../../../../../shared/background-task'
import type { Message, ToolCall } from '../reducer/chatReducer'
import type { BackgroundPanelState, BackgroundSelection } from '../store/backgroundStore'
import type { SubagentTaskSummary } from './parts'

export function isCompletedBackgroundCall(call: BackgroundCallRecord): boolean {
  return Boolean(call.launchFailure) || isBackgroundTerminal(call.status)
}

export function projectLegacyBackgroundPanel(
  tasks: readonly SubagentTaskSummary[],
  panel?: BackgroundPanelState
): SubagentTaskSummary[] {
  return tasks.filter((task) => !panel?.dismissedLegacy?.includes(task.toolUseId))
}

function isDismissedBackgroundItem(
  panel: BackgroundPanelState | undefined,
  task?: BackgroundTaskRecord,
  call?: BackgroundCallRecord
): boolean {
  // A terminal receipt can precede a real task start. Current execution evidence
  // must keep the card and its stop control reachable after that receipt was cleared.
  if (task?.status === 'running' || task?.status === 'paused') return false
  const generation = task?.generation ?? call?.generation
  if (!generation) return false
  const taskId = task?.taskId ?? call?.taskId
  const toolUseId = call?.toolUseId ?? task?.toolUseId
  return Boolean(
    (taskId && panel?.dismissedTasks?.includes(backgroundKey(generation, taskId))) ||
    (toolUseId && panel?.dismissedCalls?.includes(backgroundKey(generation, toolUseId)))
  )
}

export function callForBackgroundTask(
  state: BackgroundSessionState,
  task: BackgroundTaskRecord
): BackgroundCallRecord | undefined {
  if (task.toolUseId) {
    const call = state.calls[backgroundKey(task.generation, task.toolUseId)]
    if (call) return call
  }
  return Object.values(state.calls).find(
    (call) => call.generation === task.generation && call.taskId === task.taskId
  )
}

export function isBackgroundPanelItemVisible(
  task?: BackgroundTaskRecord,
  call?: BackgroundCallRecord
): boolean {
  if (!isShellBackgroundTool(call?.toolName ?? '') && task?.taskType !== 'local_bash') return true
  const requested =
    call?.input &&
    typeof call.input === 'object' &&
    'run_in_background' in call.input &&
    call.input.run_in_background === true
  return Boolean(
    requested ||
    task?.backgroundObserved ||
    call?.backgroundObserved ||
    task?.liveMembership === 'included' ||
    task?.isBackgrounded === true ||
    call?.mode === 'background' ||
    call?.mode === 'remote'
  )
}

export function projectBackgroundPanel(
  state: BackgroundSessionState,
  selection?: BackgroundSelection,
  panel?: BackgroundPanelState
): {
  tasks: BackgroundTaskRecord[]
  calls: BackgroundCallRecord[]
  selectedTask?: BackgroundTaskRecord
  selectedCall?: BackgroundCallRecord
} {
  const tasks = Object.values(state.tasks)
    .filter((task) => {
      const call = callForBackgroundTask(state, task)
      return (
        isBackgroundPanelItemVisible(task, call) && !isDismissedBackgroundItem(panel, task, call)
      )
    })
    .sort((a, b) => b.firstSeenAt - a.firstSeenAt)
  const calls = Object.values(state.calls).filter(
    (call) =>
      (!call.taskId || !state.tasks[backgroundKey(call.generation, call.taskId)]) &&
      isBackgroundPanelItemVisible(undefined, call) &&
      !isDismissedBackgroundItem(panel, undefined, call) &&
      (isShellBackgroundTool(call.toolName ?? '') ||
        call.awaitingTask ||
        call.launchFailure ||
        call.status === 'failed' ||
        call.toolName === 'Agent' ||
        call.toolName === 'Task')
  )
  let selectedTask =
    selection?.kind === 'task'
      ? tasks.find((task) => backgroundKey(task.generation, task.taskId) === selection.key)
      : undefined
  let selectedCall = selectedTask ? callForBackgroundTask(state, selectedTask) : undefined
  if (selection?.kind === 'call') {
    const call = state.calls[selection.key]
    const task = call?.taskId
      ? tasks.find((task) => task.generation === call.generation && task.taskId === call.taskId)
      : undefined
    if (call && (task || calls.includes(call))) {
      selectedCall = call
      selectedTask = task
    }
  }
  return { tasks, calls, selectedTask, selectedCall }
}

export function persistedBackgroundModels(messages: readonly Message[]): Map<string, string> {
  const models = new Map<string, string>()
  for (const message of messages)
    for (const part of message.parts) {
      if (part.type === 'tool_result' && part.subagentMeta?.model)
        models.set(part.toolRunId, part.subagentMeta.model)
    }
  return models
}

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
