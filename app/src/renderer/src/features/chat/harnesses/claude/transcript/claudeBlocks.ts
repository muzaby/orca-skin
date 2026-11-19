/**
 * Incremental block model for Claude transcripts (code & work modes) (EP-7 · EP-8 · EP-9).
 *
 * Maintains an immutable `BlockSnapshot<ClaudeBlock>` backed by `createBlockList` (64-slot chunks),
 * advancing incrementally from `transcriptChanges` via `foldChanges` and `messageOrderFor`.
 */
import type { AppMessagePart } from '../../../../../../../shared/ipc'
import type { Message, ToolCall } from '../../../reducer/chatReducer'
import {
  hasPartsText,
  partsArtifacts,
  partsAttachments,
  partsDiffRequirements,
  partsText,
  toolResultFromPart,
  type MessageSegment
} from '../../../lib/parts'
import { createSegmentCache } from '../../../lib/segmentCache'
import { createWorkProjector, type WorkActivityNode } from '../../../lib/workActivity'
import {
  createBlockList,
  type BlockList,
  type BlockSnapshot
} from '../../../lib/transcript/blockList'
import {
  changesSince,
  foldChanges,
  type TranscriptChanges,
  type TranscriptRevision
} from '../../../lib/transcript/changeLog'
import { messageOrderFor } from '../../../lib/transcript/messageOrder'
import { isTurnStart } from '../../../lib/transcript/turnStart'
import {
  assertUniqueBlockKeys,
  carryPartKeys,
  liveBlockKey,
  partKeyKind,
  PartKeyTracker,
  representativePart,
  toolBlockKey,
  turnArtifactsKey,
  turnMetaKey,
  userBlockKey,
  type MultiPartGroupRef,
  type PartKeyEntry
} from '../../../lib/transcript/blockKeys'
import { getDisclosure, setDisclosure } from '../../../store/disclosureStore'
import type { Turn } from '../../../lib/turns'

export type ClaudeBlockGap = 0 | 8 | 16 | 24

export interface ClaudeUserBlock {
  readonly kind: 'user'
  readonly key: string
  readonly messageId: string
  readonly partKeys: readonly string[]
  readonly turn: Turn
  readonly gap: ClaudeBlockGap
  readonly reserveTarget: boolean
}

export interface ClaudeSegmentBlock {
  readonly kind: 'segment'
  readonly key: string
  readonly messageId: string
  readonly partKeys: readonly string[]
  readonly segment: MessageSegment
  readonly gap: ClaudeBlockGap
}

export interface ClaudeActivityBlock {
  readonly kind: 'activity'
  readonly key: string
  readonly messageId: string
  readonly partKeys: readonly string[]
  readonly items: readonly {
    readonly key: string
    readonly messageId: string
    readonly segment: MessageSegment
  }[]
  readonly toolCount: number
  readonly noteCount: number
  readonly gap: ClaudeBlockGap
}

export interface ClaudeStatusBlock {
  readonly kind: 'status'
  readonly key: string
  readonly messageId: string
  readonly outcome: 'ended' | 'aborted' | 'failed' | 'unknown'
  readonly gap: ClaudeBlockGap
}

export interface ClaudeArtifactsBlock {
  readonly kind: 'artifacts'
  readonly key: string
  readonly messageId: string
  readonly artifacts: ReturnType<typeof partsArtifacts>
  readonly gap: ClaudeBlockGap
}

export interface ClaudeMetaBlock {
  readonly kind: 'meta'
  readonly key: string
  readonly messageId: string
  readonly turn: Turn
  readonly copyable: boolean
  readonly createdAt: number
  readonly forkable: boolean
  readonly gap: ClaudeBlockGap
}

export interface ClaudeLiveBlock {
  readonly kind: 'live'
  readonly key: string
  readonly gap: ClaudeBlockGap
}

export type ClaudeBlock =
  | ClaudeUserBlock
  | ClaudeSegmentBlock
  | ClaudeActivityBlock
  | ClaudeStatusBlock
  | ClaudeArtifactsBlock
  | ClaudeMetaBlock
  | ClaudeLiveBlock

export interface ClaudeTranscriptInput {
  readonly messages: readonly Message[]
  readonly transcriptChanges: TranscriptChanges
}

export interface ClaudeAdvanceOptions {
  readonly showAutomaticFeeds?: boolean
  readonly hasLive?: boolean
  readonly inflight?: boolean
  readonly reserve?: boolean
  readonly forkable?: boolean
}

export interface ClaudeBlockModel {
  advance(state: ClaudeTranscriptInput, options?: ClaudeAdvanceOptions): BlockSnapshot<ClaudeBlock>
  snapshot(): BlockSnapshot<ClaudeBlock>
}

type ToolResult = NonNullable<ToolCall['result']>

interface TurnGroup {
  id: string
  role: 'user' | 'assistant'
  messageIds: string[]
  blockKeys: string[]
  messageBlockKeys: Map<string, string[]>
  artifactsKey?: string
  metaKey?: string
}

function filterVisibleMessage(message: Message, showAutomaticFeeds: boolean): Message | undefined {
  if (message.role !== 'user') return message
  const parts = message.parts.filter((part) => {
    if (part.type !== 'text' || !part.origin) return true
    return showAutomaticFeeds
  })
  if (parts.length === message.parts.length) return message
  const hasContent =
    partsText(parts).trim() || partsAttachments(parts).length || partsDiffRequirements(parts).length
  return hasContent ? { ...message, parts } : undefined
}

interface MessageScanCache {
  hasBoundary: boolean
  hasText: boolean
  artifactParts: Extract<AppMessagePart, { type: 'artifact' }>[]
}

const messageScanCache = new WeakMap<Message, MessageScanCache>()

function scanMessage(message: Message): MessageScanCache {
  const cached = messageScanCache.get(message)
  if (cached) return cached
  const parts = message.parts
  let hasBoundary = false
  const artifactParts: Extract<AppMessagePart, { type: 'artifact' }>[] = []
  for (const p of parts) {
    if (p.type === 'response_boundary') hasBoundary = true
    else if (p.type === 'artifact') artifactParts.push(p)
  }
  const entry: MessageScanCache = {
    hasBoundary,
    hasText: hasPartsText(parts),
    artifactParts
  }
  messageScanCache.set(message, entry)
  return entry
}

function hasResponseBoundary(messages: readonly Message[]): boolean {
  for (const m of messages) {
    if (scanMessage(m).hasBoundary) return true
  }
  return false
}

function updateSegmentResults(
  segment: MessageSegment,
  results: ReadonlyMap<string, ToolResult>
): MessageSegment {
  if (segment.kind === 'ask') {
    const res = results.get(segment.call.toolUseId)
    if (res === segment.call.result) return segment
    if (res) return { ...segment, call: { ...segment.call, result: res } }
    const copy = { ...segment.call }
    delete copy.result
    return { ...segment, call: copy }
  }
  if (segment.kind === 'tools') {
    let changed = false
    const nextCalls = segment.calls.map((call) => {
      const res = results.get(call.toolUseId)
      if (res === call.result) return call
      changed = true
      if (res) return { ...call, result: res }
      const copy = { ...call }
      delete copy.result
      return copy
    })
    return changed ? { ...segment, calls: nextCalls } : segment
  }
  return segment
}

function segmentPartKeys(
  messageId: string,
  segment: MessageSegment,
  entries: readonly PartKeyEntry[],
  cursor: { index: number },
  tracker: PartKeyTracker
): { blockKey: string; partKeys: string[] } {
  if (segment.kind === 'tools' && segment.calls.length > 0) {
    const pks = segment.calls.map((c) => toolBlockKey(messageId, c.toolUseId))
    // Advance cursor past matching tool entries
    while (cursor.index < entries.length && entries[cursor.index].kind === 'tool') {
      cursor.index++
    }
    return { blockKey: pks[0], partKeys: pks }
  }
  if (segment.kind === 'ask') {
    const pk = toolBlockKey(messageId, segment.call.toolUseId)
    while (cursor.index < entries.length && entries[cursor.index].kind === 'tool') {
      cursor.index++
    }
    return { blockKey: pk, partKeys: [pk] }
  }
  const targetKind = segment.kind
  const matched: string[] = []
  while (cursor.index < entries.length) {
    const entry = entries[cursor.index]
    if (entry.kind === targetKind) {
      matched.push(entry.key)
      cursor.index++
      if (targetKind !== 'text' && targetKind !== 'reasoning') break
    } else if (
      entry.kind === 'boundary' ||
      entry.kind === 'artifact' ||
      entry.kind === 'attachment'
    ) {
      cursor.index++
    } else {
      break
    }
  }
  if (matched.length === 0) {
    const fallback = tracker.allocate(messageId, targetKind)
    return { blockKey: fallback, partKeys: [fallback] }
  }
  return { blockKey: matched[0], partKeys: matched }
}

export function createClaudeBlockModel(config: {
  readonly mode: 'code' | 'work'
  readonly sessionKey: string
}): ClaudeBlockModel {
  const { mode, sessionKey } = config
  let list: BlockList<ClaudeBlock> = createBlockList<ClaudeBlock>()
  let cursor: TranscriptRevision | undefined
  let prevShowAutomaticFeeds = false
  let prevHasLive = false
  let prevInflight = false
  let prevReserve = false
  let prevForkable = false

  const tracker = new PartKeyTracker()
  const partKeysByMessage = new Map<string, PartKeyEntry[]>()
  const segmentCaches = new Map<string, ReturnType<typeof createSegmentCache>>()
  const workProjectors = new Map<string, ReturnType<typeof createWorkProjector>>()
  const messageById = new Map<string, Message>()
  const visibleById = new Map<string, Message | undefined>()

  // Tool call deduplication & result tracking
  const toolResults = new Map<string, ToolResult>()
  const toolResultsByMessage = new Map<
    string,
    Map<number, { toolRunId: string; result: ToolResult }>
  >()
  const toolResultStacks = new Map<
    string,
    { messageId: string; partIndex: number; result: ToolResult }[]
  >()
  const toolOwnerBlockKey = new Map<string, { messageId: string; blockKey: string }>()
  const latestToolCallInput = new Map<string, Record<string, unknown>>()

  // Turn tracking
  let turns: TurnGroup[] = []
  const msgToTurn = new Map<string, TurnGroup>()
  let prevActivityRefs: MultiPartGroupRef[] = []

  function extractActivityRefs(blocks: readonly ClaudeBlock[]): MultiPartGroupRef[] {
    const refs: MultiPartGroupRef[] = []
    for (const block of blocks) {
      if (block.kind === 'activity') {
        refs.push({
          key: block.key,
          repPartKey: block.partKeys[0] ?? block.key,
          partKeys: new Set(block.partKeys)
        })
      }
    }
    return refs
  }

  function retractMessageToolResults(messageId: string, partsFrom: number): Set<string> {
    const affected = new Set<string>()
    const msgMap = toolResultsByMessage.get(messageId)
    if (!msgMap) return affected
    for (const [idx, entry] of msgMap) {
      if (idx < partsFrom) continue
      msgMap.delete(idx)
      affected.add(entry.toolRunId)
      const stack = toolResultStacks.get(entry.toolRunId)
      if (stack) {
        const filtered = stack.filter((s) => !(s.messageId === messageId && s.partIndex === idx))
        if (filtered.length > 0) {
          toolResultStacks.set(entry.toolRunId, filtered)
          toolResults.set(entry.toolRunId, filtered[filtered.length - 1].result)
        } else {
          toolResultStacks.delete(entry.toolRunId)
          toolResults.delete(entry.toolRunId)
        }
      }
    }
    if (msgMap.size === 0) toolResultsByMessage.delete(messageId)
    return affected
  }

  function indexMessageToolParts(
    message: Message,
    partsFrom: number
  ): {
    affectedResults: Set<string>
    duplicateCallUpdates: Map<string, Record<string, unknown>>
  } {
    const affectedResults = new Set<string>()
    const duplicateCallUpdates = new Map<string, Record<string, unknown>>()
    let msgMap = toolResultsByMessage.get(message.id)
    for (let i = partsFrom; i < message.parts.length; i++) {
      const part = message.parts[i]
      if (part.type === 'tool_result') {
        const res = toolResultFromPart(part)
        if (!msgMap) {
          msgMap = new Map()
          toolResultsByMessage.set(message.id, msgMap)
        }
        msgMap.set(i, { toolRunId: part.toolRunId, result: res })
        const stack = toolResultStacks.get(part.toolRunId) ?? []
        const existingIdx = stack.findIndex((s) => s.messageId === message.id && s.partIndex === i)
        if (existingIdx >= 0) {
          stack[existingIdx] = { messageId: message.id, partIndex: i, result: res }
        } else {
          stack.push({ messageId: message.id, partIndex: i, result: res })
        }
        toolResultStacks.set(part.toolRunId, stack)
        toolResults.set(part.toolRunId, stack[stack.length - 1].result)
        affectedResults.add(part.toolRunId)
      } else if (part.type === 'tool_call' && part.parentToolRunId === undefined) {
        const argsObj =
          part.args && typeof part.args === 'object' ? (part.args as Record<string, unknown>) : {}
        latestToolCallInput.set(part.toolRunId, argsObj)
        const existingOwner = toolOwnerBlockKey.get(part.toolRunId)
        if (existingOwner && existingOwner.messageId !== message.id) {
          duplicateCallUpdates.set(part.toolRunId, argsObj)
        }
      }
    }
    return { affectedResults, duplicateCallUpdates }
  }

  function ensurePartKeysIncremental(message: Message, partsFrom: number): PartKeyEntry[] {
    const prev = partKeysByMessage.get(message.id)
    if (!prev || partsFrom === 0) {
      const carried = carryPartKeys(tracker, message.id, prev, message)
      partKeysByMessage.set(message.id, carried)
      return carried
    }
    const kept = prev.filter((e) => e.partIndex < partsFrom)
    for (let i = partsFrom; i < message.parts.length; i++) {
      const part = message.parts[i]
      const kind = partKeyKind(part)
      if (!kind) continue
      if (part.type === 'tool_call') {
        kept.push({
          partIndex: i,
          kind: 'tool',
          key: toolBlockKey(message.id, part.toolRunId),
          signature: null,
          toolRunId: part.toolRunId
        })
      } else {
        const key = tracker.allocate(message.id, kind)
        kept.push({
          partIndex: i,
          kind,
          key,
          signature:
            part.type === 'text'
              ? `text:${part.text}`
              : part.type === 'reasoning'
                ? `reasoning:${part.text}`
                : null
        })
      }
    }
    partKeysByMessage.set(message.id, kept)
    return kept
  }

  function buildCodeMessageBlocks(
    message: Message,
    partsFrom: number | undefined,
    isFirstInDocument: boolean,
    isFirstInTurn: boolean,
    seenToolCalls: Set<string>
  ): ClaudeSegmentBlock[] {
    let segCache = segmentCaches.get(message.id)
    if (!segCache) {
      segCache = createSegmentCache()
      segmentCaches.set(message.id, segCache)
    }
    const segments = segCache.segmentsFor(message, partsFrom, toolResults)
    const entries = ensurePartKeysIncremental(message, partsFrom ?? 0)
    const entryCursor = { index: 0 }
    const blocks: ClaudeSegmentBlock[] = []

    for (let i = 0; i < segments.length; i++) {
      let seg = segments[i]
      // Deduplicate duplicate toolRunId calls (D-067): first instance owns the block,
      // subsequent re-emits update input on the first instance and do not emit a second block.
      if (seg.kind === 'tools') {
        const filteredCalls: ToolCall[] = []
        for (const call of seg.calls) {
          if (seenToolCalls.has(call.toolUseId)) continue
          seenToolCalls.add(call.toolUseId)
          const latestInput = latestToolCallInput.get(call.toolUseId)
          const res = toolResults.get(call.toolUseId)
          const updatedCall: ToolCall = {
            ...call,
            ...(latestInput !== undefined ? { input: latestInput } : {}),
            ...(res !== undefined ? { result: res } : {})
          }
          filteredCalls.push(updatedCall)
        }
        if (filteredCalls.length === 0) continue
        seg = { kind: 'tools', calls: filteredCalls }
      } else if (seg.kind === 'ask') {
        if (seenToolCalls.has(seg.call.toolUseId)) continue
        seenToolCalls.add(seg.call.toolUseId)
        const latestInput = latestToolCallInput.get(seg.call.toolUseId)
        const res = toolResults.get(seg.call.toolUseId)
        seg = {
          kind: 'ask',
          call: {
            ...seg.call,
            ...(latestInput !== undefined ? { input: latestInput } : {}),
            ...(res !== undefined ? { result: res } : {})
          }
        }
      }

      const { blockKey, partKeys } = segmentPartKeys(message.id, seg, entries, entryCursor, tracker)

      if (seg.kind === 'tools') {
        for (const call of seg.calls) {
          if (!toolOwnerBlockKey.has(call.toolUseId)) {
            toolOwnerBlockKey.set(call.toolUseId, { messageId: message.id, blockKey })
          }
        }
      } else if (seg.kind === 'ask') {
        if (!toolOwnerBlockKey.has(seg.call.toolUseId)) {
          toolOwnerBlockKey.set(seg.call.toolUseId, { messageId: message.id, blockKey })
        }
      }

      const gap: ClaudeBlockGap =
        blocks.length === 0 && isFirstInTurn
          ? isFirstInDocument
            ? 0
            : 24
          : seg.kind === 'tools'
            ? 8
            : 16

      blocks.push({
        kind: 'segment',
        key: blockKey,
        messageId: message.id,
        partKeys,
        segment: seg,
        gap
      })
    }
    return blocks
  }

  function buildWorkTurnBlocks(
    turnMessages: readonly Message[],
    turnId: string,
    isFirstInDocument: boolean,
    prevActivities: readonly MultiPartGroupRef[]
  ): ClaudeBlock[] {
    let projector = workProjectors.get(turnId)
    if (!projector) {
      projector = createWorkProjector()
      workProjectors.set(turnId, projector)
    }
    const nodes: WorkActivityNode[] | null = projector(turnMessages, toolResults)
    if (!nodes) return []

    const blocks: ClaudeBlock[] = []
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const gap: ClaudeBlockGap = i === 0 ? (isFirstInDocument ? 0 : 24) : 16
      if (node.kind === 'activity') {
        const itemPartKeys = node.items.map((item) => item.key)
        const rep =
          prevActivities.length > 0 && itemPartKeys.length > 0
            ? representativePart(prevActivities, itemPartKeys)
            : { repPartKey: itemPartKeys[0] ?? node.key, droppedGroupKeys: [] }
        // Keep activity prefix on representative part key for uniqueness against segment keys
        const actKey = rep.repPartKey.includes(':activity:')
          ? rep.repPartKey
          : `${node.items[0]?.messageId ?? turnId}:activity:${rep.repPartKey}`
        // Split inheritance (y13): if split off from an existing activity group, inherit its disclosure
        if (rep.inheritedFromKey && rep.inheritedFromKey !== actKey) {
          const prevOpen = getDisclosure(sessionKey, rep.inheritedFromKey)
          if (prevOpen !== undefined) {
            setDisclosure(sessionKey, actKey, prevOpen)
          }
        }
        blocks.push({
          kind: 'activity',
          key: actKey,
          messageId: node.items[0]?.messageId ?? turnId,
          partKeys: itemPartKeys,
          items: node.items,
          toolCount: node.toolCount,
          noteCount: node.noteCount,
          gap
        })
      } else if (node.kind === 'status') {
        blocks.push({
          kind: 'status',
          key: `${turnId}:${node.key}`,
          messageId: turnId,
          outcome: node.outcome,
          gap
        })
      } else {
        if (node.segment.kind === 'tools') {
          for (const call of node.segment.calls) {
            if (!toolOwnerBlockKey.has(call.toolUseId)) {
              toolOwnerBlockKey.set(call.toolUseId, {
                messageId: node.messageId,
                blockKey: node.key
              })
            }
          }
        } else if (node.segment.kind === 'ask') {
          if (!toolOwnerBlockKey.has(node.segment.call.toolUseId)) {
            toolOwnerBlockKey.set(node.segment.call.toolUseId, {
              messageId: node.messageId,
              blockKey: node.key
            })
          }
        }
        blocks.push({
          kind: 'segment',
          key: node.key,
          messageId: node.messageId,
          partKeys: [node.key],
          segment: node.segment,
          gap
        })
      }
    }
    return blocks
  }

  function buildTurnArtifactsAndMeta(
    turnMessages: readonly Message[],
    firstId: string,
    isLastTurn: boolean,
    inflight: boolean,
    forkable: boolean,
    hasPriorBlocks: boolean
  ): { artifactsBlock?: ClaudeArtifactsBlock; metaBlock?: ClaudeMetaBlock } {
    const artifactParts: AppMessagePart[] = []
    let copyable = false
    for (const m of turnMessages) {
      const scanned = scanMessage(m)
      if (scanned.artifactParts.length > 0) artifactParts.push(...scanned.artifactParts)
      if (scanned.hasText) copyable = true
    }
    const artifacts = artifactParts.length > 0 ? partsArtifacts(artifactParts) : []
    const artifactsBlock: ClaudeArtifactsBlock | undefined =
      artifacts.length > 0
        ? {
            kind: 'artifacts',
            key: turnArtifactsKey(firstId),
            messageId: firstId,
            artifacts,
            gap: hasPriorBlocks ? 16 : 0
          }
        : undefined
    const showMeta = !(isLastTurn && inflight)
    const lastMsg = turnMessages[turnMessages.length - 1]
    const metaBlock: ClaudeMetaBlock | undefined = showMeta
      ? {
          kind: 'meta',
          key: turnMetaKey(firstId),
          messageId: firstId,
          turn: { role: 'assistant', messages: [...turnMessages], startIndex: 0 },
          copyable,
          createdAt: lastMsg.createdAt,
          forkable: isLastTurn && forkable,
          gap: hasPriorBlocks || artifactsBlock ? 16 : 0
        }
      : undefined
    return { artifactsBlock, metaBlock }
  }

  function rebuildAll(
    messages: readonly Message[],
    opts: Required<ClaudeAdvanceOptions>
  ): BlockSnapshot<ClaudeBlock> {
    const prevBlocks: ClaudeBlock[] = []
    const oldSnap = list.snapshot()
    for (let i = 0; i < oldSnap.count; i++) prevBlocks.push(oldSnap.blockAt(i))
    const prevUserRefs: MultiPartGroupRef[] = []
    for (const b of prevBlocks) {
      if (b.kind === 'user')
        prevUserRefs.push({ key: b.key, repPartKey: b.key, partKeys: new Set(b.partKeys) })
    }
    prevActivityRefs = mode === 'work' ? extractActivityRefs(prevBlocks) : []

    messageById.clear()
    visibleById.clear()
    toolResults.clear()
    toolResultsByMessage.clear()
    toolResultStacks.clear()
    toolOwnerBlockKey.clear()
    latestToolCallInput.clear()
    msgToTurn.clear()
    turns = []

    // Pass 1: index messages, tool results, and latest tool call inputs
    const visibleMessages: Message[] = []
    for (const msg of messages) {
      messageById.set(msg.id, msg)
      const vis = filterVisibleMessage(msg, opts.showAutomaticFeeds)
      visibleById.set(msg.id, vis)
      indexMessageToolParts(msg, 0)
      if (vis) visibleMessages.push(vis)
    }

    // Group into turns using isTurnStart
    const grouped: { role: 'user' | 'assistant'; messages: Message[] }[] = []
    for (const msg of visibleMessages) {
      const prevTurn = grouped[grouped.length - 1]
      const prevMsg = prevTurn?.messages[prevTurn.messages.length - 1]
      if (!prevTurn || prevTurn.role !== msg.role || isTurnStart(prevMsg, msg)) {
        grouped.push({ role: msg.role, messages: [msg] })
      } else {
        prevTurn.messages.push(msg)
      }
    }

    // Determine last user turn and last assistant turn
    let lastUserTurnIdx = -1
    let lastAssistantTurnIdx = -1
    for (let i = 0; i < grouped.length; i++) {
      if (grouped[i].role === 'user') lastUserTurnIdx = i
      else lastAssistantTurnIdx = i
    }

    const allBlocks: ClaudeBlock[] = []
    const seenToolCalls = new Set<string>()

    for (let tIdx = 0; tIdx < grouped.length; tIdx++) {
      const g = grouped[tIdx]
      const firstId = g.messages[0].id
      const turnRecord: TurnGroup = {
        id: firstId,
        role: g.role,
        messageIds: g.messages.map((m) => m.id),
        blockKeys: [],
        messageBlockKeys: new Map()
      }
      for (const m of g.messages) msgToTurn.set(m.id, turnRecord)

      const isFirstInDoc = allBlocks.length === 0
      if (g.role === 'user') {
        const userPartKeys = g.messages.map((m) => userBlockKey(m.id))
        const { repPartKey: key } = representativePart(prevUserRefs, userPartKeys)
        const block: ClaudeUserBlock = {
          kind: 'user',
          key,
          messageId: firstId,
          partKeys: userPartKeys,
          turn: { role: 'user', messages: g.messages, startIndex: tIdx },
          gap: isFirstInDoc ? 0 : 24,
          reserveTarget: opts.reserve && tIdx === lastUserTurnIdx
        }
        allBlocks.push(block)
        turnRecord.blockKeys.push(key)
        turnRecord.messageBlockKeys.set(firstId, [key])
      } else {
        const turnBlocks: ClaudeBlock[] = []
        if (mode === 'work' && hasResponseBoundary(g.messages)) {
          const workBlocks = buildWorkTurnBlocks(
            g.messages,
            firstId,
            isFirstInDoc,
            prevActivityRefs
          )
          for (const b of workBlocks) {
            turnBlocks.push(b)
            turnRecord.blockKeys.push(b.key)
          }
        } else {
          for (let mIdx = 0; mIdx < g.messages.length; mIdx++) {
            const m = g.messages[mIdx]
            const msgBlocks = buildCodeMessageBlocks(
              m,
              0,
              isFirstInDoc && mIdx === 0,
              mIdx === 0,
              seenToolCalls
            )
            turnRecord.messageBlockKeys.set(
              m.id,
              msgBlocks.map((b) => b.key)
            )
            for (const b of msgBlocks) {
              turnBlocks.push(b)
              turnRecord.blockKeys.push(b.key)
            }
          }
        }
        const isLastAssistant = tIdx === lastAssistantTurnIdx
        const { artifactsBlock, metaBlock } = buildTurnArtifactsAndMeta(
          g.messages,
          firstId,
          isLastAssistant,
          opts.inflight,
          opts.forkable,
          turnBlocks.length > 0
        )
        if (artifactsBlock) {
          turnBlocks.push(artifactsBlock)
          turnRecord.blockKeys.push(artifactsBlock.key)
          turnRecord.artifactsKey = artifactsBlock.key
        }
        if (metaBlock) {
          turnBlocks.push(metaBlock)
          turnRecord.blockKeys.push(metaBlock.key)
          turnRecord.metaKey = metaBlock.key
        }
        for (const b of turnBlocks) allBlocks.push(b)
      }
      turns.push(turnRecord)
    }

    if (opts.hasLive) {
      allBlocks.push({
        kind: 'live',
        key: liveBlockKey(sessionKey),
        gap: allBlocks.length === 0 ? 0 : 16
      })
    }

    assertUniqueBlockKeys(allBlocks)
    list = createBlockList(allBlocks)
    return list.snapshot()
  }

  function updateToolBlockInPlace(toolRunId: string): void {
    const owner = toolOwnerBlockKey.get(toolRunId)
    if (!owner) return
    const snap = list.snapshot()
    const idx = snap.indexOf(owner.blockKey)
    if (idx < 0) return
    const block = snap.blockAt(idx)
    if (block.kind !== 'segment') return
    let updatedSeg = updateSegmentResults(block.segment, toolResults)
    const latestInput = latestToolCallInput.get(toolRunId)
    if (latestInput !== undefined) {
      if (updatedSeg.kind === 'tools') {
        let changed = false
        const calls = updatedSeg.calls.map((c) => {
          if (c.toolUseId !== toolRunId || c.input === latestInput) return c
          changed = true
          return { ...c, input: latestInput }
        })
        if (changed) updatedSeg = { kind: 'tools', calls }
      } else if (updatedSeg.kind === 'ask' && updatedSeg.call.toolUseId === toolRunId) {
        if (updatedSeg.call.input !== latestInput) {
          updatedSeg = { kind: 'ask', call: { ...updatedSeg.call, input: latestInput } }
        }
      }
    }
    if (updatedSeg === block.segment) return
    list.splice(idx, 1, [{ ...block, segment: updatedSeg }])
  }

  function refreshLastTurnFlags(opts: Required<ClaudeAdvanceOptions>): void {
    let lastUserTurn: TurnGroup | undefined
    let lastAssistantTurn: TurnGroup | undefined
    for (let i = turns.length - 1; i >= 0; i--) {
      if (!lastUserTurn && turns[i].role === 'user') lastUserTurn = turns[i]
      if (!lastAssistantTurn && turns[i].role === 'assistant') lastAssistantTurn = turns[i]
      if (lastUserTurn && lastAssistantTurn) break
    }

    const snap = list.snapshot()
    // Update reserveTarget on user turns
    for (const t of turns) {
      if (t.role !== 'user' || t.blockKeys.length === 0) continue
      const idx = snap.indexOf(t.blockKeys[0])
      if (idx < 0) continue
      const b = snap.blockAt(idx)
      if (b.kind !== 'user') continue
      const want = opts.reserve && t === lastUserTurn
      if (b.reserveTarget !== want) {
        list.splice(idx, 1, [{ ...b, reserveTarget: want }])
      }
    }

    // Update forkable & inflight meta visibility on assistant turns
    for (const t of turns) {
      if (t.role !== 'assistant') continue
      const isLast = t === lastAssistantTurn
      const wantMeta = !(isLast && opts.inflight)
      const wantForkable = isLast && opts.forkable
      const curSnap = list.snapshot()

      if (t.metaKey) {
        const metaIdx = curSnap.indexOf(t.metaKey)
        if (!wantMeta && metaIdx >= 0) {
          list.splice(metaIdx, 1, [])
          t.blockKeys = t.blockKeys.filter((k) => k !== t.metaKey)
          t.metaKey = undefined
        } else if (wantMeta && metaIdx >= 0) {
          const metaBlock = curSnap.blockAt(metaIdx)
          if (metaBlock.kind === 'meta' && metaBlock.forkable !== wantForkable) {
            list.splice(metaIdx, 1, [{ ...metaBlock, forkable: wantForkable }])
          }
        }
      } else if (wantMeta) {
        const turnMessages = t.messageIds
          .map((id) => visibleById.get(id))
          .filter((m): m is Message => m !== undefined)
        if (turnMessages.length > 0) {
          const { metaBlock } = buildTurnArtifactsAndMeta(
            turnMessages,
            t.id,
            isLast,
            opts.inflight,
            opts.forkable,
            t.blockKeys.length > 0
          )
          if (metaBlock) {
            const insertAt = findTurnEndIndex(curSnap, t)
            list.splice(insertAt, 0, [metaBlock])
            t.blockKeys.push(metaBlock.key)
            t.metaKey = metaBlock.key
          }
        }
      }
    }

    // Live block at end
    const liveKey = liveBlockKey(sessionKey)
    const liveSnap = list.snapshot()
    const liveIdx = liveSnap.indexOf(liveKey)
    if (opts.hasLive && liveIdx < 0) {
      list.splice(liveSnap.count, 0, [
        { kind: 'live', key: liveKey, gap: liveSnap.count === 0 ? 0 : 16 }
      ])
    } else if (!opts.hasLive && liveIdx >= 0) {
      list.splice(liveIdx, 1, [])
    }
  }

  function findTurnStartIndex(snap: BlockSnapshot<ClaudeBlock>, turn: TurnGroup): number {
    for (const k of turn.blockKeys) {
      const idx = snap.indexOf(k)
      if (idx >= 0) return idx
    }
    // Find where this turn belongs based on preceding turns
    const tPos = turns.indexOf(turn)
    for (let i = tPos - 1; i >= 0; i--) {
      const prev = turns[i]
      if (prev.blockKeys.length > 0) {
        const lastKey = prev.blockKeys[prev.blockKeys.length - 1]
        const idx = snap.indexOf(lastKey)
        if (idx >= 0) return idx + 1
      }
    }
    return 0
  }

  function findTurnEndIndex(snap: BlockSnapshot<ClaudeBlock>, turn: TurnGroup): number {
    if (turn.blockKeys.length > 0) {
      const lastKey = turn.blockKeys[turn.blockKeys.length - 1]
      const idx = snap.indexOf(lastKey)
      if (idx >= 0) return idx + 1
    }
    return findTurnStartIndex(snap, turn)
  }

  function rebuildSingleTurn(
    turn: TurnGroup,
    opts: Required<ClaudeAdvanceOptions>,
    partsFromByMsg?: ReadonlyMap<string, number>
  ): void {
    const turnMessages = turn.messageIds
      .map((id) => visibleById.get(id))
      .filter((m): m is Message => m !== undefined)
    const snap = list.snapshot()
    const startIdx = findTurnStartIndex(snap, turn)
    const oldCount = turn.blockKeys.length

    if (turnMessages.length === 0) {
      if (oldCount > 0) list.splice(startIdx, oldCount, [])
      turn.blockKeys = []
      turn.messageBlockKeys.clear()
      turn.artifactsKey = undefined
      turn.metaKey = undefined
      return
    }

    const isFirstInDoc = startIdx === 0
    const isLastAssistant =
      turn.role === 'assistant' &&
      turns.slice(turns.indexOf(turn) + 1).every((t) => t.role !== 'assistant')
    const isLastUser =
      turn.role === 'user' && turns.slice(turns.indexOf(turn) + 1).every((t) => t.role !== 'user')

    const newBlocks: ClaudeBlock[] = []
    turn.blockKeys = []
    turn.messageBlockKeys.clear()
    turn.artifactsKey = undefined
    turn.metaKey = undefined

    if (turn.role === 'user') {
      const userPartKeys = turnMessages.map((m) => userBlockKey(m.id))
      const key = userBlockKey(turn.id)
      const block: ClaudeUserBlock = {
        kind: 'user',
        key,
        messageId: turn.id,
        partKeys: userPartKeys,
        turn: { role: 'user', messages: turnMessages, startIndex: 0 },
        gap: isFirstInDoc ? 0 : 24,
        reserveTarget: opts.reserve && isLastUser
      }
      newBlocks.push(block)
      turn.blockKeys.push(key)
      turn.messageBlockKeys.set(turn.id, [key])
    } else if (mode === 'work' && hasResponseBoundary(turnMessages)) {
      const workBlocks = buildWorkTurnBlocks(turnMessages, turn.id, isFirstInDoc, prevActivityRefs)
      for (const b of workBlocks) {
        newBlocks.push(b)
        turn.blockKeys.push(b.key)
      }
      const { artifactsBlock, metaBlock } = buildTurnArtifactsAndMeta(
        turnMessages,
        turn.id,
        isLastAssistant,
        opts.inflight,
        opts.forkable,
        newBlocks.length > 0
      )
      if (artifactsBlock) {
        newBlocks.push(artifactsBlock)
        turn.blockKeys.push(artifactsBlock.key)
        turn.artifactsKey = artifactsBlock.key
      }
      if (metaBlock) {
        newBlocks.push(metaBlock)
        turn.blockKeys.push(metaBlock.key)
        turn.metaKey = metaBlock.key
      }
    } else {
      const seenTools = new Set<string>()
      for (const [toolId, owner] of toolOwnerBlockKey) {
        if (!turn.messageIds.includes(owner.messageId)) {
          seenTools.add(toolId)
        }
      }
      for (let mIdx = 0; mIdx < turnMessages.length; mIdx++) {
        const m = turnMessages[mIdx]
        const pf = partsFromByMsg?.get(m.id)
        const msgBlocks = buildCodeMessageBlocks(
          m,
          pf,
          isFirstInDoc && mIdx === 0,
          mIdx === 0,
          seenTools
        )
        turn.messageBlockKeys.set(
          m.id,
          msgBlocks.map((b) => b.key)
        )
        for (const b of msgBlocks) {
          newBlocks.push(b)
          turn.blockKeys.push(b.key)
        }
      }
      const { artifactsBlock, metaBlock } = buildTurnArtifactsAndMeta(
        turnMessages,
        turn.id,
        isLastAssistant,
        opts.inflight,
        opts.forkable,
        newBlocks.length > 0
      )
      if (artifactsBlock) {
        newBlocks.push(artifactsBlock)
        turn.blockKeys.push(artifactsBlock.key)
        turn.artifactsKey = artifactsBlock.key
      }
      if (metaBlock) {
        newBlocks.push(metaBlock)
        turn.blockKeys.push(metaBlock.key)
        turn.metaKey = metaBlock.key
      }
    }

    list.splice(startIdx, oldCount, newBlocks)
  }

  return {
    snapshot: () => list.snapshot(),
    advance(state, rawOptions = {}) {
      const opts: Required<ClaudeAdvanceOptions> = {
        showAutomaticFeeds: rawOptions.showAutomaticFeeds ?? false,
        hasLive: rawOptions.hasLive ?? false,
        inflight: rawOptions.inflight ?? false,
        reserve: rawOptions.reserve ?? false,
        forkable: rawOptions.forkable ?? false
      }

      const { messages, transcriptChanges } = state
      const changes = changesSince(transcriptChanges, cursor)
      const optionsChanged =
        opts.showAutomaticFeeds !== prevShowAutomaticFeeds ||
        opts.hasLive !== prevHasLive ||
        opts.inflight !== prevInflight ||
        opts.reserve !== prevReserve ||
        opts.forkable !== prevForkable

      if (changes !== 'reset' && changes.length === 0 && !optionsChanged && cursor !== undefined) {
        return list.snapshot()
      }

      const mustRebuild =
        changes === 'reset' ||
        changes.some((c) => c.kind === 'reset') ||
        opts.showAutomaticFeeds !== prevShowAutomaticFeeds

      if (mustRebuild) {
        const snap = rebuildAll(messages, opts)
        cursor = { lineage: transcriptChanges.lineage, revision: transcriptChanges.revision }
        prevShowAutomaticFeeds = opts.showAutomaticFeeds
        prevHasLive = opts.hasLive
        prevInflight = opts.inflight
        prevReserve = opts.reserve
        prevForkable = opts.forkable
        return snap
      }

      if (changes.length > 0) {
        const order = messageOrderFor(state, true)
        const folded = foldChanges(changes)

        // 1. Handle T-preserving prepends first (O(prepended) + 1 boundary block — z6)
        const prependedIds: string[] = []
        for (const ch of changes) {
          if (ch.kind === 'prepend') {
            for (const id of ch.ids) {
              if (order.messagePosition(id) >= 0) prependedIds.push(id)
            }
          }
        }
        if (prependedIds.length > 0) {
          const prependedMsgs: Message[] = []
          for (const id of prependedIds) {
            const pos = order.messagePosition(id)
            if (pos >= 0 && messages[pos]) {
              const m = messages[pos]
              messageById.set(m.id, m)
              const vis = filterVisibleMessage(m, opts.showAutomaticFeeds)
              visibleById.set(m.id, vis)
              indexMessageToolParts(m, 0)
              if (vis) prependedMsgs.push(vis)
            }
          }
          if (prependedMsgs.length > 0) {
            const prefixGrouped: { role: 'user' | 'assistant'; messages: Message[] }[] = []
            for (const m of prependedMsgs) {
              const prev = prefixGrouped[prefixGrouped.length - 1]
              const prevM = prev?.messages[prev.messages.length - 1]
              if (!prev || prev.role !== m.role || isTurnStart(prevM, m)) {
                prefixGrouped.push({ role: m.role, messages: [m] })
              } else {
                prev.messages.push(m)
              }
            }
            const prefixBlocks: ClaudeBlock[] = []
            const prefixTurns: TurnGroup[] = []
            const seenTools = new Set<string>()
            for (const g of prefixGrouped) {
              const firstId = g.messages[0].id
              const tr: TurnGroup = {
                id: firstId,
                role: g.role,
                messageIds: g.messages.map((m) => m.id),
                blockKeys: [],
                messageBlockKeys: new Map()
              }
              for (const m of g.messages) msgToTurn.set(m.id, tr)
              const isFirst = prefixBlocks.length === 0
              if (g.role === 'user') {
                const userPartKeys = g.messages.map((m) => userBlockKey(m.id))
                const key = userBlockKey(firstId)
                prefixBlocks.push({
                  kind: 'user',
                  key,
                  messageId: firstId,
                  partKeys: userPartKeys,
                  turn: { role: 'user', messages: g.messages, startIndex: 0 },
                  gap: isFirst ? 0 : 24,
                  reserveTarget: false
                })
                tr.blockKeys.push(key)
                tr.messageBlockKeys.set(firstId, [key])
              } else if (mode === 'work' && hasResponseBoundary(g.messages)) {
                const wb = buildWorkTurnBlocks(g.messages, firstId, isFirst, [])
                for (const b of wb) {
                  prefixBlocks.push(b)
                  tr.blockKeys.push(b.key)
                }
                const { artifactsBlock, metaBlock } = buildTurnArtifactsAndMeta(
                  g.messages,
                  firstId,
                  false,
                  false,
                  false,
                  wb.length > 0
                )
                if (artifactsBlock) {
                  prefixBlocks.push(artifactsBlock)
                  tr.blockKeys.push(artifactsBlock.key)
                  tr.artifactsKey = artifactsBlock.key
                }
                if (metaBlock) {
                  prefixBlocks.push(metaBlock)
                  tr.blockKeys.push(metaBlock.key)
                  tr.metaKey = metaBlock.key
                }
              } else {
                for (let mIdx = 0; mIdx < g.messages.length; mIdx++) {
                  const m = g.messages[mIdx]
                  const mb = buildCodeMessageBlocks(
                    m,
                    0,
                    isFirst && mIdx === 0,
                    mIdx === 0,
                    seenTools
                  )
                  tr.messageBlockKeys.set(
                    m.id,
                    mb.map((b) => b.key)
                  )
                  for (const b of mb) {
                    prefixBlocks.push(b)
                    tr.blockKeys.push(b.key)
                  }
                }
                const { artifactsBlock, metaBlock } = buildTurnArtifactsAndMeta(
                  g.messages,
                  firstId,
                  false,
                  false,
                  false,
                  tr.blockKeys.length > 0
                )
                if (artifactsBlock) {
                  prefixBlocks.push(artifactsBlock)
                  tr.blockKeys.push(artifactsBlock.key)
                  tr.artifactsKey = artifactsBlock.key
                }
                if (metaBlock) {
                  prefixBlocks.push(metaBlock)
                  tr.blockKeys.push(metaBlock.key)
                  tr.metaKey = metaBlock.key
                }
              }
              prefixTurns.push(tr)
            }

            // Update boundary gap of old first block (at most 1 block)
            const curSnap = list.snapshot()
            if (curSnap.count > 0 && prefixBlocks.length > 0) {
              const oldFirst = curSnap.blockAt(0)
              if (oldFirst.gap === 0) {
                list.splice(0, 1, [...prefixBlocks, { ...oldFirst, gap: 24 }])
              } else {
                list.splice(0, 0, prefixBlocks)
              }
            } else if (prefixBlocks.length > 0) {
              list.splice(0, 0, prefixBlocks)
            }
            turns = [...prefixTurns, ...turns]
          }
        }

        // 2. Process remaining folded changes (append, replace, remove)
        const prependedSet = new Set(prependedIds)
        const affectedTurns = new Set<TurnGroup>()
        const partsFromByMsg = new Map<string, number>()
        const lateResultTools = new Set<string>()

        for (const [id, partsFrom] of folded) {
          if (prependedSet.has(id)) continue
          const pos = order.messagePosition(id)
          if (pos < 0) {
            // Removed message (z3)
            const removedTools = retractMessageToolResults(id, 0)
            for (const tid of removedTools) lateResultTools.add(tid)
            messageById.delete(id)
            visibleById.delete(id)
            segmentCaches.delete(id)
            const tr = msgToTurn.get(id)
            if (tr) {
              msgToTurn.delete(id)
              tr.messageIds = tr.messageIds.filter((mid) => mid !== id)
              affectedTurns.add(tr)
            }
            continue
          }

          const msg = messages[pos]
          const prevTurn = msgToTurn.get(id)
          const retracted = retractMessageToolResults(id, partsFrom)
          const { affectedResults, duplicateCallUpdates } = indexMessageToolParts(msg, partsFrom)
          for (const tid of retracted) lateResultTools.add(tid)
          for (const tid of affectedResults) lateResultTools.add(tid)
          for (const tid of duplicateCallUpdates.keys()) lateResultTools.add(tid)

          messageById.set(id, msg)
          const vis = filterVisibleMessage(msg, opts.showAutomaticFeeds)
          visibleById.set(id, vis)
          partsFromByMsg.set(id, partsFrom)

          if (prevTurn) {
            // Existing message replaced in place
            // Fast path: if only a late tool_result was added to a code-mode message that doesn't own that tool,
            // we don't even need to rebuild this message's turn if its visible parts didn't change!
            affectedTurns.add(prevTurn)
          } else if (vis) {
            // Newly appended message
            const lastTurn = turns[turns.length - 1]
            const lastMsg = lastTurn
              ? visibleById.get(lastTurn.messageIds[lastTurn.messageIds.length - 1])
              : undefined
            if (lastTurn && lastTurn.role === vis.role && !isTurnStart(lastMsg, vis)) {
              lastTurn.messageIds.push(vis.id)
              msgToTurn.set(vis.id, lastTurn)
              affectedTurns.add(lastTurn)
            } else {
              const newTurn: TurnGroup = {
                id: vis.id,
                role: vis.role,
                messageIds: [vis.id],
                blockKeys: [],
                messageBlockKeys: new Map()
              }
              msgToTurn.set(vis.id, newTurn)
              turns.push(newTurn)
              affectedTurns.add(newTurn)
            }
          }
        }

        // Rebuild only affected turns (and clean up emptied turns)
        for (const tr of affectedTurns) {
          rebuildSingleTurn(tr, opts, partsFromByMsg)
        }
        turns = turns.filter((t) => t.messageIds.length > 0)

        // Update first block gap if turn 0 was removed
        const afterSnap = list.snapshot()
        if (afterSnap.count > 0) {
          const first = afterSnap.blockAt(0)
          if (first.gap !== 0) {
            list.splice(0, 1, [{ ...first, gap: 0 }])
          }
        }

        // Propagate late tool results & duplicate call input updates to original owner blocks (z4)
        for (const toolRunId of lateResultTools) {
          const ownerMsgId = order.toolCallOwner(toolRunId)
          if (ownerMsgId) {
            updateToolBlockInPlace(toolRunId)
          }
        }
      }

      // 3. Refresh last-turn flags (reserveTarget, forkable, inflight meta, live block)
      refreshLastTurnFlags(opts)

      cursor = { lineage: transcriptChanges.lineage, revision: transcriptChanges.revision }
      prevShowAutomaticFeeds = opts.showAutomaticFeeds
      prevHasLive = opts.hasLive
      prevInflight = opts.inflight
      prevReserve = opts.reserve
      prevForkable = opts.forkable
      return list.snapshot()
    }
  }
}
