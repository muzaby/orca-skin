import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseMail } from './mime'
import { createMailStore } from './store'
import { warmFileSqlite } from '../../../infra/db/warm-file-sqlite'

describe('mail MIME bytes', () => {
  it('decodes raw EUC-KR body without first passing through UTF-8', async () => {
    const raw = Buffer.concat([
      Buffer.from(
        'From: alice@example.test\r\nTo: bob@example.test\r\nContent-Type: text/plain; charset=euc-kr\r\nContent-Transfer-Encoding: 8bit\r\n\r\n'
      ),
      Buffer.from([0xc8, 0xb8, 0xc0, 0xc7, 13, 10])
    ])
    const document = await parseMail(raw, { uidl: 'euc', messageNumber: 1, firstSeenAt: 1000 })
    expect(document.bodyText).toContain('회의')
    expect(document.effectiveDate).toBe(1000)
    expect(document.sizeBytes).toBe(raw.length)
  })
})

const input = { uidl: 'mime-mail', messageNumber: 1, firstSeenAt: 1000 }
function rawMail(headers: string[], related = false): string {
  return [
    'MIME-Version: 1.0',
    'Subject: cached body',
    `Content-Type: multipart/${related ? 'related' : 'mixed'}; boundary="parts"`,
    '',
    '--parts',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'cached body',
    '--parts',
    'Content-Type: text/html; charset=utf-8',
    '',
    '<p>cached body</p><img src="cid:signature"><img src="CID:encoded%40example"><img src="cid:prefix-long"><img src="cid:bad%ZZ">',
    ...headers.flatMap((header) => [
      '--parts',
      header,
      'Content-Transfer-Encoding: base64',
      '',
      'AQID'
    ]),
    '--parts--',
    ''
  ].join('\r\n')
}

describe('mail MIME attachment classification', () => {
  it.each([
    [
      'related without filename',
      'Content-Type: image/png\r\nContent-ID: <related-only>',
      true,
      false
    ],
    [
      'related with attachment disposition',
      'Content-Type: image/png\r\nContent-ID: <related-only>\r\nContent-Disposition: attachment; filename="banner.png"',
      true,
      false
    ],
    [
      'inline without CID',
      'Content-Type: image/png\r\nContent-Disposition: inline; filename="card.png"',
      false,
      false
    ],
    [
      'CID reference without disposition',
      'Content-Type: image/png\r\nContent-ID: <signature>',
      false,
      false
    ],
    [
      'encoded CID reference',
      'Content-Type: image/png\r\nContent-ID: <encoded@example>',
      false,
      false
    ],
    ['malformed percent CID', 'Content-Type: image/png\r\nContent-ID: <bad%ZZ>', false, false],
    [
      'ordinary attached image',
      'Content-Type: image/png\r\nContent-Disposition: attachment; filename="photo.png"',
      false,
      true
    ],
    ['unreferenced CID', 'Content-Type: image/png\r\nContent-ID: <unused>', false, true],
    ['CID prefix is not a match', 'Content-Type: image/png\r\nContent-ID: <prefix>', false, true],
    ['unnamed ordinary image', 'Content-Type: image/png', false, true],
    [
      'unnamed ordinary PDF',
      'Content-Type: application/pdf\r\nContent-Disposition: attachment',
      false,
      true
    ],
    [
      'inline non-image',
      'Content-Type: application/pdf\r\nContent-Disposition: inline',
      false,
      true
    ]
  ] as const)('%s', async (_name, header, related, retained) => {
    const raw = rawMail([header], related)
    const mail = await parseMail(raw, input)
    expect(mail.bodyText).toContain('cached body')
    expect(mail.sizeBytes).toBe(Buffer.byteLength(raw))
    expect(mail.attachments).toHaveLength(retained ? 1 : 0)
    if (retained) expect(mail.attachments[0].bytes).toEqual(new Uint8Array([1, 2, 3]))
  })
})

const roots: string[] = []
const stores: { close(): void }[] = []
beforeAll(warmFileSqlite)
afterEach(async () => {
  for (const store of stores.splice(0)) store.close()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

it.each([false, true])(
  'persists only file attachments (embedded-only: %s)',
  async (embeddedOnly) => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mime-'))
    roots.push(root)
    const store = await createMailStore({
      root,
      accountId: 'mail',
      authId: 'mail',
      host: 'pop.test',
      port: 995,
      tls: true
    })
    stores.push(store)
    const parts = ['Content-Type: image/png\r\nContent-ID: <signature>']
    if (!embeddedOnly)
      parts.push(
        'Content-Type: image/png\r\nContent-Disposition: attachment; filename="photo.png"',
        'Content-Type: application/pdf\r\nContent-Disposition: attachment'
      )
    await store.saveMessage(await parseMail(rawMail(parts), input))
    const [hit] = store.search('cached', 10)
    const expected = embeddedOnly ? [] : ['photo.png', 'attachment']
    expect(hit.attachmentCount).toBe(expected.length)
    expect(hit.attachments.map((a) => a.filename)).toEqual(expected)
    expect(await readdir(store.attachmentRoot)).toHaveLength(expected.length)
    for (const attachment of hit.attachments) {
      const file = await store.findAttachment(hit.mailId, attachment.attachmentId)
      expect(file).not.toBeNull()
      expect(await store.readAttachment(file!)).toEqual(Buffer.from([1, 2, 3]))
    }
  }
)

// 0302 AC2·AC17 — postal-mime 3.0.0 실측 매트릭스. 형상마다 본문·첨부 표지 단어가 다르다.
const head = 'From: a@example.test\r\nSubject: matrix\r\nMIME-Version: 1.0\r\n'
const part = (contentType: string, body: string, extra = ''): string =>
  `Content-Type: ${contentType}\r\n${extra}\r\n${body}\r\n`
const multipart = (type: string, boundary: string, parts: string[]): string =>
  `Content-Type: multipart/${type}; boundary="${boundary}"\r\n\r\n` +
  parts.map((item) => `--${boundary}\r\n${item}`).join('') +
  `--${boundary}--\r\n`
const plainPart = (word: string): string => part('text/plain; charset=utf-8', word)
const htmlPart = (word: string): string =>
  part(
    'text/html; charset=utf-8',
    `<html><head><style>.c{}</style></head><body><p>${word}</p></body></html>`
  )
const pdfPart = part(
  'application/pdf; name="a.pdf"',
  'JVBERi0=',
  'Content-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="a.pdf"\r\n'
)
const icsPart = part('text/calendar; method=REQUEST', 'BEGIN:VCALENDAR\r\nEND:VCALENDAR')
const htmlAttachmentPart = (word: string, name = 'link_1.html'): string =>
  part(
    `text/html; charset=utf-8; name="${name}"`,
    `<p>${word}</p>`,
    `Content-Disposition: attachment; filename="${name}"\r\n`
  )

describe('mail body source matrix (0302 AC2)', () => {
  it.each([
    ['text/html only', head + htmlPart('HTMLONLY'), 'html', 'HTMLONLY', []],
    [
      'alternative{html}',
      head + multipart('alternative', 'B1', [htmlPart('ALTHTML')]),
      'html',
      'ALTHTML',
      []
    ],
    [
      'mixed{html,pdf}',
      head + multipart('mixed', 'B1', [htmlPart('MIXHTML'), pdfPart]),
      'html',
      'MIXHTML',
      ['application/pdf']
    ],
    [
      'mixed{ics,html,pdf}',
      head + multipart('mixed', 'B1', [icsPart, htmlPart('ICSHTML'), pdfPart]),
      'html',
      'ICSHTML',
      ['text/calendar', 'application/pdf']
    ],
    [
      'related{html,img}',
      head +
        multipart('related', 'B1', [
          htmlPart('RELHTML'),
          part('image/png', 'iVBORw0K', 'Content-Transfer-Encoding: base64\r\nContent-ID: <i1>\r\n')
        ]),
      'html',
      'RELHTML',
      []
    ],
    ['plain only', head + plainPart('PLAINONLY'), 'plain', 'PLAINONLY', []],
    [
      'alternative{plain,html}',
      head + multipart('alternative', 'B1', [plainPart('ALTPLAIN'), htmlPart('ALTPAIRHTML')]),
      'plain',
      'ALTPLAIN',
      []
    ],
    [
      'mixed{alternative{plain,html},pdf}',
      head +
        multipart('mixed', 'B1', [
          multipart('alternative', 'B2', [plainPart('NESTPLAIN'), htmlPart('NESTHTML')]),
          pdfPart
        ]),
      'plain',
      'NESTPLAIN',
      ['application/pdf']
    ],
    [
      'case 8 html attachment only',
      head + multipart('mixed', 'B1', [htmlAttachmentPart('CASE8BODY')]),
      'attachment',
      'CASE8BODY',
      ['text/html']
    ],
    [
      'case 9 plain + html attachment',
      head + multipart('mixed', 'B1', [plainPart('CASE9PLAIN'), htmlAttachmentPart('CASE9ATTACH')]),
      'plain',
      'CASE9PLAIN',
      ['text/html']
    ],
    [
      'case 10 html + txt attachment',
      head +
        multipart('mixed', 'B1', [
          htmlPart('CASE10HTML'),
          part(
            'text/plain; name="n.txt"',
            'CASE10TXT',
            'Content-Disposition: attachment; filename="n.txt"\r\n'
          )
        ]),
      'html',
      'CASE10HTML',
      ['text/plain']
    ],
    [
      'pdf attachment only',
      head + multipart('mixed', 'B1', [pdfPart]),
      'none',
      '',
      ['application/pdf']
    ],
    ['empty body', head + 'Content-Type: text/plain\r\n\r\n', 'none', '', []]
  ] as const)('%s', async (_name, raw, source, word, attachmentTypes) => {
    const document = await parseMail(raw, input)
    expect(document.bodySource).toBe(source)
    if (word) expect(document.bodyText).toContain(word)
    else expect(document.bodyText).toBe('')
    expect(document.bodyText).not.toContain('.c{}')
    expect(document.attachments.map((item) => item.mimeType)).toEqual(attachmentTypes)
    for (const absent of ['ALTPAIRHTML', 'NESTHTML', 'CASE9ATTACH', 'CASE10TXT'])
      expect(document.bodyText).not.toContain(absent)
  })

  it('AC17 decodes an EUC-KR HTML attachment whose charset postal-mime drops', async () => {
    const bytes = Buffer.concat([
      Buffer.from('<html><body><p>'),
      Buffer.from([0xc8, 0xb8, 0xc0, 0xc7]),
      Buffer.from('</p></body></html>')
    ])
    const raw =
      head +
      multipart('mixed', 'B1', [
        part(
          'text/html; charset=euc-kr; name="link_1.html"',
          bytes.toString('base64'),
          'Content-Disposition: attachment; filename="link_1.html"\r\nContent-Transfer-Encoding: base64\r\n'
        )
      ])
    const document = await parseMail(raw, input)
    expect(document).toMatchObject({ bodySource: 'attachment', bodyText: '회의' })
  })
})
