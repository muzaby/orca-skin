import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  BASE_CASE_MS,
  BASE_HOOK_MS,
  BASE_WAIT_FOR_MS,
  DEFAULT_TEST_TIME_SCALE,
  resolveTestTimeScale,
  scaleMs,
  scaledBudget,
  scaledWaitForOptions
} from './test-time.mjs'

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_DIR = join(APP_DIR, '..')
const CONFIG = pathToFileURL(join(APP_DIR, 'vitest.config.ts')).href

/** 깨끗한 env 로 vitest.config.ts 를 읽어 test 블록 예산을 받는다. */
function configBudgets(scale) {
  const env = { ...process.env }
  delete env.ORCA_TEST_TIME_SCALE
  // 실측 모드(0298)가 바꾸는 프로젝트 수와 무관하게 기본 구성을 본다.
  delete env.ORCA_TEST_IO_MODE
  if (scale !== undefined) env.ORCA_TEST_TIME_SCALE = scale
  return spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      // 풀이 둘이라(0298) 예산은 프로젝트마다 있다 — 이름 순으로 [io, unit].
      `const c = (await import(${JSON.stringify(CONFIG)})).default; console.log(JSON.stringify(c.test.projects.map((p) => ({ n: p.test.name, t: p.test.testTimeout, h: p.test.hookTimeout, s: p.test.setupFiles[0] })).sort((a, b) => a.n.localeCompare(b.n))))`
    ],
    { cwd: APP_DIR, env, encoding: 'utf8' }
  )
}

describe('배율 해석 (0294 AC4)', () => {
  test('미설정·빈 값·공백은 기본값 3', () => {
    assert.equal(DEFAULT_TEST_TIME_SCALE, 3)
    assert.equal(resolveTestTimeScale({}), 3)
    assert.equal(resolveTestTimeScale({ ORCA_TEST_TIME_SCALE: '' }), 3)
    assert.equal(resolveTestTimeScale({ ORCA_TEST_TIME_SCALE: '  ' }), 3)
  })

  test('1 이상의 유한한 수는 그 값', () => {
    for (const [raw, value] of [
      ['1', 1],
      ['1.5', 1.5],
      ['5', 5]
    ])
      assert.equal(resolveTestTimeScale({ ORCA_TEST_TIME_SCALE: raw }), value)
  })

  test('1 미만·숫자 아님·무한은 변수명과 원값을 담아 던진다', () => {
    for (const raw of ['0', '0.99', '-1', 'abc', 'Infinity', 'NaN']) {
      assert.throws(
        () => resolveTestTimeScale({ ORCA_TEST_TIME_SCALE: raw }),
        (error) => error.message.includes(`ORCA_TEST_TIME_SCALE=${raw}`)
      )
    }
  })
})

describe('환산 (0294 AC1~AC3)', () => {
  test('scaleMs 는 기준값 × 배율을 올림한다 — 0·음수·NaN 기준값은 던진다', () => {
    assert.equal(scaleMs(20_000, 3), 60_000)
    assert.equal(scaleMs(200, 1.5), 300)
    assert.equal(scaleMs(333, 1.5), 500)
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '20'])
      assert.throws(() => scaleMs(bad, 3))
  })

  test('scaledBudget 는 준 키만 환산한다', () => {
    assert.deepEqual(scaledBudget({ testTimeout: 72_000, hookTimeout: 36_000 }, 2), {
      testTimeout: 144_000,
      hookTimeout: 72_000
    })
    assert.deepEqual(scaledBudget({ testTimeout: 15_000 }, 3), { testTimeout: 45_000 })
  })

  test('waitFor 옵션 네 갈래 — 미지정·숫자·timeout 있는 객체·timeout 없는 객체', () => {
    assert.equal(BASE_WAIT_FOR_MS, 5_000)
    assert.deepEqual(scaledWaitForOptions(undefined, 3), { timeout: 15_000 })
    assert.deepEqual(scaledWaitForOptions(4000, 3), { timeout: 12_000 })
    assert.deepEqual(scaledWaitForOptions({ timeout: 2000, interval: 10 }, 3), {
      timeout: 6_000,
      interval: 10
    })
    assert.deepEqual(scaledWaitForOptions({ interval: 1 }, 2), { interval: 1, timeout: 10_000 })
  })
})

describe('vitest.config.ts 배선 (0294 AC1·AC2·AC4)', () => {
  test('케이스·훅 예산 = 20_000 × 배율, setup 파일을 건다', () => {
    assert.equal(BASE_CASE_MS, 20_000)
    assert.equal(BASE_HOOK_MS, 20_000)
    for (const [scale, ms] of [
      [undefined, 60_000],
      ['1', 20_000],
      ['5', 100_000]
    ]) {
      const result = configBudgets(scale)
      assert.equal(result.status, 0, result.stderr)
      const setup = './scripts/vitest-setup.mjs'
      assert.deepEqual(JSON.parse(result.stdout.trim().split('\n').at(-1)), [
        { n: 'io', t: ms, h: ms, s: setup },
        { n: 'unit', t: ms, h: ms, s: setup }
      ])
    }
  })

  test('잘못된 배율이면 config 로드가 실패한다', () => {
    const result = configBudgets('0.5')
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /ORCA_TEST_TIME_SCALE=0\.5/)
  })

  test('잘못된 배율이면 vitest 자체가 비정상 종료한다', () => {
    const env = { ...process.env, ORCA_TEST_TIME_SCALE: 'abc' }
    let failed = false
    try {
      execFileSync(
        process.execPath,
        [join(APP_DIR, 'node_modules', 'vitest', 'vitest.mjs'), 'run', 'scripts/__none__'],
        { cwd: APP_DIR, env, stdio: 'pipe' }
      )
    } catch (error) {
      failed = true
      assert.match(String(error.stderr), /ORCA_TEST_TIME_SCALE=abc/)
    }
    assert.ok(failed)
  })
})

describe('CI 워크플로 (0294 AC9)', () => {
  const read = (name) => readFileSync(join(REPO_DIR, '.github', 'workflows', name), 'utf8')
  test('작업 상한은 저장소 변수 또는 기존값 × 3 이다', () => {
    assert.match(
      read('ci.yml'),
      /timeout-minutes: \$\{\{ fromJSON\(vars\.ORCA_CI_TIMEOUT_MINUTES \|\| '90'\) \}\}/
    )
    assert.match(
      read('release.yml'),
      /timeout-minutes: \$\{\{ fromJSON\(vars\.ORCA_RELEASE_TIMEOUT_MINUTES \|\| '135'\) \}\}/
    )
  })

  test('두 Test 단계가 배율 변수를 넘긴다', () => {
    for (const name of ['ci.yml', 'release.yml']) {
      const text = read(name)
      const step = text.slice(text.indexOf('- name: Test\n'))
      assert.match(
        step.slice(0, 200),
        /ORCA_TEST_TIME_SCALE: \$\{\{ vars\.ORCA_TEST_TIME_SCALE \}\}/,
        name
      )
    }
  })
})

describe('실-git 픽스처 상수 (0294 AC8 · EP-06)', () => {
  test('상한·kill 유예·rm 재시도 간격이 기준값 × 배율이다', async () => {
    const fixture = await import(
      pathToFileURL(join(APP_DIR, 'src', 'main', 'infra', 'git', 'temp-repo.testfixture.ts')).href
    )
    assert.equal(fixture.FIXTURE_GIT_TIMEOUT_MS, scaleMs(600_000))
    assert.equal(fixture.KILL_GRACE_MS, scaleMs(5_000))
    assert.equal(fixture.RM_RETRY.retryDelay, scaleMs(200))
    assert.equal(fixture.RM_RETRY.maxRetries, 10)
  })
})
