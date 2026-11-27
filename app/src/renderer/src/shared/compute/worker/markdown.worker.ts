import { createCreditWire, WIRE_FRAME_CHARS } from '../creditWire'
import {
  docKey,
  resultSize,
  type WireControl,
  type WireRequest,
  type WireResponse
} from '../protocol'
import { markdownBlock, type MarkdownDocument } from './markdown'

const documents = new Map<string, MarkdownDocument>()
function processMessage(data: WireRequest | WireControl): void {
  if ('type' in data) {
    const key = docKey(data.ref)
    if (data.type === 'doc.open') documents.set(key, { text: data.text })
    else if (data.type === 'doc.extend') {
      const previous = documents.get(docKey(data.from))
      documents.delete(docKey(data.from))
      if (data.ref.id === data.from.id && previous?.text.length === data.offset)
        documents.set(key, { text: previous.text + data.suffix })
    } else documents.delete(key)
    return
  }
  let response: WireResponse
  try {
    if (data.kind !== 'markdown') throw new Error('wrong-lane')
    const text = documents.get(docKey(data.doc))
    if (text === undefined) throw new Error('unknown-doc')
    const result = markdownBlock(text, data)
    response = { id: data.id, ok: true, result, size: resultSize(result) }
  } catch (error) {
    response = {
      id: data.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
  wire.send(response, response.ok === true && response.size > WIRE_FRAME_CHARS)
}

const wire = createCreditWire(
  (frame) => self.postMessage(frame),
  (decoded) => processMessage(decoded as WireRequest | WireControl)
)
self.onmessage = ({ data }: MessageEvent<unknown>) => wire.receive(data)
