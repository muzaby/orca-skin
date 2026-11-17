// smoke-hosts.mjs 의 호스트 한 개 (0324). 번들된 호스트 진입점을 worker 스레드에서 띄우고, Electron 의
// utility 프로세스가 주는 것 둘을 흉내 낸다:
// - `process.parentPort` — 셸과의 연결. 메시지 이벤트는 `{ data, ports }` 이고 포트는 `MessagePortMain` 모양이다.
// - `electron` 모듈 — 호스트가 쓰는 것은 `net` 뿐이다(`infra/net/net-fetch.ts`·`net-request.ts`).
// worker 마다 모듈 레지스트리가 따로라 두 호스트의 프로세스 단위 상태가 섞이지 않는다.
import { EventEmitter } from 'node:events'
import Module, { createRequire } from 'node:module'
import { parentPort as worker, workerData } from 'node:worker_threads'

const electronStub = {
  net: {
    fetch: (...args) => globalThis.fetch(...args),
    request: () => {
      throw new Error('smoke: net.request is not available')
    }
  }
}
const loadModule = Module._load
Module._load = function load(request, ...rest) {
  if (request === 'electron') return electronStub
  return loadModule.call(this, request, ...rest)
}

// Node `MessagePort` → `MessagePortMain` 모양(메시지 이벤트가 `{ data }`).
const asMainPort = (port) => ({
  postMessage: (message) => port.postMessage(message),
  on(event, listener) {
    if (event === 'message') port.on('message', (data) => listener({ data }))
    if (event === 'close') port.on('close', listener)
    return this
  },
  start: () => port.start(),
  close: () => port.close()
})

const parent = new EventEmitter()
parent.postMessage = (message) => worker.postMessage({ toShell: message })
worker.on('message', (message) => {
  parent.emit('message', { data: message.data, ports: (message.ports || []).map(asMainPort) })
})
process.parentPort = parent
process.argv.push(`${workerData.environmentArg}${JSON.stringify(workerData.environment)}`)
// 번들은 CommonJS 다.
createRequire(import.meta.url)(workerData.bundle)
