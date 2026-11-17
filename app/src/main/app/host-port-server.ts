// 호스트의 창 전송 — 창마다 받은 포트 (0324 EP-8·EP-9). 데이터 호스트와 에이전트 호스트가 같이 쓴다.
//
// 핸들러 등록(`infra/ipc/handle.ts`)과 통지(`infra/ipc/send.ts`)가 이 전송을 쓴다. 셸이 창의
// 포트를 넘길 때마다 `connect` 로 창 참조를 만들고, 포트가 닫히거나 같은 창이 다시 연결되면
// 그 참조를 닫는다. 이 파일은 Electron 을 모른다 — 포트는 `host-runtime.ts` 가 `HostPort` 로 감싸 준다.
//
// `hold(serving)`: 호스트가 요청을 처리할 수 있게 되기 전(에이전트 호스트는 첫 설정 사본 전)에 온 창
// 메시지는 창마다 도착 순서대로 기다렸다가 처리한다. 열린 뒤에는 기다리지 않고 바로 처리한다.

import { ClientToHostSchema, type HostToClient } from '../../shared/host-protocol'
import {
  CloseSignal,
  type ClientRef,
  type InvokeListener,
  type IpcTransport,
  type RequestEvent,
  type SendListener
} from '../infra/ipc/transport'

// 포트 하나. `host-runtime.ts` 가 `MessagePortMain` 을 이 모양으로 감싼다.
export interface HostPort {
  post(message: HostToClient): void
  onMessage(listener: (data: unknown) => void): void
  onClose(listener: () => void): void
  start(): void
  close(): void
}

export interface ClientConnection {
  // 셸이 정한 창 id.
  readonly clientId: number
  // 셸이 포트를 넘길 때 판정한 값. 요청이 스스로 바꿀 수 없다.
  readonly trusted: boolean
}

export interface PortTransport extends IpcTransport {
  connect(port: HostPort, connection: ClientConnection): ClientRef
  // 이 약속이 끝날 때까지 창 메시지를 처리하지 않는다(실패해도 연다 — 그 뒤 요청은 핸들러가 판정한다).
  hold(serving: Promise<unknown>): void
}

function errorText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

export function createPortTransport(): PortTransport {
  const invokers = new Map<string, InvokeListener>()
  const senders = new Map<string, SendListener[]>()
  // 연결 순서를 지킨다 — 먼저 연결된 창이 `primaryClient` 다.
  const open = new Map<number, { ref: ClientRef; close: () => void }>()
  // 열리기 전에 온 메시지의 처리 — 창마다 도착 순서다.
  let serving = true
  const held: Array<() => void> = []

  const connect: PortTransport['connect'] = (port, connection) => {
    // 같은 창의 새 문서다 — 옛 참조를 먼저 닫는다.
    open.get(connection.clientId)?.close()
    const signal = new CloseSignal()
    const ref: ClientRef = {
      id: connection.clientId,
      send: (channel, payload) => {
        if (!signal.isClosed()) port.post({ kind: 'event', channel, payload })
      },
      isClosed: () => signal.isClosed(),
      onClosed: (listener) => signal.onClosed(listener)
    }
    const close = (): void => {
      if (signal.isClosed()) return
      // 재연결은 새 참조를 넣기 전에 옛 참조를 닫는다 — 이 시점의 항목은 언제나 자신이다.
      open.delete(connection.clientId)
      signal.close()
      port.close()
    }
    const event: RequestEvent = { sender: ref, trusted: connection.trusted }
    const reply = (message: HostToClient): void => {
      if (!signal.isClosed()) port.post(message)
    }
    const dispatch = (data: unknown): void => {
      if (signal.isClosed()) return
      const parsed = ClientToHostSchema.safeParse(data)
      if (!parsed.success) {
        // 요청 번호를 읽을 수 있으면 실패로 답한다 — 답이 없으면 보낸 쪽이 영원히 기다린다.
        const id = (data as { id?: unknown } | null)?.id
        if (typeof id === 'number' && Number.isInteger(id) && id >= 0) {
          reply({ kind: 'result', id, ok: false, error: '형식이 틀린 요청' })
        }
        return
      }
      const message = parsed.data
      if (message.kind === 'send') {
        for (const listener of senders.get(message.channel) ?? []) listener(event, message.payload)
        return
      }
      const listener = invokers.get(message.channel)
      if (!listener) {
        reply({
          kind: 'result',
          id: message.id,
          ok: false,
          error: `No handler registered for '${message.channel}'`
        })
        return
      }
      const { id } = message
      // 동기 throw 와 reject 를 같은 길로 받는다.
      new Promise((resolve) => resolve(listener(event, message.payload))).then(
        (value) => reply({ kind: 'result', id, ok: true, value }),
        (error: unknown) => reply({ kind: 'result', id, ok: false, error: errorText(error) })
      )
    }
    port.onMessage((data) => {
      if (serving) dispatch(data)
      else held.push(() => dispatch(data))
    })
    port.onClose(close)
    open.set(connection.clientId, { ref, close })
    port.start()
    return ref
  }

  return {
    connect,
    hold(until) {
      serving = false
      const release = (): void => {
        serving = true
        // 기다리던 사이 닫힌 창의 메시지는 `dispatch` 가 버린다.
        for (const run of held.splice(0)) run()
      }
      until.then(release, release)
    },
    handle: (channel, listener) => {
      if (invokers.has(channel)) {
        throw new Error(`Attempted to register a second handler for '${channel}'`)
      }
      invokers.set(channel, listener)
    },
    on: (channel, listener) => {
      senders.set(channel, [...(senders.get(channel) ?? []), listener])
    },
    clients: () => [...open.values()].map((entry) => entry.ref),
    primaryClient: () => open.values().next().value?.ref
  }
}
