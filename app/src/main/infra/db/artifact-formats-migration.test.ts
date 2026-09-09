import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { applyMigrations, MIGRATION_NAMES } from './migrate'
import { DbQueries } from './queries'

describe('artifact format migration from the existing ledger', () => {
  it('preserves rows, fork references, message deletion and session deletion with foreign keys enabled', () => {
    const db = new Database(':memory:')
    try {
      db.pragma('foreign_keys = ON')
      db.exec('CREATE TABLE _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)')
      for (const name of MIGRATION_NAMES.filter((name) => name < '0024')) {
        db.exec(readFileSync(new URL(`./migrations/${name}.sql`, import.meta.url), 'utf8'))
        db.prepare('INSERT INTO _migrations VALUES (?, 1)').run(name)
      }
      const old = new DbQueries(db)
      for (const id of ['parent', 'fork'])
        old.insertSession({ id, backend: 'claude', title: null, projectId: null, createdAt: 1 })
      const messageId = old.appendMessage({
        sessionId: 'parent',
        role: 'assistant',
        content: '',
        createdAt: 2
      })
      old.appendPart({
        messageId,
        type: 'tool_call',
        toolRunId: 'publish',
        payloadJson: JSON.stringify({ toolName: 'mcp__orca_artifacts__publish_artifact', args: {} })
      })
      old.artifacts.createPublication({
        publicationId: 'original',
        artifactFileId: 'existing-file',
        sessionId: 'parent',
        relativePath: 'existing-file/report.md',
        filename: 'report.md',
        title: 'Existing',
        kind: 'markdown',
        sizeBytes: 8,
        hash: 'original-hash',
        inputSource: 'C:/workspace/report.md',
        publishedAt: 3
      })
      old.artifacts.linkPublication('parent', 'publish', 'original')
      old.artifacts.markTrashed('existing-file', 4)
      old.copyMessagesToSession('parent', 'fork')
      const filesBefore = db.prepare('SELECT * FROM artifact_files ORDER BY id').all()
      const refsBefore = db.prepare('SELECT * FROM session_artifacts ORDER BY id').all()
      const partsBefore = old.loadParts('fork')
      expect(() => db.prepare("UPDATE artifact_files SET kind='image'").run()).toThrow()

      expect(MIGRATION_NAMES).toContain('0024_artifact_preview_formats')
      applyMigrations(db)
      const q = new DbQueries(db)
      expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
      expect(db.pragma('foreign_key_check')).toEqual([])
      expect(db.prepare('SELECT * FROM artifact_files ORDER BY id').all()).toEqual(filesBefore)
      expect(db.prepare('SELECT * FROM session_artifacts ORDER BY id').all()).toEqual(refsBefore)
      expect(q.loadParts('fork')).toEqual(partsBefore)
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
      for (const kind of ['text', 'image']) {
        q.artifacts.createPublication({
          publicationId: kind,
          artifactFileId: `new-${kind}`,
          sessionId: 'parent',
          relativePath: `${kind}/file`,
          filename: 'file',
          title: kind,
          kind: kind as 'text' | 'image',
          sizeBytes: 1,
          hash: kind,
          inputSource: kind,
          publishedAt: 5
        })
      }
      expect(() => db.prepare("UPDATE artifact_files SET kind='pdf'").run()).toThrow()
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
      expect(db.prepare('SELECT COUNT(*) AS n FROM artifact_files').get()).toEqual({ n: 3 })
      expect(db.pragma('foreign_key_check')).toEqual([])
      applyMigrations(db)
      expect(db.prepare('SELECT COUNT(*) AS n FROM artifact_files').get()).toEqual({ n: 3 })
    } finally {
      db.close()
    }
  })
})
