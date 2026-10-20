import { afterEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import { CLAUDE_HISTORY_MAX_BYTES, readClaudeNativeHistory } from './native-history'
import {
  HISTORY_SESSION_ID as sessionId,
  historyEntry,
  nativeHistoryFixture
} from './native-history.testfixture'

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, lstat: vi.fn(actual.lstat) }
})

const roots: string[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true })
})
async function fixture(): Promise<Awaited<ReturnType<typeof nativeHistoryFixture>>> {
  const fixture = await nativeHistoryFixture()
  roots.push(fixture.root)
  return fixture
}

describe('Claude native history reads', () => {
  it('reprojects a pre-command-display snapshot on restart without modifying native bytes', async () => {
    const f = await fixture()
    const text =
      '<command-message>superpowers:using-superpowers</command-message>\n' +
      '<command-name>/superpowers:using-superpowers</command-name>\n' +
      '<command-args>이 스킬이?</command-args>'
    await f.write([
      historyEntry('command', null, 'user', text),
      historyEntry('answer', 'command', 'assistant', [{ type: 'text', text: 'done' }])
    ])
    const before = await fs.readFile(f.file, 'utf8')
    const req = { sessionId, cwd: f.cwd, env: { CLAUDE_CONFIG_DIR: f.config } }
    const first = await readClaudeNativeHistory(req)
    if (first.status !== 'ready' || !first.cursor) throw new Error('expected ready history')
    const sourceKey = first.snapshot.sourceKey
    const checkpoint = { ...first.cursor.checkpoint }
    delete checkpoint.projectionVersion
    const previous = {
      cursor: { ...first.cursor, checkpoint },
      snapshot: {
        ...first.snapshot,
        sourceKey,
        messages: [
          { ...first.snapshot.messages[0], parts: [{ type: 'text' as const, text }] },
          first.snapshot.messages[1]
        ]
      }
    }
    const restored = await readClaudeNativeHistory({ ...req, previous })
    expect(restored.status).toBe('ready')
    if (restored.status !== 'ready') throw new Error('expected fresh projection')
    expect(restored.snapshot.sourceKey).toBe(sourceKey)
    expect(restored.snapshot.messages[0].parts).toEqual([
      { type: 'text', text: '/superpowers:using-superpowers 이 스킬이?' }
    ])
    expect(await fs.readFile(f.file, 'utf8')).toBe(before)
    expect(await readClaudeNativeHistory({ ...req, previous: restored })).toEqual({
      status: 'unchanged'
    })
  })

  it('reads the known ID in a native custom root, reflects external appends and never writes the source', async () => {
    const f = await fixture()
    const request = { sessionId, cwd: f.cwd, env: { CLAUDE_CONFIG_DIR: f.config } }
    const before = await fs.readFile(f.file, 'utf8')
    const stat = await fs.stat(f.file)
    const first = await readClaudeNativeHistory(request)
    expect(first.status).toBe('ready')
    expect(first.status === 'ready' && first.snapshot.messages[1].parts).toEqual([
      { type: 'text', text: 'native answer' }
    ])
    expect(await fs.readFile(f.file, 'utf8')).toBe(before)
    expect((await fs.stat(f.file)).mtimeMs).toBe(stat.mtimeMs)
    await fs.appendFile(
      f.file,
      [
        historyEntry('u2', 'assistant-1', 'user', 'from terminal'),
        historyEntry('a2', 'u2', 'assistant', [{ type: 'text', text: 'terminal answer' }])
      ]
        .map((entry) => JSON.stringify({ cwd: f.cwd, ...entry }))
        .join('\n') + '\n'
    )
    const next = await readClaudeNativeHistory(request)
    expect(next.status).toBe('ready')
    if (first.status !== 'ready' || next.status !== 'ready') throw new Error('expected snapshot')
    expect(first.snapshot.sourceKey).toMatch(/^claude:[a-f0-9]{64}$/)
    expect(first.snapshot.sourceKey).not.toContain(f.root)
    expect(next.snapshot.revision).not.toBe(first.snapshot.revision)
    expect(next.snapshot.messages.map((m) => m.id)).toEqual(['user-1', 'assistant-1', 'u2', 'a2'])
    expect(await readClaudeNativeHistory(request)).toEqual(next)
  })

  it('distinguishes an absent original from permission failures', async () => {
    const f = await fixture()
    const request = { sessionId, cwd: f.cwd, env: { CLAUDE_CONFIG_DIR: f.config } }
    const original = (await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises'))
      .lstat
    const nativeFile = await fs.realpath(f.file)
    let denied = false
    vi.spyOn(fs, 'lstat').mockImplementation(((
      target: Parameters<typeof fs.lstat>[0],
      ...args: unknown[]
    ) => {
      if (String(target) === nativeFile) {
        denied = true
        return Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' }))
      }
      return Reflect.apply(original, fs, [target, ...args])
    }) as typeof fs.lstat)
    expect((await readClaudeNativeHistory(request)).status).toBe('unavailable')
    expect(denied).toBe(true)
    vi.mocked(fs.lstat).mockImplementation(original)
    await fs.unlink(f.file)
    expect((await readClaudeNativeHistory(request)).status).toBe('missing')
  })

  it('does not read a different cwd or substitute an invalid ID', async () => {
    const f = await fixture()
    expect(
      (
        await readClaudeNativeHistory({
          sessionId: '../escape',
          cwd: f.cwd,
          env: { CLAUDE_CONFIG_DIR: f.config }
        })
      ).status
    ).toBe('unavailable')
    const other = path.join(f.root, 'other')
    await fs.mkdir(other)
    expect(
      (
        await readClaudeNativeHistory({
          sessionId,
          cwd: other,
          env: { CLAUDE_CONFIG_DIR: f.config }
        })
      ).status
    ).toBe('unavailable')
  })

  it('returns busy for stable unfinished inputs and a partially written last line', async () => {
    const f = await fixture()
    const request = { sessionId, cwd: f.cwd, env: { CLAUDE_CONFIG_DIR: f.config } }
    await f.write([historyEntry('u', null, 'user', 'unfinished')])
    expect((await readClaudeNativeHistory(request)).status).toBe('busy')
    await fs.appendFile(f.file, '{"type":"assistant"')
    expect((await readClaudeNativeHistory(request)).status).toBe('busy')
    await fs.appendFile(f.file, '\n')
    expect((await readClaudeNativeHistory(request)).status).toBe('unavailable')
  })

  it('uses prepared env over provider settings without modifying either', async () => {
    const f = await fixture()
    const env = { CLAUDE_CONFIG_DIR: f.config }
    const providerSettings = {
      providerKey: 'claude-fixture',
      provider: 'fixture',
      settings: { model: 'override', env: { CLAUDE_CONFIG_DIR: path.join(f.root, 'unused') } },
      sourceRevision: 'fixture'
    }
    expect(
      (await readClaudeNativeHistory({ sessionId, cwd: f.cwd, env, providerSettings })).status
    ).toBe('ready')
    expect(providerSettings.settings.model).toBe('override')
    expect(env).toEqual({ CLAUDE_CONFIG_DIR: f.config })
  })

  it('rejects oversized originals before allocating their content', async () => {
    const f = await fixture()
    await fs.truncate(f.file, CLAUDE_HISTORY_MAX_BYTES + 1)
    expect(
      (
        await readClaudeNativeHistory({
          sessionId,
          cwd: f.cwd,
          env: { CLAUDE_CONFIG_DIR: f.config }
        })
      ).status
    ).toBe('unavailable')
  })

  it('does not follow a project directory link outside the native source', async () => {
    const f = await fixture()
    const outside = path.join(f.root, 'outside')
    await fs.mkdir(outside)
    await fs.rename(f.file, path.join(outside, `${sessionId}.jsonl`))
    await fs.symlink(
      outside,
      path.join(f.config, 'projects', 'linked'),
      process.platform === 'win32' ? 'junction' : 'dir'
    )
    expect(
      (
        await readClaudeNativeHistory({
          sessionId,
          cwd: f.cwd,
          env: { CLAUDE_CONFIG_DIR: f.config }
        })
      ).status
    ).toBe('unavailable')
  })

  it.each([3, 4])(
    'does not replace a snapshot if its revision changes at read boundary %s',
    async (boundary) => {
      const f = await fixture()
      const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
      const nativeFile = await actual.realpath(f.file)
      let calls = 0
      vi.mocked(fs.lstat).mockImplementation((async (
        target: Parameters<typeof fs.lstat>[0],
        ...args: unknown[]
      ) => {
        const stat = await Reflect.apply(actual.lstat, actual, [target, ...args])
        if (String(target) === nativeFile && ++calls === boundary) stat.mtimeMs += 1
        return stat
      }) as typeof fs.lstat)
      expect(
        (
          await readClaudeNativeHistory({
            sessionId,
            cwd: f.cwd,
            env: { CLAUDE_CONFIG_DIR: f.config }
          })
        ).status
      ).toBe('busy')
      expect(calls).toBeGreaterThanOrEqual(boundary)
      vi.mocked(fs.lstat).mockImplementation(actual.lstat)
    }
  )
})

it('commits UTF-8 byte checkpoints, reuses complete prefixes and defers partial appends', async () => {
  const f = await fixture()
  const req = { sessionId, cwd: f.cwd, env: { CLAUDE_CONFIG_DIR: f.config } }
  const first = await readClaudeNativeHistory(req)
  if (first.status !== 'ready') throw new Error('snapshot required')
  expect(first.cursor?.checkpoint.offset).toBe((await fs.stat(f.file)).size)
  const previous = { snapshot: first.snapshot, cursor: first.cursor }
  expect(await readClaudeNativeHistory({ ...req, previous })).toEqual({ status: 'unchanged' })
  const tail =
    [
      historyEntry('u2', 'assistant-1', 'user', '한글 질문'),
      historyEntry('a2', 'u2', 'assistant', [{ type: 'text', text: '응답' }])
    ]
      .map((entry) => JSON.stringify({ cwd: f.cwd, ...entry }))
      .join('\n') + '\n'
  const bytes = Buffer.from(tail)
  const cut = bytes.indexOf(Buffer.from('한글')) + 1
  await fs.appendFile(f.file, bytes.subarray(0, cut))
  expect((await readClaudeNativeHistory({ ...req, previous })).status).toBe('busy')
  await fs.appendFile(f.file, bytes.subarray(cut))
  const next = await readClaudeNativeHistory({ ...req, previous })
  if (next.status !== 'ready') throw new Error('completed append required')
  expect(next.cursor?.checkpoint.offset).toBe((await fs.stat(f.file)).size)
  expect(next.snapshot.messages.map((m) => m.id)).toEqual(['user-1', 'assistant-1', 'u2', 'a2'])
  expect(next.snapshot.messages.at(-1)?.parts).toEqual([{ type: 'text', text: '응답' }])
})

it.each(['rewrite', 'truncate', 'replace', 'prefix-and-append'] as const)(
  'invalidates stale JSONL offsets after %s',
  async (kind) => {
    const f = await fixture()
    const req = { sessionId, cwd: f.cwd, env: { CLAUDE_CONFIG_DIR: f.config } }
    const first = await readClaudeNativeHistory(req)
    if (first.status !== 'ready') throw new Error('snapshot required')
    const original = await fs.readFile(f.file, 'utf8')
    let changed = original.replace('native answer', kind === 'truncate' ? 'short' : 'edited answer')
    if (kind === 'replace') await fs.unlink(f.file)
    if (kind === 'prefix-and-append')
      changed +=
        JSON.stringify({
          cwd: f.cwd,
          ...historyEntry('last', 'assistant-1', 'assistant', [{ type: 'text', text: 'extra' }])
        }) + '\n'
    await fs.writeFile(f.file, changed)
    const next = await readClaudeNativeHistory({
      ...req,
      previous: { snapshot: first.snapshot, cursor: first.cursor }
    })
    if (next.status !== 'ready') throw new Error('replacement required')
    expect(next.snapshot.revision).not.toBe(first.snapshot.revision)
    expect(next.cursor?.checkpoint.offset).toBe(Buffer.byteLength(changed))
    expect(JSON.stringify(next.snapshot.messages)).toContain(
      kind === 'truncate' ? 'short' : 'edited answer'
    )
  }
)
