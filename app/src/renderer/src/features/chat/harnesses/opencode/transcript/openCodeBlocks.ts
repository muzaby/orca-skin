import {
  deferredBlock,
  splitDeferred,
  type DeferredBlock
} from '../../../lib/transcript/deferredBody'
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
  hasSegmentText,
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
  changedMessageLocations,
  changesSince,
  foldChanges,
  type TranscriptChanges,
  type TranscriptRevision
} from '../../../lib/transcript/changeLog'
import { messageOrderFor } from '../../../lib/transcript/messageOrder'
import { createSegmentCache } from '../../../lib/segmentCache'
import { deepEqual } from '../../../lib/transcript/viewEqual'
import { OrderedToolParts } from '../../../lib/transcript/orderedToolParts'
import { isTurnStart } from '../../../lib/transcript/turnStart'
import {
  assertUniqueBlockKeys,
  carryPartKeys,
  nextPartKey,
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
  | DeferredBlock
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

function userGroupKeys(
  messages: readonly Message[],
  previousPosition?: (key: string) => number | undefined
): Pick<OpenCodeUserBlock, 'key' | 'partKeys'> {
  const partKeys = messages.map((message) => userBlockKey(message.id))
  let key = partKeys[0]
  let first = Infinity
  if (previousPosition && partKeys.length > 1) {
    for (const candidate of partKeys) {
      const index = previousPosition(candidate)
      if (index !== undefined && index >= 0 && index < first) {
        key = candidate
        first = index
      }
    }
  }
  return { key, partKeys }
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

export function createOpenCodeBlockModel(
  onAssistantBlockAllocated?: (block: OpenCodeBlock) => void
): OpenCodeBlockModel {
  function allocated<Block extends OpenCodeBlock>(block: Block): Block {
    onAssistantBlockAllocated?.(block)
    return block
  }
  const list: BlockList<OpenCodeBlock> = createBlockList<OpenCodeBlock>()
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
  const assistantParts = new Map<
    string,
    {
      cache: ReturnType<typeof createSegmentCache>
      segments: readonly MessageSegment[]
      artifacts: { index: number; part: Extract<AppMessagePart, { type: 'artifact' }> }[]
      firstCopyable: number
      firstText: number
    }
  >()
  const messageById = new Map<string, Message>()
  const visibleById = new Map<string, Message | undefined>()

  // Tool results & deduplication
  const toolResults = new OrderedToolParts<ToolResult>()
  const toolInputs = new OrderedToolParts<Record<string, unknown>>()
  const toolOwnerBlockKey = new Map<string, { messageId: string; blockKey: string }>()

  let turns: TurnGroup[] = []
  const msgToTurn = new Map<string, TurnGroup>()
  let initialLiveKey: string | undefined
  let prevTextRefs: MultiPartGroupRef[] = []

  function retractMessageTools(messageId: string, from: number): Set<string> {
    const affected = new Set<string>()
    toolResults.retract(messageId, from, affected)
    toolInputs.retract(messageId, from, affected)
    return affected
  }

  function indexMessageToolParts(
    message: Message,
    partsFrom: number,
    order?: ReturnType<typeof messageOrderFor>
  ): Set<string> {
    if (message.role === 'assistant') projectAssistantMessage(message, partsFrom)
    const affected = retractMessageTools(message.id, partsFrom)
    for (let i = partsFrom; i < message.parts.length; i++) {
      const part = message.parts[i]
      if (part.type === 'tool_result') {
        toolResults.put(part.toolRunId, message.id, i, toolResultFromPart(part), order)
        affected.add(part.toolRunId)
      } else if (part.type === 'tool_call' && part.parentToolRunId === undefined) {
        const input =
          part.args && typeof part.args === 'object' ? (part.args as Record<string, unknown>) : {}
        toolInputs.put(part.toolRunId, message.id, i, input, order)
        affected.add(part.toolRunId)
      }
    }
    return affected
  }

  function registerToolOwner(toolId: string, messageId: string, blockKey: string): void {
    const previous = toolOwnerBlockKey.get(toolId)
    if (!previous || (previous.messageId === messageId && previous.blockKey !== blockKey)) {
      toolOwnerBlockKey.set(toolId, { messageId, blockKey })
    }
  }

  function projectAssistantMessage(message: Message, partsFrom: number): void {
    const previous = assistantParts.get(message.id)
    const from = previous ? Math.min(partsFrom, message.parts.length) : 0
    const previousKeys = partKeysByMessage.get(message.id) ?? []
    const suffix = from ? message.parts.slice(from) : message.parts
    const keys = carryPartKeys(
      tracker,
      message.id,
      from ? previousKeys.filter((e) => e.partIndex >= from) : previousKeys,
      from ? { ...message, parts: suffix } : message
    )
    partKeysByMessage.set(
      message.id,
      from
        ? [
            ...previousKeys.filter((e) => e.partIndex < from),
            ...keys.map((e) => ({ ...e, partIndex: e.partIndex + from }))
          ]
        : keys
    )
    const artifacts = from && previous ? previous.artifacts.filter((a) => a.index < from) : []
    let firstText = previous && previous.firstText < from ? previous.firstText : Infinity
    let firstCopyable =
      previous && previous.firstCopyable < from ? previous.firstCopyable : Infinity
    for (let i = 0; i < suffix.length; i++) {
      const p = suffix[i]
      if (p.type === 'artifact') artifacts.push({ index: from + i, part: p })
      if (p.type === 'text' && p.parentToolRunId === undefined && hasSegmentText(p.text)) {
        firstText = Math.min(firstText, from + i)
        if (firstCopyable === Infinity && p.text.trim()) firstCopyable = from + i
      }
    }
    const cache = previous?.cache ?? createSegmentCache()
    const segments = cache.segmentsFor(message, from)
    assistantParts.set(message.id, { cache, segments, artifacts, firstText, firstCopyable })
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
    seenGlobalTools: Set<string>,
    previous?: ReadonlyMap<string, OpenCodeBlock>
  ): OpenCodeBlock[] {
    if (turnMessages.some((message) => message.deferredBody)) {
      return splitDeferred<OpenCodeBlock>(
        turnMessages,
        (part, last) =>
          buildAssistantTurnBlocks(
            part,
            part[0].id,
            hasPreviousBlock || part[0] !== turnMessages[0],
            last && active,
            last && liveText,
            last && liveReasoning,
            liveTextKey,
            [],
            seenGlobalTools,
            previous
          ).filter((block) => last || block.kind !== 'meta'),
        (ref) => deferredBlock(ref, !hasPreviousBlock && ref.message === turnMessages[0].id)
      )
    }
    // Collect parts along with their owning messageId and stable part keys
    const artifactParts: AppMessagePart[] = []
    const rawSegments: MessageSegment[] = []
    let copyable = false
    let writableTail: MessageSegment | undefined
    const combinedEntries: PartKeyEntry[] = []
    const nonTextPartKeysByKind = new Map<string, { key: string; messageId: string }[]>()
    const callMessageById = new Map<string, string>()
    let lastTextOwner: string | undefined

    for (const msg of turnMessages) {
      const projection = assistantParts.get(msg.id)!
      const entries = partKeysByMessage.get(msg.id) ?? []
      const previousText = rawSegments.at(-1)
      let leadingWhitespace = ''
      for (const entry of entries) {
        combinedEntries.push(entry)
        if (
          previousText?.kind === 'text' &&
          entry.partIndex < projection.cache.firstSegmentStart &&
          entry.kind === 'text'
        ) {
          leadingWhitespace += entry.signature?.slice('text:'.length) ?? ''
        }
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
      if (leadingWhitespace && previousText?.kind === 'text') {
        rawSegments[rawSegments.length - 1] = {
          kind: 'text',
          text: previousText.text + leadingWhitespace
        }
      }
      if (projection.firstText !== Infinity) lastTextOwner = msg.id
      copyable ||= projection.firstCopyable !== Infinity
      for (const { part } of projection.artifacts) artifactParts.push(part)
      // A rendered segment can cross a message boundary. Join only the two
      // boundary segments; each message's cached segments stay immutable.
      for (const segment of projection.segments) {
        if (segment.kind === 'reasoning' && rawSegments.at(-1)?.kind === 'tools') continue
        const last = rawSegments.at(-1)
        if (last?.kind === 'text' && segment.kind === 'text') {
          rawSegments[rawSegments.length - 1] = { kind: 'text', text: last.text + segment.text }
        } else if (last?.kind === 'tools' && segment.kind === 'tools') {
          const tail = writableTail === last ? last : { ...last, calls: last.calls.slice() }
          for (const call of segment.calls) tail.calls.push(call)
          rawSegments[rawSegments.length - 1] = writableTail = tail
        } else if (last?.kind === 'reasoning' && segment.kind === 'reasoning') {
          const tail = writableTail === last ? last : { ...last, items: last.items.slice() }
          for (const item of segment.items) tail.items.push(item)
          rawSegments[rawSegments.length - 1] = writableTail = tail
        } else rawSegments.push(segment)
      }
    }

    const textPartSegments = textPartGroups(combinedEntries)

    // Build latest call map with merged results & latest input (D-067)
    const callsById = new Map<string, ToolCall>()
    for (const seg of rawSegments) {
      const calls = seg.kind === 'tools' ? seg.calls : seg.kind === 'ask' ? [seg.call] : []
      for (const call of calls) {
        const res = toolResults.latest(call.toolUseId) ?? call.result
        const latestInput = toolInputs.latest(call.toolUseId) ?? call.input
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
      const changesOwner = liveTextKey !== undefined && liveTextKey !== lastTextOwner
      if (segments.at(-1)?.kind !== 'text' || changesOwner) {
        segments.push({ kind: 'text', text: '', __live: true })
        appendedLiveSegment = true
      }
      liveIndex = segments.length - 1
    }

    const blocks: OpenCodeBlock[] = []
    function append(
      key: string,
      matches: (block: OpenCodeBlock) => boolean,
      create: () => OpenCodeBlock
    ): void {
      const prior = previous?.get(key)
      if (prior && matches(prior)) {
        blocks.push(prior)
        return
      }
      blocks.push(allocated(create()))
    }

    function appendSegment(
      key: string,
      messageId: string,
      partKeys: readonly string[],
      gap: OpenCodeBlockGap,
      streaming: boolean,
      live: boolean,
      sourceParts: readonly MarkdownSourcePart[] | undefined,
      sameSegment: (prior: MessageSegment) => boolean,
      createSegment: () => MessageSegment
    ): void {
      append(
        key,
        (prior) =>
          prior.kind === 'segment' &&
          prior.messageId === messageId &&
          prior.gap === gap &&
          prior.streaming === streaming &&
          !!prior.live === live &&
          deepEqual(prior.partKeys, partKeys) &&
          deepEqual(prior.sourceParts, sourceParts) &&
          sameSegment(prior.segment),
        () => {
          const segment = createSegment()
          return {
            kind: 'segment',
            key,
            messageId,
            partKeys,
            gap,
            streaming,
            ...(segment.kind === 'text' ? { sourceParts } : {}),
            ...(live ? { live: true as const } : {}),
            segment
          }
        }
      )
    }
    let textSegIdx = 0
    const nonTextCursors = new Map<string, number>()

    for (let index = 0; index < segments.length; index++) {
      const seg = segments[index]
      if (seg.kind === 'reasoning') continue

      if (seg.kind === 'tools') {
        const dedupedCalls: ToolCall[] = []
        for (const call of seg.calls) {
          if (
            seenGlobalTools.has(call.toolUseId) ||
            callMessageById.get(call.toolUseId) !== toolInputs.firstOwner(call.toolUseId)
          )
            continue
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
            registerToolOwner(c.toolUseId, callMessageById.get(c.toolUseId) ?? ownerMsgId, key)
          }
          const gap: OpenCodeBlockGap =
            !prevBlock && !hasPreviousBlock
              ? 0
              : !prevBlock
                ? 16
                : prevBlock.kind === 'segment' && prevBlock.segment.kind === 'tools'
                  ? 8
                  : 16
          appendSegment(
            key,
            ownerMsgId,
            partKeys,
            gap,
            false,
            false,
            undefined,
            (prior) => prior.kind === 'tools' && deepEqual(prior.calls, group),
            () => ({ kind: 'tools', calls: group })
          )
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
        appendSegment(
          key,
          ownerMsgId,
          partKeys,
          gap,
          isLiveSeg,
          isLiveSeg,
          sourceParts,
          (prior) => prior.kind === 'text' && prior.text === seg.text,
          () => ({ kind: 'text', text: seg.text })
        )
        continue
      }

      // ask / compact / error / notice
      let key: string
      let ownerMsgId = firstId
      if (seg.kind === 'ask') {
        if (
          seenGlobalTools.has(seg.call.toolUseId) ||
          callMessageById.get(seg.call.toolUseId) !== toolInputs.firstOwner(seg.call.toolUseId)
        )
          continue
        seenGlobalTools.add(seg.call.toolUseId)
        ownerMsgId = callMessageById.get(seg.call.toolUseId) ?? firstId
        key = toolBlockKey(ownerMsgId, seg.call.toolUseId)
        registerToolOwner(seg.call.toolUseId, ownerMsgId, key)
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
      if (seg.kind === 'ask') {
        const call = callsById.get(seg.call.toolUseId) ?? seg.call
        appendSegment(
          key,
          ownerMsgId,
          [key],
          gap,
          false,
          false,
          undefined,
          (prior) => prior.kind === 'ask' && deepEqual(prior.call, call),
          () => ({ ...seg, call })
        )
      } else {
        appendSegment(
          key,
          ownerMsgId,
          [key],
          gap,
          false,
          false,
          undefined,
          (prior) => deepEqual(prior, seg),
          () => seg
        )
      }
    }

    const artifacts = partsArtifacts(artifactParts)
    if (artifacts.length > 0) {
      const key = turnArtifactsKey(firstId)
      const gap = blocks.length > 0 || hasPreviousBlock ? 16 : 0
      append(
        key,
        (prior) =>
          prior.kind === 'artifacts' && prior.gap === gap && deepEqual(prior.artifacts, artifacts),
        () => ({ kind: 'artifacts', key, messageId: firstId, artifacts, gap })
      )
    }

    if (turnMessages.some((m) => m.incomplete)) {
      const key = `${firstId}:incomplete`
      const gap = blocks.length > 0 || hasPreviousBlock ? 16 : 0
      append(
        key,
        (prior) => prior.kind === 'incomplete' && prior.gap === gap,
        () => ({ kind: 'incomplete', key, messageId: firstId, gap })
      )
    }

    if (!active) {
      const lastMsg = turnMessages[turnMessages.length - 1]
      blocks.push(
        allocated({
          kind: 'meta',
          key: turnMetaKey(firstId),
          messageId: firstId,
          turn: { role: 'assistant', messages: [...turnMessages], startIndex: 0 },
          copyable,
          createdAt: lastMsg.createdAt,
          gap: blocks.length > 0 || hasPreviousBlock ? 16 : 0
        })
      )
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
    const oldUsers = new Map<string, number>()
    for (let i = 0; i < oldBlocks.length; i++) {
      if (oldBlocks[i].kind === 'user') oldUsers.set(oldBlocks[i].key, i)
    }
    prevTextRefs = extractTextGroupRefs(oldBlocks)

    assistantParts.clear()
    messageById.clear()
    visibleById.clear()
    toolResults.clear()
    toolOwnerBlockKey.clear()
    toolInputs.clear()
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
        role: g.role,
        messageIds: g.messages.map((m) => m.id),
        blockKeys: []
      }
      for (const m of g.messages) msgToTurn.set(m.id, tr)

      if (g.role === 'user') {
        const { key, partKeys } = userGroupKeys(g.messages, (candidate) => oldUsers.get(candidate))
        allBlocks.push({
          kind: 'user',
          key,
          messageId: firstId,
          partKeys,
          turn: { role: 'user', messages: g.messages, startIndex: 0 },
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
    return list.splice(0, oldSnap.count, allBlocks)
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

  function rebuildSingleTurn(
    turn: TurnGroup,
    opts: typeof prevOpts,
    previousTextRefs?: MultiPartGroupRef[],
    previousSnapshot?: BlockSnapshot<OpenCodeBlock>
  ): void {
    const snap = list.snapshot()
    const startIdx = findTurnStartIndex(snap, turn)
    const oldCount = turn.blockKeys.length
    const oldTurnBlocks: OpenCodeBlock[] = []
    for (let i = 0; i < oldCount; i++) {
      if (startIdx + i < snap.count) oldTurnBlocks.push(snap.blockAt(startIdx + i))
    }
    const turnTextRefs = previousTextRefs ?? extractTextGroupRefs(oldTurnBlocks)

    const turnMessages = turn.messageIds
      .map((id) => visibleById.get(id))
      .filter((m): m is Message => m !== undefined)

    if (turnMessages.length === 0) {
      if (oldCount > 0) list.splice(startIdx, oldCount, [])
      turn.blockKeys = []
      return
    }

    const firstId = turnMessages[0].id
    const isLastTurn = turns[turns.length - 1] === turn
    const newBlocks: OpenCodeBlock[] = []
    if (turn.role === 'user') {
      const { key, partKeys } = userGroupKeys(turnMessages, (previousSnapshot ?? snap).indexOf)
      newBlocks.push({
        kind: 'user',
        key,
        messageId: firstId,
        partKeys,
        turn: { role: 'user', messages: turnMessages, startIndex: 0 },
        gap: startIdx === 0 ? 0 : 24
      })
    } else {
      const seenTools = new Set<string>()
      const built = buildAssistantTurnBlocks(
        turnMessages,
        firstId,
        startIdx > 0,
        isLastTurn && opts.pending,
        opts.liveText,
        opts.liveReasoning,
        opts.liveTextKey,
        turnTextRefs,
        seenTools,
        new Map(oldTurnBlocks.map((block) => [block.key, block]))
      )
      for (const b of built) newBlocks.push(b)
    }

    turn.blockKeys = newBlocks.map((b) => b.key)
    let head = 0,
      tail = 0
    while (head < oldCount && head < newBlocks.length && oldTurnBlocks[head] === newBlocks[head])
      head++
    while (
      tail < oldCount - head &&
      tail < newBlocks.length - head &&
      oldTurnBlocks[oldCount - 1 - tail] === newBlocks[newBlocks.length - 1 - tail]
    )
      tail++
    list.splice(
      startIdx + head,
      oldCount - head - tail,
      newBlocks.slice(head, newBlocks.length - tail)
    )
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
        const res = toolResults.latest(toolRunId)
        const inp = toolInputs.latest(toolRunId) ?? c.input
        if (res === c.result && inp === c.input) return c
        changed = true
        const copy: ToolCall = { ...c, input: inp }
        if (res !== undefined) copy.result = res
        else delete copy.result
        return copy
      })
      if (changed) {
        list.splice(idx, 1, [allocated({ ...block, segment: { kind: 'tools', calls: nextCalls } })])
      }
    } else if (block.segment.kind === 'ask' && block.segment.call.toolUseId === toolRunId) {
      const c = block.segment.call
      const res = toolResults.latest(toolRunId)
      const inp = toolInputs.latest(toolRunId) ?? c.input
      if (res !== c.result || inp !== c.input) {
        const copy: ToolCall = { ...c, input: inp }
        if (res !== undefined) copy.result = res
        else delete copy.result
        list.splice(idx, 1, [allocated({ ...block, segment: { kind: 'ask', call: copy } })])
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
        messageOrderFor(state, true)
        const snap = rebuildAll(messages, opts)
        cursor = { lineage: transcriptChanges.lineage, revision: transcriptChanges.revision }
        prevOpts = opts
        return snap
      }

      const affectedTurns = new Set<TurnGroup>()
      const affectedTools = new Set<string>()
      const oldLastTurn = turns[turns.length - 1]

      if (changes.length > 0) {
        const order = messageOrderFor(state, true)
        const folded = foldChanges(changes)
        const boundaryTurns = new Set<TurnGroup>()
        const original = list.snapshot()
        const retiredKeys: string[] = []

        // 1. Handle T-preserving prepends (z6)
        const { prependedIds, appendedIds, relocatedIds } = changedMessageLocations(changes)
        for (const id of relocatedIds) {
          const oldTurn = msgToTurn.get(id)
          if (!oldTurn) continue
          oldTurn.messageIds = oldTurn.messageIds.filter((mid) => mid !== id)
          msgToTurn.delete(id)
          affectedTurns.add(oldTurn)
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
              for (const toolId of indexMessageToolParts(m, 0, order)) affectedTools.add(toolId)
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
                role: g.role,
                messageIds: g.messages.map((m) => m.id),
                blockKeys: []
              }
              for (const m of g.messages) msgToTurn.set(m.id, tr)
              if (g.role === 'user') {
                const { key, partKeys } = userGroupKeys(g.messages, original.indexOf)
                prefixBlocks.push({
                  kind: 'user',
                  key,
                  messageId: firstId,
                  partKeys,
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
            if (turns[0]) boundaryTurns.add(turns[0])
            turns = [...prefixTurns, ...turns]
          }
        }

        // 2. Handle append / replace / remove
        const prependedSet = new Set(prependedIds)
        const orderedChanges = new Map(folded)
        for (const id of appendedIds) {
          orderedChanges.delete(id)
          orderedChanges.set(id, folded.get(id) ?? 0)
        }
        for (const [id, partsFrom] of orderedChanges) {
          if (prependedSet.has(id)) continue
          const pos = order.messagePosition(id)
          if (pos < 0) {
            for (const tid of retractMessageTools(id, 0)) affectedTools.add(tid)
            assistantParts.delete(id)
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
          for (const tid of indexMessageToolParts(msg, partsFrom, order)) affectedTools.add(tid)

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

        // Removing or prepending a duplicate call can move its rendered owner to another turn.
        for (const toolId of affectedTools) {
          const previous = toolOwnerBlockKey.get(toolId)
          const next = toolInputs.firstOwner(toolId)
          if (!previous || previous.messageId === next) continue
          toolOwnerBlockKey.delete(toolId)
          const previousTurn = msgToTurn.get(previous.messageId)
          const nextTurn = next === undefined ? undefined : msgToTurn.get(next)
          if (previousTurn) affectedTurns.add(previousTurn)
          if (nextTurn) affectedTurns.add(nextTurn)
        }

        for (const turn of affectedTurns) {
          if (turn.messageIds.length !== 0) continue
          const index = turns.indexOf(turn)
          if (index < 0) continue
          for (const key of turn.blockKeys) retiredKeys.push(key)
          rebuildSingleTurn(turn, opts)
          turns.splice(index, 1)
          affectedTurns.delete(turn)
          if (turns[index]) boundaryTurns.add(turns[index])
          else if (index > 0) affectedTurns.add(turns[index - 1])
        }
        for (const right of boundaryTurns) {
          const index = turns.indexOf(right)
          if (index <= 0) continue
          const left = turns[index - 1]
          if (left.role !== right.role) continue
          // Removing a separator joins the surviving runs. Keep both old block
          // ranges until the rebuild so representative keys come from both sides.
          for (const id of right.messageIds) {
            left.messageIds.push(id)
            msgToTurn.set(id, left)
          }
          left.blockKeys = left.blockKeys.concat(right.blockKeys)
          turns.splice(index, 1)
          affectedTurns.delete(right)
          affectedTurns.add(left)
        }
        let previousTextRefs: MultiPartGroupRef[] | undefined
        if (relocatedIds.size || boundaryTurns.size) {
          const indices = new Set<number>()
          for (const key of retiredKeys) indices.add(original.indexOf(key))
          for (const turn of affectedTurns) {
            for (const key of turn.blockKeys) indices.add(original.indexOf(key))
          }
          indices.delete(-1)
          const blocks = Array.from(indices)
            .sort((a, b) => a - b)
            .map((i) => original.blockAt(i))
          previousTextRefs = extractTextGroupRefs(blocks)
        }
        for (const tr of affectedTurns) {
          rebuildSingleTurn(tr, opts, previousTextRefs, original)
        }

        const afterSnap = list.snapshot()
        if (afterSnap.count > 0) {
          const first = afterSnap.blockAt(0)
          if (first.gap !== 0) {
            list.splice(0, 1, [{ ...first, gap: 0 }])
          }
        }

        for (const toolRunId of affectedTools) {
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
          msgToTurn.get(oldLastTurn.messageIds[0]) === oldLastTurn &&
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
