import PostalMime from 'postal-mime'
import type { MailDocument } from './types'
import { normalizeMail } from './normalize'

export async function parseMail(
  raw: string | Uint8Array,
  input: { uidl: string; messageNumber: number; firstSeenAt: number }
): Promise<MailDocument> {
  const email = await PostalMime.parse(raw)
  return normalizeMail(email, {
    ...input,
    sizeBytes: typeof raw === 'string' ? Buffer.byteLength(raw, 'utf8') : raw.byteLength
  })
}
