import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { warmFileSqlite } from '../../../infra/db/warm-file-sqlite'
import { openFileDatabase } from '../../../infra/db/file-database'
import { applyMailArchiveMigrations } from './migrate'
import { archiveMailIdentityKey, archiveSourceId } from './identity'
import { createMailArchiveStore } from './store'
import type { NormalizedArchiveMail } from './types'

const roots: string[] = []
const stores: Array<ReturnType<typeof createMailArchiveStore>> = []
const sourcePath = 'C:/archive/mail.pst'
const sourceId = archiveSourceId('pst', sourcePath)

beforeAll(warmFileSqlite)
afterEach(async () => {
  for (const store of stores.splice(0)) store.close()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

function mail(
  overrides: Partial<Omit<NormalizedArchiveMail, 'identityKey'>> = {}
): NormalizedArchiveMail {
  const partial: Omit<NormalizedArchiveMail, 'identityKey'> = {
    sourceKind: 'pst' as const,
    sourceId,
    sourcePath,
    sourceFingerprint: 'fingerprint-one',
    itemKey: 'item-1',
    folderPath: '받은 편지함',
    sentAt: 1_700_000_000_000,
    from: 'sender@example.test',
    to: 'team@example.test',
    cc: '',
    subject: '서버 이전 일정',
    bodyText: '서버 이전을 검토한 뒤 일정 확정합니다.',
    messageId: '<one@example.test>',
    inReplyTo: null,
    references: null,
    threadKey: '<one@example.test>',
    attachments: [
      { name: 'migration-plan.xlsx', mimeType: 'application/vnd.ms-excel', sizeBytes: 12 }
    ],
    sizeBytes: 200,
    ...overrides
  }
  return { ...partial, identityKey: archiveMailIdentityKey(partial) }
}

async function fixture(): Promise<ReturnType<typeof createMailArchiveStore>> {
  const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-store-'))
  roots.push(root)
  const store = createMailArchiveStore(root)
  stores.push(store)
  return store
}

async function addRevision(
  store: ReturnType<typeof createMailArchiveStore>,
  fingerprint: string,
  mails: readonly NormalizedArchiveMail[]
): Promise<{ inserted: number; skipped: number }> {
  const started = store.beginRevision({
    sourceId,
    sourceKind: 'pst',
    sourcePath,
    fingerprint
  })
  if (started.unchanged) return { inserted: 0, skipped: started.existingMessages }
  const counts = store.upsertBatch({ sourceId, revision: started.revision, mails })
  store.verifyRevision(sourceId, started.revision, fingerprint)
  return counts
}

describe('mail archive store', () => {
  it('reuses mail identities across PST revisions and exposes only the active revision', async () => {
    const store = await fixture()
    const original = mail()
    const oldVersion = mail({
      itemKey: 'item-2',
      messageId: '<reused@example.test>',
      subject: '서버 이전 보류',
      bodyText: '이전 서버의 인증서 문제로 보류했습니다.'
    })
    const first = await addRevision(store, 'pst-revision-1', [original, oldVersion])
    expect(first).toEqual({ inserted: 2, skipped: 0 })
    const originalId = store.search({ query: 'migration-plan', limit: 10 })[0]?.id

    const updated = mail({
      ...original,
      sourceFingerprint: 'pst-revision-2',
      itemKey: 'item-1'
    })
    const editedWithSameMessageId = mail({
      ...oldVersion,
      sourceFingerprint: 'pst-revision-2',
      bodyText: '인증서 교체 후 이전 서버 일정이 확정됐습니다.'
    })
    const second = await addRevision(store, 'pst-revision-2', [updated, editedWithSameMessageId])

    expect(second).toEqual({ inserted: 1, skipped: 1 })
    expect(store.stats()).toMatchObject({ totalMessages: 2, emlMessages: 0, pstMessages: 2 })
    expect(store.search({ query: 'migration-plan', limit: 10 })[0]?.id).toBe(originalId)
    expect(store.search({ query: '인증서 문제', limit: 10 })).toHaveLength(0)
    expect(store.search({ query: '인증서 교체', limit: 10 })).toHaveLength(1)

    const unchanged = store.beginRevision({
      sourceId,
      sourceKind: 'pst',
      sourcePath,
      fingerprint: 'pst-revision-2'
    })
    expect(unchanged).toMatchObject({ unchanged: true, existingMessages: 2 })
  })

  it('reuses ID-less mail only when both source locator and normalized payload match', async () => {
    const store = await fixture()
    const original = mail({ messageId: null, itemKey: 'folder/message-1' })
    expect(await addRevision(store, 'idless-revision-1', [original])).toEqual({
      inserted: 1,
      skipped: 0
    })

    const sameLocatorAndPayload = mail({
      ...original,
      sourceFingerprint: 'idless-revision-2'
    })
    expect(await addRevision(store, 'idless-revision-2', [sameLocatorAndPayload])).toEqual({
      inserted: 0,
      skipped: 1
    })

    const differentLocator = mail({
      ...original,
      sourceFingerprint: 'idless-revision-3',
      itemKey: 'folder/message-2'
    })
    expect(await addRevision(store, 'idless-revision-3', [differentLocator])).toEqual({
      inserted: 1,
      skipped: 0
    })

    const editedPayload = mail({
      ...original,
      sourceFingerprint: 'idless-revision-4',
      bodyText: '인증 조건이 변경되었습니다.'
    })
    expect(await addRevision(store, 'idless-revision-4', [editedPayload])).toEqual({
      inserted: 1,
      skipped: 0
    })
  })

  it('matches every whitespace-separated token and treats LIKE metacharacters literally', async () => {
    const store = await fixture()
    const both = mail({ subject: '서버 이전 승인', bodyText: '다음 주에 진행합니다.' })
    const onlyOne = mail({
      itemKey: 'item-2',
      messageId: '<two@example.test>',
      subject: '서버 점검',
      bodyText: '다음 주 점검 일정입니다.'
    })
    await addRevision(store, 'eml-one', [both, onlyOne])

    expect(store.search({ query: '서버 이전', limit: 10 })).toHaveLength(1)
    expect(store.search({ query: '서버 다음 주', limit: 10 })).toHaveLength(2)
    expect(store.search({ query: '%_', limit: 10 })).toHaveLength(0)
  })

  it('returns the complete message while searching only attachment names', async () => {
    const store = await fixture()
    const source = mail({
      bodyText: '서버 이전을 검토합니다.',
      attachments: [
        { name: 'migration-plan.xlsx', mimeType: 'application/vnd.ms-excel', sizeBytes: 12 }
      ]
    })
    await addRevision(store, 'eml-attachment', [source])
    const hit = store.search({ query: 'migration-plan', limit: 10 })[0]!
    expect(hit).toMatchObject({
      subject: '서버 이전 일정',
      attachmentNames: ['migration-plan.xlsx']
    })
    const stored = store.get(hit.id)
    expect(stored).toMatchObject({
      bodyText: '서버 이전을 검토합니다.',
      messageId: '<one@example.test>',
      attachments: [{ name: 'migration-plan.xlsx' }]
    })
    expect(stored).not.toHaveProperty('sourcePath')
    expect(stored).not.toHaveProperty('sourceFingerprint')
  })

  it('backfills duplicate legacy rows into one mail identity and activates the latest PST snapshot', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-legacy-'))
    roots.push(root)
    const archiveRoot = join(root, 'mail-archive')
    await mkdir(archiveRoot, { recursive: true })
    const legacy = openFileDatabase(join(archiveRoot, 'archive.db'), {
      initialize: (db) => applyMailArchiveMigrations(db, '0001_mail_archive')
    })
    const insert = legacy.prepare(`
      INSERT INTO archive_mail (
        id, source_kind, source_path, source_fingerprint, item_key, folder_path, sent_at, imported_at,
        from_addr, to_addrs, cc_addrs, subject, body_text, message_id, in_reply_to, references_header,
        thread_key, attachment_names, size_bytes
      ) VALUES (
        @id, 'pst', @sourcePath, @fingerprint, 'descriptor-42', '받은 편지함', 1700000000000, @importedAt,
        'sender@example.test', 'team@example.test', '', '레거시 메일', 'legacy migration approval',
        '<legacy@example.test>', NULL, NULL, '<legacy@example.test>', '[]', 100
      )
    `)
    insert.run({
      id: 'legacy-version-one',
      sourcePath,
      fingerprint: 'legacy-pst-one',
      importedAt: 1_700_000_001_000
    })
    insert.run({
      id: 'legacy-version-two',
      sourcePath,
      fingerprint: 'legacy-pst-two',
      importedAt: 1_700_000_002_000
    })
    legacy.close()

    const store = createMailArchiveStore(root)
    stores.push(store)
    const hits = store.search({ query: 'legacy approval', limit: 10 })
    expect(hits).toHaveLength(1)
    expect(hits[0]?.id).toBe('legacy-version-one')
    expect(store.stats()).toMatchObject({ totalMessages: 1, pstMessages: 1 })
  })
})
