import { describe, expect, it } from 'vitest'
import { githubRepositoryUrl } from './github-url'

describe('GitHub origin URL for browser navigation', () => {
  it.each([
    'https://github.com/owner/repo.git',
    'git@github.com:owner/repo.git',
    'ssh://git@github.com/owner/repo.git',
    'ssh://git@GITHUB.com/owner/repo.git',
    'ssh://git@github.com:22/owner/repo.git',
    'https://github.com/owner/repo/',
    'https://token:password@github.com/owner/repo.git?secret=discard#fragment',
    '  https://GITHUB.com/owner/repo.git\n'
  ])('normalizes %s without forwarding credentials', (remote) => {
    expect(githubRepositoryUrl(remote)).toBe('https://github.com/owner/repo')
  })

  it.each([
    ['https://github.company.com/owner/repo.git', 'https://github.company.com/owner/repo'],
    ['https://company.github.com/owner/repo.git', 'https://company.github.com/owner/repo'],
    ['git@company.github.com:owner/repo.git', 'https://company.github.com/owner/repo'],
    ['ssh://git@company.github.com/owner/repo.git', 'https://company.github.com/owner/repo'],
    ['git@github.company.com:owner/repo.git', 'https://github.company.com/owner/repo'],
    ['github.company.com:owner/repo.git', 'https://github.company.com/owner/repo'],
    ['ssh://git@GITHUB.company.com:22/owner/repo.git', 'https://github.company.com/owner/repo'],
    ['git@GITHUB.company.com:owner/repo.git', 'https://github.company.com/owner/repo'],
    ['https://company-github.example/owner/repo', 'https://company-github.example/owner/repo'],
    ['https://github.com.company.test/owner/repo', 'https://github.com.company.test/owner/repo'],
    [
      'https://token:password@github.company.com/owner/repo.git?secret=discard#fragment',
      'https://github.company.com/owner/repo'
    ]
  ])('preserves the Enterprise hostname when normalizing %s', (remote, expected) => {
    expect(githubRepositoryUrl(remote)).toBe(expected)
  })

  it.each([
    '',
    '/local/repo',
    'file:///local/repo',
    'https://gitlab.com/owner/repo.git',
    'https://github.com@evil.test/owner/repo.git',
    'https://git.company.com/github/repo.git',
    'github@git.company.com:owner/repo.git',
    'https://git.company.com/owner/repo?host=github.company.com',
    'git@github.company.com#other.test:owner/repo.git',
    'git@github.company.com%2fother.test:owner/repo.git',
    'javascript:alert(1)',
    'https://github.com/owner',
    'https://github.com/owner/repo/extra',
    'https://github.com/owner/%2Frepo',
    'https://github.com/owner/.git',
    'https://github.com:8443/owner/repo',
    'git@alias:owner/repo.git',
    'https://github.com/owner/repo.git\nhttps://github.com/other/repo'
  ])('leaves unsupported or malformed remotes unavailable: %s', (remote) => {
    expect(githubRepositoryUrl(remote)).toBeNull()
  })
})
