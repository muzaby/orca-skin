// 계산 워커 진입점 (0324) — 배선만 한다. 처리 규칙은 `handler.ts`.

import { createCreditWire } from '../creditWire'
import type { WireControl, WireRequest } from '../protocol'
import { createWorkerState } from './state'

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WireRequest | WireControl>) => void) | null
  postMessage(message: unknown): void
}

const handleMessage = createWorkerState()
const wire = createCreditWire(
  (frame) => scope.postMessage(frame),
  (decoded) => {
    void handleMessage(decoded as WireRequest | WireControl).then((response) => {
      if (response)
        wire.send(
          response,
          response.ok === true &&
            ('segments' in response.result ||
              ('parts' in response.result && response.result.parts.length > 0))
        )
    })
  }
)
scope.onmessage = (event) => wire.receive(event.data)
