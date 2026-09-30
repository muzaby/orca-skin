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
import { classifyArchiveBody } from './segment-classifier'

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
    bodyKind: 'plain',
    bodyAlternateText: null,
    bodyAlternateKind: null,
    bodyAlternateOmitted: false,
    bodyQualityFlags: [],
    bodySelectionReason: 'plain_preferred',
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
  it('combines partial field filters and sent-date boundaries with AND in both search branches', async () => {
    const store = await fixture()
    const start = new Date(2026, 8, 29).getTime()
    const end = new Date(2026, 8, 30).getTime()
    const base = mail({
      from: '김민수 <qa@example.test>',
      to: '담당 <team@example.test>',
      cc: 'review@example.test',
      attachments: [{ name: '견적%_원본.xlsx', mimeType: 'application/test', sizeBytes: 1 }]
    })
    const items = [start - 1, start, end - 1, end, null].map((sentAt, index) =>
      mail({ ...base, sentAt, itemKey: `date-${index}`, messageId: `<date-${index}@example.test>` })
    )
    await addRevision(store, 'date-fields', items)
    const oracle = openFileDatabase(store.dbPath, { initialize: () => {} })
    const ids = oracle
      .prepare('SELECT id, message_id FROM archive_mail ORDER BY id')
      .all() as Array<{ id: string; message_id: string }>
    oracle.close()
    const dateIds = (...indices: number[]): string[] =>
      ids
        .filter((row) => indices.some((index) => row.message_id === `<date-${index}@example.test>`))
        .map((row) => row.id)
        .sort()
    const expected = dateIds(1, 2)
    expect(
      store
        .search({ query: '', sentAfter: start, sentBefore: end })
        .map((hit) => hit.id)
        .sort()
    ).toEqual(expected)
    expect(
      store
        .search({ query: '', sentAfter: start })
        .map((hit) => hit.id)
        .sort()
    ).toEqual(dateIds(1, 2, 3))
    expect(
      store
        .search({ query: '', sentBefore: end })
        .map((hit) => hit.id)
        .sort()
    ).toEqual(dateIds(0, 1, 2))
    for (const query of ['', '서버 이전', 'example']) {
      const request = {
        query,
        from: '김민수',
        to: 'team@',
        cc: 'review@',
        attachmentName: '%_',
        sentAfter: start,
        sentBefore: end
      }
      expect(
        store
          .search(request)
          .map((hit) => hit.id)
          .sort()
      ).toEqual(expected)
      for (const field of ['from', 'to', 'cc', 'attachmentName'] as const)
        expect(store.search({ ...request, [field]: 'not-present' })).toEqual([])
    }
    expect(store.search({ query: '', from: '%_' })).toEqual([])
    expect(() => store.search({ query: '', sentAfter: end, sentBefore: start })).toThrow()
    expect(store.search({ query: '' })).toHaveLength(5)
  })

  it('requires the same verified occurrence to satisfy source and literal folder filters', async () => {
    const store = await fixture()
    const first = mail({ folderPath: '받은/승인%_폴더' })
    await addRevision(store, 'first-folder', [first])
    const oracle = openFileDatabase(store.dbPath, { initialize: () => {} })
    const { id } = oracle
      .prepare('SELECT id FROM archive_mail WHERE message_id=?')
      .get(first.messageId) as { id: string }
    oracle.close()
    const secondPath = 'C:/archive/second.pst'
    const secondId = archiveSourceId('pst', secondPath)
    const second = mail({
      ...first,
      sourceId: secondId,
      sourcePath: secondPath,
      folderPath: '다른/폴더',
      itemKey: 'second'
    })
    const started = store.beginRevision({
      sourceId: secondId,
      sourceKind: 'pst',
      sourcePath: secondPath,
      fingerprint: 'second-folder'
    })
    store.upsertBatch({ sourceId: secondId, revision: started.revision, mails: [second] })
    store.verifyRevision(secondId, started.revision, 'second-folder')
    for (const query of ['', '서버', 'migration']) {
      expect(store.search({ query, sourceId: secondId, folderPath: '승인' })).toEqual([])
      expect(store.search({ query, sourceId, folderPath: '%_' })).toMatchObject([
        { id, folderPath: '받은/승인%_폴더', sourceName: 'mail.pst' }
      ])
      expect(store.search({ query, sourceId: secondId, folderPath: '다른' })).toMatchObject([
        { id, folderPath: '다른/폴더', sourceName: 'second.pst' }
      ])
    }
    const stagingPath = 'C:/archive/staging.pst'
    const stagingId = archiveSourceId('pst', stagingPath)
    const revision = store.beginRevision({
      sourceId: stagingId,
      sourceKind: 'pst',
      sourcePath: stagingPath,
      fingerprint: 'pending'
    }).revision
    store.upsertBatch({
      sourceId: stagingId,
      revision,
      mails: [
        mail({ ...first, sourceId: stagingId, sourcePath: stagingPath, folderPath: '비공개/폴더' })
      ]
    })
    expect(store.search({ query: '', folderPath: '비공개' })).toEqual([])
  })

  it('persists and backfills segments without changing existing mail, identity or attachment references', async () => {
    const store = await fixture()
    const body = '결정 😀\r\n> 원문 미승인\r\n새 답변\n-- \nqa@example.test\n전화: 02-1234-5678\n'
    await addRevision(store, 'segments', [mail({ bodyText: body })])
    const id = store.search({ query: '미승인' })[0].id
    const original = store.get(id)!
    expect(original.bodySegments).toEqual(classifyArchiveBody(body))
    store.close()
    stores.splice(stores.indexOf(store), 1)
    const db = openFileDatabase(store.dbPath, { initialize: () => {} })
    const identity = db.prepare('SELECT identity_key FROM archive_mail WHERE id=?').get(id)
    // Simulate an already-used 0005 DB: no projection marker or segments exist.
    db.exec(
      "DROP TABLE archive_body_segment; DROP TABLE archive_body_projection; DELETE FROM _migrations WHERE name='0006_body_segments'"
    )
    db.close()
    const reopened = createMailArchiveStore(roots.at(-1)!)
    stores.push(reopened)
    expect(reopened.get(id)).toEqual(original)
    const check = openFileDatabase(reopened.dbPath, { initialize: () => {} })
    expect(check.prepare('SELECT identity_key FROM archive_mail WHERE id=?').get(id)).toEqual(
      identity
    )
    expect(
      check.prepare('SELECT COUNT(*) AS n FROM archive_body_segment WHERE mail_id=?').get(id)
    ).toEqual({ n: original.bodySegments.length })
    check.close()
    reopened.removeSource(sourceId)
    const removed = openFileDatabase(reopened.dbPath, { initialize: () => {} })
    expect(removed.prepare('SELECT COUNT(*) AS n FROM archive_body_segment').get()).toEqual({
      n: 0
    })
    removed.close()
  })
  it('rolls mail and attachment writes back when segment persistence fails', async () => {
    const store = await fixture()
    await addRevision(store, 'verified-before-failure', [mail()])
    const revision = store.beginRevision({
      sourceId,
      sourceKind: 'pst',
      sourcePath,
      fingerprint: 'projection-failure'
    }).revision
    const item = mail({
      itemKey: 'failed-new',
      messageId: '<failed-new@example.test>',
      bodyText: '> pending snapshot'
    })
    const db = openFileDatabase(store.dbPath, { initialize: () => {} })
    db.exec(
      "CREATE TRIGGER fail_segment BEFORE INSERT ON archive_body_segment BEGIN SELECT RAISE(ABORT, 'projection_failure'); END"
    )
    expect(() => store.upsertBatch({ sourceId, revision, mails: [item] })).toThrow(
      'projection_failure'
    )
    expect(db.prepare('SELECT COUNT(*) AS n FROM archive_mail').get()).toEqual({ n: 1 })
    expect(db.prepare('SELECT COUNT(*) AS n FROM archive_attachment').get()).toEqual({ n: 1 })
    db.exec('DROP TRIGGER fail_segment')
    db.close()
    expect(store.upsertBatch({ sourceId, revision, mails: [item] })).toEqual({
      inserted: 1,
      skipped: 0
    })
    store.verifyRevision(sourceId, revision, 'projection-failure')
    expect(store.get(store.search({ query: 'pending' })[0].id)?.bodySegments).toEqual(
      classifyArchiveBody(item.bodyText)
    )
  })
  it('retries failed backfill on reopen while preserving the verified snapshot and identifiers', async () => {
    const store = await fixture()
    await addRevision(store, 'backfill-retry', [mail({ bodyText: '원문 😀\r\n> 인용 보존' })])
    const id = store.search({ query: '인용' })[0].id
    const before = store.get(id)!
    store.close()
    stores.splice(stores.indexOf(store), 1)
    const db = openFileDatabase(store.dbPath, { initialize: () => {} })
    const identity = db.prepare('SELECT identity_key FROM archive_mail WHERE id=?').get(id)
    db.exec(`DELETE FROM archive_body_segment; DELETE FROM archive_body_projection;
      CREATE TRIGGER fail_backfill BEFORE INSERT ON archive_body_segment
      BEGIN SELECT RAISE(ABORT, 'backfill_failure'); END`)
    db.close()
    expect(() => createMailArchiveStore(roots.at(-1)!)).toThrow('backfill_failure')
    const unchanged = openFileDatabase(store.dbPath, { initialize: () => {} })
    expect(unchanged.prepare('SELECT body_text FROM archive_mail WHERE id=?').get(id)).toEqual({
      body_text: before.bodyText
    })
    expect(unchanged.prepare('SELECT identity_key FROM archive_mail WHERE id=?').get(id)).toEqual(
      identity
    )
    expect(unchanged.prepare('SELECT COUNT(*) AS n FROM archive_body_segment').get()).toEqual({
      n: 0
    })
    expect(unchanged.prepare('SELECT COUNT(*) AS n FROM archive_body_projection').get()).toEqual({
      n: 0
    })
    unchanged.exec('DROP TRIGGER fail_backfill')
    unchanged.close()
    const recovered = createMailArchiveStore(roots.at(-1)!)
    stores.push(recovered)
    expect(recovered.get(id)).toEqual(before)
  })
  it.skipIf(process.env.MAIL_ARCHIVE_BENCH !== '1')(
    'measures three EML cohorts without rebuilding the archive per file',
    async () => {
      const store = await fixture()
      const milliseconds: number[] = []
      for (let cohort = 0; cohort < 3; cohort++) {
        const start = performance.now()
        for (let offset = 0; offset < 1000; offset++) {
          const number = cohort * 1000 + offset
          const path = `C:/benchmark/${number}.eml`
          const id = archiveSourceId('eml', path)
          const item = mail({
            sourceKind: 'eml',
            sourcePath: path,
            sourceId: id,
            sourceFingerprint: `fp-${number}`,
            messageId: `<${number}@benchmark.test>`
          })
          const { revision } = store.beginRevision({
            sourceId: id,
            sourceKind: 'eml',
            sourcePath: path,
            fingerprint: item.sourceFingerprint
          })
          store.upsertBatch({ sourceId: id, revision, mails: [item] })
          store.verifyRevision(id, revision, item.sourceFingerprint)
        }
        milliseconds.push(Math.round(performance.now() - start))
        expect(store.stats().totalMessages).toBe((cohort + 1) * 1000)
        expect(store.search({ query: '이전 일정', limit: 10 })).toHaveLength(10)
      }
      // eslint-disable-next-line no-console -- opt-in benchmark evidence
      console.log('EML_COHORT_MS', JSON.stringify(milliseconds))
    },
    60_000
  )

  it('reuses mail identities across PST revisions and preserves all verified versions until explicit removal', async () => {
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
    expect(store.stats()).toMatchObject({ totalMessages: 3, emlMessages: 0, pstMessages: 3 })
    expect(store.search({ query: 'migration-plan', limit: 10 })[0]?.id).toBe(originalId)
    expect(store.search({ query: '인증서 문제', limit: 10 })).toHaveLength(1)
    expect(store.search({ query: '인증서 교체', limit: 10 })).toHaveLength(1)

    const unchanged = store.beginRevision({
      sourceId,
      sourceKind: 'pst',
      sourcePath,
      fingerprint: 'pst-revision-2'
    })
    expect(unchanged).toMatchObject({ unchanged: true, existingMessages: 2 })
    // Deleting all messages in the original PST must not erase a personal archive.
    await addRevision(store, 'empty-revision', [])
    expect(store.stats().totalMessages).toBe(3)
    expect(store.sources()[0]?.messageCount).toBe(3)
    expect(store.removeSource(sourceId)?.removedMessages).toBe(3)
    expect(store.stats().totalMessages).toBe(0)
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
    expect(store.attachmentLocation(stored!.attachments[0]!.id)).toMatchObject({
      sourceId,
      sourceKind: 'pst',
      sourcePath,
      sourceFingerprint: 'eml-attachment',
      itemKey: 'item-1',
      attachmentIndex: 0,
      name: 'migration-plan.xlsx'
    })
    expect(store.sourcePathInUse(sourcePath)).toBe(true)
    expect(stored).not.toHaveProperty('sourcePath')
    expect(stored).not.toHaveProperty('sourceFingerprint')
  })

  it('persists body quality and alternate text without indexing the alternate', async () => {
    const store = await fixture()
    const message = mail({
      subject: '본문 표현 확인',
      bodyText: '일반 텍스트의 결정 내용입니다.',
      bodyAlternateText: 'HTML-ALTERNATE-ONLY-SENTINEL-39017',
      bodyAlternateKind: 'html',
      bodyQualityFlags: ['alternative_mismatch', 'html_converted'],
      bodySelectionReason: 'plain_preferred'
    })
    await addRevision(store, 'body-quality-revision', [message])

    const stored = store.get(store.search({ query: '결정 내용', limit: 10 })[0]!.id)
    expect(stored).toMatchObject({
      bodyText: '일반 텍스트의 결정 내용입니다.',
      bodyKind: 'plain',
      bodyAlternateText: 'HTML-ALTERNATE-ONLY-SENTINEL-39017',
      bodyAlternateKind: 'html',
      bodyAlternateOmitted: false,
      bodyQualityFlags: ['alternative_mismatch', 'html_converted'],
      bodySelectionReason: 'plain_preferred'
    })
    expect(store.search({ query: 'HTML-ALTERNATE-ONLY-SENTINEL-39017', limit: 10 })).toHaveLength(0)
  })

  it('removes a source atomically, preserves shared mail, and never exposes source paths', async () => {
    const store = await fixture()
    const secondSourcePath = 'C:/archive/backup.pst'
    const secondSourceId = archiveSourceId('pst', secondSourcePath)
    const shared = mail()
    const privateMail = mail({
      itemKey: 'item-private',
      messageId: '<private@example.test>',
      subject: '개인 자료원 전용 메일'
    })
    const secondSourceShared = mail({
      sourceId: secondSourceId,
      sourcePath: secondSourcePath,
      sourceFingerprint: 'backup-revision',
      itemKey: 'backup-item'
    })

    await addRevision(store, 'primary-revision', [shared, privateMail])
    const secondRevision = store.beginRevision({
      sourceId: secondSourceId,
      sourceKind: 'pst',
      sourcePath: secondSourcePath,
      fingerprint: 'backup-revision'
    })
    store.upsertBatch({
      sourceId: secondSourceId,
      revision: secondRevision.revision,
      mails: [secondSourceShared]
    })
    store.verifyRevision(secondSourceId, secondRevision.revision, 'backup-revision')
    expect(store.search({ query: '', sourceId: secondSourceId })).toHaveLength(1)
    expect(store.search({ query: '개인 자료원', sourceId: secondSourceId })).toHaveLength(0)
    expect(store.search({ query: '개인 자료원', sourceId })).toHaveLength(1)

    expect(store.sources()).toEqual([
      expect.objectContaining({
        id: sourceId,
        kind: 'pst',
        name: 'mail.pst',
        messageCount: 2,
        sharedMessageCount: 1
      }),
      expect.objectContaining({
        id: secondSourceId,
        kind: 'pst',
        name: 'backup.pst',
        messageCount: 1,
        sharedMessageCount: 1
      })
    ])
    expect(JSON.stringify(store.sources())).not.toContain('C:/archive')

    const removed = store.removeSource(sourceId)
    expect(removed).toMatchObject({
      sourceName: 'mail.pst',
      removedMessages: 1,
      preservedMessages: 1
    })
    expect(store.sources()).toHaveLength(1)
    expect(store.search({ query: '서버 이전', limit: 10 })).toHaveLength(1)
    expect(store.search({ query: '개인 자료원 전용', limit: 10 })).toHaveLength(0)
    expect(store.get(store.search({ query: '서버 이전', limit: 10 })[0]!.id)).toMatchObject({
      sourceName: 'backup.pst'
    })
    expect(store.removeSource(sourceId)).toBeNull()
  })

  it('resolves reverse-imported Reply/References and leaves same-subject mail separate', async () => {
    const store = await fixture()
    const childPath = 'C:/archive/replies.pst'
    const childSourceId = archiveSourceId('pst', childPath)
    const parentPath = 'C:/archive/parents.pst'
    const parentSourceId = archiveSourceId('pst', parentPath)
    const child = mail({
      sourceId: childSourceId,
      sourcePath: childPath,
      sourceFingerprint: 'child-revision',
      itemKey: 'child',
      sentAt: 3,
      messageId: '<child@example.test>',
      inReplyTo: '<parent@example.test>',
      references: '<root@example.test> <parent@example.test>',
      subject: '같은 제목',
      bodyText: 'reply-marker'
    })
    const childRevision = store.beginRevision({
      sourceId: childSourceId,
      sourceKind: 'pst',
      sourcePath: childPath,
      fingerprint: 'child-revision'
    })
    store.upsertBatch({
      sourceId: childSourceId,
      revision: childRevision.revision,
      mails: [child]
    })
    store.verifyRevision(childSourceId, childRevision.revision, 'child-revision')
    const childId = store.search({ query: 'reply-marker', limit: 10 })[0]!.id
    expect(store.thread({ id: childId })).toMatchObject({
      mails: [expect.objectContaining({ id: childId })],
      relations: [],
      truncated: false
    })

    const root = mail({
      sourceId: parentSourceId,
      sourcePath: parentPath,
      sourceFingerprint: 'parent-revision',
      itemKey: 'root',
      sentAt: 1,
      messageId: '<root@example.test>',
      subject: '같은 제목',
      bodyText: 'root-marker'
    })
    const parent = mail({
      sourceId: parentSourceId,
      sourcePath: parentPath,
      sourceFingerprint: 'parent-revision',
      itemKey: 'parent',
      sentAt: 2,
      messageId: '<parent@example.test>',
      inReplyTo: '<root@example.test>',
      subject: '같은 제목',
      bodyText: 'parent-marker'
    })
    const unrelated = mail({
      sourceId: parentSourceId,
      sourcePath: parentPath,
      sourceFingerprint: 'parent-revision',
      itemKey: 'unrelated',
      sentAt: 4,
      messageId: '<unrelated@example.test>',
      subject: '같은 제목',
      bodyText: 'unrelated-marker'
    })
    const parentRevision = store.beginRevision({
      sourceId: parentSourceId,
      sourceKind: 'pst',
      sourcePath: parentPath,
      fingerprint: 'parent-revision'
    })
    store.upsertBatch({
      sourceId: parentSourceId,
      revision: parentRevision.revision,
      mails: [root, parent, unrelated]
    })
    store.verifyRevision(parentSourceId, parentRevision.revision, 'parent-revision')

    const thread = store.thread({ id: childId })
    expect(thread.mails.map((entry) => entry.id)).toHaveLength(3)
    expect(thread.mails.map((entry) => entry.subject)).toEqual([
      '같은 제목',
      '같은 제목',
      '같은 제목'
    ])
    expect(thread.mails.some((entry) => entry.snippet.includes('unrelated-marker'))).toBe(false)
    expect(thread.relations).toHaveLength(4)
    expect(thread.relations).toContainEqual({
      childMailId: childId,
      parentMailId: store.search({ query: 'parent-marker', limit: 10 })[0]!.id,
      kind: 'reply'
    })

    store.removeSource(parentSourceId)
    expect(store.thread({ id: childId })).toMatchObject({
      mails: [expect.objectContaining({ id: childId })],
      relations: [],
      truncated: false
    })
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
