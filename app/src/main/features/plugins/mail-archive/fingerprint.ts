import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'

export async function fingerprint(path: string, signal: AbortSignal): Promise<string> {
  const hash = createHash('sha256')
  const stream = createReadStream(path)
  try {
    for await (const chunk of stream) {
      signal.throwIfAborted()
      hash.update(chunk as Buffer)
    }
    return hash.digest('hex')
  } finally {
    stream.destroy()
  }
}
