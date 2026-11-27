import { expect, it, vi } from 'vitest'
import { portHarness as harness } from './clientPort.testfixture'
import * as protocol from './protocol'
import { readWireText } from './chunkedText'
import { createCreditWire, WIRE_FRAME_CHARS } from './creditWire'
import { revisionOf } from './documents'
import type { MarkdownRequest, DocRef } from './protocol'

const ref = (id: string): DocRef => ({ id, revision: 1 })
const markdown = (doc: DocRef, end = 3): MarkdownRequest => ({
  kind: 'markdown' as const,
  doc,
  start: 0,
  end
})
it('동일 원천의 revision은 재사용하고 다른 객체에 새 번호를 준다', () => {
  const source = {}
  const first = revisionOf(source)
  expect(revisionOf({})).toBeGreaterThan(first)
  expect(revisionOf(source)).toBe(first)
})
it('d2/d7/d10 첫 작업 직전에 한 번 열고, 마지막 작업 뒤에 닫으며 비캐시 꼬리는 재요청한다', async () => {
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
it('d8 문서 용량 회복은 구독마다 한 번 알리고 이미 해제한 임차는 건너뛴다', async () => {
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
  expect(client.peek(markdown(b.ref))).toEqual({ hast: { type: 'root', children: [] } })
  b.release()
})
it('d3/d9 unknown-doc은 한 번만 다시 열고 레인 오류 뒤에는 새 워커에 원문을 다시 보낸다', async () => {
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
  expect(client.workerEpoch('compute')).toBe(0)
  running.cancel()
  await reject
  expect(client.workerEpoch('compute')).toBe(1)
  const second = ports.get('compute')!
  expect(first.terminate).toHaveBeenCalledTimes(1)
  expect(second.messages.map((m) => ('type' in m ? m.type : m.kind))).toEqual([
    'doc.open',
    'doc.open',
    'diffLocate'
  ])
  second.reply()
  await queued.promise
  expect(client.recoveryEpoch('compute')).toBe(0)
  left.release()
  right.release()
})

it('d1 repeated range uses the cached result, new revision sends new work', async () => {
  const { client, ports } = harness(),
    doc = ref('file')
  const lease = client.openDocument(doc, { text: 'abc' }, 'markdown'),
    req = markdown(doc)
  const a = client.request(req),
    port = ports.get('markdown')!
  port.reply()
  await a.promise
  const before = port.messages.length
  await client.request(req).promise
  expect(port.messages).toHaveLength(before)
  const next = { ...doc, revision: 2 },
    second = client.openDocument(next, { text: 'xyz' }, 'markdown'),
    job = client.request(markdown(next))
  expect(port.messages.slice(before)).toMatchObject([
    { type: 'doc.open', ref: next },
    { kind: 'markdown', doc: next }
  ])
  port.reply()
  await job.promise
  lease.release()
  second.release()
})
it('d4 real worker deletes closed document and reopens new content', async () => {
  const { createWorkerState } = await import('./worker/state'),
    run = createWorkerState(),
    doc = ref('doc'),
    req = { kind: 'codeView' as const, id: 1, source: { doc }, start: 0, end: 1 }
  for (const text of ['first', 'second']) {
    await run({ type: 'doc.open', ref: doc, text })
    expect(await run(req)).toMatchObject({ ok: true, result: { lines: [text] } })
    await run({ type: 'doc.close', ref: doc })
    expect(await run(req)).toMatchObject({ ok: false, error: 'unknown-doc' })
  }
})
it('d5 unregistered document is rejected before worker creation', async () => {
  const { client, ports } = harness()
  await expect(client.request(markdown(ref('missing'))).promise).rejects.toThrow('doc-unavailable')
  expect(ports.size).toBe(0)
})
it('d6 last lease sends exactly one close after the completed job', async () => {
  const { client, ports } = harness(),
    doc = ref('doc'),
    one = client.openDocument(doc, { text: 'abc' }, 'markdown'),
    two = client.openDocument(doc, { text: 'abc' }, 'markdown')
  const job = client.request(markdown(doc))
  const port = ports.get('markdown')!
  port.reply()
  await job.promise
  one.release()
  expect(port.messages).toHaveLength(2)
  two.release()
  two.release()
  expect(port.messages.slice(2)).toEqual([{ type: 'doc.close', ref: doc }])
})

it('d4 routes real worker token continuations through the client and preserves the source rows', async () => {
  const { createWorkerState } = await import('./worker/state')
  const { client, ports } = harness(10000)
  const doc = ref('round-trip')
  const lines = ['const a = 1', '/* start', 'end */', 'const b = 2']
  const lease = client.openDocument(doc, { text: lines.join('\n') }, 'compute')
  const job = client.request<'tokens'>({
    kind: 'tokens',
    doc,
    lang: 'typescript',
    theme: 'github-dark',
    start: 0,
    end: lines.length
  })
  void job.promise.catch(() => {})
  let tick = 0
  const run = createWorkerState(() => (tick += 51))
  const port = ports.get('compute')!
  const replies: (boolean | 'continue')[] = []
  for (let i = 0; i < port.messages.length; i++) {
    const result = await run(structuredClone(port.messages[i]))
    if (result) {
      replies.push(result.ok)
      port.onmessage?.({ data: structuredClone(result) })
    }
  }
  expect(replies).toEqual(['continue', 'continue', 'continue', true])
  const result = await job.promise
  expect(result.rows.map((row) => row.map((token) => token.content).join(''))).toEqual(lines)
  lease.release()
  expect(port.messages.at(-1)).toEqual({ type: 'doc.close', ref: doc })
})

it('d11 uses the registered prefix sample for dispatch, including empty documents and repeated leases', async () => {
  const { client, ports } = harness(2_000_000)
  const prefix = 'x'.repeat(65_536)
  const x = client.openDocument(
    ref('x'),
    { text: prefix + '\n123456789'.repeat(100_000) },
    'compute'
  )
  const y = client.openDocument(ref('y'), { text: ('y'.repeat(999) + '\n').repeat(100) }, 'compute')
  const empty = client.openDocument(ref('empty'), { text: '' }, 'compute')
  const duplicate = client.openDocument(x.ref, { text: 'different' }, 'compute')
  const tokens = {
    kind: 'tokens' as const,
    lang: 'ts',
    theme: 'github-dark' as const,
    start: 0,
    end: 1
  }
  const sizing = vi.spyOn(protocol, 'requestSize')
  try {
    const jobs = [empty, x, y].map((lease) => client.request({ ...tokens, doc: lease.ref }))
    const port = ports.get('compute')!
    const lengthOf = sizing.mock.calls[0][1]
    expect(lengthOf(empty.ref)).toEqual({ chars: 0, lines: 1 })
    const sample = lengthOf(x.ref)
    expect(sample).toEqual({ chars: 65_536, lines: 1 })
    for (const [, registeredSample] of sizing.mock.calls)
      expect(registeredSample(x.ref)).toBe(sample)
    expect(lengthOf(y.ref)).toEqual({ chars: 65_536, lines: 66 })
    port.reply()
    expect(port.messages.at(-1)).toMatchObject({ kind: 'tokens', doc: y.ref })
    port.reply()
    expect(port.messages.at(-1)).toMatchObject({ kind: 'tokens', doc: x.ref })
    port.reply()
    await Promise.all(jobs.map((job) => job.promise))
  } finally {
    sizing.mockRestore()
    for (const lease of [duplicate, empty, y, x]) lease.release()
  }
})

it('VP-40 transfers a live revision in one lease, sends only the suffix and resets replaced text', async () => {
  const { client, ports } = harness(16)
  const first = { id: 'tail', revision: 1 }
  const second = { id: 'tail', revision: 2 }
  const reset = { id: 'tail', revision: 3 }
  const once = client.openDocument(first, { text: 'old prefix' }, 'markdown')
  const initial = client.request(markdown(first), { cacheable: false })
  const port = ports.get('markdown')!
  port.reply()
  await initial.promise

  const extended = once.replace!(second, 'old prefix +')
  expect(once.available).toBe(false)
  expect(extended.available).toBe(true)
  const next = client.request(markdown(second), { cacheable: false })
  expect(port.messages.at(-2)).toEqual({
    type: 'doc.extend',
    ref: second,
    from: first,
    offset: 10,
    suffix: ' +'
  })
  port.reply()
  await next.promise

  const replaced = extended.replace!(reset, 'new prefix')
  expect(extended.available).toBe(false)
  const last = client.request(markdown(reset), { cacheable: false })
  expect(port.messages.slice(-3, -1)).toEqual([
    { type: 'doc.close', ref: second },
    { type: 'doc.open', ref: reset, text: 'new prefix' }
  ])
  port.reply()
  await last.promise
  replaced.release()
  expect(port.messages.at(-1)).toEqual({ type: 'doc.close', ref: reset })
})

it('VP-41 a pre-indexed Markdown document is opened from bounded ranges without sampling the entire string', async () => {
  const part = 'x'.repeat(WIRE_FRAME_CHARS)
  const text = part.repeat(8)
  const { client, ports } = harness(text.length)
  const doc = ref('large')
  const read = vi.fn((start: number, end: number) => part.slice(0, end - start))
  const original = String.prototype.charCodeAt
  let scans = 0
  try {
    String.prototype.charCodeAt = function (index: number) {
      if (this.length === text.length) scans++
      return original.call(this, index)
    }
    const lease = client.openDocument(doc, { text, read }, 'markdown')
    const job = client.request(markdown(doc))
    const port = ports.get('markdown')!
    const opening = port.messages[0]
    expect(readWireText.get(opening)).toBe(read)
    const queue: (() => void)[] = []
    const received = vi.fn()
    const up = createCreditWire((frame) => queue.push(() => down.receive(frame)), vi.fn())
    const down = createCreditWire((ack) => queue.push(() => up.receive(ack)), received)
    up.send(opening, true)
    while (queue.length) queue.shift()!()
    expect(received).toHaveBeenCalledWith({ type: 'doc.open', ref: doc, text })
    expect(read.mock.calls).toEqual(
      Array.from({ length: 8 }, (_, i) => [i * WIRE_FRAME_CHARS, (i + 1) * WIRE_FRAME_CHARS])
    )
    expect(scans).toBe(0)
    port.reply()
    await job.promise
    lease.release()
  } finally {
    String.prototype.charCodeAt = original
  }
})
