import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  commandForTarget,
  computeFingerprint,
  describeRunFailure,
  ensureSqliteAbi,
  markerMatches,
  parseArgs,
  readMarker,
  writeMarker
} from './ensure-sqlite-abi.mjs'

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'orca-sqlite-abi-'))
  mkdirSync(join(cwd, 'node_modules', 'electron'), { recursive: true })
  mkdirSync(join(cwd, 'node_modules', 'better-sqlite3'), { recursive: true })
  writeFileSync(join(cwd, 'package.json'), '{"name":"fixture"}\n')
  writeFileSync(join(cwd, 'package-lock.json'), '{"lockfileVersion":3}\n')
  writeFileSync(join(cwd, 'node_modules', 'electron', 'package.json'), '{"version":"39.2.6"}\n')
  writeFileSync(
    join(cwd, 'node_modules', 'better-sqlite3', 'package.json'),
    '{"version":"12.10.0"}\n'
  )
  return cwd
}

function runnerRecorder(result = { status: 0 }) {
  const calls = []
  return {
    calls,
    // options 까지 기록한다 — 여기서 버리면 `shell` 이 실제로 넘어가는지 아무도 못 본다.
    runner(command, args, options) {
      calls.push({ command, args, options })
      return result
    }
  }
}

test('parseArgs accepts target and check flag', () => {
  assert.deepEqual(parseArgs(['node', '--check']), { target: 'node', check: true })
  assert.deepEqual(parseArgs(['electron']), { target: 'electron', check: false })
  assert.throws(() => parseArgs(['bogus']))
})

test('electron target fast-paths when marker matches and binary is Electron-ABI', () => {
  const cwd = fixture()
  const fingerprint = computeFingerprint(cwd, 'electron')
  writeMarker(cwd, fingerprint)
  const recorder = runnerRecorder()

  // loadBetterSqlite=false: Electron-ABI 바이너리는 plain Node 에서 로드 실패 → rebuild 불필요.
  const result = ensureSqliteAbi({
    target: 'electron',
    cwd,
    runner: recorder.runner,
    loadBetterSqlite: () => false
  })

  assert.deepEqual(result, { ok: true, rebuilt: false, checked: false })
  assert.equal(recorder.calls.length, 0)
})

test('electron target rebuilds when binary is Node-ABI even if marker matches', () => {
  // 회귀 가드: `npm install` 이 better-sqlite3 를 Node-ABI prebuilt 로 되돌려도 orca 마커는
  // {target:electron} 그대로 남는다. loadBetterSqlite=true(= plain Node 로드 성공 = Node-ABI)면
  // 마커가 매치해도 반드시 Electron 으로 rebuild 해야 한다.
  const cwd = fixture()
  writeMarker(cwd, computeFingerprint(cwd, 'electron'))
  const recorder = runnerRecorder()

  const result = ensureSqliteAbi({
    target: 'electron',
    cwd,
    runner: recorder.runner,
    loadBetterSqlite: () => true
  })

  assert.equal(result.ok, true)
  assert.equal(result.rebuilt, true)
  assert.equal(recorder.calls.length, 1)
  assert.deepEqual(recorder.calls[0].args, ['install-app-deps'])
})

test('electron target rebuilds and writes marker when marker is missing', () => {
  const cwd = fixture()
  const recorder = runnerRecorder()

  const result = ensureSqliteAbi({
    target: 'electron',
    cwd,
    runner: recorder.runner,
    loadBetterSqlite: () => false
  })

  assert.equal(result.ok, true)
  assert.equal(result.rebuilt, true)
  assert.equal(recorder.calls.length, 1)
  assert.deepEqual(recorder.calls[0].args, ['install-app-deps'])
  assert.equal(markerMatches(readMarker(cwd), computeFingerprint(cwd, 'electron')), true)
})

test('check mode reports missing electron marker without running rebuild', () => {
  const cwd = fixture()
  const recorder = runnerRecorder()

  const result = ensureSqliteAbi({
    target: 'electron',
    cwd,
    runner: recorder.runner,
    loadBetterSqlite: () => false,
    check: true
  })

  assert.deepEqual(result, {
    ok: false,
    rebuilt: false,
    checked: true,
    reason: 'electron ABI marker is stale'
  })
  assert.equal(recorder.calls.length, 0)
})

test('node target rebuilds only when better-sqlite3 cannot load', () => {
  const cwd = fixture()
  const recorder = runnerRecorder()
  let loadCount = 0

  const result = ensureSqliteAbi({
    target: 'node',
    cwd,
    runner: recorder.runner,
    loadBetterSqlite: () => {
      loadCount += 1
      return loadCount > 1
    }
  })

  assert.equal(result.ok, true)
  assert.equal(result.rebuilt, true)
  assert.equal(recorder.calls.length, 1)
  assert.equal(recorder.calls[0].command.includes('npm'), true)
})

test('node check mode does not rebuild on load failure', () => {
  const cwd = fixture()
  const recorder = runnerRecorder()

  const result = ensureSqliteAbi({
    target: 'node',
    cwd,
    runner: recorder.runner,
    loadBetterSqlite: () => false,
    check: true
  })

  assert.deepEqual(result, {
    ok: false,
    rebuilt: false,
    checked: true,
    reason: 'node ABI marker is stale'
  })
  assert.equal(recorder.calls.length, 0)
})

// 2026-09-02 CI(windows-latest·Node 22) — `[sqlite-abi] ensure failed for electron`, 자식 출력 0줄.
// 원인은 `.cmd` 셔임을 `shell:false` 로 spawn 한 것이다. `spawn` 은 shell 없이 `.com`/`.exe` 만
// 띄울 수 있다(`cross-spawn/lib/parse.js` 의 `isExecutableRegExp` 가 같은 규칙이다).
//
// 이 분기는 그전까지 **테스트가 0건**이었고, Windows 에서는 진입 가드가 깨져 CLI 본문 자체가
// 돈 적이 없어(0212 P2 가 그 가드를 고쳤다) 결함이 드러나지 않았다.

test('win32 에서 .cmd 셔임은 shell 을 거친다 — 아니면 자식이 뜨지 않는다', () => {
  assert.deepEqual(commandForTarget('electron', 'win32'), {
    command: 'electron-builder.cmd',
    args: ['install-app-deps'],
    shell: true
  })
  assert.deepEqual(commandForTarget('node', 'win32'), {
    command: 'npm.cmd',
    args: ['rebuild', 'better-sqlite3'],
    shell: true
  })
})

test('win32 이 아니면 실행 이미지를 직접 부르고 shell 을 쓰지 않는다', () => {
  for (const platform of ['linux', 'darwin']) {
    assert.deepEqual(commandForTarget('electron', platform), {
      command: 'electron-builder',
      args: ['install-app-deps'],
      shell: false
    })
    assert.deepEqual(commandForTarget('node', platform), {
      command: 'npm',
      args: ['rebuild', 'better-sqlite3'],
      shell: false
    })
  }
})

// 불변식으로 센다 — 명령 이름 목록이 아니라 "실행 이미지가 아니면 shell" 이 규칙이다.
// 새 target 이 늘어도 이 줄이 함께 걸린다.
test('모든 target × 플랫폼에서 .cmd/.bat 이면 shell 이 참이다 (전수)', () => {
  const offenders = []
  for (const platform of ['win32', 'linux', 'darwin']) {
    for (const target of ['node', 'electron']) {
      const spec = commandForTarget(target, platform)
      const isShim = /\.(?:cmd|bat)$/i.test(spec.command)
      if (isShim !== spec.shell) offenders.push({ platform, target, ...spec })
    }
  }
  assert.deepEqual(offenders, [])
})

test('ensureSqliteAbi 는 shell 판정을 runner 까지 실제로 넘긴다', () => {
  const cwd = fixture()
  const recorder = runnerRecorder()

  ensureSqliteAbi({
    target: 'electron',
    cwd,
    runner: recorder.runner,
    loadBetterSqlite: () => false
  })

  assert.equal(recorder.calls.length, 1)
  // 값 자체는 플랫폼이 정한다 — 여기서 다시 적으면 SSOT 가 갈린다.
  assert.equal(recorder.calls[0].options.shell, commandForTarget('electron').shell)
  assert.equal(recorder.calls[0].options.cwd, cwd)
})

// spawn 이 실패하면 status 는 의미가 없고 error 만 원인을 안다 — 그것을 버리면 로그에
// `ensure failed for electron` 한 줄만 남는다(CI 가 실제로 그랬다).
test('spawn 실패 사유가 결과에 실린다 — 삼키지 않는다', () => {
  const cwd = fixture()
  const spawnError = Object.assign(new Error('spawnSync electron-builder.cmd EINVAL'), {
    code: 'EINVAL'
  })
  const recorder = runnerRecorder({ status: 1, error: spawnError })

  const result = ensureSqliteAbi({
    target: 'electron',
    cwd,
    runner: recorder.runner,
    loadBetterSqlite: () => false
  })

  assert.equal(result.ok, false)
  assert.match(result.reason, /EINVAL/)
  assert.match(result.reason, /electron-builder\.cmd/)
})

test('describeRunFailure 는 spawn 실패와 비-0 종료를 구분한다', () => {
  assert.match(
    describeRunFailure('electron-builder.cmd', {
      status: 1,
      error: Object.assign(new Error('boom'), { code: 'EINVAL' })
    }),
    /spawn 'electron-builder\.cmd' failed \(EINVAL\): boom/
  )
  assert.match(describeRunFailure('npm', { status: 7 }), /'npm' exited with status 7/)
})
