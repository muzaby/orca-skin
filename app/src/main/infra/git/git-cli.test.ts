// git 실행부 통합 테스트 — **실제 저장소**를 임시 디렉토리에 세우고 돌린다.
//
// 파괴적 동작 3종(stash·commit -a·reset --hard)이 전부 이 파일에 있고 순수 파서 쪽에는
// 없으므로, 여기에 테스트가 없으면 "사용자 작업 트리를 무엇으로 건드리는가" 를 아무도 잠그지
// 않는다. `git-cli` 는 electron 비의존(`node:child_process` + `node:fs/promises`)이라 vitest
// 에서 그대로 돈다.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { gitBranches, gitCheckout, gitStatus } from './git-cli'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

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
  it('저장소가 아니면 isRepo:false 이고 브랜치도 비운다', async () => {
    const plain = mkdtempSync(join(tmpdir(), 'orca-plain-'))
    roots.push(plain)
    expect(await gitStatus(plain)).toEqual({
      isRepo: false,
      branch: null,
      detached: false,
      dirty: null
    })
    expect(await gitBranches(plain)).toEqual({ current: null, branches: [] })
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
