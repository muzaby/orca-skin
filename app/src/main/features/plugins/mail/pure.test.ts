import { describe, expect, it } from 'vitest'
import { isFresh } from './freshness'
import { buildMailQuery } from './query-builder'
import { reconcileUidls } from './reconcile'
import {
  CONFIRM_OBSERVATIONS,
  PROTECTION_MIN_SAMPLE,
  PROTECTION_RATIO,
  decideProtection
} from './protection'
import { normalizeMail } from './normalize'
import { Pop3Error, publicMailError } from './pop3/errors'

describe('mail pure policy modules', () => {
  it.each([
    'connection_failed',
    'auth_failed',
    'tls_failed',
    'timeout',
    'parse_failed',
    'db_failed'
  ] as const)('%s public errors never expose exception text', (code) => {
    const error = new Pop3Error(code)
    error.message = 'private-password C:/private/mail.db'
    const output = JSON.stringify(publicMailError(error))
    expect(output).not.toContain('private-password')
    expect(output).not.toContain('C:/private')
    expect(publicMailError(error).code).toBe(code)
  })
  it.each([
    [19, 0.49, true],
    [20, 0.49, false],
    [100, 0.5, true],
    [100, 0.49, false]
  ] as const)('protection count %i ratio %f permits ingestion %s', (count, ratio, ingest) => {
    expect(
      decideProtection({
        activeLedgerCount: count,
        retainedRatio: ratio,
        now: 1,
        remoteFingerprint: 'x',
        previous: { kind: 'none' }
      }).ingest
    ).toBe(ingest)
  })
  it('freshness is bounded at five minutes and requires a prior sync', () => {
    expect(isFresh({ now: 1000, lastSyncAt: null })).toBe(false)
    expect(isFresh({ now: 1000 + 5 * 60 * 1000, lastSyncAt: 1000 })).toBe(true)
    expect(isFresh({ now: 1000 + 5 * 60 * 1000 + 1, lastSyncAt: 1000 })).toBe(false)
  })

  it('uses LIKE for short fragments and escaped MATCH tokens for longer text', () => {
    expect(buildMailQuery('일정')).toEqual({
      mode: 'like',
      expression: 'LIKE ?',
      parameter: '%일정%'
    })
    expect(buildMailQuery('a_b')).toMatchObject({ mode: 'match', expression: 'MATCH ?' })
    expect(buildMailQuery('회의 안내').parameter).toBe('"회의" AND "안내"')
  })

  it('reconciles fresh, known and missing UIDLs without deleting mail rows', () => {
    const result = reconcileUidls(
      [
        { uidl: 'old', state: 'active' },
        { uidl: 'gone', state: 'active' },
        { uidl: 'retained-missing', state: 'missing' }
      ],
      ['old', 'new']
    )
    expect(result.fresh).toEqual(['new'])
    expect(result.known).toEqual(['old'])
    expect(result.missing).toEqual(['gone'])
    expect(result.retainedRatio).toBe(0.5)
  })

  it('protects bulk loss below the ratio/sample thresholds and releases on recovery or confirmation', () => {
    const first = decideProtection({
      retainedRatio: PROTECTION_RATIO - 0.01,
      activeLedgerCount: PROTECTION_MIN_SAMPLE,
      now: 1,
      remoteFingerprint: 'a',
      previous: { kind: 'none' }
    })
    expect(first.ingest).toBe(false)
    expect(first.state.observations).toBe(1)
    const second = decideProtection({
      retainedRatio: PROTECTION_RATIO - 0.01,
      activeLedgerCount: PROTECTION_MIN_SAMPLE,
      now: 2,
      remoteFingerprint: 'a',
      previous: first.state
    })
    expect(second.ingest).toBe(true)
    expect(CONFIRM_OBSERVATIONS).toBe(2)
    const reset = decideProtection({
      retainedRatio: PROTECTION_RATIO - 0.01,
      activeLedgerCount: PROTECTION_MIN_SAMPLE,
      now: 2,
      remoteFingerprint: 'b',
      previous: first.state
    })
    expect(reset.ingest).toBe(false)
    expect(reset.state.observations).toBe(1)
    expect(
      decideProtection({
        retainedRatio: PROTECTION_RATIO,
        activeLedgerCount: PROTECTION_MIN_SAMPLE,
        now: 3,
        remoteFingerprint: 'c',
        previous: first.state
      }).ingest
    ).toBe(true)
  })

  it('normalizes sender/recipient, date, body and attachment metadata', () => {
    const document = normalizeMail(
      {
        date: '2026-01-02T03:04:05Z',
        from: { name: 'A', address: 'a@example.com' },
        to: [{ name: 'B', address: 'b@example.com' }],
        cc: [{ address: 'c@example.com' }],
        subject: '제목',
        text: '본문',
        attachments: [
          { filename: '../a.txt', mimeType: 'text/plain', content: new Uint8Array([1, 2]) }
        ]
      } as never,
      { uidl: 'u1', messageNumber: 1, firstSeenAt: 0, sizeBytes: 123 }
    )
    expect(document.fromAddr).toBe('a@example.com')
    expect(document.toAddrs).toBe('b@example.com')
    expect(document.ccAddrs).toBe('c@example.com')
    expect(document.subject).toBe('제목')
    expect(document.bodyText).toBe('본문')
    expect(document.bodySource).toBe('plain')
    expect(document.sizeBytes).toBe(123)
    expect(document.attachments[0]).toMatchObject({ filename: '../a.txt', sizeBytes: 2 })
  })
})

// 0302 EP-01 — 본문 선택 체인 plain → html → 첫 HTML 첨부 → none. 원천마다 표지 단어가 다르다.
const input = { uidl: 'u', messageNumber: 1, firstSeenAt: 0 }
const htmlAttachment = (body: string, mimeType = 'text/html'): Record<string, unknown> => ({
  filename: 'link_1.html',
  mimeType,
  disposition: 'attachment',
  content: new TextEncoder().encode(body)
})
function body(
  email: Record<string, unknown>,
  deps?: Parameters<typeof normalizeMail>[2]
): ReturnType<typeof normalizeMail> {
  return normalizeMail({ subject: '제목', ...email } as never, input, deps)
}

describe('mail body selection chain (0302 D-014)', () => {
  it('(a) AC4 keeps non-blank plain text verbatim even when HTML exists', () => {
    const document = body({ text: '평문A\n', html: '<p>HTMLB</p>' })
    expect(document).toMatchObject({ bodySource: 'plain', bodyText: '평문A\n' })
  })

  it('(b) AC1·AC4 converts HTML when plain text is blank', () => {
    const document = body({ text: '\r\n', html: '<p>결재 <b>요청</b> HTMLB</p>' })
    expect(document.bodySource).toBe('html')
    expect(document.bodyText).toContain('결재')
    expect(document.bodyText).toContain('요청')
    expect(document.bodyText).toContain('HTMLB')
  })

  it('(c) moves on to the HTML attachment when the HTML body converts to nothing', () => {
    const document = body({ html: '<p> </p>', attachments: [htmlAttachment('<p>첨부C</p>')] })
    expect(document).toMatchObject({ bodySource: 'attachment', bodyText: '첨부C' })
  })

  it('(d)(f) uses the first HTML attachment when there is no body part', () => {
    const document = body({ attachments: [htmlAttachment('<p>첨부C</p>')] })
    expect(document).toMatchObject({ bodySource: 'attachment', bodyText: '첨부C' })
    expect(document.attachments).toHaveLength(1)
    expect(document.attachments[0]).toMatchObject({
      filename: 'link_1.html',
      mimeType: 'text/html'
    })
  })

  it('(e) AC6 skips only the step whose conversion throws', () => {
    const document = body(
      { html: '<p>HTMLB</p>', attachments: [htmlAttachment('<p>첨부C</p>')] },
      {
        htmlToText: (html) => {
          if (html.includes('HTMLB')) throw new Error('body conversion failed')
          return html.replace(/<[^>]+>/g, '')
        }
      }
    )
    expect(document).toMatchObject({ bodySource: 'attachment', bodyText: '첨부C' })
  })

  it('treats a whitespace-only conversion result as no text and moves on', () => {
    const document = body(
      { html: '<p>HTMLB</p>', attachments: [htmlAttachment('<p>첨부C</p>')] },
      { htmlToText: (html) => (html.includes('HTMLB') ? ' \r\n ' : '첨부C') }
    )
    expect(document).toMatchObject({ bodySource: 'attachment', bodyText: '첨부C' })
  })

  it('(g) AC16 looks at the first HTML attachment only', () => {
    const document = body({
      attachments: [htmlAttachment('<p> </p>'), htmlAttachment('<p>첨부D</p>')]
    })
    expect(document).toMatchObject({ bodySource: 'none', bodyText: '' })
    expect(document.attachments).toHaveLength(2)
  })

  it('(h) AC6 stores no body when every conversion throws, keeping the rest of the mail', () => {
    const document = body(
      { html: '<p>HTMLB</p>', attachments: [htmlAttachment('<p>첨부C</p>')] },
      {
        htmlToText: () => {
          throw new Error('conversion failed')
        }
      }
    )
    expect(document).toMatchObject({ bodySource: 'none', bodyText: '', subject: '제목' })
    expect(document.attachments).toHaveLength(1)
  })

  it('(i) AC16 ignores non-HTML attachments', () => {
    const document = body({
      attachments: [
        {
          filename: 'n.txt',
          mimeType: 'text/plain',
          content: new TextEncoder().encode('평문첨부E')
        }
      ]
    })
    expect(document).toMatchObject({ bodySource: 'none', bodyText: '' })
  })

  it('(j) AC16 matches the HTML mime type case-insensitively', () => {
    const document = body({ attachments: [htmlAttachment('<p>첨부F</p>', 'Text/HTML')] })
    expect(document).toMatchObject({ bodySource: 'attachment', bodyText: '첨부F' })
  })

  it('AC16 never uses an HTML attachment while the HTML body has text', () => {
    const document = body({ html: '<p>HTMLB</p>', attachments: [htmlAttachment('<p>첨부C</p>')] })
    expect(document.bodySource).toBe('html')
    expect(document.bodyText).toContain('HTMLB')
    expect(document.bodyText).not.toContain('첨부C')
  })

  it('stores no body for a mail without any text part', () => {
    expect(body({})).toMatchObject({ bodySource: 'none', bodyText: '' })
  })
})
