import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { applyMigrations } from './migrate'
import { DbQueries } from './queries'

const connections: Database.Database[] = []
function fixture(): { db: Database.Database; q: DbQueries } {
  const db = new Database(':memory:')
  connections.push(db)
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  const q = new DbQueries(db)
  for (const id of ['a', 'b'])
    q.insertSession({ id, backend: 'claude', title: id, projectId: null, createdAt: 1 })
  return { db, q }
}
function publication(q: DbQueries, id: string, overrides = {}): void {
  q.artifacts.createPublication({
    publicationId: id,
    artifactFileId: `file-${id}`,
    sessionId: 'a',
    relativePath: `file-${id}/report.md`,
    filename: 'report.md',
    title: 'Report',
    kind: 'markdown',
    sizeBytes: 5,
    hash: 'hash',
    inputSource: 'C:/work/report.md',
    publishedAt: 10,
    ...overrides
  })
}
function call(
  q: DbQueries,
  toolRunId: string,
  options: {
    sessionId?: string
    messageId?: number
    toolName?: string
    parentToolRunId?: string
  } = {}
): number {
  const messageId =
    options.messageId ??
    q.appendMessage({
      sessionId: options.sessionId ?? 'a',
      role: 'assistant',
      content: '',
      createdAt: 1
    })
  q.appendPart({
    messageId,
    type: 'tool_call',
    toolRunId,
    payloadJson: JSON.stringify({
      toolName: options.toolName ?? 'mcp__orca_artifacts__publish_artifact',
      args: {},
      ...(options.parentToolRunId ? { parentToolRunId: options.parentToolRunId } : {})
    })
  })
  return messageId
}
afterEach(() => {
  for (const db of connections.splice(0)) db.close()
})

describe('artifact DB ledger and original-call attachment', () => {
  it('keeps unlinked publications, latest by input source, and session-independent files', () => {
    const { db, q } = fixture()
    publication(q, 'p1')
    publication(q, 'p2', { publishedAt: 11 })
    publication(q, 'p3', { inputSource: 'C:/work/other.md', publishedAt: 12 })
    expect(q.artifacts.listLatest('a').map((p) => p.publicationId)).toEqual(['p3', 'p2'])
    expect(q.artifacts.getOwnedFile('b', 'p1')).toBeNull()
    q.deleteSession('a')
    expect(q.artifacts.listLatest('a')).toEqual([])
    expect(db.prepare('SELECT COUNT(*) AS n FROM artifact_files').get()).toEqual({ n: 3 })
  })
  it('rolls back both inserts when publication ownership is invalid', () => {
    const { db, q } = fixture()
    expect(() => publication(q, 'p1', { sessionId: 'absent' })).toThrow()
    expect(db.prepare('SELECT COUNT(*) AS n FROM artifact_files').get()).toEqual({ n: 0 })
  })
  it('attaches to original call, not the latest assistant; replay is idempotent', () => {
    const { q } = fixture()
    const original = call(q, 'tool-1')
    call(q, 'newer')
    publication(q, 'p1')
    const ref = q.artifacts.linkPublication('a', 'tool-1', 'p1')
    expect(ref?.publicationId).toBe('p1')
    expect(q.artifacts.linkPublication('a', 'tool-1', 'p1')).toEqual(ref)
    const artifacts = q.loadParts('a').filter((p) => p.type === 'artifact')
    expect(artifacts).toHaveLength(1)
    expect(artifacts[0].message_id).toBe(original)
    expect(q.artifacts.linkPublication('a', 'newer', 'p1')).toBeNull()
  })
  it('rejects other sessions, non-publisher and ambiguous original calls', () => {
    const { q } = fixture()
    publication(q, 'p1')
    call(q, 'other', { sessionId: 'b' })
    call(q, 'wrong', { toolName: 'Read' })
    call(q, 'ambiguous')
    call(q, 'ambiguous')
    for (const id of ['other', 'wrong', 'ambiguous', 'missing']) {
      expect(q.artifacts.linkPublication('a', id, 'p1')).toBeNull()
    }
    expect(q.loadParts('a').filter((p) => p.type === 'artifact')).toEqual([])
  })
  it('allows exact nested calls and validates a supplied parent while preserving reload metadata', () => {
    const { q } = fixture()
    publication(q, 'p1')
    call(q, 'nested', { parentToolRunId: 'parent' })
    expect(q.artifacts.linkPublication('a', 'nested', 'p1', 'other-parent')).toBeNull()
    expect(q.artifacts.linkPublication('a', 'nested', 'p1', 'parent')).not.toBeNull()
    expect(q.artifacts.linkPublication('a', 'nested', 'p1')).not.toBeNull()
    expect(
      JSON.parse(q.loadParts('a').find((p) => p.type === 'artifact')!.payload_json).parentToolRunId
    ).toBe('parent')
  })
  it('suppresses only equal cards in one message, retaining every publication and file', () => {
    const { db, q } = fixture()
    const messageId = call(q, 'one')
    call(q, 'two', { messageId })
    call(q, 'three', { messageId })
    publication(q, 'p1')
    publication(q, 'p2')
    publication(q, 'p3', { title: 'Changed' })
    expect(q.artifacts.linkPublication('a', 'one', 'p1')).not.toBeNull()
    expect(q.artifacts.linkPublication('a', 'two', 'p2')).toBeNull()
    expect(q.artifacts.linkPublication('a', 'two', 'p2')).toBeNull()
    expect(q.artifacts.linkPublication('a', 'three', 'p3')).not.toBeNull()
    expect(q.loadParts('a').filter((p) => p.type === 'artifact')).toHaveLength(2)
    expect(db.prepare('SELECT COUNT(*) AS n FROM session_artifacts').get()).toEqual({ n: 3 })
    expect(db.prepare('SELECT COUNT(*) AS n FROM artifact_files').get()).toEqual({ n: 3 })
  })
  it('does not deduplicate equal content in another message', () => {
    const { q } = fixture()
    call(q, 'one')
    call(q, 'two')
    publication(q, 'p1')
    publication(q, 'p2')
    expect(q.artifacts.linkPublication('a', 'one', 'p1')).not.toBeNull()
    expect(q.artifacts.linkPublication('a', 'two', 'p2')).not.toBeNull()
  })
  it('rolls back attachment if insertion of the actual message part fails', () => {
    const { db, q } = fixture()
    call(q, 'one')
    publication(q, 'p1')
    db.exec(
      "CREATE TRIGGER reject_artifact BEFORE INSERT ON message_parts WHEN NEW.type='artifact' BEGIN SELECT RAISE(ABORT, 'injected'); END"
    )
    expect(() => q.artifacts.linkPublication('a', 'one', 'p1')).toThrow('injected')
    expect(db.prepare('SELECT message_id FROM session_artifacts').get()).toEqual({
      message_id: null
    })
    db.exec('DROP TRIGGER reject_artifact')
    expect(q.artifacts.linkPublication('a', 'one', 'p1')).not.toBeNull()
  })
  it('fork copies independent refs including unlinked rows, rewrites cards, and survives parent deletion', () => {
    const { db, q } = fixture()
    call(q, 'one')
    publication(q, 'p1')
    publication(q, 'unlinked', { inputSource: 'C:/work/new.md' })
    q.artifacts.linkPublication('a', 'one', 'p1')
    q.copyMessagesToSession('a', 'b')
    const child = q.artifacts.listLatest('b')
    expect(child).toHaveLength(2)
    expect(child.every((p) => !['p1', 'unlinked'].includes(p.publicationId))).toBe(true)
    const part = q.loadParts('b').find((p) => p.type === 'artifact')!
    const ref = JSON.parse(part.payload_json).artifact
    expect(ref.artifactFileId).toBe('file-p1')
    expect(child.some((p) => p.publicationId === ref.publicationId)).toBe(true)
    q.deleteSession('a')
    expect(q.artifacts.getOwnedFile('b', ref.publicationId)?.artifactFileId).toBe('file-p1')
    q.deleteSession('b')
    expect(db.prepare('SELECT COUNT(*) AS n FROM artifact_files').get()).toEqual({ n: 2 })
  })
})

describe('artifact catalog across sessions', () => {
  it('keeps the latest artifact and ordinary file independently for the same input source', () => {
    const { q } = fixture()
    publication(q, 'old', { publishedAt: 1 })
    publication(q, 'latest', { publishedAt: 2 })
    publication(q, 'ordinary', { category: 'file', kind: 'file', publishedAt: 3 })
    publication(q, 'another-session', { sessionId: 'b', publishedAt: 4 })
    expect(q.artifacts.listLatest('a').map((item) => item.publicationId)).toEqual([
      'ordinary',
      'latest'
    ])
    expect(q.artifacts.listCatalog().map((item) => item.publicationId)).toEqual([
      'another-session',
      'latest'
    ])
    expect(q.artifacts.listCatalog()[0]).toEqual({
      publicationId: 'another-session',
      artifactFileId: 'file-another-session',
      sessionId: 'b',
      sessionTitle: 'b',
      title: 'Report',
      filename: 'report.md',
      kind: 'markdown',
      category: 'artifact',
      sizeBytes: 5,
      publishedAt: 4,
      pinned: false
    })
  })

  it('deduplicates shared fork files, persists pin state and inherits it on a new source version', () => {
    const { db, q } = fixture()
    publication(q, 'original')
    q.copyMessagesToSession('a', 'b')
    const child = q.artifacts.listLatest('b')[0]!
    expect(q.artifacts.setPinned('b', child.publicationId, true)).toBe(true)
    expect(q.artifacts.listCatalog()).toHaveLength(1)
    expect(q.artifacts.listCatalog()[0].pinned).toBe(true)
    publication(q, 'new-version', { publishedAt: 20 })
    expect(new DbQueries(db).artifacts.listCatalog().every((item) => item.pinned)).toBe(true)
    expect(q.artifacts.setPinned('a', 'new-version', false)).toBe(true)
    expect(
      q.artifacts.listCatalog().find((item) => item.publicationId === 'new-version')?.pinned
    ).toBe(false)
    expect(q.artifacts.getOwnedFile('b', child.publicationId)?.artifactFileId).toBe('file-original')
  })

  it('rejects pinning another session, an ordinary output or a trashed file', () => {
    const { q } = fixture()
    publication(q, 'artifact')
    publication(q, 'ordinary', { inputSource: 'other', category: 'file' })
    expect(q.artifacts.setPinned('b', 'artifact', true)).toBe(false)
    expect(q.artifacts.setPinned('a', 'ordinary', true)).toBe(false)
    q.artifacts.markTrashed('file-artifact', 20)
    expect(q.artifacts.setPinned('a', 'artifact', true)).toBe(false)
    expect(q.artifacts.listCatalog()).toEqual([])
  })

  it('removes a trashed latest file without resurrecting older versions or deleting the ledger', () => {
    const { db, q } = fixture()
    publication(q, 'old', { publishedAt: 1 })
    publication(q, 'latest', { publishedAt: 2 })
    q.copyMessagesToSession('a', 'b')
    q.artifacts.markTrashed('file-latest', 3)
    expect(q.artifacts.listCatalog()).toEqual([])
    expect(q.artifacts.listLatest('a').map((item) => item.publicationId)).toEqual(['latest'])
    expect(db.prepare('SELECT COUNT(*) AS n FROM artifact_files').get()).toEqual({ n: 2 })
    expect(db.prepare('SELECT COUNT(*) AS n FROM session_artifacts').get()).toEqual({ n: 4 })
  })
})
