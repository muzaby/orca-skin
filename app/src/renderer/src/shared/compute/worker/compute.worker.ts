// 계산 워커 진입점 (0324) — 배선만 한다. 처리 규칙은 `handler.ts`.

import type { WireControl, WireRequest } from '../protocol'
import { createWorkerState } from './state'

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WireRequest | WireControl>) => void) | null
  postMessage(message: unknown): void
}

const handleMessage = createWorkerState()
scope.onmessage = (event) => {
  void handleMessage(event.data).then((response) => {
    if (response) scope.postMessage(response)
  })
}
