import type Database from 'better-sqlite3'
import {
  HISTORY_BODY_BYTES,
  HISTORY_PAGE_BYTES,
  HISTORY_PAGE_MESSAGES,
  type HistoryPageReply,
  type HistoryPageRequest
} from '../../../shared/history-page'
import { panelRows, type PanelItem } from '../../../shared/history-panels/rows'
import { TranscriptPanelProjection } from '../../../shared/history-panels/projection'
import {
  settleOrphanToolParts,
  settleStaleAsyncLaunchParts
} from '../../../shared/history-panels/tool'
import type { LoadedMessage } from '../../../shared/ipc'

type PanelRequest = Extract<HistoryPageRequest, { kind: 'panelSummary' | 'panelDetail' }>
export function contributesToPanels(message: LoadedMessage): boolean {
  return message.parts.some(
    (part) =>
      part.type === 'tool_call' ||
      part.type === 'tool_result' ||
      (part.type === 'attachment' && message.role === 'user') ||
      ('parentToolRunId' in part && part.parentToolRunId !== undefined)
  )
}

function cursorFor(req: PanelRequest, checkpoint: number, position: number): string {
  return Buffer.from(
    JSON.stringify([req.sessionId, req.generation, req.panel, checkpoint, position])
  ).toString('base64url')
}

export class HistoryPanelQueries {
  constructor(private readonly db: Database.Database) {}

  publish(id: string, generation: string, messages: readonly LoadedMessage[]): void {
    const projection = new TranscriptPanelProjection()
    projection.reset(
      messages.filter(contributesToPanels).map((message) => ({
        ...message,
        parts: settleStaleAsyncLaunchParts(
          message.incomplete ? settleOrphanToolParts(message.parts) : message.parts
        )
      }))
    )
    this.db
      .prepare('DELETE FROM history_panel_rows WHERE session_id=? AND generation=?')
      .run(id, generation)
    const put = this.db.prepare('INSERT INTO history_panel_rows VALUES (?,?,?,?,?,?,?)')
    const putChunk = this.db.prepare('INSERT INTO history_panel_detail_chunks VALUES (?,?,?,?,?,?)')
    const counts = new Map<PanelItem['kind'], number>()
    let position = 0
    for (const { key, summary, detail } of panelRows(projection)) {
      counts.set(summary.kind, (counts.get(summary.kind) ?? 0) + 1)
      const serialized = JSON.stringify(summary)
      // Keep an oversized label readable in the list. The selected row retains the original.
      const compact =
        Buffer.byteLength(serialized) < HISTORY_PAGE_BYTES / 2
          ? serialized
          : JSON.stringify(summary, (_name, value) =>
              typeof value === 'string' && value.length > 1024 ? value.slice(0, 1024) : value
            )
      const bytes =
        detail || compact !== serialized
          ? Buffer.from(JSON.stringify(detail ?? summary))
          : undefined
      put.run(id, generation, summary.kind, position, key, compact, bytes?.length ?? 0)
      if (bytes)
        for (let offset = 0; offset < bytes.length; offset += HISTORY_BODY_BYTES)
          putChunk.run(
            id,
            generation,
            summary.kind,
            position,
            offset,
            bytes.subarray(offset, offset + HISTORY_BODY_BYTES)
          )
      position++
    }
    this.db
      .prepare('DELETE FROM history_panel_counts WHERE session_id=? AND generation=?')
      .run(id, generation)
    const putCount = this.db.prepare('INSERT INTO history_panel_counts VALUES (?,?,?,?)')
    for (const [kind, total] of counts) putCount.run(id, generation, kind, total)
  }

  read(
    req: PanelRequest,
    generation: string,
    head: { ordinal: number; message_key: string; part_count: number } | undefined
  ): HistoryPageReply {
    const checkpoint = head?.ordinal ?? -1
    const { sessionId, requestId, openGeneration, panel } = req
    const echo = { sessionId, requestId, openGeneration }
    if (req.generation !== generation) return { ...echo, status: 'stale' }
    const scope = [sessionId, generation, panel]
    if (req.kind === 'panelDetail') {
      if (req.checkpoint !== checkpoint) return { ...echo, status: 'stale' }
      if (req.offset % HISTORY_BODY_BYTES) return { ...echo, status: 'invalid' }
      const row = this.db
        .prepare(
          `SELECT r.detail_bytes AS bytes,c.payload AS chunk FROM history_panel_rows r
        LEFT JOIN history_panel_detail_chunks c ON c.session_id=r.session_id AND c.generation=r.generation
          AND c.kind=r.kind AND c.position=r.position AND c.byte_offset=?
        WHERE r.session_id=? AND r.generation=? AND r.kind=? AND r.item_key=?`
        )
        .get(req.offset, ...scope, req.itemKey) as { bytes: number; chunk: Buffer } | undefined
      if (!row?.bytes) return { ...echo, status: 'missing' }
      if (req.offset >= row.bytes) return { ...echo, status: 'invalid' }
      const nextOffset = req.offset + row.chunk.length
      return {
        ...echo,
        status: 'panelDetail',
        generation,
        panel,
        checkpoint,
        itemKey: req.itemKey,
        offset: req.offset,
        nextOffset,
        done: nextOffset === row.bytes,
        base64: row.chunk.toString('base64')
      }
    }
    let position = -1
    if (req.cursor) {
      let cursor: unknown
      try {
        cursor = JSON.parse(Buffer.from(req.cursor, 'base64url').toString())
      } catch {
        return { ...echo, status: 'invalid' }
      }
      if (
        !Array.isArray(cursor) ||
        cursor.length !== 5 ||
        cursor[0] !== sessionId ||
        cursor[1] !== generation ||
        cursor[2] !== panel ||
        !Number.isSafeInteger(cursor[4]) ||
        cursor[4] < 0
      )
        return { ...echo, status: 'invalid' }
      if (cursor[3] !== checkpoint) return { ...echo, status: 'stale' }
      position = cursor[4]
    }
    const total = this.db
      .prepare(
        'SELECT coalesce((SELECT total FROM history_panel_counts WHERE session_id=? AND generation=? AND kind=?),0)'
      )
      .pluck()
      .get(...scope) as number
    const reply: Extract<HistoryPageReply, { status: 'panelSummary' }> = {
      ...echo,
      status: 'panelSummary',
      generation,
      panel,
      checkpoint,
      total,
      ...(head ? { frontier: { key: head.message_key, parts: head.part_count } } : {}),
      rows: []
    }
    let size = Buffer.byteLength(JSON.stringify(reply))
    const listing = this.db.prepare(
      `SELECT position,item_key,summary FROM history_panel_rows WHERE session_id=? AND generation=? AND kind=? AND position>? ORDER BY position LIMIT ?`
    )
    for (const raw of listing.iterate(...scope, position, HISTORY_PAGE_MESSAGES + 1)) {
      const row = raw as { position: number; item_key: string; summary: string }
      const value: PanelItem = JSON.parse(row.summary)
      const item = { key: row.item_key, value }
      const bytes = Buffer.byteLength(JSON.stringify(item)) + 1
      if (
        reply.rows.length === HISTORY_PAGE_MESSAGES ||
        size + bytes + Buffer.byteLength(cursorFor(req, checkpoint, row.position)) + 12 >
          HISTORY_PAGE_BYTES
      ) {
        if (!reply.rows.length) return { ...echo, status: 'unavailable' }
        reply.next = cursorFor(req, checkpoint, position)
        break
      }
      reply.rows.push(item)
      size += bytes
      position = row.position
    }
    return reply
  }
}
