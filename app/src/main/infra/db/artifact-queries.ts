import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { ArtifactCatalogItem, ArtifactRef } from '../../../shared/artifacts'

export interface ArtifactPublicationInsert extends ArtifactRef {
  sessionId: string
  relativePath: string
  hash: string
  inputSource: string
}

export interface ArtifactFileRecord extends ArtifactRef {
  relativePath: string
  hash: string
  inputSource: string
  lastTrashedAt: number | null
}

interface PublicationRow extends ArtifactFileRecord {
  sessionId: string
  messageId: number | null
  toolRunId: string | null
  cardAttached: number
  pinned: number
}

const SELECT_PUBLICATION = `SELECT p.id AS publicationId, p.session_id AS sessionId,
  p.message_id AS messageId, p.tool_run_id AS toolRunId, p.card_attached AS cardAttached,
  p.title, p.input_source AS inputSource, p.published_at AS publishedAt,
  f.id AS artifactFileId, f.relative_path AS relativePath, f.filename, f.kind, f.category, f.pinned,
  f.size_bytes AS sizeBytes, f.hash, f.last_trashed_at AS lastTrashedAt
  FROM session_artifacts p JOIN artifact_files f ON f.id = p.artifact_file_id`

// Keep tombstoned latest versions in this comparison so deleting a newer file cannot expose an older one.
const IS_LATEST = `NOT EXISTS (SELECT 1 FROM session_artifacts n
  JOIN artifact_files nf ON nf.id = n.artifact_file_id
  WHERE n.session_id = p.session_id AND n.input_source = p.input_source AND nf.category = f.category
    AND (n.published_at > p.published_at OR (n.published_at = p.published_at AND n.id > p.id)))`

function ref(row: ArtifactRef): ArtifactRef {
  return {
    publicationId: row.publicationId,
    artifactFileId: row.artifactFileId,
    title: row.title,
    filename: row.filename,
    kind: row.kind,
    category: row.category ?? 'artifact',
    sizeBytes: row.sizeBytes,
    publishedAt: row.publishedAt
  }
}

export class ArtifactQueries {
  private readonly owned: Database.Statement
  private readonly latest: Database.Statement
  private readonly catalog: Database.Statement
  private readonly pin: Database.Statement
  private readonly insertPublication: Database.Statement
  private readonly create: Database.Transaction<(input: ArtifactPublicationInsert) => void>
  private readonly link: Database.Transaction<
    (
      sessionId: string,
      toolRunId: string,
      publicationId: string,
      parentToolRunId?: string
    ) => ArtifactRef | null
  >
  private readonly trash: Database.Statement

  constructor(private readonly db: Database.Database) {
    this.owned = db.prepare(`${SELECT_PUBLICATION} WHERE p.session_id = ? AND p.id = ?`)
    this.latest = db.prepare(`${SELECT_PUBLICATION} WHERE p.session_id = @sessionId
      AND ${IS_LATEST}
      ORDER BY p.published_at DESC, p.id DESC`)
    this.catalog =
      db.prepare(`${SELECT_PUBLICATION.replace('SELECT ', 'SELECT COALESCE(s.title, p.title) AS sessionTitle, ')}
      JOIN sessions s ON s.id = p.session_id
      WHERE f.category = 'artifact' AND ${IS_LATEST} AND f.last_trashed_at IS NULL
      ORDER BY p.published_at DESC, p.id DESC`)
    this.pin = db.prepare(`UPDATE artifact_files SET pinned = @pinned
      WHERE category = 'artifact' AND last_trashed_at IS NULL AND id =
        (SELECT artifact_file_id FROM session_artifacts WHERE session_id = @sessionId AND id = @publicationId)`)
    const insertFile = db.prepare(`INSERT INTO artifact_files
      (id, relative_path, filename, kind, category, pinned, size_bytes, hash, created_at)
      VALUES (@artifactFileId, @relativePath, @filename, @kind, @category, @pinned, @sizeBytes, @hash, @publishedAt)`)
    const previousPin =
      db.prepare(`SELECT CASE WHEN f.last_trashed_at IS NULL THEN f.pinned ELSE 0 END AS pinned
      FROM session_artifacts p JOIN artifact_files f ON f.id = p.artifact_file_id
      WHERE p.session_id = @sessionId AND p.input_source = @inputSource AND f.category = @category
      ORDER BY p.published_at DESC, p.id DESC LIMIT 1`)
    this.insertPublication = db.prepare(`INSERT INTO session_artifacts
      (id, session_id, artifact_file_id, title, input_source, published_at, message_id, tool_run_id, card_attached)
      VALUES (@publicationId, @sessionId, @artifactFileId, @title, @inputSource, @publishedAt, @messageId, @toolRunId, @cardAttached)`)
    this.create = db.transaction((input) => {
      const normalized = { ...input, category: input.category ?? 'artifact' }
      const previous = previousPin.get(normalized) as { pinned: number } | undefined
      insertFile.run({ ...normalized, pinned: previous?.pinned ?? 0 })
      this.insertPublication.run({ ...input, messageId: null, toolRunId: null, cardAttached: 0 })
    })
    const calls = db.prepare(`SELECT m.id AS messageId, mp.payload_json AS payload
      FROM message_parts mp JOIN messages m ON m.id = mp.message_id
      WHERE m.session_id = ? AND mp.type = 'tool_call' AND mp.tool_run_id = ?`)
    const duplicate = db.prepare(`SELECT 1 FROM session_artifacts p
      JOIN artifact_files f ON f.id = p.artifact_file_id
      WHERE p.session_id = @sessionId AND p.message_id = @messageId AND p.card_attached = 1
        AND p.input_source = @inputSource AND f.hash = @hash AND p.title = @title LIMIT 1`)
    const connect = db.prepare(`UPDATE session_artifacts SET message_id = @messageId,
      tool_run_id = @toolRunId, card_attached = @cardAttached WHERE id = @publicationId`)
    const insertPart =
      db.prepare(`INSERT INTO message_parts (message_id, idx, type, tool_run_id, payload_json)
      VALUES (@messageId, (SELECT COALESCE(MAX(idx), -1) + 1 FROM message_parts WHERE message_id = @messageId),
        'artifact', @toolRunId, @payload)`)
    this.link = db.transaction((sessionId, toolRunId, publicationId, parentToolRunId) => {
      const publication = this.owned.get(sessionId, publicationId) as PublicationRow | undefined
      if (!publication || publication.category !== 'artifact') return null
      const candidates = calls.all(sessionId, toolRunId) as Array<{
        messageId: number
        payload: string
      }>
      if (candidates.length !== 1) return null
      const original = candidates[0]
      let payload: Record<string, unknown>
      try {
        payload = JSON.parse(original.payload)
      } catch {
        return null
      }
      if (
        !payload ||
        payload.toolName !== 'mcp__orca_artifacts__publish_artifact' ||
        (parentToolRunId !== undefined && payload.parentToolRunId !== parentToolRunId)
      )
        return null
      if (publication.toolRunId !== null) {
        return publication.toolRunId === toolRunId &&
          publication.messageId === original.messageId &&
          publication.cardAttached === 1
          ? ref(publication)
          : null
      }
      const connection = { ...publication, messageId: original.messageId, toolRunId }
      const cardAttached = duplicate.get(connection) ? 0 : 1
      connect.run({ ...connection, cardAttached })
      if (!cardAttached) return null
      const artifact = ref(publication)
      insertPart.run({
        ...connection,
        payload: JSON.stringify({
          artifact,
          ...(typeof payload.parentToolRunId === 'string'
            ? { parentToolRunId: payload.parentToolRunId }
            : {})
        })
      })
      return artifact
    })
    this.trash = db.prepare('UPDATE artifact_files SET last_trashed_at = ? WHERE id = ?')
  }

  createPublication(input: ArtifactPublicationInsert): void {
    this.create(input)
  }
  linkPublication(
    sessionId: string,
    toolRunId: string,
    publicationId: string,
    parentToolRunId?: string
  ): ArtifactRef | null {
    return this.link(sessionId, toolRunId, publicationId, parentToolRunId)
  }
  listLatest(sessionId: string): ArtifactRef[] {
    return (this.latest.all({ sessionId }) as PublicationRow[]).map(ref)
  }
  listCatalog(): ArtifactCatalogItem[] {
    const seen = new Set<string>()
    const rows = this.catalog.all() as Array<PublicationRow & { sessionTitle: string }>
    return rows.flatMap((row) => {
      if (seen.has(row.artifactFileId)) return []
      seen.add(row.artifactFileId)
      return [
        {
          ...ref(row),
          sessionId: row.sessionId,
          sessionTitle: row.sessionTitle,
          pinned: row.pinned === 1
        }
      ]
    })
  }
  setPinned(sessionId: string, publicationId: string, pinned: boolean): boolean {
    return this.pin.run({ sessionId, publicationId, pinned: pinned ? 1 : 0 }).changes > 0
  }
  getOwnedFile(sessionId: string, publicationId: string): ArtifactFileRecord | null {
    return (this.owned.get(sessionId, publicationId) as PublicationRow | undefined) ?? null
  }
  markTrashed(artifactFileId: string, at: number): void {
    this.trash.run(at, artifactFileId)
  }

  // Called inside the existing message-copy transaction: refs and copied card IDs cannot split.
  copyForFork(src: string, dst: string, messages: ReadonlyMap<number, number>): void {
    if (!this.db.inTransaction) throw new Error('artifact fork requires message transaction')
    const rows = this.db
      .prepare(`${SELECT_PUBLICATION} WHERE p.session_id = ?`)
      .all(src) as PublicationRow[]
    const replacements = new Map<string, ArtifactRef>()
    for (const row of rows) {
      const copy = {
        ...row,
        publicationId: randomUUID(),
        sessionId: dst,
        messageId: row.messageId === null ? null : (messages.get(row.messageId) ?? null)
      }
      this.insertPublication.run(copy)
      replacements.set(row.publicationId, ref(copy))
    }
    const parts = this.db
      .prepare(
        `SELECT mp.id, mp.payload_json AS payload FROM message_parts mp
      JOIN messages m ON m.id = mp.message_id WHERE m.session_id = ? AND mp.type = 'artifact'`
      )
      .all(dst) as Array<{ id: number; payload: string }>
    const update = this.db.prepare('UPDATE message_parts SET payload_json = ? WHERE id = ?')
    for (const part of parts) {
      const payload = JSON.parse(part.payload) as { artifact?: ArtifactRef }
      const replacement = payload.artifact && replacements.get(payload.artifact.publicationId)
      if (replacement) update.run(JSON.stringify({ ...payload, artifact: replacement }), part.id)
    }
  }
}
