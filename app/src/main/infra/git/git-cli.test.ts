// git 실행부 통합 테스트 — **실제 저장소**를 임시 디렉토리에 세우고 돌린다.
//
// 파괴적 동작 3종(stash·commit -a·reset --hard)이 전부 이 파일에 있고 순수 파서 쪽에는
// 없으므로, 여기에 테스트가 없으면 "사용자 작업 트리를 무엇으로 건드리는가" 를 아무도 잠그지
// 않는다. `git-cli` 는 electron 비의존(`node:child_process` + `node:fs/promises`)이라 vitest
// 에서 그대로 돈다.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { removeTempRoots } from './temp-repo.testfixture'
import { gitBranches, gitCheckout, gitStatus } from './git-cli'

// **파일 예산 369s** — 최악 케이스(origin 주소 정규화)는 실제 git 을 41회 띄운다
// (`makeRepo` 7 + `gitStatus` 7회 28 + remote·worktree 조작 6). `gitStatus` 는 한 번에 4개를
// 띄우고 그중 셋만 병렬이라, 러너 부하에서는 병렬분도 결국 같은 CPU 를 나눠 쓴다 — 그래서
// **직렬 가정으로 센다**. self-hosted windows 러너의 실측 spawn 은 약 6s 로 레포 기준(약 2s)의
// 3배라, 상한을 41 × 6s × 1.5(여유) = 369s 로 잡는다. 글로벌 20s(`vitest.config.ts`)는 그대로
// 두고 **이 파일만** 넓힌다.
//
// 케이스별 인라인 캡(옛 30s)은 두지 않는다 — 인라인 값이 더 작으면 파일 예산을 조용히 이겨
// 예산을 건 의미가 사라진다(0218 에서 `service.test.ts` 가 198s 예산에 30s 캡으로 죽었다).
// `scripts/check-test-budgets.mjs` 가 이 두 규칙을 게이트로 잡는다.
vi.setConfig({ testTimeout: 369_000, hookTimeout: 369_000 })

const roots: string[] = []

// 정리는 `removeTempRoots` 하나로 모은다 — `rm` 을 직접 부르면 끊긴 케이스가 남긴 고아 git
// 자식을 그대로 밟아 EBUSY/EPERM 이 난다(픽스처 주석 참고).
afterEach(() => removeTempRoots(roots.splice(0)))

function git(cwd: string, ...args: string[]): string {
  return String(execFileSync('git', args, { cwd, encoding: 'utf8' }))
}

// 커밋 1개 + 브랜치 2개(main·feature)를 가진 저장소. 사용자 전역 설정에 기대지 않도록
// identity 는 로컬에 박는다.
function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'orca-git-'))
  roots.push(root)
  git(root, 'init', '-b', 'main')
  git(root, 'config', 'user.email', 'test@orca.local')
  git(root, 'config', 'user.name', 'Orca Test')
  // 러너의 전역 `core.autocrlf=true` 를 이 저장소에서만 끈다. 켜져 있으면 LF 로 쓴 픽스처가
  // 커밋될 때 CRLF 로 바뀌어 내용·줄 수가 기대와 어긋나고, 매 `add` 마다 "LF will be replaced
  // by CRLF" 경고가 출력을 덮는다. 테스트가 보는 것은 개행 정책이 아니다.
  git(root, 'config', 'core.autocrlf', 'false')
  writeFileSync(join(root, 'tracked.txt'), 'v1\n')
  git(root, 'add', 'tracked.txt')
  git(root, 'commit', '-m', 'init')
  git(root, 'branch', 'feature')
  return root
}

function porcelain(cwd: string): string {
  return git(cwd, 'status', '--porcelain')
}

function dirty(cwd: string): void {
  writeFileSync(join(cwd, 'tracked.txt'), 'v2\n')
}

describe('gitStatus / gitBranches', () => {
  it('origin 주소를 웹 URL로 정규화하고 원격 변경·worktree에서도 현재 값을 읽는다', async () => {
    const repo = makeRepo()
    expect((await gitStatus(repo)).githubUrl).toBeNull()
    git(repo, 'remote', 'add', 'origin', 'git@github.com:owner/repo.git')
    expect((await gitStatus(repo)).githubUrl).toBe('https://github.com/owner/repo')
    const worktree = join(repo, 'review-worktree')
    git(repo, 'worktree', 'add', '-b', 'review', worktree)
    expect(await gitStatus(worktree)).toMatchObject({
      branch: 'review',
      githubUrl: 'https://github.com/owner/repo'
    })
    git(repo, 'remote', 'set-url', 'origin', 'https://user:password@github.com/owner/renamed.git')
    expect((await gitStatus(repo)).githubUrl).toBe('https://github.com/owner/renamed')
    git(repo, 'remote', 'set-url', 'origin', 'git@github.company.com:owner/enterprise.git')
    expect((await gitStatus(worktree)).githubUrl).toBe(
      'https://github.company.com/owner/enterprise'
    )
    git(
      repo,
      'remote',
      'set-url',
      'origin',
      'https://user:password@github.company.com/owner/next.git'
    )
    expect((await gitStatus(repo)).githubUrl).toBe('https://github.company.com/owner/next')
    git(repo, 'remote', 'remove', 'origin')
    expect((await gitStatus(repo)).githubUrl).toBeNull()
  })

  it('저장소가 아니면 isRepo:false 이고 브랜치도 비운다', async () => {
    const plain = mkdtempSync(join(tmpdir(), 'orca-plain-'))
    roots.push(plain)
    expect(await gitStatus(plain)).toEqual({
      isRepo: false,
      branch: null,
      detached: false,
      root: null,
      githubUrl: null
    })
    expect(await gitBranches(plain)).toEqual({ current: null, branches: [] })
  })

  // 0211 ΔV1 D-027 — 표시 소비자가 사라졌고 checkout 은 자기 stat 을 부른다.
  it('상태에 dirty 축이 없다 — 변경량 정본은 diff 요약이다 (AT-19)', async () => {
    const repo = await makeRepo()
    dirty(repo)
    const status = await gitStatus(repo)
    expect(Object.hasOwn(status, 'dirty')).toBe(false)
    // 양성 짝 — 나머지 축은 그대로 산다.
    expect(status).toMatchObject({ isRepo: true, branch: 'main', detached: false })
  })

  it('detached HEAD 면 branch=null · detached=true 다', async () => {
    const repo = makeRepo()
    git(repo, 'checkout', '--detach', 'HEAD')
    const status = await gitStatus(repo)
    expect(status.isRepo).toBe(true)
    expect(status.branch).toBeNull()
    expect(status.detached).toBe(true)
  })
})

describe('gitCheckout — 깨끗한 트리 (AC3)', () => {
  it('실제 checkout 이 일어나고 이후 gitStatus 가 대상 브랜치를 돌려준다', async () => {
    const repo = makeRepo()
    expect((await gitStatus(repo)).branch).toBe('main')

    const result = await gitCheckout(repo, 'feature')

    expect(result).toEqual({ ok: true, branch: 'feature' })
    expect((await gitStatus(repo)).branch).toBe('feature')
    expect(git(repo, 'rev-parse', '--abbrev-ref', 'HEAD').trim()).toBe('feature')
  })
})

describe('gitCheckout — 더티 트리에 resolution 이 없으면 (AC4)', () => {
  it('작업 트리를 한 바이트도 바꾸지 않고 reason:dirty 를 돌려준다', async () => {
    const repo = makeRepo()
    dirty(repo)
    writeFileSync(join(repo, 'untracked.txt'), 'u\n')
    const before = porcelain(repo)

    const result = await gitCheckout(repo, 'feature')

    expect(result).toMatchObject({ ok: false, reason: 'dirty', from: 'main' })
    expect(result).toHaveProperty('stat.files', 1)
    // 호출 전후의 작업 트리가 동일하다 — 브랜치도 그대로다.
    expect(porcelain(repo)).toBe(before)
    expect(git(repo, 'rev-parse', '--abbrev-ref', 'HEAD').trim()).toBe('main')
  })
})

describe('gitCheckout — 해소 3종은 추적 변경만 건드린다 (AC5)', () => {
  const resolutions = ['stash', 'commit-wip', 'discard'] as const

  for (const resolution of resolutions) {
    it(`${resolution} 후에도 미추적 파일은 그대로 남는다`, async () => {
      const repo = makeRepo()
      dirty(repo)
      writeFileSync(join(repo, 'untracked.txt'), 'u\n')

      const result = await gitCheckout(repo, 'feature', resolution)

      expect(result).toEqual({ ok: true, branch: 'feature' })
      // 미추적 파일은 체크아웃을 막지도 않고 지워지지도 않는다.
      expect(porcelain(repo)).toContain('?? untracked.txt')
      // 추적 변경은 셋 다 해소됐다 — 워킹 트리에 modified 가 남지 않는다.
      expect(porcelain(repo)).not.toMatch(/^ ?M /m)
    })
  }
})

describe('gitCheckout — 브랜치 이름 문자셋을 실행부에서 다시 검사한다 (AC7)', () => {
  // IPC 스키마를 우회해 실행부를 직접 부른다 — main 안에서 이 함수를 부르는 다른 경로가
  // 생겨도 같은 규칙이 서야 한다.
  const injections = ['-f', '--', 'a..b', 'x.lock', '--upload-pack=touch /tmp/pwn', '']

  for (const branch of injections) {
    it(`${JSON.stringify(branch)} 는 거부되고 작업 트리도 브랜치도 그대로다`, async () => {
      const repo = makeRepo()
      dirty(repo)
      const before = porcelain(repo)

      // `discard` 를 함께 넘긴다: 검사가 checkout 직전에만 있으면 여기서 이미 변경이
      // 폐기된 뒤라 이 단언이 깨진다 — 검사는 **모든** execFile 앞이어야 한다.
      const result = await gitCheckout(repo, branch, 'discard')

      expect(result).toMatchObject({ ok: false, reason: 'error' })
      expect(porcelain(repo)).toBe(before)
      expect(git(repo, 'rev-parse', '--abbrev-ref', 'HEAD').trim()).toBe('main')
    })
  }

  it('정상 이름은 통과한다 — 검사가 전부를 막는 것은 아니다', async () => {
    const repo = makeRepo()
    expect(await gitCheckout(repo, 'feature')).toEqual({ ok: true, branch: 'feature' })
  })
})

describe('gitCheckout — 해소는 성공했는데 checkout 이 실패하면 (AC9)', () => {
  // 없는 브랜치를 대상으로 삼으면 해소는 정상 수행되고 checkout 만 실패한다.
  const cases = [
    { resolution: 'stash' as const, survives: () => ['stash', 'list'] },
    { resolution: 'commit-wip' as const, survives: null },
    { resolution: 'discard' as const, survives: null }
  ]

  for (const { resolution, survives } of cases) {
    it(`${resolution} 이 적용됐음을 결과가 식별한다`, async () => {
      const repo = makeRepo()
      dirty(repo)

      const result = await gitCheckout(repo, 'no-such-branch', resolution)

      expect(result).toMatchObject({ ok: false, reason: 'error', applied: resolution })
      // 브랜치는 그대로다 — 그래서 "변경이 어디로 갔는가" 가 화면에 필요하다.
      expect(git(repo, 'rev-parse', '--abbrev-ref', 'HEAD').trim()).toBe('main')
      if (survives) expect(git(repo, ...survives()).trim().length).toBeGreaterThan(0)
    })
  }

  it('해소 자체가 없었던 실패(깨끗한 트리)에는 applied 를 싣지 않는다', async () => {
    const repo = makeRepo()

    const result = await gitCheckout(repo, 'no-such-branch')

    expect(result).toMatchObject({ ok: false, reason: 'error' })
    expect(result).not.toHaveProperty('applied')
  })
})
