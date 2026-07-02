import type Database from 'better-sqlite3'
import migration0001 from './migrations/0001_initial.sql?raw'
import migration0002 from './migrations/0002_projects.sql?raw'
import migration0003 from './migrations/0003_messages_fts.sql?raw'
import migration0004 from './migrations/0004_message_parts.sql?raw'
import migration0005 from './migrations/0005_usage_events.sql?raw'
import migration0006 from './migrations/0006_turn_usage.sql?raw'
import migration0007 from './migrations/0007_title_source.sql?raw'
import migration0008 from './migrations/0008_provider_key.sql?raw'
import migration0009 from './migrations/0009_message_complete.sql?raw'
import migration0010 from './migrations/0010_session_cwd.sql?raw'
import migration0011 from './migrations/0011_session_lineage.sql?raw'

interface Migration {
  name: string
  sql: string
}

const MIGRATIONS: Migration[] = [
  { name: '0001_initial', sql: migration0001 },
  { name: '0002_projects', sql: migration0002 },
  { name: '0003_messages_fts', sql: migration0003 },
  { name: '0004_message_parts', sql: migration0004 },
  { name: '0005_usage_events', sql: migration0005 },
  { name: '0006_turn_usage', sql: migration0006 },
  { name: '0007_title_source', sql: migration0007 },
  { name: '0008_provider_key', sql: migration0008 },
  { name: '0009_message_complete', sql: migration0009 },
  { name: '0010_session_cwd', sql: migration0010 },
  { name: '0011_session_lineage', sql: migration0011 }
]

const META_TABLE = `
  CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )
`

export function applyMigrations(db: Database.Database): void {
  db.exec(META_TABLE)
  const applied = new Set(
    (db.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map((r) => r.name)
  )
  const record = db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)')
  for (const m of MIGRATIONS) {
    if (applied.has(m.name)) continue
    const apply = db.transaction(() => {
      db.exec(m.sql)
      record.run(m.name, Date.now())
    })
    apply()
  }
}
