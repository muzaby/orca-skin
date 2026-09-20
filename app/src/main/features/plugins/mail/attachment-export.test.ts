import { mkdir, mkdtemp, readFile, realpath, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareTemporaryFilesPath } from '../../../infra/config/temp-path'
import { exportMailAttachment } from './attachment-export'

vi.mock('../../../infra/config/temp-path', () => ({ prepareTemporaryFilesPath: vi.fn() }))

const roots: string[] = []
afterEach(async () => {
  vi.mocked(prepareTemporaryFilesPath).mockReset()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

// 같은 디렉토리를 가리키지만 realpath 와 철자가 다른 경로를 만든다. Windows 러너의
// `C:\Users\RUNNER~1\...` 8.3 별칭과 같은 조건이다 — 자기 자신은 symlink 가 아니고
// 조상만 다른 철자를 갖는다.
async function aliasedDirectory(): Promise<{ alias: string; canonical: string }> {
  const real = await realpath(await mkdtemp(join(tmpdir(), 'orca-mail-real-')))
  const holder = await realpath(await mkdtemp(join(tmpdir(), 'orca-mail-alias-')))
  roots.push(real, holder)
  await symlink(real, join(holder, 'link'), 'junction')
  const alias = join(holder, 'link', 'exports')
  await mkdir(alias)
  return { alias, canonical: join(real, 'exports') }
}

describe('exportMailAttachment', () => {
  it('exports under a root whose spelling differs from its realpath', async () => {
    const { alias, canonical } = await aliasedDirectory()
    vi.mocked(prepareTemporaryFilesPath).mockResolvedValue(alias)

    const exported = await exportMailAttachment({}, 'account', 'report.bin', new Uint8Array([7, 9]))

    expect(exported.savedPath.startsWith(canonical)).toBe(true)
    expect(exported.filename).toBe('report.bin')
    expect(await readFile(exported.savedPath)).toEqual(Buffer.from([7, 9]))
    expect(prepareTemporaryFilesPath).toHaveBeenCalledTimes(1)
  })

  it('exports under an explicit root whose spelling differs from its realpath', async () => {
    const { alias, canonical } = await aliasedDirectory()

    const exported = await exportMailAttachment(
      { root: alias },
      'account',
      'report.bin',
      new Uint8Array([1])
    )

    expect(exported.savedPath.startsWith(canonical)).toBe(true)
    expect(prepareTemporaryFilesPath).not.toHaveBeenCalled()
  })
})
