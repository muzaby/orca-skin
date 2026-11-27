import { expect, it, vi } from 'vitest'
import { computeClient, setComputeClient, createComputeClient, type WorkerLike } from './client'
import type { Lane, WireControl, WireRequest } from './protocol'
import type { ComputeHandle } from './client'
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 테스트 하네스의 반환형은 조립한 fixture에서 추론한다.
function harness() {
  const messages = {
    compute: [] as (WireControl | WireRequest)[],
    markdown: [] as (WireControl | WireRequest)[],
    image: [] as (WireControl | WireRequest)[]
  }
  const ports = new Map<Lane, WorkerLike>()
  const timings = vi.fn()
  const client = createComputeClient({
    timings,
    failureLimit: 2,
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
        result:
          lane === 'markdown'
            ? { hast: { type: 'root', children: [] } }
            : lane === 'image'
              ? { thumbnail: 'jpg' }
              : { html: 'ok' },
        size: 1
      }
    })
  }
  return { client, messages, finish, ports, timings }
}
it('l1 compute dispatches before markdown returns', async () => {
  const h = harness(),
    doc = { id: 's', revision: 1 },
    lease = h.client.openDocument(doc, { text: 'text' }, 'markdown')
  const slow = h.client.request({ kind: 'markdown', doc, start: 0, end: 4 }),
    fast = h.client.request({ kind: 'highlight', code: 'a', lang: 'ts', theme: 'github-light' })
  expect(h.messages.compute.at(-1)).toMatchObject({ kind: 'highlight' })
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
  await expect(md.promise).resolves.toEqual({ hast: { type: 'root', children: [] } })
  expect(h.messages.markdown[0]).toMatchObject({ type: 'doc.open', ref: b })
  one.release()
  two.release()
})

it('starts each lane with its own module worker entry', async () => {
  const starts: [string, WorkerOptions][] = []
  vi.stubGlobal(
    'Worker',
    class {
      constructor(url: URL, options: WorkerOptions) {
        starts.push([url.pathname, options])
      }
      postMessage(message: WireControl | WireRequest): void {
        if ('id' in message)
          queueMicrotask(() =>
            this.onmessage?.({ data: { id: message.id, ok: true, result: {}, size: 0 } })
          )
      }
      onmessage: WorkerLike['onmessage'] = null
    }
  )
  try {
    const client = computeClient()
    const doc = { id: 'md', revision: 1 }
    const lease = client.openDocument(doc, { text: 'x' }, 'markdown')
    const jobs = [
      client.request({ kind: 'markdown', doc, start: 0, end: 1 }),
      client.request({ kind: 'highlight', code: 'x', lang: 'ts', theme: 'github-light' }),
      client.request({
        kind: 'imageThumb',
        attachmentId: 'a',
        data: 'a',
        pixels: 1,
        mimeType: 'image/png'
      })
    ]
    await Promise.all(jobs.map((j) => j.promise))
    expect(starts.map(([path, options]) => [path.split('/').at(-1), options])).toEqual([
      ['markdown.worker.ts', { name: 'markdown', type: 'module' }],
      ['compute.worker.ts', { name: 'compute', type: 'module' }],
      ['image.worker.ts', { name: 'image', type: 'module' }]
    ])
    lease.release()
  } finally {
    setComputeClient(null)
    vi.unstubAllGlobals()
  }
})

it.each(['compute', 'markdown'] as const)(
  'the %s worker entry processes a request against its opened document',
  async (lane) => {
    const reply = vi.fn<(response: unknown) => void>()
    const scope = {
      onmessage: null as ((event: { data: WireRequest | WireControl }) => void) | null,
      postMessage: reply
    }
    vi.stubGlobal('self', scope)
    try {
      if (lane === 'compute') await import('./worker/compute.worker')
      else await import('./worker/markdown.worker')
      const doc = { id: 'entry', revision: 1 }
      scope.onmessage!({ data: { type: 'doc.open', ref: doc, text: 'first\nsecond' } })
      const request: WireRequest =
        lane === 'compute'
          ? { kind: 'codeView', source: { doc }, start: 1, end: 2, id: 7 }
          : { kind: 'markdown', doc, start: 0, end: 5, id: 7 }
      scope.onmessage!({ data: request })
      await Promise.resolve()
      expect(reply).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 7,
          ok: true,
          result: expect.objectContaining(
            lane === 'compute'
              ? { lines: ['second'] }
              : { hast: expect.objectContaining({ type: 'root' }) }
          )
        })
      )
    } finally {
      vi.unstubAllGlobals()
    }
  }
)

it('frees the image lane on worker failure without blocking a visible compute job', async () => {
  const h = harness()
  const first = h.client.request(
    { kind: 'imageThumb', attachmentId: 'first', mimeType: 'image/png', data: 'a', pixels: 12 },
    { priority: 'background', cacheable: false }
  )
  const second = h.client.request(
    { kind: 'imageThumb', attachmentId: 'second', mimeType: 'image/png', data: 'b', pixels: 2 },
    { priority: 'background', cacheable: false }
  )
  const visible = h.client.request({
    kind: 'highlight',
    code: 'a',
    lang: 'ts',
    theme: 'github-light'
  })
  expect(h.messages.image).toHaveLength(1)
  expect(h.messages.compute).toHaveLength(1)
  h.ports.get('image')!.onmessageerror?.({ message: 'bad clone' })
  await expect(first.promise).rejects.toThrow()
  expect(h.messages.image.at(-1)).toMatchObject({ attachmentId: 'second' })
  h.finish('image')
  h.finish('compute')
  await expect(second.promise).resolves.toEqual({ thumbnail: 'jpg' })
  await expect(visible.promise).resolves.toEqual({ html: 'ok' })
})

it('releases image slots on completion, decode error and queued or running cancellation', async () => {
  const h = harness()
  const image = (id: string, pixels: number): ComputeHandle<{ thumbnail: string | null }> =>
    h.client.request(
      { kind: 'imageThumb', attachmentId: id, mimeType: 'image/png', data: id, pixels },
      { priority: 'background', cacheable: false }
    )
  const first = image('running', 10)
  const large = image('large', 50)
  const skip = image('never dispatched', 1)
  const small = image('small', 2)
  const tail = image('tail', 100)
  skip.cancel()
  first.cancel()
  await expect(skip.promise).rejects.toThrow()
  await expect(first.promise).rejects.toThrow()
  expect(h.messages.image).toHaveLength(1)
  h.finish('image')
  expect(h.messages.image[1]).toMatchObject({ attachmentId: 'small' })
  const message = h.messages.image[1]
  if (!('id' in message)) throw Error('no image job')
  h.ports.get('image')!.onmessage!({ data: { id: message.id, ok: false, error: 'decode' } })
  await expect(small.promise).rejects.toThrow()
  expect(h.messages.image[2]).toMatchObject({ attachmentId: 'large' })
  h.finish('image')
  await expect(large.promise).resolves.toEqual({ thumbnail: 'jpg' })
  h.finish('image')
  await expect(tail.promise).resolves.toEqual({ thumbnail: 'jpg' })
  expect(h.messages.image).toHaveLength(4)
  expect(h.timings.mock.calls.map(([entry]) => [entry.lane, entry.priority])).toEqual(
    Array(4).fill(['image', 'background'])
  )
})

it('discards broken image workers and rejects queued and new jobs at the failure limit', async () => {
  const h = harness()
  const request = (attachmentId: string): ComputeHandle<{ thumbnail: string | null }> =>
    h.client.request(
      { kind: 'imageThumb', attachmentId, data: 'a', mimeType: 'image/png', pixels: 1 },
      { priority: 'background', cacheable: false }
    )
  const results = ['first', 'second', 'third'].map((id) =>
    request(id).promise.catch(() => 'unavailable')
  )
  const first = h.ports.get('image')!
  first.onerror!({ message: 'worker error' })
  expect(first.terminate).toHaveBeenCalledOnce()
  const second = h.ports.get('image')!
  expect(second).not.toBe(first)
  second.onmessageerror!({ message: 'bad clone' })
  expect(second.terminate).toHaveBeenCalledOnce()
  expect(h.messages.image).toHaveLength(2)
  await expect(Promise.all(results)).resolves.toEqual(Array(3).fill('unavailable'))
  await expect(request('fourth').promise).rejects.toThrow()
  expect(h.messages.image).toHaveLength(2)
})
