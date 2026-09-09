import { describe, expect, it, vi, type Mock } from 'vitest'
import Database from 'better-sqlite3'
import type { ArtifactRef } from '../../../shared/artifacts'
import type { NormalizedEvent } from '../../../shared/ipc'
import type { TurnContext } from '../../contracts/turn'
import { DbQueries } from '../../infra/db/queries'
import { applyMigrations } from '../../infra/db/migrate'
vi.mock('electron', () => ({ webContents: { getAllWebContents: () => [] } }))
import { HistoryWriter } from './writer'

const artifact: ArtifactRef = {
  publicationId: 'pub-1',
  artifactFileId: 'file-1',
  title: 'Report',
  filename: 'report.md',
  kind: 'markdown',
  sizeBytes: 10,
  publishedAt: 1
}
const receipt = JSON.stringify({
  type: 'orca.artifact.published',
  version: 1,
  publicationId: 'pub-1'
})
const completion = (
  result: unknown
): Extract<NormalizedEvent, { type: 'tool.call.completed' }> => ({
  type: 'tool.call.completed',
  sessionId: 's1',
  toolRunId: 'original-tool',
  result,
  isError: false
})
function harness(): {
  writer: HistoryWriter
  turn: TurnContext
  linkPublication: Mock<() => ArtifactRef | null>
} {
  const db = { upsertToolResultPart: vi.fn() } as unknown as DbQueries
  const linkPublication = vi.fn((): ArtifactRef | null => artifact)
  const writer = new HistoryWriter(db, () => false, undefined, { linkPublication })
  const turn = {
    dbSessionId: 's1',
    currentAssistantMessageId: 999,
    askResolved: new Map()
  } as unknown as TurnContext
  return { writer, turn, linkPublication }
}

describe('HistoryWriter artifact receipt', () => {
  it.each([undefined, 'parent-tool'])(
    'uses the persisted original tool call after steer and reload (parent=%s)',
    (parentToolRunId) => {
      const db = new Database(':memory:')
      try {
        applyMigrations(db)
        const queries = new DbQueries(db)
        queries.insertSession({
          id: 's1',
          backend: 'claude',
          title: null,
          projectId: null,
          createdAt: 1
        })
        queries.insertSession({
          id: 'other',
          backend: 'claude',
          title: null,
          projectId: null,
          createdAt: 1
        })
        const writer = new HistoryWriter(queries, () => false, undefined, queries.artifacts)
        const turn = {
          dbSessionId: 's1',
          currentAssistantMessageId: null,
          assistantText: '',
          providerKey: null,
          askResolved: new Map()
        } as unknown as TurnContext
        writer.persist(turn, {
          type: 'tool.call.started',
          sessionId: 's1',
          toolRunId: 'original-tool',
          toolName: 'mcp__orca_artifacts__publish_artifact',
          args: { path: 'report.md' },
          ...(parentToolRunId ? { parentToolRunId } : {})
        })
        const originalMessageId = turn.currentAssistantMessageId
        queries.artifacts.createPublication({
          ...artifact,
          sessionId: 's1',
          relativePath: 'file-1/report.md',
          hash: 'hash',
          inputSource: 'C:/work/report.md'
        })
        writer.commitUserMessage(turn, { text: 'steer', createdAt: 2 })
        writer.persist(turn, {
          type: 'message.completed',
          sessionId: 's1',
          message: { text: 'next answer' }
        })
        const newerMessageId = turn.currentAssistantMessageId
        expect(newerMessageId).not.toBe(originalMessageId)
        const event = {
          ...completion([{ type: 'text', text: receipt }]),
          ...(parentToolRunId ? { parentToolRunId } : {})
        }
        writer.persist(turn, event)
        writer.persist(turn, completion(receipt))
        expect(event.artifact).toEqual(artifact)
        const fresh = new DbQueries(db)
        const cards = fresh.loadParts('s1').filter((part) => part.type === 'artifact')
        expect(cards).toHaveLength(1)
        expect(cards[0].message_id).toBe(originalMessageId)
        expect(JSON.parse(cards[0].payload_json)).toEqual({
          artifact,
          ...(parentToolRunId ? { parentToolRunId } : {})
        })
        expect(fresh.loadParts('other')).toEqual([])
      } finally {
        db.close()
      }
    }
  )

  it.each([receipt, [{ type: 'text', text: receipt }]])(
    'links only the original result identity and enriches the relay event',
    (result) => {
      const { writer, turn, linkPublication } = harness()
      const event = completion(result)
      writer.persist(turn, event)
      expect(linkPublication).toHaveBeenCalledExactlyOnceWith(
        's1',
        'original-tool',
        'pub-1',
        undefined
      )
      expect(event.artifact).toEqual(artifact)
      expect(turn.currentAssistantMessageId).toBe(999)
    }
  )

  it.each([
    'ordinary result',
    { type: 'orca.artifact.published', version: 1, publicationId: 'pub-1' },
    JSON.stringify({ type: 'orca.artifact.published', version: 2, publicationId: 'pub-1' }),
    JSON.stringify({ type: 'orca.artifact.published', version: 1, publicationId: '' }),
    [
      { type: 'text', text: receipt },
      { type: 'text', text: receipt }
    ]
  ])('does not turn non-receipts into artifacts', (result) => {
    const { writer, turn, linkPublication } = harness()
    const event = { ...completion(result), artifact }
    writer.persist(turn, event)
    expect(linkPublication).not.toHaveBeenCalled()
    expect(event.artifact).toBeUndefined()
  })

  it('rejects error and cross-session results and leaves failed links unlinked', () => {
    const { writer, turn, linkPublication } = harness()
    writer.persist(turn, { ...completion(receipt), isError: true })
    writer.persist(turn, { ...completion(receipt), sessionId: 'other' })
    expect(linkPublication).not.toHaveBeenCalled()
    linkPublication.mockReturnValue(null)
    const event = completion(receipt)
    writer.persist(turn, event)
    expect(event.artifact).toBeUndefined()
  })
})
