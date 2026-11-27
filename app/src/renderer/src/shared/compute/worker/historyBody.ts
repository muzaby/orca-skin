import { HISTORY_BODY_BYTES } from '../../../../../shared/history-page'
import type { AppMessagePart } from '../../../../../shared/ipc'
import { workerMarkdownLayout } from './markdownDefinitions'
import type { ComputeResults, HistoryBodyRequest } from '../protocol'

interface BodyStream {
  decoder: TextDecoder
  strings: string[]
  bytes: number
  offset: number
}
const streams = new Map<number, BodyStream>()

export function decodeHistoryBody({
  sequence,
  bytes,
  packet
}: HistoryBodyRequest): ComputeResults['historyBody'] {
  if (!packet) {
    streams.delete(sequence)
    return { parts: [], nextOffset: 0 }
  }
  try {
    let stream = streams.get(sequence)
    if (!stream && packet.offset === 0) {
      stream = { decoder: new TextDecoder('utf-8', { fatal: true }), strings: [], bytes, offset: 0 }
      streams.set(sequence, stream)
    }
    if (
      !stream ||
      stream.bytes !== bytes ||
      packet.offset !== stream.offset ||
      packet.base64.length > 4 * Math.ceil(HISTORY_BODY_BYTES / 3)
    )
      throw Error('Invalid history body range')
    const binary = atob(packet.base64)
    const nextOffset = packet.offset + binary.length
    if (!binary.length || binary.length > HISTORY_BODY_BYTES || nextOffset > bytes)
      throw Error('Invalid history body range')
    const buffer = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    stream.strings.push(stream.decoder.decode(buffer, { stream: nextOffset < bytes }))
    stream.offset = nextOffset
    if (nextOffset < bytes) return { parts: [], nextOffset }

    streams.delete(sequence)
    const parsed: unknown = JSON.parse(stream.strings.join(''))
    if (
      !Array.isArray(parsed) ||
      !parsed.every((p) => p && typeof p.type === 'string' && p.type.length)
    )
      throw Error('Invalid history body')
    const parts: AppMessagePart[] = parsed
    const layouts = parts.flatMap((part, index) =>
      (part.type === 'text' || part.type === 'reasoning') &&
      typeof part.text === 'string' &&
      part.text.length > HISTORY_BODY_BYTES
        ? [{ index, segments: workerMarkdownLayout(part.text) }]
        : []
    )
    return { parts, nextOffset, ...(layouts.length && { layouts }) }
  } catch (error) {
    streams.delete(sequence)
    throw error
  }
}
