import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { applyMigrations, MIGRATION_NAMES } from './migrate'
import { DbQueries } from './queries'

describe('artifact format migration from the existing ledger', () => {
  it.each(['0024', '0025'])(
    'upgrades the pre-%s ledger with fork references and foreign keys intact',
    (version) => {
      const db = new Database(':memory:')
      try {
        db.pragma('foreign_keys = ON')
        db.exec('CREATE TABLE _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)')
        for (const name of MIGRATION_NAMES.filter((name) => name < version)) {
          db.exec(readFileSync(new URL(`./migrations/${name}.sql`, import.meta.url), 'utf8'))
          db.prepare('INSERT INTO _migrations VALUES (?, 1)').run(name)
        }
        // Seed the historical schema directly: the current query implementation expects the latest columns.
        for (const id of ['parent', 'fork'])
          db.prepare(
            "INSERT INTO sessions (id, backend, created_at, updated_at) VALUES (?, 'claude', 1, 1)"
          ).run(id)
        db.exec(`INSERT INTO artifact_files (id, relative_path, filename, kind, size_bytes, hash, created_at, last_trashed_at)
        VALUES ('existing-file', 'existing-file/report.md', 'report.md', 'markdown', 8, 'original-hash', 3, 4)`)
        let messageId = 0
        for (const id of ['parent', 'fork']) {
          const inserted = db
            .prepare(
              "INSERT INTO messages (session_id, role, content, created_at, idx) VALUES (?, 'assistant', '', 2, 0)"
            )
            .run(id)
          const currentMessageId = Number(inserted.lastInsertRowid)
          if (id === 'parent') messageId = currentMessageId
          const publicationId = id === 'parent' ? 'original' : 'fork-publication'
          db.prepare(
            `INSERT INTO session_artifacts
          (id, session_id, artifact_file_id, message_id, tool_run_id, title, input_source, published_at, card_attached)
          VALUES (?, ?, 'existing-file', ?, 'publish', 'Existing', 'C:/workspace/report.md', 3, 1)`
          ).run(publicationId, id, currentMessageId)
          const payload = JSON.stringify({
            artifact: {
              publicationId,
              artifactFileId: 'existing-file',
              title: 'Existing',
              filename: 'report.md',
              kind: 'markdown',
              sizeBytes: 8,
              publishedAt: 3
            }
          })
          db.prepare(
            "INSERT INTO message_parts (message_id, idx, type, tool_run_id, payload_json) VALUES (?, 0, 'artifact', 'publish', ?)"
          ).run(currentMessageId, payload)
        }
        const filesBefore = db.prepare('SELECT * FROM artifact_files ORDER BY id').all() as Record<
          string,
          unknown
        >[]
        const refsBefore = db.prepare('SELECT * FROM session_artifacts ORDER BY id').all()
        const partsBefore = db.prepare('SELECT * FROM message_parts ORDER BY id').all()
        expect(() =>
          db
            .prepare(`UPDATE artifact_files SET kind='${version === '0024' ? 'image' : 'file'}'`)
            .run()
        ).toThrow()

        expect(MIGRATION_NAMES).toContain('0024_artifact_preview_formats')
        expect(MIGRATION_NAMES).toContain('0025_artifact_catalog')
        applyMigrations(db)
        const q = new DbQueries(db)
        expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
        expect(db.pragma('foreign_key_check')).toEqual([])
        expect(db.prepare('SELECT * FROM artifact_files ORDER BY id').all()).toEqual(
          filesBefore.map((row) => ({ ...row, category: 'artifact', pinned: 0 }))
        )
        expect(db.prepare('SELECT * FROM session_artifacts ORDER BY id').all()).toEqual(refsBefore)
        expect(db.prepare('SELECT * FROM message_parts ORDER BY id').all()).toEqual(partsBefore)
        expect(
          db
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'session_artifacts_%' ORDER BY name"
            )
            .all()
        ).toEqual([
          { name: 'session_artifacts_file' },
          { name: 'session_artifacts_latest' },
          { name: 'session_artifacts_message' }
        ])
        for (const kind of ['text', 'image', 'file'] as const) {
          q.artifacts.createPublication({
            publicationId: kind,
            artifactFileId: `new-${kind}`,
            sessionId: 'parent',
            relativePath: `${kind}/file`,
            filename: 'file',
            title: kind,
            kind,
            category: kind === 'file' ? 'file' : 'artifact',
            sizeBytes: 1,
            hash: kind,
            inputSource: kind,
            publishedAt: 5
          })
        }
        expect(() => db.prepare("UPDATE artifact_files SET kind='pdf'").run()).toThrow()
        expect(() => db.prepare("UPDATE artifact_files SET category='other'").run()).toThrow()
        expect(() => db.prepare('UPDATE artifact_files SET pinned=2').run()).toThrow()
        expect(() =>
          db.prepare("DELETE FROM artifact_files WHERE id='existing-file'").run()
        ).toThrow()
        db.prepare('DELETE FROM messages WHERE id = ?').run(messageId)
        expect(
          db.prepare("SELECT message_id FROM session_artifacts WHERE id='original'").get()
        ).toEqual({ message_id: null })
        const child = q.artifacts.listLatest('fork')[0]!
        q.deleteSession('parent')
        expect(q.artifacts.getOwnedFile('fork', child.publicationId)?.artifactFileId).toBe(
          'existing-file'
        )
        q.deleteSession('fork')
        expect(db.prepare('SELECT COUNT(*) AS n FROM session_artifacts').get()).toEqual({ n: 0 })
        expect(db.prepare('SELECT COUNT(*) AS n FROM artifact_files').get()).toEqual({ n: 4 })
        expect(db.pragma('foreign_key_check')).toEqual([])
        applyMigrations(db)
        expect(db.prepare('SELECT COUNT(*) AS n FROM artifact_files').get()).toEqual({ n: 4 })
      } finally {
        db.close()
      }
    }
  )
})
