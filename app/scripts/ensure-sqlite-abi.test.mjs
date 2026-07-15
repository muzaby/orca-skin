import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  computeFingerprint,
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

function runnerRecorder() {
  const calls = []
  return {
    calls,
    runner(command, args) {
      calls.push({ command, args })
      return { status: 0 }
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

  assert.deepEqual(result, { ok: false, rebuilt: false, checked: true })
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

  assert.deepEqual(result, { ok: false, rebuilt: false, checked: true })
  assert.equal(recorder.calls.length, 0)
})
