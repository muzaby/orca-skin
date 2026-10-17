import type { AppMessagePart, LoadedMessage } from '../../../shared/ipc'
import type { NativeHistorySnapshot } from '../../adapters/common/native-history'
import type { NativeMessageBinding } from '../../infra/db/native-history-queries'
import type { LoadedPartRow } from '../../infra/db/types'
import { partFromRow } from '../../infra/ipc/dto'

function toolKey(part: AppMessagePart): string | undefined {
  if (!('toolRunId' in part)) return undefined
  return `${'parentToolRunId' in part ? (part.parentToolRunId ?? '') : ''}\0${part.toolRunId}`
}

export function localMessages(rows: readonly LoadedPartRow[]): LoadedMessage[] {
  const messages = new Map<number, LoadedMessage>()
  for (const row of rows) {
    let message = messages.get(row.message_id)
    if (!message) {
      message = {
        role: row.role,
        createdAt: row.created_at,
        parts: [],
        ...(row.role === 'assistant' && row.complete === 0 ? { incomplete: true } : {})
      }
      messages.set(row.message_id, message)
    }
    message.parts.push(partFromRow(row))
  }
  return [...messages.values()]
}

/** Retains app-owned enrichment without inferring identity from text or timestamps. */
export function projectNativeHistory(
  snapshot: NativeHistorySnapshot,
  rows: readonly LoadedPartRow[],
  bindings: readonly NativeMessageBinding[],
  frontier: number
): { messages: LoadedMessage[]; orphaned: boolean } {
  const messages: LoadedMessage[] = snapshot.messages.map(
    ({ role, createdAt, incomplete, parts }) => ({
      role,
      createdAt,
      ...(incomplete ? { incomplete } : {}),
      parts: parts.map((part) => ({ ...part }))
    })
  )
  const nativeIds = new Map<string, number>()
  snapshot.messages.forEach((message, index) => {
    for (const id of new Set([message.id, ...(message.sourceIds ?? [])])) nativeIds.set(id, index)
  })
  const localTargets = new Map<number, number[]>()
  for (const binding of bindings) {
    const target = nativeIds.get(binding.native_message_id)
    if (target === undefined) continue
    const targets = localTargets.get(binding.message_id) ?? []
    if (!targets.includes(target)) targets.push(target)
    localTargets.set(
      binding.message_id,
      targets.sort((a, b) => a - b)
    )
  }
  const calls = new Map<
    string,
    { index: number; part: Extract<AppMessagePart, { type: 'tool_call' }> }
  >()
  const results = new Map<string, Extract<AppMessagePart, { type: 'tool_result' }>>()
  messages.forEach((message, index) => {
    for (const part of message.parts) {
      if (part.type === 'tool_call') calls.set(toolKey(part)!, { index, part })
      if (part.type === 'tool_result') results.set(toolKey(part)!, part)
    }
  })
  const orphanRows: LoadedPartRow[] = []
  const replacedAttachments = new Set<number>()
  const append = (index: number, part: AppMessagePart): void => {
    // This compares already-identified sidecars, never message identity.
    const key = JSON.stringify(part)
    if (!messages[index].parts.some((existing) => JSON.stringify(existing) === key)) {
      if (part.type === 'response_boundary' && part.boundary.phase === 'begin')
        messages[index].parts.unshift(part)
      else messages[index].parts.push(part)
    }
  }
  for (const row of rows) {
    if (row.message_id > frontier) continue
    const part = partFromRow(row)
    const targets = localTargets.get(row.message_id)
    const key = toolKey(part)
    const parent = 'parentToolRunId' in part ? part.parentToolRunId : undefined
    // Native parent histories can omit child records. Keep the child transcript under its exact call.
    if (
      parent &&
      !(part.type === 'tool_call' && calls.has(key!)) &&
      !(part.type === 'tool_result' && results.has(key!))
    ) {
      const target = calls.get(`\0${parent}`)
      if (target) append(target.index, part)
      else orphanRows.push(row)
      continue
    }
    if (part.type === 'tool_call') {
      const target = key ? calls.get(key) : undefined
      if (target && part.toolName === 'ExitPlanMode') target.part.args = part.args
      continue
    }
    if (part.type === 'tool_result') {
      const target = key ? results.get(key) : undefined
      const call = key ? calls.get(key) : undefined
      const questionAnswer =
        call?.part.toolName === 'AskUserQuestion' &&
        part.result &&
        typeof part.result === 'object' &&
        'answers' in part.result
      if (target) {
        for (const field of [
          'structuredOutput',
          'nonExecution',
          'subagentMeta',
          'durationMs'
        ] as const) {
          if (part[field] !== undefined && target[field] === undefined)
            Object.assign(target, { [field]: part[field] })
        }
        if (questionAnswer) {
          target.result = part.result
        }
      } else if (questionAnswer && call) {
        append(call.index, part)
      }
      continue
    }
    const isSidecar =
      part.type === 'attachment' ||
      part.type === 'diff_requirements' ||
      part.type === 'artifact' ||
      part.type === 'response_boundary' ||
      part.type === 'fork_boundary' ||
      part.type === 'subagent_notice'
    if (!isSidecar) continue
    const toolTarget = row.tool_run_id ? calls.get(`\0${row.tool_run_id}`)?.index : undefined
    const target =
      toolTarget ??
      (part.type === 'response_boundary' && part.boundary.phase === 'begin'
        ? targets?.[0]
        : targets?.at(-1))
    if (target === undefined) {
      orphanRows.push(row)
      continue
    }
    if (part.type === 'attachment' && !replacedAttachments.has(target)) {
      // The local receipt carries preview URLs and file ownership absent from the native record.
      messages[target].parts = messages[target].parts.filter(
        (existing) => existing.type !== 'attachment'
      )
      replacedAttachments.add(target)
    }
    append(target, part)
  }
  return {
    messages: [
      ...messages,
      ...localMessages(orphanRows),
      ...localMessages(rows.filter((row) => row.message_id > frontier))
    ],
    orphaned: orphanRows.length > 0
  }
}
