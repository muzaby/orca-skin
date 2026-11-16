// 피어 포트의 양 끝 (0324 AR-13 · EP-21 · EP-2′). 데이터 호스트와 에이전트 호스트가 같은 구현을 쓴다.
//
// - 받은 메시지는 도착한 차례대로 그 자리에서 처리한다 — 핸들러를 부르는 동기 구간에 `await` 가
//   없으므로 한 포트의 순서가 곧 처리 순서다(F1 의 저장 순서).
// - 포트가 닫히면 응답을 기다리던 요청을 모두 실패시키고 닫힘 구독자에게 알린다.
// - `requestEnsured` 는 포트가 없을 때 줄을 세우고 `ensure()` 를 한 번 부른다(D-044). 다음 포트가
//   오면 들어온 차례대로 보내고, `unavailable()` 이면 모두 실패시킨다.
// - 핸들러의 동기 구간은 `perf.stall`(`source:'peer'`)로 잰다(D-043).
//
// 이 파일은 Electron 을 모른다 — 호스트 진입점이 `MessagePortMain` 을 `PeerPort` 로 감싸 준다.

import {
  PeerMessageSchema,
  peerMessageFits,
  type PeerMessage,
  type PeerMethod,
  type PeerNotifyMethod,
  type PeerRequestMethod,
  type PeerSide
} from '../../../shared/peer-protocol'
import { recordStall, stallThread } from '../perf/stall-monitor'

export interface PeerPort {
  post(message: PeerMessage): void
  onMessage(listener: (data: unknown) => void): void
  onClose(listener: () => void): void
  start(): void
  close(): void
}

export const PEER_CLOSED_ERROR = '피어 호스트와의 연결이 끊겼다'
export const PEER_UNAVAILABLE_ERROR = '피어 호스트를 띄우지 못했다'

export interface PeerLinkDeps {
  // 이 끝이 어느 호스트인가 — 받는 메시지는 반대편이 보낸 것이어야 한다.
  side: PeerSide
  onRequest(method: PeerMethod, payload: unknown): unknown
  onNotify(method: PeerMethod, payload: unknown): void
  // `requestEnsured` 가 포트 없이 불렸다 — 셸에 반대편 기동을 부탁한다.
  ensure?(): void
  // 형식이 틀린 메시지를 받았다.
  onInvalid?(): void
  clock?: () => number
}

export interface PeerLink<S extends PeerSide> {
  attach(port: PeerPort): void
  connected(): boolean
  // 포트가 없으면 바로 실패한다.
  request(method: PeerRequestMethod<S>, payload?: unknown): Promise<unknown>
  // 포트가 없으면 반대편을 띄워 달라고 한 뒤 기다린다.
  requestEnsured(method: PeerRequestMethod<S>, payload?: unknown): Promise<unknown>
  // 포트가 없으면 보내지 않고 false.
  notify(method: PeerNotifyMethod<S>, payload?: unknown): boolean
  // 셸이 반대편을 띄우지 못했다고 알렸다 — 줄 선 요청을 모두 실패시킨다.
  unavailable(): void
  // 반환값은 구독 해제다.
  onClosed(listener: () => void): () => void
  onConnected(listener: () => void): () => void
  close(): void
}

interface Pending {
  resolve(value: unknown): void
  reject(error: Error): void
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createPeerLink<S extends PeerSide>(deps: PeerLinkDeps & { side: S }): PeerLink<S> {
  const other: PeerSide = deps.side === 'agent' ? 'data' : 'agent'
  const clock = deps.clock ?? (() => performance.now())
  let port: PeerPort | null = null
  let nextId = 0
  let inFlight = new Map<number, Pending>()
  let waiting: { method: PeerMethod; payload: unknown; settle: Pending }[] = []
  let ensureRequested = false
  const closedListeners = new Set<() => void>()
  const connectedListeners = new Set<() => void>()

  const send = (target: PeerPort, method: PeerMethod, payload: unknown, settle: Pending): void => {
    const id = nextId++
    inFlight.set(id, settle)
    target.post({ kind: 'request', id, method, payload })
  }

  const timed = <R>(method: PeerMethod, run: () => R): R => {
    const startedAt = clock()
    try {
      return run()
    } finally {
      recordStall({
        thread: stallThread(),
        source: 'peer',
        durationMs: clock() - startedAt,
        label: method
      })
    }
  }

  const receive = (owner: PeerPort, data: unknown): void => {
    if (owner !== port) return
    const parsed = PeerMessageSchema.safeParse(data)
    if (!parsed.success || !peerMessageFits(parsed.data, other)) {
      deps.onInvalid?.()
      const id = (data as { id?: unknown; kind?: unknown } | null)?.id
      const kind = (data as { kind?: unknown } | null)?.kind
      if (kind === 'request' && typeof id === 'number' && Number.isInteger(id) && id >= 0) {
        owner.post({ kind: 'result', id, ok: false, error: '형식이 틀린 요청' })
      }
      return
    }
    const message = parsed.data
    if (message.kind === 'result') {
      const settle = inFlight.get(message.id)
      if (!settle) return
      inFlight.delete(message.id)
      if (message.ok) settle.resolve(message.value)
      else settle.reject(new Error(message.error))
      return
    }
    if (message.kind === 'notify') {
      timed(message.method, () => deps.onNotify(message.method, message.payload))
      return
    }
    const { id, method } = message
    const reply = (result: PeerMessage): void => {
      if (port === owner) owner.post(result)
    }
    let pending: unknown
    try {
      pending = timed(method, () => deps.onRequest(method, message.payload))
    } catch (error) {
      reply({ kind: 'result', id, ok: false, error: errorText(error) })
      return
    }
    Promise.resolve(pending).then(
      (value) => reply({ kind: 'result', id, ok: true, value }),
      (error: unknown) => reply({ kind: 'result', id, ok: false, error: errorText(error) })
    )
  }

  const drop = (owner: PeerPort): void => {
    if (owner !== port) return
    port = null
    const pending = inFlight
    inFlight = new Map()
    for (const settle of pending.values()) settle.reject(new Error(PEER_CLOSED_ERROR))
    for (const listener of [...closedListeners]) listener()
  }

  return {
    attach(next) {
      if (port) {
        const previous = port
        drop(previous)
        previous.close()
      }
      port = next
      ensureRequested = false
      next.onMessage((data) => receive(next, data))
      next.onClose(() => drop(next))
      next.start()
      const queued = waiting
      waiting = []
      for (const item of queued) send(next, item.method, item.payload, item.settle)
      for (const listener of [...connectedListeners]) listener()
    },
    connected: () => port !== null,
    request(method, payload) {
      const target = port
      if (!target) return Promise.reject(new Error(PEER_CLOSED_ERROR))
      return new Promise((resolve, reject) => send(target, method, payload, { resolve, reject }))
    },
    requestEnsured(method, payload) {
      const target = port
      if (target) {
        return new Promise((resolve, reject) => send(target, method, payload, { resolve, reject }))
      }
      return new Promise((resolve, reject) => {
        waiting.push({ method, payload, settle: { resolve, reject } })
        if (!ensureRequested) {
          ensureRequested = true
          deps.ensure?.()
        }
      })
    },
    notify(method, payload) {
      if (!port) return false
      port.post({ kind: 'notify', method, payload })
      return true
    },
    unavailable() {
      ensureRequested = false
      const queued = waiting
      waiting = []
      for (const item of queued) item.settle.reject(new Error(PEER_UNAVAILABLE_ERROR))
    },
    onClosed(listener) {
      closedListeners.add(listener)
      return () => {
        closedListeners.delete(listener)
      }
    },
    onConnected(listener) {
      connectedListeners.add(listener)
      return () => {
        connectedListeners.delete(listener)
      }
    },
    close() {
      const current = port
      if (!current) return
      drop(current)
      current.close()
    }
  }
}
