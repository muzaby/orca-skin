// 테스트용 창 참조. `close()` 로 닫힘을 일으키고 `sent` 로 받은 통지를 본다.

import { CloseSignal, type ClientRef } from './transport'

export interface FakeClient extends ClientRef {
  readonly sent: Array<{ channel: string; payload: unknown }>
  close(): void
  // 아직 풀리지 않은 닫힘 구독 수.
  watchers(): number
}

export function fakeClient(id = 1): FakeClient {
  const signal = new CloseSignal()
  const sent: FakeClient['sent'] = []
  return {
    id,
    sent,
    send: (channel, payload) => {
      if (!signal.isClosed()) sent.push({ channel, payload })
    },
    isClosed: () => signal.isClosed(),
    onClosed: (listener) => signal.onClosed(listener),
    close: () => signal.close(),
    watchers: () => signal.pending
  }
}
