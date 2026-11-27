import { afterEach, beforeEach, vi } from 'vitest'
import { createComputeClient, setComputeClient, type WorkerLike } from './client'
import { handleMessage } from './worker/handler'

// Exercise the real request queue and decoding handler where the test runtime has no Web Worker.
export function installHistoryWorker(): void {
  beforeEach(() => {
    setComputeClient(
      createComputeClient({
        createWorker() {
          const port: WorkerLike = {
            onmessage: null,
            onerror: null,
            onmessageerror: null,
            terminate: vi.fn(),
            postMessage(message) {
              if ('id' in message)
                void handleMessage(message).then((data) => port.onmessage?.({ data }))
            }
          }
          return port
        }
      })
    )
  })
  afterEach(() => setComputeClient(null))
}
