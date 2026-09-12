import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../../shared/ui/Button'
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
import { agentUiPolicy } from '../../lib/agentPresentation'
import { useChatSession } from '../../store/chatStore'
import { refreshBackgroundState, useBackgroundStore } from '../../store/backgroundStore'

export function CanonicalBackgroundContent(): React.JSX.Element {
  const sessionId = useChatSession((s) => s.sessionId)
  const kind = useChatSession((s) => s.agentKind)
  const view = useBackgroundStore((s) => (sessionId ? s.sessions[sessionId] : undefined))
  const { tr } = useI18n()
  const [allError, setAllError] = useState<string>()
  const [stoppingAll, setStoppingAll] = useState(false)
  useEffect(() => {
    if (sessionId && !view) void refreshBackgroundState(sessionId)
  }, [sessionId, view])
  if (!sessionId || !view)
    return <p className="p-4 text-footnote text-t6">{tr('background.loading')}</p>
  const state = view.state
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
  const stopAll = async (): Promise<void> => {
    if (!state.generation) return
    setStoppingAll(true)
    setAllError(undefined)
    try {
      const result = await chatApi.stopAllBackgroundTasks({
        sessionId,
        generation: state.generation
      })
      if (result.unknown) setAllError(tr('background.residualUnknown'))
      else if (result.residualTaskIds.length)
        setAllError(tr('background.residual', { count: result.residualTaskIds.length }))
    } catch (error) {
      setAllError(String(error))
    } finally {
      setStoppingAll(false)
    }
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3" data-background-tasks>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="small" onClick={() => void refreshBackgroundState(sessionId)}>
          {tr('background.refresh')}
        </Button>
        {state.generation && state.connection === 'connected' && (
          <Button size="small" disabled={stoppingAll} onClick={() => void stopAll()}>
            {tr('background.stopAll')}
          </Button>
        )}
      </div>
      {state.connection !== 'connected' && (
        <p role="status" className="text-footnote text-t6">
          {tr(`background.${state.connection}`)}
        </p>
      )}
      {view.loading && <p role="status">{tr('background.loading')}</p>}
      {(view.error || allError) && (
        <p role="alert" className="text-footnote text-bad">
          {view.error || allError}
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
          call={
            task.toolUseId ? state.calls[backgroundKey(task.generation, task.toolUseId)] : undefined
          }
          transcriptPolicy={agentUiPolicy(kind).transcript}
        />
      ))}
      {calls.map((call) => (
        <div
          key={backgroundKey(call.generation, call.toolUseId)}
          className="rounded-r5 border border-border p-3"
          data-background-call={call.toolUseId}
        >
          <p className="text-footnote font-semibold">
            {call.toolName} ·{' '}
            {tr(
              call.awaitingTask
                ? 'background.launch'
                : isBackgroundTerminal(call.status)
                  ? call.status === 'completed'
                    ? 'background.completed'
                    : call.status === 'failed'
                      ? 'background.failed'
                      : 'background.stopped'
                  : call.mode === 'foreground'
                    ? 'background.foreground'
                    : 'background.unknown'
            )}
          </p>
          {call.awaitingTask && (
            <p className="text-footnote text-t6">{tr('background.noTaskId')}</p>
          )}
          <CallDetails call={call} />
          {(call.toolName === 'Agent' || call.toolName === 'Task') && (
            <InlineSubagentDetail
              toolRunId={call.toolUseId}
              transcriptPolicy={agentUiPolicy(kind).transcript}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export function BackgroundTaskCard({
  sessionId,
  state,
  task,
  call,
  transcriptPolicy
}: {
  sessionId: string
  state: BackgroundSessionState
  task: BackgroundTaskRecord
  call?: BackgroundCallRecord
  transcriptPolicy: import('../../lib/agentPresentation').AgentTranscriptPresentation
}): React.JSX.Element {
  const { tr } = useI18n()
  const [error, setError] = useState<string>()
  const [requesting, setRequesting] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const terminal = isBackgroundTerminal(task.status)
  const canStop = canStopBackgroundTask(task, state.generation, state.connection)
  const stop = async (): Promise<void> => {
    setRequesting(true)
    setError(undefined)
    try {
      await chatApi.stopBackgroundTask({
        sessionId,
        generation: task.generation,
        taskId: task.taskId
      })
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
    <article
      className="rounded-r5 border border-border bg-panel p-3"
      data-background-task={task.taskId}
      data-background-generation={task.generation}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 break-words text-footnote font-semibold">
          {task.description || call?.toolName || task.taskType || task.taskId}
        </span>
        <span className="text-footnote">{tr(`background.${backgroundTaskStatus(task)}`)}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-2 text-footnote text-t6">
        {mode && <span>{tr(`background.${mode}`)}</span>}
        {task.ambient && <span>{tr('background.ambient')}</span>}
        {terminal && task.liveMembership === 'included' && <span>{tr('background.sync')}</span>}
        {task.generation !== state.generation && <span>{tr('background.terminated')}</span>}
        {task.durationMs !== undefined && (
          <span>{tr('background.seconds', { count: Math.floor(task.durationMs / 1000) })}</span>
        )}
        {task.toolUses !== undefined && (
          <span>{tr('background.toolUses', { count: task.toolUses })}</span>
        )}
        {task.totalTokens !== undefined && (
          <span>{tr('background.tokens', { count: task.totalTokens })}</span>
        )}
        {task.lastToolName && <span>{task.lastToolName}</span>}
        {call?.retry != null && <span>{tr('background.retry')}</span>}
        {call?.heartbeat && <span>{tr('background.heartbeat')}</span>}
      </div>
      {task.summary !== undefined && (
        <p className="mt-2 whitespace-pre-wrap break-words text-footnote">
          {safeOutputText(task.summary)}
        </p>
      )}
      {task.error && (
        <p role="alert" className="text-footnote text-bad">
          {safeOutputText(task.error)}
        </p>
      )}
      {(hasTerminalConflict(task) || call?.launchFailure) && (
        <p role="alert" className="text-footnote text-bad">
          {tr('background.conflict')}
        </p>
      )}
      {task.stop && !terminal && (
        <p role="status" className="text-footnote">
          {tr(
            task.stop.state === 'failed' ? 'background.stopFailed' : `background.${task.stop.state}`
          )}
        </p>
      )}
      {(task.stop?.error || error) && (
        <p role="alert" className="break-words text-footnote text-bad">
          {task.stop?.error || error}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {canStop && (
          <Button size="small" disabled={requesting} onClick={() => void stop()}>
            {tr('background.stop')}
          </Button>
        )}
        {!terminal && (
          <Button size="small" onClick={() => setWaiting(!waiting)}>
            {tr(waiting ? 'background.cancelWait' : 'background.waiting')}
          </Button>
        )}
      </div>
      {waiting && (
        <p role="status" className="mt-2 text-footnote text-t6">
          {tr(
            terminal
              ? `background.${backgroundTaskStatus(task)}`
              : state.connection === 'connected'
                ? 'background.acknowledged'
                : 'background.disconnected'
          )}
        </p>
      )}
      {call && <CallDetails call={call} />}
      <details className="mt-2 text-footnote">
        <summary>{tr('background.details')}</summary>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all">
          {backgroundResultText(task)}
        </pre>
      </details>
      {task.toolUseId && (call?.toolName === 'Agent' || call?.toolName === 'Task') && (
        <details className="mt-2 text-footnote">
          <summary>{tr('background.conversation')}</summary>
          <InlineSubagentDetail toolRunId={task.toolUseId} transcriptPolicy={transcriptPolicy} />
        </details>
      )}
      {backgroundOutputRefsForDisplay(task.outputRefs).map((ref) => (
        <BackgroundOutput key={ref.id} sessionId={sessionId} task={task} output={ref} />
      ))}
    </article>
  )
}
function CallDetails({ call }: { call: BackgroundCallRecord }): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <details className="mt-2 text-footnote">
      <summary>{tr('background.details')}</summary>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all">
        {backgroundResultText({
          tool: call.toolName,
          input: call.input,
          result: call.result,
          structuredOutput: call.structuredOutput,
          launchFailure: call.launchFailure,
          meta: call.meta,
          agentId: call.agentId,
          runId: call.runId,
          retry: call.retry
        })}
      </pre>
    </details>
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
