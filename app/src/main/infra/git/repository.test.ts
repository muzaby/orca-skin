import { describe, expect, it, vi } from 'vitest'
import { listBranchRefs } from './repository'

describe('listBranchRefs', () => {
  it('브랜치 목록은 full ref를 한 번에 읽고 실패를 구별한다', async () => {
    const read = vi.fn(async () => ({
      ok: true,
      stdout: 'refs/heads/work/a\nrefs/heads/work/a-2\n',
      stderr: '',
      code: null,
      aborted: false
    }))
    const gateway = { read } as unknown as import('./gateway').GitGateway
    expect(await listBranchRefs('/repo', 'work/a', gateway)).toEqual(
      new Set(['refs/heads/work/a', 'refs/heads/work/a-2'])
    )
    expect(read).toHaveBeenCalledExactlyOnceWith('/repo', [
      'for-each-ref',
      '--format=%(refname)',
      'refs/heads/work/a',
      'refs/heads/work/a-*'
    ])
    read.mockResolvedValueOnce({
      ok: false,
      stdout: '',
      stderr: 'failed',
      code: null,
      aborted: false
    })
    expect(await listBranchRefs('/repo', 'work/a', gateway)).toBeNull()
  })
})
