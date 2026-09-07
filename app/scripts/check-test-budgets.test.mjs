import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  analyze,
  findInlineTimeouts,
  isRealGitSuite,
  listTestFiles,
  parseBudget,
  runCli,
  stripComments
} from './check-test-budgets.mjs'

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 게이트를 통과하는 최소 스위트. 각 케이스는 여기서 한 가지만 무너뜨린다. */
const GOOD = `
import { afterEach, describe, expect, it, vi } from 'vitest'
import { execGit as exec, removeTempRoots } from './temp-repo.testfixture'

vi.setConfig({ testTimeout: 117_000, hookTimeout: 117_000 })

const roots = []
afterEach(() => removeTempRoots(roots.splice(0)))

describe('x', () => {
  it('y', async () => {
    await exec('git', ['init', 'r'])
  })
})
`

function fixture(files) {
  const rootDir = mkdtempSync(join(tmpdir(), 'test-budgets-'))
  for (const [rel, content] of Object.entries(files)) {
    const full = join(rootDir, rel)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content, 'utf8')
  }
  return { rootDir, cleanup: () => rmSync(rootDir, { recursive: true, force: true }) }
}

describe('대상 판정', () => {
  test('git 바이너리를 직접 띄우면 대상이다', () => {
    assert.equal(isRealGitSuite(`await exec('git', ['init'])`), true)
    assert.equal(isRealGitSuite(`execFileSync('git', args, { cwd })`), true)
    assert.equal(isRealGitSuite(`spawnSync('git', ['status'])`), true)
  })

  test('공용 픽스처를 쓰면 대상이다 — 별칭으로 감싼 spawn 도 이 문으로 들어온다', () => {
    assert.equal(isRealGitSuite(`import { removeTempRoots } from './temp-repo.testfixture'`), true)
  })

  test('git 을 띄우지 않는 순수 테스트는 대상이 아니다', () => {
    assert.equal(analyze('a.test.ts', `import { it } from 'vitest'\nit('x', () => {})`), null)
  })
  // 이 신호가 없어서 문이 새어 있었다 — `git-diff-commit.test.ts` 와
  // `prepare-progress.test.ts` 는 저장소를 `runGit(dir, ['init', …])` 으로 세워서 리터럴
  // `'git'` 이 한 번도 나오지 않는다. 0218 조치 전 트리에 게이트를 돌려 보고서야 드러났다.
  test('프로덕션 runGit 을 통한 간접 spawn 도 대상이다', () => {
    assert.equal(isRealGitSuite(`await runGit(dir, ['init', '--initial-branch=main'])`), true)
  })

  test('가짜 구현을 주입하는 러너 단위 테스트는 대상이 아니다 — 실제로 띄우지 않는다', () => {
    assert.equal(
      isRealGitSuite(`runGit('/repo', ['status'], { execFileImpl: fake as never })`),
      false
    )
  })
})

describe('주석 제거', () => {
  test('문자열 안의 `//` 를 자르지 않는다', () => {
    // 이 자리가 실제 위험이었다 — `git-cli.test.ts` 는 github URL 을 단언 값으로 들고 있어서,
    // "`//` 뒤를 자른다" 식 제거는 그 줄의 신호를 통째로 날린다.
    const source = `expect(url).toBe('https://github.com/owner/repo') // 꼬리 주석`
    const text = stripComments(source)
    assert.ok(text.includes('https://github.com/owner/repo'))
  })

  test('줄 전체 주석과 블록 주석은 지운다', () => {
    assert.equal(stripComments(`// 설명\nconst a = 1\n`).trim(), 'const a = 1')
    assert.equal(stripComments(`/* 설명 */const a = 1`), 'const a = 1')
  })

  test('주석 안의 예시 코드는 신호로 세지 않는다', () => {
    assert.equal(isRealGitSuite(stripComments(`// execFile('git', ['init']) 를 쓰지 마라`)), false)
  })
})

describe('예산 파싱', () => {
  test('두 값을 읽고 밑줄 구분자를 접는다', () => {
    assert.deepEqual(parseBudget(`vi.setConfig({ testTimeout: 117_000, hookTimeout: 99_000 })`), {
      testTimeout: 117000,
      hookTimeout: 99000
    })
  })

  test('호출이 없으면 null 이다', () => {
    assert.equal(parseBudget(`const a = 1`), null)
  })
})

describe('인라인 타임아웃 탐지', () => {
  test('세 번째 인자 형태를 잡는다', () => {
    assert.deepEqual(findInlineTimeouts(`  it('x', async () => {\n  }, 30000)\n`), ['30000'])
    assert.deepEqual(findInlineTimeouts(`  }, 30_000)\n`), ['30_000'])
  })

  test('옵션 객체 형태를 잡는다', () => {
    assert.deepEqual(findInlineTimeouts(`it('x', { timeout: 15000 }, fn)`), ['15000'])
  })

  test('타임아웃이 아닌 끝 괄호는 잡지 않는다', () => {
    assert.deepEqual(findInlineTimeouts(`expect(list).toHaveLength(2)\n`), [])
  })
})

describe('규칙 — 0218 러너에서 실제로 터진 두 형태', () => {
  test('예산이 없으면 걸린다 (첫 조치에서 네 파일이 조용히 빠진 자리)', () => {
    const source = GOOD.replace(
      'vi.setConfig({ testTimeout: 117_000, hookTimeout: 117_000 })\n',
      ''
    )
    const { errors } = analyze('a.test.ts', source)
    assert.equal(errors.length, 1)
    assert.match(errors[0], /파일 예산이 없다/)
  })

  test('예산이 있어도 인라인 캡이 남아 있으면 걸린다 (service.test.ts 가 죽은 자리)', () => {
    // 198초 예산에 30초 캡이 남아 그 캡이 이겼다. 값이 지금 충분한지와 무관하게 형태를 막는다.
    const source = GOOD.replace(`  })\n})`, `  }, 30_000)\n})`)
    const { errors } = analyze('a.test.ts', source)
    assert.equal(errors.length, 1)
    assert.match(errors[0], /인라인 타임아웃/)
  })

  test('hookTimeout 이 빠지면 걸린다 — 기본 10초는 저장소를 세우는 훅을 못 담는다', () => {
    const source = GOOD.replace(', hookTimeout: 117_000', '')
    const { errors } = analyze('a.test.ts', source)
    assert.deepEqual(errors, ['`vi.setConfig` 에 hookTimeout 이 없다'])
  })

  test('정리가 removeTempRoots 를 지나지 않으면 걸린다', () => {
    const source = GOOD.replace(
      `import { execGit as exec, removeTempRoots } from './temp-repo.testfixture'`,
      `import { execFile } from 'node:child_process'\nconst exec = execFile`
    ).replace('afterEach(() => removeTempRoots(roots.splice(0)))', 'afterEach(() => rm(roots[0]))')
    const { errors } = analyze('a.test.ts', source)
    assert.equal(errors.length, 1)
    assert.match(errors[0], /removeTempRoots/)
  })

  test('전부 갖추면 통과한다', () => {
    assert.deepEqual(analyze('a.test.ts', GOOD).errors, [])
  })
})

describe('CLI', () => {
  test('위반이 있으면 1, 없으면 0 이다', () => {
    const bad = fixture({
      'src/a.test.ts': GOOD.replace(
        'vi.setConfig({ testTimeout: 117_000, hookTimeout: 117_000 })',
        ''
      )
    })
    try {
      assert.equal(runCli(bad.rootDir), 1)
    } finally {
      bad.cleanup()
    }

    const good = fixture({ 'src/a.test.ts': GOOD })
    try {
      assert.equal(runCli(good.rootDir), 0)
    } finally {
      good.cleanup()
    }
  })

  test('중첩 디렉토리를 전부 훑고 경로를 `/` 로 정규화한다', () => {
    const fx = fixture({ 'src/a/b/c.test.ts': GOOD, 'src/d.test.ts': GOOD, 'src/e.ts': 'x' })
    try {
      assert.deepEqual(listTestFiles(join(fx.rootDir, 'src')), ['a/b/c.test.ts', 'd.test.ts'])
    } finally {
      fx.cleanup()
    }
  })

  // **실제 저장소를 본다.** 픽스처만 보면 게이트가 초록인 채로 트리가 어긋날 수 있다 —
  // 0218 이 정확히 그랬다(조치는 옳았고 네 파일이 빠졌다). 이 한 줄이 `npm test` 를
  // 게이트로 만든다: CI 스텝을 기다리지 않고 로컬에서 바로 걸린다.
  test('실제 저장소가 계약을 지킨다', () => {
    assert.equal(runCli(APP_DIR), 0)
  })
})
