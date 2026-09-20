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
  const root = await mkdtemp(join(tmpdir(), 'orca-mail-'))
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
  it('persists FTS rows, attachment manifests and opaque attachment ids', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-'))
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
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-'))
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
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-'))
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
