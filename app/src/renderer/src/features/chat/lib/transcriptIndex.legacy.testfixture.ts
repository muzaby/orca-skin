/**
 * Legacy full-scan panel derivation functions preserved strictly as a test oracle
 * for property-test equivalence against `transcriptIndex.ts` (EP-14 ③ · VP-32 x1~x9).
 * Production code must never import this file.
 */
import { isAbsolutePath, isFilesystemRoot } from '../../../../../shared/absolute-path'
import type {
  BackgroundCallRecord,
  BackgroundSessionState
} from '../../../../../shared/background-task'
import { directoryIdentity } from '../../../../../shared/extra-directories'
import { childMessageId } from '../../../../../shared/message-id'
import { isRecord } from '../../../../../shared/obj'
import { PRODUCT_SLUG } from '../../../../../shared/product'
import {
  isTaskToolName,
  readTaskToolObservation,
  type AgentTaskPatch,
  type AgentTaskStatus
} from '../../../../../shared/task-tool'
import type { AppMessagePart } from '../../../../../shared/ipc'
import type { Message } from '../reducer/chatReducer'
import {
  agentModelFromCall,
  deriveSubagentTaskStatus,
  isAgentTaskName,
  isAsyncLaunchedResult,
  partParentToolRunId,
  partsAttachments,
  partsToolCalls,
  resultMap,
  settlementMessageFromCall,
  stripParentToolRunId,
  subagentTypeFromCall,
  tokenCountFromResult,
  toolCallFromPart,
  toolDescriptionFromInput,
  type SubagentTaskSummary
} from './parts'
import { agentTaskKey, type TaskBoardItem } from './taskBoard'
import type { TranscriptResults } from './canonicalBackground'
import type { TaskContextSource } from './taskContext'
import { workSearchResults, workToolPresentation } from './workToolPresentation'
import { describeTool } from '../harnesses/opencode/toolPresentation'
import type { SessionPanelModel } from '../harnesses/opencode/rightpanel/model'

export function childMessageForParentToolRunId(
  messages: readonly Message[],
  parentToolRunId: string
): Message | null {
  const parts: AppMessagePart[] = []
  for (const message of messages) {
    for (const part of message.parts) {
      if (partParentToolRunId(part) === parentToolRunId) {
        parts.push(stripParentToolRunId(part))
      }
    }
  }
  if (parts.length === 0) return null
  return { id: childMessageId(parentToolRunId), role: 'assistant', createdAt: 0, parts }
}

export function subagentTaskDescription(
  messages: readonly Message[],
  toolUseId: string
): string | undefined {
  for (const message of messages) {
    for (const part of message.parts) {
      if (
        part.type === 'tool_call' &&
        part.parentToolRunId === undefined &&
        part.toolRunId === toolUseId &&
        isAgentTaskName(part.toolName)
      ) {
        return toolDescriptionFromInput(part.args) ?? part.toolName
      }
    }
  }
  return undefined
}

export function subagentTasksFromMessages(
  messages: readonly Message[],
  includeNested = false
): readonly SubagentTaskSummary[] {
  const allParts = messages.flatMap((m) => m.parts)
  const resultByRun = resultMap(allParts)
  const createdAtByRun = new Map<string, number>()
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === 'tool_call' && (includeNested || part.parentToolRunId === undefined)) {
        createdAtByRun.set(part.toolRunId, message.createdAt)
      }
    }
  }
  const childCounts = new Map<string, number>()
  const currentChild = new Map<string, string>()
  for (const part of allParts) {
    if (part.type === 'tool_call' && part.parentToolRunId !== undefined) {
      childCounts.set(part.parentToolRunId, (childCounts.get(part.parentToolRunId) ?? 0) + 1)
      if (!resultByRun.has(part.toolRunId)) currentChild.set(part.parentToolRunId, part.toolName)
    }
  }
  const summaries: SubagentTaskSummary[] = []
  for (const part of allParts) {
    if (
      part.type === 'tool_call' &&
      (includeNested || part.parentToolRunId === undefined) &&
      isAgentTaskName(part.toolName)
    ) {
      const call = toolCallFromPart(part, resultByRun)
      const meta = call.result?.subagentMeta
      const toolCount = meta?.toolUses ?? childCounts.get(call.toolUseId) ?? 0
      summaries.push({
        toolUseId: call.toolUseId,
        description: toolDescriptionFromInput(call.input) ?? call.name,
        status: deriveSubagentTaskStatus(call),
        createdAtMs: createdAtByRun.get(call.toolUseId) ?? 0,
        childToolCount: toolCount,
        durationMs: meta?.durationMs ?? call.result?.durationMs ?? null,
        tokenCount: tokenCountFromResult(call.result?.output),
        agentLabel: agentModelFromCall(call),
        subagentType: subagentTypeFromCall(call),
        currentChildLabel: currentChild.get(call.toolUseId) ?? null,
        settlementMessage: settlementMessageFromCall(call),
        asyncLaunched: isAsyncLaunchedResult(call.result),
        call
      })
    }
  }
  return summaries
}

interface AgentEntry {
  id: string
  subject?: string
  description?: string
  status: AgentTaskStatus
  blockedBy: string[]
  activeForm?: string
}

function applyPatch(entry: AgentEntry, patch: AgentTaskPatch): void {
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

function ensureEntry(entries: Map<string, AgentEntry>, id: string): AgentEntry {
  let entry = entries.get(id)
  if (!entry) {
    entry = { id, status: 'pending', blockedBy: [] }
    entries.set(id, entry)
  }
  return entry
}

export function taskBoardFromMessages(messages: readonly Message[]): TaskBoardItem[] {
  const entries = new Map<string, AgentEntry>()
  const resultByRun = resultMap(messages.flatMap((message) => message.parts))
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== 'tool_call' || part.parentToolRunId !== undefined) continue
      if (!isTaskToolName(part.toolName)) continue
      const paired = resultByRun.get(part.toolRunId)
      if (!paired) continue
      const observation = readTaskToolObservation({
        toolName: part.toolName,
        args: part.args,
        structuredOutput: paired.structuredOutput,
        isError: paired.isError
      })
      if (!observation) continue
      switch (observation.kind) {
        case 'created':
        case 'upserted':
          applyPatch(ensureEntry(entries, observation.id), observation.patch)
          applyReverseBlocks(entries, observation.id, observation.patch.addBlocks)
          break
        case 'removed':
          entries.delete(observation.id)
          break
        case 'snapshot': {
          const seen = new Set(observation.tasks.map((task) => task.id))
          for (const id of [...entries.keys()]) if (!seen.has(id)) entries.delete(id)
          for (const task of observation.tasks)
            applyPatch(ensureEntry(entries, task.id), task.patch)
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

export function taskBoardForMessages(messages: readonly Message[]): TaskBoardItem[] {
  return taskBoardFromMessages(messages)
}

export function transcriptResultsByToolUseId(messages: readonly Message[]): TranscriptResults {
  return resultMap(messages.flatMap((message) => message.parts))
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

export function createTaskContextSourceSelector(): (
  messages: readonly Message[]
) => TaskContextSource[] {
  return (messages) => {
    const results = resultMap(messages.flatMap((m) => m.parts))
    const sources = new Map<string, TaskContextSource>()
    for (const message of messages) {
      const attachments = message.role === 'user' ? partsAttachments(message.parts) : []
      for (const attachment of attachments) {
        const path = attachment.path
        const localPath = path && isAbsolutePath(path) && !isFilesystemRoot(path) ? path : undefined
        if (localPath && isInternalClaudeSource(localPath)) continue
        const key = localPath
          ? `file:${directoryIdentity(localPath)}`
          : `attachment:${attachment.id}`
        if (sources.get(key)?.kind === 'attachment') continue
        sources.set(key, {
          kind: 'attachment',
          attachmentId: attachment.id,
          name: attachment.name,
          image: attachment.kind === 'image',
          ...(localPath ? { path: localPath } : {})
        })
      }
      const calls = partsToolCalls(message.parts).filter((call) =>
        ['WebFetch', 'WebSearch', 'Read', 'ReadFile', 'read_file'].includes(call.name)
      )
      for (const original of calls) {
        const call = { ...original, result: results.get(original.toolUseId) }
        if (workToolPresentation(call).status !== 'completed') continue
        if (call.name === 'WebSearch') {
          for (const link of workSearchResults(call)) {
            const url = webUrl(link.url)
            if (url && !sources.has(`web:${url.href}`))
              sources.set(`web:${url.href}`, { kind: 'web', url: url.href, title: link.title })
          }
        } else if (call.name === 'WebFetch') {
          const url = webUrl(isRecord(call.input) ? call.input.url : undefined)
          if (url && !sources.has(`web:${url.href}`))
            sources.set(`web:${url.href}`, {
              kind: 'web',
              url: url.href,
              title: url.hostname + (url.pathname === '/' ? '' : url.pathname)
            })
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
}

export function sessionPanelModel(
  messages: readonly Message[],
  background?: BackgroundSessionState
): SessionPanelModel {
  const calls = Object.values(background?.calls ?? {})
  const latestCalls = new Map<string, BackgroundCallRecord>()
  for (const call of calls) {
    const previous = latestCalls.get(call.toolUseId)
    if (!previous || call.lastSeenAt > previous.lastSeenAt) latestCalls.set(call.toolUseId, call)
  }
  const latest = (id: string): BackgroundCallRecord | undefined => latestCalls.get(id)
  const agents = subagentTasksFromMessages(messages, true).map((agent) => ({
    ...agent,
    model: latest(agent.toolUseId)?.model
  }))
  const parts = messages
    .flatMap((message) => message.parts)
    .map((part) => {
      if (!('parentToolRunId' in part)) return part
      const copy = { ...part }
      delete copy.parentToolRunId
      return copy
    })
  const processes = partsToolCalls(parts)
    .filter((call) => call.name === 'Bash')
    .map((call) => {
      const observed = latest(call.toolUseId)
      const view = describeTool(call)
      const raw = call.result ? call.result.output : observed?.result
      const text = typeof raw === 'string' ? raw : raw == null ? '' : JSON.stringify(raw, null, 2)
      // eslint-disable-next-line no-control-regex
      const output = text.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
      return {
        id: call.toolUseId,
        command: view.command ?? view.subtitle,
        status: view.outcome,
        output: output.slice(-65536),
        truncated:
          output.length > 65536 ||
          (!call.result &&
            !!(
              observed?.meta &&
              typeof observed.meta === 'object' &&
              'truncated' in observed.meta &&
              observed.meta.truncated
            )),
        call
      }
    })
  return { agents, processes }
}
