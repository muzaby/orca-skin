import type Database from 'better-sqlite3'
import { createHash, randomUUID } from 'node:crypto'
import { HISTORY_BODY_BYTES, HISTORY_TURN_UNIT } from '../../../shared/history-page'
import type { LoadedMessage } from '../../../shared/ipc'
import { isTurnStart } from '../../../shared/history-turn'
import type { HistoryMessageHeader } from './types'

import { HistoryPanelQueries, contributesToPanels } from './history-panel-queries'

export interface IndexState {
  rebuild: number
  revision: number
  published: string | null
  published_revision: number | null
  building: string | null
  building_revision: number | null
  next_ordinal: number
}
export interface IndexHeader {
  ordinal: number
  turn: number
  message_key: string
  role: LoadedMessage['role']
  created_at: number
  incomplete: number
  part_count: number
  body_bytes: number
}
export interface ProjectionInput {
  messages: LoadedMessage[]
  aliases: Map<string, { source: string; identity: string }[]>
  nativeSync?: { status: string; message?: string }
}
export const INDEX_SLICE_MS = 20

export class HistoryIndexQueries {
  private readonly statements = new Map<string, Database.Statement>()
  readonly panels: HistoryPanelQueries
  constructor(private readonly db: Database.Database) {
    this.panels = new HistoryPanelQueries(db)
  }

  private stmt(sql: string): Database.Statement {
    let stmt = this.statements.get(sql)
    if (!stmt) {
      stmt = this.db.prepare(sql)
      this.statements.set(sql, stmt)
    }
    return stmt
  }
  read<T>(fn: () => T): T {
    return this.db.transaction(fn)()
  }

  pendingSessions(): string[] {
    return this.stmt(
      `SELECT s.id FROM sessions s LEFT JOIN history_index_state h ON h.session_id=s.id
      WHERE s.hidden_at IS NULL AND (h.published IS NULL OR h.revision != h.published_revision)
      ORDER BY s.updated_at DESC,s.id`
    )
      .pluck()
      .all() as string[]
  }

  state(id: string): IndexState | undefined {
    return this.stmt(
      `SELECT h.* FROM history_index_state h JOIN sessions s ON s.id=h.session_id
      WHERE h.session_id=? AND s.hidden_at IS NULL`
    ).get(id) as IndexState | undefined
  }

  headers(id: string): HistoryMessageHeader[] {
    return this.stmt(
      `SELECT id AS message_id,message_key,role,created_at,complete,idx AS message_idx
      FROM messages WHERE session_id=? ORDER BY idx,id`
    ).all(id) as HistoryMessageHeader[]
  }

  begin(id: string): IndexState | undefined {
    return this.read(() => {
      this.stmt(
        `INSERT INTO history_index_state(session_id) SELECT id FROM sessions
        WHERE id=? AND hidden_at IS NULL ON CONFLICT DO NOTHING`
      ).run(id)
      const state = this.state(id)
      if (
        !state ||
        (state.published && state.revision === state.published_revision) ||
        (state.building && state.building_revision === state.revision)
      )
        return state
      if (state.building)
        this.stmt('DELETE FROM history_generations WHERE session_id=? AND generation=?').run(
          id,
          state.building
        )
      const gen = randomUUID()
      this.stmt('INSERT INTO history_generations(session_id,generation) VALUES (?,?)').run(id, gen)
      this.stmt(
        'UPDATE history_index_state SET building=?,building_revision=revision,next_ordinal=0 WHERE session_id=?'
      ).run(gen, id)
      return this.state(id)
    })
  }

  header(id: string, gen: string, ordinal: number): IndexHeader | undefined {
    return this.stmt(
      'SELECT * FROM history_message_headers WHERE session_id=? AND generation=? AND ordinal=?'
    ).get(id, gen, ordinal) as IndexHeader | undefined
  }
  latest(id: string, gen: string): IndexHeader | undefined {
    return this.stmt(
      'SELECT * FROM history_message_headers WHERE session_id=? AND generation=? ORDER BY ordinal DESC LIMIT 1'
    ).get(id, gen) as IndexHeader | undefined
  }
  byKey(id: string, gen: string, key: string): IndexHeader | undefined {
    return this.stmt(
      'SELECT * FROM history_message_headers WHERE session_id=? AND generation=? AND message_key=?'
    ).get(id, gen, key) as IndexHeader | undefined
  }
  byAlias(id: string, gen: string, source: string, key: string): IndexHeader | undefined {
    const ordinal = this.stmt(
      'SELECT ordinal FROM history_source_aliases WHERE session_id=? AND generation=? AND source=? AND identity=?'
    )
      .pluck()
      .get(id, gen, source, key)
    return typeof ordinal === 'number' ? this.header(id, gen, ordinal) : undefined
  }
  // A turn is named by its first ordinal. Seeking one predecessor at a time avoids
  // scanning every message of a large turn while counting distinct turns.
  unitFloor(id: string, gen: string, startTurn: number): number {
    let floor = startTurn
    const previous = this.stmt(
      'SELECT turn FROM history_message_headers WHERE session_id=? AND generation=? AND turn<? ORDER BY turn DESC LIMIT 1'
    ).pluck()
    for (let i = 1; i < HISTORY_TURN_UNIT && floor > 0; i++) {
      const turn = previous.get(id, gen, floor)
      if (typeof turn !== 'number') break
      floor = turn
    }
    return floor
  }
  pageHeaders(
    id: string,
    gen: string,
    start: IndexHeader,
    ascending: boolean,
    limit: number,
    floor = start.turn
  ): IndexHeader[] {
    if (ascending) {
      return this.stmt(
        'SELECT * FROM history_message_headers WHERE session_id=? AND generation=? AND turn=? AND ordinal>=? ORDER BY ordinal LIMIT ?'
      ).all(id, gen, start.turn, start.ordinal, limit) as IndexHeader[]
    }
    // Each turn starts at its own ordinal. A unit is a contiguous primary-key
    // range even when its final page crosses several turn boundaries.
    return this.stmt(
      'SELECT * FROM history_message_headers WHERE session_id=? AND generation=? AND ordinal BETWEEN ? AND ? ORDER BY ordinal DESC LIMIT ?'
    ).all(id, gen, floor, start.ordinal, limit) as IndexHeader[]
  }
  locator(
    id: string,
    source: 'local' | 'native' | 'archive',
    identity: string
  ): import('../../../shared/history-page').HistoryLocator | undefined {
    const row = this.stmt(
      'SELECT incarnation,0 AS local,native,archive FROM history_source_epochs WHERE session_id=?'
    ).get(id) as Record<string, number> | undefined
    if (!row) return undefined
    const gen = this.state(id)?.published
    const projectedKey = gen ? this.byAlias(id, gen, source, identity)?.message_key : undefined
    return {
      v: 1,
      session: id,
      source,
      identity,
      epoch: row.incarnation + '.' + row[source],
      projectedKey
    }
  }
  chunk(id: string, gen: string, ordinal: number, offset: number): Buffer | undefined {
    return this.stmt(
      'SELECT payload FROM history_body_chunks WHERE session_id=? AND generation=? AND ordinal=? AND byte_offset=?'
    )
      .pluck()
      .get(id, gen, ordinal, offset) as Buffer | undefined
  }
  parts(id: string, gen: string, header: IndexHeader): LoadedMessage['parts'] {
    if (!header.part_count) return []
    const buffers = this.stmt(
      'SELECT payload FROM history_body_chunks WHERE session_id=? AND generation=? AND ordinal=? ORDER BY byte_offset'
    )
      .pluck()
      .all(id, gen, header.ordinal) as Buffer[]
    return JSON.parse(Buffer.concat(buffers, header.body_bytes).toString('utf8'))
  }
  storeMetadata(
    id: string,
    generation: string,
    bytes: Buffer
  ): import('../../../shared/history-page').HistoryMetadataRef {
    const token = createHash('sha256').update(bytes).digest('hex')
    if (
      this.stmt('INSERT OR IGNORE INTO history_metadata_refs VALUES (?,?,?,?)').run(
        id,
        generation,
        token,
        bytes.length
      ).changes
    ) {
      // Concurrent readers can finish a previous preview while a refresh publishes newer metadata.
      this.stmt(
        `DELETE FROM history_metadata_refs WHERE session_id=? AND generation=?
        AND rowid NOT IN (SELECT rowid FROM history_metadata_refs WHERE session_id=? AND generation=? ORDER BY rowid DESC LIMIT 4)`
      ).run(id, generation, id, generation)
      const put = this.stmt('INSERT INTO history_metadata_chunks VALUES (?,?,?,?,?)')
      for (let i = 0; i < bytes.length; i += HISTORY_BODY_BYTES)
        put.run(id, generation, token, i, bytes.subarray(i, i + HISTORY_BODY_BYTES))
    }
    return { session: id, generation, token, bytes: bytes.length }
  }

  metadataChunk(
    id: string,
    generation: string,
    token: string,
    bytes: number,
    offset: number
  ): Buffer | undefined {
    return this.stmt(
      'SELECT payload FROM history_metadata_chunks JOIN history_metadata_refs USING(session_id,generation,token) WHERE session_id=? AND generation=? AND token=? AND bytes=? AND byte_offset=?'
    )
      .pluck()
      .get(id, generation, token, bytes, offset) as Buffer | undefined
  }
  userCount(id: string, gen: string): number {
    return this.stmt(
      'SELECT user_count FROM history_generations WHERE session_id=? AND generation=?'
    )
      .pluck()
      .get(id, gen) as number
  }
  syncStatus(id: string, gen: string): LoadedSessionSync {
    const json = this.stmt(
      'SELECT native_sync FROM history_generations WHERE session_id=? AND generation=?'
    )
      .pluck()
      .get(id, gen)
    return typeof json === 'string' ? JSON.parse(json) : undefined
  }

  private putMessage(
    id: string,
    gen: string,
    ordinal: number,
    turn: number,
    msg: LoadedMessage,
    aliases: { source: string; identity: string }[]
  ): void {
    const putHeader = this.stmt('INSERT INTO history_message_headers VALUES (?,?,?,?,?,?,?,?,?,?)')
    const putChunk = this.stmt('INSERT INTO history_body_chunks VALUES (?,?,?,?,?)')
    const putAlias = this.stmt(
      'INSERT INTO history_source_aliases VALUES (?,?,?,?,?) ON CONFLICT(session_id,generation,source,identity) DO UPDATE SET ordinal=excluded.ordinal'
    )
    const putOwner = this.stmt('INSERT OR IGNORE INTO history_part_owners VALUES (?,?,?,?,?,?)')
    const body = Buffer.from(JSON.stringify(msg.parts))
    putHeader.run(
      id,
      gen,
      ordinal,
      turn,
      msg.id,
      msg.role,
      msg.createdAt,
      Number(!!msg.incomplete),
      msg.parts.length,
      body.length
    )
    if (contributesToPanels(msg))
      this.stmt('INSERT INTO history_panel_inputs VALUES (?,?,?)').run(id, gen, ordinal)
    if (msg.parts.length)
      for (let offset = 0; offset < body.length; offset += HISTORY_BODY_BYTES)
        putChunk.run(id, gen, ordinal, offset, body.subarray(offset, offset + HISTORY_BODY_BYTES))
    for (const alias of aliases) putAlias.run(id, gen, alias.source, alias.identity, ordinal)
    msg.parts.forEach((part, i) => {
      if ('toolRunId' in part && part.toolRunId)
        putOwner.run(id, gen, part.type, part.toolRunId, ordinal, i)
      if ('parentToolRunId' in part && part.parentToolRunId)
        putOwner.run(id, gen, 'parent', part.parentToolRunId, ordinal, i)
    })
  }

  // A tail written after the published local frontier keeps all earlier keyset cursors valid.
  // Any edit to an indexed message or insertion into the middle requires a new generation.
  localTail(
    id: string,
    state: IndexState
  ): { headers: HistoryMessageHeader[]; parts: import('./types').LoadedPartRow[] } | undefined {
    if (
      !state.published ||
      state.rebuild ||
      state.building ||
      state.revision === state.published_revision
    )
      return undefined
    const headers = this.stmt(
      `SELECT m.id AS message_id,m.message_key,m.role,m.created_at,m.complete,m.idx AS message_idx
      FROM history_dirty_messages d JOIN messages m ON m.id=d.local_id AND m.session_id=d.session_id
      WHERE d.session_id=? ORDER BY m.idx,m.id LIMIT 129`
    ).all(id) as HistoryMessageHeader[]
    if (!headers.length || headers.length > 128) return undefined
    const first = headers[0]
    const later = this.stmt(
      `SELECT 1 FROM messages m WHERE m.session_id=? AND (m.idx,m.id)>=(?,?)
      AND NOT EXISTS(SELECT 1 FROM history_dirty_messages d WHERE d.session_id=m.session_id AND d.local_id=m.id) LIMIT 1`
    ).get(id, first.message_idx, first.message_id)
    if (
      later ||
      headers.some((h) => this.byAlias(id, state.published!, 'local', String(h.message_id)))
    )
      return undefined
    const frontier = this.stmt(
      `SELECT max(coalesce((SELECT local_frontier FROM native_history_snapshots WHERE session_id=?),0),
      coalesce((SELECT local_frontier FROM native_session_recovery WHERE session_id=?),0))`
    )
      .pluck()
      .get(id, id) as number
    if (headers.some((h) => h.message_id <= frontier)) return undefined
    const parts = this.stmt(
      `SELECT m.id AS message_id,m.message_key,m.role,m.created_at,m.complete,m.idx AS message_idx,
      p.idx AS part_idx,p.type,p.tool_run_id,p.payload_json FROM history_dirty_messages d
      JOIN messages m ON m.id=d.local_id AND m.session_id=d.session_id JOIN message_parts p ON p.message_id=m.id
      WHERE d.session_id=? ORDER BY m.idx,m.id,p.idx`
    ).all(id) as import('./types').LoadedPartRow[]
    return { headers, parts }
  }
  appendTail(
    id: string,
    state: IndexState,
    messages: LoadedMessage[],
    headers: HistoryMessageHeader[]
  ): void {
    const gen = state.published!
    const last = this.latest(id, gen)
    let ordinal = (last?.ordinal ?? -1) + 1,
      turn = last?.turn ?? 0
    let previous: { role: LoadedMessage['role'] } | undefined = last
    for (const [i, msg] of messages.entries()) {
      if (isTurnStart(previous, msg)) turn = ordinal
      this.putMessage(id, gen, ordinal++, turn, msg, [
        { source: 'local', identity: String(headers[i].message_id) }
      ])
      previous = msg
    }
    const users = messages.filter((m) => m.role === 'user').length
    if (users)
      this.stmt(
        'UPDATE history_generations SET user_count=user_count+? WHERE session_id=? AND generation=?'
      ).run(users, id, gen)
    if (messages.some(contributesToPanels)) {
      const inputs = this.stmt(
        `SELECT h.* FROM history_panel_inputs p JOIN history_message_headers h USING (session_id,generation,ordinal)
        WHERE p.session_id=? AND p.generation=? ORDER BY p.ordinal`
      ).all(id, gen) as IndexHeader[]
      this.panels.publish(
        id,
        gen,
        inputs.map((h) => ({
          id: h.message_key,
          role: h.role,
          createdAt: h.created_at,
          incomplete: !!h.incomplete,
          parts: this.parts(id, gen, h)
        }))
      )
    }
    this.stmt('UPDATE history_index_state SET published_revision=revision WHERE session_id=?').run(
      id
    )
    this.stmt('DELETE FROM history_dirty_messages WHERE session_id=?').run(id)
  }
  writeSlice(
    id: string,
    gen: string,
    revision: number,
    source: ProjectionInput
  ): 'pending' | 'published' | 'invalidated' {
    return this.read(() => {
      const state = this.state(id)
      if (!state || state.revision !== revision || state.building !== gen) return 'invalidated'
      let ordinal = state.next_ordinal
      const previous = this.header(id, gen, ordinal - 1)
      let turn = previous?.turn ?? 0
      const deadline = performance.now() + INDEX_SLICE_MS
      for (; ordinal < source.messages.length; ordinal++) {
        const msg = source.messages[ordinal]
        if (isTurnStart(source.messages[ordinal - 1], msg)) turn = ordinal
        this.putMessage(id, gen, ordinal, turn, msg, source.aliases.get(msg.id) ?? [])
        if (performance.now() >= deadline) {
          ordinal++
          break
        }
      }
      if (ordinal < source.messages.length) {
        this.stmt('UPDATE history_index_state SET next_ordinal=? WHERE session_id=?').run(
          ordinal,
          id
        )
        return 'pending'
      }
      this.panels.publish(id, gen, source.messages)
      this.stmt(
        'UPDATE history_generations SET native_sync=?,user_count=? WHERE session_id=? AND generation=?'
      ).run(
        source.nativeSync ? JSON.stringify(source.nativeSync) : null,
        source.messages.filter((m) => m.role === 'user').length,
        id,
        gen
      )
      this.stmt(
        `UPDATE history_index_state SET published=building,published_revision=building_revision,
        building=NULL,building_revision=NULL,next_ordinal=0,rebuild=0 WHERE session_id=?`
      ).run(id)
      this.stmt('DELETE FROM history_dirty_messages WHERE session_id=?').run(id)
      if (state.published)
        this.stmt('DELETE FROM history_generations WHERE session_id=? AND generation=?').run(
          id,
          state.published
        )
      return 'published'
    })
  }
}
type LoadedSessionSync = import('../../../shared/ipc').LoadedSession['nativeSync']
