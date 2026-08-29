import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { prepareTurnWorktree } from './prepare-worktree'

const adapter = { complete: vi.fn() }
const signal = new AbortController().signal

describe('prepareTurnWorktree', () => {
  it('send pipeline은 worktree 준비 뒤에 TurnContext를 만들고 extraDirs를 바꾸지 않는다', async () => {
    const source = await readFile(new URL('./send.ts', import.meta.url), 'utf8')
    const prepareAt = source.indexOf('await prepareTurnWorktree({')
    const contextAt = source.indexOf('buildTurnContext<WebContents>({')

    expect(prepareAt).toBeGreaterThan(0)
    expect(contextAt).toBeGreaterThan(prepareAt)
    expect(source).toContain('cwd: executionCwd')
    expect(source).toContain('extraDirs: payload.extraDirs')
  })

  it('격리를 끈 요청과 재개 세션은 원래 cwd를 그대로 통과시킨다', async () => {
    const prepare = vi.fn()
    const common = {
      sourceCwd: '/repo/packages/web',
      firstPrompt: 'work',
      signal,
      adapter,
      providerSettings: {},
      env: {},
      worktrees: { prepare }
    }

    await expect(prepareTurnWorktree({ ...common, enabled: false })).resolves.toEqual({
      kind: 'passthrough',
      executionCwd: '/repo/packages/web'
    })
    await expect(
      prepareTurnWorktree({ ...common, enabled: true, sessionId: 'session-1' })
    ).resolves.toEqual({ kind: 'passthrough', executionCwd: '/repo/packages/web' })
    expect(prepare).not.toHaveBeenCalled()
  })

  it('준비가 끝날 때까지 기다린 뒤 managed cwd를 반환한다', async () => {
    let finish!: (value: { kind: 'managed'; worktreeId: string; executionCwd: string }) => void
    const prepare = vi.fn(
      () =>
        new Promise<{ kind: 'managed'; worktreeId: string; executionCwd: string }>((resolve) => {
          finish = resolve
        })
    )
    let settled = false
    const result = prepareTurnWorktree({
      enabled: true,
      sourceCwd: '/repo',
      firstPrompt: 'work',
      signal,
      adapter,
      providerSettings: { model: 'test' },
      env: { TOKEN: 'redacted' },
      worktrees: { prepare }
    }).then((value) => {
      settled = true
      return value
    })

    await Promise.resolve()
    expect(settled).toBe(false)
    finish({ kind: 'managed', worktreeId: 'w1', executionCwd: '/managed/repo' })
    await expect(result).resolves.toEqual({
      kind: 'managed',
      worktreeId: 'w1',
      executionCwd: '/managed/repo'
    })
    expect(prepare).toHaveBeenCalledWith(
      expect.objectContaining({ sourceCwd: '/repo', firstPrompt: 'work', signal })
    )
  })
})
