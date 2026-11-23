import { expect, it, vi } from 'vitest'
import { createComputeClient, type ComputeClient, type WorkerLike } from './client'
import { revisionOf } from './documents'
import type { MarkdownRequest, DocRef, Lane, WireControl, WireRequest } from './protocol'

class Port implements WorkerLike {
  messages: (WireControl | WireRequest)[] = []
  onmessage: WorkerLike['onmessage'] = null
  onerror: WorkerLike['onerror'] = null
  onmessageerror: WorkerLike['onmessageerror'] = null
  terminate = vi.fn()
  postMessage(message: WireControl | WireRequest): void {
    this.messages.push(message)
  }
  reply(error?: string): void {
    const work = this.messages
      .slice()
      .reverse()
      .find((m) => 'id' in m)
    if (!work || !('id' in work)) throw Error('no active request')
    this.onmessage?.({
      data: error
        ? { id: work.id, ok: false, error }
        : { id: work.id, ok: true, result: { tooLarge: true }, size: 1 }
    })
  }
}
const ref = (id: string): DocRef => ({ id, revision: 1 })
const markdown = (doc: DocRef, end = 3): MarkdownRequest => ({
  kind: 'markdown' as const,
  doc,
  start: 0,
  end
})
function harness(capacity = 10): { client: ComputeClient; ports: Map<Lane, Port> } {
  const ports = new Map<Lane, Port>()
  const client = createComputeClient({
    docMaxChars: capacity,
    onError: vi.fn(),
    createWorker(lane) {
      const port = new Port()
      ports.set(lane, port)
      return port
    }
  })
  return { client, ports }
}
it('동일 원천의 revision은 재사용하고 다른 객체에 새 번호를 준다', () => {
  const source = {}
  const first = revisionOf(source)
  expect(revisionOf({})).toBeGreaterThan(first)
  expect(revisionOf(source)).toBe(first)
})
it('첫 작업 직전에 한 번 열고, 마지막 작업 뒤에 닫으며 비캐시 꼬리는 재요청한다', async () => {
  const { client, ports } = harness()
  const doc = ref('a')
  const lease = client.openDocument(doc, { text: 'abc' }, 'markdown')
  expect(ports.size).toBe(0)
  const first = client.request(markdown(doc), { cacheable: false })
  const second = client.request(markdown(doc, 2), { cacheable: false })
  const port = ports.get('markdown')!
  expect(port.messages).toEqual([
    { type: 'doc.open', ref: doc, text: 'abc' },
    { ...markdown(doc), id: 1 }
  ])
  port.reply()
  await first.promise
  expect(client.peek(markdown(doc))).toBeUndefined()
  const third = client.request(markdown(doc), { cacheable: false })
  lease.release()
  port.reply()
  await second.promise
  port.reply()
  await third.promise
  expect(port.messages).toEqual([
    { type: 'doc.open', ref: doc, text: 'abc' },
    { ...markdown(doc), id: 1 },
    { ...markdown(doc, 2), id: 2 },
    { ...markdown(doc), id: 3 },
    { type: 'doc.close', ref: doc }
  ])
})
it('문서 용량 회복은 구독마다 한 번 알리고 이미 해제한 임차는 건너뛴다', async () => {
  const { client, ports } = harness(3)
  const a = client.openDocument(ref('a'), { text: 'abc' }, 'markdown')
  const b = client.openDocument(ref('b'), { text: 'def' }, 'markdown')
  const other = client.openDocument(ref('b'), { text: 'def' }, 'markdown')
  let calls = 0
  b.onAvailable(() => calls++)
  other.onAvailable(() => {
    throw Error('released lease')
  })
  other.release()
  expect(b.available).toBe(false)
  await expect(client.request(markdown(b.ref)).promise).rejects.toThrow('doc-unavailable')
  expect(ports.size).toBe(0)
  a.release()
  a.release()
  expect(calls).toBe(1)
  expect(b.available).toBe(true)
  const work = client.request(markdown(b.ref))
  ports.get('markdown')!.reply()
  await work.promise
  expect(client.peek(markdown(b.ref))).toEqual({ tooLarge: true })
  b.release()
})
it('unknown-doc은 한 번만 다시 열고 레인 오류 뒤에는 새 워커에 원문을 다시 보낸다', async () => {
  const { client, ports } = harness()
  const lease = client.openDocument(ref('a'), { text: 'abc' }, 'markdown')
  const work = client.request(markdown(lease.ref))
  const first = ports.get('markdown')!
  first.reply('unknown-doc')
  first.reply('unknown-doc')
  await expect(work.promise).rejects.toThrow('unknown-doc')
  expect(first.messages.filter((m) => 'type' in m && m.type === 'doc.open')).toHaveLength(2)
  const fail = client.request(markdown(lease.ref))
  first.onerror?.(Error('port'))
  await expect(fail.promise).rejects.toThrow('worker failed')
  const retry = client.request(markdown(lease.ref))
  const next = ports.get('markdown')!
  expect(next).not.toBe(first)
  expect(next.messages[0]).toMatchObject({ type: 'doc.open', text: 'abc' })
  next.reply()
  await retry.promise
  lease.release()
})

it('opens both sides once, replaces cancelled pair computation and reopens on the new worker', async () => {
  const { client, ports } = harness()
  const left = client.openDocument(ref('left'), { text: 'a' }, 'compute')
  const right = client.openDocument(ref('right'), { text: 'b' }, 'compute')
  const source = { kind: 'pair' as const, old: left.ref, new: right.ref }
  const options = {
    layout: 'inline' as const,
    ignoreWhitespace: false,
    highlightWords: false,
    expansions: []
  }
  const running = client.request({ kind: 'diffView', source, options, start: 0, end: 1 })
  const reject = expect(running.promise).rejects.toThrow()
  const queued = client.request({
    kind: 'diffLocate',
    source,
    options,
    anchors: [{ oldLine: 1, newLine: null }]
  })
  const first = ports.get('compute')!
  expect(first.messages.map((m) => ('type' in m ? m.type : m.kind))).toEqual([
    'doc.open',
    'doc.open',
    'diffView'
  ])
  running.cancel()
  await reject
  const second = ports.get('compute')!
  expect(first.terminate).toHaveBeenCalledTimes(1)
  expect(second.messages.map((m) => ('type' in m ? m.type : m.kind))).toEqual([
    'doc.open',
    'doc.open',
    'diffLocate'
  ])
  second.reply()
  await queued.promise
  left.release()
  right.release()
})
