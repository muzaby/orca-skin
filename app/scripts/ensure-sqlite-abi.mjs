#!/usr/bin/env node
import { pathToFileURL } from 'node:url'
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

// Windows 에서 우리가 부르는 것은 npm 이 깔아 준 **`.cmd` 셔임**이지 실행 이미지가 아니다.
// `spawn` 은 shell 없이는 `.com`/`.exe` 만 띄울 수 있어서(`cross-spawn/lib/parse.js` 의
// `isExecutableRegExp` 가 같은 규칙을 코드로 갖는다) `.cmd` 를 `shell:false` 로 넘기면 자식이
// **한 줄도 출력하지 못한 채** 실패한다. 그래서 win32 에서는 shell 을 거친다 — 인자는 전부
// 이 파일의 상수라 주입면이 없다.
//
// 이 분기는 2026-09-02 CI(windows-latest·Node 22)에서 `[sqlite-abi] ensure failed for electron`
// 로 터졌다. 그전까지 Windows 에서는 **진입 가드가 깨져 CLI 본문 자체가 돈 적이 없어**(0212 P2
// 가 그 가드를 고쳤다) 이 결함이 드러나지 않았다.
export function commandForTarget(target, platform = process.platform) {
  const win = platform === 'win32'
  const command =
    target === 'node'
      ? win
        ? 'npm.cmd'
        : 'npm'
      : win
        ? 'electron-builder.cmd'
        : 'electron-builder'
  const args = target === 'node' ? ['rebuild', 'better-sqlite3'] : ['install-app-deps']

  // `.cmd`/`.bat` 은 실행 이미지가 아니다 — 이 술어가 규칙이고 명령 이름 목록이 아니다.
  return { command, args, shell: /\.(?:cmd|bat)$/i.test(command) }
}

export function defaultRunner(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false, ...options })
  return { status: result.status ?? 1, error: result.error }
}

// 실패 사유 한 줄. spawn 자체가 실패하면 `status` 는 의미가 없고 `error` 만 원인을 안다 —
// 그것을 버리면 로그에 `ensure failed for electron` 한 줄만 남아 무엇이 잘못됐는지 알 수 없다.
export function describeRunFailure(command, result) {
  if (result.error) {
    const code = result.error.code ? ` (${result.error.code})` : ''
    return `spawn '${command}' failed${code}: ${result.error.message}`
  }
  return `'${command}' exited with status ${result.status}`
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

  // electron: 메타데이터가 드리프트했거나(마커 불일치, 예: electron/lockfile 버전 변경), 또는
  // better-sqlite3 가 지금 plain Node 에서 로드되면 rebuild 한다. 후자는 바이너리가 Node-ABI 로
  // 빌드됐다는 뜻이다 — 대표적으로 `npm install` 이 better-sqlite3 의 prebuild-install 을 재실행해
  // Node-ABI prebuilt 로 바이너리를 되돌린 경우다. 이때 orca 마커는 여전히 {target:electron} 이라
  // 마커만 보면(binary-blind) fast-path 로 skip 되어 Electron 이 Node-ABI 를 로드하다 실패한다.
  return loadBetterSqlite(cwd) || !markerMatches(readMarker(cwd), computeFingerprint(cwd, target))
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

  if (target === 'electron' && !needsRebuild({ target, cwd, loadBetterSqlite })) {
    return { ok: true, rebuilt: false, checked: check }
  }

  if (check) {
    return { ok: false, rebuilt: false, checked: true, reason: `${target} ABI marker is stale` }
  }

  const { command, args, shell } = commandForTarget(target)
  const result = runner(command, args, { cwd, shell })

  if (result.error || result.status !== 0) {
    return {
      ok: false,
      rebuilt: false,
      checked: false,
      reason: describeRunFailure(command, result)
    }
  }

  if (target === 'node' && !loadBetterSqlite(cwd)) {
    return {
      ok: false,
      rebuilt: true,
      checked: false,
      reason: `'${command}' succeeded but better-sqlite3 still fails to load under plain Node`
    }
  }

  writeMarker(cwd, fingerprint)
  return { ok: true, rebuilt: true, checked: false }
}

export function runCli(argv = process.argv.slice(2), cwd = process.cwd()) {
  const { target, check } = parseArgs(argv)
  const result = ensureSqliteAbi({ target, check, cwd })

  if (!result.ok) {
    const mode = check ? 'check' : 'ensure'
    // 사유를 함께 낸다 — 없으면 이 줄만 남아 원인을 되짚을 수 없다(2026-09-02 CI).
    console.error(`[sqlite-abi] ${mode} failed for ${target}: ${result.reason ?? 'unknown reason'}`)
    return 1
  }

  const action = result.checked ? 'checked' : result.rebuilt ? 'rebuilt' : 'already ok'
  console.log(`[sqlite-abi] ${target}: ${action}`)
  return 0
}

// 직접 실행 판정 — `pathToFileURL` 로 비교한다. `file://${process.argv[1]}` 는 **Windows 에서
// 절대 성립하지 않는다**: argv[1] 은 `C:.mjs` 라 `file://C:.mjs` 가 되고
// `import.meta.url` 은 `file:///C:/a/b.mjs` 다. 그러면 CLI 본문이 실행되지 않은 채 exit 0 이 나가
// 게이트가 무음으로 통과한다(CI 는 windows-latest 다). 선례: `analyze-composer-input-trace.mjs`.
const invokedAs = process.argv[1]
if (invokedAs && import.meta.url === pathToFileURL(invokedAs).href) {
  try {
    process.exitCode = runCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
