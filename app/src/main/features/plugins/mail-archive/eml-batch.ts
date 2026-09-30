import { Buffer } from 'node:buffer'
import { extname, isAbsolute } from 'node:path'
import { z } from 'zod'
import { archiveMailIdentityKey, archiveSourceId } from './identity'
import { MAIL_ARCHIVE_BATCH_SIZE } from './batch-buffer'
import type { NormalizedArchiveMail } from './types'

export const MAIL_ARCHIVE_EML_BATCH_BYTES = 4 * 1024 * 1024
export const MAIL_ARCHIVE_EML_BODY_BYTES = 2 * 1024 * 1024
const header = z.string().max(16 * 1024)
const body = z.string().max(MAIL_ARCHIVE_EML_BODY_BYTES)
const itemSchema = z
  .object({
    sourcePath: z
      .string()
      .min(1)
      .max(32 * 1024)
      .refine((path) => isAbsolute(path) && extname(path).toLowerCase() === '.eml'),
    sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    itemKey: header.min(1),
    folderPath: header.nullable(),
    sentAt: z.number().int().min(-8640000000000000).max(8640000000000000).nullable(),
    from: header,
    to: header,
    cc: header,
    subject: header,
    bodyText: body,
    identityBodyText: body.optional(),
    bodyKind: z.enum(['plain', 'html', 'none', 'legacy']),
    bodyAlternateText: body.nullable(),
    bodyAlternateKind: z.enum(['plain', 'html']).nullable(),
    bodyAlternateOmitted: z.boolean(),
    bodyQualityFlags: z
      .array(z.enum(['alternative_mismatch', 'decode_suspect', 'html_converted', 'oversized']))
      .max(4),
    bodySelectionReason: z.enum([
      'plain_preferred',
      'plain_placeholder_fallback',
      'plain_unusable_fallback',
      'html_only',
      'empty',
      'oversized',
      'legacy'
    ]),
    messageId: header.nullable(),
    inReplyTo: header.nullable(),
    references: header.nullable(),
    threadKey: header,
    attachments: z
      .array(
        z
          .object({
            name: z.string().min(1).max(4096),
            mimeType: z.string().min(1).max(1024),
            sizeBytes: z.number().int().nonnegative().safe()
          })
          .strict()
      )
      .max(1000),
    sizeBytes: z.number().int().nonnegative().safe()
  })
  .strict()

/** Validate the entire call before opening an epoch or writing any source revision. */
export function prepareEmlBatch(input: unknown): readonly NormalizedArchiveMail[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAIL_ARCHIVE_BATCH_SIZE) {
    throw new Error('mail_eml_batch_invalid')
  }
  const parsed = z.array(itemSchema).min(1).max(MAIL_ARCHIVE_BATCH_SIZE).safeParse(input)
  if (!parsed.success) throw new Error('mail_eml_batch_invalid')
  let bytes = 2 // JSON array brackets, plus each item's comma below.
  const sourceIds = new Set<string>()
  return parsed.data.map((item, index) => {
    if ((item.bodyAlternateText === null) !== (item.bodyAlternateKind === null)) {
      throw new Error('mail_eml_batch_invalid')
    }
    if (
      Buffer.byteLength(item.bodyText, 'utf8') +
        Buffer.byteLength(item.bodyAlternateText ?? '', 'utf8') >
      MAIL_ARCHIVE_EML_BODY_BYTES
    ) {
      throw new Error('mail_eml_body_oversized')
    }
    bytes += Buffer.byteLength(JSON.stringify(item), 'utf8') + (index > 0 ? 1 : 0)
    if (bytes > MAIL_ARCHIVE_EML_BATCH_BYTES) throw new Error('mail_eml_batch_oversized')
    const sourceId = archiveSourceId('eml', item.sourcePath)
    if (sourceIds.has(sourceId)) throw new Error('mail_eml_batch_duplicate_source')
    sourceIds.add(sourceId)
    const mail = { ...item, sourceKind: 'eml' as const, sourceId }
    return { ...mail, identityKey: archiveMailIdentityKey(mail) }
  })
}
