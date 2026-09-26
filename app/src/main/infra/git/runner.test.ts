import { describe, expect, it, vi } from 'vitest'
import { runGit } from './runner'

describe('runGit', () => {
  it('passes git arguments without a shell and preserves the Git environment contract', async () => {
    const execFileImpl = vi.fn((_file, _args, _options, callback) => {
      callback(null, 'ok\n', '')
      return {} as never
    })

    await expect(
      runGit('/repo', ['status', '--porcelain'], {
        readOnly: true,
        resolveExecutable: async () => '/trusted/git',
        execFileImpl: execFileImpl as never
      })
    ).resolves.toMatchObject({ ok: true, stdout: 'ok\n' })

    expect(execFileImpl).toHaveBeenCalledOnce()
    const [file, args, options] = execFileImpl.mock.calls[0]
    expect(file).toBe('/trusted/git')
    expect(args).toEqual(['status', '--porcelain'])
    expect(options).toMatchObject({
      cwd: '/repo',
      windowsHide: true,
      env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' })
    })
    expect(options).not.toHaveProperty('shell')
  })

  it('does not spawn when git is unavailable and retries resolution on the next call', async () => {
    const execFileImpl = vi.fn((_file, _args, _options, callback) => {
      callback(null, 'ok', '')
      return {} as never
    })
    const resolveExecutable = vi.fn().mockResolvedValueOnce(null).mockResolvedValue('/trusted/git')
    const options = { execFileImpl: execFileImpl as never, resolveExecutable }
    expect(await runGit('/repo', [], options)).toMatchObject({ ok: false, unavailable: true })
    expect(execFileImpl).not.toHaveBeenCalled()
    expect(await runGit('/repo', [], options)).toMatchObject({ ok: true })
    expect(execFileImpl).toHaveBeenCalledOnce()
  })
})
