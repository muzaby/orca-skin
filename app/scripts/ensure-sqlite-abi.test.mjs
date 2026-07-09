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

test('electron target fast-paths when fingerprint marker matches', () => {
  const cwd = fixture()
  const fingerprint = computeFingerprint(cwd, 'electron')
  writeMarker(cwd, fingerprint)
  const recorder = runnerRecorder()

  const result = ensureSqliteAbi({ target: 'electron', cwd, runner: recorder.runner })

  assert.deepEqual(result, { ok: true, rebuilt: false, checked: false })
  assert.equal(recorder.calls.length, 0)
})

test('electron target rebuilds and writes marker when marker is missing', () => {
  const cwd = fixture()
  const recorder = runnerRecorder()

  const result = ensureSqliteAbi({ target: 'electron', cwd, runner: recorder.runner })

  assert.equal(result.ok, true)
  assert.equal(result.rebuilt, true)
  assert.equal(recorder.calls.length, 1)
  assert.deepEqual(recorder.calls[0].args, ['install-app-deps'])
  assert.equal(markerMatches(readMarker(cwd), computeFingerprint(cwd, 'electron')), true)
})

test('check mode reports missing electron marker without running rebuild', () => {
  const cwd = fixture()
  const recorder = runnerRecorder()

  const result = ensureSqliteAbi({ target: 'electron', cwd, runner: recorder.runner, check: true })

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
