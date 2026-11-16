// 한 프로세스 안의 피어 포트 쌍 (0324 AR-13). 두 호스트의 조립이 아직 한 프로세스에 있는 동안
// 프로세스 경계와 같은 링크·같은 표를 메모리에서 잇는다 — 셸 서비스의 `connectShellServicesInProcess`
// 와 같은 자리다. 실제 포트와 같게 동작해야 한다:
//
// - 보낸 값은 구조화 복제된다(함수·클래스 인스턴스가 섞이면 보내는 자리에서 던진다).
// - 받는 쪽 리스너는 다음 마이크로태스크에, 보낸 차례대로 불린다.
// - 한쪽을 닫으면 양쪽의 닫힘 리스너가 불리고 이후 전송은 버려진다.

import type { PeerMessage } from '../../../shared/peer-protocol'
import type { PeerPort } from './peer-link'

interface End {
  message: ((data: unknown) => void) | null
  close: (() => void) | null
  started: boolean
  inbox: unknown[]
}

export function createPeerLoopback(): { readonly agent: PeerPort; readonly data: PeerPort } {
  let closed = false
  const ends: [End, End] = [
    { message: null, close: null, started: false, inbox: [] },
    { message: null, close: null, started: false, inbox: [] }
  ]

  const drain = (end: End): void => {
    while (!closed && end.started && end.message && end.inbox.length > 0) {
      end.message(end.inbox.shift())
    }
  }

  const closeBoth = (): void => {
    if (closed) return
    closed = true
    for (const end of ends) {
      end.inbox = []
      end.close?.()
    }
  }

  const port = (self: End, other: End): PeerPort => ({
    post(message: PeerMessage) {
      if (closed) return
      other.inbox.push(structuredClone(message))
      queueMicrotask(() => drain(other))
    },
    onMessage(listener) {
      self.message = listener
    },
    onClose(listener) {
      self.close = listener
    },
    start() {
      self.started = true
      queueMicrotask(() => drain(self))
    },
    close: closeBoth
  })

  return { agent: port(ends[0], ends[1]), data: port(ends[1], ends[0]) }
}
