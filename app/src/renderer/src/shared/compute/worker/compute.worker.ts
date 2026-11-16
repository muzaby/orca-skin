// 계산 워커 진입점 (0324) — 배선만 한다. 처리 규칙은 `handler.ts`.

import type { WireRequest } from '../protocol'
import { handleMessage } from './handler'

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WireRequest>) => void) | null
  postMessage(message: unknown): void
}

scope.onmessage = (event) => {
  void handleMessage(event.data).then((response) => scope.postMessage(response))
}
