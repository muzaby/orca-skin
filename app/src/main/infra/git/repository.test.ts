import { mkdtemp, mkdir, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { execGit as exec, removeTempRoots } from './temp-repo.testfixture'
import { resolveHead, resolveHeadRef, resolveRepoRoot } from './repository'

// **파일 예산 72s** — 최악 케이스(detached HEAD)는 실제 git 을 직렬로 8회 띄운다
// (`repo()` 3 + `commit()` 3 + checkout 1 + `resolveHead*` 1). self-hosted windows 러너의 실측 spawn 은 약 6s 로
// 레포 기준(약 2s)의 3배라, 상한을 8 × 6s × 1.5(여유) = 72s 로 잡는다. 글로벌 20s
// (`vitest.config.ts`)는 그대로 두고 **이 파일만** 넓힌다. 훅도 같은 값이다 — 기본 10s 는
// 실제 저장소를 만드는 훅을 담지 못하고, 끊긴 훅은 고아를 남겨 정리까지 함께 무너뜨린다.
vi.setConfig({ testTimeout: 72_000, hookTimeout: 72_000 })

const roots: string[] = []
// 정리는 `removeTempRoots` 하나로 모은다 — `rm` 을 직접 부르면 끊긴 케이스가 남긴 고아 git
// 자식을 그대로 밟아 EBUSY/EPERM 이 난다(픽스처 주석 참고).
afterEach(() => removeTempRoots(roots.splice(0)))

describe('resolveRepoRoot', () => {
  it('canonicalizes the root returned from a nested repository cwd', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-repository-test-'))
    roots.push(root)
    await exec('git', ['init', root])
    const nested = join(root, 'packages', 'web')
    await mkdir(nested, { recursive: true })
    expect(await resolveRepoRoot(nested)).toBe(await realpath(root))
  })
})

// 0211 ΔV4 r2 — §10 EP-28 ② 의 **이름 생산자**. r1 검증에서 이 함수를 상수로 바꿔도
// 924케이스가 전건 green 이었다(D2): 호출부는 전부 mock 이라 판정 자체를 본 적이 없었다.
//
// `symbolic-ref` 를 고른 이유가 여기서 관측된다 — unborn 브랜치는 `rev-parse --abbrev-ref`
// 가 실패하는 자리이고, detached 는 이름이 **없는** 상태라 sha 로 위장하면 안 된다(D-070·D-071).
describe('resolveHeadRef (0211 ΔV4 · AT-44 · EP-28 ②)', () => {
  async function repo(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'orca-headref-test-'))
    roots.push(root)
    await exec('git', ['init', '--initial-branch=main', root])
    await exec('git', ['-C', root, 'config', 'user.email', 'test@orca.local'])
    await exec('git', ['-C', root, 'config', 'user.name', 'Orca Test'])
    return root
  }

  async function commit(root: string, name: string): Promise<string> {
    await writeFile(join(root, name), `${name}\n`)
    await exec('git', ['-C', root, 'add', name])
    await exec('git', ['-C', root, 'commit', '-m', name])
    return (await exec('git', ['-C', root, 'rev-parse', 'HEAD'])).stdout.trim()
  }

  it('브랜치 위에서는 그 브랜치 이름이다', async () => {
    const root = await repo()
    await commit(root, 'a.txt')
    await exec('git', ['-C', root, 'checkout', '-b', 'feature/one'])

    expect(await resolveHeadRef(root)).toBe('feature/one')
  })

  it('커밋이 하나도 없는 unborn 브랜치에서도 이름을 준다', async () => {
    const root = await repo()

    expect(await resolveHeadRef(root)).toBe('main')
    // 이 자리가 `symbolic-ref` 를 고른 이유다 — 같은 상태에서 abbrev-ref 는 답을 못 준다.
    expect(await resolveHead(root)).toBeNull()
  })

  it('detached HEAD 는 null 이다 — sha 를 이름인 척 돌려주지 않는다', async () => {
    const root = await repo()
    const oid = await commit(root, 'a.txt')
    await exec('git', ['-C', root, 'checkout', '--detach', oid])

    expect(await resolveHeadRef(root)).toBeNull()
    // 커밋은 여전히 안다 — 라벨이 sha 7자로 접히는 상태(D-071)의 입력이 이 조합이다.
    expect(await resolveHead(root)).toBe(oid)
  })

  it('저장소가 아니면 null 이다', async () => {
    const plain = await mkdtemp(join(tmpdir(), 'orca-headref-plain-'))
    roots.push(plain)

    expect(await resolveHeadRef(plain)).toBeNull()
  })
})
