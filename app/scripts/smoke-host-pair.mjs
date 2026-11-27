import assert from 'node:assert/strict'
import { once } from 'node:events'
import { join } from 'node:path'
import { MessageChannel, Worker } from 'node:worker_threads'
import { HOST_ENVIRONMENT_ARG } from './smoke-hosts.mjs'

export async function bootPair(out, root) {
  let id = 0
  const pending = new Map()
  const received = []
  const pairs = []
  const environment = {
    userData: join(root, 'app'),
    desktop: root,
    appVersion: '0.3.1',
    isPackaged: false,
    appPath: process.cwd()
  }
  for (const kind of ['data', 'agent']) {
    const worker = new Worker(new URL('./smoke-host-worker.mjs', import.meta.url), {
      workerData: {
        environment,
        environmentArg: HOST_ENVIRONMENT_ARG,
        bundle: join(out, kind + '-host.js')
      }
    })
    const ready = Promise.withResolvers()
    worker.on('error', (error) => ready.reject(error))
    worker.on('message', ({ toShell: message }) => {
      if (message?.type === 'service.call')
        worker.postMessage({
          data: {
            type: 'service.result',
            id: message.id,
            ok: true,
            value: message.name === 'secrets.isAvailable' ? false : null
          }
        })
      if (message?.type === 'ready') ready.resolve()
    })
    const { port1, port2 } = new MessageChannel()
    await ready.promise
    worker.postMessage(
      { data: { type: 'client.connect', clientId: 1, trusted: true }, ports: [port2] },
      [port2]
    )
    port1.on('message', (message) => {
      if (message.kind === 'event' && message.channel === 'oo:chat:event')
        received.push(message.payload)
      if (message.kind !== 'result') return
      const result = pending.get(message.id)
      pending.delete(message.id)
      if (message.ok) result?.resolve(message.value)
      else result?.reject(new Error(message.error))
    })
    pairs.push({ worker, port: port1 })
  }
  const link = new MessageChannel()
  ;[link.port1, link.port2].forEach((port, i) =>
    pairs[i].worker.postMessage({ data: { type: 'peer.connect' }, ports: [port] }, [port])
  )
  const invoke = (kind, channel, payload) => {
    const result = Promise.withResolvers()
    pending.set(++id, result)
    pairs[kind === 'agent' ? 1 : 0].port.postMessage({ kind: 'invoke', id, channel, payload })
    return result.promise
  }
  return {
    invoke,
    received,
    async close() {
      for (const { worker, port } of pairs.reverse()) {
        const done = once(worker, 'exit')
        worker.postMessage({ data: { type: 'shutdown' } })
        assert.deepEqual(await done, [0])
        port.close()
      }
    }
  }
}
