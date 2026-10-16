import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFile, rm } from 'node:fs/promises'
import { ClaudeAdapter } from './adapter'
import { HISTORY_SESSION_ID as sessionId, nativeHistoryFixture } from './native-history.testfixture'

const { query } = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('@anthropic-ai/claude-agent-sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@anthropic-ai/claude-agent-sdk')>()),
  query
}))
const roots: string[] = []
afterEach(async () => {
  vi.clearAllMocks()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

describe('ClaudeAdapter native history port', () => {
  it('reads the same native session through the production adapter without submitting a prompt', async () => {
    const f = await nativeHistoryFixture()
    roots.push(f.root)
    const original = await readFile(f.file, 'utf8')
    const result = await new ClaudeAdapter().readHistory({
      sessionId,
      cwd: f.cwd,
      env: { CLAUDE_CONFIG_DIR: f.config }
    })
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected native history')
    expect(result.snapshot.sessionId).toBe(sessionId)
    expect(result.snapshot.cwd).toBe(f.cwd)
    expect(result.snapshot.messages.map((message) => message.id)).toEqual(['user-1', 'assistant-1'])
    expect(query).not.toHaveBeenCalled()
    expect(await readFile(f.file, 'utf8')).toBe(original)
  })

  it('resumes the read native ID and cwd with runtime overrides and default native persistence', async () => {
    const f = await nativeHistoryFixture()
    roots.push(f.root)
    const original = await readFile(f.file, 'utf8')
    const adapter = new ClaudeAdapter()
    const env = { CLAUDE_CONFIG_DIR: f.config }
    expect((await adapter.readHistory({ sessionId, cwd: f.cwd, env })).status).toBe('ready')
    expect(query).not.toHaveBeenCalled()
    const close = vi.fn()
    query.mockReturnValue({ close, setPermissionMode: vi.fn(), interrupt: vi.fn() })
    const live = adapter.sendMessage({
      sessionId,
      cwd: f.cwd,
      text: 'explicit next input',
      env,
      model: 'orca-runtime-model',
      extensions: { skills: [], hooks: { normalized: {} } }
    })
    try {
      const options = query.mock.calls[0]?.[0].options
      expect(options).toMatchObject({
        resume: sessionId,
        cwd: f.cwd,
        model: 'orca-runtime-model',
        env: { CLAUDE_CONFIG_DIR: f.config }
      })
      expect(options.persistSession).not.toBe(false)
      expect(options).not.toHaveProperty('sessionStore')
      expect(options).not.toHaveProperty('forkSession')
      expect(await readFile(f.file, 'utf8')).toBe(original)
    } finally {
      live.close()
    }
    expect(close).toHaveBeenCalledOnce()
  })
})
