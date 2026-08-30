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

  it('격리를 끈 요청과 worktree 가 살아 있는 재개 세션은 원래 cwd를 그대로 통과시킨다 (AC19)', async () => {
    const prepare = vi.fn()
    const recoverMissingWorktree = vi.fn(async () => ({ kind: 'none' as const }))
    const common = {
      sourceCwd: '/repo/packages/web',
      firstPrompt: 'work',
      signal,
      adapter,
      providerSettings,
      env: {},
      worktrees: { prepare, recoverMissingWorktree }
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

  // AC12 · AC13 — 소실된 worktree 는 오류가 아니라 폴백이다. 이 pair 가 없으면 없는 경로가
  // 그대로 spawn 인자가 되고 SDK 가 그것을 libc 불일치로 오진한다.
  it('worktree 가 사라지면 source cwd 로 접고 통지한다 (AC12 · AC13 · AC17)', async () => {
    const prepare = vi.fn()
    const recoverMissingWorktree = vi.fn(async () => ({
      kind: 'recovered' as const,
      executionCwd: '/repo',
      lostWorktreeRoot: '/wt/repo-1234abcd/work-x'
    }))
    const onRecovered = vi.fn()

    await expect(
      prepareTurnWorktree({
        enabled: false,
        sessionId: 'session-1',
        sourceCwd: '/wt/repo-1234abcd/work-x',
        firstPrompt: 'work',
        signal,
        adapter,
        providerSettings,
        env: {},
        worktrees: { prepare, recoverMissingWorktree },
        onRecovered
      })
    ).resolves.toEqual({
      kind: 'recovered',
      executionCwd: '/repo',
      lostWorktreeRoot: '/wt/repo-1234abcd/work-x'
    })
    // 통지가 없으면 화면은 죽은 경로의 브랜치·diff 를 계속 보여준다.
    expect(onRecovered).toHaveBeenCalledWith({ sessionId: 'session-1', executionCwd: '/repo' })
    // 판정 입력은 세션이 잠근 실행 경로여야 한다 — 다른 경로를 보면 소실을 지나친다.
    expect(recoverMissingWorktree).toHaveBeenCalledWith({
      sessionId: 'session-1',
      executionCwd: '/wt/repo-1234abcd/work-x'
    })
  })

  it('원본 작업 경로마저 없으면 거부한다 — 폴백을 가장하지 않는다', async () => {
    const recoverMissingWorktree = vi.fn(async () => ({
      kind: 'unrecoverable' as const,
      lostWorktreeRoot: '/wt/gone'
    }))
    const onRecovered = vi.fn()

    const result = await prepareTurnWorktree({
      enabled: false,
      sessionId: 'session-1',
      sourceCwd: '/wt/gone',
      firstPrompt: 'work',
      signal,
      adapter,
      providerSettings,
      env: {},
      worktrees: { prepare: vi.fn(), recoverMissingWorktree },
      onRecovered
    })

    expect(result.kind).toBe('rejected')
    expect(onRecovered).not.toHaveBeenCalled()
  })

  // AC14 배선 — 폴백 사실이 respawn 판정까지 가야 살아 있는 채널이 내려간다. 이 단언이 없으면
  // 폴백은 turn.cwd 만 바꾸고 프로세스는 죽은 cwd 로 계속 돈다.
  it('폴백 여부를 runtime 확보에 전달한다 — 살아 있는 채널을 내리는 유일한 신호다 (AC14)', async () => {
    const recovered = vi.fn(async () => ({
      kind: 'recovered' as const,
      executionCwd: '/repo',
      lostWorktreeRoot: '/wt/gone'
    }))
    const none = vi.fn(async () => ({ kind: 'none' as const }))
    const acquireRuntime = vi.fn(async () => ({}))
    const base = {
      extraDirs: undefined,
      buildTurn: (cwd: string): { cwd: string } => ({ cwd }),
      acquireRuntime
    }
    const worktree = (
      recoverMissingWorktree: typeof none | typeof recovered
    ): Parameters<typeof prepareTurnExecution>[0]['worktree'] => ({
      enabled: false,
      sessionId: 'session-1',
      sourceCwd: '/repo',
      firstPrompt: 'work',
      signal,
      adapter,
      providerSettings,
      env: {},
      worktrees: { prepare: vi.fn(), recoverMissingWorktree }
    })

    await prepareTurnExecution({ ...base, worktree: worktree(recovered) })
    expect(acquireRuntime).toHaveBeenLastCalledWith({ cwd: '/repo' }, true)

    await prepareTurnExecution({ ...base, worktree: worktree(none) })
    expect(acquireRuntime).toHaveBeenLastCalledWith({ cwd: '/repo' }, false)
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
      worktrees: { prepare, recoverMissingWorktree: vi.fn(async () => ({ kind: 'none' as const })) }
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
        worktrees: {
          prepare,
          recoverMissingWorktree: vi.fn(async () => ({ kind: 'none' as const }))
        }
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
