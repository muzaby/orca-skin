import type { MarkdownSourcePart } from '../../../../../shared/ui/markdown/sourceParts'
/**
 * Incremental block model for OpenCode transcripts (EP-7 · EP-8 · EP-9).
 *
 * Maintains an immutable `BlockSnapshot<OpenCodeBlock>` backed by `createBlockList` (64-slot chunks),
 * advancing incrementally from `transcriptChanges` via `foldChanges` and `messageOrderFor`.
 */
import type { AppMessagePart } from '../../../../../../../shared/ipc'
import type { Message, ToolCall } from '../../../reducer/chatReducer'
import {
  hasPartsText,
  messageSegments,
  partsArtifacts,
  partsAttachments,
  partsDiffRequirements,
  partsText,
  toolResultFromPart,
  type MessageSegment
} from '../../../lib/parts'
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
  nextPartKey,
  partKeyKind,
  PartKeyTracker,
  representativePart,
  toolBlockKey,
  textPartGroups,
  turnArtifactsKey,
  turnMetaKey,
  userBlockKey,
  type MultiPartGroupRef,
  type PartKeyEntry
} from '../../../lib/transcript/blockKeys'
import type { Turn } from '../../../lib/turns'
import { groupTools } from './toolGrouping'
import { toolKind } from '../toolPresentation'

export type OpenCodeBlockGap = 0 | 8 | 16 | 24

export interface OpenCodeUserBlock {
  readonly kind: 'user'
  readonly key: string
  readonly messageId: string
  readonly partKeys: readonly string[]
  readonly turn: Turn
  readonly gap: OpenCodeBlockGap
}

export interface OpenCodeSegmentBlock {
  readonly sourceParts?: readonly MarkdownSourcePart[]
  readonly kind: 'segment'
  readonly key: string
  readonly messageId: string
  readonly partKeys: readonly string[]
  readonly segment: MessageSegment
  readonly streaming: boolean
  readonly live?: true
  readonly gap: OpenCodeBlockGap
}

export interface OpenCodeArtifactsBlock {
  readonly kind: 'artifacts'
  readonly key: string
  readonly messageId: string
  readonly artifacts: ReturnType<typeof partsArtifacts>
  readonly gap: OpenCodeBlockGap
}

export interface OpenCodeIncompleteBlock {
  readonly kind: 'incomplete'
  readonly key: string
  readonly messageId: string
  readonly gap: OpenCodeBlockGap
}

export interface OpenCodeMetaBlock {
  readonly kind: 'meta'
  readonly key: string
  readonly messageId: string
  readonly turn: Turn
  readonly copyable: boolean
  readonly createdAt: number
  readonly gap: OpenCodeBlockGap
}

export type OpenCodeBlock =
  | OpenCodeUserBlock
  | OpenCodeSegmentBlock
  | OpenCodeArtifactsBlock
  | OpenCodeIncompleteBlock
  | OpenCodeMetaBlock

export interface OpenCodeTranscriptInput {
  readonly messages: readonly Message[]
  readonly transcriptChanges: TranscriptChanges
}

export interface OpenCodeAdvanceOptions {
  readonly showAutomaticFeeds?: boolean
  readonly liveText?: boolean
  readonly liveReasoning?: boolean
  readonly liveTextKey?: string
  readonly pending?: boolean
}

export interface OpenCodeBlockModel {
  advance(
    state: OpenCodeTranscriptInput,
    options?: OpenCodeAdvanceOptions
  ): BlockSnapshot<OpenCodeBlock>
  snapshot(): BlockSnapshot<OpenCodeBlock>
}

type ToolResult = NonNullable<ToolCall['result']>

interface TurnGroup {
  id: string
  role: 'user' | 'assistant'
  messageIds: string[]
  blockKeys: string[]
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

function extractTextGroupRefs(blocks: readonly OpenCodeBlock[]): MultiPartGroupRef[] {
  const refs: MultiPartGroupRef[] = []
  for (const b of blocks) {
    if (b.kind === 'segment' && b.segment.kind === 'text' && b.partKeys.length > 0) {
      refs.push({
        key: b.key,
        repPartKey: b.key,
        partKeys: new Set(b.partKeys)
      })
    }
  }
  return refs
}

export function createOpenCodeBlockModel(): OpenCodeBlockModel {
  let list: BlockList<OpenCodeBlock> = createBlockList<OpenCodeBlock>()
  let cursor: TranscriptRevision | undefined
  let prevOpts: Required<Omit<OpenCodeAdvanceOptions, 'liveTextKey'>> & {
    liveTextKey: string | undefined
  } = {
    showAutomaticFeeds: false,
    liveText: false,
    liveReasoning: false,
    liveTextKey: undefined,
    pending: false
  }

  const tracker = new PartKeyTracker()
  const partKeysByMessage = new Map<string, PartKeyEntry[]>()
  const messageById = new Map<string, Message>()
  const visibleById = new Map<string, Message | undefined>()

  // Tool results & deduplication
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

  let turns: TurnGroup[] = []
  const msgToTurn = new Map<string, TurnGroup>()
  let initialLiveKey: string | undefined
  let prevTextRefs: MultiPartGroupRef[] = []

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

  function indexMessageToolParts(message: Message, partsFrom: number): Set<string> {
    const affected = new Set<string>()
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
        affected.add(part.toolRunId)
      } else if (part.type === 'tool_call' && part.parentToolRunId === undefined) {
        const argsObj =
          part.args && typeof part.args === 'object' ? (part.args as Record<string, unknown>) : {}
        latestToolCallInput.set(part.toolRunId, argsObj)
        const existingOwner = toolOwnerBlockKey.get(part.toolRunId)
        if (existingOwner) affected.add(part.toolRunId)
      }
    }
    return affected
  }

  function ensurePartKeys(message: Message, partsFrom?: number): PartKeyEntry[] {
    const prev = partKeysByMessage.get(message.id)
    if (!prev || partsFrom === undefined || partsFrom === 0) {
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

  function buildAssistantTurnBlocks(
    turnMessages: readonly Message[],
    firstId: string,
    hasPreviousBlock: boolean,
    active: boolean,
    liveText: boolean,
    liveReasoning: boolean,
    liveTextKey: string | undefined,
    textRefs: readonly MultiPartGroupRef[],
    seenGlobalTools: Set<string>
  ): OpenCodeBlock[] {
    // Collect parts along with their owning messageId and stable part keys
    const combinedParts: AppMessagePart[] = []
    const combinedEntries: PartKeyEntry[] = []
    const nonTextPartKeysByKind = new Map<string, { key: string; messageId: string }[]>()
    const callMessageById = new Map<string, string>()

    for (const msg of turnMessages) {
      const entries = ensurePartKeys(msg)
      for (const entry of entries) {
        combinedEntries.push(entry)
        if (entry.kind === 'tool' && entry.toolRunId) {
          if (!callMessageById.has(entry.toolRunId)) {
            callMessageById.set(entry.toolRunId, msg.id)
          }
        } else if (entry.kind !== 'text') {
          const arr = nonTextPartKeysByKind.get(entry.kind) ?? []
          arr.push({ key: entry.key, messageId: msg.id })
          nonTextPartKeysByKind.set(entry.kind, arr)
        }
      }
      for (const p of msg.parts) {
        combinedParts.push(p)
      }
    }

    // Build segments across the turn's combined parts (cross-message text merging bounded by turn)
    const rawSegments = messageSegments(combinedParts)

    const textPartSegments = textPartGroups(combinedEntries)

    // Build latest call map with merged results & latest input (D-067)
    const callsById = new Map<string, ToolCall>()
    for (const seg of rawSegments) {
      if (seg.kind !== 'tools') continue
      for (const call of seg.calls) {
        const res = toolResults.get(call.toolUseId) ?? call.result
        const latestInput = latestToolCallInput.get(call.toolUseId) ?? call.input
        callsById.set(call.toolUseId, {
          ...call,
          input: latestInput,
          ...(res !== undefined ? { result: res } : {})
        })
      }
    }

    // Live presence handling (D-084 · y10 · y20)
    const segments: (MessageSegment & { __live?: true })[] = [...rawSegments]
    let liveIndex = -1
    let appendedLiveSegment = false
    if (active && liveReasoning && segments.at(-1)?.kind !== 'reasoning') {
      segments.push({ kind: 'reasoning', items: [] })
    }
    if (active && liveText) {
      if (segments.at(-1)?.kind !== 'text') {
        segments.push({ kind: 'text', text: '', __live: true })
        appendedLiveSegment = true
      }
      liveIndex = segments.length - 1
    }

    const blocks: OpenCodeBlock[] = []
    let textSegIdx = 0
    const nonTextCursors = new Map<string, number>()

    for (let index = 0; index < segments.length; index++) {
      const seg = segments[index]
      if (seg.kind === 'reasoning') continue

      if (seg.kind === 'tools') {
        const dedupedCalls: ToolCall[] = []
        for (const call of seg.calls) {
          if (seenGlobalTools.has(call.toolUseId)) continue
          seenGlobalTools.add(call.toolUseId)
          const current = callsById.get(call.toolUseId) ?? call
          if (toolKind(current) !== 'todo') dedupedCalls.push(current)
        }
        const groups = groupTools(dedupedCalls)
        for (const group of groups) {
          const prevBlock = blocks.at(-1)
          const firstToolId = group[0].toolUseId
          const ownerMsgId = callMessageById.get(firstToolId) ?? firstId
          const key = toolBlockKey(ownerMsgId, firstToolId)
          const partKeys = group.map((c) =>
            toolBlockKey(callMessageById.get(c.toolUseId) ?? ownerMsgId, c.toolUseId)
          )
          for (const c of group) {
            if (!toolOwnerBlockKey.has(c.toolUseId)) {
              toolOwnerBlockKey.set(c.toolUseId, { messageId: ownerMsgId, blockKey: key })
            }
          }
          const gap: OpenCodeBlockGap =
            !prevBlock && !hasPreviousBlock
              ? 0
              : !prevBlock
                ? 16
                : prevBlock.kind === 'segment' && prevBlock.segment.kind === 'tools'
                  ? 8
                  : 16
          blocks.push({
            kind: 'segment',
            key,
            messageId: ownerMsgId,
            partKeys,
            segment: { kind: 'tools', calls: group },
            streaming: false,
            gap
          })
        }
        continue
      }

      const prevBlock = blocks.at(-1)
      const gap: OpenCodeBlockGap = !prevBlock && !hasPreviousBlock ? 0 : 16
      const isLiveSeg = index === liveIndex

      if (seg.kind === 'text') {
        let key: string
        let partKeys: string[]
        let sourceParts: readonly MarkdownSourcePart[] | undefined
        let ownerMsgId = firstId
        if (isLiveSeg && appendedLiveSegment) {
          // Live text starting a brand-new text segment: peek without consuming (D-084 · y20)
          const targetMsgId = liveTextKey ?? turnMessages[turnMessages.length - 1]?.id ?? firstId
          ownerMsgId = targetMsgId
          key = nextPartKey(tracker, targetMsgId, 'text')
          partKeys = [key]
        } else {
          sourceParts = textPartSegments[textSegIdx++]
          const pks = sourceParts?.map((part) => part.key) ?? []
          if (pks.length > 0) {
            const rep = representativePart(textRefs, pks)
            key = rep.repPartKey
            partKeys = pks
            const colonIdx = key.indexOf(':text:')
            if (colonIdx > 0) ownerMsgId = key.slice(0, colonIdx)
          } else {
            key = tracker.allocate(firstId, 'text')
            partKeys = [key]
          }
        }
        blocks.push({
          kind: 'segment',
          key,
          messageId: ownerMsgId,
          partKeys,
          sourceParts,
          segment: { kind: 'text', text: seg.text },
          streaming: active && index === segments.length - 1,
          ...(isLiveSeg ? { live: true as const } : {}),
          gap
        })
        continue
      }

      // ask / compact / error / notice
      let key: string
      let ownerMsgId = firstId
      if (seg.kind === 'ask') {
        if (seenGlobalTools.has(seg.call.toolUseId)) continue
        seenGlobalTools.add(seg.call.toolUseId)
        ownerMsgId = callMessageById.get(seg.call.toolUseId) ?? firstId
        key = toolBlockKey(ownerMsgId, seg.call.toolUseId)
        if (!toolOwnerBlockKey.has(seg.call.toolUseId)) {
          toolOwnerBlockKey.set(seg.call.toolUseId, { messageId: ownerMsgId, blockKey: key })
        }
      } else {
        const listForKind = nonTextPartKeysByKind.get(seg.kind) ?? []
        const cur = nonTextCursors.get(seg.kind) ?? 0
        nonTextCursors.set(seg.kind, cur + 1)
        const item = listForKind[cur]
        if (item) {
          key = item.key
          ownerMsgId = item.messageId
        } else {
          key = tracker.allocate(firstId, seg.kind)
        }
      }
      blocks.push({
        kind: 'segment',
        key,
        messageId: ownerMsgId,
        partKeys: [key],
        segment: seg,
        streaming: false,
        gap
      })
    }

    const artifacts = partsArtifacts(combinedParts)
    if (artifacts.length > 0) {
      blocks.push({
        kind: 'artifacts',
        key: turnArtifactsKey(firstId),
        messageId: firstId,
        artifacts,
        gap: blocks.length > 0 || hasPreviousBlock ? 16 : 0
      })
    }

    if (turnMessages.some((m) => m.incomplete)) {
      blocks.push({
        kind: 'incomplete',
        key: `${firstId}:incomplete`,
        messageId: firstId,
        gap: blocks.length > 0 || hasPreviousBlock ? 16 : 0
      })
    }

    if (!active) {
      const lastMsg = turnMessages[turnMessages.length - 1]
      blocks.push({
        kind: 'meta',
        key: turnMetaKey(firstId),
        messageId: firstId,
        turn: { role: 'assistant', messages: [...turnMessages], startIndex: 0 },
        copyable: turnMessages.some((m) => hasPartsText(m.parts)),
        createdAt: lastMsg.createdAt,
        gap: blocks.length > 0 || hasPreviousBlock ? 16 : 0
      })
    }

    return blocks
  }

  function rebuildAll(
    messages: readonly Message[],
    opts: typeof prevOpts
  ): BlockSnapshot<OpenCodeBlock> {
    const oldSnap = list.snapshot()
    const oldBlocks: OpenCodeBlock[] = []
    for (let i = 0; i < oldSnap.count; i++) oldBlocks.push(oldSnap.blockAt(i))
    prevTextRefs = extractTextGroupRefs(oldBlocks)

    messageById.clear()
    visibleById.clear()
    toolResults.clear()
    toolResultsByMessage.clear()
    toolResultStacks.clear()
    toolOwnerBlockKey.clear()
    latestToolCallInput.clear()
    msgToTurn.clear()
    turns = []
    initialLiveKey = undefined

    const visibleMessages: Message[] = []
    for (const msg of messages) {
      messageById.set(msg.id, msg)
      const vis = filterVisibleMessage(msg, opts.showAutomaticFeeds)
      visibleById.set(msg.id, vis)
      indexMessageToolParts(msg, 0)
      if (vis) visibleMessages.push(vis)
    }

    const grouped: { role: 'user' | 'assistant'; messages: Message[] }[] = []
    for (const msg of visibleMessages) {
      const prev = grouped[grouped.length - 1]
      const prevM = prev?.messages[prev.messages.length - 1]
      if (!prev || prev.role !== msg.role || isTurnStart(prevM, msg)) {
        grouped.push({ role: msg.role, messages: [msg] })
      } else {
        prev.messages.push(msg)
      }
    }

    const allBlocks: OpenCodeBlock[] = []
    const seenTools = new Set<string>()

    for (let tIdx = 0; tIdx < grouped.length; tIdx++) {
      const g = grouped[tIdx]
      const firstId = g.messages[0].id
      const tr: TurnGroup = {
        id: firstId,
        role: g.role,
        messageIds: g.messages.map((m) => m.id),
        blockKeys: []
      }
      for (const m of g.messages) msgToTurn.set(m.id, tr)

      if (g.role === 'user') {
        const key = userBlockKey(firstId)
        allBlocks.push({
          kind: 'user',
          key,
          messageId: firstId,
          partKeys: [key],
          turn: { role: 'user', messages: g.messages, startIndex: tIdx },
          gap: allBlocks.length === 0 ? 0 : 24
        })
        tr.blockKeys.push(key)
      } else {
        const isLastTurn = tIdx === grouped.length - 1
        const active = isLastTurn && opts.pending
        const turnBlocks = buildAssistantTurnBlocks(
          g.messages,
          firstId,
          allBlocks.length > 0,
          active,
          opts.liveText,
          opts.liveReasoning,
          opts.liveTextKey,
          prevTextRefs,
          seenTools
        )
        for (const b of turnBlocks) {
          allBlocks.push(b)
          tr.blockKeys.push(b.key)
        }
      }
      turns.push(tr)
    }

    // Initial live text before any assistant message (or before any message at all)
    if (opts.pending && opts.liveText) {
      const lastTurn = turns[turns.length - 1]
      if (!lastTurn || lastTurn.role === 'user') {
        const key = opts.liveTextKey
          ? nextPartKey(tracker, opts.liveTextKey, 'text')
          : 'initial:text'
        initialLiveKey = key
        allBlocks.push({
          kind: 'segment',
          key,
          messageId: opts.liveTextKey ?? 'initial',
          partKeys: [key],
          segment: { kind: 'text', text: '' },
          streaming: true,
          live: true,
          gap: allBlocks.length === 0 ? 0 : 16
        })
      }
    }

    assertUniqueBlockKeys(allBlocks)
    list = createBlockList(allBlocks)
    return list.snapshot()
  }

  function findTurnStartIndex(snap: BlockSnapshot<OpenCodeBlock>, turn: TurnGroup): number {
    for (const k of turn.blockKeys) {
      const idx = snap.indexOf(k)
      if (idx >= 0) return idx
    }
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

  function rebuildSingleTurn(turn: TurnGroup, opts: typeof prevOpts): void {
    const snap = list.snapshot()
    const startIdx = findTurnStartIndex(snap, turn)
    const oldCount = turn.blockKeys.length
    const oldTurnBlocks: OpenCodeBlock[] = []
    for (let i = 0; i < oldCount; i++) {
      if (startIdx + i < snap.count) oldTurnBlocks.push(snap.blockAt(startIdx + i))
    }
    const turnTextRefs = extractTextGroupRefs(oldTurnBlocks)

    const turnMessages = turn.messageIds
      .map((id) => visibleById.get(id))
      .filter((m): m is Message => m !== undefined)

    if (turnMessages.length === 0) {
      if (oldCount > 0) list.splice(startIdx, oldCount, [])
      turn.blockKeys = []
      return
    }

    const isLastTurn = turns[turns.length - 1] === turn
    const newBlocks: OpenCodeBlock[] = []
    if (turn.role === 'user') {
      const key = userBlockKey(turn.id)
      newBlocks.push({
        kind: 'user',
        key,
        messageId: turn.id,
        partKeys: [key],
        turn: { role: 'user', messages: turnMessages, startIndex: 0 },
        gap: startIdx === 0 ? 0 : 24
      })
    } else {
      const seenTools = new Set<string>()
      for (const [toolId, owner] of toolOwnerBlockKey) {
        if (!turn.messageIds.includes(owner.messageId)) {
          seenTools.add(toolId)
        }
      }
      const built = buildAssistantTurnBlocks(
        turnMessages,
        turn.id,
        startIdx > 0,
        isLastTurn && opts.pending,
        opts.liveText,
        opts.liveReasoning,
        opts.liveTextKey,
        turnTextRefs,
        seenTools
      )
      for (const b of built) newBlocks.push(b)
    }

    turn.blockKeys = newBlocks.map((b) => b.key)
    list.splice(startIdx, oldCount, newBlocks)
  }

  function updateToolBlockInPlace(toolRunId: string): void {
    const owner = toolOwnerBlockKey.get(toolRunId)
    if (!owner) return
    const snap = list.snapshot()
    const idx = snap.indexOf(owner.blockKey)
    if (idx < 0) return
    const block = snap.blockAt(idx)
    if (block.kind !== 'segment') return
    if (block.segment.kind === 'tools') {
      let changed = false
      const nextCalls = block.segment.calls.map((c) => {
        if (c.toolUseId !== toolRunId) return c
        const res = toolResults.get(toolRunId)
        const inp = latestToolCallInput.get(toolRunId) ?? c.input
        if (res === c.result && inp === c.input) return c
        changed = true
        const copy: ToolCall = { ...c, input: inp }
        if (res !== undefined) copy.result = res
        else delete copy.result
        return copy
      })
      if (changed) {
        list.splice(idx, 1, [{ ...block, segment: { kind: 'tools', calls: nextCalls } }])
      }
    } else if (block.segment.kind === 'ask' && block.segment.call.toolUseId === toolRunId) {
      const c = block.segment.call
      const res = toolResults.get(toolRunId)
      const inp = latestToolCallInput.get(toolRunId) ?? c.input
      if (res !== c.result || inp !== c.input) {
        const copy: ToolCall = { ...c, input: inp }
        if (res !== undefined) copy.result = res
        else delete copy.result
        list.splice(idx, 1, [{ ...block, segment: { kind: 'ask', call: copy } }])
      }
    }
  }

  function syncInitialLiveBlock(opts: typeof prevOpts): void {
    const lastTurn = turns[turns.length - 1]
    const wantInitialLive = opts.pending && opts.liveText && (!lastTurn || lastTurn.role === 'user')
    const snap = list.snapshot()
    if (initialLiveKey) {
      const idx = snap.indexOf(initialLiveKey)
      if (!wantInitialLive) {
        if (idx >= 0) list.splice(idx, 1, [])
        initialLiveKey = undefined
        return
      }
      const desiredKey = opts.liveTextKey
        ? nextPartKey(tracker, opts.liveTextKey, 'text')
        : 'initial:text'
      if (desiredKey !== initialLiveKey && idx >= 0) {
        initialLiveKey = desiredKey
        list.splice(idx, 1, [
          {
            kind: 'segment',
            key: desiredKey,
            messageId: opts.liveTextKey ?? 'initial',
            partKeys: [desiredKey],
            segment: { kind: 'text', text: '' },
            streaming: true,
            live: true,
            gap: idx === 0 ? 0 : 16
          }
        ])
      }
    } else if (wantInitialLive) {
      const key = opts.liveTextKey ? nextPartKey(tracker, opts.liveTextKey, 'text') : 'initial:text'
      initialLiveKey = key
      list.splice(snap.count, 0, [
        {
          kind: 'segment',
          key,
          messageId: opts.liveTextKey ?? 'initial',
          partKeys: [key],
          segment: { kind: 'text', text: '' },
          streaming: true,
          live: true,
          gap: snap.count === 0 ? 0 : 16
        }
      ])
    }
  }

  return {
    snapshot: () => list.snapshot(),
    advance(state, rawOptions = {}) {
      const opts = {
        showAutomaticFeeds: rawOptions.showAutomaticFeeds ?? false,
        liveText: rawOptions.liveText ?? false,
        liveReasoning: rawOptions.liveReasoning ?? false,
        liveTextKey: rawOptions.liveTextKey,
        pending: rawOptions.pending ?? false
      }

      const { messages, transcriptChanges } = state
      const changes = changesSince(transcriptChanges, cursor)
      const liveOrPendingChanged =
        opts.liveText !== prevOpts.liveText ||
        opts.liveReasoning !== prevOpts.liveReasoning ||
        opts.liveTextKey !== prevOpts.liveTextKey ||
        opts.pending !== prevOpts.pending

      if (
        changes !== 'reset' &&
        changes.length === 0 &&
        opts.showAutomaticFeeds === prevOpts.showAutomaticFeeds &&
        !liveOrPendingChanged &&
        cursor !== undefined
      ) {
        return list.snapshot()
      }

      const mustRebuild =
        changes === 'reset' ||
        changes.some((c) => c.kind === 'reset') ||
        opts.showAutomaticFeeds !== prevOpts.showAutomaticFeeds

      if (mustRebuild) {
        const snap = rebuildAll(messages, opts)
        cursor = { lineage: transcriptChanges.lineage, revision: transcriptChanges.revision }
        prevOpts = opts
        return snap
      }

      const affectedTurns = new Set<TurnGroup>()
      const lateResultTools = new Set<string>()
      const oldLastTurn = turns[turns.length - 1]

      if (changes.length > 0) {
        const order = messageOrderFor(state, true)
        const folded = foldChanges(changes)

        // 1. Handle T-preserving prepends (z6)
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
            const prefixBlocks: OpenCodeBlock[] = []
            const prefixTurns: TurnGroup[] = []
            const seenTools = new Set<string>()
            for (const g of prefixGrouped) {
              const firstId = g.messages[0].id
              const tr: TurnGroup = {
                id: firstId,
                role: g.role,
                messageIds: g.messages.map((m) => m.id),
                blockKeys: []
              }
              for (const m of g.messages) msgToTurn.set(m.id, tr)
              if (g.role === 'user') {
                const key = userBlockKey(firstId)
                prefixBlocks.push({
                  kind: 'user',
                  key,
                  messageId: firstId,
                  partKeys: [key],
                  turn: { role: 'user', messages: g.messages, startIndex: 0 },
                  gap: prefixBlocks.length === 0 ? 0 : 24
                })
                tr.blockKeys.push(key)
              } else {
                const tb = buildAssistantTurnBlocks(
                  g.messages,
                  firstId,
                  prefixBlocks.length > 0,
                  false,
                  false,
                  false,
                  undefined,
                  [],
                  seenTools
                )
                for (const b of tb) {
                  prefixBlocks.push(b)
                  tr.blockKeys.push(b.key)
                }
              }
              prefixTurns.push(tr)
            }

            const curSnap = list.snapshot()
            if (curSnap.count > 0 && prefixBlocks.length > 0) {
              const oldFirst = curSnap.blockAt(0)
              if (oldFirst.gap === 0) {
                list.splice(0, 1, [{ ...oldFirst, gap: oldFirst.kind === 'user' ? 24 : 16 }])
              }
              list.splice(0, 0, prefixBlocks)
            } else if (prefixBlocks.length > 0) {
              list.splice(0, 0, prefixBlocks)
            }
            turns = [...prefixTurns, ...turns]
          }
        }

        // 2. Handle append / replace / remove
        const prependedSet = new Set(prependedIds)
        for (const [id, partsFrom] of folded) {
          if (prependedSet.has(id)) continue
          const pos = order.messagePosition(id)
          if (pos < 0) {
            for (const tid of retractMessageToolResults(id, 0)) lateResultTools.add(tid)
            messageById.delete(id)
            visibleById.delete(id)
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
          for (const tid of retractMessageToolResults(id, partsFrom)) lateResultTools.add(tid)
          for (const tid of indexMessageToolParts(msg, partsFrom)) lateResultTools.add(tid)

          messageById.set(id, msg)
          const vis = filterVisibleMessage(msg, opts.showAutomaticFeeds)
          visibleById.set(id, vis)

          if (prevTurn) {
            affectedTurns.add(prevTurn)
          } else if (vis) {
            // Remove initial live placeholder before appending a new assistant message
            if (initialLiveKey && vis.role === 'assistant') {
              const curSnap = list.snapshot()
              const idx = curSnap.indexOf(initialLiveKey)
              if (idx >= 0) list.splice(idx, 1, [])
              initialLiveKey = undefined
            }
            const lastTurn = turns[turns.length - 1]
            const lastMsg = lastTurn
              ? visibleById.get(lastTurn.messageIds[lastTurn.messageIds.length - 1])
              : undefined
            if (lastTurn && lastTurn.role === vis.role && !isTurnStart(lastMsg, vis)) {
              lastTurn.messageIds.push(vis.id)
              msgToTurn.set(vis.id, lastTurn)
              affectedTurns.add(lastTurn)
            } else {
              if (lastTurn) affectedTurns.add(lastTurn)
              const newTurn: TurnGroup = {
                id: vis.id,
                role: vis.role,
                messageIds: [vis.id],
                blockKeys: []
              }
              msgToTurn.set(vis.id, newTurn)
              turns.push(newTurn)
              affectedTurns.add(newTurn)
            }
          }
        }

        // Remove initial live placeholder if a new turn became the last turn
        if (initialLiveKey && turns[turns.length - 1]?.role === 'assistant') {
          const curSnap = list.snapshot()
          const idx = curSnap.indexOf(initialLiveKey)
          if (idx >= 0) list.splice(idx, 1, [])
          initialLiveKey = undefined
        }

        for (const tr of affectedTurns) {
          rebuildSingleTurn(tr, opts)
        }
        turns = turns.filter((t) => t.messageIds.length > 0)

        const afterSnap = list.snapshot()
        if (afterSnap.count > 0) {
          const first = afterSnap.blockAt(0)
          if (first.gap !== 0) {
            list.splice(0, 1, [{ ...first, gap: 0 }])
          }
        }

        for (const toolRunId of lateResultTools) {
          const ownerMsgId = order.toolCallOwner(toolRunId)
          if (ownerMsgId) {
            updateToolBlockInPlace(toolRunId)
          }
        }
      }

      // If live/pending changed and the last assistant turn wasn't already rebuilt, rebuild only it (z7)
      const currentLastTurn = turns[turns.length - 1]
      if (liveOrPendingChanged) {
        if (
          oldLastTurn &&
          oldLastTurn !== currentLastTurn &&
          oldLastTurn.role === 'assistant' &&
          !affectedTurns.has(oldLastTurn)
        ) {
          rebuildSingleTurn(oldLastTurn, opts)
        }
        if (
          currentLastTurn &&
          currentLastTurn.role === 'assistant' &&
          !affectedTurns.has(currentLastTurn)
        ) {
          rebuildSingleTurn(currentLastTurn, opts)
        }
      }

      syncInitialLiveBlock(opts)

      cursor = { lineage: transcriptChanges.lineage, revision: transcriptChanges.revision }
      prevOpts = opts
      return list.snapshot()
    }
  }
}
