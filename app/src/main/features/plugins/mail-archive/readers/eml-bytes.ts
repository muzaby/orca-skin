import { open } from 'node:fs/promises'

const MAX_EML_BYTES = 50 * 1024 * 1024

/** Bound the read itself, including a source that grows after stat. */
export async function readEmlBytes(path: string, signal?: AbortSignal): Promise<Buffer> {
  signal?.throwIfAborted()
  const file = await open(path, 'r')
  try {
    const size = (await file.stat()).size
    if (size > MAX_EML_BYTES) throw new Error('mail_eml_too_large')
    const bytes = Buffer.alloc(size + 1)
    let offset = 0
    while (offset < bytes.length) {
      signal?.throwIfAborted()
      const read = await file.read(bytes, offset, bytes.length - offset, null)
      if (read.bytesRead === 0) break
      offset += read.bytesRead
    }
    if (offset > size) throw new Error('mail_source_changed_during_import')
    return bytes.subarray(0, offset)
  } finally {
    await file.close()
  }
}
