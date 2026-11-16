// 창 쪽 호스트 포트 클라이언트 (0324 EP-8′ · plan §7-E). 에이전트 호스트·데이터 호스트마다 하나씩 쓴다.
//
// 호스트 채널의 요청·단방향 송신·통지 구독이 모두 여기를 지난다. 셸이 넘긴 포트가 있으면 그
// 포트로 보내고, 없으면(첫 포트 전 · 호스트 종료 뒤) 줄을 세웠다가 다음 포트에 순서대로 보낸다.
// 종료 통지는 응답을 기다리는 요청과 대기열을 모두 실패시킨다. 이 파일은 Electron 을 모른다 —
// preload 가 `MessagePort` 와 셸 채널을 감싸 넘긴다.

import { HostToClientSchema, type ClientToHost } from '../shared/host-protocol'

// 셸이 넘긴 포트 하나.
export interface ClientPort {
  postMessage(message: ClientToHost): void
  onMessage(listener: (data: unknown) => void): void
  close(): void
}

export type HostName = 'agent' | 'data'

export interface HostPortClientDeps {
  // 어느 호스트의 포트인가 — 실패 문장에 실린다.
  host: HostName
  // 호스트가 죽은 뒤 첫 요청에서 한 번 — 셸에 재기동을 부탁한다.
  requestConnect(): void
}

export interface HostPortClient {
  invoke(channel: string, payload?: unknown): Promise<unknown>
  send(channel: string, payload?: unknown): void
  // 반환값은 구독 해제다. 포트를 바꿔도 구독은 유지된다.
  on(channel: string, listener: (payload: unknown) => void): () => void
  // 셸이 새 포트를 넘겼다 — 호스트가 요청을 받을 수 있다.
  attachPort(port: ClientPort): void
  // 셸이 호스트 종료를 알렸다.
  hostExited(): void
}

const HOST_LABEL: Record<HostName, string> = { agent: '에이전트 호스트', data: '데이터 호스트' }

export function hostExitedError(host: HostName): string {
  return `${HOST_LABEL[host]}가 종료됐다`
}

export function hostReplacedError(host: HostName): string {
  return `${HOST_LABEL[host]}가 다시 연결됐다`
}

type Outgoing =
  | { kind: 'invoke'; channel: string; payload: unknown; settle: Pending }
  | { kind: 'send'; channel: string; payload: unknown }

interface Pending {
  resolve(value: unknown): void
  reject(error: Error): void
}

export function createHostPortClient(deps: HostPortClientDeps): HostPortClient {
  const exitedError = hostExitedError(deps.host)
  const replacedError = hostReplacedError(deps.host)
  let port: ClientPort | null = null
  let exited = false
  let connectRequested = false
  let nextId = 0
  // 지금 포트에서 응답을 기다리는 요청.
  let inFlight = new Map<number, Pending>()
  let queue: Outgoing[] = []
  const listeners = new Map<string, Set<(payload: unknown) => void>>()

  const failAll = (pending: Map<number, Pending>, message: string): void => {
    for (const settle of pending.values()) settle.reject(new Error(message))
  }

  const post = (target: ClientPort, item: Outgoing): void => {
    if (item.kind === 'send') {
      target.postMessage({ kind: 'send', channel: item.channel, payload: item.payload })
      return
    }
    const id = nextId++
    inFlight.set(id, item.settle)
    target.postMessage({ kind: 'invoke', id, channel: item.channel, payload: item.payload })
  }

  const enqueue = (item: Outgoing): void => {
    if (port) {
      post(port, item)
      return
    }
    queue.push(item)
    if (exited && !connectRequested) {
      connectRequested = true
      deps.requestConnect()
    }
  }

  const receive = (owner: ClientPort, data: unknown): void => {
    if (owner !== port) return
    const parsed = HostToClientSchema.safeParse(data)
    if (!parsed.success) return
    const message = parsed.data
    if (message.kind === 'event') {
      for (const listener of listeners.get(message.channel) ?? []) listener(message.payload)
      return
    }
    const settle = inFlight.get(message.id)
    if (!settle) return
    inFlight.delete(message.id)
    if (message.ok) settle.resolve(message.value)
    else settle.reject(new Error(message.error))
  }

  return {
    invoke(channel, payload) {
      return new Promise((resolve, reject) => {
        enqueue({ kind: 'invoke', channel, payload, settle: { resolve, reject } })
      })
    },
    send(channel, payload) {
      enqueue({ kind: 'send', channel, payload })
    },
    on(channel, listener) {
      let set = listeners.get(channel)
      if (!set) {
        set = new Set()
        listeners.set(channel, set)
      }
      set.add(listener)
      return () => {
        set.delete(listener)
      }
    },
    attachPort(next) {
      const previous = port
      const replaced = inFlight
      port = next
      inFlight = new Map()
      // `exited`·`connectRequested` 는 포트가 없을 때만 읽고 `hostExited` 가 다시 정한다.
      if (previous) {
        previous.close()
        failAll(replaced, replacedError)
      }
      next.onMessage((data) => receive(next, data))
      const waiting = queue
      queue = []
      for (const item of waiting) post(next, item)
    },
    hostExited() {
      const previous = port
      const pending = inFlight
      const waiting = queue
      port = null
      inFlight = new Map()
      queue = []
      exited = true
      connectRequested = false
      previous?.close()
      failAll(pending, exitedError)
      for (const item of waiting) {
        if (item.kind === 'invoke') item.settle.reject(new Error(exitedError))
      }
    }
  }
}
