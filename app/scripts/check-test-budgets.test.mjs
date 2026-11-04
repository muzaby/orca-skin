import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
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
