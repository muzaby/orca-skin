import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createMailStore } from './index'

const opened: { close: () => void }[] = []

afterEach(async () => {
  for (const store of opened.splice(0)) store.close()
})

describe('mail store', () => {
  it('persists FTS rows, attachment manifests and opaque attachment ids', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-'))
    const store = await createMailStore({
      dataDir: root,
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
    const store = await createMailStore({
      dataDir: root,
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
})
