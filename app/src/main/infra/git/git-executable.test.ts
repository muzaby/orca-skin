import { describe, expect, it, vi } from 'vitest'
import { resolveGitCommand, resolveGitExecutable } from './git-executable'

describe('resolveGitExecutable', () => {
  it.each([
    {
      platform: 'linux' as const,
      env: { PATH: '.::relative:/trusted:/later' },
      want: '/trusted/git'
    },
    {
      platform: 'win32' as const,
      env: { Path: '.;;relative;C:relative;C:\\trusted;D:\\later' },
      want: 'C:\\trusted\\git.exe'
    }
  ])('ignores cwd-dependent PATH entries on $platform', async ({ platform, env, want }) => {
    const isFile = vi.fn(async () => true)
    expect(await resolveGitExecutable({ platform, env, isFile })).toBe(want)
    expect(isFile.mock.calls).toEqual([[want]])
  })

  it('checks later absolute entries and does not retain a negative lookup', async () => {
    const env = { PATH: '/missing:/trusted' }
    const isFile = vi.fn(async () => false)
    expect(await resolveGitExecutable({ env, platform: 'linux', isFile })).toBeNull()
    isFile.mockImplementation(async (path?: string) => path === '/trusted/git')
    expect(await resolveGitExecutable({ env, platform: 'linux', isFile })).toBe('/trusted/git')
  })
})

describe('resolveGitCommand — EP-02', () => {
  it('R1·R3 — 우회 조건이 아니면 실제 파일 후보가 있어도 env를 바꾸지 않는다', async () => {
    for (const [platform, env, expected] of [
      ['linux', { PATH: '/usr/cmd' }, '/usr/cmd/git'],
      ['win32', { Path: 'C:\\Tools' }, 'C:\\Tools\\git.exe']
    ] as const) {
      const isFile = vi.fn(async () => true)
      const command = await resolveGitCommand({ platform, env, isFile })
      expect(command?.file).toBe(expected)
      expect(await command?.env({ MSYSTEM: 'keep', HOME: 'keep', PATH: 'keep' })).toEqual({
        MSYSTEM: 'keep',
        HOME: 'keep',
        PATH: 'keep'
      })
      expect(isFile.mock.calls).toEqual([[expected]])
    }
  })

  it('기본 fs 경로도 실제 파일·디렉토리·config를 읽고 부재 시 폴백한다', async () => {
    vi.resetModules()
    const stat = vi.fn(
      async (): Promise<{ isFile: () => boolean; isDirectory: () => boolean }> => ({
        isFile: () => true,
        isDirectory: () => true
      })
    )
    const readFile = vi.fn(async () => 'MSYS=config\n')
    vi.doMock('node:fs/promises', () => ({ stat, readFile, access: vi.fn() }))
    try {
      const { resolveGitCommand } = await import('./git-executable')
      const top = 'C:\\Git'
      const command = (await resolveGitCommand({
        platform: 'win32',
        env: { Path: `${top}\\cmd` }
      }))!
      expect(command.file).toBe(`${top}\\mingw64\\bin\\git.exe`)
      expect(
        await command.env({ HOMEDRIVE: 'D:', HOMEPATH: '\\roaming', USERPROFILE: 'D:\\profile' })
      ).toMatchObject({ HOME: 'D:\\roaming', MSYS: 'config' })
      expect(readFile).toHaveBeenCalledWith(`${top}\\etc\\git-bash.config`, 'utf8')
      stat.mockRejectedValueOnce(new Error('absent directory'))
      expect(
        (await command.env({ HOMEDRIVE: 'D:', HOMEPATH: '\\missing', USERPROFILE: 'D:\\profile' }))
          .HOME
      ).toBe('D:\\profile')
      stat.mockResolvedValue({ isFile: () => false, isDirectory: () => false })
      expect(
        (await command.env({ HOMEDRIVE: 'D:', HOMEPATH: '\\not-dir', USERPROFILE: 'D:\\profile' }))
          .HOME
      ).toBe('D:\\profile')
      stat.mockImplementation(async (file?: string) => {
        if (file?.endsWith('cmd\\git.exe')) return { isFile: () => true, isDirectory: () => false }
        throw new Error('absent actual git')
      })
      expect(
        (await resolveGitCommand({ platform: 'win32', env: { Path: `${top}\\cmd` } }))?.file
      ).toBe(`${top}\\cmd\\git.exe`)
    } finally {
      vi.doUnmock('node:fs/promises')
      vi.resetModules()
    }
  })

  it.each(['SystemRoot', 'SYSTEMROOT', 'WINDIR'])(
    'R9 — %s 시스템 경로와 HOMEPATH 없는 드라이브를 홈으로 고르지 않는다',
    async (key) => {
      const command = (await resolve({ isDirectory: async () => true }))!
      expect(
        (
          await command.env({
            [key]: 'E:\\WINNT',
            HOMEDRIVE: 'E:',
            HOMEPATH: '\\WINNT\\system32',
            USERPROFILE: 'D:\\profile'
          })
        ).HOME
      ).toBe('D:\\profile')
      expect((await command.env({ HOMEDRIVE: 'D:', USERPROFILE: 'D:\\profile' })).HOME).toBe(
        'D:\\profile'
      )
    }
  )
  it('캐시는 진행 중 탐색만 공유하고 부재 뒤 재탐색한다', async () => {
    vi.resetModules()
    const stat = vi.fn(async (): Promise<{ isFile: () => boolean }> => ({ isFile: () => false }))
    vi.doMock('node:fs/promises', () => ({ stat, access: vi.fn(), readFile: vi.fn() }))
    const path = process.platform === 'win32' ? 'C:\\trusted' : '/trusted'
    vi.stubEnv('PATH', path)
    if (process.platform === 'win32') vi.stubEnv('Path', path)
    try {
      const { gitCommand } = await import('./git-executable')
      const first = gitCommand()
      expect(gitCommand()).toBe(first)
      expect(await first).toBeNull()
      stat.mockResolvedValue({ isFile: () => true })
      const found = await gitCommand()
      expect(found?.file).toBe(path + (process.platform === 'win32' ? '\\git.exe' : '/git'))
      expect(await gitCommand()).toBe(found)
      expect(stat).toHaveBeenCalledTimes(2)
    } finally {
      vi.doUnmock('node:fs/promises')
      vi.unstubAllEnvs()
      vi.resetModules()
    }
  })
  const top = 'C:\\Program Files\\Git'
  const launcher = `${top}\\cmd\\git.exe`
  const resolve = (
    extra: Parameters<typeof resolveGitCommand>[0] = {},
    files = [launcher, `${top}\\mingw64\\bin\\git.exe`]
  ): ReturnType<typeof resolveGitCommand> =>
    resolveGitCommand({
      platform: 'win32',
      env: { Path: `${top}\\cmd` },
      isFile: async (path) => files.some((file) => file.toLowerCase() === path.toLowerCase()),
      isDirectory: async () => false,
      readFile: async () => {
        throw Error('missing')
      },
      ...extra
    })

  it('R1·R2·R3·R7 — 변경 없는 경로와 git 부재', async () => {
    for (const [platform, env, file] of [
      ['linux', { PATH: '/usr/bin' }, '/usr/bin/git'],
      ['win32', { Path: 'C:\\Tools' }, 'C:\\Tools\\git.exe'],
      ['win32', { Path: `${top}\\cmd` }, launcher]
    ] as const) {
      const command = await resolve({ platform, env }, [file])
      expect(command?.file).toBe(file)
      expect(await command?.env({ HOME: 'own', PATH: 'original', MSYSTEM: 'original' })).toEqual({
        HOME: 'own',
        PATH: 'original',
        MSYSTEM: 'original'
      })
    }
    expect(await resolve({ env: {} })).toBeNull()
  })

  it.each(['cmd', 'bIn'])('R4·R5 — %s 런처와 혼합 대소문자', async (parent) => {
    const command = await resolve({ env: { Path: `${top}\\${parent}` } }, [
      `${top}\\${parent}\\git.exe`,
      `${top}\\mingw64\\bin\\git.exe`
    ])
    expect(command?.file).toBe(`${top}\\mingw64\\bin\\git.exe`)
    expect((await command?.env({ MSYSTEM: 'old' }))?.MSYSTEM).toBe('MINGW64')
  })

  it.each(['mingw64', 'clangarm64', 'ucrt64', 'mingw32'])(
    'R6 — %s와 뒤 후보 사이의 우선순위',
    async (msys) => {
      const candidates = ['mingw64', 'clangarm64', 'ucrt64', 'mingw32']
      const command = await resolve({}, [
        launcher,
        ...candidates.slice(candidates.indexOf(msys)).map((name) => `${top}\\${name}\\bin\\git.exe`)
      ])
      expect(command?.file).toBe(`${top}\\${msys}\\bin\\git.exe`)
      expect((await command?.env({}))?.MSYSTEM).toBe(msys.toUpperCase())
    }
  )

  it('R8·R9 — HOME·PLINK 유지, 드라이브 홈·시스템 디렉토리·프로필·부재', async () => {
    const command = (await resolve({ isDirectory: async (path) => path !== 'D:\\missing' }))!
    for (const [base, home, plink] of [
      [{ HOME: 'D:\\own', PLINK_PROTOCOL: 'custom' }, 'D:\\own', 'custom'],
      [
        { HOMEDRIVE: 'D:', HOMEPATH: '\\roaming', USERPROFILE: 'D:\\profile' },
        'D:\\roaming',
        'ssh'
      ],
      [
        { HOMEDRIVE: 'C:', HOMEPATH: '\\Windows\\system32', USERPROFILE: 'D:\\profile' },
        'D:\\profile',
        'ssh'
      ],
      [
        { HOMEDRIVE: 'D:', HOMEPATH: '\\missing', USERPROFILE: 'D:\\profile' },
        'D:\\profile',
        'ssh'
      ],
      [{ USERPROFILE: 'D:\\profile' }, 'D:\\profile', 'ssh'],
      [{}, undefined, 'ssh']
    ] as const) {
      const env = await command.env(base)
      expect(env.HOME).toBe(home)
      expect(env.PLINK_PROTOCOL).toBe(plink)
      expect(base).not.toHaveProperty('MSYSTEM')
    }
  })

  it('R10 — Path 키·HOME 길이·MSYS config·호출 시점 환경', async () => {
    const readFile = vi.fn(async () => 'OTHER=ignored\r\nMSYS=enable_pcon\r\n')
    const command = (await resolve({ readFile }))!
    const env = await command.env({ Path: 'original', HOME: 'D:\\home', MSYS: 'old' })
    expect(env.Path).toBe(`${top}\\mingw64\\bin;${top}\\usr\\bin;D:\\home\\bin;original`)
    expect(env).not.toHaveProperty('PATH')
    expect(env.MSYS).toBe('enable_pcon old')
    expect(readFile).toHaveBeenCalledWith(`${top}\\etc\\git-bash.config`)
    expect((await command.env({ PATH: 'later', HOME: 'x'.repeat(254) })).PATH).toBe(
      `${top}\\mingw64\\bin;${top}\\usr\\bin;later`
    )
    const missing = (await resolve())!
    expect((await missing.env({ HOME: 'y'.repeat(253) })).PATH).toBe(
      `${top}\\mingw64\\bin;${top}\\usr\\bin;${'y'.repeat(253)}\\bin;`
    )
    expect((await missing.env({ MSYS: 'keep' })).MSYS).toBe('keep')
    expect((await command.env({})).MSYS).toBe('enable_pcon')
  })
})
