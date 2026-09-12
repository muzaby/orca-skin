// Canonical task protocol and pure state. SDK identifiers retain their original namespaces.
export interface BackgroundEventSource {
  generation: string
  sequence: number
  receivedAt: number
  replay: boolean
  uuid?: string
}
export interface BackgroundOutputRef {
  id: string
  field: string
  value: string
  kind: 'file' | 'uri' | 'directory'
  canRead?: boolean
}
export interface BackgroundTaskIdentity {
  taskId: string
  taskType?: string
  description?: string
  ambient?: boolean
}
export interface BackgroundTaskPatch {
  taskType?: string
  description?: string
  status?: string
  isBackgrounded?: boolean
  ambient?: boolean
  spawnDepth?: number
  subagentType?: string
  endTime?: number
  totalPausedMs?: number
  error?: string
  summary?: string
  lastToolName?: string
  totalTokens?: number
  toolUses?: number
  durationMs?: number
  usage?: unknown
  outputFile?: string
  resourceLinks?: unknown
  outputRefs?: BackgroundOutputRef[]
  agentId?: string
  parentToolUseId?: string
  parentAgentId?: string
}
export interface BackgroundCallPatch {
  model?: string
  agentId?: string
  taskId?: string
  runId?: string
  mode?: 'foreground' | 'background' | 'remote'
  status?: string
  outputRefs?: BackgroundOutputRef[]
  outputFile?: string
  canReadOutputFile?: boolean
  retry?: unknown
  heartbeat?: boolean
  elapsedTimeSeconds?: number
  summary?: string
  usage?: unknown
}
type Envelope = { sessionId: string; source: BackgroundEventSource }
export interface BackgroundOutputSnapshot {
  id: string
  capturedAt: number
  size: number
  sha256: string
  partial: boolean
}
export type BackgroundEvent = Envelope &
  (
    | {
        type: 'background.task'
        taskId: string
        toolUseId?: string
        phase: 'started' | 'progress' | 'updated' | 'notification'
        patch: BackgroundTaskPatch
      }
    | { type: 'background.snapshot'; tasks: BackgroundTaskIdentity[] }
    | {
        type: 'background.call'
        toolUseId: string
        toolName?: string
        parentToolUseId?: string
        phase: 'started' | 'progress' | 'returned'
        input?: unknown
        result?: unknown
        structuredOutput?: unknown
        meta?: unknown
        patch?: BackgroundCallPatch
      }
    | {
        type: 'background.connection'
        state: 'connected' | 'resynchronizing' | 'disconnected' | 'terminated'
        sdkVersion?: string
        cliVersion?: string
        cliPath?: string
        reason?: string
      }
    | {
        type: 'background.control'
        taskId: string
        state: 'requested' | 'acknowledged' | 'failed' | 'unconfirmed'
        error?: string
      }
    | {
        type: 'background.output'
        taskId: string
        outputId: string
        snapshot?: BackgroundOutputSnapshot
        error?: string
      }
  )
export type ProviderMessageEvent = Envelope & {
  type: 'provider.message'
  raw: unknown
  interpretationErrors?: string[]
}
export interface BackgroundTerminalEvidence {
  status: string
  source: BackgroundEventSource
  summary?: string
  error?: string
}
export interface BackgroundTaskRecord extends BackgroundTaskIdentity, BackgroundTaskPatch {
  /** A historical observation, independent of the current live snapshot. */
  backgroundObserved?: boolean
  generation: string
  toolUseId?: string
  firstSeenAt: number
  lastSeenAt: number
  liveMembership: 'included' | 'excluded' | 'unknown'
  terminalEvidence: BackgroundTerminalEvidence[]
  stop?: {
    state: 'requested' | 'acknowledged' | 'failed' | 'unconfirmed'
    requestedAt?: number
    updatedAt: number
    error?: string
  }
  outputSnapshots: Record<string, BackgroundOutputSnapshot>
  outputErrors: Record<string, string>
}
export interface BackgroundCallRecord extends BackgroundCallPatch {
  backgroundObserved?: boolean
  launchFailure?: { source: BackgroundEventSource; receipt: unknown }
  generation: string
  toolUseId: string
  toolName?: string
  parentToolUseId?: string
  phase: 'started' | 'progress' | 'returned'
  input?: unknown
  result?: unknown
  structuredOutput?: unknown
  meta?: unknown
  firstSeenAt: number
  lastSeenAt: number
  awaitingTask: boolean
}
export interface BackgroundSessionState {
  generation?: string
  connection: 'connected' | 'resynchronizing' | 'disconnected' | 'terminated'
  liveKnown: boolean
  liveTaskIds: string[]
  tasks: Record<string, BackgroundTaskRecord>
  calls: Record<string, BackgroundCallRecord>
  seenEvents?: Record<string, true>
  retiredGenerations: string[]
  lastSource?: BackgroundEventSource
  sdkVersion?: string
  cliVersion?: string
  cliPath?: string
  reason?: string
}
export interface BackgroundTaskRequest {
  sessionId: string
  generation: string
  taskId: string
}
export interface PromoteBackgroundTaskRequest {
  sessionId: string
  generation: string
  toolUseId: string
}
export interface BackgroundOutputCursor {
  identity: string
  size: number
  mtimeMs: number
}
export interface ReadBackgroundOutputRequest extends BackgroundTaskRequest {
  outputId: string
  offset: number
  maxBytes: number
  view?: 'current' | 'snapshot'
  cursor?: BackgroundOutputCursor
}
export interface ReadBackgroundOutputResponse {
  status: 'partial' | 'available' | 'missing' | 'denied' | 'remote' | 'changed' | 'truncated'
  text?: string
  offset: number
  nextOffset: number
  size?: number
  cursor?: BackgroundOutputCursor
  eof?: boolean
  view: 'current' | 'snapshot'
  error?: string
}
export interface StopAllBackgroundTasksResult {
  residualTaskIds: string[]
  unknown: boolean
}
export function backgroundKey(generation: string, id: string): string {
  return JSON.stringify([generation, id])
}
export function emptyBackgroundState(): BackgroundSessionState {
  return {
    connection: 'disconnected',
    liveKnown: false,
    liveTaskIds: [],
    tasks: {},
    calls: {},
    seenEvents: {},
    retiredGenerations: []
  }
}
export function isBackgroundTerminal(status: string | undefined): boolean {
  return (
    status === 'completed' || status === 'failed' || status === 'killed' || status === 'stopped'
  )
}
export function isShellBackgroundTool(name: string | undefined): boolean {
  return name === 'Bash' || name === 'PowerShell'
}

/** The SDK registers an eligible shell with task_started; elapsed time is not evidence. */
export function canPromoteBackgroundCall(
  state: BackgroundSessionState,
  call: BackgroundCallRecord | undefined
): boolean {
  if (
    !call ||
    !call.toolUseId.trim() ||
    state.connection !== 'connected' ||
    call.generation !== state.generation ||
    !isShellBackgroundTool(call.toolName) ||
    call.phase === 'returned' ||
    isBackgroundTerminal(call.status) ||
    call.backgroundObserved ||
    call.mode === 'background' ||
    call.mode === 'remote'
  )
    return false
  const task = call.taskId ? state.tasks[backgroundKey(call.generation, call.taskId)] : undefined
  return Boolean(
    task &&
    task.toolUseId === call.toolUseId &&
    task.taskType === 'local_bash' &&
    task.status === 'running' &&
    task.isBackgrounded === false &&
    !task.backgroundObserved
  )
}
function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined && v !== null)
  ) as Partial<T>
}
function refs(
  previous: BackgroundOutputRef[] = [],
  incoming: BackgroundOutputRef[] = []
): BackgroundOutputRef[] {
  return [...new Map([...previous, ...incoming].map((ref) => [ref.id, ref])).values()]
}
function freshTask(taskId: string, source: BackgroundEventSource): BackgroundTaskRecord {
  return {
    taskId,
    generation: source.generation,
    firstSeenAt: source.receivedAt,
    lastSeenAt: source.receivedAt,
    liveMembership: 'unknown',
    terminalEvidence: [],
    outputSnapshots: {},
    outputErrors: {}
  }
}
export function backgroundEventKey(event: BackgroundEvent | ProviderMessageEvent): string {
  const { source, ...payload } = event
  return JSON.stringify([source.generation, source.uuid ?? source.sequence, payload])
}
function mergeTask(
  old: BackgroundTaskRecord,
  patch: BackgroundTaskPatch,
  source: BackgroundEventSource
): BackgroundTaskRecord {
  const next = {
    ...old,
    ...defined(patch),
    lastSeenAt: Math.max(old.lastSeenAt, source.receivedAt)
  }
  if (patch.isBackgrounded === true) next.backgroundObserved = true
  if (patch.outputRefs) next.outputRefs = refs(old.outputRefs, patch.outputRefs)
  if (isBackgroundTerminal(patch.status)) {
    next.terminalEvidence = [
      ...old.terminalEvidence,
      {
        status: patch.status!,
        source,
        ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
        ...(patch.error !== undefined ? { error: patch.error } : {})
      }
    ]
  }
  // A later fact can add evidence, but never erase or revive the first terminal result.
  if (old.terminalEvidence.length) next.status = old.terminalEvidence[0].status
  return next
}
export function applyBackgroundEvent(
  state: BackgroundSessionState,
  event: BackgroundEvent
): BackgroundSessionState {
  const eventKey = backgroundEventKey(event)
  if (state.seenEvents?.[eventKey]) return state
  const source = event.source
  // SDK replay remains in the provider journal; it cannot mutate a live generation.
  if (source.replay && state.generation === source.generation) return state
  let next: BackgroundSessionState = {
    ...state,
    tasks: { ...state.tasks },
    calls: { ...state.calls },
    seenEvents: { ...state.seenEvents, [eventKey]: true }
  }
  const oldGeneration = state.generation
  const mayBeCurrent = !source.replay && !state.retiredGenerations.includes(source.generation)
  if (mayBeCurrent && source.generation !== oldGeneration) {
    next = {
      ...next,
      generation: source.generation,
      connection: 'connected',
      liveKnown: false,
      liveTaskIds: [],
      retiredGenerations: oldGeneration
        ? [...state.retiredGenerations, oldGeneration]
        : state.retiredGenerations
    }
    for (const [key, record] of Object.entries(next.tasks)) {
      if (record.generation === oldGeneration)
        next.tasks[key] = { ...record, liveMembership: 'unknown' }
    }
  }
  const current = mayBeCurrent && next.generation === source.generation
  if (current) next.lastSource = source
  if (event.type === 'background.connection') {
    if (!current) return next
    next = {
      ...next,
      connection: event.state,
      ...defined({
        sdkVersion: event.sdkVersion,
        cliVersion: event.cliVersion,
        cliPath: event.cliPath,
        reason: event.reason
      })
    }
    if (event.state !== 'connected') {
      next.liveKnown = false
      for (const [key, record] of Object.entries(next.tasks)) {
        if (record.generation === source.generation)
          next.tasks[key] = { ...record, liveMembership: 'unknown' }
      }
    }
    return next
  }
  if (event.type === 'background.snapshot') {
    const ids = [...new Set(event.tasks.map((item) => item.taskId))]
    if (current) {
      next.liveKnown = true
      next.connection = 'connected'
      next.liveTaskIds = ids
      for (const [key, record] of Object.entries(next.tasks)) {
        if (record.generation === source.generation)
          next.tasks[key] = {
            ...record,
            liveMembership: ids.includes(record.taskId) ? 'included' : 'excluded'
          }
      }
    }
    for (const identity of event.tasks) {
      const key = backgroundKey(source.generation, identity.taskId)
      next.tasks[key] = {
        ...freshTask(identity.taskId, source),
        ...next.tasks[key],
        ...defined(identity),
        backgroundObserved: true,
        ...(current ? { liveMembership: 'included' as const } : {})
      }
      const task = next.tasks[key]
      if (task.toolUseId) {
        const callKey = backgroundKey(source.generation, task.toolUseId)
        const call = next.calls[callKey]
        if (call) next.calls[callKey] = { ...call, backgroundObserved: true }
      }
    }
    return next
  }
  if (event.type === 'background.call') {
    const key = backgroundKey(source.generation, event.toolUseId)
    const old = Object.hasOwn(next.calls, key) ? next.calls[key] : undefined
    const patch = defined(event.patch ?? {})
    let call: BackgroundCallRecord = {
      generation: source.generation,
      toolUseId: event.toolUseId,
      firstSeenAt: source.receivedAt,
      lastSeenAt: source.receivedAt,
      awaitingTask: false,
      ...old,
      ...patch,
      ...defined({
        toolName: event.toolName,
        parentToolUseId: event.parentToolUseId,
        input: event.input,
        result: event.result,
        structuredOutput: event.structuredOutput,
        meta: event.meta
      }),
      phase: event.phase
    }
    if (old?.phase === 'returned' && event.phase !== 'returned') call.phase = 'returned'
    const failedReceipt = [event.structuredOutput, event.result].find(
      (value) =>
        value &&
        typeof value === 'object' &&
        'status' in value &&
        (value.status === 'async_launched' || value.status === 'remote_launched') &&
        'error' in value &&
        value.error
    )
    if (failedReceipt && !call.launchFailure)
      call.launchFailure = { source, receipt: failedReceipt }
    if (call.launchFailure) call.status = 'failed'
    if (event.patch?.outputRefs) call.outputRefs = refs(old?.outputRefs, event.patch.outputRefs)
    if (event.patch?.heartbeat && event.patch.retry === undefined && old?.retry !== undefined)
      call.retry = old.retry
    // null explicitly clears retry; omitted patch fields remain unchanged.
    if (
      event.patch &&
      'retry' in event.patch &&
      event.patch.retry === null &&
      !event.patch.heartbeat
    )
      delete call.retry
    const linked = call.taskId
      ? next.tasks[backgroundKey(source.generation, call.taskId)]
      : Object.values(next.tasks).find(
          (t) => t.generation === source.generation && t.toolUseId === event.toolUseId
        )
    if (linked) call = { ...call, taskId: linked.taskId }
    if (linked?.backgroundObserved || call.mode === 'background' || call.mode === 'remote')
      call.backgroundObserved = true
    call.awaitingTask =
      !call.taskId &&
      (call.status === 'async_launched' ||
        call.status === 'remote_launched' ||
        call.mode === 'background' ||
        call.mode === 'remote') &&
      !isBackgroundTerminal(call.status) &&
      !(
        call.structuredOutput &&
        typeof call.structuredOutput === 'object' &&
        'error' in call.structuredOutput &&
        call.structuredOutput.error
      )
    next.calls[key] = call
    if (call.taskId && (linked || (!call.launchFailure && call.status !== 'failed'))) {
      const taskKey = backgroundKey(source.generation, call.taskId)
      const previous = next.tasks[taskKey] ?? freshTask(call.taskId, source)
      next.tasks[taskKey] = {
        ...previous,
        ...(call.backgroundObserved ? { backgroundObserved: true } : {}),
        toolUseId: event.toolUseId,
        ...defined({ agentId: call.agentId, parentToolUseId: call.parentToolUseId }),
        outputRefs: refs(previous.outputRefs, call.outputRefs)
      }
    }
    return next
  }
  const key = backgroundKey(source.generation, event.taskId)
  let record = next.tasks[key] ?? freshTask(event.taskId, source)
  if (event.type === 'background.task') {
    record = mergeTask(record, event.patch, source)
    if (event.toolUseId !== undefined) record.toolUseId = event.toolUseId
    if (!record.toolUseId) {
      record.toolUseId = Object.values(next.calls).find(
        (call) => call.generation === source.generation && call.taskId === event.taskId
      )?.toolUseId
    }
    // A start can postdate the last snapshot's absence. Only a later snapshot
    // may resolve this uncertainty; progress must not reapply the older absence.
    if (
      current &&
      event.phase === 'started' &&
      !isBackgroundTerminal(record.status) &&
      record.liveMembership === 'excluded'
    )
      record.liveMembership = 'unknown'
    if (record.toolUseId) {
      const callKey = backgroundKey(source.generation, record.toolUseId)
      const call = next.calls[callKey]
      if (call) {
        next.calls[callKey] = {
          ...call,
          taskId: event.taskId,
          awaitingTask: false,
          ...(record.backgroundObserved ? { backgroundObserved: true } : {})
        }
        record = {
          ...record,
          ...(call.backgroundObserved ? { backgroundObserved: true } : {}),
          ...defined({
            agentId: record.agentId ?? call.agentId,
            parentToolUseId: record.parentToolUseId ?? call.parentToolUseId
          }),
          outputRefs: refs(call.outputRefs, record.outputRefs)
        }
      }
    }
  } else if (event.type === 'background.control') {
    record = {
      ...record,
      stop: {
        state: event.state,
        updatedAt: source.receivedAt,
        ...(event.state === 'requested'
          ? { requestedAt: source.receivedAt }
          : record.stop?.requestedAt !== undefined
            ? { requestedAt: record.stop.requestedAt }
            : {}),
        ...(event.error !== undefined ? { error: event.error } : {})
      }
    }
  } else if (event.type === 'background.output') {
    record = {
      ...record,
      outputSnapshots: { ...record.outputSnapshots },
      outputErrors: { ...record.outputErrors }
    }
    if (event.snapshot) record.outputSnapshots[event.outputId] = event.snapshot
    if (event.error !== undefined) record.outputErrors[event.outputId] = event.error
    else if (event.snapshot) delete record.outputErrors[event.outputId]
  }
  next.tasks[key] = record
  return next
}
export function sanitizedBackgroundState(state: BackgroundSessionState): BackgroundSessionState {
  const view = { ...state }
  delete view.seenEvents
  return view
}
export function backgroundPending(state: BackgroundSessionState): boolean {
  if (!state.generation || state.connection === 'terminated') return false
  if (state.connection === 'resynchronizing') return true
  if (state.liveTaskIds.length && state.connection === 'connected') return true
  return (
    Object.values(state.calls).some(
      (call) =>
        call.generation === state.generation &&
        (call.awaitingTask ||
          (!!call.taskId &&
            (call.mode === 'background' || call.mode === 'remote') &&
            state.tasks[backgroundKey(call.generation, call.taskId)]?.liveMembership ===
              'unknown' &&
            !isBackgroundTerminal(
              state.tasks[backgroundKey(call.generation, call.taskId)]?.status
            )))
    ) ||
    Object.values(state.tasks).some(
      (task) =>
        task.generation === state.generation &&
        !isBackgroundTerminal(task.status) &&
        (task.liveMembership === 'included' ||
          (task.liveMembership === 'unknown' && task.status === 'running') ||
          task.stop?.state === 'requested' ||
          task.stop?.state === 'acknowledged')
    )
  )
}
