// 테스트용 요청 전송 (0324 EP-8′·EP-9) — 핸들러를 전송 계약(`IpcTransport`·`ClientRef`) 위에서 부른다.
//
// 호스트가 소유한 채널의 핸들러는 production 에서 창 포트(`app/host-port-server.ts`)로 요청을 받고, 보낸 창은
// `ClientRef` 다. 셸 전송(`ipcMain`·`WebContents`)을 흉내 내 부르면 production 에 없는 경로를 탄다. 이 전송은
// 등록만 받아 두고, 테스트가 고른 창 참조(`fakeClient`)로 요청을 보낸다.

import {
  ipcTransport,
  setIpcTransport,
  type ClientRef,
  type InvokeListener,
  type IpcTransport,
  type SendListener
} from './transport'
import { fakeClient } from './client.testfixture'

export interface TestTransport extends IpcTransport {
  // 등록된 요청 핸들러를 부른다. 없으면 던진다.
  invoke(channel: string, raw: unknown, sender: ClientRef, trusted?: boolean): Promise<unknown>
  // 등록된 단방향 핸들러를 부른다. 없으면 던진다.
  send(channel: string, raw: unknown, sender: ClientRef, trusted?: boolean): void
  registered(): string[]
  // 등록된 리스너 자체 — 동기 반환·동기 throw 를 보는 테스트용. 없으면 던진다.
  listener(channel: string): InvokeListener
  receiver(channel: string): SendListener
}

const TEST_TRANSPORT = Symbol('test-transport')

// 지금 케이스의 테스트 전송 — `scripts/vitest-setup.mjs` 가 케이스마다 새로 건다. 테스트가 다른 전송을
// 걸었으면 던진다.
export function currentTestTransport(): TestTransport {
  const transport = ipcTransport()
  if (!(TEST_TRANSPORT in transport)) throw new Error('지금 전송은 테스트 전송이 아니다')
  return transport as unknown as TestTransport
}

export function createTestTransport(clients: readonly ClientRef[] = []): TestTransport {
  const invokes = new Map<string, InvokeListener>()
  const sends = new Map<string, SendListener>()
  const transport: TestTransport = {
    // 같은 채널을 두 번 등록하면 던진다 — 실제 전송과 같다(`IpcTransport.handle`).
    handle: (channel, listener) => {
      if (invokes.has(channel)) throw new Error(`이미 등록된 요청 채널: ${channel}`)
      invokes.set(channel, listener)
    },
    on: (channel, listener) => {
      if (sends.has(channel)) throw new Error(`이미 등록된 단방향 채널: ${channel}`)
      sends.set(channel, listener)
    },
    clients: () => clients.filter((client) => !client.isClosed()),
    primaryClient: () => clients.find((client) => !client.isClosed()),
    async invoke(channel, raw, sender, trusted = true) {
      const listener = invokes.get(channel)
      if (!listener) throw new Error(`등록되지 않은 요청 채널: ${channel}`)
      return listener({ sender, trusted }, raw)
    },
    send(channel, raw, sender, trusted = true) {
      const listener = sends.get(channel)
      if (!listener) throw new Error(`등록되지 않은 단방향 채널: ${channel}`)
      listener({ sender, trusted }, raw)
    },
    registered: () => [...invokes.keys(), ...sends.keys()],
    listener(channel) {
      const listener = invokes.get(channel)
      if (!listener) throw new Error(`등록되지 않은 요청 채널: ${channel}`)
      return listener
    },
    receiver(channel) {
      const listener = sends.get(channel)
      if (!listener) throw new Error(`등록되지 않은 단방향 채널: ${channel}`)
      return listener
    }
  }
  Object.defineProperty(transport, TEST_TRANSPORT, { value: true })
  return transport
}

// 지금 케이스의 테스트 전송으로 요청을 보낸다. 보낸 창을 고르지 않으면 새 창 참조다.
export function invokeChannel(
  channel: string,
  raw?: unknown,
  sender: ClientRef = fakeClient()
): Promise<unknown> {
  return currentTestTransport().invoke(channel, raw, sender)
}

export function sendChannel(
  channel: string,
  raw?: unknown,
  sender: ClientRef = fakeClient()
): void {
  currentTestTransport().send(channel, raw, sender)
}

export function registeredChannels(): string[] {
  return currentTestTransport().registered()
}

// 같은 케이스에서 핸들러를 다시 등록할 때 — 새 테스트 전송으로 바꾼다(앞 등록은 버려진다).
export function resetTestTransport(clients: readonly ClientRef[] = []): TestTransport {
  const transport = createTestTransport(clients)
  setIpcTransport(transport)
  return transport
}
