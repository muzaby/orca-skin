import type { WorkerLike } from './client'
import { createCreditWire, WIRE_FRAME_CHARS } from './creditWire'
import type { WireRequest, WireControl } from './protocol'

function needsFrames(message: WireRequest | WireControl): boolean {
  if ('type' in message) {
    if (message.type === 'doc.extend') return message.suffix.length > WIRE_FRAME_CHARS
    return message.type === 'doc.open' && message.text.length > WIRE_FRAME_CHARS
  }
  if (message.kind === 'markdown' && message.fence?.parts?.length) return true
  if (message.kind === 'markdown' && message.definitions?.length) return true
  return message.kind === 'markdownLayout' && message.source.length > WIRE_FRAME_CHARS
}

export function creditWorkerPort(worker: WorkerLike): WorkerLike {
  const wire = createCreditWire(
    (frame) => worker.postMessage(frame as WireRequest | WireControl),
    (data) => port.onmessage?.({ data })
  )
  const port: WorkerLike = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage: (message) => wire.send(message, needsFrames(message)),
    terminate() {
      wire.close()
      worker.terminate()
    }
  }
  worker.onerror = (event) => port.onerror?.(event)
  worker.onmessageerror = (event) => port.onmessageerror?.(event)
  worker.onmessage = ({ data }) => {
    try {
      wire.receive(data)
    } catch (error) {
      port.onmessageerror?.(error)
    }
  }
  return port
}
