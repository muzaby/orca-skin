import { readFile, stat } from 'node:fs/promises'
import PostalMime from 'postal-mime'
import { normalizeEml } from '../normalize'
import type { NormalizedArchiveMail } from '../types'

/** plan §14 EML 입력 상한. 넘는 파일은 메모리에 올리지 않고 실패 이유로 남긴다. */
export const MAX_EML_BYTES = 50 * 1024 * 1024

export async function readEmlBytes(path: string): Promise<Buffer> {
  if ((await stat(path)).size > MAX_EML_BYTES) throw new Error('mail_eml_too_large')
  return readFile(path)
}

export async function parseEml(
  raw: Uint8Array,
  input: { readonly sourceId: string; readonly itemKey: string }
): Promise<NormalizedArchiveMail> {
  // Keep nested message/rfc822 payloads in the attachment manifest. An attached EML must never
  // leak its body into the archive search projection.
  const email = await PostalMime.parse(raw, { forceRfc822Attachments: true })
  return normalizeEml(email, input)
}

export async function readEmlFile(
  path: string,
  input: { readonly sourceId: string; readonly itemKey: string }
): Promise<NormalizedArchiveMail> {
  return parseEml(await readEmlBytes(path), input)
}
