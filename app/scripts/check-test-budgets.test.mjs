import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  analyze,
  analyzeScale,
  checkFixtureCap,
  findInlineTimeouts,
  findUncappedRunGit,
  isRealGitSuite,
  listBudgetFiles,
  listTestFiles,
  parseBudget,
  runCli,
  scanBudgetSites,
  SEMANTIC_DELAYS,
  stripComments
} from './check-test-budgets.mjs'

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 게이트를 통과하는 최소 스위트. 각 케이스는 여기서 한 가지만 무너뜨린다. */
const GOOD = `
import { afterEach, describe, expect, it, vi } from 'vitest'
import { execGit as exec, removeTempRoots } from './temp-repo.testfixture'

vi.setConfig(scaledBudget({ testTimeout: 117_000, hookTimeout: 117_000 }))

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
      hookTimeout: 99000,
      scaled: false
    })
  })

  test('scaledBudget 로 감싼 기준값을 읽고 배율 경유를 표시한다 (0294)', () => {
    assert.deepEqual(
      parseBudget(`vi.setConfig(scaledBudget({ testTimeout: 72_000, hookTimeout: 36_000 }))`),
      { testTimeout: 72000, hookTimeout: 36000, scaled: true }
    )
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
      'vi.setConfig(scaledBudget({ testTimeout: 117_000, hookTimeout: 117_000 }))\n',
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

describe('프로세스 상한 탐지 (E)', () => {
  test('상한을 안 넘기는 호출을 잡는다 — 프로덕션 기본 10s 를 상속한다', () => {
    assert.deepEqual(findUncappedRunGit(`const r = await runGit(cwd, args)`), ['runGit(cwd, args)'])
  })

  test('픽스처 상수를 넘기면 통과한다', () => {
    assert.deepEqual(
      findUncappedRunGit(`await runGit(cwd, args, { timeoutMs: FIXTURE_GIT_TIMEOUT_MS })`),
      []
    )
  })

  test('숫자를 직접 적으면 잡는다 — 근거는 픽스처 한 곳이 갖는다', () => {
    assert.equal(findUncappedRunGit(`runGit(cwd, args, { timeoutMs: 30_000 })`).length, 1)
  })

  test('정규식 리터럴 본문은 호출이 아니다 — ipc-integration 이 그 형태를 값으로 든다', () => {
    assert.deepEqual(findUncappedRunGit(String.raw`const AXIS = /\brunGit\s*\(|\bspawn\s*\(/`), [])
  })

  test('문자열 안의 괄호를 깊이로 세지 않는다', () => {
    // 이 자리가 실제 위험이다 — 인자에 `join(' ')` 같은 괄호가 흔해서, 짝을 잘못 닫으면
    // 뒤따르는 옵션 객체를 못 보고 통과한 호출을 위반으로 부른다(또는 그 반대).
    assert.deepEqual(
      findUncappedRunGit(
        `runGit(cwd, [\`--format=(${'x'})\`], { timeoutMs: FIXTURE_GIT_TIMEOUT_MS })`
      ),
      []
    )
  })
})

describe('규칙 (E) — 캡이 파일 예산을 이기던 자리가 한 층 아래에 남아 있었다', () => {
  // `prepare-progress` 의 픽스처 `worktree add`(풀 체크아웃)가 병렬 부하에서 `runGit` 기본
  // 10s 를 넘겨 죽었다. stderr 에는 `Preparing worktree` 한 줄뿐 fatal 이 없었고 99s 파일
  // 예산은 닿지도 않았다 — 예산의 소유자가 파일이 아니었던 것이다.
  const WITH_RUN_GIT = GOOD.replace(
    `    await exec('git', ['init', 'r'])`,
    `    await runGit(dir, ['init', 'r'])`
  )

  test('테스트가 프로덕션 기본 상한을 상속하면 걸린다', () => {
    const { errors } = analyze('a.test.ts', WITH_RUN_GIT)
    assert.equal(errors.length, 1)
    assert.match(errors[0], /runGit/)
  })

  test('픽스처 상수를 넘기면 통과한다', () => {
    const source = WITH_RUN_GIT.replace(
      `runGit(dir, ['init', 'r'])`,
      `runGit(dir, ['init', 'r'], { timeoutMs: FIXTURE_GIT_TIMEOUT_MS })`
    )
    assert.deepEqual(analyze('a.test.ts', source).errors, [])
  })
})

describe('규칙 (F) — 배율 경유 (0294)', () => {
  test('리터럴 vi.setConfig 는 걸리고 scaledBudget 는 통과한다', () => {
    assert.equal(analyzeScale('a.test.ts', `vi.setConfig({ testTimeout: 15_000 })`).length, 1)
    assert.match(
      analyzeScale('a.test.ts', `vi.setConfig({ testTimeout: 15_000 })`)[0],
      /scaledBudget/
    )
    assert.deepEqual(
      analyzeScale('a.test.ts', `vi.setConfig(scaledBudget({ testTimeout: 15_000 }))`),
      []
    )
  })

  test('케이스 셋째 인자 리터럴은 걸리고 scaleMs 는 통과한다 — it.each·skipIf 포함', () => {
    const literal = `it('x', async () => {\n}, 10_000)\nit.each([1])('y', async () => {}, 4000)\nit.skipIf(a)('z', async () => {}, 45_000)`
    assert.equal(analyzeScale('a.test.ts', literal).length, 3)
    const scaled = literal.replaceAll(/, (\d[\d_]*)\)/g, ', scaleMs($1))')
    assert.deepEqual(analyzeScale('a.test.ts', scaled), [])
  })

  test('옵션 객체 timeout 과 훅 타임아웃도 같다', () => {
    assert.equal(analyzeScale('a.test.ts', `it('x', { timeout: 15000 }, fn)`).length, 1)
    assert.deepEqual(analyzeScale('a.test.ts', `it('x', { timeout: scaleMs(15000) }, fn)`), [])
    assert.equal(analyzeScale('a.test.ts', `beforeAll(async () => {}, 30_000)`).length, 1)
    assert.deepEqual(analyzeScale('a.test.ts', `beforeAll(async () => {}, scaleMs(30_000))`), [])
  })

  test('타임아웃이 아닌 끝 숫자 인자는 자리가 아니다 — jira result 형태', () => {
    assert.deepEqual(analyzeScale('a.test.ts', `expect(() => f({ a: 1 }, 100)).toThrow()`), [])
    assert.deepEqual(scanBudgetSites('a.test.ts', `expect(list).toHaveLength(2)`), [])
  })
})

describe('규칙 (H′) — 테스트 소유 실시간 마감 (0294 ΔV1)', () => {
  const v = (code, file = 'a.test.ts', entries = []) => analyzeScale(file, code, entries).length

  // V1 (H) 케이스 — (H′) 아래로 옮겨 유지한다.
  test('리터럴 마감 ≥ 1000ms 는 걸리고 scaleMs 는 통과한다', () => {
    assert.equal(
      analyzeScale('a.test.ts', `const t = setTimeout(() => c.abort(), 90_000)`).length,
      1
    )
    assert.equal(analyzeScale('a.test.ts', `const deadline = Date.now() + 30_000`).length, 1)
    assert.deepEqual(
      analyzeScale('a.test.ts', `const t = setTimeout(() => c.abort(), scaleMs(90_000))`),
      []
    )
    assert.deepEqual(analyzeScale('a.test.ts', `const deadline = Date.now() + scaleMs(30_000)`), [])
  })

  test('1000ms 미만 대기는 자리가 아니다', () => {
    assert.deepEqual(
      scanBudgetSites('a.test.ts', `await new Promise((r) => setTimeout(r, 400))`),
      []
    )
  })

  test('의미 대기는 파일·값이 모두 맞을 때만 통과한다 — 다른 파일의 같은 값은 걸린다', () => {
    const entry = SEMANTIC_DELAYS.find((item) => item.count === 1)
    const code = `await new Promise((resolve) => setTimeout(resolve, ${entry.value}))`
    assert.deepEqual(analyzeScale(entry.file, code), [])
    assert.equal(analyzeScale('main/other.test.ts', code).length, 1)
    assert.ok(SEMANTIC_DELAYS.every((item) => item.reason.trim().length > 0))
  })

  // P1 파일 범위
  test('P1 — (H′) 는 test·testfixture.ts·testfixture.tsx 를 보고 (A)~(E) 는 test 만 본다', () => {
    const body = `export const s = AbortSignal.timeout(5000)\n`
    const fx = fixture({
      'src/a.test.ts': body,
      'src/b.testfixture.ts': `${body}await execFile('git', ['init'])\n`,
      'src/c.testfixture.tsx': `${body}export const C = () => <div timeout={1} />\n`,
      'src/d.ts': body
    })
    try {
      const root = join(fx.rootDir, 'src')
      assert.deepEqual(listBudgetFiles(root), [
        'a.test.ts',
        'b.testfixture.ts',
        'c.testfixture.tsx'
      ])
      assert.deepEqual(listTestFiles(root), ['a.test.ts'])
      const errors = []
      const original = console.error
      console.error = (line) => errors.push(line)
      try {
        assert.equal(runCli(fx.rootDir, [], []), 1)
      } finally {
        console.error = original
      }
      const scaleLines = errors.filter((line) => line.includes('테스트 소유 마감'))
      assert.equal(scaleLines.length, 3)
      assert.ok(errors.every((line) => !line.includes('d.ts')))
      assert.equal(analyze('b.testfixture.ts', 'x'), null)
    } finally {
      fx.cleanup()
    }
  })

  // P2 형태 7 — 하위 분기마다 미배율 1 · scaleMs 0
  const FORMS = [
    ['timer 전역', (n) => `setTimeout(f, ${n})`],
    ['timer globalThis', (n) => `globalThis.setTimeout(f, ${n})`],
    ['timer window', (n) => `window.setTimeout(f, ${n})`],
    ['timer setInterval', (n) => `setInterval(f, ${n})`],
    [
      'timer timers/promises',
      (n) => `import { setTimeout as sleep } from 'node:timers/promises'\nawait sleep(${n})`
    ],
    ['method', (n) => `socket.setTimeout(${n})`],
    ['abort', (n) => `const s = AbortSignal.timeout(${n})`],
    ['deadline now()+N', (n) => `const d = Date.now() + ${n}`],
    ['deadline N+now()', (n) => `const d = ${n} + performance.now()`],
    ['deadline <', (n) => `while (Date.now() - t < ${n}) {}`],
    ['deadline <=', (n) => `while (Date.now() - t <= ${n}) {}`],
    ['deadline >', (n) => `if (Date.now() - t > ${n}) throw e`],
    ['deadline >=', (n) => `if (${n} >= Date.now() - t) ok()`],
    ['elapsed', (n) => `expect(Date.now() - start).toBeLessThan(${n})`],
    ['elapsed OrEqual', (n) => `expect(performance.now() - s).toBeLessThanOrEqual(${n})`],
    ['option 키', (n) => `pool({ timeoutMs: ${n} })`],
    ['option 중첩 timeouts', (n) => `pool({ timeouts: { connectMs: ${n} } })`],
    ['option timeout 변수의 객체', (n) => `const timeouts = { commandMs: ${n} }`],
    ['param', (n) => `function fixture(timeoutMs = ${n}) {}`]
  ]
  for (const [name, make] of FORMS) {
    test(`P2 — ${name}: 리터럴 5000 은 1 위반, scaleMs(5000) 은 0`, () => {
      assert.equal(v(make('5000')), 1)
      assert.equal(v(make('scaleMs(5000)')), 0)
    })
  }

  test('P2 — 라벨 밖 이름(delayMs)은 자리가 아니다', () => {
    assert.equal(v(`pool({ delayMs: 5000 })`), 0)
    assert.equal(v(`function f(delayMs = 5000) {}`), 0)
  })

  // P3 값 해석
  test('P3 — 같은 파일 const · ?? · || · 리터럴 산술은 따라가고 import 식별자는 건너뛴다', () => {
    assert.equal(v(`const T = 30_000\nsetTimeout(f, T)`), 1)
    assert.equal(v(`pool({ timeoutMs: x ?? 2000 })`), 1)
    assert.equal(v(`pool({ timeoutMs: x || 2000 })`), 1)
    assert.equal(v(`pool({ timeoutMs: x ?? scaleMs(2000) })`), 0)
    assert.equal(v(`setTimeout(f, 60 * 1000)`), 1)
    assert.equal(v(`setTimeout(f, 500 + 500)`), 1)
    assert.equal(v(`setTimeout(f, 60 * scaleMs(1000))`), 0)
    assert.equal(v(`import { T } from './t'\nsetTimeout(f, T)`), 0)
  })

  // P4 임계
  test('P4 — 임계 1000ms, 단 abort·자식 프로세스 timeout 은 임계가 없다', () => {
    assert.equal(v(`setTimeout(f, 999)`), 0)
    assert.equal(v(`setTimeout(f, 1000)`), 1)
    assert.equal(v(`AbortSignal.timeout(10)`), 1)
    assert.equal(v(`pool({ timeoutMs: 10 })`), 0)
    for (const call of [
      'execFile',
      'execFileSync',
      'spawn',
      'spawnSync',
      'exec',
      'execSync',
      'fork'
    ])
      assert.equal(v(`${call}(c, a, { timeout: 10 })`), 1, call)
    assert.equal(v(`cp.execFile(c, a, { timeout: 10 })`), 1)
  })

  // P5 제외
  test('P5 — vi.waitFor 옵션·matcher 피연산자·케이스 타임아웃은 빼고 expect(x) 의 x 와 elapsed 상한은 센다', () => {
    assert.equal(v(`await vi.waitFor(cb, { timeout: 4000 })`), 0)
    assert.equal(v(`await vi.waitFor(() => setTimeout(f, 4000))`), 1)
    assert.equal(v(`expect(x).toMatchObject({ timeout: 60_000 })`), 0)
    assert.equal(v(`expect(x).toEqual(expect.objectContaining({ timeoutMs: 60_000 }))`), 0)
    assert.equal(v(`await expect(wait({ timeoutMs: 1000 })).resolves.toBe('settled')`), 1)
    assert.equal(v(`expect(Date.now() - start).toBeLessThan(5000)`), 1)
    assert.equal(v(`it('x', async () => {}, scaleMs(5000))`), 0)
    assert.equal(v(`vi.setConfig(scaledBudget({ testTimeout: 5000 }))`), 0)
    assert.equal(v(`const b = scaledBudget({ hookTimeout: 5000 })`), 0)
    assert.equal(
      scanBudgetSites('a.test.ts', `it('x', async () => {}, 5000)`).filter(
        (site) => site.kind === 'deadline'
      ).length,
      0
    )
  })

  // P6 허용 목록
  test('P6 — 항목 count 는 같은 파일·같은 값 자리 수와 같아야 하고 reason 이 필요하다', () => {
    const entry = { file: 'a', value: '5000', count: 2, reason: 'r' }
    const sites = (n) => Array.from({ length: n }, () => `setTimeout(f, 5000)`).join('\n')
    assert.equal(v(sites(2), 'a', [entry]), 0)
    assert.equal(v(sites(3), 'a', [entry]), 1)
    assert.equal(v(sites(1), 'a', [entry]), 1)
    assert.equal(v(sites(2), 'a', [{ ...entry, reason: '' }]), 1)
    assert.equal(v(sites(2), 'a', [{ ...entry, reason: '  ' }]), 1)
    assert.equal(v(sites(2), 'b', [entry]), 2)
    assert.equal(v(`setTimeout(f, 6000)\n${sites(2)}`, 'a', [entry]), 1)
  })

  test('P6 — 대상 파일이 없는 의미 값 항목은 CLI 가 막는다', () => {
    const entry = SEMANTIC_DELAYS[0]
    const fx = fixture({ 'src/a.test.ts': `it('x', () => {})\n` })
    const errors = []
    const original = console.error
    console.error = (line) => errors.push(line)
    try {
      assert.equal(runCli(fx.rootDir), 1)
    } finally {
      console.error = original
      fx.cleanup()
    }
    assert.ok(errors.some((line) => line.includes(entry.file) && line.includes('대상 파일이 없다')))
  })

  // P7 이중 배율
  test('P7 — vi.waitFor 옵션 안의 scaleMs 는 이중 배율이라 걸린다', () => {
    assert.equal(v(`await vi.waitFor(cb, { timeout: scaleMs(4000) })`), 1)
    assert.equal(v(`await vi.waitFor(cb, scaleMs(4000))`), 1)
    assert.equal(v(`await vi.waitFor(cb, { timeout: 4000 })`), 0)
    assert.equal(v(`await vi.waitFor(() => f(scaleMs(4000)))`), 0)
  })

  test('--report deadline 행은 형태 열과 값 열을 갖는다', () => {
    const fx = fixture({
      'src/a.test.ts': `const s = AbortSignal.timeout(scaleMs(5000))\nconst T = 30_000\nsetTimeout(f, T)\n`
    })
    const lines = []
    const original = console.log
    const originalError = console.error
    console.log = (line) => lines.push(line)
    console.error = () => {}
    try {
      runCli(fx.rootDir, ['--report'], [])
    } finally {
      console.log = original
      console.error = originalError
      fx.cleanup()
    }
    const rows = lines.filter((line) => line.startsWith('deadline\t'))
    assert.deepEqual(
      rows.map((row) => row.split('\t').slice(0, 5)),
      [
        ['deadline', 'src/a.test.ts:1', 'scaled', 'abort', 'scaleMs'],
        ['deadline', 'src/a.test.ts:3', 'LITERAL', 'timer', '30_000']
      ]
    )
  })
})

describe('바인딩 해석 (0294 ΔV2)', () => {
  const v = (code, file = 'a.test.ts', entries = []) => analyzeScale(file, code, entries).length
  const waitForDoubles = (code) =>
    scanBudgetSites('a.test.ts', code, []).filter((site) => site.kind === 'waitFor').length
  // 미배율 5000 → 1 · 같은 자리를 scaleMs(5000) 으로 → 0. 분기마다 구별 입력 하나.
  const pair = (name, make) =>
    test(`${name}: 리터럴은 1 위반, scaleMs 는 0`, () => {
      assert.equal(v(make('5000')), 1)
      assert.equal(v(make('scaleMs(5000)')), 0)
    })

  // P2′ 슬롯 · 형태 · 호출 대상
  pair('P2′ 단축 속성 (Y1)', (n) => `const timeoutMs = ${n}\nwaitForTask(t, { timeoutMs })`)
  pair(
    'P2′ 단축 속성 — 이름 변수가 아닌 매개변수 경유',
    (n) => `function run(timeoutMs) { return pool({ timeoutMs }) }\nrun(${n})`
  )
  pair('P2′ 속성 대입', (n) => `socket.timeout = ${n}`)
  pair('P2′ ??= 대입', (n) => `opts.timeoutMs ??= ${n}`)
  pair('P2′ timeouts 소유 객체 대입', (n) => `timeouts.connectMs = ${n}`)
  pair('P2′ 클래스 필드', (n) => `class F { timeoutMs = ${n} }`)
  pair('P2′ 구조 분해 매개변수 기본값 (Y11)', (n) => `const f = ({ timeoutMs = ${n} } = {}) => 0`)
  pair('P2′ 구조 분해 변수 기본값', (n) => `const { timeoutMs = ${n} } = o`)
  pair('P2′ 이름 바꾼 구조 분해', (n) => `function f({ timeout: t = ${n} } = {}) { return t }`)
  pair('P2′ 배열 구조 분해 기본값', (n) => `const [timeoutMs = ${n}] = l`)
  pair('P2′ named 위치 인자로 넘김', (n) => `const timeoutMs = ${n}\nawait waitUntil(s, timeoutMs)`)
  pair('P2′ setTimeout 별칭', (n) => `const st = setTimeout\nst(f, ${n})`)
  pair('P2′ AbortSignal.timeout 별칭', (n) => `const t = AbortSignal.timeout\nt(${n})`)
  test('P2′ timeouts 소유는 바인딩 참조로도 본다', () => {
    assert.equal(v(`const t = { connectMs: 1000 }\npool({ timeouts: t })`), 1)
    assert.equal(v(`const t = { connectMs: 1000 }\npool({ other: t })`), 0)
  })

  // P3′ 값 해석
  test('P3′ 가림 — 같은 이름 const 가 다른 블록에 있어도 각자 선언으로 푼다', () => {
    const lit = `it('b', () => { const t = 5000; setTimeout(f, t) })`
    const scaled = `it('a', () => { const t = scaleMs(5000); setTimeout(f, t) })`
    assert.equal(v(`${lit}\n${scaled}`), 1)
    assert.equal(v(`${scaled}\n${lit}`), 1)
  })
  test('P3′ let 재대입 값도 후보다', () => {
    assert.equal(v(`let t = scaleMs(500)\nt = 5000\nsetTimeout(f, t)`), 1)
    assert.equal(v(`let t = scaleMs(500)\nt = scaleMs(5000)\nsetTimeout(f, t)`), 0)
  })
  pair('P3′ 리터럴 구조 분해', (n) => `const { ms } = { ms: ${n} }\nsetTimeout(f, ms)`)
  pair(
    'P3′ 같은 파일 함수 매개변수 ← 호출 인자',
    (n) => `const sleep = (ms) => new Promise((r) => setTimeout(r, ms))\nawait sleep(${n})`
  )
  test('P3′ 함수 선언의 호출마다 값', () => {
    const fn = `function wait(ms) { return new Promise((r) => setTimeout(r, ms)) }`
    assert.equal(v(`${fn}\nawait wait(5000)\nawait wait(400)`), 1)
  })
  pair(
    'P3′ 구조 분해 매개변수 ← 호출 인자 객체',
    (n) =>
      `function wait({ ms }) { return new Promise((r) => setTimeout(r, ms)) }\nawait wait({ ms: ${n} })`
  )
  pair(
    'P3′ 객체 메서드',
    (n) =>
      `const h = { wait(ms) { return new Promise((r) => setTimeout(r, ms)) } }\nawait h.wait(${n})`
  )
  pair(
    'P3′ 클래스 메서드',
    (n) =>
      `class F { wait(ms) { return new Promise((r) => setTimeout(r, ms)) } }\nawait new F().wait(${n})`
  )
  pair(
    'P3′ 속성 화살표',
    (n) => `const h = { wait: (ms) => new Promise((r) => setTimeout(r, ms)) }\nawait h.wait(${n})`
  )
  pair('P3′ 반환식', (n) => `function budget() { return ${n} }\nsetTimeout(f, budget())`)
  pair('P3′ 멤버 접근', (n) => `const cfg = { delay: ${n} }\nsetTimeout(f, cfg.delay)`)
  pair('P3′ 요소 접근', (n) => `const cfg = { delay: ${n} }\nsetTimeout(f, cfg['delay'])`)
  test('P3′ 조건식 양쪽 · 뺄셈 · as 래퍼', () => {
    assert.equal(v(`setTimeout(f, fast ? 500 : 5000)`), 1)
    assert.equal(v(`setTimeout(f, 6000 - 1000)`), 1)
    assert.equal(v(`setTimeout(f, (5000 as number))`), 1)
  })

  // P4′ 임계 — 자식 프로세스 판정의 바인딩
  test('P4′ 자식 프로세스 옵션은 바인딩·별칭·promisify 를 지나도 임계가 없다', () => {
    for (const code of [
      `const opts = { timeout: 10 }\nexecFile(c, a, opts)`,
      `const base = { timeout: 10 }\nexecFile(c, a, { ...base })`,
      `const o = {}\no.timeout = 10\nexecFile(c, a, o)`,
      `import { execFile as run } from 'node:child_process'\nrun(c, a, { timeout: 10 })`,
      `import { execFile } from 'node:child_process'\nawait promisify(execFile)(c, a, { timeout: 10 })`,
      `import { execFile } from 'node:child_process'\nconst run = promisify(execFile)\nawait run(c, a, { timeout: 10 })`
    ])
      assert.equal(v(code), 1, code)
    assert.equal(v(`const opts = { timeout: 10 }\npool(opts)`), 0)
  })

  // P5′ 제외 — 사용 자리
  test('P5′ 변수에 담긴 슬롯은 참조가 전부 제외 자리일 때만 제외한다', () => {
    assert.equal(v(`const probeOpts = { timeout: 5000 }\nawait vi.waitFor(() => {}, probeOpts)`), 0)
    assert.equal(v(`const timeout = 4000\nawait vi.waitFor(cb, { timeout })`), 0)
    assert.equal(v(`const timeoutMs = 5000\nexpect(c.timeoutMs).toBe(timeoutMs)`), 0)
    assert.equal(v(`const o = { timeout: 5000 }\nawait vi.waitFor(cb, o)\npool(o)`), 1)
    assert.equal(v(`const timeoutMs = 5000`), 1)
  })

  // P7′ 이중 배율
  test('P7′ vi.waitFor 옵션이 바인딩을 거쳐 scaleMs 에 닿으면 위반', () => {
    assert.equal(
      waitForDoubles(
        `const probeOpts = { timeout: scaleMs(5000) }\nawait vi.waitFor(() => {}, probeOpts)`
      ),
      1
    )
    assert.equal(waitForDoubles(`const w = scaleMs(4000)\nawait vi.waitFor(cb, w)`), 1)
    assert.equal(
      waitForDoubles(
        `const base = { timeout: scaleMs(4000) }\nawait vi.waitFor(cb, { ...base, interval: 50 })`
      ),
      1
    )
    assert.equal(
      waitForDoubles(`const wf = vi.waitFor\nawait wf(cb, { timeout: scaleMs(4000) })`),
      1
    )
    assert.equal(
      waitForDoubles(`const probeOpts = { timeout: 5000 }\nawait vi.waitFor(() => {}, probeOpts)`),
      0
    )
  })

  // P8 now 식
  pair(
    'P8 경과 변수 상한 단언 (Y5)',
    (n) =>
      `const start = Date.now()\nconst elapsed = Date.now() - start\nexpect(elapsed).toBeLessThan(${n})`
  )
  pair(
    'P8 파생 마감 (Y5b)',
    (n) =>
      `const start = Date.now()\nconst deadline = start + ${n}\nwhile (Date.now() < deadline) {}`
  )
  pair(
    'P8 경과 변수 비교',
    (n) => `const t0 = performance.now()\nconst el = performance.now() - t0\nif (el > ${n}) throw e`
  )
  pair('P8 += 마감', (n) => `let d = Date.now()\nd += ${n}`)
  pair('P8 new Date().getTime()', (n) => `const d = new Date().getTime() + ${n}`)
  pair('P8 역방향 상한 단언', (n) => `expect(${n}).toBeGreaterThan(Date.now() - s)`)
  test('P8 하한 단언·호출 인자 안 now·now 식끼리 비교', () => {
    assert.equal(v(`expect(Date.now() - s).toBeGreaterThanOrEqual(5000)`), 0)
    assert.equal(v(`const h = render({ at: Date.now() })\nconst n = h + 5000`), 0)
    const sites = scanBudgetSites(
      'a.test.ts',
      `const d = Date.now() + scaleMs(5000)\nwhile (Date.now() < d) {}`,
      []
    ).filter((site) => site.kind === 'deadline')
    assert.equal(sites.length, 1)
  })

  // P9 자리 동일성
  test('P9 한 리터럴은 한 자리 · 호출마다 다른 리터럴은 따로 · 값 줄 표기', () => {
    assert.equal(v(`const T = 30_000\nsetTimeout(f, T)\nsetTimeout(g, T)`), 1)
    const sleep = `const sleep = (ms) => new Promise((r) => setTimeout(r, ms))`
    assert.equal(v(`${sleep}\nawait sleep(5000)\nawait sleep(5000)`), 2)
    const [line] = analyzeScale('a.test.ts', `const T = 30_000\nsetTimeout(f, T)`, [])
    assert.match(line, /^:2 \(값 :1\) /)
  })
})

describe('규칙 (G) — 픽스처 상한 > 최대 파일 예산 (0294)', () => {
  const fixture = (base) => `export const FIXTURE_GIT_TIMEOUT_MS = scaleMs(${base})`
  test('기준 상한이 최대 기준 예산보다 크면 통과, 같거나 작으면 걸린다', () => {
    const budgets = [{ testTimeout: 369_000, hookTimeout: 369_000 }, { testTimeout: 72_000 }]
    assert.equal(checkFixtureCap(fixture('600_000'), budgets), null)
    assert.match(checkFixtureCap(fixture('369_000'), budgets), /크지 않다/)
    assert.match(checkFixtureCap(fixture('300_000'), budgets), /크지 않다/)
  })

  test('배율을 거치지 않은 상한은 형태부터 걸린다', () => {
    assert.match(
      checkFixtureCap(`export const FIXTURE_GIT_TIMEOUT_MS = 600_000`, []),
      /찾지 못했다/
    )
  })
})

describe('CLI', () => {
  test('위반이 있으면 1, 없으면 0 이다', () => {
    const bad = fixture({
      'src/a.test.ts': GOOD.replace(
        'vi.setConfig(scaledBudget({ testTimeout: 117_000, hookTimeout: 117_000 }))',
        ''
      )
    })
    try {
      assert.equal(runCli(bad.rootDir, [], []), 1)
    } finally {
      bad.cleanup()
    }

    const good = fixture({ 'src/a.test.ts': GOOD })
    try {
      assert.equal(runCli(good.rootDir, [], []), 0)
      assert.equal(
        runCli(good.rootDir),
        1,
        '실제 의미 값 항목은 그 파일이 없는 트리에서 낡은 허용으로 걸린다'
      )
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

// Scale the numeric leaves of a fixture, preserving keys and existing scaleMs arguments.
function scaledFixture(code) {
  const src = ts.createSourceFile('fixture.ts', code, ts.ScriptTarget.Latest, true)
  const replacements = []
  const walk = (node) => {
    if (ts.isNumericLiteral(node)) {
      let parent = node.parent
      let scaled = false
      for (let p = parent; p; p = p.parent)
        if (ts.isCallExpression(p) && p.expression.getText(src) === 'scaleMs') scaled = true
      const key =
        (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) ||
        parent.name === node
      if (!scaled && !key) replacements.push([node.getStart(src), node.end])
    }
    ts.forEachChild(node, walk)
  }
  walk(src)
  for (const [start, end] of replacements.reverse())
    code = code.slice(0, start) + `scaleMs(${code.slice(start, end)})` + code.slice(end)
  return code
}

// Input fixtures copied from the READY plan; assertions execute the production gate.
describe('분기 목록 (0294 ΔV3)', () => {
  const v = (code) => analyzeScale('a.test.ts', code, []).length
  const w = (code) =>
    scanBudgetSites('a.test.ts', code, []).filter((s) => s.kind === 'waitFor').length
  const d = (code) =>
    scanBudgetSites('a.test.ts', code, []).filter((s) => s.kind === 'deadline').length
  // P6 — 허용 항목 {file:'a', value:'5000', count:2, reason:'r'} 아래 위반 수. 소스 = 자리 수 n 또는 '다른 파일'.
  const ENTRY = { file: 'a', value: '5000', count: 2, reason: 'r' }
  const sites = (n) => Array.from({ length: n }, () => 'setTimeout(f, 5000)').join('\n')
  const a6 = ([file, code, entry]) => analyzeScale(file, code, [entry]).length
  // P1 · P9 --report — 임시 트리
  const withTree = (files, fn) => {
    const root = mkdtempSync(join(tmpdir(), 'dv3-'))
    try {
      for (const [rel, body] of Object.entries(files)) {
        mkdirSync(join(root, rel, '..'), { recursive: true })
        writeFileSync(join(root, rel), body)
      }
      return fn(root)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
  const P1_TREE = {
    'src/a.test.ts': 'export const s = AbortSignal.timeout(5000)\n',
    'src/b.testfixture.ts':
      "export const s = AbortSignal.timeout(5000)\nawait execFile('git', ['init'])\n",
    'src/c.testfixture.tsx':
      'export const s = AbortSignal.timeout(5000)\nexport const C = () => <div timeout={1} />\n',
    'src/d.ts': 'export const s = AbortSignal.timeout(5000)\n'
  }
  const p1 = (name) =>
    withTree(P1_TREE, (root) => (listBudgetFiles(join(root, 'src')).includes(name) ? 1 : 0))
  const p1ae = () => withTree(P1_TREE, (root) => listTestFiles(join(root, 'src')).join(','))
  const report = (col) =>
    withTree(
      { 'src/a.test.ts': 'const T = 30_000\nsetTimeout(f, T)\nsetTimeout(g, 2700)\n' },
      (root) => {
        const lines = []
        const [log, err] = [console.log, console.error]
        console.log = (line) => lines.push(line)
        console.error = () => {}
        try {
          runCli(root, ['--report'], [{ file: 'a.test.ts', value: '2700', count: 1, reason: 'r' }])
        } finally {
          console.log = log
          console.error = err
        }
        return lines
          .filter((l) => l.startsWith('deadline\t'))
          .map((l) =>
            []
              .concat(col)
              .map((c) => l.split('\t')[c])
              .join('|')
          )
          .join(' § ')
      }
    )

  // [ID, 지점, 규칙 조각, 기대, 소스, 측정, 기존 UT]
  // 기대는 규칙 원문 기준. 배율 대조가 의미 있는 분기는 같은 소스의 scaleMs 판본을 'ID·s' 로 둔다.
  const SLEEP = 'const sleep = (ms) => new Promise((r) => setTimeout(r, ms))'
  const B = [
    // P2′ 형태 — ΔV1 P2 7형태 + named
    [
      'F01',
      'P2′',
      'timer 전역 setTimeout 둘째 인자',
      1,
      `setTimeout(f, 5000)`,
      v,
      "'P2 — timer 전역'"
    ],
    [
      'F02',
      'P2′',
      'timer globalThis.',
      1,
      `globalThis.setTimeout(f, 5000)`,
      v,
      "'P2 — timer globalThis'"
    ],
    ['F03', 'P2′', 'timer window.', 1, `window.setTimeout(f, 5000)`, v, "'P2 — timer window'"],
    [
      'F04',
      'P2′',
      'timer timers/promises setTimeout 첫 인자 — 별칭 없음',
      1,
      `import { setTimeout } from 'node:timers/promises'\nawait setTimeout(5000)`,
      v,
      '신설(W1)'
    ],
    [
      'F04·s',
      'P2′',
      '같음 — scaleMs',
      0,
      `import { setTimeout } from 'node:timers/promises'\nawait setTimeout(scaleMs(5000))`,
      v,
      '신설(W1s)'
    ],
    [
      'F05',
      'P2′',
      'timer timers/promises import 별칭',
      1,
      `import { setTimeout as sleep } from 'node:timers/promises'\nawait sleep(5000)`,
      v,
      "'P2 — timer timers/promises'"
    ],
    ['F06', 'P2′', 'method x.setTimeout(N)', 1, `socket.setTimeout(5000)`, v, "'P2 — method'"],
    [
      'F07',
      'P2′',
      'abort AbortSignal.timeout',
      1,
      `const s = AbortSignal.timeout(5000)`,
      v,
      "'P2 — abort'"
    ],
    [
      'F08',
      'P2′',
      'deadline now 식 + N',
      1,
      `const d = Date.now() + 5000`,
      v,
      "'P2 — deadline now()+N'"
    ],
    [
      'F09',
      'P2′',
      'deadline N + now 식',
      1,
      `const d = 5000 + performance.now()`,
      v,
      "'P2 — deadline N+now()'"
    ],
    [
      'F10',
      'P2′',
      'deadline 비교 < (now 왼쪽)',
      1,
      `while (Date.now() - t < 5000) {}`,
      v,
      "'P2 — deadline <'"
    ],
    [
      'F11',
      'P2′',
      'deadline 비교 <=',
      1,
      `while (Date.now() - t <= 5000) {}`,
      v,
      "'P2 — deadline <='"
    ],
    [
      'F12',
      'P2′',
      'deadline 비교 >',
      1,
      `if (Date.now() - t > 5000) throw e`,
      v,
      "'P2 — deadline >'"
    ],
    [
      'F13',
      'P2′',
      'deadline 비교 >= (now 오른쪽)',
      1,
      `if (5000 >= Date.now() - t) ok()`,
      v,
      "'P2 — deadline >='"
    ],
    ['F14', 'P2′·P8', 'deadline += N', 1, `let d = Date.now()\nd += 5000`, v, "'P8 += 마감'"],
    [
      'F15',
      'P2′·P8',
      'elapsed expect(now 식).toBeLessThan(N)',
      1,
      `expect(Date.now() - start).toBeLessThan(5000)`,
      v,
      "'P2 — elapsed'"
    ],
    [
      'F16',
      'P2′·P8',
      'elapsed toBeLessThanOrEqual',
      1,
      `expect(performance.now() - s).toBeLessThanOrEqual(5000)`,
      v,
      "'P2 — elapsed OrEqual'"
    ],
    [
      'F17',
      'P2′·P8',
      'elapsed 역방향 expect(N).toBeGreaterThan(now 식)',
      1,
      `expect(5000).toBeGreaterThan(Date.now() - s)`,
      v,
      "'P8 역방향 상한 단언'"
    ],
    [
      'F18',
      'P2′·P8',
      'elapsed 역방향 toBeGreaterThanOrEqual',
      1,
      `expect(5000).toBeGreaterThanOrEqual(Date.now() - s)`,
      v,
      '신설(V-gte)'
    ],
    ['F19', 'P2′', 'option /timeout/i 키', 1, `pool({ timeoutMs: 5000 })`, v, "'P2 — option 키'"],
    [
      'F20',
      'P2′',
      'option /timeout/i 이름 속성에 담긴 객체의 숫자 속성',
      1,
      `pool({ timeouts: { connectMs: 5000 } })`,
      v,
      "'P2 — option 중첩 timeouts'"
    ],
    [
      'F21',
      'P2′',
      'option /timeout/i 이름 변수에 담긴 객체',
      1,
      `const timeouts = { commandMs: 5000 }`,
      v,
      "'P2 — option timeout 변수의 객체'"
    ],
    [
      'F22',
      'P2′',
      'param /timeout/i 매개변수 기본값',
      1,
      `function fixture(timeoutMs = 5000) {}`,
      v,
      "'P2 — param'"
    ],
    [
      'F23',
      'P2′',
      'named 이름 변수 초기값',
      1,
      `const timeoutMs = 5000\nawait waitUntil(s, timeoutMs)`,
      v,
      "'P2′ named 위치 인자로 넘김'"
    ],
    [
      'F24',
      'P2′',
      'named 식별자 대입',
      1,
      `let timeoutMs\ntimeoutMs = 5000\nawait waitUntil(s, timeoutMs)`,
      v,
      '신설(M21b)'
    ],
    [
      'F25',
      'P2′',
      '라벨 밖 이름은 자리 아님',
      0,
      `pool({ delayMs: 5000 })\nfunction f(delayMs = 5000) {}`,
      v,
      "'P2 — 라벨 밖 이름(delayMs)'"
    ],
    // P2′ 호출 대상 해석 — B1·B2·promisify(x)·util.promisify(x)·import 별칭
    ['C01', 'P2′', '호출 대상 B1 래퍼 ( )', 1, `;(setTimeout)(f, 5000)`, v, '신설(V-peel)'],
    [
      'C02',
      'P2′',
      '호출 대상 B1 래퍼 as',
      1,
      `;(setTimeout as typeof setTimeout)(f, 5000)`,
      v,
      '신설'
    ],
    [
      'C03',
      'P2′',
      '호출 대상 B2 변수 초기값(재대입 없음)',
      1,
      `const st = setTimeout\nst(f, 5000)`,
      v,
      "'P2′ setTimeout 별칭'"
    ],
    [
      'C05',
      'P2′',
      '호출 대상 promisify(x)',
      1,
      `import { execFile } from 'node:child_process'\nawait promisify(execFile)(c, a, { timeout: 10 })`,
      v,
      "'P4′ 자식 프로세스 …'"
    ],
    [
      'C06',
      'P2′',
      '호출 대상 util.promisify(x)',
      1,
      `import util from 'node:util'\nimport { execFile } from 'node:child_process'\nawait util.promisify(execFile)(c, a, { timeout: 10 })`,
      v,
      '신설(V-util)'
    ],
    [
      'C07',
      'P2′',
      '호출 대상 child_process import 별칭',
      1,
      `import { execFile as run } from 'node:child_process'\nrun(c, a, { timeout: 10 })`,
      v,
      "'P4′ 자식 프로세스 …'"
    ],
    [
      'C08',
      'P2′',
      '호출 대상 B2 별칭 AbortSignal.timeout',
      1,
      `const t = AbortSignal.timeout\nt(5000)`,
      v,
      "'P2′ AbortSignal.timeout 별칭'"
    ],
    // P2′ 슬롯
    [
      'S01',
      'P2′',
      'option 단축 속성(이름 변수가 아닌 매개변수 경유)',
      1,
      `function run(timeoutMs) { return pool({ timeoutMs }) }\nrun(5000)`,
      v,
      "'P2′ 단축 속성 — 이름 변수가 아닌 매개변수 경유'"
    ],
    ['S02', 'P2′', 'option 대입 o.k = v', 1, `socket.timeout = 5000`, v, "'P2′ 속성 대입'"],
    ['S03', 'P2′', "option 대입 o['k'] = v", 1, `o['timeoutMs'] = 5000`, v, '신설(V-elem)'],
    ['S04', 'P2′', 'option 대입 ??=', 1, `opts.timeoutMs ??= 5000`, v, "'P2′ ??= 대입'"],
    ['S05', 'P2′', 'option 대입 ||=', 1, `opts.timeoutMs ||= 5000`, v, '신설(V-oreq)'],
    [
      'S06',
      'P2′',
      'option 대입 — 소유 객체 이름이 /timeout/i',
      1,
      `timeouts.connectMs = 5000`,
      v,
      "'P2′ timeouts 소유 객체 대입'"
    ],
    ['S07', 'P2′', 'option 클래스 필드', 1, `class F { timeoutMs = 5000 }`, v, "'P2′ 클래스 필드'"],
    [
      'S08',
      'P2′',
      '중첩 timeouts 소유 — 바인딩 참조(속성)',
      1,
      `const t = { connectMs: 1000 }\npool({ timeouts: t })`,
      v,
      "'P2′ timeouts 소유는 바인딩 참조로도 본다'"
    ],
    [
      'S08·n',
      'P2′',
      '같음 — 라벨 밖 속성의 참조는 소유 아님',
      0,
      `const t = { connectMs: 1000 }\npool({ other: t })`,
      v,
      "'P2′ timeouts 소유는 바인딩 참조로도 본다'"
    ],
    [
      'S09',
      'P2′',
      '중첩 timeouts 소유 — 바인딩 참조(단축 속성)',
      1,
      `const t = { connectMs: 1000 }\nconst timeouts = t\npool({ timeouts })`,
      v,
      '신설'
    ],
    [
      'S10',
      'P2′',
      'param 구조 분해 매개변수 기본값',
      1,
      `const f = ({ timeoutMs = 5000 } = {}) => 0`,
      v,
      "'P2′ 구조 분해 매개변수 기본값 (Y11)'"
    ],
    [
      'S11',
      'P2′',
      'param 구조 분해 변수 기본값',
      1,
      `const { timeoutMs = 5000 } = o`,
      v,
      "'P2′ 구조 분해 변수 기본값'"
    ],
    [
      'S12',
      'P2′',
      'param 이름 = 속성 이름 우선',
      1,
      `function f({ timeout: t = 5000 } = {}) { return t }`,
      v,
      "'P2′ 이름 바꾼 구조 분해'"
    ],
    [
      'S13',
      'P2′',
      'param 배열 구조 분해 기본값',
      1,
      `const [timeoutMs = 5000] = l`,
      v,
      "'P2′ 배열 구조 분해 기본값'"
    ],
    // P3′ 값 해석 B0~B7
    [
      'V01',
      'P3′',
      'B0 가림 — 리터럴 블록이 앞',
      1,
      `it('b', () => { const t = 5000; setTimeout(f, t) })\nit('a', () => { const t = scaleMs(5000); setTimeout(f, t) })`,
      v,
      "'P3′ 가림 …'"
    ],
    [
      'V02',
      'P3′',
      'B0 가림 — 리터럴 블록이 뒤',
      1,
      `it('a', () => { const t = scaleMs(5000); setTimeout(f, t) })\nit('b', () => { const t = 5000; setTimeout(f, t) })`,
      v,
      "'P3′ 가림 …'"
    ],
    [
      'V03',
      'P3′',
      'B1 래퍼 ( )·as',
      1,
      `setTimeout(f, (5000 as number))`,
      v,
      "'P3′ 조건식 양쪽 · 뺄셈 · as 래퍼'"
    ],
    [
      'V04',
      'P3′',
      'B2 변수 초기값',
      1,
      `const T = 30_000\nsetTimeout(f, T)`,
      v,
      "'P3 — 같은 파일 const …'"
    ],
    [
      'V05',
      'P3′',
      'B2 같은 파일 대입 =',
      1,
      `let t = scaleMs(500)\nt = 5000\nsetTimeout(f, t)`,
      v,
      "'P3′ let 재대입 값도 후보다'"
    ],
    ['V06', 'P3′', 'B2 같은 파일 대입 ??=', 1, `let t\nt ??= 5000\nsetTimeout(f, t)`, v, '신설'],
    ['V07', 'P3′', 'B2 같은 파일 대입 ||=', 1, `let t\nt ||= 5000\nsetTimeout(f, t)`, v, '신설'],
    [
      'V08',
      'P3′',
      'B3 구조 분해 원천 멤버',
      1,
      `const { ms } = { ms: 5000 }\nsetTimeout(f, ms)`,
      v,
      "'P3′ 리터럴 구조 분해'"
    ],
    [
      'V09',
      'P3′',
      'B3 구조 분해 매개변수 ← 호출 인자 객체',
      1,
      `function wait({ ms }) { return new Promise((r) => setTimeout(r, ms)) }\nawait wait({ ms: 5000 })`,
      v,
      "'P3′ 구조 분해 매개변수 ← 호출 인자 객체'"
    ],
    [
      'V10',
      'P3′',
      'B4 매개변수 ← 기본값',
      1,
      `const sleep = (ms = 5000) => new Promise((r) => setTimeout(r, ms))\nawait sleep()`,
      v,
      '신설'
    ],
    [
      'V11',
      'P3′',
      'B4 매개변수 ← 호출부 위치 인자(화살표)',
      1,
      `${SLEEP}\nawait sleep(5000)`,
      v,
      "'P3′ 같은 파일 함수 매개변수 ← 호출 인자'"
    ],
    [
      'V12',
      'P3′',
      'B4 함수 선언 — 호출마다 값',
      1,
      `function wait(ms) { return new Promise((r) => setTimeout(r, ms)) }\nawait wait(5000)\nawait wait(400)`,
      v,
      "'P3′ 함수 선언의 호출마다 값'"
    ],
    [
      'V13',
      'P3′',
      'B4 객체 메서드',
      1,
      `const h = { wait(ms) { return new Promise((r) => setTimeout(r, ms)) } }\nawait h.wait(5000)`,
      v,
      "'P3′ 객체 메서드'"
    ],
    [
      'V14',
      'P3′',
      'B4 클래스 메서드',
      1,
      `class F { wait(ms) { return new Promise((r) => setTimeout(r, ms)) } }\nawait new F().wait(5000)`,
      v,
      "'P3′ 클래스 메서드'"
    ],
    [
      'V15',
      'P3′',
      'B4 속성 화살표',
      1,
      `const h = { wait: (ms) => new Promise((r) => setTimeout(r, ms)) }\nawait h.wait(5000)`,
      v,
      "'P3′ 속성 화살표'"
    ],
    [
      'V15b',
      'P3′',
      'B4 함수 식을 담은 변수',
      1,
      `const sleep = function (ms) { return new Promise((r) => setTimeout(r, ms)) }\nawait sleep(5000)`,
      v,
      '신설'
    ],
    [
      'V15c',
      'P3′',
      'B4 클래스 속성 화살표',
      1,
      `class F { wait = (ms) => new Promise((r) => setTimeout(r, ms)) }\nawait new F().wait(5000)`,
      v,
      '신설'
    ],
    [
      'V16',
      'P3′',
      'B4 호출 결과 ← 반환식(블록 return)',
      1,
      `function budget() { return 5000 }\nsetTimeout(f, budget())`,
      v,
      "'P3′ 반환식'"
    ],
    [
      'V17',
      'P3′',
      'B4 호출 결과 ← 반환식(화살표 식 몸통)',
      1,
      `const budget = () => 5000\nsetTimeout(f, budget())`,
      v,
      '신설'
    ],
    [
      'V18',
      'P3′',
      'B5 단축 속성 멤버',
      1,
      `const delay = 5000\nconst cfg = { delay }\nsetTimeout(f, cfg.delay)`,
      v,
      '신설'
    ],
    [
      'V19',
      'P3′',
      'B6 객체 리터럴 멤버 — 속성 접근',
      1,
      `const cfg = { delay: 5000 }\nsetTimeout(f, cfg.delay)`,
      v,
      "'P3′ 멤버 접근'"
    ],
    [
      'V20',
      'P3′',
      'B6 객체 리터럴 멤버 — 요소 접근',
      1,
      `const cfg = { delay: 5000 }\nsetTimeout(f, cfg['delay'])`,
      v,
      "'P3′ 요소 접근'"
    ],
    [
      'V21',
      'P3′',
      'B6 전개 멤버',
      1,
      `const base = { delay: 5000 }\nconst cfg = { ...base }\nsetTimeout(f, cfg.delay)`,
      v,
      '신설(V-spreadval)'
    ],
    ['V22', 'P3′', 'B7 ?? 왼쪽', 1, `const t = 5000\nsetTimeout(f, t ?? 0)`, v, '신설(V-or)'],
    [
      'V23',
      'P3′',
      'B7 ?? 오른쪽',
      1,
      `pool({ timeoutMs: x ?? 2000 })`,
      v,
      "'P3 — 같은 파일 const …'"
    ],
    ['V24', 'P3′', 'B7 || 왼쪽', 1, `const t = 5000\nsetTimeout(f, t || 0)`, v, '신설'],
    [
      'V25',
      'P3′',
      'B7 || 오른쪽',
      1,
      `pool({ timeoutMs: x || 2000 })`,
      v,
      "'P3 — 같은 파일 const …'"
    ],
    ['V26', 'P3′', 'B7 조건식 앞쪽', 1, `setTimeout(f, fast ? 5000 : 500)`, v, '신설'],
    [
      'V27',
      'P3′',
      'B7 조건식 뒤쪽',
      1,
      `setTimeout(f, fast ? 500 : 5000)`,
      v,
      "'P3′ 조건식 양쪽 · 뺄셈 · as 래퍼'"
    ],
    ['V28', 'P3′', 'B7 산술 +', 1, `setTimeout(f, 500 + 500)`, v, "'P3 — 같은 파일 const …'"],
    [
      'V29',
      'P3′',
      'B7 산술 -',
      1,
      `setTimeout(f, 6000 - 1000)`,
      v,
      "'P3′ 조건식 양쪽 · 뺄셈 · as 래퍼'"
    ],
    ['V30', 'P3′', 'B7 산술 *', 1, `setTimeout(f, 60 * 1000)`, v, "'P3 — 같은 파일 const …'"],
    ['V31', 'P3′', 'B7 산술 / — 임계 아래', 0, `setTimeout(f, 1500 / 2)`, v, '신설(V-div)'],
    ['V31b', 'P3′', 'B7 산술 / — 임계 이상', 1, `setTimeout(f, 10000 / 2)`, v, '신설(V-div)'],
    [
      'V32',
      'P3′',
      'B7 산술 배율 피연산자',
      0,
      `setTimeout(f, 60 * scaleMs(1000))`,
      v,
      "'P3 — 같은 파일 const …'"
    ],
    [
      'V33',
      'P3′',
      'B7 여러 값 × 산술 — 조건식',
      1,
      `setTimeout(f, (fast ? 2 : 5) * 1000)`,
      v,
      '신설(W2)'
    ],
    [
      'V34',
      'P3′',
      'B7 여러 값 × 산술 — 변수 경유',
      1,
      `const n = fast ? 2 : 5\nsetTimeout(f, n * 1000)`,
      v,
      '신설(W2b)'
    ],
    [
      'V35',
      'P3′',
      'B7 여러 값 × 산술 — 한 조합만 배율',
      1,
      `setTimeout(f, (fast ? scaleMs(2) : 5) * 1000)`,
      v,
      '신설'
    ],
    [
      'V36',
      'P3′',
      'B7 여러 값 × 산술 — 전부 배율이면 배율 자리 1(위반 0)',
      1,
      `setTimeout(f, (fast ? scaleMs(2) : scaleMs(5)) * 1000)`,
      d,
      '신설'
    ],
    [
      'V37',
      'P3′',
      'import 식별자는 건너뜀(경계)',
      0,
      `import { T } from './t'\nsetTimeout(f, T)`,
      v,
      "'P3 — 같은 파일 const …'"
    ],
    // P4′ 임계
    ['T01', 'P4′', '임계 1000 미만 통과', 0, `setTimeout(f, 999)`, v, "'P4 — 임계 …'"],
    ['T02', 'P4′', '임계 1000 이상 위반', 1, `setTimeout(f, 1000)`, v, "'P4 — 임계 …'"],
    ['T03', 'P4′', 'abort 무임계', 1, `AbortSignal.timeout(10)`, v, "'P4 — 임계 …'"],
    [
      'T04',
      'P4′',
      '자식 프로세스 아닌 옵션은 임계',
      0,
      `pool({ timeoutMs: 10 })`,
      v,
      "'P4 — 임계 …'"
    ],
    ...['execFile', 'execFileSync', 'spawn', 'spawnSync', 'exec', 'execSync', 'fork'].map(
      (n, i) => [
        `T0${5 + i}`.replace('T010', 'T10').replace('T011', 'T11'),
        'P4′',
        `자식 프로세스 무임계 — ${n}`,
        1,
        `${n}(c, a, { timeout: 10 })`,
        v,
        "'P4 — 임계 …'"
      ]
    ),
    [
      'T12',
      'P4′',
      '자식 프로세스 — 이름공간 호출',
      1,
      `cp.execFile(c, a, { timeout: 10 })`,
      v,
      "'P4 — 임계 …'"
    ],
    [
      'T13',
      'P4′',
      '자식 프로세스 객체 사용 자리 — 바인딩 참조',
      1,
      `const opts = { timeout: 10 }\nexecFile(c, a, opts)`,
      v,
      "'P4′ 자식 프로세스 …'"
    ],
    [
      'T14',
      'P4′',
      '자식 프로세스 객체 사용 자리 — 전개',
      1,
      `const base = { timeout: 10 }\nexecFile(c, a, { ...base })`,
      v,
      "'P4′ 자식 프로세스 …'"
    ],
    [
      'T15',
      'P4′',
      '자식 프로세스 객체 사용 자리 — 대입 대상 객체',
      1,
      `const o = {}\no.timeout = 10\nexecFile(c, a, o)`,
      v,
      "'P4′ 자식 프로세스 …'"
    ],
    [
      'T16',
      'P4′',
      '자식 프로세스 — promisify 변수',
      1,
      `import { execFile } from 'node:child_process'\nconst run = promisify(execFile)\nawait run(c, a, { timeout: 10 })`,
      v,
      "'P4′ 자식 프로세스 …'"
    ],
    [
      'T17',
      'P4′',
      '자식 프로세스 아닌 호출의 참조',
      0,
      `const opts = { timeout: 10 }\npool(opts)`,
      v,
      "'P4′ 자식 프로세스 …'"
    ],
    // P5′ 제외 — ΔV1 P5 + 사용 자리
    [
      'X01',
      'P5′',
      'scaleMs 인자 제외',
      0,
      `const ms = scaleMs({ timeoutMs: 5000 }.timeoutMs)`,
      v,
      '신설'
    ],
    [
      'X02',
      'P5′',
      'scaledBudget 인자 제외',
      0,
      `const b = scaledBudget({ hookTimeout: 5000 })`,
      v,
      "'P5 — …'"
    ],
    [
      'X03',
      'P5′',
      'vi.setConfig 인자 제외 — (H′) 자리 0',
      0,
      `vi.setConfig({ testTimeout: 15_000 })`,
      d,
      "'리터럴 vi.setConfig 는 걸리고 scaledBudget 는 통과한다'"
    ],
    [
      'X04',
      'P5′',
      'vi.waitFor 옵션(둘째 인자) 제외',
      0,
      `await vi.waitFor(cb, { timeout: 4000 })`,
      v,
      "'P5 — …'"
    ],
    [
      'X05',
      'P5′',
      'vi.waitFor 첫 인자는 센다',
      1,
      `await vi.waitFor(() => setTimeout(f, 4000))`,
      v,
      "'P5 — …'"
    ],
    [
      'X06',
      'P5′',
      'it 옵션 객체 제외 — (H′) 자리 0',
      0,
      `it('x', { timeout: 15000 }, fn)`,
      d,
      "'옵션 객체 timeout 과 훅 타임아웃도 같다'"
    ],
    [
      'X07',
      'P5′',
      'test 옵션 객체 제외 — (H′) 자리 0',
      0,
      `test('x', { timeout: 5000 }, async () => {})`,
      d,
      '신설'
    ],
    [
      'X08',
      'P5′',
      'describe 옵션 객체 제외 — (H′) 자리 0',
      0,
      `describe('x', { timeout: 5000 }, () => {})`,
      d,
      '신설'
    ],
    [
      'X09',
      'P5′',
      '훅 옵션 객체 제외 — (H′) 자리 0',
      0,
      `beforeEach(async () => {}, { timeout: 5000 })`,
      d,
      '신설'
    ],
    [
      'X10',
      'P5′',
      'fn 뒤 인자(변수) 제외 — (H′) 자리 0',
      0,
      `const opts = { timeout: 5000 }\nit('x', async () => {}, opts)`,
      d,
      '신설'
    ],
    [
      'X11',
      'P5′',
      'matcher 피연산자 제외',
      0,
      `expect(x).toMatchObject({ timeout: 60_000 })`,
      v,
      "'P5 — …'"
    ],
    [
      'X12',
      'P5′',
      'expect.<helper> 인자 제외',
      0,
      `expect(x).toEqual(expect.objectContaining({ timeoutMs: 60_000 }))`,
      v,
      "'P5 — …'"
    ],
    [
      'X13',
      'P5′',
      'expect(x) 의 x 는 센다',
      1,
      `await expect(wait({ timeoutMs: 1000 })).resolves.toBe('settled')`,
      v,
      "'P5 — …'"
    ],
    [
      'X14',
      'P5′',
      'elapsed 상한 인자는 센다 — 직접',
      1,
      `expect(Date.now() - start).toBeLessThan(5000)`,
      v,
      "'P5 — …'"
    ],
    [
      'X15',
      'P5′',
      'elapsed 상한 인자는 센다 — matcher 콜백 안',
      1,
      `expect(x).toSatisfy(() => expect(Date.now() - s).toBeLessThan(5000))`,
      v,
      '신설(V-expectx)'
    ],
    [
      'X16',
      'P5′',
      '사용 자리 — 참조 전부 제외면 제외(Y2b)',
      0,
      `const probeOpts = { timeout: 5000 }\nawait vi.waitFor(() => {}, probeOpts)`,
      v,
      "'P5′ 변수에 담긴 슬롯 …'"
    ],
    [
      'X17',
      'P5′',
      '사용 자리 — 단축 속성 참조 제외(Y2e)',
      0,
      `const timeout = 4000\nawait vi.waitFor(cb, { timeout })`,
      v,
      "'P5′ 변수에 담긴 슬롯 …'"
    ],
    [
      'X18',
      'P5′',
      '사용 자리 — matcher 피연산자 참조 제외',
      0,
      `const timeoutMs = 5000\nexpect(c.timeoutMs).toBe(timeoutMs)`,
      v,
      "'P5′ 변수에 담긴 슬롯 …'"
    ],
    [
      'X19',
      'P5′',
      '사용 자리 — 하나라도 비제외면 센다(Y2f)',
      1,
      `const o = { timeout: 5000 }\nawait vi.waitFor(cb, o)\npool(o)`,
      v,
      "'P5′ 변수에 담긴 슬롯 …'"
    ],
    [
      'X20',
      'P5′',
      '사용 자리 — 참조 0 이면 선언 자리',
      1,
      `const timeoutMs = 5000`,
      v,
      "'P5′ 변수에 담긴 슬롯 …'"
    ],
    [
      'X21',
      'P5′',
      '사용 자리 — 재귀(변수 → 변수)',
      0,
      `const a = { timeout: 5000 }\nconst b = a\nawait vi.waitFor(cb, b)`,
      v,
      '신설'
    ],
    [
      'X22',
      'P5′',
      '사용 자리 — 함수 인자는 넘지 않는다',
      1,
      `function w(opts) { return vi.waitFor(cb, opts) }\nconst o = { timeout: 5000 }\nawait w(o)`,
      v,
      '신설'
    ],
    // P7′ 이중 배율
    [
      'W01',
      'P7′',
      '인라인 객체 안 scaleMs',
      1,
      `await vi.waitFor(cb, { timeout: scaleMs(4000) })`,
      w,
      "'P7 — …'"
    ],
    ['W02', 'P7′', '인라인 숫자 scaleMs', 1, `await vi.waitFor(cb, scaleMs(4000))`, w, "'P7 — …'"],
    [
      'W03',
      'P7′',
      'B 식별자 → 객체(Y2)',
      1,
      `const probeOpts = { timeout: scaleMs(5000) }\nawait vi.waitFor(() => {}, probeOpts)`,
      w,
      "'P7′ …'"
    ],
    [
      'W04',
      'P7′',
      'B 식별자 → 숫자',
      1,
      `const w = scaleMs(4000)\nawait vi.waitFor(cb, w)`,
      w,
      "'P7′ …'"
    ],
    [
      'W05',
      'P7′',
      'B 단축 속성',
      1,
      `const timeout = scaleMs(4000)\nawait vi.waitFor(cb, { timeout })`,
      w,
      '신설'
    ],
    [
      'W06',
      'P7′',
      'B 전개',
      1,
      `const base = { timeout: scaleMs(4000) }\nawait vi.waitFor(cb, { ...base, interval: 50 })`,
      w,
      "'P7′ …'"
    ],
    [
      'W07',
      'P7′',
      'B 멤버',
      1,
      `const cfg = { opts: { timeout: scaleMs(4000) } }\nawait vi.waitFor(cb, cfg.opts)`,
      w,
      '신설'
    ],
    [
      'W08',
      'P7′',
      'B 호출 반환',
      1,
      `const opts = () => ({ timeout: scaleMs(4000) })\nawait vi.waitFor(cb, opts())`,
      w,
      '신설'
    ],
    [
      'W09',
      'P7′',
      'vi.waitFor 별칭',
      1,
      `const wf = vi.waitFor\nawait wf(cb, { timeout: scaleMs(4000) })`,
      w,
      "'P7′ …'"
    ],
    [
      'W10',
      'P7′',
      '기준값만이면 0(Y2b)',
      0,
      `const probeOpts = { timeout: 5000 }\nawait vi.waitFor(() => {}, probeOpts)`,
      w,
      "'P7′ …'"
    ],
    [
      'W11',
      'P7′',
      '콜백 함수 안은 보지 않는다',
      0,
      `await vi.waitFor(() => f(scaleMs(4000)))`,
      w,
      "'P7 — …'"
    ],
    // P8 now 식
    [
      'N01',
      'P8',
      'now 원천 Date.now()',
      1,
      `const d = Date.now() + 5000`,
      v,
      "'P2 — deadline now()+N'"
    ],
    [
      'N02',
      'P8',
      'now 원천 performance.now()',
      1,
      `const d = 5000 + performance.now()`,
      v,
      "'P2 — deadline N+now()'"
    ],
    [
      'N03',
      'P8',
      'now 원천 new Date().getTime()',
      1,
      `const d = new Date().getTime() + 5000`,
      v,
      "'P8 new Date().getTime()'"
    ],
    [
      'N04',
      'P8',
      'now 원천 new Date().valueOf()',
      1,
      `const d = new Date().valueOf() + 5000`,
      v,
      '신설(V-valueOf)'
    ],
    [
      'N05',
      'P8',
      'B 변수(Y5)',
      1,
      `const start = Date.now()\nconst elapsed = Date.now() - start\nexpect(elapsed).toBeLessThan(5000)`,
      v,
      "'P8 경과 변수 상한 단언 (Y5)'"
    ],
    [
      'N06',
      'P8',
      'B 변수 — 파생 마감(Y5b)',
      1,
      `const start = Date.now()\nconst deadline = start + 5000\nwhile (Date.now() < deadline) {}`,
      v,
      "'P8 파생 마감 (Y5b)'"
    ],
    ['N07', 'P8', 'B 대입', 1, `let s\ns = Date.now()\nconst d = s + 5000`, v, '신설'],
    ['N08', 'P8', 'B 멤버', 1, `const c = { at: Date.now() }\nconst d = c.at + 5000`, v, '신설'],
    ['N09', 'P8', 'B 조건', 1, `const d = (hi ? performance.now() : Date.now()) + 5000`, v, '신설'],
    [
      'N10',
      'P8',
      '산술(now - start)',
      1,
      `const t0 = performance.now()\nconst el = performance.now() - t0\nif (el > 5000) throw e`,
      v,
      "'P8 경과 변수 비교'"
    ],
    [
      'N11',
      'P8',
      '호출 인자 안은 now 식 아님',
      0,
      `const h = render(Date.now())\nconst n = h + 5000`,
      v,
      '신설'
    ],
    [
      'N12',
      'P8',
      '객체 안은 now 식 아님(Y5i)',
      0,
      `const h = render({ at: Date.now() })\nconst n = h + 5000`,
      v,
      "'P8 하한 단언·…'"
    ],
    [
      'N13',
      'P8',
      '배열 안은 now 식 아님',
      0,
      `const xs = [Date.now()]\nconst n = xs + 5000`,
      v,
      '신설'
    ],
    [
      'N14',
      'P8',
      '하한 단언은 자리 아님(Y5g)',
      0,
      `expect(Date.now() - s).toBeGreaterThanOrEqual(5000)`,
      v,
      "'P8 하한 단언·…'"
    ],
    [
      'N15',
      'P8',
      'now 식끼리 비교는 자리 아님',
      1,
      `const d = Date.now() + scaleMs(5000)\nwhile (Date.now() < d) {}`,
      d,
      "'P8 하한 단언·…'"
    ],
    // P9 자리 동일성
    [
      'I01',
      'P9',
      '한 리터럴은 한 자리',
      1,
      `const T = 30_000\nsetTimeout(f, T)\nsetTimeout(g, T)`,
      v,
      "'P9 …'"
    ],
    [
      'I02',
      'P9',
      '호출마다 다른 리터럴은 따로',
      2,
      `${SLEEP}\nawait sleep(5000)\nawait sleep(5000)`,
      v,
      "'P9 …'"
    ],
    [
      'I03',
      'P9',
      '제외된 슬롯은 건너뛴다',
      1,
      `const T = 5000\nawait vi.waitFor(cb, { timeout: T })\nsetTimeout(f, T)`,
      v,
      '신설'
    ],
    [
      'I06',
      'P9',
      '자리 줄 = 슬롯 줄 · 값이 다른 줄이면 값 줄',
      ':2 (값 :1)',
      `const T = 30_000\nsetTimeout(f, T)`,
      (code) => analyzeScale('a.test.ts', code, [])[0].split(' ').slice(0, 3).join(' '),
      "'P9 …'"
    ],
    [
      'I04',
      'P9',
      '--report 셋째 열 — 배율 아님 · 의미 값',
      'LITERAL § semantic',
      2,
      report,
      "'--report deadline 행 …'(LITERAL) + 신설(semantic)"
    ],
    [
      'I05',
      'P9',
      '--report 다섯째 열 값 · 여섯째 열 원문',
      '30_000|setTimeout(f, T) § 2700|setTimeout(g, 2700)',
      null,
      () => report([4, 5]),
      "'--report deadline 행 …'(값) + 신설(원문)"
    ],
    // P1 파일 범위 — ΔV1 P1 그대로
    ['P01', 'P1', '(H′) 범위 *.test.ts', 1, 'a.test.ts', p1, "'P1 — …'"],
    ['P02', 'P1', '(H′) 범위 *.testfixture.ts', 1, 'b.testfixture.ts', p1, "'P1 — …'"],
    ['P03', 'P1', '(H′) 범위 *.testfixture.tsx(JSX)', 1, 'c.testfixture.tsx', p1, "'P1 — …'"],
    ['P04', 'P1', '그 밖의 .ts 무시', 0, 'd.ts', p1, "'P1 — …'"],
    ['P05', 'P1', '(A)~(E) 는 *.test.ts 만', 'a.test.ts', null, p1ae, "'P1 — …'"],
    // P6 허용 목록 — ΔV1 P6 그대로
    ['A01', 'P6', 'count = 자리 수면 통과', 0, ['a', sites(2), ENTRY], a6, "'P6 — 항목 count …'"],
    [
      'A02',
      'P6',
      '자리가 count 보다 많으면 위반',
      1,
      ['a', sites(3), ENTRY],
      a6,
      "'P6 — 항목 count …'"
    ],
    [
      'A03',
      'P6',
      '자리가 count 보다 적으면 위반',
      1,
      ['a', sites(1), ENTRY],
      a6,
      "'P6 — 항목 count …'"
    ],
    [
      'A04',
      'P6',
      'reason 빈 값 위반',
      1,
      ['a', sites(2), { ...ENTRY, reason: '' }],
      a6,
      "'P6 — 항목 count …'"
    ],
    ['A05', 'P6', '다른 파일 같은 값 위반', 2, ['b', sites(2), ENTRY], a6, "'P6 — 항목 count …'"],
    [
      'A06',
      'P6',
      '미등록 리터럴 위반',
      1,
      ['a', `setTimeout(f, 6000)\n${sites(2)}`, ENTRY],
      a6,
      "'P6 — 항목 count …'"
    ]
  ]

  for (const [id, , rule, expected, code, measure] of B) {
    test(`${id} — ${rule}`, () => {
      const got = code === null ? measure() : measure(code)
      assert.equal(String(got), String(expected))
    })
    if (/^[FCSVN]/.test(id) && measure === v && typeof code === 'string') {
      const scaled = scaledFixture(code)
      if (scaled !== code)
        test(`${id}·scaled — 같은 경로의 배율 입력`, () => assert.equal(v(scaled), 0))
    }
  }
})

// Input fixtures copied from the READY plan; assertions execute the production gate.
describe('노드 종류 표 (0294 ΔV4)', () => {
  const lines = (code, file = 'a.test.ts', allowed = []) => analyzeScale(file, code, [], allowed)
  const vu = (code) => {
    const out = lines(code)
    return `${out.length}/${out.filter((l) => l.includes('판정 불가')).length}`
  }
  const vux = (code) => {
    const out = lines(code, 'a.testfixture.tsx')
    return `${out.length}/${out.filter((l) => l.includes('판정 불가')).length}`
  }
  const w = (code) =>
    scanBudgetSites('a.test.ts', code, []).filter((s) => s.kind === 'waitFor').length
  const d = (code) =>
    scanBudgetSites('a.test.ts', code, []).filter((s) => s.kind === 'deadline').length

  // A 행 — 판정 불가 자리(KF05) 하나를 담은 파일 'a' 와 허용 항목
  const RED = `import { computeDelay } from './d'\nsetTimeout(f, computeDelay())`
  const RED2 = `${RED}\nsetTimeout(g, computeDelay())`
  const ITEM = { file: 'a', reason: 'KF05', count: 1, why: 'w' }
  const allow = ([code, items]) => lines(code, 'a', items).length
  const cli = (files, items, argv = []) => {
    const root = mkdtempSync(join(tmpdir(), 'dv4-'))
    const out = []
    const [log, err] = [console.log, console.error]
    console.log = (l) => out.push(l)
    console.error = (l) => out.push(l)
    try {
      for (const [rel, body] of Object.entries(files)) {
        mkdirSync(join(root, rel, '..'), { recursive: true })
        writeFileSync(join(root, rel), body)
      }
      const code = runCli(root, argv, [], items)
      return { code, out }
    } finally {
      console.log = log
      console.error = err
      rmSync(root, { recursive: true, force: true })
    }
  }

  const P = 'pool({ timeoutMs: X })'
  const nn = (x) => P.replace('X', x)
  // [ID, 칸, 규칙 조각, 기대, 소스, 측정, 출처]
  const C = [
    // KV — 값 자리 식 종류(래퍼를 벗긴 뒤)
    ['KV01', 'KV', '숫자 리터럴 → 숫자', '1/0', `setTimeout(f, 5000)`, vu, 'ΔV3 F01'],
    ['KV02', 'KV', '+ 숫자 리터럴 → 숫자', '1/0', nn('+5000'), vu, '신설'],
    ['KV02b', 'KV', '- 숫자 리터럴 → 숫자(음수 — 임계 아래)', '0/0', nn('-5000'), vu, '신설'],
    ['KV03', 'KV', 'scaleMs(…) → 배율', 1, `setTimeout(f, scaleMs(5000))`, d, 'ΔV3 F01 배율 판본'],
    ['KV04a', 'KV', '래퍼 ( )', '1/0', `setTimeout(f, (5000))`, vu, '신설'],
    ['KV04b', 'KV', '래퍼 as', '1/0', `setTimeout(f, 5000 as number)`, vu, '신설'],
    [
      'KV04c',
      'KV',
      '래퍼 satisfies',
      '1/0',
      `setTimeout(f, 5000 satisfies number)`,
      vu,
      '신설(verify r3 V-satisfies)'
    ],
    [
      'KV04d',
      'KV',
      '래퍼 !',
      '1/0',
      `const d = { ms: 5000 }\nsetTimeout(f, d!.ms)`,
      vu,
      '신설(verify r3 V-nonnull)'
    ],
    ['KV04e', 'KV', '래퍼 <T>x', '1/0', `setTimeout(f, <number>5000)`, vu, '신설'],
    [
      'KV05',
      'KV',
      '산술 + - * / → R4(ΔV3 V28~V36)',
      '1/0',
      `setTimeout(f, (fast ? 2 : 5) * 1000)`,
      vu,
      'ΔV3 V33'
    ],
    [
      'KV06',
      'KV',
      '?? · || → 양쪽(ΔV3 V22~V25)',
      '1/0',
      `const t = 5000\nsetTimeout(f, t ?? 0)`,
      vu,
      'ΔV3 V22'
    ],
    ['KV07', 'KV', '&& → 오른쪽(왼쪽은 숫자 아님)', '1/0', `setTimeout(f, ok && 5000)`, vu, '신설'],
    ['KV08', 'KV', '쉼표 → 오른쪽', '1/0', `setTimeout(f, (g(), 5000))`, vu, '신설'],
    ['KV09', 'KV', '비교·동등·in·instanceof → 숫자 아님', '0/0', nn('a > 1'), vu, '신설'],
    ['KV09b', 'KV', '동등(===) → 숫자 아님', '0/0', nn('a === 1'), vu, '신설'],
    ['KV09c', 'KV', 'in → 숫자 아님', '0/0', nn(`'k' in o`), vu, '신설'],
    ['KV09d', 'KV', 'instanceof → 숫자 아님', '0/0', nn('a instanceof B'), vu, '신설'],
    ['KV10', 'KV', '그 밖 이항 연산(%) → red', '1/1', `setTimeout(f, 10000 % 7)`, vu, '신설'],
    ['KV10b', 'KV', '그 밖 이항 연산(**) → red', '1/1', `setTimeout(f, 10 ** 4)`, vu, '신설'],
    ['KV11', 'KV', '대입 연산 식 → red', '1/1', `let t\nsetTimeout(f, (t = 5000))`, vu, '신설'],
    [
      'KV12',
      'KV',
      '조건식 → 양쪽(ΔV3 V26·V27)',
      '1/0',
      `setTimeout(f, fast ? 5000 : 500)`,
      vu,
      'ΔV3 V26'
    ],
    ['KV13a', 'KV', '숫자 아님 — 문자열', '0/0', nn(`'5000'`), vu, '신설'],
    ['KV13b', 'KV', '숫자 아님 — 치환 없는 템플릿', '0/0', nn('`5000`'), vu, '신설'],
    ['KV13c', 'KV', '숫자 아님 — 템플릿 식', '0/0', nn('`${n}`'), vu, '신설'],
    ['KV13d', 'KV', '숫자 아님 — 정규식', '0/0', nn('/x/'), vu, '신설'],
    ['KV13e', 'KV', '숫자 아님 — true', '0/0', nn('true'), vu, '신설'],
    ['KV13f', 'KV', '숫자 아님 — false', '0/0', nn('false'), vu, '신설'],
    ['KV13g', 'KV', '숫자 아님 — null', '0/0', nn('null'), vu, '신설'],
    ['KV13h', 'KV', '숫자 아님 — 객체 리터럴', '0/0', nn('{}'), vu, '신설'],
    ['KV13i', 'KV', '숫자 아님 — 배열 리터럴', '0/0', nn('[]'), vu, '신설'],
    ['KV13j', 'KV', '숫자 아님 — 함수 식', '0/0', nn('function () {}'), vu, '신설'],
    ['KV13k', 'KV', '숫자 아님 — 화살표 함수', '0/0', nn('() => 0'), vu, '신설'],
    ['KV13l', 'KV', '숫자 아님 — 클래스 식', '0/0', nn('class {}'), vu, '신설'],
    ['KV13m', 'KV', '숫자 아님 — JSX 요소', '0/0', nn('<div></div>'), vux, '신설'],
    ['KV13n', 'KV', '숫자 아님 — JSX 자기 닫힘', '0/0', nn('<div />'), vux, '신설'],
    ['KV13o', 'KV', '숫자 아님 — JSX 조각', '0/0', nn('<></>'), vux, '신설'],
    ['KV13p', 'KV', '숫자 아님 — typeof', '0/0', nn('typeof x'), vu, '신설'],
    ['KV13q', 'KV', '숫자 아님 — void', '0/0', nn('void 0'), vu, '신설'],
    ['KV13r', 'KV', '숫자 아님 — delete', '0/0', nn('delete o.x'), vu, '신설'],
    ['KV13s', 'KV', '숫자 아님 — BigInt 리터럴', '0/0', nn('5000n'), vu, '신설'],
    ['KV13t', 'KV', '숫자 아님 — new', '0/0', nn('new Date()'), vu, '신설'],
    ['KV13u', 'KV', '숫자 아님 — !x', '0/0', nn('!x'), vu, '신설'],
    ['KV14', 'KV', 'await → red', '1/1', `setTimeout(f, await delay)`, vu, '신설'],
    ['KV15', 'KV', 'this → red', '1/1', `function g() { setTimeout(f, this) }`, vu, '신설'],
    ['KV16a', 'KV', '후위 ++ → red', '1/1', `let n = 1\nsetTimeout(f, n++)`, vu, '신설'],
    ['KV16b', 'KV', '전위 ++ → red', '1/1', `let n = 1\nsetTimeout(f, ++n)`, vu, '신설'],
    ['KV16c', 'KV', '~ → red', '1/1', `setTimeout(f, ~n)`, vu, '신설'],
    ['KV16d', 'KV', '리터럴 아닌 - → red', '1/1', `setTimeout(f, -n)`, vu, '신설'],
    ['KV16e', 'KV', '후위 -- → red', '1/1', `let n = 9000\nsetTimeout(f, n--)`, vu, '신설'],
    ['KV16f', 'KV', '전위 -- → red', '1/1', `let n = 9000\nsetTimeout(f, --n)`, vu, '신설'],
    ['KV16g', 'KV', '리터럴 아닌 + → red', '1/1', `setTimeout(f, +n)`, vu, '신설'],
    ['KV17a', 'KV', '그 밖 종류(태그 템플릿) → red', '1/1', 'setTimeout(f, tag`5000`)', vu, '신설'],
    [
      'KV17b',
      'KV',
      '그 밖 종류(yield) → red',
      '1/1',
      `function* g() { setTimeout(f, yield) }`,
      vu,
      '신설'
    ],
    // KD — 식별자의 선언
    [
      'KD01',
      'KD',
      '변수 초기값 + 대입 = ??= ||=(ΔV3 V04~V07)',
      '1/0',
      `let t = scaleMs(500)\nt = 5000\nsetTimeout(f, t)`,
      vu,
      'ΔV3 V05'
    ],
    [
      'KD02',
      'KD',
      '복합 대입이 있는 변수 → red',
      '1/1',
      `let t = 500\nt += 4500\nsetTimeout(f, t)`,
      vu,
      '신설(verify r3 W9)'
    ],
    ['KD03', 'KD', '값 없는 변수 → 숫자 아님', '0/0', `let t\nsetTimeout(f, t)`, vu, '신설'],
    [
      'KD03b',
      'KD',
      'declare 변수 → 경계',
      '0/0',
      `declare const LIMIT: number\nsetTimeout(f, LIMIT)`,
      vu,
      '신설'
    ],
    [
      'KD04a',
      'KD',
      'for-of 변수 → red',
      '1/1',
      `for (const ms of [1000, 5000]) setTimeout(f, ms)`,
      vu,
      '신설'
    ],
    ['KD04b', 'KD', 'for-in 변수 → red', '1/1', `for (const k in o) setTimeout(f, k)`, vu, '신설'],
    [
      'KD05',
      'KD',
      '구조 분해 — 중첩',
      '1/0',
      `const { a: { ms } } = { a: { ms: 5000 } }\nsetTimeout(f, ms)`,
      vu,
      '신설'
    ],
    [
      'KD06',
      'KD',
      '매개변수 — 같은 파일 호출부(ΔV3 V10~V16)',
      '1/0',
      `const sleep = (ms) => new Promise((r) => setTimeout(r, ms))\nawait sleep(5000)`,
      vu,
      'ΔV3 V11'
    ],
    [
      'KD07',
      'KD',
      '매개변수 — 즉시 호출 인자',
      '1/0',
      `await ((ms) => new Promise((r) => setTimeout(r, ms)))(5000)`,
      vu,
      '신설(verify r3 W7)'
    ],
    [
      'KD08a',
      'KD',
      '매개변수 — 호출부 없음, 인자로 넘긴 함수 → 경계',
      '0/0',
      `run((ms) => setTimeout(f, ms))`,
      vu,
      '신설'
    ],
    [
      'KD08b',
      'KD',
      '매개변수 — 호출부 없음, 객체 속성에 둔 함수 → 경계',
      '0/0',
      `const h = { later: (fn, ms) => setTimeout(fn, ms) }`,
      vu,
      '신설'
    ],
    [
      'KD08c',
      'KD',
      '매개변수 — 호출부 없음, 배열 요소 함수 → 경계',
      '0/0',
      `const hs = [(ms) => setTimeout(f, ms)]`,
      vu,
      '신설'
    ],
    [
      'KD08d',
      'KD',
      '매개변수 — 호출부 없음, 반환한 함수 → 경계',
      '0/0',
      `function mk() { return (ms) => setTimeout(f, ms) }`,
      vu,
      '신설'
    ],
    [
      'KD08e',
      'KD',
      '매개변수 — 호출부 없음, 클래스 속성 함수 → 경계',
      '0/0',
      `class H { later = (ms) => setTimeout(f, ms) }`,
      vu,
      '신설'
    ],
    [
      'KD09a',
      'KD',
      '매개변수 — 호출부 없는 함수 선언 → red',
      '1/1',
      `export function wait(ms) { return new Promise((r) => setTimeout(r, ms)) }`,
      vu,
      '신설'
    ],
    [
      'KD09b',
      'KD',
      '매개변수 — 호출부 없는 변수 함수 → red',
      '1/1',
      `const wait = (ms) => new Promise((r) => setTimeout(r, ms))`,
      vu,
      '신설'
    ],
    [
      'KD10a',
      'KD',
      'import 이름 → 경계(ΔV3 V37)',
      '0/0',
      `import { T } from './t'\nsetTimeout(f, T)`,
      vu,
      'ΔV3 V37'
    ],
    [
      'KD10b',
      'KD',
      'import 기본 → 경계',
      '0/0',
      `import T from './t'\nsetTimeout(f, T)`,
      vu,
      '신설'
    ],
    [
      'KD10c',
      'KD',
      'import 이름공간 멤버 → 경계',
      '0/0',
      `import * as t from './t'\nsetTimeout(f, t.T)`,
      vu,
      '신설'
    ],
    ['KD11', 'KD', '함수 선언 → 숫자 아님', '0/0', `function g() {}\nsetTimeout(f, g)`, vu, '신설'],
    ['KD11b', 'KD', '클래스 선언 → 숫자 아님', '0/0', `class C {}\nsetTimeout(f, C)`, vu, '신설'],
    ['KD11c', 'KD', 'enum 선언 → 숫자 아님', '0/0', `enum E { A }\nsetTimeout(f, E)`, vu, '신설'],
    ['KD12a', 'KD', '선언 없음 — undefined → 숫자 아님', '0/0', nn('undefined'), vu, '신설'],
    ['KD12b', 'KD', '선언 없음 — Infinity → 숫자 아님', '0/0', nn('Infinity'), vu, '신설'],
    ['KD12c', 'KD', '선언 없음 — NaN → 숫자 아님', '0/0', nn('NaN'), vu, '신설'],
    [
      'KD12d',
      'KD',
      '선언 없음 — 함수 전역(setTimeout 등) → 숫자 아님',
      '0/0',
      `pool({ setTimeout })`,
      vu,
      '신설'
    ],
    ['KD12e', 'KD', '선언 없음 — 그 밖 lib 전역 → 경계', '0/0', `setTimeout(f, LIMIT)`, vu, '신설'],
    [
      'KD13',
      'KD',
      'catch 변수 → red',
      '1/1',
      `try { g() } catch (ms) { setTimeout(f, ms) }`,
      vu,
      '신설'
    ],
    [
      'KD14',
      'KD',
      '표 밖 선언 종류(모듈 선언) → red',
      '1/1',
      `namespace N {}\nsetTimeout(f, N)`,
      vu,
      '신설'
    ],
    // KM — 멤버(리터럴 키)
    [
      'KM01',
      'KM',
      '객체 리터럴 속성·단축 속성·전개(ΔV3 V18~V21)',
      '1/0',
      `const cfg = { delay: 5000 }\nsetTimeout(f, cfg.delay)`,
      vu,
      'ΔV3 V19'
    ],
    [
      'KM02',
      'KM',
      '키 없음 → 숫자 아님',
      '0/0',
      `const c = { a: 1 }\nsetTimeout(f, c.delay)`,
      vu,
      '신설'
    ],
    [
      'KM03a',
      'KM',
      '메서드 → 숫자 아님',
      '0/0',
      `const c = { d() { return 1 } }\nsetTimeout(f, c.d)`,
      vu,
      '신설'
    ],
    [
      'KM03b',
      'KM',
      'getter → red',
      '1/1',
      `const c = { get d() { return 5000 } }\nsetTimeout(f, c.d)`,
      vu,
      '신설'
    ],
    [
      'KM04',
      'KM',
      '배열 리터럴 + 숫자 키 → 요소',
      '1/0',
      `const ds = [5000]\nsetTimeout(f, ds[0])`,
      vu,
      '신설(verify r3 W11)'
    ],
    [
      'KM05',
      'KM',
      '배열 리터럴의 그 밖 멤버 → red',
      '1/1',
      `setTimeout(f, [1, 2].length)`,
      vu,
      '신설'
    ],
    ['KM05b', 'KM', '문자열 리터럴의 멤버 → red', '1/1', `setTimeout(f, 'abc'.length)`, vu, '신설'],
    [
      'KM06a',
      'KM',
      'this.이름 → 같은 클래스 속성 초기값',
      '1/0',
      `class F { ms = 5000; run() { setTimeout(f, this.ms) } }`,
      vu,
      '신설'
    ],
    [
      'KM06b',
      'KM',
      'this.이름 — 배율 초기값',
      '0/0',
      `class F { ms = scaleMs(5000); run() { setTimeout(f, this.ms) } }`,
      vu,
      '신설'
    ],
    [
      'KM06c',
      'KM',
      'this.이름 — 속성 선언 없음 → red',
      '1/1',
      `class F { run() { setTimeout(f, this.ms) } }`,
      vu,
      '신설'
    ],
    [
      'KM07a',
      'KM',
      '원천이 lib 전역 → 경계',
      '0/0',
      `setTimeout(f, Number.MAX_SAFE_INTEGER)`,
      vu,
      '신설'
    ],
    [
      'KM07b',
      'KM',
      '원천이 콜백 매개변수 → 경계',
      '0/0',
      `run((o) => setTimeout(f, o.ms))`,
      vu,
      '신설'
    ],
    [
      'KM07c',
      'KM',
      '원천이 declare 변수 → 경계',
      '0/0',
      `declare const C: { ms: number }\nsetTimeout(f, C.ms)`,
      vu,
      '신설'
    ],
    ['KM08a', 'KM', '원천이 new → red', '1/1', `setTimeout(f, new Cfg().ms)`, vu, '신설'],
    [
      'KM08b',
      'KM',
      '원천이 호출 결과 → red',
      '1/1',
      `import { load } from './l'\nsetTimeout(f, load().ms)`,
      vu,
      '신설'
    ],
    [
      'KM08c',
      'KM',
      '원천이 enum 선언 → red',
      '1/1',
      `enum E { A = 5000 }\nsetTimeout(f, E.A)`,
      vu,
      '신설'
    ],
    [
      'KM09',
      'KM',
      '계산 키 → red',
      '1/1',
      `const cfg = { a: 5000 }\nsetTimeout(f, cfg[k])`,
      vu,
      '신설'
    ],
    // KF — 호출 결과
    [
      'KF02',
      'KF',
      '같은 파일 함수 → 반환식(ΔV3 V16·V17)',
      '1/0',
      `const budget = () => 5000\nsetTimeout(f, budget())`,
      vu,
      'ΔV3 V17'
    ],
    ['KF03', 'KF', '즉시 호출 → 반환식', '1/0', `setTimeout(f, (() => 5000)())`, vu, '신설'],
    [
      'KF04a',
      'KF',
      '타이머 핸들 호출 → 숫자 아님',
      '0/0',
      `const timeout = setTimeout(f, scaleMs(1000))`,
      vu,
      '신설'
    ],
    [
      'KF04b',
      'KF',
      'mock 체인(vi.spyOn) → 숫자 아님',
      '0/0',
      `const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => s)`,
      vu,
      '신설'
    ],
    ['KF04c', 'KF', 'mock(vi.fn) → 숫자 아님', '0/0', `const timeoutFn = vi.fn()`, vu, '신설'],
    [
      'KF04d',
      'KF',
      '타이머 핸들 호출(setInterval) → 숫자 아님',
      '0/0',
      `const timeoutH = setInterval(f, scaleMs(1000))`,
      vu,
      '신설'
    ],
    [
      'KF04e',
      'KF',
      '타이머 핸들 호출(setImmediate) → 숫자 아님',
      '0/0',
      `const timeoutI = setImmediate(f)`,
      vu,
      '신설'
    ],
    [
      'KF04f',
      'KF',
      'mock(vi.mocked) → 숫자 아님',
      '0/0',
      `const timeoutM = vi.mocked(x)`,
      vu,
      '신설'
    ],
    ['KF05a', 'KF', '그 밖 호출(import 함수) → red', '1/1', RED, vu, '신설'],
    [
      'KF05b',
      'KF',
      '그 밖 호출(lib 함수) → red',
      '1/1',
      `setTimeout(f, Math.max(1000, 5000))`,
      vu,
      '신설'
    ],
    // KC — 호출 대상
    [
      'KC01a',
      'KC',
      '래퍼 satisfies',
      '1/0',
      `;(setTimeout satisfies typeof setTimeout)(f, 5000)`,
      vu,
      '신설'
    ],
    ['KC01b', 'KC', '래퍼 !', '1/0', `;(setTimeout!)(f, 5000)`, vu, '신설'],
    ['KC01c', 'KC', '래퍼 <T>x', '1/0', `;(<typeof setTimeout>setTimeout)(f, 5000)`, vu, '신설'],
    [
      'KC04a',
      'KC',
      '재대입 변수 — 후보에 형태 이름 → red',
      '1/1',
      `let st = clearTimeout\nst = setTimeout\nst(f, 5000)`,
      vu,
      '신설(ΔV3 L11)'
    ],
    [
      'KC04b',
      'KC',
      '재대입 변수 — 형태 이름 없음 → 형태 아님',
      '0/0',
      `let r = a\nr = b\nr(f, 5000)`,
      vu,
      '신설'
    ],
    [
      'KC05a',
      'KC',
      '구조 분해 → 원천.속성(globalThis)',
      '1/0',
      `const { setTimeout: st } = globalThis\nst(f, 5000)`,
      vu,
      '신설(verify r3 W4c)'
    ],
    [
      'KC05b',
      'KC',
      '구조 분해 → 원천.속성(AbortSignal)',
      '1/0',
      `const { timeout } = AbortSignal\ntimeout(5000)`,
      vu,
      '신설(verify r3 W4d)'
    ],
    [
      'KC05c',
      'KC',
      '구조 분해 → vi.waitFor 이중 배율',
      1,
      `const { waitFor } = vi\nawait waitFor(cb, { timeout: scaleMs(5000) })`,
      w,
      '신설(verify r3 W4b)'
    ],
    [
      'KC05d',
      'KC',
      '구조 분해 → vi.waitFor 옵션 제외(오탐 해소)',
      '0/0',
      `const { waitFor } = vi\nawait waitFor(cb, { timeout: 5000 })`,
      vu,
      '신설(verify r3 W4)'
    ],
    [
      'KC06',
      'KC',
      'import — 다른 모듈의 같은 이름 → 형태 아님',
      '0/0',
      `import { setTimeout as st } from './fake-timers'\nst(f, 5000)`,
      vu,
      '신설'
    ],
    ['KC07', 'KC', '매개변수 → 형태 아님', '0/0', `function g(st) { st(f, 5000) }`, vu, '신설'],
    [
      'KC08a',
      'KC',
      '속성 접근 — 소유자 별칭(vi)',
      1,
      `const v = vi\nawait v.waitFor(cb, { timeout: scaleMs(4000) })`,
      w,
      '신설'
    ],
    [
      'KC08b',
      'KC',
      '속성 접근 — 소유자 별칭(globalThis)',
      '1/0',
      `const g = globalThis\ng.setTimeout(f, 5000)`,
      vu,
      '신설'
    ],
    [
      'KC09a',
      'KC',
      '요소 접근 리터럴 키 — setTimeout',
      '1/0',
      `globalThis['setTimeout'](f, 5000)`,
      vu,
      '신설'
    ],
    [
      'KC09b',
      'KC',
      '요소 접근 리터럴 키 — vi.waitFor 제외(오탐 해소)',
      '0/0',
      `await vi['waitFor'](cb, { timeout: 5000 })`,
      vu,
      '신설(verify r3 W10)'
    ],
    ['KC10', 'KC', '요소 접근 계산 키 → 형태 아님', '0/0', `timers[k](f, 5000)`, vu, '신설'],
    [
      'KC11',
      'KC',
      'promisify 밖 호출의 결과 → 형태 아님',
      '0/0',
      `getTimer()(f, 5000)`,
      vu,
      '신설'
    ],
    [
      'KC12',
      'KC',
      '같은 파일 함수 선언 → 형태 아님',
      '0/0',
      `function st(fn, ms) {}\nst(f, 5000)`,
      vu,
      '신설'
    ],
    ['KC13a', 'KC', '그 밖 종류(태그 템플릿) → 형태 아님', '0/0', 'tag`x`(f, 5000)', vu, '신설'],
    ['KC13b', 'KC', 'import() → 형태 아님', '0/0', `await import('./x')`, vu, '신설'],
    [
      'KC13c',
      'KC',
      'super(…) → 형태 아님',
      '0/0',
      `class A extends B { constructor() { super(5000) } }`,
      vu,
      '신설'
    ],
    // KN — now 식
    [
      'KN04',
      'KN',
      '같은 파일 함수 호출 반환',
      '1/0',
      `const now = () => Date.now()\nconst d = now() + 5000`,
      vu,
      '신설(verify r3 W5)'
    ],
    ['KN05', 'KN', '즉시 호출 반환', '1/0', `const d = (() => Date.now())() + 5000`, vu, '신설'],
    [
      'KN06',
      'KN',
      'X.getTime() — X → 인자 없는 new Date()',
      '1/0',
      `const t = new Date()\nconst d = t.getTime() + 5000`,
      vu,
      '신설'
    ],
    [
      'KN06b',
      'KN',
      'X.valueOf() — X → 인자 없는 new Date()',
      '1/0',
      `const t = new Date()\nconst d = t.valueOf() + 5000`,
      vu,
      '신설'
    ],
    [
      'KN08a',
      'KN',
      '그 밖 — import 호출 → now 아님',
      '0/0',
      `import { now } from './clock'\nconst d = now() + 5000`,
      vu,
      '신설'
    ],
    [
      'KN08b',
      'KN',
      '그 밖 — 복합 대입 카운터 → now 아님',
      '0/0',
      `let c = 0\nc += 1\nif (c < 2100) g()`,
      vu,
      '신설'
    ],
    [
      'KN08c',
      'KN',
      '그 밖 — lib 호출(Date.UTC) → now 아님',
      '0/0',
      `const d = Date.UTC(2020, 0, 1) + 60_000`,
      vu,
      '신설'
    ],
    [
      'KN08d',
      'KN',
      '그 밖 — 매개변수 → now 아님',
      '0/0',
      `function g(t0) { if (t0 + 5000 > x) h() }`,
      vu,
      '신설'
    ],
    ['KN08e', 'KN', '그 밖 — lib 전역 → now 아님', '0/0', `const d = START + 5000`, vu, '신설'],
    // KE — elapsed matcher
    [
      'KE02a',
      'KE',
      '.not.toBeGreaterThan(N) on now → 상한',
      '1/0',
      `expect(Date.now() - s).not.toBeGreaterThan(5000)`,
      vu,
      '신설(verify r3 W6)'
    ],
    [
      'KE02b',
      'KE',
      '.not.toBeGreaterThanOrEqual(N) on now → 상한',
      '1/0',
      `expect(Date.now() - s).not.toBeGreaterThanOrEqual(5000)`,
      vu,
      '신설'
    ],
    [
      'KE02c',
      'KE',
      'expect(N).not.toBeLessThan(now) → 상한',
      '1/0',
      `expect(5000).not.toBeLessThan(Date.now() - s)`,
      vu,
      '신설'
    ],
    [
      'KE02d',
      'KE',
      'expect(N).not.toBeLessThanOrEqual(now) → 상한',
      '1/0',
      `expect(5000).not.toBeLessThanOrEqual(Date.now() - s)`,
      vu,
      '신설'
    ],
    [
      'KE03a',
      'KE',
      '.not.toBeLessThan(N) on now → 하한(자리 아님)',
      '0/0',
      `expect(Date.now() - s).not.toBeLessThan(5000)`,
      vu,
      '신설'
    ],
    [
      'KE03b',
      'KE',
      'expect(N).not.toBeGreaterThan(now) → 하한(자리 아님)',
      '0/0',
      `expect(5000).not.toBeGreaterThan(Date.now() - s)`,
      vu,
      '신설'
    ],
    [
      'KE05',
      'KE',
      '.resolves 체인 → 자리 아님',
      '0/0',
      `await expect(p).resolves.toBeLessThan(5000)`,
      vu,
      '신설'
    ],
    // KO — timeouts 소유 이름
    [
      'KO02',
      'KO',
      '클래스 필드',
      '1/0',
      `class F { timeouts = { connectMs: 5000 } }`,
      vu,
      '신설(verify r3 W3)'
    ],
    [
      'KO03a',
      'KO',
      '대입 대상 속성',
      '1/0',
      `o.timeouts = { connectMs: 5000 }`,
      vu,
      '신설(verify r3 W3b)'
    ],
    [
      'KO03b',
      'KO',
      '대입 대상 요소(리터럴 키)',
      '1/0',
      `o['timeouts'] = { connectMs: 5000 }`,
      vu,
      '신설'
    ],
    [
      'KO04',
      'KO',
      '구조 분해 기본값',
      '1/0',
      `const { timeouts = { connectMs: 5000 } } = o`,
      vu,
      '신설'
    ],
    [
      'KO05',
      'KO',
      '그 밖 이름 → 소유 아님',
      '0/0',
      `pool({ other: { connectMs: 5000 } })`,
      vu,
      '신설'
    ],
    // KP — /timeout/i 매개변수 슬롯
    [
      'KP02',
      'KP',
      '기본값 없음 — 같은 파일 호출 인자',
      '1/0',
      `function run(timeoutMs) { return prod(timeoutMs) }\nrun(5000)`,
      vu,
      '신설(verify r3 W8)'
    ],
    [
      'KP03',
      'KP',
      '기본값 없음 — 호출부 없음, 넘긴 함수 → 경계',
      '0/0',
      `run((timeoutMs) => prod(timeoutMs))`,
      vu,
      '신설'
    ],
    [
      'KP04',
      'KP',
      '기본값 없음 — 호출부 없는 이름 붙은 함수 → red',
      '1/1',
      `export function wait(timeoutMs) { return prod(timeoutMs) }`,
      vu,
      '신설'
    ],
    // KA — 판정 불가 허용 목록 UNRESOLVED_ALLOWED {file, reason, count, why}
    ['KA01', 'KA', 'count = 판정 불가 자리 수 → 통과', 0, [RED, [ITEM]], allow, '신설'],
    [
      'KA02',
      'KA',
      'count 가 자리보다 많음 → 위반',
      1,
      [RED, [{ ...ITEM, count: 2 }]],
      allow,
      '신설'
    ],
    ['KA03', 'KA', 'count 가 자리보다 적음 → 위반', 1, [RED2, [ITEM]], allow, '신설'],
    ['KA04', 'KA', 'why 빈 값 → 위반', 1, [RED, [{ ...ITEM, why: ' ' }]], allow, '신설'],
    ['KA05', 'KA', '다른 파일 항목 → 덮지 않음', 1, [RED, [{ ...ITEM, file: 'b' }]], allow, '신설'],
    [
      'KA06',
      'KA',
      '다른 사유 항목 → 덮지 않음 + 항목 count 불일치',
      2,
      [RED, [{ ...ITEM, reason: 'KD02' }]],
      allow,
      '신설'
    ],
    [
      'KA07',
      'KA',
      '대상 파일 없는 항목 → CLI 위반',
      1,
      null,
      () =>
        cli({ 'src/a.test.ts': `it('x', () => {})\n` }, [{ ...ITEM, file: 'gone.test.ts' }]).code,
      '신설'
    ],
    [
      'KA08',
      'KA',
      '위반 문구에 판정 불가 · 칸 ID',
      'true',
      RED,
      (code) => String(lines(code).some((l) => l.includes('판정 불가') && l.includes('KF05'))),
      '신설'
    ],
    [
      'KA09',
      'KA',
      '--report 판정 불가 행 — 셋째 열 UNRESOLVED · allowed · 다섯째 열 칸 ID',
      'UNRESOLVED|KF05 § allowed|KF05',
      null,
      () => {
        const pick = (items) =>
          cli({ 'src/a.test.ts': `${RED}\n` }, items, ['--report'])
            .out.filter((l) => /^deadline\t/.test(l))
            .map((l) => l.split('\t'))
            .filter((c) => c[2] === 'UNRESOLVED' || c[2] === 'allowed')
            .map((c) => `${c[2]}|${c[4]}`)
            .join(',')
        return `${pick([])} § ${pick([{ ...ITEM, file: 'a.test.ts' }])}`
      },
      '신설'
    ]
  ]

  for (const [id, , rule, expected, code, measure] of C) {
    test(`${id} — ${rule}`, () => {
      const got = code === null ? measure() : measure(code)
      assert.equal(String(got), String(expected))
    })
  }
})

describe('노드 표 경계의 구별 입력', () => {
  test('KE05·now — resolves와 rejects는 now 피연산자여도 elapsed 자리가 아니다', () => {
    for (const chain of ['resolves', 'rejects'])
      assert.deepEqual(
        analyzeScale('a.test.ts', `expect(Date.now()).${chain}.toBeLessThan(5000)`, []),
        []
      )
  })
  test('W11·option — 옵션으로 전달된 함수의 몸통도 이중 배율 탐색 경계다', () => {
    assert.deepEqual(analyzeScale('a.test.ts', 'vi.waitFor(cb, () => f(scaleMs(4000)))', []), [])
  })
})

// The new parameter slot also catches the old shorthand fixture; isolate the shorthand edge.
test('S01·binding — 구조 분해 별칭의 단축 속성이 값 자리를 운반한다', () => {
  for (const [value, violations] of [
    ['5000', 1],
    ['scaleMs(5000)', 0]
  ]) {
    const code = `const { delay: timeoutMs } = { delay: ${value} }; pool({ timeoutMs })`
    assert.equal(analyzeScale('a.test.ts', code, []).length, violations)
  }
})
