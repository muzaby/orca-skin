import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readEmlFile } from './eml'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('EML archive reader', () => {
  it('keeps Korean body and reply headers while indexing attachment names only', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-eml-'))
    roots.push(root)
    const path = join(root, 'mail.eml')
    await writeFile(
      path,
      [
        'From: sender@example.test',
        'To: team@example.test',
        'Subject: =?UTF-8?B?7ISc67KEIOydtOyghCDsnbzsoJU=?=',
        'Date: Tue, 01 Jan 2024 10:00:00 +0900',
        'Message-ID: <mail-1@example.test>',
        'In-Reply-To: <mail-0@example.test>',
        'References: <mail-0@example.test>',
        'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="x"',
        '',
        '--x',
        'Content-Type: text/plain; charset=utf-8',
        '',
        '서버 이전 검토를 완료했습니다.',
        '--x',
        'Content-Type: text/plain; name="plan.txt"',
        'Content-Disposition: attachment; filename="plan.txt"',
        '',
        'attachment body is not indexed',
        '--x--',
        ''
      ].join('\r\n'),
      'utf8'
    )
    const message = await readEmlFile(path, 'fingerprint')
    expect(message).toMatchObject({
      sourceKind: 'eml',
      subject: '서버 이전 일정',
      bodyText: '서버 이전 검토를 완료했습니다.',
      messageId: '<mail-1@example.test>',
      inReplyTo: '<mail-0@example.test>',
      references: '<mail-0@example.test>'
    })
    expect(message.attachments.map((attachment) => attachment.name)).toEqual(['plan.txt'])
    expect(message.bodyText).not.toContain('attachment body')
  })
})
