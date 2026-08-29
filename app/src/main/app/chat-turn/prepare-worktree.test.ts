import { describe, expect, it, vi } from 'vitest'
import type { ResolvedHarnessSettings } from '../../adapters/harness-config'
import { prepareTurnExecution, prepareTurnWorktree } from './prepare-worktree'

const adapter = { complete: vi.fn() }
const signal = new AbortController().signal

describe('prepareTurnWorktree', () => {
  const providerSettings: ResolvedHarnessSettings = {
    providerKey: 'claude:test',
    provider: 'claude',
    settings: {},
    sourceRevision: 'test-revision'
  }

  it('격리를 끈 요청과 재개 세션은 원래 cwd를 그대로 통과시킨다', async () => {
    const prepare = vi.fn()
    const common = {
      sourceCwd: '/repo/packages/web',
      firstPrompt: 'work',
      signal,
      adapter,
      providerSettings,
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
      providerSettings,
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

  it('준비 완료 뒤에만 runtime을 확보하고 managed cwd와 원래 extraDirs를 전달한다', async () => {
    let finish!: (value: { kind: 'managed'; worktreeId: string; executionCwd: string }) => void
    const prepare = vi.fn(
      () =>
        new Promise<{ kind: 'managed'; worktreeId: string; executionCwd: string }>((resolve) => {
          finish = resolve
        })
    )
    const buildTurn = vi.fn((cwd: string, extraDirs: readonly string[] | undefined) => ({
      cwd,
      extraDirs
    }))
    const acquireRuntime = vi.fn(async (turn: { cwd: string; extraDirs?: readonly string[] }) => ({
      request: { cwd: turn.cwd, extraDirs: turn.extraDirs }
    }))
    const result = prepareTurnExecution({
      worktree: {
        enabled: true,
        sourceCwd: '/repo',
        firstPrompt: 'work',
        signal,
        adapter,
        providerSettings,
        env: {},
        worktrees: { prepare }
      },
      extraDirs: ['/shared'],
      buildTurn,
      acquireRuntime
    })

    await Promise.resolve()
    expect(buildTurn).not.toHaveBeenCalled()
    expect(acquireRuntime).not.toHaveBeenCalled()

    finish({ kind: 'managed', worktreeId: 'w1', executionCwd: '/managed/repo' })
    await expect(result).resolves.toEqual({
      kind: 'ready',
      turn: { cwd: '/managed/repo', extraDirs: ['/shared'] },
      entry: { request: { cwd: '/managed/repo', extraDirs: ['/shared'] } }
    })
    expect(buildTurn).toHaveBeenCalledWith('/managed/repo', ['/shared'])
    expect(acquireRuntime).toHaveBeenCalledOnce()
  })
})
