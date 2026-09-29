import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { warmFileSqlite } from '../../../infra/db/warm-file-sqlite'
import { createMailArchiveStore } from './store'
import type { NormalizedArchiveMail } from './types'

const roots: string[] = []
const stores: Array<ReturnType<typeof createMailArchiveStore>> = []

beforeAll(warmFileSqlite)
afterEach(async () => {
  for (const store of stores.splice(0)) store.close()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

function mail(overrides: Partial<NormalizedArchiveMail> = {}): NormalizedArchiveMail {
  return {
    sourceKind: 'eml',
    sourcePath: 'C:/archive/one.eml',
    sourceFingerprint: 'fingerprint-one',
    itemKey: '<one@example.test>',
    folderPath: null,
    sentAt: 1_700_000_000_000,
    from: 'sender@example.test',
    to: 'team@example.test',
    cc: '',
    subject: '서버 이전 일정',
    bodyText: '검토가 끝나면 서버 이전을 진행합니다.',
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
}

async function fixture(): Promise<ReturnType<typeof createMailArchiveStore>> {
  const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-store-'))
  roots.push(root)
  const store = createMailArchiveStore(root)
  stores.push(store)
  return store
}

describe('mail archive store', () => {
  it('deduplicates a source item and searches attachment names', async () => {
    const store = await fixture()
    expect(store.upsert(mail()).inserted).toBe(true)
    expect(store.upsert(mail()).inserted).toBe(false)
    expect(store.stats()).toMatchObject({ totalMessages: 1, emlMessages: 1, pstMessages: 0 })
    expect(store.search({ query: 'migration-plan', limit: 10 })[0]).toMatchObject({
      subject: '서버 이전 일정',
      attachmentNames: ['migration-plan.xlsx']
    })
  })

  it('uses LIKE fallback for short Korean queries and returns the full message', async () => {
    const store = await fixture()
    const inserted = store.upsert(mail())
    expect(store.search({ query: '서버', limit: 10 })).toHaveLength(1)
    const stored = store.get(inserted.id)
    expect(stored).toMatchObject({
      bodyText: '검토가 끝나면 서버 이전을 진행합니다.',
      messageId: '<one@example.test>',
      attachments: [{ name: 'migration-plan.xlsx' }]
    })
    expect(stored).not.toHaveProperty('sourcePath')
    expect(stored).not.toHaveProperty('sourceFingerprint')
  })
})
