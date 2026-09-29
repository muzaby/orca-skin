import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'

export function bufferFingerprint(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** 파일 전체 SHA-256. PST처럼 메모리에 올리지 않는 원본에 쓴다. */
export async function fileFingerprint(path: string, signal: AbortSignal): Promise<string> {
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
