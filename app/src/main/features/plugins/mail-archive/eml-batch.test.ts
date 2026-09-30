import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { prepareEmlBatch } from './eml-batch'
import { archiveSourceId } from './identity'
import type { MailArchiveEmlBatchItem } from './types'

function item(index = 0): MailArchiveEmlBatchItem {
  return {
    sourcePath: resolve(`mail-${index}.eml`),
    sourceFingerprint: 'a'.repeat(64),
    itemKey: `${index}`,
    folderPath: null,
    sentAt: null,
    from: 'QA <qa@example.test>',
    to: 'team@example.test',
    cc: '',
    subject: '정규화된 메일',
    bodyText: '이미 읽은 본문',
    bodyKind: 'plain',
    bodyAlternateText: null,
    bodyAlternateKind: null,
    bodyAlternateOmitted: false,
    bodyQualityFlags: [],
    bodySelectionReason: 'plain_preferred',
    messageId: `<${index}@example.test>`,
    inReplyTo: null,
    references: null,
    threadKey: `${index}`,
    attachments: [{ name: 'report.txt', mimeType: 'text/plain', sizeBytes: 10 }],
    sizeBytes: 100
  }
}

describe('preprocessed EML batch boundary', () => {
  it('computes archive IDs from provenance and keeps normalized metadata/body untouched', () => {
    const input = item()
    const [mail] = prepareEmlBatch([input])
    expect(mail).toMatchObject({
      ...input,
      sourceKind: 'eml',
      sourceId: archiveSourceId('eml', input.sourcePath)
    })
    expect(mail.identityKey).toMatch(/^[a-f0-9]{64}$/)
    expect(prepareEmlBatch([input])[0].identityKey).toBe(mail.identityKey)
    expect(input).not.toHaveProperty('identityKey')
  })
  it('rejects empty/overfull batches, raw bytes, forged IDs and invalid provenance before writes', () => {
    for (const input of [
      [],
      Array.from({ length: 26 }, (_, n) => item(n)),
      [Buffer.from('raw eml')],
      [{ ...item(), sourceId: 'forged' }],
      [{ ...item(), sourceFingerprint: 'stat-only' }],
      [{ ...item(), sourcePath: 'relative.eml' }],
      [{ ...item(), sourcePath: resolve('file.pst') }],
      [{ ...item(), sentAt: Number.NaN }],
      [{ ...item(), attachments: [{ name: 'a', mimeType: 'x', sizeBytes: -1 }] }]
    ]) {
      expect(() => prepareEmlBatch(input)).toThrow('mail_eml_batch_invalid')
    }
    expect(() => prepareEmlBatch([item(), item()])).toThrow('mail_eml_batch_duplicate_source')
  })
  it('caps UTF-8 body and serialized batch bytes rather than just message count', () => {
    expect(() => prepareEmlBatch([{ ...item(), bodyText: '한'.repeat(700000) }])).toThrow(
      'mail_eml_body_oversized'
    )
    expect(() =>
      prepareEmlBatch([
        {
          ...item(),
          bodyText: 'a'.repeat(1500000),
          bodyAlternateText: 'b'.repeat(700000),
          bodyAlternateKind: 'html'
        }
      ])
    ).toThrow('mail_eml_body_oversized')
    expect(() =>
      prepareEmlBatch(
        Array.from({ length: 3 }, (_, n) => ({
          ...item(n),
          bodyText: 'a'.repeat(1500000)
        }))
      )
    ).toThrow('mail_eml_batch_oversized')
    expect(prepareEmlBatch(Array.from({ length: 25 }, (_, n) => item(n)))).toHaveLength(25)
  })
})
