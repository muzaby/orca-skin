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
    vi.spyOn(fs, 'lstat').mockImplementation(((
      target: Parameters<typeof fs.lstat>[0],
      ...args: unknown[]
    ) => {
      if (String(target) === f.file)
        return Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' }))
      return Reflect.apply(original, fs, [target, ...args])
    }) as typeof fs.lstat)
    expect((await readClaudeNativeHistory(request)).status).toBe('unavailable')
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
      let calls = 0
      vi.mocked(fs.lstat).mockImplementation((async (
        target: Parameters<typeof fs.lstat>[0],
        ...args: unknown[]
      ) => {
        const stat = await Reflect.apply(actual.lstat, actual, [target, ...args])
        if (String(target) === f.file && ++calls === boundary) stat.mtimeMs += 1
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
      vi.mocked(fs.lstat).mockImplementation(actual.lstat)
    }
  )
})
