import { expect, it, vi } from 'vitest'
import { createComputeClient, type WorkerLike } from './client'
import type { Lane, WireControl, WireRequest } from './protocol'
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 테스트 하네스의 반환형은 조립한 fixture에서 추론한다.
function harness() {
  const messages = {
    compute: [] as (WireControl | WireRequest)[],
    markdown: [] as (WireControl | WireRequest)[]
  }
  const ports = new Map<Lane, WorkerLike>()
  const client = createComputeClient({
    createWorker(lane) {
      const port: WorkerLike = {
        postMessage: (m) => messages[lane].push(m),
        onerror: null,
        onmessage: null,
        onmessageerror: null,
        terminate: vi.fn()
      }
      ports.set(lane, port)
      return port
    },
    onError: vi.fn(),
    docMaxChars: 4
  })
  function finish(lane: Lane): void {
    const msg = messages[lane].at(-1)!
    if (!('id' in msg)) throw Error('missing job')
    ports.get(lane)!.onmessage?.({
      data: {
        id: msg.id,
        ok: true,
        result: lane === 'markdown' ? { tooLarge: true } : { html: 'ok' },
        size: 1
      }
    })
  }
  return { client, messages, finish, ports }
}
it('l1 compute dispatches before markdown returns', async () => {
  const h = harness(),
    doc = { id: 's', revision: 1 },
    lease = h.client.openDocument(doc, { text: 'text' }, 'markdown')
  const slow = h.client.request({ kind: 'markdown', doc, start: 0, end: 4 }),
    fast = h.client.request({ kind: 'highlight', code: 'a', lang: 'ts', theme: 'github-light' })
  h.finish('compute')
  expect(await fast.promise).toEqual({ html: 'ok' })
  h.finish('markdown')
  await slow.promise
  lease.release()
})
it('l2 each lane has its own document capacity and worker failure state', async () => {
  const h = harness(),
    a = { id: 'a', revision: 1 },
    b = { id: 'b', revision: 1 },
    one = h.client.openDocument(a, { text: 'aaaa' }, 'compute'),
    two = h.client.openDocument(b, { text: 'bbbb' }, 'markdown')
  expect(one.available && two.available).toBe(true)
  const job = h.client.request({ kind: 'codeView', source: { doc: a }, start: 0, end: 1 }),
    md = h.client.request({ kind: 'markdown', doc: b, start: 0, end: 4 })
  h.ports.get('compute')!.onerror?.({ message: 'failed' })
  await expect(job.promise).rejects.toThrow()
  h.finish('markdown')
  await expect(md.promise).resolves.toEqual({ tooLarge: true })
  expect(h.messages.markdown[0]).toMatchObject({ type: 'doc.open', ref: b })
  one.release()
  two.release()
})
