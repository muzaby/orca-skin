import {
  docKey,
  type WireControl,
  type WireRequest,
  type WireResponse,
  resultSize
} from '../protocol'
import { tokensRange, type TokenDocument } from './tokens'
import { getHighlighter } from './highlighter'
import { handleMessage } from './handler'

export function createWorkerState(
  now: () => number = () => performance.now()
): (message: WireRequest | WireControl) => Promise<WireResponse | undefined> {
  const documents = new Map<string, TokenDocument>()
  const suspended = new Map<number, { doc: TokenDocument; range: ReturnType<typeof tokensRange> }>()
  return async (message) => {
    if ('type' in message) {
      const key = docKey(message.ref)
      const old = documents.get(key)
      if (old) {
        for (const [id, job] of suspended) {
          if (job.doc === old) suspended.delete(id)
        }
      }
      if (message.type === 'doc.close') documents.delete(key)
      else documents.set(key, { text: message.text, chains: new Map() })
      return
    }
    for (const id of message.discard ?? []) suspended.delete(id)
    if (message.kind !== 'tokens') return handleMessage(message)
    try {
      const doc = documents.get(docKey(message.doc))
      if (!doc) throw Error('unknown-doc')
      const range =
        message.resumeFrom === undefined ? undefined : suspended.get(message.resumeFrom)?.range
      if (message.resumeFrom !== undefined) suspended.delete(message.resumeFrom)
      const cursor = range ?? tokensRange(doc, message, await getHighlighter(), now)
      const step = cursor.next()
      if (!step.done) {
        suspended.set(message.id, { doc, range: cursor })
        return { id: message.id, ok: 'continue' }
      }
      return { id: message.id, ok: true, result: step.value, size: resultSize(step.value) }
    } catch (error) {
      return {
        id: message.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}
