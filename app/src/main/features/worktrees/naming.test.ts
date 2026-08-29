import { describe, expect, it, vi } from 'vitest'
import { chooseBranchName } from './naming'

vi.mock('../../infra/git/repository', () => ({
  validateBranchName: vi.fn(async (_root: string, branch: string) => !branch.includes('invalid')),
  branchExists: vi.fn(async (_root: string, branch: string) => branch === 'work/fix-auth')
}))

describe('chooseBranchName', () => {
  it('sanitizes completion output and suffixes a collision', async () => {
    await expect(
      chooseBranchName({
        repoRoot: '/repo',
        worktreeId: '12345678-0000-0000-0000-000000000000',
        firstPrompt: 'fix auth',
        complete: async () => ' Fix Auth! '
      })
    ).resolves.toBe('work/fix-auth-2')
  })

  it('falls back to the stable id when completion fails', async () => {
    await expect(
      chooseBranchName({
        repoRoot: '/repo',
        worktreeId: '12345678-0000-0000-0000-000000000000',
        firstPrompt: 'fix auth',
        complete: async () => {
          throw new Error('offline')
        }
      })
    ).resolves.toBe('work/12345678')
  })
})
