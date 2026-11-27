import type { ComputeResults, HistoryBodyRequest } from '../protocol'

export function decodeHistoryBody({
  chunks,
  bytes
}: HistoryBodyRequest): ComputeResults['historyBody'] {
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const strings: string[] = []
  let received = 0
  for (const chunk of chunks) {
    const binary = atob(chunk.base64)
    if (binary.length !== chunk.bytes) throw Error('Invalid history body range')
    const buffer = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i)
    strings.push(decoder.decode(buffer, { stream: true }))
    received += buffer.length
  }
  if (received !== bytes) throw Error('Invalid history body range')
  strings.push(decoder.decode())
  const parts: unknown = JSON.parse(strings.join(''))
  if (
    !Array.isArray(parts) ||
    !parts.every((part) => part && typeof part.type === 'string' && part.type.length)
  )
    throw Error('Invalid history body')
  return { parts }
}
