import { vi } from 'vitest'
import { createComputeClient, type ComputeClient, type WorkerLike } from './client'
import type { Lane, WireControl, WireRequest } from './protocol'

class Port implements WorkerLike {
  messages: (WireControl | WireRequest)[] = []
  onmessage: WorkerLike['onmessage'] = null
  onerror: WorkerLike['onerror'] = null
  onmessageerror: WorkerLike['onmessageerror'] = null
  terminate = vi.fn()
  postMessage(message: WireControl | WireRequest): void {
    this.messages.push(message)
  }
  reply(error?: string): void {
    const work = this.messages
      .slice()
      .reverse()
      .find((m) => 'id' in m)
    if (!work || !('id' in work)) throw Error('no active request')
    this.onmessage?.({
      data: error
        ? { id: work.id, ok: false, error }
        : { id: work.id, ok: true, result: { hast: { type: 'root', children: [] } }, size: 1 }
    })
  }
}
export function portHarness(capacity = 10): { client: ComputeClient; ports: Map<Lane, Port> } {
  const ports = new Map<Lane, Port>()
  const client = createComputeClient({
    docMaxChars: capacity,
    onError: vi.fn(),
    createWorker(lane) {
      const port = new Port()
      ports.set(lane, port)
      return port
    }
  })
  return { client, ports }
}
