import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { warmFileSqlite } from '../../../infra/db/warm-file-sqlite'
import { archiveMailIdentityKey, archiveSourceId } from './identity'
import { createMailArchiveStore, type MailArchiveStore } from './store'
import type { NormalizedArchiveMail } from './types'

const roots: string[] = []
const stores: MailArchiveStore[] = []
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
    sourceId,
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
    attachments: [
      { name: 'migration-plan.xlsx', mimeType: 'application/vnd.ms-excel', sizeBytes: 12 }
    ],
    ...overrides
  }
  return { ...partial, identityKey: archiveMailIdentityKey(partial) }
}

async function fixture(): Promise<MailArchiveStore> {
  const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-store-'))
  roots.push(root)
  const store = createMailArchiveStore(root)
  stores.push(store)
  return store
}

function addRevision(
  store: MailArchiveStore,
  fingerprint: string,
  mails: readonly NormalizedArchiveMail[],
  source = { sourceId, sourcePath }
): { inserted: number; skipped: number } {
  const started = store.beginRevision({ ...source, sourceKind: 'pst', fingerprint })
  if (started.unchanged) return { inserted: 0, skipped: started.existingMessages }
  const counts = store.upsertBatch({ sourceId: source.sourceId, revision: started.revision, mails })
  store.verifyRevision({ sourceId: source.sourceId, revision: started.revision, fingerprint })
  store.refreshRelations()
  return counts
}

describe('mail archive store', () => {
  it('accumulates PST revisions: reuses identities and keeps mail later deleted or edited in the source', async () => {
    const store = await fixture()
    const original = mail()
    const pending = mail({
      itemKey: 'item-2',
      messageId: '<reused@example.test>',
      subject: '서버 이전 보류',
      bodyText: '이전 서버의 인증서 문제로 보류했습니다.'
    })
    expect(addRevision(store, 'pst-revision-1', [original, pending])).toEqual({
      inserted: 2,
      skipped: 0
    })
    const originalId = store.search({ query: 'migration-plan', limit: 10 })[0]?.id

    const edited = mail({ ...pending, bodyText: '인증서 교체 후 이전 서버 일정이 확정됐습니다.' })
    expect(addRevision(store, 'pst-revision-2', [original, edited])).toEqual({
      inserted: 1,
      skipped: 1
    })
    expect(store.search({ query: 'migration-plan', limit: 10 })[0]?.id).toBe(originalId)
    // 같은 Message-ID의 수정 본문은 별도 결과로 보존한다(plan §5·§11).
    expect(store.search({ query: '인증서 문제', limit: 10 })).toHaveLength(1)
    expect(store.search({ query: '인증서 교체', limit: 10 })).toHaveLength(1)

    // Outlook에서 지운 메일도 명시 제거 전까지 남는다(D-010).
    expect(addRevision(store, 'pst-revision-3', [original])).toEqual({ inserted: 0, skipped: 1 })
    expect(store.stats()).toEqual({ totalMessages: 3, emlMessages: 0, pstMessages: 3 })
    expect(
      store.beginRevision({
        sourceId,
        sourceKind: 'pst',
        sourcePath,
        fingerprint: 'pst-revision-3'
      })
    ).toMatchObject({ unchanged: true, existingMessages: 1 })
  })

  it('hides a staging revision until it is verified and removes its new mail on abort', async () => {
    const store = await fixture()
    const started = store.beginRevision({
      sourceId,
      sourceKind: 'pst',
      sourcePath,
      fingerprint: 'staged'
    })
    store.upsertBatch({ sourceId, revision: started.revision, mails: [mail()] })
    expect(store.search({ query: '서버 이전', limit: 10 })).toHaveLength(0)
    expect(store.stats().totalMessages).toBe(0)

    store.abortRevision({ sourceId, revision: started.revision })
    expect(() =>
      store.verifyRevision({ sourceId, revision: started.revision, fingerprint: 'staged' })
    ).toThrow('mail_revision_not_staging')
    expect(addRevision(store, 'staged', [mail()])).toEqual({ inserted: 1, skipped: 0 })
  })

  it('reuses ID-less mail only when both source locator and normalized payload match', async () => {
    const store = await fixture()
    const original = mail({ messageId: null, itemKey: 'folder/message-1' })
    expect(addRevision(store, 'idless-1', [original])).toEqual({ inserted: 1, skipped: 0 })
    expect(addRevision(store, 'idless-2', [original])).toEqual({ inserted: 0, skipped: 1 })
    expect(
      addRevision(store, 'idless-3', [mail({ ...original, itemKey: 'folder/message-2' })])
    ).toEqual({
      inserted: 1,
      skipped: 0
    })
    expect(
      addRevision(store, 'idless-4', [
        mail({ ...original, bodyText: '인증 조건이 변경되었습니다.' })
      ])
    ).toEqual({ inserted: 1, skipped: 0 })
  })

  it('matches every whitespace-separated token, treats LIKE metacharacters literally, and filters by source', async () => {
    const store = await fixture()
    const both = mail({ subject: '서버 이전 승인', bodyText: '다음 주에 진행합니다.' })
    const onlyOne = mail({
      itemKey: 'item-2',
      messageId: '<two@example.test>',
      subject: '서버 점검',
      bodyText: '다음 주 점검 일정입니다.'
    })
    addRevision(store, 'pst-one', [both, onlyOne])
    const otherPath = 'C:/archive/other.pst'
    const otherId = archiveSourceId('pst', otherPath)
    addRevision(
      store,
      'other-one',
      [
        mail({
          sourceId: otherId,
          messageId: '<three@example.test>',
          subject: '서버 이전 다른 자료원'
        })
      ],
      { sourceId: otherId, sourcePath: otherPath }
    )

    expect(store.search({ query: '서버 이전', limit: 10 })).toHaveLength(2)
    expect(store.search({ query: '서버 이전', sourceId, limit: 10 })).toHaveLength(1)
    expect(store.search({ query: '서버 다음 주', limit: 10 })).toHaveLength(2)
    expect(store.search({ query: '%_', limit: 10 })).toHaveLength(0)
    expect(store.search({ query: '승인', limit: 10 })[0]?.snippet).toContain(
      '다음 주에 진행합니다.'
    )
  })

  it('returns the complete message while searching only attachment names', async () => {
    const store = await fixture()
    addRevision(store, 'pst-attachment', [mail({ bodyText: '서버 이전을 검토합니다.' })])
    const hit = store.search({ query: 'migration-plan', limit: 10 })[0]!
    expect(hit).toMatchObject({
      subject: '서버 이전 일정',
      sourceName: 'mail.pst',
      folderPath: '받은 편지함',
      attachmentNames: ['migration-plan.xlsx']
    })
    const stored = store.get(hit.id)!
    expect(stored).toMatchObject({
      bodyText: '서버 이전을 검토합니다.',
      attachments: [{ name: 'migration-plan.xlsx' }]
    })
    expect(store.attachmentLocation(stored.attachments[0]!.id)).toMatchObject({
      sourceKind: 'pst',
      sourcePath,
      sourceFingerprint: 'pst-attachment',
      itemKey: 'item-1',
      attachmentIndex: 0,
      name: 'migration-plan.xlsx'
    })
    expect(store.sourcePathInUse(sourcePath)).toBe(true)
    expect(JSON.stringify(stored)).not.toContain('C:/archive')
  })

  it('resolves EML folder attachments to the file under the source root', async () => {
    const store = await fixture()
    const root = 'C:/archive/eml-folder'
    const folderId = archiveSourceId('eml', root)
    const started = store.beginRevision({
      sourceId: folderId,
      sourceKind: 'eml',
      sourcePath: root,
      fingerprint: 'file-a'
    })
    store.upsertBatch({
      sourceId: folderId,
      revision: started.revision,
      mails: [mail({ sourceId: folderId, itemKey: 'nested/a.eml', folderPath: null })]
    })
    store.verifyRevision({ sourceId: folderId, revision: started.revision, fingerprint: 'file-a' })

    const stored = store.get(store.search({ query: 'migration-plan', limit: 10 })[0]!.id)!
    expect(store.attachmentLocation(stored.attachments[0]!.id)).toMatchObject({
      sourceKind: 'eml',
      sourcePath: join(root, 'nested/a.eml')
    })
    expect(store.sources()).toEqual([
      expect.objectContaining({ kind: 'eml', name: 'eml-folder', messageCount: 1 })
    ])
    expect(store.sourcePathInUse(join(root, 'nested', 'saved.xlsx'))).toBe(true)
    expect(store.sourcePathInUse('C:/archive/elsewhere/saved.xlsx')).toBe(false)
  })

  it('persists body quality and alternate text without indexing the alternate', async () => {
    const store = await fixture()
    addRevision(store, 'body-quality', [
      mail({
        subject: '본문 표현 확인',
        bodyText: '일반 텍스트의 결정 내용입니다.',
        bodyAlternateText: 'HTML-ALTERNATE-ONLY-SENTINEL-39017',
        bodyAlternateKind: 'html',
        bodyQualityFlags: ['alternative_mismatch', 'html_converted']
      })
    ])

    expect(store.get(store.search({ query: '결정 내용', limit: 10 })[0]!.id)).toMatchObject({
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
    const backupPath = 'C:/archive/backup.pst'
    const backupId = archiveSourceId('pst', backupPath)
    const privateMail = mail({
      itemKey: 'item-private',
      messageId: '<private@example.test>',
      subject: '개인 자료원 전용 메일'
    })
    addRevision(store, 'primary', [mail(), privateMail])
    addRevision(store, 'backup', [mail({ sourceId: backupId, itemKey: 'backup-item' })], {
      sourceId: backupId,
      sourcePath: backupPath
    })

    expect(store.sources()).toEqual([
      expect.objectContaining({
        id: sourceId,
        name: 'mail.pst',
        messageCount: 2,
        sharedMessageCount: 1
      }),
      expect.objectContaining({
        id: backupId,
        name: 'backup.pst',
        messageCount: 1,
        sharedMessageCount: 1
      })
    ])
    expect(JSON.stringify(store.sources())).not.toContain('C:/archive')

    expect(store.removeSource(sourceId)).toEqual({
      sourceName: 'mail.pst',
      removedMessages: 1,
      preservedMessages: 1
    })
    expect(store.sources()).toHaveLength(1)
    expect(store.search({ query: '개인 자료원 전용', limit: 10 })).toHaveLength(0)
    const kept = store.search({ query: '서버 이전', limit: 10 })
    expect(kept).toHaveLength(1)
    expect(store.get(kept[0]!.id)).toMatchObject({ sourceName: 'backup.pst' })
    expect(store.removeSource(sourceId)).toBeNull()
  })

  it('resolves reverse-imported Reply/References once relations refresh and leaves same-subject mail separate', async () => {
    const store = await fixture()
    const childPath = 'C:/archive/replies.pst'
    const childId = archiveSourceId('pst', childPath)
    const parentPath = 'C:/archive/parents.pst'
    const parentId = archiveSourceId('pst', parentPath)
    const shared = { subject: '같은 제목', attachments: [] }
    addRevision(
      store,
      'child',
      [
        mail({
          ...shared,
          sourceId: childId,
          itemKey: 'child',
          sentAt: 3,
          messageId: '<child@example.test>',
          inReplyTo: '<parent@example.test>',
          references: '<root@example.test> <parent@example.test>',
          bodyText: 'reply-marker'
        })
      ],
      { sourceId: childId, sourcePath: childPath }
    )
    const child = store.search({ query: 'reply-marker', limit: 10 })[0]!.id
    expect(store.thread({ id: child }).mails.map((entry) => entry.id)).toEqual([child])

    addRevision(
      store,
      'parent',
      [
        mail({
          ...shared,
          sourceId: parentId,
          itemKey: 'root',
          sentAt: 1,
          messageId: '<root@example.test>',
          bodyText: 'root-marker'
        }),
        mail({
          ...shared,
          sourceId: parentId,
          itemKey: 'parent',
          sentAt: 2,
          messageId: '<parent@example.test>',
          inReplyTo: '<root@example.test>',
          bodyText: 'parent-marker'
        }),
        mail({
          ...shared,
          sourceId: parentId,
          itemKey: 'unrelated',
          sentAt: 4,
          messageId: '<unrelated@example.test>',
          bodyText: 'unrelated-marker'
        })
      ],
      { sourceId: parentId, sourcePath: parentPath }
    )
    const unrelated = store.search({ query: 'unrelated-marker', limit: 10 })[0]!.id
    const thread = store.thread({ id: child })
    expect(thread.mails.map((entry) => entry.date)).toEqual([1, 2, 3])
    expect(thread.mails.map((entry) => entry.id)).not.toContain(unrelated)
    expect(store.thread({ id: child, limit: 2 })).toMatchObject({ truncated: true })

    store.removeSource(parentId)
    expect(store.thread({ id: child }).mails.map((entry) => entry.id)).toEqual([child])
  })

  it('discards unverified revisions left by a crash when the store reopens', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-reopen-'))
    roots.push(root)
    const first = createMailArchiveStore(root)
    const started = first.beginRevision({
      sourceId,
      sourceKind: 'pst',
      sourcePath,
      fingerprint: 'crash'
    })
    first.upsertBatch({ sourceId, revision: started.revision, mails: [mail()] })
    first.close()

    const reopened = createMailArchiveStore(root)
    stores.push(reopened)
    expect(reopened.stats().totalMessages).toBe(0)
    expect(addRevision(reopened, 'crash', [mail()])).toEqual({ inserted: 1, skipped: 0 })
  })
})
