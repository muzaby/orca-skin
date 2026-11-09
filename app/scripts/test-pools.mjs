// vitest 풀 분류의 단일 정본 (0298).
//
// vitest 4 의 forks 풀은 isolate 에서 **테스트 파일마다 node 프로세스를 하나** 띄운다. 백신이 있는
// Windows 러너에서는 그 프로세스 생성이 곧 부하다. 그래서 둘로 나눈다.
//
//   io   — 자식 프로세스·git·SQLite·프로세스 전역 상태를 쓰는 파일. forks(프로세스 격리), 병렬.
//   unit — 나머지. threads(같은 프로세스의 워커 스레드) 병렬, exe 를 띄우지 않는다.
//
// 분류는 소스 신호(IO_RULES)로 하고, 신호가 놓친 파일은 unit 런타임 가드(installUnitGuard)가
// 자식 프로세스·네이티브 SQLite 를 쓰는 순간 red 로 막는다 — 놓친 형태가 조용한 통과가 아니라
// 보이는 실패가 된다(fail-closed). 순수 Node — vitest 설정 로드에서 읽힌다.

import { readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { FIXTURE, INJECTS_RUNNER, RUN_GIT, stripComments } from './test-source.mjs'

/** unit 가드 상태(`{ violations }`)가 붙는 `process` 키 — 배선 테스트가 읽는다. */
export const UNIT_GUARD = Symbol.for('orca.test.unitGuard')
/** unit 프로젝트에만 붙는 setup 파일. */
export const UNIT_GUARD_SETUP = './scripts/vitest-unit-guard.mjs'
/** vitest `include` 와 같은 대상. */
export const TEST_INCLUDE = 'src/**/*.test.ts'

/**
 * 신호로는 보이지 않지만 프로세스 단위 실행이 필요한 파일 — 경로 → 사유. threads 실행에서 실제로
 * 깨진 것만 올린다(0298 §8).
 */
export const FORCED_IO = {
  'src/main/infra/loopback-callback.test.ts':
    '빈 포트를 확인한 뒤 다시 잡는다 — 같은 프로세스의 스레드끼리 EADDRINUSE 로 부딪힌다'
}

const CHILD_PROCESS_IMPORT =
  /(?:\bfrom\s+|\brequire\(\s*|\bimport\(\s*)['"](?:node:)?child_process['"]/
// SQLite 를 여는 진입점 — 드라이버 import · production 생성자(`infra/db` 의 `openFileDatabase`·`warmFileSqlite`·`initDb`).
const SQLITE =
  /['"]better-sqlite3['"]|\b(?:openDb|openFileDatabase|initDb)\s*\(|\bwarmFileSqlite\b|\bnew\s+Database\s*\(/
const TIMEZONE = /\bprocess\.env\.TZ\b|\bprocess\.env\[\s*['"]TZ['"]\s*\]/

/**
 * io 규칙. 하나라도 맞으면 io 다. `text` 는 주석을 지운 소스, `relPath` 는 `src/…` posix 경로.
 * 순서는 사유 표기 순서일 뿐 판정에 영향이 없다.
 */
export const IO_RULES = [
  { id: 'child-process', test: (text) => CHILD_PROCESS_IMPORT.test(text) },
  { id: 'git-fixture', test: (text) => text.includes(FIXTURE) },
  { id: 'run-git', test: (text) => RUN_GIT.test(text) && !INJECTS_RUNNER.test(text) },
  { id: 'sqlite', test: (text) => SQLITE.test(text) },
  { id: 'timezone', test: (text) => TIMEZONE.test(text) },
  { id: 'forced', test: (_text, relPath) => Object.hasOwn(FORCED_IO, relPath) }
]

/** 소스 하나의 풀. `reasons` 는 맞은 규칙 id. */
export function classifyTestSource(source, relPath = '') {
  const text = stripComments(source)
  const reasons = IO_RULES.filter((rule) => rule.test(text, relPath)).map((rule) => rule.id)
  return { pool: reasons.length > 0 ? 'io' : 'unit', reasons }
}

/**
 * `appDir/src` 아래 `*.test.ts` 를 풀별로 가른다. 경로는 `src/…` posix, 정렬.
 * `ioSqlite` 는 io 중 `sqlite` 신호가 있는 파일 — `sqlite-serial` 모드가 따로 직렬로 둔다.
 */
export function partitionTestFiles(appDir) {
  const io = []
  const unit = []
  const ioSqlite = []
  const files = readdirSync(join(appDir, 'src'), { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.test.ts'))
    .map((entry) => `src/${entry.split(sep).join('/')}`)
    .sort()
  for (const relPath of files) {
    const { pool, reasons } = classifyTestSource(
      readFileSync(join(appDir, relPath), 'utf8'),
      relPath
    )
    ;(pool === 'io' ? io : unit).push(relPath)
    if (reasons.includes('sqlite')) ioSqlite.push(relPath)
  }
  return { io, unit, ioSqlite }
}

/** io 실행 방식 실측 모드 (0298 ΔV2). 미설정이면 기본 동작이다. */
export const IO_MODE_ENV = 'ORCA_TEST_IO_MODE'
export const IO_MODES = ['serial', 'sqlite-serial', 'parallel']

/** `ORCA_TEST_IO_MODE` 해석. 미설정·빈 값은 undefined, 목록 밖 값은 설정 로드 실패. */
export function resolveIoMode(env = process.env) {
  const raw = env[IO_MODE_ENV]
  if (raw === undefined || raw.trim() === '') return undefined
  if (!IO_MODES.includes(raw)) {
    throw new Error(`${IO_MODE_ENV}=${raw} — ${IO_MODES.join(' · ')} 중 하나여야 한다`)
  }
  return raw
}

/**
 * 프로젝트 구성. 기본(`mode` 미설정)은 플랫폼·`CI` 와 무관하게 unit 과 io 가 같은 그룹(0)에서 병렬로
 * 돈다 — Windows CI 직렬화(0262)는 실측에서 1분 이상 느렸고 병렬 실패는 0이라 없앴다(0298 ΔV4).
 * `mode` 는 Windows 실측 비교용이다(`test-pools-experiment.yml` · unit `isolate: false` 는 로컬 실측
 * 179파일 실패로 넣지 않았다). vitest 는 같은 `groupOrder` 의 프로젝트가 같은 `maxWorkers` 를 갖기를
 * 요구하므로 직렬 io 는 언제나 뒤 그룹이다:
 *   serial          io 1워커, unit 뒤
 *   sqlite-serial   SQLite 신호 io 만 1워커로 뒤(`io-sqlite`), 나머지 io 는 unit 과 같은 그룹
 *   parallel        기본과 같다
 *
 * @param {{ io: string[], ioSqlite?: string[], base: object, exclude: string[], mode?: string }} input
 */
export function buildProjects({ io, ioSqlite = [], base, exclude, mode }) {
  const unit = (groupOrder) => ({
    test: {
      ...base,
      name: 'unit',
      include: [TEST_INCLUDE],
      exclude: [...exclude, ...io],
      pool: 'threads',
      setupFiles: [...base.setupFiles, UNIT_GUARD_SETUP],
      sequence: { groupOrder }
    }
  })
  const forks = (name, include, maxWorkers, groupOrder) => ({
    test: {
      ...base,
      name,
      include,
      pool: 'forks',
      maxWorkers,
      setupFiles: [...base.setupFiles, IO_GUARD_SETUP],
      sequence: { groupOrder }
    }
  })
  if (mode === undefined || mode === 'parallel') return [unit(0), forks('io', io, undefined, 0)]
  if (mode === 'serial') return [unit(0), forks('io', io, 1, 1)]
  if (mode === 'sqlite-serial') {
    const sqlite = io.filter((file) => ioSqlite.includes(file))
    const rest = io.filter((file) => !ioSqlite.includes(file))
    return [unit(0), forks('io', rest, undefined, 0), forks('io-sqlite', sqlite, 1, 1)]
  }
  throw new Error(`알 수 없는 io 모드: ${mode}`)
}

/**
 * unit 풀 가드. 자식 프로세스 생성(비동기 전부가 지나는 `ChildProcess.prototype.spawn` + 동기 3형태)과
 * better-sqlite3 네이티브 로드(`process.dlopen`)를 안내 메시지와 함께 throw 로 바꾸고 **위반을 기록한다**.
 * production 코드가 그 throw 를 삼켜 다른 분기로 통과할 수 있으므로(`runGit` 은 실패를 결과로 바꾼다)
 * 판정은 throw 가 아니라 기록이다 — unit setup 이 테스트마다 기록을 비우며 red 로 만든다.
 * 워커 스레드마다 builtin 모듈·`process` 가 따로라 그 스레드에만 걸린다.
 *
 * @param {{ childProcess: typeof import('node:child_process'), proc?: NodeJS.Process, sync?: () => void }} input
 */
export function installUnitGuard({ childProcess, proc = process, sync = () => {} }) {
  if (proc[UNIT_GUARD]) return proc[UNIT_GUARD]
  const state = { violations: [] }
  const fail = (what) => {
    const message = `[test-pools] unit 풀(threads)은 ${what} 을(를) 쓰지 않는다 — 이 파일이 io 로 분류되게 한다(scripts/test-pools.mjs IO_RULES · FORCED_IO)`
    state.violations.push(message)
    throw new Error(message)
  }
  childProcess.ChildProcess.prototype.spawn = function (options) {
    fail(`자식 프로세스(${options?.file ?? '?'})`)
  }
  for (const name of ['spawnSync', 'execFileSync', 'execSync']) {
    childProcess[name] = (file) => fail(`자식 프로세스(${name} ${String(file)})`)
  }
  const dlopen = proc.dlopen
  proc.dlopen = function (module, filename, ...rest) {
    if (/better_sqlite3\.node$/i.test(String(filename))) fail('네이티브 SQLite(better-sqlite3)')
    return dlopen.call(this, module, filename, ...rest)
  }
  proc[UNIT_GUARD] = state
  sync()
  return state
}

/**
 * 워커 스레드의 `process.env` 는 스레드 사본이라 `os.homedir()`(libuv — **프로세스** 환경을 읽는다)에
 * 닿지 않는다. 그대로 두면 unit 파일은 setup 이 바꾼 홈이 아니라 실제 홈을 본다(0294 격리 붕괴 —
 * hostile 테스트가 잡았다). forks 와 같은 의미가 되게 스레드의 `os.homedir` 를 사본 env 우선으로 바꾼다:
 * libuv 도 POSIX 는 `HOME`, Windows 는 `USERPROFILE` 을 먼저 본다.
 *
 * @param {{ os: typeof import('node:os'), proc?: NodeJS.Process, sync?: () => void }} input
 */
export function alignThreadHomedir({ os, proc = process, sync = () => {} }) {
  const original = os.homedir
  const key = proc.platform === 'win32' ? 'USERPROFILE' : 'HOME'
  os.homedir = () => proc.env[key] || original()
  sync()
}

/** 기록된 위반을 비우며 하나의 오류로 만든다. 없으면 null. */
export function drainGuardViolations(state) {
  const violations = state.violations.splice(0)
  if (violations.length === 0) return null
  const more = violations.length > 1 ? ` (외 ${violations.length - 1}건)` : ''
  return new Error(`${violations[0]}${more}`)
}

export const IO_GUARD = Symbol.for('orca.test.ioGitGuard')
export const IO_GUARD_SETUP = './scripts/vitest-io-guard.mjs'
export const FIXTURE_BUILDERS = ['createRepo', 'appendCommit']
export const IO_GIT_ALLOWED = [
  {
    file: 'src/main/infra/git/hermetic-config.test.ts',
    subcommand: 'init',
    count: 2,
    reason: '격리 설정·템플릿 동작'
  },
  {
    file: 'src/main/infra/git/hermetic-config.test.ts',
    subcommand: 'add',
    count: 1,
    reason: '실제 commit 서명·maintenance 검사'
  },
  {
    file: 'src/main/infra/git/hermetic-config.test.ts',
    subcommand: 'commit',
    count: 1,
    reason: 'hostile 대표'
  },
  {
    file: 'src/main/infra/git/temp-repo.test.ts',
    subcommand: 'add',
    count: 2,
    reason: 'porcelain 동치 비교'
  },
  {
    file: 'src/main/infra/git/temp-repo.test.ts',
    subcommand: 'commit',
    count: 2,
    reason: 'porcelain 동치 비교'
  }
]
const BUILD_COMMANDS = new Set(['init', 'add', 'commit', 'fast-import'])
const isTestFrame = (file) => /\.(?:test|testfixture)\.tsx?$/.test(file)

export function gitSubcommand(args) {
  let k = 0
  while (k < args.length) {
    if (args[k] === '-C' || args[k] === '-c') k += 2
    else if (args[k] === '--no-optional-locks' || /^--[^=]+=/.test(args[k])) k++
    else return args[k]
  }
  return undefined
}

/** app 소스만 분류한다. 감시기·테스트 런너 프레임은 production 경로가 아니다. */
export function gitSpawnFrames(stack) {
  return String(stack)
    .split('\n')
    .flatMap((line) => {
      const normalized = line.replaceAll('\\', '/')
      const match = normalized.match(
        /at (?:async )?(?:(\S+) )?\(?(?:file:\/\/)?[^\n]*?\/app\/(src\/[^:)]+):\d+:\d+\)?$/i
      )
      return match ? [{ fn: match[1] ?? '', file: match[2] }] : []
    })
}

/** @param {{file: string, args: string[], frames: {file: string, fn?: string}[], allowed?: typeof IO_GIT_ALLOWED}} input */
export function judgeGitSpawn({ file, args, frames, allowed = IO_GIT_ALLOWED }) {
  if (!/(^|[\\/])git(?:\.exe)?$/i.test(file)) return { kind: 'ignore' }
  const tests = frames.filter((frame) => isTestFrame(frame.file))
  if (
    frames.some(
      (frame) => !isTestFrame(frame.file) && frame.file !== 'src/main/infra/git/runner.ts'
    )
  )
    return { kind: 'pass' }
  if (tests.length === 0) return { kind: 'pass' }
  if (/^git(?:\.exe)?$/i.test(file))
    return { kind: 'violation', message: '[test-git] 테스트 git은 실행 파일 경로로 띄운다' }
  const subcommand = gitSubcommand(args)
  if (!BUILD_COMMANDS.has(subcommand)) return { kind: 'pass' }
  if (
    tests.some(
      (frame) =>
        frame.file === 'src/main/infra/git/temp-repo.testfixture.ts' &&
        FIXTURE_BUILDERS.includes(frame.fn?.split('.').at(-1))
    )
  )
    return { kind: 'pass' }
  const entry = allowed.find(
    (item) => item.subcommand === subcommand && tests.some((frame) => frame.file === item.file)
  )
  if (entry) return { kind: 'allowed', entry }
  return {
    kind: 'violation',
    message: `[test-git] ${subcommand}는 createRepo·appendCommit 빌더로 구성한다 (${tests[0].file})`
  }
}

export function finishGitAllowances(state, file, allowed = IO_GIT_ALLOWED) {
  for (const entry of allowed.filter((item) => item.file === file)) {
    const count = state.counts.get(`${entry.file}:${entry.subcommand}`) ?? 0
    if (count !== entry.count)
      state.violations.push(
        `[test-git] ${entry.file} ${entry.subcommand}: ${count} != ${entry.count}`
      )
  }
}

export function installIoGitGuard({ childProcess, proc = process, sync = () => {} }) {
  if (proc[IO_GUARD]) return proc[IO_GUARD]
  const state = { violations: [], counts: new Map(), spawns: [] }
  // execFile은 timeout을 자체 소비하고 spawn에 전달하지 않는다. 동기 진입 구간의 원 옵션을
  // 보존해, 빌더의 프로세스 상한이 실제 실행 경계에 도달했는지도 관측한다.
  let execOptions
  const originalExecFile = childProcess.execFile
  childProcess.execFile = function (file, args, options, ...rest) {
    const previous = execOptions
    execOptions = Array.isArray(args) ? options : args
    try {
      return originalExecFile.call(this, file, args, options, ...rest)
    } finally {
      execOptions = previous
    }
  }
  // Node는 execFile의 custom promisify가 stdout·stderr와 child를 함께 돌려준다.
  // 감시 래퍼에도 메타데이터를 보존해야 promisify(execFile)의 API가 바뀌지 않는다.
  for (const key of Object.getOwnPropertySymbols(originalExecFile ?? {}))
    Object.defineProperty(
      childProcess.execFile,
      key,
      Object.getOwnPropertyDescriptor(originalExecFile, key)
    )
  const record = (file, args, options) => {
    const limit = Error.stackTraceLimit
    let frames
    try {
      Error.stackTraceLimit = 200
      frames = gitSpawnFrames(new Error().stack)
    } finally {
      Error.stackTraceLimit = limit
    }
    const result = judgeGitSpawn({ file: String(file ?? ''), args, frames })
    if (result.kind !== 'ignore')
      state.spawns.push({
        file,
        args,
        frames,
        kind: result.kind,
        timeout: options?.timeout ?? execOptions?.timeout
      })
    if (result.kind === 'violation') state.violations.push(result.message)
    if (result.kind === 'allowed') {
      const key = `${result.entry.file}:${result.entry.subcommand}`
      state.counts.set(key, (state.counts.get(key) ?? 0) + 1)
    }
  }
  const originalSpawn = childProcess.ChildProcess.prototype.spawn
  childProcess.ChildProcess.prototype.spawn = function (options) {
    record(options?.file, options?.args?.slice(1) ?? [], options)
    return originalSpawn.call(this, options)
  }
  for (const name of ['spawnSync', 'execFileSync', 'execSync']) {
    const original = childProcess[name]
    childProcess[name] = function (file, args, ...rest) {
      if (name === 'execSync') {
        const words = String(file).match(/"[^"]*"|'[^']*'|\S+/g) ?? []
        record(words[0]?.replace(/^["']|["']$/g, ''), words.slice(1))
      } else record(file, Array.isArray(args) ? args : [], Array.isArray(args) ? rest[0] : args)
      return original.call(this, file, args, ...rest)
    }
  }
  proc[IO_GUARD] = state
  sync()
  return state
}
