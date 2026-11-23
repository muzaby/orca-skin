import {
  docKey,
  resultSize,
  type WireControl,
  type WireRequest,
  type WireResponse
} from '../protocol'
import { parseMarkdown } from './markdown'

const documents = new Map<string, string>()
self.onmessage = ({ data }: MessageEvent<WireRequest | WireControl>) => {
  if ('type' in data) {
    const key = docKey(data.ref)
    if (data.type === 'doc.open') documents.set(key, data.text)
    else documents.delete(key)
    return
  }
  let response: WireResponse
  try {
    if (data.kind !== 'markdown') throw new Error('wrong-lane')
    const text = documents.get(docKey(data.doc))
    if (text === undefined) throw new Error('unknown-doc')
    const result = parseMarkdown(text.slice(data.start, data.end))
    response = { id: data.id, ok: true, result, size: resultSize(result) }
  } catch (error) {
    response = {
      id: data.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
  self.postMessage(response)
}
