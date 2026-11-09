import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chooseBranchName } from './naming'
import { listBranchRefs, validateBranchName } from '../../infra/git/repository'

vi.mock('../../infra/git/repository', () => ({
  validateBranchName: vi.fn(async (_root: string, branch: string) => !branch.includes('invalid')),
  listBranchRefs: vi.fn(async () => new Set(['refs/heads/work/fix-auth']))
}))

describe('chooseBranchName', () => {
  beforeEach(() => vi.clearAllMocks())
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

  it.each([0, 1, 12])('충돌 %i개도 목록 1회·형식 검사 1회다', async (count) => {
    const base = 'work/12345678'
    vi.mocked(listBranchRefs).mockResolvedValueOnce(
      new Set(
        Array.from({ length: count }, (_, i) => `refs/heads/${base}${i === 0 ? '' : '-' + (i + 1)}`)
      )
    )
    const result = await chooseBranchName({
      repoRoot: '/repo',
      worktreeId: '12345678-abcd',
      firstPrompt: ''
    })
    expect(result).toBe(count === 0 ? base : `${base}-${count + 1}`)
    expect(listBranchRefs).toHaveBeenCalledExactlyOnceWith('/repo', base, undefined)
    expect(validateBranchName).toHaveBeenCalledExactlyOnceWith('/repo', result, undefined)
  })

  it('디렉토리 잔여물은 건너뛰고 정확히 일치하는 ref만 충돌이다', async () => {
    vi.mocked(listBranchRefs).mockResolvedValueOnce(
      new Set(['refs/heads/work/12345678-other', 'refs/heads/work/12345678/sub'])
    )
    const dirTaken = vi.fn(async (branch: string) => branch === 'work/12345678')
    expect(
      await chooseBranchName({
        repoRoot: '/repo',
        worktreeId: '12345678-abcd',
        firstPrompt: '',
        dirTaken
      })
    ).toBe('work/12345678-2')
    expect(validateBranchName).toHaveBeenCalledTimes(1)
    expect(dirTaken.mock.calls).toEqual([['work/12345678'], ['work/12345678-2']])
  })

  it('형식 거부는 전체 id로 폴백하고 목록 실패는 기존 부재 판정처럼 처리한다', async () => {
    vi.mocked(validateBranchName).mockResolvedValueOnce(false)
    const input = { repoRoot: '/repo', worktreeId: '12345678-abcd', firstPrompt: '' }
    expect(await chooseBranchName(input)).toBe('work/12345678abcd')
    vi.mocked(listBranchRefs).mockResolvedValueOnce(null)
    expect(await chooseBranchName(input)).toBe('work/12345678')
    expect(listBranchRefs).toHaveBeenCalledTimes(2)
    expect(validateBranchName).toHaveBeenCalledTimes(2)
  })

  it('모든 후보가 차 있어도 전체 id 후보를 한 번 검증한다', async () => {
    const base = 'work/12345678'
    vi.mocked(listBranchRefs).mockResolvedValueOnce(
      new Set(
        Array.from({ length: 9_999 }, (_, i) => `refs/heads/${base}${i === 0 ? '' : '-' + (i + 1)}`)
      )
    )
    const input = { repoRoot: '/repo', worktreeId: '12345678-abcd', firstPrompt: '' }
    await expect(chooseBranchName(input)).resolves.toBe('work/12345678abcd')
    expect(listBranchRefs).toHaveBeenCalledExactlyOnceWith('/repo', base, undefined)
    expect(validateBranchName).toHaveBeenCalledExactlyOnceWith('/repo', 'work/12345678abcd', undefined)
  })
})
