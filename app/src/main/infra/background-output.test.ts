import { afterEach, expect, it } from 'vitest'
import {
  mkdtemp,
  mkdir,
  writeFile,
  appendFile,
  readFile,
  rename,
  rm,
  symlink
} from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BackgroundOutputStore } from './background-output'
const dirs: string[] = []
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true })
})
async function fixture(): Promise<{ root: string; allowed: string; store: BackgroundOutputStore }> {
  const root = await mkdtemp(join(tmpdir(), 'orca-output-test-'))
  dirs.push(root)
  const allowed = join(root, 'allowed')
  await mkdir(allowed)
  return { root, allowed, store: new BackgroundOutputStore(join(root, 'snapshots')) }
}
it('bounds reads, detects replacement/truncation, and preserves immutable captured bytes', async () => {
  const { allowed, store } = await fixture()
  const path = join(allowed, 'output.txt')
  await writeFile(path, 'first second')
  const ref = { id: 'o', field: 'output_file', value: path, kind: 'file' as const }
  const first = await store.read(ref, [allowed], { offset: 0, maxBytes: 5 })
  expect(first.text).toBe('first')
  expect(first.eof).toBe(false)
  const snapshot = await store.capture(ref, [allowed])
  expect(snapshot.size).toBe(12)
  expect(snapshot.sha256).toHaveLength(64)
  await writeFile(path, 'x')
  expect(
    (await store.read(ref, [allowed], { offset: 5, maxBytes: 5, cursor: first.cursor })).status
  ).toBe('truncated')
  expect((await store.readSnapshot(snapshot, { offset: 0, maxBytes: 64 })).text).toBe(
    'first second'
  )
})
it('rejects false, URI, sibling prefix, traversal and junction escapes; missing is explicit', async () => {
  const { root, allowed, store } = await fixture()
  const outside = join(root, 'allowed-sibling')
  await mkdir(outside)
  const path = join(outside, 'secret')
  await writeFile(path, 'secret')
  const ref = { id: 'o', field: 'output_file', value: path, kind: 'file' as const }
  expect((await store.read(ref, [allowed], { offset: 0, maxBytes: 64 })).status).toBe('denied')
  expect(
    (
      await store.read(
        { ...ref, value: join(allowed, '..', 'allowed-sibling', 'secret') },
        [allowed],
        { offset: 0, maxBytes: 64 }
      )
    ).status
  ).toBe('denied')
  expect(
    (
      await store.read({ ...ref, canRead: false, value: join(allowed, 'missing') }, [allowed], {
        offset: 0,
        maxBytes: 64
      })
    ).status
  ).toBe('denied')
  expect(
    (
      await store.read({ ...ref, kind: 'uri', value: 'https://example.test/a' }, [allowed], {
        offset: 0,
        maxBytes: 64
      })
    ).status
  ).toBe('remote')
  expect(
    (
      await store.read({ ...ref, value: join(allowed, 'missing') }, [allowed], {
        offset: 0,
        maxBytes: 64
      })
    ).status
  ).toBe('missing')
  await symlink(outside, join(allowed, 'escape'), process.platform === 'win32' ? 'junction' : 'dir')
  expect(
    (
      await store.read({ ...ref, value: join(allowed, 'escape', 'secret') }, [allowed], {
        offset: 0,
        maxBytes: 64
      })
    ).status
  ).toBe('denied')
})

it('keeps a Korean character spanning the byte boundary intact across pages', async () => {
  const { allowed, store } = await fixture()
  const path = join(allowed, 'unicode.txt')
  const text = 'a'.repeat(65_535) + '한글'
  await writeFile(path, text)
  const ref = { id: 'o', field: 'output_file', value: path, kind: 'file' as const }
  const first = await store.read(ref, [allowed], { offset: 0, maxBytes: 65_536 })
  const second = await store.read(ref, [allowed], {
    offset: first.nextOffset,
    maxBytes: 65_536,
    cursor: first.cursor
  })
  expect((first.text ?? '') + (second.text ?? '') === text).toBe(true)
  expect(second.eof).toBe(true)
})

it('withholds a partial UTF-8 character at a growing file EOF until remaining bytes arrive', async () => {
  const { allowed, store } = await fixture()
  const path = join(allowed, 'growing.txt')
  const bytes = Buffer.from('가')
  await writeFile(path, bytes.subarray(0, 1))
  const ref = { id: 'o', field: 'output_file', value: path, kind: 'file' as const }
  const first = await store.read(ref, [allowed], { offset: 0, maxBytes: 64 })
  expect(first.text).toBe('')
  expect(first.nextOffset).toBe(0)
  expect(first.status).toBe('partial')
  await appendFile(path, bytes.subarray(1))
  const second = await store.read(ref, [allowed], {
    offset: first.nextOffset,
    maxBytes: 64,
    cursor: first.cursor
  })
  expect(second.text).toBe('가')
  expect(second.eof).toBe(true)
})

it('detects a replaced file even when the replacement has the same size', async () => {
  const { allowed, store } = await fixture()
  const path = join(allowed, 'replaced.txt')
  await writeFile(path, 'first')
  const ref = { id: 'o', field: 'output_file', value: path, kind: 'file' as const }
  const first = await store.read(ref, [allowed], { offset: 0, maxBytes: 2 })
  await rename(path, join(allowed, 'previous.txt'))
  await writeFile(path, 'other')
  expect(
    (
      await store.read(ref, [allowed], {
        offset: first.nextOffset,
        maxBytes: 64,
        cursor: first.cursor
      })
    ).status
  ).toBe('changed')
})

it('caps completed snapshots and hashes exactly the captured bytes', async () => {
  const { root, allowed, store } = await fixture()
  const path = join(allowed, 'large.txt')
  const bytes = Buffer.alloc(16 * 1024 * 1024 + 17, 'a')
  await writeFile(path, bytes)
  const snapshot = await store.capture(
    { id: 'o', field: 'output_file', value: path, kind: 'file' },
    [allowed]
  )
  const captured = await readFile(join(root, 'snapshots', snapshot.id))
  expect(snapshot.size).toBe(16 * 1024 * 1024)
  expect(captured.length).toBe(snapshot.size)
  expect(snapshot.partial).toBe(true)
  expect(snapshot.sha256).toBe(createHash('sha256').update(captured).digest('hex'))
  expect(
    (await store.readSnapshot(snapshot, { offset: snapshot.size - 4, maxBytes: 64 })).status
  ).toBe('partial')
})
