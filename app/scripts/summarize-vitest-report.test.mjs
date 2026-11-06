// summarize-vitest-report 단위 테스트 (0298 ΔV2).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { poolResolver, summarizeReport } from './summarize-vitest-report.mjs'

const APP = join('/', 'app')
const report = {
  numTotalTests: 6,
  numPassedTests: 5,
  numFailedTests: 1,
  testResults: [
    { name: join(APP, 'src', 'a.test.ts'), startTime: 1_000, endTime: 3_000 },
    { name: join(APP, 'src', 'b.test.ts'), startTime: 1_500, endTime: 2_000 },
    { name: join(APP, 'src', 'git.test.ts'), startTime: 3_000, endTime: 13_000 },
    { name: join(APP, 'src', 'db.test.ts'), startTime: 13_000, endTime: 16_000 }
  ]
}
const partition = { io: ['src/git.test.ts', 'src/db.test.ts'], ioSqlite: ['src/db.test.ts'] }

describe('summarizeReport — 풀별 벽시계·합·상위 목록', () => {
  test('기본 모드: unit 과 io 두 풀', () => {
    const lines = summarizeReport(report, {
      appDir: APP,
      poolOf: poolResolver(partition, undefined),
      top: 2
    })
    assert.deepEqual(lines, [
      '[pools] mode=default files=4 tests=6 passed=5 failed=1',
      '[pools] wall total 15.0s (첫 파일 시작 → 마지막 파일 끝)',
      '[pools] io: files 2 · wall 13.0s · sum 13.0s',
      '[pools] unit: files 2 · wall 2.0s · sum 2.5s',
      '[pools] slowest 2:',
      '    10.0s io        src/git.test.ts',
      '     3.0s io        src/db.test.ts'
    ])
  })
  test('sqlite-serial 모드: SQLite io 는 io-sqlite 풀로 센다', () => {
    const lines = summarizeReport(report, {
      appDir: APP,
      poolOf: poolResolver(partition, 'sqlite-serial'),
      mode: 'sqlite-serial',
      top: 1
    })
    assert.equal(lines[0], '[pools] mode=sqlite-serial files=4 tests=6 passed=5 failed=1')
    assert.ok(lines.includes('[pools] io-sqlite: files 1 · wall 3.0s · sum 3.0s'))
    assert.ok(lines.includes('[pools] io: files 1 · wall 10.0s · sum 10.0s'))
  })
})
