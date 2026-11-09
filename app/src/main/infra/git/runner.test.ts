import { describe, expect, it, vi } from 'vitest'
import { runGit } from './runner'

describe('runGit', () => {
  it('해석된 실행 파일과 호출 시점 환경을 실행부로 운반한다', async () => {
    const execFileImpl = vi.fn((_file, _args, _options, callback) => {
      callback(null, 'ok', '')
      return {} as never
    })
    const env = vi.fn(async (base) => ({
      ...base,
      HOME: 'resolved-home',
      MSYSTEM: 'MINGW64',
      Path: 'resolved-path'
    }))
    await runGit('/repo', ['status'], {
      resolveExecutable: async () => ({ file: 'actual-git', env }),
      execFileImpl: execFileImpl as never,
      readOnly: true
    })
    expect(env).toHaveBeenCalledWith(process.env)
    expect(execFileImpl.mock.calls[0].slice(0, 2)).toEqual(['actual-git', ['status']])
    expect(execFileImpl.mock.calls[0][2].env).toMatchObject({
      HOME: 'resolved-home',
      MSYSTEM: 'MINGW64',
      Path: 'resolved-path',
      GIT_TERMINAL_PROMPT: '0',
      GIT_OPTIONAL_LOCKS: '0'
    })
  })
  it('passes git arguments without a shell and preserves the Git environment contract', async () => {
    const execFileImpl = vi.fn((_file, _args, _options, callback) => {
      callback(null, 'ok\n', '')
      return {} as never
    })

    await expect(
      runGit('/repo', ['status', '--porcelain'], {
        readOnly: true,
        resolveExecutable: async () => ({
          file: '/trusted/git',
          env: async (base) => ({ ...base })
        }),
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
    const resolveExecutable = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        file: '/trusted/git',
        env: async (base: NodeJS.ProcessEnv) => ({ ...base })
      })
    const options = { execFileImpl: execFileImpl as never, resolveExecutable }
    expect(await runGit('/repo', [], options)).toMatchObject({ ok: false, unavailable: true })
    expect(execFileImpl).not.toHaveBeenCalled()
    expect(await runGit('/repo', [], options)).toMatchObject({ ok: true })
    expect(execFileImpl).toHaveBeenCalledOnce()
  })
})
