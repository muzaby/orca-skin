#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const VALID_TARGETS = new Set(['node', 'electron'])
const MARKER_VERSION = 1
const CACHE_DIR = join('node_modules', '.cache', 'orca')
const MARKER_FILE = join(CACHE_DIR, 'sqlite-abi.json')

export function parseArgs(argv) {
  const check = argv.includes('--check')
  const target = argv.find((arg) => !arg.startsWith('--'))

  if (!target || !VALID_TARGETS.has(target)) {
    throw new Error('Usage: node scripts/ensure-sqlite-abi.mjs <node|electron> [--check]')
  }

  return { target, check }
}

export function commandForTarget(target) {
  if (target === 'node') {
    return {
      command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
      args: ['rebuild', 'better-sqlite3']
    }
  }

  return {
    command: process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder',
    args: ['install-app-deps']
  }
}

export function defaultRunner(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false, ...options })
  return { status: result.status ?? 1, error: result.error }
}

export function defaultLoadBetterSqlite(cwd = process.cwd()) {
  const probe =
    "const Database = require('better-sqlite3'); const db = new Database(':memory:'); db.close()"
  const result = spawnSync(process.execPath, ['-e', probe], { cwd, stdio: 'ignore', shell: false })
  return !result.error && result.status === 0
}

export function readPackageVersion(cwd, packageName) {
  const requireFromCwd = createRequire(join(cwd, 'package.json'))
  const packageJsonPath = requireFromCwd.resolve(`${packageName}/package.json`)
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  return packageJson.version ?? 'unknown'
}

export function hashFileIfPresent(filePath) {
  if (!existsSync(filePath)) {
    return null
  }

  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

export function computeFingerprint(cwd, target) {
  const lockHash = hashFileIfPresent(join(cwd, 'package-lock.json'))

  return {
    markerVersion: MARKER_VERSION,
    target,
    nodeModulesVersion: process.versions.modules,
    nodeVersion: process.versions.node,
    electronVersion: readPackageVersion(cwd, 'electron'),
    betterSqliteVersion: readPackageVersion(cwd, 'better-sqlite3'),
    packageLockHash: lockHash
  }
}

export function markerPath(cwd) {
  return join(cwd, MARKER_FILE)
}

export function readMarker(cwd) {
  const filePath = markerPath(cwd)

  if (!existsSync(filePath)) {
    return null
  }

  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

export function writeMarker(cwd, fingerprint) {
  const filePath = markerPath(cwd)
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(
    filePath,
    `${JSON.stringify({ ...fingerprint, updatedAt: new Date().toISOString() }, null, 2)}\n`
  )
}

export function markerMatches(marker, fingerprint) {
  if (!marker) {
    return false
  }

  return Object.entries(fingerprint).every(([key, value]) => marker[key] === value)
}

export function needsRebuild({ target, cwd, loadBetterSqlite = defaultLoadBetterSqlite }) {
  if (target === 'node') {
    return !loadBetterSqlite(cwd)
  }

  return !markerMatches(readMarker(cwd), computeFingerprint(cwd, target))
}

export function ensureSqliteAbi({
  target,
  check = false,
  cwd = process.cwd(),
  runner = defaultRunner,
  loadBetterSqlite = defaultLoadBetterSqlite
}) {
  const fingerprint = computeFingerprint(cwd, target)

  if (target === 'node' && !needsRebuild({ target, cwd, loadBetterSqlite })) {
    writeMarker(cwd, fingerprint)
    return { ok: true, rebuilt: false, checked: check }
  }

  if (target === 'electron' && markerMatches(readMarker(cwd), fingerprint)) {
    return { ok: true, rebuilt: false, checked: check }
  }

  if (check) {
    return { ok: false, rebuilt: false, checked: true }
  }

  const { command, args } = commandForTarget(target)
  const result = runner(command, args, { cwd })

  if (result.error || result.status !== 0) {
    return { ok: false, rebuilt: false, checked: false }
  }

  if (target === 'node' && !loadBetterSqlite(cwd)) {
    return { ok: false, rebuilt: true, checked: false }
  }

  writeMarker(cwd, fingerprint)
  return { ok: true, rebuilt: true, checked: false }
}

export function runCli(argv = process.argv.slice(2), cwd = process.cwd()) {
  const { target, check } = parseArgs(argv)
  const result = ensureSqliteAbi({ target, check, cwd })

  if (!result.ok) {
    const mode = check ? 'check' : 'ensure'
    console.error(`[sqlite-abi] ${mode} failed for ${target}`)
    return 1
  }

  const action = result.checked ? 'checked' : result.rebuilt ? 'rebuilt' : 'already ok'
  console.log(`[sqlite-abi] ${target}: ${action}`)
  return 0
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = runCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
