import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { applyMigrations } from './migrate'
import { DbQueries } from './queries'
import { partFromRow } from '../ipc/dto'

describe('session attachment file records', () => {
  it('loads persisted native paths and hashes from user attachments only and keeps sessions isolated', () => {
    const db = new Database(':memory:')
    try {
      applyMigrations(db)
      const q = new DbQueries(db)
      for (const id of ['a', 'b'])
        q.insertSession({ id, backend: 'claude', title: null, projectId: null, createdAt: 1 })
      const file = { path: 'C:/tmp/input.md', sha256: 'a'.repeat(64) }
      const attachment = {
        id: 'file-1',
        name: 'input.md',
        mimeType: 'text/markdown',
        kind: 'file',
        ...file
      }
      for (const [sessionId, role, payload] of [
        ['a', 'user', { attachments: [attachment, { path: '/forged', sha256: 'invalid' }] }],
        ['a', 'assistant', { attachments: [{ ...file, path: 'C:/tmp/assistant.md' }] }],
        ['b', 'user', { attachments: [{ ...file, path: 'C:/tmp/other.md' }] }]
      ] as const) {
        const messageId = q.appendMessage({ sessionId, role, content: 'text', createdAt: 1 })
        q.appendPart({
          messageId,
          type: 'attachment',
          toolRunId: null,
          payloadJson: JSON.stringify(payload)
        })
      }
      const malformed = q.appendMessage({
        sessionId: 'a',
        role: 'user',
        content: 'text',
        createdAt: 2
      })
      q.appendPart({
        messageId: malformed,
        type: 'attachment',
        toolRunId: null,
        payloadJson: 'bad json'
      })
      expect(q.listSessionAttachmentFiles('a')).toEqual([file])
      expect(q.listSessionAttachmentFiles('b')).toEqual([{ ...file, path: 'C:/tmp/other.md' }])
      expect(partFromRow(q.loadParts('a')[0])).toMatchObject({
        type: 'attachment',
        attachments: [attachment, { path: '/forged', sha256: 'invalid' }]
      })
      q.deleteSession('a')
      expect(q.listSessionAttachmentFiles('a')).toEqual([])
    } finally {
      db.close()
    }
  })
})
