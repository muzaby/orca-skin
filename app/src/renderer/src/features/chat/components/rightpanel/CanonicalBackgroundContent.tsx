import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { formatElapsed, useElapsed } from '../../../../shared/ui/elapsed'
import { useI18n } from '../../../../shared/i18n'
import type { MessageKey } from '../../../../shared/i18n'
import type { ToolCall } from '../../reducer/chatReducer'
import {
  backgroundKey,
  type BackgroundCallRecord,
  type BackgroundSessionState,
  type BackgroundTaskRecord
} from '../../../../../../shared/background-task'
import { canStopBackgroundTask } from '../../lib/backgroundPresentation'
import { BackgroundModelLabel } from './BackgroundModelLabel'
import { BackgroundTaskGroup } from './BackgroundTaskGroup'
import { InlineSubagentDetail } from '../transcript/InlineSubagentDetail'
import { ToolCard } from '../transcript/ToolCard'
import { agentUiPolicy } from '../../lib/agentPresentation'
import { useChatSession } from '../../store/chatStore'
import {
  refreshBackgroundState,
  dismissCompletedBackgroundItems,
  toggleBackgroundGroup,
  selectBackgroundItem,
  useBackgroundStore
} from '../../store/backgroundStore'
import {
  callForBackgroundTask,
  backgroundCallDisplay,
  backgroundTaskDisplay,
  transcriptResultsByToolUseId,
  type BackgroundDisplayStatus,
  projectBackgroundPanel,
  persistedBackgroundModels,
  backgroundCallTitle,
  backgroundCallToToolCall,
  backgroundElapsedSeconds,
  requestBackgroundTaskStop,
  shouldActivateBackgroundCard
} from '../../lib/canonicalBackground'

const DISPLAY_LABEL: Record<BackgroundDisplayStatus, MessageKey> = {
  running: 'background.running',
  completed: 'background.completed',
  failed: 'background.failed',
  stopped: 'background.stopped',
  aborted: 'background.stopped',
  launch: 'background.launch',
  pending: 'background.pending',
  unknown: 'background.unknown',
  excluded: 'background.excluded',
  unconfirmed: 'background.unconfirmed',
  rejected: 'background.rejected',
  cancelled: 'background.cancelled',
  not_executed: 'background.not_executed'
}

export function CanonicalBackgroundContent(): React.JSX.Element {
  const sessionId = useChatSession((s) => s.sessionId)
  const kind = useChatSession((s) => s.agentKind)
  const messages = useChatSession((s) => s.messages)
  const persistedModels = useMemo(() => persistedBackgroundModels(messages), [messages])
  const transcriptResults = useMemo(() => transcriptResultsByToolUseId(messages), [messages])
  const view = useBackgroundStore((s) => (sessionId ? s.sessions[sessionId] : undefined))
  const panel = useBackgroundStore((s) => (sessionId ? s.panels[sessionId] : undefined))
  const { tr } = useI18n()
  useEffect(() => {
    if (sessionId && !view) void refreshBackgroundState(sessionId)
  }, [sessionId, view])
  if (!sessionId || !view)
    return <p className="p-4 text-footnote text-t6">{tr('background.loading')}</p>
  const state = view.state
  const selection = view.selection
  const { tasks, calls, selectedTask, selectedCall } = projectBackgroundPanel(
    state,
    selection,
    panel,
    transcriptResults
  )
  if (selectedTask || selectedCall) {
    return (
      <CanonicalBackgroundDetail
        task={selectedTask}
        call={selectedCall}
        transcript={transcriptResults.get(selectedCall?.toolUseId ?? '')}
        transcriptPolicy={agentUiPolicy(kind).transcript}
      />
    )
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3" data-background-tasks>
      {state.connection !== 'connected' && (
        <p role="status" className="text-footnote text-t6">
          {tr(`background.${state.connection}`)}
        </p>
      )}
      {view.loading && <p role="status">{tr('background.loading')}</p>}
      {view.error && (
        <p role="alert" className="text-footnote text-bad">
          {view.error}
        </p>
      )}
      {!tasks.length && !calls.length && (
        <p className="text-footnote text-t6">{tr('background.empty')}</p>
      )}
      {(['running', 'completed'] as const).map((group) => {
        const groupedTasks = tasks.filter(
          (task) =>
            backgroundTaskDisplay(
              state,
              task,
              callForBackgroundTask(state, task),
              transcriptResults.get(
                callForBackgroundTask(state, task)?.toolUseId ?? task.toolUseId ?? ''
              )
            ).settled ===
            (group === 'completed')
        )
        const groupedCalls = calls.filter(
          (call) =>
            backgroundCallDisplay(state, call, transcriptResults.get(call.toolUseId)).settled ===
            (group === 'completed')
        )
        return (
          <BackgroundTaskGroup
            key={group}
            group={group}
            count={groupedTasks.length + groupedCalls.length}
            collapsed={panel?.collapsed?.[group] ?? false}
            onToggle={() => toggleBackgroundGroup(sessionId, group)}
            onClear={() => dismissCompletedBackgroundItems(sessionId, [], transcriptResults)}
          >
            {groupedTasks.map((task) => (
              <BackgroundTaskCard
                key={backgroundKey(task.generation, task.taskId)}
                sessionId={sessionId}
                state={state}
                task={task}
                call={callForBackgroundTask(state, task)}
                transcript={transcriptResults.get(
                  callForBackgroundTask(state, task)?.toolUseId ?? task.toolUseId ?? ''
                )}
                persistedModel={persistedModels.get(
                  task.toolUseId ?? callForBackgroundTask(state, task)?.toolUseId ?? ''
                )}
                onOpen={() =>
                  selectBackgroundItem(sessionId, {
                    kind: 'task',
                    key: backgroundKey(task.generation, task.taskId)
                  })
                }
              />
            ))}
            {groupedCalls.map((call) => (
              <BackgroundCallCard
                key={backgroundKey(call.generation, call.toolUseId)}
                call={call}
                state={state}
                transcript={transcriptResults.get(call.toolUseId)}
                persistedModel={persistedModels.get(call.toolUseId)}
                onOpen={() =>
                  selectBackgroundItem(sessionId, {
                    kind: 'call',
                    key: backgroundKey(call.generation, call.toolUseId)
                  })
                }
              />
            ))}
          </BackgroundTaskGroup>
        )
      })}
    </div>
  )
}

export function BackgroundTaskCard({
  sessionId,
  state,
  task,
  call,
  transcript,
  persistedModel,
  onOpen
}: {
  sessionId: string
  state: BackgroundSessionState
  task: BackgroundTaskRecord
  call?: BackgroundCallRecord
  transcript?: ToolCall['result']
  persistedModel?: string
  onOpen?: () => void
}): React.JSX.Element {
  const { tr } = useI18n()
  const [error, setError] = useState<string>()
  const [requesting, setRequesting] = useState(false)
  const display = backgroundTaskDisplay(state, task, call, transcript)
  const terminal = display.settled
  const canStop = !terminal && canStopBackgroundTask(task, state.generation, state.connection)
  const elapsedTick = useElapsed(terminal ? null : task.firstSeenAt)
  const elapsedSeconds = terminal
    ? backgroundElapsedSeconds(task, task.lastSeenAt, display.endedAt)
    : Math.max(elapsedTick, backgroundElapsedSeconds(task))
  const stop = async (): Promise<void> => {
    setRequesting(true)
    setError(undefined)
    try {
      await requestBackgroundTaskStop(sessionId, task)
    } catch (err) {
      setError(String(err))
    } finally {
      setRequesting(false)
    }
  }
  const mode =
    task.isBackgrounded === false
      ? 'foreground'
      : (call?.mode ?? (task.liveMembership === 'included' ? 'background' : undefined))
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (shouldActivateBackgroundCard(event)) {
          event.preventDefault()
          onOpen?.()
        }
      }}
      aria-label={tr('chat.subagentTile.openTranscriptAria', {
        description: task.description || call?.toolName || task.taskType || task.taskId
      })}
      className="group/subagent cursor-pointer rounded-r6 bg-bg2 px-3 py-2.5 text-left transition-colors hover:bg-fill-uncontained-hover focus:outline-none hide-focus-ring ring-focus"
      data-background-task={task.taskId}
      data-background-generation={task.generation}
    >
      <div className="flex min-w-0 items-center gap-g3">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-t6" />
        <span className="min-w-0 flex-1 truncate text-body font-semibold text-t9">
          {task.description || call?.toolName || task.taskType || task.taskId}
        </span>
      </div>
      <div
        className={`mt-g1 pl-5 text-footnote ${display.status === 'failed' ? 'text-bad' : 'text-ink3'}`}
      >
        {call?.toolName === 'Agent' || call?.toolName === 'Task' || task.subagentType ? (
          <BackgroundModelLabel
            toolUseId={call?.toolUseId ?? task.toolUseId}
            model={call?.model}
            persistedModel={persistedModel}
          />
        ) : (
          call?.toolName || task.taskType || tr('common.unknown')
        )}
        {' · '}
        {tr(
          task.stop && !terminal
            ? task.stop.state === 'failed'
              ? 'background.stopFailed'
              : `background.${task.stop.state}`
            : DISPLAY_LABEL[display.status]
        )}
        {elapsedSeconds !== undefined && ` · ${formatElapsed(elapsedSeconds)}`}
        {mode && ` · ${tr(`background.${mode}`)}`}
        {task.ambient && ` · ${tr('background.ambient')}`}
        {terminal && task.liveMembership === 'included' && ` · ${tr('background.sync')}`}
        {(task.generation !== state.generation || display.status === 'unconfirmed') &&
          ` · ${tr('background.terminated')}`}
      </div>
      <div className="mt-g1 flex items-center pl-5 text-footnote text-ink3">
        <span className="min-w-0 truncate">
          {task.totalTokens !== undefined &&
            `${tr('background.tokens', { count: task.totalTokens })} · `}
          {tr('background.toolUses', { count: task.toolUses ?? 0 })}
          {task.lastToolName && ` · ${task.lastToolName}`}
          {call?.retry != null && ` · ${tr('background.retry')}`}
          {call?.heartbeat && ` · ${tr('background.heartbeat')}`}
          {' · '}
          <span className="font-medium text-t7 group-hover/subagent:underline">
            {tr('chat.subagentTile.viewTranscript')}
          </span>
        </span>
        {canStop && (
          <Button
            iconOnly
            variant="uncontained"
            size="small"
            leadingIcon="stop"
            aria-label={tr('common.stop')}
            title={tr('common.stop')}
            className="ml-g2 shrink-0"
            disabled={requesting}
            onClick={(event) => {
              event.stopPropagation()
              void stop()
            }}
          />
        )}
      </div>
      {(task.stop?.error || error) && (
        <p role="alert" className="mt-0.5 break-words pl-5 text-footnote text-bad">
          {task.stop?.error || error}
        </p>
      )}
    </div>
  )
}

function BackgroundCallCard({
  state,
  call,
  transcript,
  persistedModel,
  onOpen
}: {
  state: BackgroundSessionState
  call: BackgroundCallRecord
  transcript?: ToolCall['result']
  persistedModel?: string
  onOpen: () => void
}): React.JSX.Element {
  const { tr } = useI18n()
  const display = backgroundCallDisplay(state, call, transcript)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (shouldActivateBackgroundCard(event)) {
          event.preventDefault()
          onOpen()
        }
      }}
      aria-label={tr('chat.subagentTile.openTranscriptAria', {
        description: backgroundCallTitle(call)
      })}
      className="group/subagent cursor-pointer rounded-r6 bg-bg2 px-3 py-2.5 text-left transition-colors hover:bg-fill-uncontained-hover focus:outline-none hide-focus-ring ring-focus"
      data-background-call={call.toolUseId}
      data-background-generation={call.generation}
    >
      <div className="flex min-w-0 items-center gap-g3">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-t6" />
        <span className="min-w-0 flex-1 truncate text-body font-semibold text-t9">
          {backgroundCallTitle(call)}
        </span>
      </div>
      <div
        className={`mt-g1 pl-5 text-footnote ${display.status === 'failed' ? 'text-bad' : 'text-ink3'}`}
      >
        {call.toolName === 'Agent' || call.toolName === 'Task' ? (
          <BackgroundModelLabel
            toolUseId={call.toolUseId}
            model={call.model}
            persistedModel={persistedModel}
          />
        ) : (
          call.toolName || tr('common.unknown')
        )}{' '}
        · {tr(DISPLAY_LABEL[display.status])}
      </div>
      <div className="mt-g1 pl-5 text-footnote text-ink3">
        {call.awaitingTask && `${tr('background.noTaskId')} · `}
        <span className="font-medium text-t7 group-hover/subagent:underline">
          {tr('chat.subagentTile.viewTranscript')}
        </span>
      </div>
    </div>
  )
}

function CanonicalBackgroundDetail({
  task,
  call,
  transcript,
  transcriptPolicy
}: {
  task?: BackgroundTaskRecord
  call?: BackgroundCallRecord
  transcript?: ToolCall['result']
  transcriptPolicy: import('../../lib/agentPresentation').AgentTranscriptPresentation
}): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-auto px-p5 py-p4"
      data-background-detail={task?.taskId}
      data-background-call-detail={call?.toolUseId}
    >
      {call ? (
        call.toolName === 'Agent' || call.toolName === 'Task' ? (
          <InlineSubagentDetail
            toolRunId={call.toolUseId}
            transcriptPolicy={transcriptPolicy}
            framed={false}
          />
        ) : (
          <div data-background-tool-call={call.toolUseId}>
            <ToolCard
              call={backgroundCallToToolCall(call, transcript)}
              transcriptPolicy={{ ...transcriptPolicy, showTaskAgentLabel: false }}
              presentation="detail-body"
            />
          </div>
        )
      ) : (
        <p className="text-footnote text-ink3">{tr('background.noTaskId')}</p>
      )}
    </div>
  )
}
