import migration0001 from '../migrations/0001_mail.sql?raw'

export const MAIL_MIGRATION_NAMES = ['0001_mail'] as const

export function applyMailMigrations(db: {
  exec(sql: string): void
  prepare(sql: string): { run(...args: unknown[]): unknown; all(...args: unknown[]): unknown[] }
}): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)`
  )
  const rows = db.prepare('SELECT name FROM _migrations').all() as { name: string }[]
  const applied = new Set(rows.map((row) => row.name))
  if (!applied.has('0001_mail')) {
    db.exec(migration0001)
    db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(
      '0001_mail',
      Date.now()
    )
  }
}
