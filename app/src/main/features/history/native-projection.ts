import type { AppMessagePart, LoadedMessage } from '../../../shared/ipc'
import { localRowMessageId, nativeOnlyMessageId, orphanMessageId } from '../../../shared/message-id'
import type { NativeHistorySnapshot } from '../../adapters/common/native-history'
import type { NativeMessageBinding } from '../../infra/db/native-history-queries'
import type { HistoryMessageHeader, LoadedPartRow } from '../../infra/db/types'
import { partFromRow } from '../../infra/ipc/dto'

function toolKey(part: AppMessagePart): string | undefined {
  if (!('toolRunId' in part)) return undefined
  return `${'parentToolRunId' in part ? (part.parentToolRunId ?? '') : ''}\0${part.toolRunId}`
}

function localHeader(row: HistoryMessageHeader): LoadedMessage {
  return {
    id: row.message_key ?? localRowMessageId(row.message_id),
    role: row.role,
    createdAt: row.created_at,
    parts: [],
    ...(row.role === 'assistant' && row.complete === 0 ? { incomplete: true } : {})
  }
}

export function localMessages(
  rows: readonly LoadedPartRow[],
  headers?: readonly HistoryMessageHeader[]
): LoadedMessage[] {
  const messages = new Map<number, LoadedMessage>()
  for (const header of headers ?? []) messages.set(header.message_id, localHeader(header))
  for (const row of rows) {
    let message = messages.get(row.message_id)
    if (!message) {
      message = localHeader(row)
      messages.set(row.message_id, message)
    }
    message.parts.push(partFromRow(row))
  }
  return [...messages.values()]
}

// Insert locally authoritative error rows at their original turn. A native refresh can
// cover a turn without including its terminal error, or collapse several user batches.
function restoreFailureTurns(
  native: LoadedMessage[],
  rows: readonly LoadedPartRow[],
  headers: readonly HistoryMessageHeader[] | undefined,
  targets: ReadonlyMap<number, number[]>,
  frontier: number
): { messages: LoadedMessage[]; restored: Set<number> } {
  const restored = new Set<number>()
  if (!rows.some((row) => row.type === 'error')) return { messages: native, restored }
  const ordered = [...new Map((headers ?? rows).map((row) => [row.message_id, row])).values()]
  const localKeys = ordered.map((row) => row.message_key ?? localRowMessageId(row.message_id))
  const failureOwners = new Map<number, string | undefined>()
  for (const row of rows) {
    if (row.type !== 'error') continue
    const part = partFromRow(row)
    if (part.type === 'error') failureOwners.set(row.message_id, part.failure?.ownerUserMessageKey)
  }
  const userPositions = new Map<string, number>()
  const errorGroups: Array<{ assistant: number; owner: number }> = []
  const needed = new Set<number>()
  let legacyOwner = -1
  for (const [i, row] of ordered.entries()) {
    if (row.role === 'user') {
      legacyOwner = i
      userPositions.set(localKeys[i], i)
    }
    if (!failureOwners.has(row.message_id)) continue
    const ownerKey = failureOwners.get(row.message_id)
    const owner = ownerKey === undefined ? legacyOwner : (userPositions.get(ownerKey) ?? -1)
    if (row.message_id > frontier && (owner < 0 || ordered[owner].message_id > frontier)) continue
    errorGroups.push({ assistant: i, owner })
    needed.add(row.message_id)
    if (owner >= 0) needed.add(ordered[owner].message_id)
  }
  if (!errorGroups.length) return { messages: native, restored }
  const local = new Map(
    localMessages(
      rows.filter((row) => needed.has(row.message_id)),
      headers?.filter((row) => needed.has(row.message_id))
    ).map((message) => [message.id, message])
  )
  const before = new Map<number, LoadedMessage[]>()
  function insert(index: number, position: number): void {
    const id = ordered[index].message_id
    if (restored.has(id)) return
    restored.add(id)
    const list = before.get(position) ?? []
    list.push(local.get(localKeys[index])!)
    before.set(position, list)
  }
  // The next bound local row anchors an entirely missing local turn without guessing
  // identity from text or time. Keep every unrelated native-only turn in native order.
  const nextTargets = new Array<number>(ordered.length)
  let next = native.length
  for (let i = ordered.length - 1; i >= 0; i--) {
    nextTargets[i] = next
    const bound = targets.get(ordered[i].message_id)?.[0]
    if (bound !== undefined) next = bound
  }
  const nextUser = new Array<number>(native.length)
  next = native.length
  for (let i = native.length - 1; i >= 0; i--) {
    nextUser[i] = next
    if (native[i].role === 'user') next = i
  }
  for (const { assistant, owner } of errorGroups) {
    const assistantId = ordered[assistant].message_id
    const target = targets.get(assistantId)?.at(-1)
    const userTarget = owner < 0 ? undefined : targets.get(ordered[owner].message_id)?.at(-1)
    const atOwner =
      target !== undefined &&
      native[target].role === 'assistant' &&
      native[target].id === localKeys[assistant] &&
      (userTarget === undefined || (target > userTarget && target < nextUser[userTarget]))
    const position = atOwner
      ? target
      : userTarget === undefined
        ? nextTargets[assistant]
        : nextUser[userTarget]
    if (owner >= 0 && (userTarget === undefined || native[userTarget].id !== localKeys[owner]))
      insert(owner, position)
    const localParts = local.get(localKeys[assistant])!.parts
    if (atOwner) {
      // This binding proves which native response slot already carries the terminal.
      // Historical raw errors have no occurrence ID; preserve distinct local occurrences.
      const localIds = new Set(
        localParts.flatMap((p) => (p.type === 'error' && p.failure ? [p.failure.failureId] : []))
      )
      const parts: AppMessagePart[] = native[target].parts.filter(
        (p) => p.type !== 'error' || (p.failure && !localIds.has(p.failure.failureId))
      )
      // Keep a failed Work response inside its own begin/end boundary.
      for (const [i, part] of localParts.entries()) {
        if (part.type !== 'error') continue
        const boundaryId = part.failure?.responseBoundaryId
        const following =
          boundaryId === undefined
            ? localParts.slice(i + 1).find((p) => p.type === 'response_boundary')
            : localParts.find(
                (p) =>
                  p.type === 'response_boundary' &&
                  p.boundary.id === boundaryId &&
                  p.boundary.phase === 'end'
              )

        const end =
          following?.type === 'response_boundary'
            ? parts.findIndex(
                (p) =>
                  p.type === 'response_boundary' &&
                  p.boundary.id === following.boundary.id &&
                  p.boundary.phase === following.boundary.phase
              )
            : undefined
        if (end !== undefined && end >= 0) parts.splice(end, 0, part)
        else parts.push(part)
      }
      native[target].parts = parts
      restored.add(assistantId)
    } else {
      // With only an exact user binding, use the local terminal for that user's response
      // and retain native text, tools and messages. No raw error from another turn is touched.
      if (userTarget !== undefined) {
        for (let i = userTarget + 1; i < nextUser[userTarget]; i++)
          if (native[i].role === 'assistant' && native[i].id.startsWith('n:'))
            native[i].parts = native[i].parts.filter(
              (part) => part.type !== 'error' || part.failure
            )
      }
      insert(assistant, position)
    }
  }
  const messages: LoadedMessage[] = []
  for (let i = 0; i <= native.length; i++) {
    for (const message of before.get(i) ?? []) messages.push(message)
    if (i < native.length) messages.push(native[i])
  }
  return { messages, restored }
}

/** Retains app-owned enrichment without inferring identity from text or timestamps. */
export function projectNativeHistory(
  snapshot: NativeHistorySnapshot,
  rows: readonly LoadedPartRow[],
  bindings: readonly NativeMessageBinding[],
  frontier: number,
  headers?: readonly HistoryMessageHeader[]
): { messages: LoadedMessage[]; nativeKeys: string[]; orphaned: boolean } {
  const messages: LoadedMessage[] = snapshot.messages.map(
    ({ id, role, createdAt, incomplete, parts }) => ({
      id: nativeOnlyMessageId(id),
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
  const identityOwners = new Map<number, { rowId: number; id: string }>()
  for (const row of headers ?? rows) {
    if (row.message_id > frontier) continue
    const target = localTargets.get(row.message_id)?.at(-1)
    if (target === undefined) continue
    const owner = identityOwners.get(target)
    if (!owner || row.message_id < owner.rowId) {
      identityOwners.set(target, {
        rowId: row.message_id,
        id: row.message_key ?? localRowMessageId(row.message_id)
      })
    }
  }
  for (const [target, owner] of identityOwners) messages[target].id = owner.id

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
  const failures = restoreFailureTurns(messages, rows, headers, localTargets, frontier)
  const remainingOrphans = orphanRows.filter((row) => !failures.restored.has(row.message_id))
  const inTail = (row: HistoryMessageHeader): boolean =>
    row.message_id > frontier && !failures.restored.has(row.message_id)
  return {
    nativeKeys: messages.map((message) => message.id),
    messages: [
      ...failures.messages,
      ...localMessages(remainingOrphans).map((message) => ({
        ...message,
        id: orphanMessageId(message.id)
      })),
      ...localMessages(rows.filter(inTail), headers?.filter(inTail))
    ],
    orphaned: remainingOrphans.length > 0
  }
}
