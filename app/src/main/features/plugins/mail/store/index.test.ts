import Database from 'better-sqlite3'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createMailStore } from './index'
import { warmFileSqlite } from '../../../../infra/db/warm-file-sqlite'
import type { MailDocument } from '../types'

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, writeFile: vi.fn(actual.writeFile) }
})

const opened: { close: () => void }[] = []
const roots: string[] = []
beforeAll(warmFileSqlite)

afterEach(async () => {
  vi.restoreAllMocks()
  for (const store of opened.splice(0)) store.close()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

async function fixture(
  accountId = 'account'
): Promise<Awaited<ReturnType<typeof createMailStore>>> {
  const root = await mkdtemp(join(tmpdir(), 'orcinus-orca-mail-'))
  roots.push(root)
  const store = await createMailStore({
    root,
    accountId,
    authId: 'mail',
    host: 'pop.example.test',
    port: 995,
    tls: true
  })
  opened.push(store)
  return store
}

function document(uidl: string, date = 1000): MailDocument {
  return {
    uidl,
    messageNumber: 1,
    headerDate: date,
    firstSeenAt: date,
    effectiveDate: date,
    fromAddr: 'sender@example.test',
    toAddrs: 'receiver@example.test',
    ccAddrs: '',
    subject: '회의일정 안내',
    bodyText: '저장소 검색 본문',
    bodySource: 'plain',
    attachments: [
      {
        filename: 'notes.txt',
        mimeType: 'text/plain',
        sizeBytes: 5,
        bytes: new TextEncoder().encode('hello')
      }
    ]
  }
}

describe('mail store', () => {
  it.each(['match', 'like', 'empty'] as const)(
    'keeps sender and recipients distinct in %s results',
    async (mode) => {
      const store = await fixture()
      await store.saveMessage({
        ...document('projection'),
        fromAddr: 'sender@example.test',
        toAddrs: 'recipient@example.test',
        subject: 'distinctsubject'
      })
      const query =
        mode === 'empty' ? '' : mode === 'like' ? '%distinctsubject%' : 'distinctsubject'
      expect(store.search(query, 10, mode === 'empty' ? 'match' : mode)[0]).toMatchObject({
        from: 'sender@example.test',
        to: 'recipient@example.test',
        subject: 'distinctsubject'
      })
    }
  )

  // 0302 AC7 — 네 출처가 서로 다른 값이라 분기별 SELECT·매핑의 누락·맞바꿈이 보인다.
  it.each(['match', 'like', 'empty'] as const)(
    'returns each stored bodySource in %s results and updates it on re-save',
    async (mode) => {
      const store = await fixture()
      const sources = ['plain', 'html', 'attachment', 'none'] as const
      for (const source of sources)
        await store.saveMessage({
          ...document(`source-${source}`),
          subject: `sourcecheck ${source}`,
          bodyText: source === 'none' ? '' : `${source} body`,
          bodySource: source,
          attachments: []
        })
      const query = mode === 'empty' ? '' : mode === 'like' ? '%sourcecheck%' : 'sourcecheck'
      const read = (): Record<string, string> =>
        Object.fromEntries(
          store
            .search(query, 10, mode === 'empty' ? 'match' : mode)
            .map((hit) => [hit.subject, hit.bodySource])
        )
      expect(read()).toEqual({
        'sourcecheck plain': 'plain',
        'sourcecheck html': 'html',
        'sourcecheck attachment': 'attachment',
        'sourcecheck none': 'none'
      })
      await store.saveMessage({
        ...document('source-none'),
        subject: 'sourcecheck none',
        bodyText: 'html body',
        bodySource: 'html',
        attachments: []
      })
      expect(read()['sourcecheck none']).toBe('html')
    }
  )

  it('uses headerDate before firstSeenAt, falls back only for null, and keeps the exact cutoff', async () => {
    const store = await fixture()
    const now = 20 * 86_400_000
    const cutoff = now - 14 * 86_400_000
    for (const [uidl, headerDate, firstSeenAt] of [
      ['old-header', cutoff - 1000, now],
      ['new-header', now, cutoff - 1000],
      ['boundary', cutoff, now],
      ['inside', cutoff + 1000, now],
      ['old-fallback', null, cutoff - 1000],
      ['new-fallback', null, now]
    ] as const)
      await store.saveMessage({ ...document(uidl), headerDate, firstSeenAt })
    expect(await store.cleanupExpired(now)).toBe(2)
    expect(store.ledger()).toHaveLength(6)
    const remaining = store.search('', 10).map((hit) => hit.mailId)
    expect(remaining).toHaveLength(4)
    expect(store.countMail()).toBe(4)
    const db = new Database(store.dbPath)
    try {
      expect(db.prepare('SELECT uidl FROM mail ORDER BY uidl').all()).toEqual([
        { uidl: 'boundary' },
        { uidl: 'inside' },
        { uidl: 'new-fallback' },
        { uidl: 'new-header' }
      ])
    } finally {
      db.close()
    }
  })

  it('moves the cleanup cutoff with an explicit retentionDays', async () => {
    const store = await fixture()
    const day = 86_400_000
    const now = 40 * day
    // 20일 된 메일은 30일 창 안이고 14일 창 밖이다 — 인자를 버리면 어느 한쪽이 갈린다.
    await store.saveMessage(document('twenty-days', now - 20 * day))
    expect(await store.cleanupExpired(now, 30)).toBe(0)
    expect(store.countMail()).toBe(1)
    expect(await store.cleanupExpired(now, 14)).toBe(1)
    expect(store.countMail()).toBe(0)
  })

  it('caps the whole response manifest at 50 while preserving counts and truncation flags', async () => {
    const store = await fixture()
    for (let i = 0; i < 7; i++)
      await store.saveMessage({
        ...document(`many-${i}`, 1000 + i),
        attachments: Array.from({ length: 12 }, (_, n) => ({
          filename: `${n}.txt`,
          mimeType: 'text/plain',
          sizeBytes: 1,
          bytes: new Uint8Array([n])
        }))
      })
    const hits = store.search('', 50)
    expect(hits).toHaveLength(7)
    expect(hits.map((hit) => hit.attachments.length)).toEqual([10, 10, 10, 10, 10, 0, 0])
    expect(
      hits.every((hit) => hit.attachmentCount === 12 && hit.attachmentsTruncated === true)
    ).toBe(true)
    const first = hits[0]
    expect(
      await store.findAttachment(first.mailId, first.attachments[0].attachmentId)
    ).not.toBeNull()
  })
  it('persists FTS rows, attachment manifests and opaque attachment ids', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orcinus-orca-mail-'))
    roots.push(root)
    const store = await createMailStore({
      root,
      accountId: 'account',
      authId: 'mail',
      host: 'pop.example.test',
      port: 995,
      tls: true,
      now: () => 1000
    })
    opened.push(store)
    await store.saveMessage({
      uidl: 'u1',
      messageNumber: 1,
      headerDate: 1000,
      firstSeenAt: 1000,
      effectiveDate: 1000,
      fromAddr: 'a@example.com',
      toAddrs: 'b@example.com',
      ccAddrs: '',
      subject: '회의일정 안내',
      bodyText: '회의실 일정 공유',
      bodySource: 'plain',
      sizeBytes: 5,
      attachments: [
        {
          filename: '../report.txt',
          mimeType: 'text/plain',
          sizeBytes: 5,
          bytes: new TextEncoder().encode('hello')
        }
      ]
    })
    const [hit] = store.search('%일정%', 10, 'like')
    expect(hit).toMatchObject({ attachmentCount: 1, attachments: [{ filename: '../report.txt' }] })
    expect(JSON.stringify(hit)).not.toContain('stored_name')
    const attachmentId = hit.attachments[0].attachmentId
    const found = await store.findAttachment(hit.mailId, attachmentId)
    expect(found?.path).toContain('attachments')
    expect(await readFile(found!.path)).toEqual(Buffer.from('hello'))
    store.close()
    opened.splice(opened.indexOf(store), 1)
    await rm(root, { recursive: true, force: true })
  })

  it('marks missing UIDLs without removing cached mail until retention cleanup', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orcinus-orca-mail-'))
    roots.push(root)
    const store = await createMailStore({
      root,
      accountId: 'account',
      authId: 'mail',
      host: 'pop.example.test',
      port: 995,
      tls: true,
      now: () => 1000
    })
    opened.push(store)
    await store.saveMessage({
      uidl: 'gone',
      messageNumber: 1,
      headerDate: 1000,
      firstSeenAt: 1000,
      effectiveDate: 1000,
      fromAddr: 'a',
      toAddrs: 'b',
      ccAddrs: '',
      subject: 'keep',
      bodyText: 'cached',
      bodySource: 'plain',
      attachments: []
    })
    store.markMissing(['gone'])
    expect(store.countMail()).toBe(1)
    expect(store.search('%keep%', 10, 'like')).toHaveLength(1)
  })

  it.each(['..', '.', 'a/b', 'a\\b', 'a:b', '', 'account ', 'CON', 'NUL.txt', 'trailing.'])(
    'rejects unsafe account path %j instead of mapping it to another account',
    async (accountId) => {
      await expect(fixture(accountId)).rejects.toThrow('invalid_account_id')
      expect(await readdir(roots[0])).toEqual([])
    }
  )

  it('removes expired rows, FTS terms and files while preserving the retention boundary', async () => {
    const store = await fixture()
    const day = 86_400_000
    await store.saveMessage({ ...document('expired', day), subject: 'expiredtoken' })
    await store.saveMessage({ ...document('boundary', day * 2), subject: 'boundarytoken' })
    expect(store.search('expiredtoken', 10)).toHaveLength(1)
    expect(await store.cleanupExpired(day * 16)).toBe(1)
    expect(store.countMail()).toBe(1)
    expect(store.search('expiredtoken', 10)).toEqual([])
    expect(store.search('boundarytoken', 10)).toHaveLength(1)
    expect(await readdir(store.attachmentRoot)).toHaveLength(1)
    const raw = new Database(store.dbPath)
    try {
      expect(
        raw.prepare("SELECT rowid FROM mail_fts WHERE mail_fts MATCH 'expiredtoken'").all()
      ).toEqual([])
      expect(raw.prepare('SELECT id FROM attachment').all()).toHaveLength(1)
    } finally {
      raw.close()
    }
  })

  it('sweeps orphan attachments when no mail has expired', async () => {
    const store = await fixture()
    await store.saveMessage(document('retained'))
    await writeFile(join(store.attachmentRoot, 'interrupted-save'), 'partial')
    expect(await store.cleanupExpired(1000)).toBe(0)
    const files = await readdir(store.attachmentRoot)
    expect(files).toHaveLength(1)
    expect(files).not.toContain('interrupted-save')
    expect(store.search('회의일', 10)).toHaveLength(1)
  })

  it('preserves completed mail when a later save is already cancelled', async () => {
    const store = await fixture()
    await store.saveMessage(document('completed'))
    const before = await readdir(store.attachmentRoot)
    await expect(store.saveMessage(document('cancelled'), AbortSignal.abort())).rejects.toThrow()
    expect(store.ledger().map((row) => row.uidl)).toEqual(['completed'])
    expect(await readdir(store.attachmentRoot)).toEqual(before)
  })

  it('removes staged bytes on cancellation during write and preserves an existing version', async () => {
    const store = await fixture()
    await store.saveMessage(document('completed'))
    const before = await readdir(store.attachmentRoot)
    const controller = new AbortController()
    const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
    vi.mocked(writeFile).mockImplementationOnce(async (...args) => {
      await actual.writeFile(...args)
      controller.abort()
    })
    await expect(
      store.saveMessage({ ...document('completed'), subject: 'replacement' }, controller.signal)
    ).rejects.toThrow()
    expect(store.search('회의일', 10)).toHaveLength(1)
    expect(store.search('replacement', 10)).toHaveLength(0)
    expect(await readdir(store.attachmentRoot)).toEqual(before)
  })

  it('removes partially written files if a filesystem write fails', async () => {
    const store = await fixture()
    const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
    vi.mocked(writeFile).mockImplementationOnce(async (path) => {
      await actual.writeFile(path, 'partial')
      throw new Error('disk failure')
    })
    await expect(store.saveMessage(document('failed'))).rejects.toThrow('disk failure')
    expect(store.countMail()).toBe(0)
    expect(store.ledger()).toEqual([])
    expect(await readdir(store.attachmentRoot)).toEqual([])
  })

  it('rolls back the current message and staged files after a database write failure', async () => {
    const store = await fixture()
    await store.saveMessage(document('completed'))
    const before = await readdir(store.attachmentRoot)
    const raw = new Database(store.dbPath)
    raw.exec(
      "CREATE TRIGGER reject_attachment BEFORE INSERT ON attachment BEGIN SELECT RAISE(ABORT, 'injected database failure'); END"
    )
    raw.close()
    await expect(store.saveMessage(document('failed'))).rejects.toThrow('injected database failure')
    expect(store.ledger().map((row) => row.uidl)).toEqual(['completed'])
    expect(store.countMail()).toBe(1)
    expect(await readdir(store.attachmentRoot)).toEqual(before)
  })

  it('closes the real mail connection if account initialization fails and retries cleanly', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orcinus-orca-mail-'))
    roots.push(root)
    const options = {
      root,
      accountId: 'account',
      authId: 'mail',
      host: 'pop.example.test',
      port: 995,
      tls: true
    }
    const close = vi.spyOn(Database.prototype, 'close')
    await expect(
      createMailStore({
        ...options,
        now: () => {
          throw new Error('initializer failure')
        }
      })
    ).rejects.toThrow('initializer failure')
    expect(close.mock.contexts).toHaveLength(1)
    expect((close.mock.contexts[0] as Database.Database).open).toBe(false)
    const store = await createMailStore(options)
    opened.push(store)
    await store.saveMessage(document('retry'))
    expect(store.countMail()).toBe(1)
  })

  it('rejects an existing database owned by another account instead of sharing its attachments', async () => {
    const store = await fixture()
    const raw = new Database(store.dbPath)
    raw.exec(
      "INSERT INTO account SELECT 'other-account', auth_id, host, port, tls, created_at FROM account"
    )
    raw.close()
    await expect(
      createMailStore({
        root: roots[0],
        accountId: 'account',
        authId: 'mail',
        host: 'pop.example.test',
        port: 995,
        tls: true
      })
    ).rejects.toThrow('account_id_conflict')
  })
})

describe('0303 cached mail projection', () => {
  it.each([12, 3, 0])('bounds a %i attachment manifest and maps distinct fields', async (count) => {
    const store = await fixture()
    const source = document('manifest', 12345)
    await store.saveMessage({
      ...source,
      ccAddrs: 'cc@example.test',
      attachments: Array.from({ length: count }, (_, i) => ({
        filename: `file-${i}.txt`,
        mimeType: 'text/plain',
        sizeBytes: i + 1,
        bytes: new Uint8Array(i + 1)
      }))
    })
    const id = store.search('', 1)[0].mailId
    const mail = store.getMail(id)!
    expect(mail).toMatchObject({
      mailId: id,
      date: 12345,
      from: source.fromAddr,
      to: source.toAddrs,
      cc: 'cc@example.test',
      subject: source.subject,
      bodyText: source.bodyText,
      bodySource: 'plain',
      attachmentCount: count
    })
    expect(mail.attachments).toHaveLength(Math.min(count, 10))
    for (const [i, attachment] of mail.attachments.entries())
      expect(attachment).toEqual({
        attachmentId: expect.any(String),
        filename: `file-${i}.txt`,
        mimeType: 'text/plain',
        sizeBytes: i + 1
      })
    if (count > 10) expect(mail.attachmentsTruncated).toBe(true)
    else expect(mail).not.toHaveProperty('attachmentsTruncated')
  })

  it('rejects loose identifiers even when id 100 exists and scopes the account', async () => {
    const store = await fixture()
    await store.saveMessage({ ...document('valid'), attachments: [] })
    const db = new Database(store.dbPath)
    try {
      db.prepare('UPDATE mail SET id=100').run()
      expect(store.getMail('100')).not.toBeNull()
      for (const id of ['abc', '1e2', '0', '-1', '1.5', ' 100', '99999'])
        expect(store.getMail(id)).toBeNull()
      db.exec(
        "INSERT INTO account(id, auth_id, host, port, tls, created_at) SELECT 'other', auth_id, host, port, tls, created_at FROM account LIMIT 1"
      )
      db.prepare("UPDATE mail SET account_id='other'").run()
      expect(store.getMail('100')).toBeNull()
    } finally {
      db.close()
    }
  })

  it.each(['match', 'like', 'empty'] as const)(
    'shares search and get projections in %s mode',
    async (mode) => {
      const store = await fixture()
      const bodies = ['x'.repeat(20000), '가'.repeat(299) + '😀끝', '짧은 본문', '']
      for (const [i, bodyText] of bodies.entries())
        await store.saveMessage({
          ...document(`shared-${i}`, 12300 + i),
          fromAddr: `from-${i}`,
          toAddrs: `to-${i}`,
          subject: `sharedprojection ${i}`,
          bodyText,
          bodySource: bodyText ? 'html' : 'none'
        })
      const query =
        mode === 'empty' ? '' : mode === 'like' ? '%sharedprojection%' : 'sharedprojection'
      for (const hit of store.search(query, 10, mode === 'empty' ? 'match' : mode)) {
        const stored = store.getMail(hit.mailId)!
        const { rank, snippet, ...meta } = hit
        const { bodyText, cc, ...getMeta } = stored
        expect({ ...meta, rank, cc }).toEqual({ ...getMeta, rank: expect.any(Number), cc: '' })
        expect(snippet).toBe(bodyText.slice(0, bodyText.startsWith('가') ? 299 : 300))
      }
    }
  )
})
