/**
 * Incremental transcript panel index (EP-13 · D-033 · D-053).
 *
 * Keyed by `state.transcriptChanges.lineage`. Advances via `changesSince` + `foldChanges`,
 * retracting per-message contributions from `partsFrom` onward and re-extracting only
 * touched messages. Bumps `domainRevision` / `parentRevision` only when the derived
 * value actually changes, returning immutable cached snapshots.
 */
import { isAbsolutePath, isFilesystemRoot } from '../../../../../shared/absolute-path'
import type {
  BackgroundCallRecord,
  BackgroundSessionState
} from '../../../../../shared/background-task'
import { directoryIdentity } from '../../../../../shared/extra-directories'
import type { AppMessagePart, AttachmentView } from '../../../../../shared/ipc'
import { childMessageId } from '../../../../../shared/message-id'
import { isRecord } from '../../../../../shared/obj'
import { PRODUCT_SLUG } from '../../../../../shared/product'
import {
  isTaskToolName,
  readTaskToolObservation,
  type AgentTaskPatch,
  type AgentTaskStatus
} from '../../../../../shared/task-tool'
import type { ChatState, Message, ToolCall } from '../reducer/chatReducer'
import { changesSince, foldChanges, type TranscriptRevision } from './transcript/changeLog'
import { messageOrderFor } from './transcript/messageOrder'
import {
  agentModelFromCall,
  deriveSubagentTaskStatus,
  isAgentTaskName,
  isAsyncLaunchedResult,
  partParentToolRunId,
  settlementMessageFromCall,
  stripParentToolRunId,
  subagentTypeFromCall,
  tokenCountFromResult,
  toolCallFromPart,
  toolDescriptionFromInput,
  toolResultFromPart,
  type SubagentTaskSummary
} from './parts'
import { agentTaskKey, type TaskBoardItem } from './taskBoard'
import type { TranscriptResults } from './canonicalBackground'
import type { TaskContextSource } from './taskContext'
import { workSearchResults, workToolPresentation } from './workToolPresentation'
import { describeTool } from '../harnesses/opencode/toolPresentation'
import type { SessionPanelModel } from '../harnesses/opencode/rightpanel/model'

export type TranscriptIndexDomain =
  | 'taskBoard'
  | 'taskContextSources'
  | 'subagentTasks'
  | 'subagentTasksNested'
  | 'transcriptResults'
  | 'persistedBackgroundModels'
  | 'openCodeProcesses'

const CONTEXT_TOOL_NAMES = new Set(['WebFetch', 'WebSearch', 'Read', 'ReadFile', 'read_file'])

interface ToolCallContribution {
  partIndex: number
  part: Extract<AppMessagePart, { type: 'tool_call' }>
  createdAt: number
}

interface ToolResultContribution {
  partIndex: number
  toolRunId: string
  result: NonNullable<ToolCall['result']>
}

interface ChildPartContribution {
  partIndex: number
  parentToolRunId: string
  strippedPart: AppMessagePart
}

interface AttachmentContribution {
  partIndex: number
  attachment: AttachmentView
}

interface PersistedModelContribution {
  partIndex: number
  toolRunId: string
  model: string
}

interface MessageContribution {
  id: string
  toolCalls: ToolCallContribution[]
  toolResults: ToolResultContribution[]
  childParts: ChildPartContribution[]
  userAttachments: AttachmentContribution[]
  persistedModels: PersistedModelContribution[]
}

function emptyContribution(id: string): MessageContribution {
  return {
    id,
    toolCalls: [],
    toolResults: [],
    childParts: [],
    userAttachments: [],
    persistedModels: []
  }
}

interface DirtyFlags {
  taskBoard: boolean
  taskContextSources: boolean
  subagentTasks: boolean
  subagentTasksNested: boolean
  transcriptResults: boolean
  persistedBackgroundModels: boolean
  openCodeProcesses: boolean
  parents: Set<string>
}

function createDirtyFlags(all = false): DirtyFlags {
  return {
    taskBoard: all,
    taskContextSources: all,
    subagentTasks: all,
    subagentTasksNested: all,
    transcriptResults: all,
    persistedBackgroundModels: all,
    openCodeProcesses: all,
    parents: new Set<string>()
  }
}

function markCallDirty(
  flags: DirtyFlags,
  part: Extract<AppMessagePart, { type: 'tool_call' }>
): void {
  if (part.parentToolRunId !== undefined) {
    flags.subagentTasks = true
    flags.subagentTasksNested = true
    flags.parents.add(part.parentToolRunId)
  }
  if (isAgentTaskName(part.toolName)) {
    flags.subagentTasksNested = true
    if (part.parentToolRunId === undefined) {
      flags.subagentTasks = true
      flags.parents.add(part.toolRunId)
    }
  }
  if (part.parentToolRunId === undefined && isTaskToolName(part.toolName)) {
    flags.taskBoard = true
  }
  if (part.parentToolRunId === undefined && CONTEXT_TOOL_NAMES.has(part.toolName)) {
    flags.taskContextSources = true
  }
  if (part.toolName === 'Bash') {
    flags.openCodeProcesses = true
  }
}

function markResultDirty(flags: DirtyFlags): void {
  flags.transcriptResults = true
  flags.taskBoard = true
  flags.taskContextSources = true
  flags.subagentTasks = true
  flags.subagentTasksNested = true
  flags.openCodeProcesses = true
}

function markContributionDirty(flags: DirtyFlags, c: MessageContribution, partsFrom: number): void {
  for (const tc of c.toolCalls) {
    if (tc.partIndex >= partsFrom) markCallDirty(flags, tc.part)
  }
  for (const tr of c.toolResults) {
    if (tr.partIndex >= partsFrom) markResultDirty(flags)
  }
  for (const cp of c.childParts) {
    if (cp.partIndex >= partsFrom) flags.parents.add(cp.parentToolRunId)
  }
  for (const att of c.userAttachments) {
    if (att.partIndex >= partsFrom) flags.taskContextSources = true
  }
  for (const pm of c.persistedModels) {
    if (pm.partIndex >= partsFrom) flags.persistedBackgroundModels = true
  }
}

function extractPartsInto(
  contrib: MessageContribution,
  message: Message,
  partsFrom: number,
  flags: DirtyFlags
): void {
  for (let i = partsFrom; i < message.parts.length; i++) {
    const part = message.parts[i]
    const parentId = partParentToolRunId(part)
    if (parentId !== undefined) {
      contrib.childParts.push({
        partIndex: i,
        parentToolRunId: parentId,
        strippedPart: stripParentToolRunId(part)
      })
      flags.parents.add(parentId)
    }
    if (part.type === 'tool_call') {
      contrib.toolCalls.push({ partIndex: i, part, createdAt: message.createdAt })
      markCallDirty(flags, part)
    } else if (part.type === 'tool_result') {
      const paired = toolResultFromPart(part)
      contrib.toolResults.push({ partIndex: i, toolRunId: part.toolRunId, result: paired })
      markResultDirty(flags)
      if (part.subagentMeta?.model) {
        contrib.persistedModels.push({
          partIndex: i,
          toolRunId: part.toolRunId,
          model: part.subagentMeta.model
        })
        flags.persistedBackgroundModels = true
      }
    } else if (part.type === 'attachment' && message.role === 'user') {
      for (const attachment of part.attachments) {
        contrib.userAttachments.push({ partIndex: i, attachment })
      }
      flags.taskContextSources = true
    }
  }
}

function retractPartsFrom(contrib: MessageContribution, partsFrom: number): void {
  if (partsFrom <= 0) {
    contrib.toolCalls.length = 0
    contrib.toolResults.length = 0
    contrib.childParts.length = 0
    contrib.userAttachments.length = 0
    contrib.persistedModels.length = 0
    return
  }
  contrib.toolCalls = contrib.toolCalls.filter((x) => x.partIndex < partsFrom)
  contrib.toolResults = contrib.toolResults.filter((x) => x.partIndex < partsFrom)
  contrib.childParts = contrib.childParts.filter((x) => x.partIndex < partsFrom)
  contrib.userAttachments = contrib.userAttachments.filter((x) => x.partIndex < partsFrom)
  contrib.persistedModels = contrib.persistedModels.filter((x) => x.partIndex < partsFrom)
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== typeof b || a === null || b === null) return false
  if (typeof a !== 'object') return false
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false
    for (const [k, v] of a) {
      if (!b.has(k) || !deepEqual(v, b.get(k))) return false
    }
    return true
  }
  if (Array.isArray(b) || b instanceof Map) return false
  const recA = a as Record<string, unknown>
  const recB = b as Record<string, unknown>
  const keysA = Object.keys(recA)
  const keysB = Object.keys(recB)
  if (keysA.length !== keysB.length) return false
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(recB, key)) return false
    if (!deepEqual(recA[key], recB[key])) return false
  }
  return true
}

function webUrl(value: unknown): URL | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      return undefined
    url.hash = ''
    return url
  } catch {
    return undefined
  }
}

function isInternalClaudeSource(path: string): boolean {
  const segments: string[] = []
  for (const segment of directoryIdentity(path).split('/')) {
    if (segment === '.') continue
    if (segment === '..') segments.pop()
    else segments.push(segment)
  }
  const normalized = `${segments.join('/')}/`
  return normalized.includes(`/appdata/local/temp/${PRODUCT_SLUG}/claude/`)
}

interface AgentEntry {
  id: string
  subject?: string
  description?: string
  status: AgentTaskStatus
  blockedBy: string[]
  activeForm?: string
}

function applyTaskPatch(entry: AgentEntry, patch: AgentTaskPatch): void {
  if (patch.subject !== undefined) entry.subject = patch.subject
  if (patch.description !== undefined) entry.description = patch.description
  if (patch.status !== undefined) entry.status = patch.status
  if (patch.blockedBy !== undefined) entry.blockedBy = patch.blockedBy
  if (patch.addBlockedBy !== undefined) {
    entry.blockedBy = [...new Set([...entry.blockedBy, ...patch.addBlockedBy])]
  }
  if (patch.activeForm !== undefined) entry.activeForm = patch.activeForm
}

function applyReverseBlocks(
  entries: Map<string, AgentEntry>,
  sourceId: string,
  addBlocks: string[] | undefined
): void {
  if (!addBlocks) return
  for (const targetId of addBlocks) {
    if (targetId === sourceId) continue
    const target = entries.get(targetId)
    if (!target) continue
    target.blockedBy = [...new Set([...target.blockedBy, sourceId])]
  }
}

function ensureTaskEntry(entries: Map<string, AgentEntry>, id: string): AgentEntry {
  let entry = entries.get(id)
  if (!entry) {
    entry = { id, status: 'pending', blockedBy: [] }
    entries.set(id, entry)
  }
  return entry
}

export interface TranscriptIndex {
  readonly domainRevision: Readonly<Record<TranscriptIndexDomain, number>>
  readonly parentRevision: ReadonlyMap<string, number>
  taskBoard(): readonly TaskBoardItem[]
  taskContextSources(): readonly TaskContextSource[]
  subagentTasks(includeNested?: boolean): readonly SubagentTaskSummary[]
  taskDescription(toolUseId: string): string | undefined
  childMessage(parentToolRunId: string): Message | null
  transcriptResults(): TranscriptResults
  backgroundModels(): ReadonlyMap<string, string>
  openCodePanelModel(background?: BackgroundSessionState): SessionPanelModel
}

class TranscriptIndexImpl implements TranscriptIndex {
  private cursor: TranscriptRevision | undefined
  private byMessage = new Map<string, MessageContribution>()
  private order: ReturnType<typeof messageOrderFor> | undefined

  readonly domainRevision: Record<TranscriptIndexDomain, number> = {
    taskBoard: 0,
    taskContextSources: 0,
    subagentTasks: 0,
    subagentTasksNested: 0,
    transcriptResults: 0,
    persistedBackgroundModels: 0,
    openCodeProcesses: 0
  }

  readonly parentRevision = new Map<string, number>()

  private cachedTaskBoard: readonly TaskBoardItem[] = []
  private cachedTaskContextSources: readonly TaskContextSource[] = []
  private cachedSubagentTasks: readonly SubagentTaskSummary[] = []
  private cachedSubagentTasksNested: readonly SubagentTaskSummary[] = []
  private cachedTranscriptResults: TranscriptResults = new Map()
  private cachedPersistedModels: ReadonlyMap<string, string> = new Map()
  private cachedBashCalls: readonly ToolCall[] = []
  private cachedChildMessages = new Map<string, Message | null>()
  private cachedTaskDescriptions = new Map<string, string | undefined>()

  private lastSessionPanelKey: {
    agentsRev: number
    procRev: number
    background: BackgroundSessionState | undefined
    value: SessionPanelModel
  } | null = null

  private lastMessages: readonly Message[] | null = null

  advance(state: ChatState): void {
    const order = messageOrderFor(state)
    this.order = order
    const rawDiff = changesSince(state.transcriptChanges, this.cursor)
    const diff =
      rawDiff !== 'reset' && rawDiff.length === 0 && this.lastMessages !== state.messages
        ? 'reset'
        : rawDiff

    if (diff === 'reset') {
      const flags = createDirtyFlags(true)
      for (const prev of this.byMessage.values()) {
        for (const cp of prev.childParts) flags.parents.add(cp.parentToolRunId)
        for (const tc of prev.toolCalls) {
          if (tc.part.parentToolRunId === undefined && isAgentTaskName(tc.part.toolName)) {
            flags.parents.add(tc.part.toolRunId)
          }
        }
      }
      this.byMessage.clear()
      for (const message of state.messages) {
        const id = message.id
        if (!id) continue
        const contrib = emptyContribution(id)
        extractPartsInto(contrib, message, 0, flags)
        this.byMessage.set(id, contrib)
      }
      this.cursor = {
        lineage: state.transcriptChanges.lineage,
        revision: state.transcriptChanges.revision
      }
      this.lastMessages = state.messages
      this.recomputeDirty(flags, true)
      return
    }

    if (diff.length === 0) return

    const flags = createDirtyFlags(false)
    const folded = foldChanges(diff)
    let hadResetInFold = false
    for (const c of diff) {
      if (c.kind === 'reset') {
        hadResetInFold = true
        break
      }
    }

    if (hadResetInFold) {
      // Fall back to full rebuild when a reset occurred within the window.
      this.cursor = undefined
      this.advance(state)
      return
    }

    for (const [id, partsFrom] of folded) {
      const existing = this.byMessage.get(id)
      const pos = order.messagePosition(id)
      const message = pos >= 0 ? state.messages[pos] : undefined

      if (!message || partsFrom === Infinity) {
        if (existing) {
          markContributionDirty(flags, existing, 0)
          this.byMessage.delete(id)
        }
        continue
      }

      if (!existing) {
        const contrib = emptyContribution(id)
        extractPartsInto(contrib, message, 0, flags)
        this.byMessage.set(id, contrib)
      } else {
        markContributionDirty(flags, existing, partsFrom)
        retractPartsFrom(existing, partsFrom)
        extractPartsInto(existing, message, partsFrom, flags)
      }
    }

    this.cursor = {
      lineage: state.transcriptChanges.lineage,
      revision: state.transcriptChanges.revision
    }
    this.lastMessages = state.messages
    this.recomputeDirty(flags, false)
  }

  private orderedContributions(): MessageContribution[] {
    const order = this.order
    const list = [...this.byMessage.values()]
    if (!order) return list
    list.sort((a, b) => order.messagePosition(a.id) - order.messagePosition(b.id))
    return list
  }

  private recomputeDirty(flags: DirtyFlags, fullReset: boolean): void {
    const anyDomainDirty =
      flags.transcriptResults ||
      flags.persistedBackgroundModels ||
      flags.taskBoard ||
      flags.taskContextSources ||
      flags.subagentTasks ||
      flags.subagentTasksNested ||
      flags.openCodeProcesses ||
      flags.parents.size > 0

    if (!anyDomainDirty) return

    const ordered = this.orderedContributions()

    if (flags.transcriptResults) {
      const next = new Map<string, NonNullable<ToolCall['result']>>()
      for (const c of ordered) {
        for (const tr of c.toolResults) {
          next.set(tr.toolRunId, tr.result)
        }
      }
      if (!deepEqual(this.cachedTranscriptResults, next)) {
        this.cachedTranscriptResults = next
        this.domainRevision.transcriptResults++
      }
    }

    const resultByRun = this.cachedTranscriptResults

    if (flags.persistedBackgroundModels) {
      const next = new Map<string, string>()
      for (const c of ordered) {
        for (const pm of c.persistedModels) {
          next.set(pm.toolRunId, pm.model)
        }
      }
      if (!deepEqual(this.cachedPersistedModels, next)) {
        this.cachedPersistedModels = next
        this.domainRevision.persistedBackgroundModels++
      }
    }

    if (flags.taskBoard) {
      const next = this.computeTaskBoard(ordered, resultByRun)
      if (!deepEqual(this.cachedTaskBoard, next)) {
        this.cachedTaskBoard = next
        this.domainRevision.taskBoard++
      }
    }

    if (flags.taskContextSources) {
      const next = this.computeTaskContextSources(ordered, resultByRun)
      if (!deepEqual(this.cachedTaskContextSources, next)) {
        this.cachedTaskContextSources = next
        this.domainRevision.taskContextSources++
      }
    }

    if (flags.subagentTasks || flags.subagentTasksNested) {
      const childCounts = new Map<string, number>()
      const currentChild = new Map<string, string>()
      for (const c of ordered) {
        for (const tc of c.toolCalls) {
          if (tc.part.parentToolRunId !== undefined) {
            childCounts.set(
              tc.part.parentToolRunId,
              (childCounts.get(tc.part.parentToolRunId) ?? 0) + 1
            )
            if (!resultByRun.has(tc.part.toolRunId)) {
              currentChild.set(tc.part.parentToolRunId, tc.part.toolName)
            }
          }
        }
      }

      if (flags.subagentTasks) {
        const next = this.computeSubagentTasks(
          ordered,
          resultByRun,
          childCounts,
          currentChild,
          false
        )
        if (!deepEqual(this.cachedSubagentTasks, next)) {
          this.cachedSubagentTasks = next
          this.domainRevision.subagentTasks++
        }
      }

      if (flags.subagentTasksNested) {
        const next = this.computeSubagentTasks(
          ordered,
          resultByRun,
          childCounts,
          currentChild,
          true
        )
        if (!deepEqual(this.cachedSubagentTasksNested, next)) {
          this.cachedSubagentTasksNested = next
          this.domainRevision.subagentTasksNested++
        }
      }
    }

    if (flags.openCodeProcesses) {
      const seenBash = new Set<string>()
      const next: ToolCall[] = []
      for (const c of ordered) {
        for (const tc of c.toolCalls) {
          if (tc.part.toolName !== 'Bash') continue
          if (seenBash.has(tc.part.toolRunId)) continue
          seenBash.add(tc.part.toolRunId)
          const call = toolCallFromPart(tc.part, resultByRun)
          // The process panel flattens shell calls from the whole session.
          delete call.parentToolRunId
          if (call.result?.parentToolRunId !== undefined) {
            call.result = { ...call.result }
            delete call.result.parentToolRunId
          }
          next.push(call)
        }
      }
      if (!deepEqual(this.cachedBashCalls, next)) {
        this.cachedBashCalls = next
        this.domainRevision.openCodeProcesses++
      }
    }

    if (flags.parents.size > 0 || fullReset) {
      const parentsToCheck = fullReset
        ? new Set([
            ...flags.parents,
            ...this.cachedChildMessages.keys(),
            ...this.cachedTaskDescriptions.keys()
          ])
        : flags.parents

      for (const parentId of parentsToCheck) {
        let changed = false

        const parts: AppMessagePart[] = []
        for (const c of ordered) {
          for (const cp of c.childParts) {
            if (cp.parentToolRunId === parentId) parts.push(cp.strippedPart)
          }
        }
        const nextChild: Message | null =
          parts.length === 0
            ? null
            : { id: childMessageId(parentId), role: 'assistant', createdAt: 0, parts }
        const prevChild = this.cachedChildMessages.get(parentId) ?? null
        if (!deepEqual(prevChild, nextChild)) {
          if (nextChild === null) this.cachedChildMessages.delete(parentId)
          else this.cachedChildMessages.set(parentId, nextChild)
          changed = true
        }

        let nextDesc: string | undefined
        outer: for (const c of ordered) {
          for (const tc of c.toolCalls) {
            if (
              tc.part.parentToolRunId === undefined &&
              tc.part.toolRunId === parentId &&
              isAgentTaskName(tc.part.toolName)
            ) {
              nextDesc = toolDescriptionFromInput(tc.part.args) ?? tc.part.toolName
              break outer
            }
          }
        }
        const prevDesc = this.cachedTaskDescriptions.get(parentId)
        if (prevDesc !== nextDesc) {
          if (nextDesc === undefined) this.cachedTaskDescriptions.delete(parentId)
          else this.cachedTaskDescriptions.set(parentId, nextDesc)
          changed = true
        }

        if (changed) {
          this.parentRevision.set(parentId, (this.parentRevision.get(parentId) ?? 0) + 1)
        }
      }
    }
  }

  private computeTaskBoard(
    ordered: readonly MessageContribution[],
    resultByRun: TranscriptResults
  ): readonly TaskBoardItem[] {
    const entries = new Map<string, AgentEntry>()
    const seenCallIds = new Set<string>()
    for (const c of ordered) {
      for (const tc of c.toolCalls) {
        if (tc.part.parentToolRunId !== undefined) continue
        if (!isTaskToolName(tc.part.toolName)) continue
        if (seenCallIds.has(tc.part.toolRunId)) continue
        seenCallIds.add(tc.part.toolRunId)
        const paired = resultByRun.get(tc.part.toolRunId)
        if (!paired) continue
        const observation = readTaskToolObservation({
          toolName: tc.part.toolName,
          args: tc.part.args,
          structuredOutput: paired.structuredOutput,
          isError: paired.isError
        })
        if (!observation) continue
        switch (observation.kind) {
          case 'created':
          case 'upserted':
            applyTaskPatch(ensureTaskEntry(entries, observation.id), observation.patch)
            applyReverseBlocks(entries, observation.id, observation.patch.addBlocks)
            break
          case 'removed':
            entries.delete(observation.id)
            break
          case 'snapshot': {
            const seen = new Set(observation.tasks.map((task) => task.id))
            for (const id of [...entries.keys()]) if (!seen.has(id)) entries.delete(id)
            for (const task of observation.tasks) {
              applyTaskPatch(ensureTaskEntry(entries, task.id), task.patch)
            }
            break
          }
        }
      }
    }
    return [...entries.values()].map((entry) => {
      const subject = entry.subject ?? entry.id
      return {
        key: agentTaskKey(entry.id),
        id: entry.id,
        title: entry.status === 'in_progress' && entry.activeForm ? entry.activeForm : subject,
        subject,
        description: entry.description ?? null,
        status: entry.status,
        blockedBy: entry.blockedBy
      }
    })
  }

  private computeTaskContextSources(
    ordered: readonly MessageContribution[],
    resultByRun: TranscriptResults
  ): readonly TaskContextSource[] {
    const sources = new Map<string, TaskContextSource>()
    const seenCalls = new Set<string>()
    for (const c of ordered) {
      for (const att of c.userAttachments) {
        const path = att.attachment.path
        const localPath = path && isAbsolutePath(path) && !isFilesystemRoot(path) ? path : undefined
        if (localPath && isInternalClaudeSource(localPath)) continue
        const key = localPath
          ? `file:${directoryIdentity(localPath)}`
          : `attachment:${att.attachment.id}`
        if (sources.get(key)?.kind === 'attachment') continue
        sources.set(key, {
          kind: 'attachment',
          attachmentId: att.attachment.id,
          name: att.attachment.name,
          image: att.attachment.kind === 'image',
          ...(localPath ? { path: localPath } : {})
        })
      }
      for (const tc of c.toolCalls) {
        if (tc.part.parentToolRunId !== undefined) continue
        if (!CONTEXT_TOOL_NAMES.has(tc.part.toolName)) continue
        if (seenCalls.has(tc.part.toolRunId)) continue
        seenCalls.add(tc.part.toolRunId)
        const call = toolCallFromPart(tc.part, resultByRun)
        if (workToolPresentation(call).status !== 'completed') continue
        if (call.name === 'WebSearch') {
          for (const link of workSearchResults(call)) {
            const url = webUrl(link.url)
            if (url && !sources.has(`web:${url.href}`)) {
              sources.set(`web:${url.href}`, { kind: 'web', url: url.href, title: link.title })
            }
          }
        } else if (call.name === 'WebFetch') {
          const url = webUrl(isRecord(call.input) ? call.input.url : undefined)
          if (url && !sources.has(`web:${url.href}`)) {
            sources.set(`web:${url.href}`, {
              kind: 'web',
              url: url.href,
              title: url.hostname + (url.pathname === '/' ? '' : url.pathname)
            })
          }
        } else if (isRecord(call.input)) {
          const path = call.input.file_path ?? call.input.path
          if (typeof path !== 'string' || !isAbsolutePath(path) || isFilesystemRoot(path)) continue
          if (isInternalClaudeSource(path)) continue
          const key = `file:${directoryIdentity(path)}`
          if (!sources.has(key)) sources.set(key, { kind: 'file', path })
        }
      }
    }
    return [...sources.values()]
  }

  private computeSubagentTasks(
    ordered: readonly MessageContribution[],
    resultByRun: TranscriptResults,
    childCounts: ReadonlyMap<string, number>,
    currentChild: ReadonlyMap<string, string>,
    includeNested: boolean
  ): readonly SubagentTaskSummary[] {
    const previous = includeNested ? this.cachedSubagentTasksNested : this.cachedSubagentTasks
    const previousById = new Map(previous.map((task) => [task.toolUseId, task]))
    const summaries: SubagentTaskSummary[] = []
    const seenRunIds = new Set<string>()
    for (const c of ordered) {
      for (const tc of c.toolCalls) {
        if (!includeNested && tc.part.parentToolRunId !== undefined) continue
        if (!isAgentTaskName(tc.part.toolName)) continue
        if (seenRunIds.has(tc.part.toolRunId)) continue
        seenRunIds.add(tc.part.toolRunId)
        const call = toolCallFromPart(tc.part, resultByRun)
        const meta = call.result?.subagentMeta
        const toolCount = meta?.toolUses ?? childCounts.get(call.toolUseId) ?? 0
        const summary: SubagentTaskSummary = {
          toolUseId: call.toolUseId,
          description: toolDescriptionFromInput(call.input) ?? call.name,
          status: deriveSubagentTaskStatus(call),
          createdAtMs: tc.createdAt,
          childToolCount: toolCount,
          durationMs: meta?.durationMs ?? call.result?.durationMs ?? null,
          tokenCount: tokenCountFromResult(call.result?.output),
          agentLabel: agentModelFromCall(call),
          subagentType: subagentTypeFromCall(call),
          currentChildLabel: currentChild.get(call.toolUseId) ?? null,
          settlementMessage: settlementMessageFromCall(call),
          asyncLaunched: isAsyncLaunchedResult(call.result),
          call
        }
        const prior = previousById.get(call.toolUseId)
        summaries.push(prior && deepEqual(prior, summary) ? prior : summary)
      }
    }
    return summaries
  }

  taskBoard(): readonly TaskBoardItem[] {
    return this.cachedTaskBoard
  }

  taskContextSources(): readonly TaskContextSource[] {
    return this.cachedTaskContextSources
  }

  subagentTasks(includeNested = false): readonly SubagentTaskSummary[] {
    return includeNested ? this.cachedSubagentTasksNested : this.cachedSubagentTasks
  }

  taskDescription(toolUseId: string): string | undefined {
    return this.cachedTaskDescriptions.get(toolUseId)
  }

  childMessage(parentToolRunId: string): Message | null {
    return this.cachedChildMessages.get(parentToolRunId) ?? null
  }

  transcriptResults(): TranscriptResults {
    return this.cachedTranscriptResults
  }

  backgroundModels(): ReadonlyMap<string, string> {
    return this.cachedPersistedModels
  }

  openCodePanelModel(background?: BackgroundSessionState): SessionPanelModel {
    const agentsRev = this.domainRevision.subagentTasksNested
    const procRev = this.domainRevision.openCodeProcesses
    if (
      this.lastSessionPanelKey &&
      this.lastSessionPanelKey.agentsRev === agentsRev &&
      this.lastSessionPanelKey.procRev === procRev &&
      this.lastSessionPanelKey.background === background
    ) {
      return this.lastSessionPanelKey.value
    }
    const calls = Object.values(background?.calls ?? {})
    const latestCalls = new Map<string, BackgroundCallRecord>()
    for (const call of calls) {
      const previous = latestCalls.get(call.toolUseId)
      if (!previous || call.lastSeenAt > previous.lastSeenAt) latestCalls.set(call.toolUseId, call)
    }
    const latest = (id: string): BackgroundCallRecord | undefined => latestCalls.get(id)
    const agents = this.cachedSubagentTasksNested.map((agent) => ({
      ...agent,
      model: latest(agent.toolUseId)?.model
    }))
    const previousById = new Map(
      this.lastSessionPanelKey?.value.processes.map((row) => [row.id, row])
    )
    const processes = this.cachedBashCalls.map((call) => {
      const observed = latest(call.toolUseId)
      const raw = call.result ? call.result.output : observed?.result
      const text = typeof raw === 'string' ? raw : raw == null ? '' : JSON.stringify(raw, null, 2)
      // Terminal control codes are presentation metadata, never executable content.
      // eslint-disable-next-line no-control-regex
      const output = text.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
      const displayed = output.slice(-65536)
      const truncated =
        output.length > 65536 ||
        (!call.result &&
          !!(
            observed?.meta &&
            typeof observed.meta === 'object' &&
            'truncated' in observed.meta &&
            observed.meta.truncated
          ))
      const prior = previousById.get(call.toolUseId)
      if (
        prior &&
        prior.output === displayed &&
        prior.truncated === truncated &&
        deepEqual(prior.call, call)
      ) {
        return prior
      }
      const view = describeTool(call)
      return {
        id: call.toolUseId,
        command: view.command ?? view.subtitle,
        status: view.outcome,
        output: displayed,
        truncated,
        call
      }
    })
    const value: SessionPanelModel = { agents, processes }
    this.lastSessionPanelKey = { agentsRev, procRev, background, value }
    return value
  }
}

const indexByLineage = new WeakMap<object, TranscriptIndexImpl>()

export function transcriptIndexFor(state: ChatState): TranscriptIndex {
  const lineage = state.transcriptChanges.lineage
  let index = indexByLineage.get(lineage)
  if (!index) {
    index = new TranscriptIndexImpl()
    indexByLineage.set(lineage, index)
  }
  index.advance(state)
  return index
}
