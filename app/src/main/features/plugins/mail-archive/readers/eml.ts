import { createHash } from 'node:crypto'
import { readEmlBytes } from './eml-bytes'
import PostalMime from 'postal-mime'
import { normalizeEml } from '../normalize'
import type { NormalizedArchiveMail } from '../types'

export async function readEmlFile(
  path: string,
  sourceId: string,
  sourceFingerprint: string,
  signal?: AbortSignal
): Promise<NormalizedArchiveMail> {
  signal?.throwIfAborted()
  const raw = await readEmlBytes(path, signal)
  if (createHash('sha256').update(raw).digest('hex') !== sourceFingerprint) {
    throw new Error('mail_source_changed_during_import')
  }
  signal?.throwIfAborted()
  // Keep nested message/rfc822 payloads in the attachment manifest. S1 indexes only the
  // selected message body and attachment names; an attached EML must never leak its body into
  // the archive search projection.
  const email = await PostalMime.parse(raw, { forceRfc822Attachments: true })
  signal?.throwIfAborted()
  return normalizeEml(email, {
    sourceId,
    sourcePath: path,
    sourceFingerprint,
    sizeBytes: raw.byteLength
  })
}
