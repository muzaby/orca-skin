import type {
  HistoryPageRequest,
  HistoryPageReply,
  HistoryEdge,
  HistoryWindow,
  HistoryPrepared
} from '../../../shared/history-page'
import {
  HISTORY_PAGE_BYTES,
  HISTORY_BODY_BYTES,
  HISTORY_PAGE_MESSAGES,
  HISTORY_PAGE_PARTS
} from '../../../shared/history-page'
import type { ChatActivitySnapshot, LoadedMessage, LoadedSession } from '../../../shared/ipc'
import type { DbQueries } from '../../infra/db'
import type { HistoryIndexQueries, IndexHeader } from '../../infra/db/history-index-queries'
import { loadSessionMetadata } from './reader'

type Context = { db: DbQueries; getCwd: (projectId?: string | null) => string }
type EdgeKind = HistoryEdge['kind']
function edge(
  id: string,
  gen: string,
  at: IndexHeader,
  other: IndexHeader | undefined,
  before: boolean,
  unitFloor?: number,
  unitHeadKey?: string
): HistoryEdge | undefined {
  if (!other) return undefined
  const kind: EdgeKind =
    before && unitFloor !== undefined && other.turn >= unitFloor
      ? 'withinUnit'
      : at.turn === other.turn
        ? 'withinTurn'
        : before
          ? 'earlierTurn'
          : 'laterTurn'
  const cursor = Buffer.from(
    JSON.stringify([
      1,
      id,
      gen,
      kind,
      before ? 'before' : 'after',
      at.ordinal,
      at.message_key,
      ...(kind === 'withinUnit' ? [unitFloor, ...(unitHeadKey ? [unitHeadKey] : [])] : [])
    ])
  ).toString('base64url')
  return { kind, cursor }
}
function readCursor(
  index: HistoryIndexQueries,
  req: Extract<HistoryPageRequest, { cursor: string }>,
  gen: string
):
  | { next?: IndexHeader; floor?: number; unitHeadKey?: string; before?: HistoryEdge }
  | 'stale'
  | 'invalid' {
  let values: unknown
  try {
    values = JSON.parse(Buffer.from(req.cursor, 'base64url').toString())
  } catch {
    return 'invalid'
  }
  if (
    !Array.isArray(values) ||
    (req.kind === 'withinUnit' ? values.length !== 8 && values.length !== 9 : values.length !== 7)
  )
    return 'invalid'
  const [v, id, g, kind, direction, ordinal, key, floor, unitHeadKey] = values
  const before =
    req.kind === 'earlierTurn' ||
    req.kind === 'withinUnit' ||
    (req.kind === 'withinTurn' && req.direction === 'before')
  if (
    v !== 1 ||
    id !== req.sessionId ||
    kind !== req.kind ||
    direction !== (before ? 'before' : 'after') ||
    typeof g !== 'string' ||
    !g ||
    typeof key !== 'string' ||
    !key ||
    !Number.isSafeInteger(ordinal) ||
    ordinal < 0
  )
    return 'invalid'
  const at = g === gen ? index.header(id, gen, ordinal) : index.byKey(id, gen, key)
  if (!at || at.message_key !== key) return 'stale'
  const next = index.header(id, gen, at.ordinal + (before ? -1 : 1))
  if (!next) return g === gen ? 'invalid' : {}
  if (kind === 'withinUnit') {
    if (
      !Number.isSafeInteger(floor) ||
      floor < 0 ||
      (unitHeadKey !== undefined && (typeof unitHeadKey !== 'string' || !unitHeadKey))
    )
      return 'invalid'
    if (g !== gen) {
      // The capped page may already have passed several turns from the original
      // five-turn head. Find that head again to keep the same unit after republishing.
      const head = unitHeadKey ? index.byKey(id, gen, unitHeadKey) : undefined
      const lower = index.unitFloor(id, gen, head?.turn ?? at.turn)
      if (next.turn < lower) return { before: edge(id, gen, at, next, true) }
      return { next, floor: lower, unitHeadKey: head?.message_key ?? at.message_key }
    }
    const lower = index.unitFloor(id, gen, at.turn)
    if (floor > next.turn || floor < lower || index.header(id, g, floor)?.turn !== floor)
      return 'invalid'
    return { next, floor, unitHeadKey }
  }
  if (g === gen && (kind === 'withinTurn') !== (at.turn === next.turn)) return 'invalid'
  return { next }
}

const jsonBytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value))
export function readHistoryPage(
  ctx: Context,
  req: HistoryPageRequest,
  generation: string,
  prepared?: HistoryPrepared,
  activity?: ChatActivitySnapshot
): HistoryPageReply {
  const echo = {
    sessionId: req.sessionId,
    requestId: req.requestId,
    openGeneration: req.openGeneration
  }
  const id = req.sessionId
  const index = ctx.db.historyIndex
  return index.read(() => {
    const state = index.state(id)
    if (!state) return { ...echo, status: 'missing' }
    if (state.published !== generation || state.published_revision !== state.revision)
      return { ...echo, status: 'stale' }
    if (req.kind === 'panelSummary' || req.kind === 'panelDetail')
      return index.panels.read(req, generation, index.latest(id, generation))
    if (req.kind === 'metadata') {
      const { ref, offset } = req
      if (ref.session !== id || offset % HISTORY_BODY_BYTES || offset >= ref.bytes)
        return { ...echo, status: 'invalid' }
      if (ref.generation !== generation) return { ...echo, status: 'stale' }
      const chunk = index.metadataChunk(id, generation, ref.token, ref.bytes, offset)
      if (!chunk) return { ...echo, status: 'stale' }
      const nextOffset = offset + chunk.length
      return {
        ...echo,
        status: 'metadata',
        ref,
        offset,
        nextOffset,
        done: nextOffset === ref.bytes,
        base64: chunk.toString('base64')
      }
    }
    if (req.kind === 'body') {
      const { ref } = req
      if (ref.session !== id || req.offset % HISTORY_BODY_BYTES !== 0)
        return { ...echo, status: 'invalid' }
      const header = index.byKey(id, generation, ref.message)
      if (!header) return { ...echo, status: 'stale' }
      const bytes = header.body_bytes
      if (ref.generation === generation && (bytes !== ref.bytes || req.offset >= bytes))
        return { ...echo, status: 'invalid' }
      // A shorter replacement can end before the old offset. Return its first chunk
      // so the reader learns which publication to restart from.
      const offset = req.offset >= bytes ? 0 : req.offset
      const block = index.chunk(id, generation, header.ordinal, offset)
      if (!block) return { ...echo, status: 'invalid' }
      const nextOffset = offset + block.length
      return {
        ...echo,
        status: 'body',
        generation,
        bytes,
        base64: block.toString('base64'),
        offset,
        nextOffset,
        done: nextOffset === bytes
      }
    }
    const storedMeta = loadSessionMetadata(ctx.db, id, ctx.getCwd)
    if (!storedMeta) return { ...echo, status: 'missing' }
    const nativeSync = index.syncStatus(id, generation)
    let meta: Omit<LoadedSession, 'messages'> = {
      ...storedMeta,
      ...(nativeSync ? { nativeSync } : {}),
      ...(activity ? { activity } : {})
    }
    // Leave room for message headers even if one control field consumes the entire envelope.
    if (jsonBytes(meta) > HISTORY_PAGE_BYTES / 2) {
      const bytes = Buffer.from(JSON.stringify(meta))
      const { id, backend, agentKind, title } = meta
      const compact: typeof meta = {
        id,
        backend,
        agentKind,
        title: title && title.length > 256 ? title.slice(0, 256) + '…' : title,
        metadataRef: index.storeMetadata(id, generation, bytes)
      }
      for (const [key, value] of Object.entries(meta)) {
        if (key in compact || key === 'activity') continue
        if (jsonBytes(value ?? null) <= 4096) Object.assign(compact, { [key]: value })
      }
      if (activity) {
        const { sessionSchedules, ...current } = activity
        compact.activity = jsonBytes(sessionSchedules ?? []) <= 4096 ? activity : current
      }
      meta = compact
    }
    let floor: number | undefined
    let unitHeadKey: string | undefined
    let emptyBefore: HistoryEdge | undefined
    let start: IndexHeader | undefined
    if (req.kind === 'latest') start = index.latest(id, generation)
    else if (req.kind === 'visit') {
      if (req.generation !== generation) return { ...echo, status: 'stale' }
      start = index.byKey(id, generation, req.messageKey)
      if (!start) return { ...echo, status: 'missing' }
      if (req.cached?.generation === generation && req.cached.messageKey === start.message_key)
        return { ...echo, status: 'useCached', generation, messageKey: start.message_key }
    } else if (req.kind === 'target') {
      const { locator } = req
      if (locator.session !== id) return { ...echo, status: 'invalid' }
      const current = index.locator(id, locator.source, locator.identity)
      if (!current || current.epoch !== locator.epoch) return { ...echo, status: 'stale' }
      start = index.byAlias(id, generation, locator.source, locator.identity)
      if (!start) return { ...echo, status: 'missing' }
      if (req.resume?.generation === generation)
        start = index.byKey(id, generation, req.resume.messageKey) ?? start
      if (req.cached?.generation === generation && req.cached.messageKey === start.message_key)
        return { ...echo, status: 'useCached', generation, messageKey: start.message_key }
    } else {
      const next = readCursor(index, req, generation)
      if (typeof next === 'string') return { ...echo, status: next }
      start = next.next
      floor = next.floor
      unitHeadKey = next.unitHeadKey
      emptyBefore = next.before
    }
    const messages: LoadedMessage[] = []
    const session = {
      ...meta,
      userMessageCount: index.userCount(id, generation),
      complete: false,
      messages,
      history: { generation, ...(emptyBefore && { before: emptyBefore }) }
    }
    const reply: HistoryPageReply = {
      ...echo,
      status: 'ok',
      session,
      ...(req.kind === 'target' || req.kind === 'visit'
        ? { targetMessage: start?.message_key }
        : {}),
      ...(prepared ? { prepared } : {})
    }
    if (!start)
      return jsonBytes(reply) <= HISTORY_PAGE_BYTES ? reply : { ...echo, status: 'unavailable' }
    const ascending =
      req.kind === 'laterTurn' ||
      req.kind === 'target' ||
      req.kind === 'visit' ||
      (req.kind === 'withinTurn' && req.direction === 'after')
    if (req.kind === 'latest' || req.kind === 'earlierTurn') {
      floor = index.unitFloor(id, generation, start.turn)
      unitHeadKey = start.message_key
    }
    const candidates = index.pageHeaders(
      id,
      generation,
      start,
      ascending,
      HISTORY_PAGE_MESSAGES,
      floor
    )
    const fixedBytes = jsonBytes(reply) - jsonBytes(session.history)
    // Reuse indexed headers already in the selected turn. Seek only its outside neighbours.
    const outside = new Map<number, IndexHeader | undefined>()
    const startOrdinal = start.ordinal
    const neighbour = (ordinal: number): IndexHeader | undefined => {
      const position = (ordinal - startOrdinal) * (ascending ? 1 : -1)
      if (position >= 0 && position < candidates.length) return candidates[position]
      if (ordinal < 0 || (req.kind === 'latest' && ordinal > startOrdinal)) return undefined
      if (!outside.has(ordinal)) outside.set(ordinal, index.header(id, generation, ordinal))
      return outside.get(ordinal)
    }
    const pageEdges = (first: IndexHeader, last: IndexHeader): HistoryWindow => ({
      generation,
      before: edge(id, generation, first, neighbour(first.ordinal - 1), true, floor, unitHeadKey),
      after: edge(id, generation, last, neighbour(last.ordinal + 1), false)
    })
    let contentsBytes = 0,
      parts = 0
    for (const h of candidates) {
      const first = ascending ? start : h,
        last = ascending ? h : start
      const edges = pageEdges(first, last)
      const available =
        HISTORY_PAGE_BYTES -
        fixedBytes -
        contentsBytes -
        jsonBytes(edges) -
        (messages.length ? 1 : 0)
      const msg: LoadedMessage = {
        id: h.message_key,
        role: h.role,
        createdAt: h.created_at,
        parts: [],
        ...(h.incomplete ? { incomplete: true } : {})
      }
      const headerBytes = jsonBytes(msg)
      let bytes = headerBytes + h.body_bytes - 2
      if (bytes > available || parts + h.part_count > HISTORY_PAGE_PARTS) {
        const fitsAlone =
          h.part_count <= HISTORY_PAGE_PARTS &&
          bytes + fixedBytes + jsonBytes(pageEdges(h, h)) <= HISTORY_PAGE_BYTES
        if (messages.length && fitsAlone) break
        msg.deferredBody = {
          kind: 'parts',
          session: id,
          generation,
          message: h.message_key,
          bytes: h.body_bytes
        }
        bytes = jsonBytes(msg)
        if (bytes > available) {
          if (messages.length) break
          return { ...echo, status: 'unavailable' }
        }
      } else {
        msg.parts = index.parts(id, generation, h)
        parts += h.part_count
      }
      contentsBytes += bytes + (messages.length ? 1 : 0)
      messages.push(msg)
      session.history = edges
    }
    if (!ascending) messages.reverse()
    return reply
  })
}
