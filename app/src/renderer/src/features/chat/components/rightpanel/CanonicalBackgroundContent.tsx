import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { formatElapsed, useElapsed } from '../../../../shared/ui/elapsed'
import { useI18n } from '../../../../shared/i18n'
import { chatApi } from '../../../../shared/api/ipc'
import {
  backgroundKey,
  isBackgroundTerminal,
  type BackgroundCallRecord,
  type BackgroundOutputRef,
  type BackgroundSessionState,
  type BackgroundTaskRecord,
  type ReadBackgroundOutputResponse
} from '../../../../../../shared/background-task'
import {
  backgroundResultText,
  backgroundOutputRefsForDisplay,
  backgroundTaskStatus,
  canStopBackgroundTask,
  hasTerminalConflict,
  safeOutputText
} from '../../lib/backgroundPresentation'
import { InlineSubagentDetail } from '../transcript/InlineSubagentDetail'
import { ToolCard } from '../transcript/ToolCard'
import { agentUiPolicy } from '../../lib/agentPresentation'
import { useChatSession } from '../../store/chatStore'
import {
  refreshBackgroundState,
  selectBackgroundItem,
  useBackgroundStore
} from '../../store/backgroundStore'
import {
  backgroundCallTitle,
  backgroundCallToToolCall,
  backgroundElapsedSeconds,
  requestBackgroundTaskStop,
  shouldActivateBackgroundCard
} from '../../lib/canonicalBackground'

function callStatus(
  call: BackgroundCallRecord
): 'failed' | 'completed' | 'stopped' | 'launch' | 'running' {
  if (call.launchFailure || call.status === 'failed') return 'failed'
  if (call.status === 'completed') return 'completed'
  if (call.status === 'killed' || call.status === 'stopped') return 'stopped'
  if (call.awaitingTask) return 'launch'
  return 'running'
}

function callForTask(
  state: BackgroundSessionState,
  task: BackgroundTaskRecord
): BackgroundCallRecord | undefined {
  if (task.toolUseId) {
    const direct = state.calls[backgroundKey(task.generation, task.toolUseId)]
    if (direct) return direct
  }
  return Object.values(state.calls).find(
    (call) => call.generation === task.generation && call.taskId === task.taskId
  )
}

export function CanonicalBackgroundContent(): React.JSX.Element {
  const sessionId = useChatSession((s) => s.sessionId)
  const kind = useChatSession((s) => s.agentKind)
  const view = useBackgroundStore((s) => (sessionId ? s.sessions[sessionId] : undefined))
  const { tr } = useI18n()
  useEffect(() => {
    if (sessionId && !view) void refreshBackgroundState(sessionId)
  }, [sessionId, view])
  if (!sessionId || !view)
    return <p className="p-4 text-footnote text-t6">{tr('background.loading')}</p>
  const state = view.state
  const selection = view.selection
  const tasks = Object.values(state.tasks).sort((a, b) => b.firstSeenAt - a.firstSeenAt)
  const calls = Object.values(state.calls).filter(
    (call) =>
      (!call.taskId || !state.tasks[backgroundKey(call.generation, call.taskId)]) &&
      (call.awaitingTask ||
        call.launchFailure ||
        call.status === 'failed' ||
        call.toolName === 'Agent' ||
        call.toolName === 'Task')
  )
  const directlySelectedTask = selection?.kind === 'task' ? state.tasks[selection.key] : undefined
  const selectedCall =
    selection?.kind === 'call'
      ? state.calls[selection.key]
      : directlySelectedTask
        ? callForTask(state, directlySelectedTask)
        : undefined
  const selectedTask =
    directlySelectedTask ??
    (selectedCall?.taskId
      ? state.tasks[backgroundKey(selectedCall.generation, selectedCall.taskId)]
      : undefined)
  if (selectedTask || selectedCall) {
    return (
      <CanonicalBackgroundDetail
        sessionId={sessionId}
        task={selectedTask}
        call={selectedCall}
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
      {tasks.map((task) => (
        <BackgroundTaskCard
          key={backgroundKey(task.generation, task.taskId)}
          sessionId={sessionId}
          state={state}
          task={task}
          call={callForTask(state, task)}
          onOpen={() =>
            selectBackgroundItem(sessionId, {
              kind: 'task',
              key: backgroundKey(task.generation, task.taskId)
            })
          }
        />
      ))}
      {calls.map((call) => (
        <BackgroundCallCard
          key={backgroundKey(call.generation, call.toolUseId)}
          call={call}
          onOpen={() =>
            selectBackgroundItem(sessionId, {
              kind: 'call',
              key: backgroundKey(call.generation, call.toolUseId)
            })
          }
        />
      ))}
    </div>
  )
}

export function BackgroundTaskCard({
  sessionId,
  state,
  task,
  call,
  onOpen
}: {
  sessionId: string
  state: BackgroundSessionState
  task: BackgroundTaskRecord
  call?: BackgroundCallRecord
  onOpen?: () => void
}): React.JSX.Element {
  const { tr } = useI18n()
  const [error, setError] = useState<string>()
  const [requesting, setRequesting] = useState(false)
  const terminal = isBackgroundTerminal(task.status)
  const canStop = canStopBackgroundTask(task, state.generation, state.connection)
  const elapsedTick = useElapsed(terminal ? null : task.firstSeenAt)
  const elapsedSeconds = terminal
    ? backgroundElapsedSeconds(task)
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
      <div className="mt-g1 pl-5 text-footnote text-ink3">
        {call?.toolName || task.taskType || tr('chat.toolMeta.agentFallback')}
        {' · '}
        {tr(
          task.stop && !terminal
            ? task.stop.state === 'failed'
              ? 'background.stopFailed'
              : `background.${task.stop.state}`
            : `background.${backgroundTaskStatus(task)}`
        )}
        {elapsedSeconds !== undefined && ` · ${formatElapsed(elapsedSeconds)}`}
        {mode && ` · ${tr(`background.${mode}`)}`}
        {task.ambient && ` · ${tr('background.ambient')}`}
        {terminal && task.liveMembership === 'included' && ` · ${tr('background.sync')}`}
        {task.generation !== state.generation && ` · ${tr('background.terminated')}`}
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
      {task.summary !== undefined && (
        <p className="mt-2 whitespace-pre-wrap break-words pl-5 text-footnote">
          {safeOutputText(task.summary)}
        </p>
      )}
      {task.error && (
        <p role="alert" className="pl-5 text-footnote text-bad">
          {safeOutputText(task.error)}
        </p>
      )}
      {(hasTerminalConflict(task) || call?.launchFailure) && (
        <p role="alert" className="pl-5 text-footnote text-bad">
          {call?.launchFailure
            ? backgroundResultText(call.launchFailure.receipt)
            : tr('background.conflict')}
        </p>
      )}
      {(task.stop?.error || error) && (
        <p role="alert" className="mt-0.5 break-words pl-5 text-footnote text-bad">
          {task.stop?.error || error}
        </p>
      )}
    </div>
  )
}

function BackgroundCallCard({
  call,
  onOpen
}: {
  call: BackgroundCallRecord
  onOpen: () => void
}): React.JSX.Element {
  const { tr } = useI18n()
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
      <div className="mt-g1 pl-5 text-footnote text-ink3">
        {call.toolName || tr('common.unknown')} · {tr(`background.${callStatus(call)}`)}
      </div>
      <div className="mt-g1 pl-5 text-footnote text-ink3">
        {call.awaitingTask && `${tr('background.noTaskId')} · `}
        <span className="font-medium text-t7 group-hover/subagent:underline">
          {tr('chat.subagentTile.viewTranscript')}
        </span>
      </div>
      {call.launchFailure && (
        <p
          role="alert"
          className="mt-1 whitespace-pre-wrap break-words pl-5 text-footnote text-bad"
        >
          {backgroundResultText(call.launchFailure.receipt)}
        </p>
      )}
    </div>
  )
}

function CanonicalBackgroundDetail({
  sessionId,
  task,
  call,
  transcriptPolicy
}: {
  sessionId: string
  task?: BackgroundTaskRecord
  call?: BackgroundCallRecord
  transcriptPolicy: import('../../lib/agentPresentation').AgentTranscriptPresentation
}): React.JSX.Element {
  const { tr } = useI18n()
  const toolPolicy = { ...transcriptPolicy, showTaskAgentLabel: false }
  if (call && (call.toolName === 'Agent' || call.toolName === 'Task')) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col overflow-auto px-p5 py-p4"
        data-background-detail={task?.taskId}
        data-background-call-detail={call.toolUseId}
      >
        <InlineSubagentDetail
          toolRunId={call.toolUseId}
          transcriptPolicy={transcriptPolicy}
          framed={false}
        />
      </div>
    )
  }
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-[var(--chat-turn-gap)] overflow-auto px-p5 py-p4"
      data-background-detail={task?.taskId}
      data-background-call-detail={call?.toolUseId}
    >
      {call && (
        <div data-background-tool-call={call.toolUseId}>
          <ToolCard
            call={backgroundCallToToolCall(call)}
            transcriptPolicy={toolPolicy}
            presentation="detail-body"
          />
        </div>
      )}
      {task && !call && (
        <details open className="text-footnote">
          <summary>{tr('background.details')}</summary>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all">
            {backgroundResultText(task)}
          </pre>
        </details>
      )}
      {task?.summary !== undefined && (
        <p className="whitespace-pre-wrap break-words text-footnote">
          {safeOutputText(task.summary)}
        </p>
      )}
      {task?.error && (
        <p role="alert" className="text-footnote text-bad">
          {safeOutputText(task.error)}
        </p>
      )}
      {task && (hasTerminalConflict(task) || call?.launchFailure) && (
        <p role="alert" className="text-footnote text-bad">
          {tr('background.conflict')}
        </p>
      )}
      {task &&
        backgroundOutputRefsForDisplay(task.outputRefs).map((ref) => (
          <BackgroundOutput key={ref.id} sessionId={sessionId} task={task} output={ref} />
        ))}
    </div>
  )
}
function BackgroundOutput({
  sessionId,
  task,
  output
}: {
  sessionId: string
  task: BackgroundTaskRecord
  output: BackgroundOutputRef
}): React.JSX.Element {
  const { tr } = useI18n()
  const [value, setValue] = useState<ReadBackgroundOutputResponse>()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [view, setView] = useState<'current' | 'snapshot'>('current')
  const version = useRef(0)
  useEffect(
    () => () => {
      version.current++
    },
    []
  )
  const read = async (reset = false): Promise<void> => {
    const current = ++version.current
    setBusy(true)
    setError(undefined)
    try {
      const result = await chatApi.readBackgroundOutput({
        sessionId,
        generation: task.generation,
        taskId: task.taskId,
        outputId: output.id,
        offset: reset ? 0 : (value?.nextOffset ?? 0),
        maxBytes: 65_536,
        view,
        ...(!reset && value?.cursor ? { cursor: value.cursor } : {})
      })
      if (current !== version.current) return
      setValue(result)
      setText(
        (old) =>
          (reset ||
          result.status === 'changed' ||
          result.status === 'truncated' ||
          result.offset === 0
            ? ''
            : old) + safeOutputText(result.text ?? '')
      )
    } catch (err) {
      if (current === version.current) setError(String(err))
    } finally {
      if (current === version.current) setBusy(false)
    }
  }
  const selectView = (next: 'current' | 'snapshot'): void => {
    version.current++
    setView(next)
    setValue(undefined)
    setText('')
    setBusy(false)
    setError(undefined)
  }
  const unavailable = output.canRead === false || output.kind !== 'file'
  return (
    <section
      className="mt-3 rounded-r5 border border-border p-2"
      data-background-output={output.id}
    >
      <p className="break-all text-footnote">
        {output.field}: {output.value}
      </p>
      <div className="my-2 flex flex-wrap gap-2">
        {task.outputSnapshots[output.id] && (
          <>
            <Button size="small" onClick={() => selectView('current')}>
              {tr('background.current')}
            </Button>
            <Button size="small" onClick={() => selectView('snapshot')}>
              {tr('background.snapshot')}
            </Button>
          </>
        )}
        <Button size="small" disabled={busy || unavailable} onClick={() => void read(false)}>
          {tr(value ? 'background.more' : 'background.read')}
        </Button>
        {value && (
          <Button size="small" disabled={busy || unavailable} onClick={() => void read(true)}>
            {tr('background.refresh')}
          </Button>
        )}
      </div>
      {unavailable && (
        <p className="text-footnote text-t6">
          {tr(output.kind === 'uri' ? 'background.remoteOutput' : 'background.denied')}
        </p>
      )}
      {value && (
        <p role="status" className="text-footnote text-t6">
          {tr(value.status === 'remote' ? 'background.remoteOutput' : `background.${value.status}`)}{' '}
          · {value.nextOffset}/{value.size ?? '?'} ·{' '}
          {tr(view === 'current' ? 'background.current' : 'background.snapshot')}
        </p>
      )}
      {(error || value?.error || task.outputErrors[output.id]) && (
        <p role="alert" className="text-footnote text-bad">
          {error || value?.error || task.outputErrors[output.id]}
        </p>
      )}
      {text && (
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-footnote">
          {text}
        </pre>
      )}
      <p className="text-footnote text-t6">{tr('background.outputHelp')}</p>
    </section>
  )
}
