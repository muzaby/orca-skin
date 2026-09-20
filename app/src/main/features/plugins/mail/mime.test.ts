import { describe, expect, it } from 'vitest'
import { parseMail } from './mime'

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
