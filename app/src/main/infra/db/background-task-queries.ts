import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { BackgroundEvent, ProviderMessageEvent } from '../../../shared/background-task'

type JournalEvent = BackgroundEvent | ProviderMessageEvent

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])])
    )
  return value
}

// A UUID identifies delivery, not immutable content. Corrected payloads are retained.
export function backgroundJournalKey(event: JournalEvent): string {
  const { source, ...payload } = event
  const identity = source.uuid ? { uuid: source.uuid } : { sequence: source.sequence }
  return createHash('sha256')
    .update(JSON.stringify(canonical({ ...payload, identity, replay: source.replay })))
    .digest('hex')
}

export class BackgroundTaskQueries {
  private readonly insert: Database.Statement
  private readonly stateEvents: Database.Statement
  private readonly allEvents: Database.Statement

  constructor(db: Database.Database) {
    this.insert = db.prepare(`INSERT INTO background_task_events
      (session_id, generation, sequence, received_at, event_type, event_key, payload_json)
      VALUES (@sessionId, @generation, @sequence, @receivedAt, @eventType, @eventKey, @payload)
      ON CONFLICT(session_id, generation, event_key) DO NOTHING`)
    this.stateEvents = db.prepare(`SELECT payload_json FROM background_task_events
      WHERE session_id = ? AND event_type <> 'provider.message' ORDER BY id`)
    this.allEvents = db.prepare(`SELECT payload_json FROM background_task_events
      WHERE session_id = ? ORDER BY id`)
  }

  append(event: JournalEvent): boolean {
    return (
      this.insert.run({
        sessionId: event.sessionId,
        generation: event.source.generation,
        sequence: event.source.sequence,
        receivedAt: event.source.receivedAt,
        eventType: event.type,
        eventKey: backgroundJournalKey(event),
        payload: JSON.stringify(event)
      }).changes > 0
    )
  }

  list(sessionId: string): BackgroundEvent[]
  list(sessionId: string, includeRaw: true): JournalEvent[]
  list(sessionId: string, includeRaw = false): JournalEvent[] {
    const statement = includeRaw ? this.allEvents : this.stateEvents
    return (statement.all(sessionId) as Array<{ payload_json: string }>).map(
      (row) => JSON.parse(row.payload_json) as JournalEvent
    )
  }
}
