import type Database from 'better-sqlite3'
import migration0001 from './migrations/0001_initial.sql?raw'

interface Migration {
  name: string
  sql: string
}

const MIGRATIONS: Migration[] = [{ name: '0001_initial', sql: migration0001 }]

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
