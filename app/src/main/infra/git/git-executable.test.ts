import { describe, expect, it, vi } from 'vitest'
import { resolveGitExecutable } from './git-executable'

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
