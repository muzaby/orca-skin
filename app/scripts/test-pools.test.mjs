// test-pools 단위 테스트 (0298) — 분류 규칙 · 프로젝트 필드 · unit 가드 · 저장소별 git config 부재.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import { TEST_TIME_SCALE_ENV, scaleMs } from './test-time.mjs'
import {
  FORCED_IO,
  IO_RULES,
  TEST_INCLUDE,
  UNIT_GUARD_SETUP,
  IO_GUARD_SETUP,
  IO_GIT_ALLOWED,
  judgeGitSpawn,
  gitSpawnFrames,
  gitSubcommand,
  finishGitAllowances,
  installIoGitGuard,
  IO_MODES,
  IO_MODE_ENV,
  buildProjects,
  classifyTestSource,
  partitionTestFiles,
  resolveIoMode
} from './test-pools.mjs'

const APP = join(dirname(fileURLToPath(import.meta.url)), '..')
const FORCED_PATH = Object.keys(FORCED_IO)[0]

describe('classifyTestSource — 규칙마다 그 신호 하나만 든 입력', () => {
  const cases = [
    ['child-process', "import { spawn } from 'node:child_process'\n"],
    ['child-process', "const cp = require('child_process')\n"],
    ['child-process', "const cp = await import('node:child_process')\n"],
    ['git-fixture', "import { execGit } from '../infra/git/temp-repo.testfixture'\n"],
    ['run-git', "await runGit(dir, ['init'])\n"],
    ['sqlite', "import Database from 'better-sqlite3'\n"],
    ['sqlite', 'const db = openDb(path)\n'],
    ['sqlite', 'const db = new Database(":memory:")\n'],
    ['sqlite', 'const db = openFileDatabase(join(dir, "a.db"))\n'],
    ['sqlite', 'initDb(userData)\n'],
    ['sqlite', 'await warmFileSqlite()\n'],
    ['timezone', "process.env.TZ = 'America/New_York'\n"],
    ['timezone', "process.env['TZ'] = 'UTC'\n"]
  ]
  for (const [id, source] of cases) {
    test(`${id}: ${source.trim()}`, () => {
      assert.deepEqual(classifyTestSource(source, 'src/x.test.ts'), { pool: 'io', reasons: [id] })
    })
  }
  test('forced: 경로가 FORCED_IO 에 있으면 신호 없이도 io', () => {
    assert.deepEqual(classifyTestSource('expect(1).toBe(1)\n', FORCED_PATH), {
      pool: 'io',
      reasons: ['forced']
    })
  })
  test('신호 없음 → unit', () => {
    assert.deepEqual(
      classifyTestSource("import { x } from './x'\nexpect(x).toBe(1)\n", 'src/x.test.ts'),
      {
        pool: 'unit',
        reasons: []
      }
    )
  })
  test('주석 안의 신호는 세지 않는다', () => {
    const source = "// import { spawn } from 'node:child_process'\n/* openDb(x) runGit(y) */\n"
    assert.equal(classifyTestSource(source, 'src/x.test.ts').pool, 'unit')
  })
  test('runGit 이 있어도 execFileImpl 을 주입하면 unit — 실제로 띄우지 않는다', () => {
    const source = 'await runGit(dir, args, { execFileImpl: fake })\n'
    assert.equal(classifyTestSource(source, 'src/x.test.ts').pool, 'unit')
  })
  test('getBuiltinModule 로 얻은 child_process 는 신호가 아니다 — 런타임 가드가 막는다', () => {
    const source = "process.getBuiltinModule('node:child_process')\n"
    assert.equal(classifyTestSource(source, 'src/x.test.ts').pool, 'unit')
  })
  test('규칙 id 는 6개이고 서로 다르다', () => {
    assert.deepEqual(
      IO_RULES.map((rule) => rule.id),
      ['child-process', 'git-fixture', 'run-git', 'sqlite', 'timezone', 'forced']
    )
  })
})

describe('buildProjects — 환경별 필드', () => {
  const base = { environment: 'node', setupFiles: ['./scripts/vitest-setup.mjs'] }
  const make = (platform, ci) =>
    buildProjects({ platform, ci, io: ['src/a.test.ts'], base, exclude: ['**/node_modules/**'] })
  const byName = (projects) => Object.fromEntries(projects.map((p) => [p.test.name, p.test]))

  for (const [platform, ci] of [
    ['win32', 'true'],
    ['linux', 'true'],
    ['win32', undefined],
    ['linux', undefined]
  ]) {
    test(`${platform} + CI=${ci}: 직렬 없이 둘 다 maxWorkers 미지정·같은 그룹 0 (ΔV4)`, () => {
      const { unit, io } = byName(make(platform, ci))
      assert.equal(io.maxWorkers, undefined)
      assert.equal(unit.maxWorkers, undefined)
      assert.equal(io.sequence.groupOrder, 0)
      assert.equal(unit.sequence.groupOrder, 0)
    })
  }
  test('unit = threads·가드 setup, io = forks', () => {
    const { unit, io } = byName(make('linux', undefined))
    assert.equal(unit.pool, 'threads')
    assert.equal(io.pool, 'forks')
    assert.deepEqual(unit.setupFiles, ['./scripts/vitest-setup.mjs', UNIT_GUARD_SETUP])
    assert.deepEqual(io.setupFiles, ['./scripts/vitest-setup.mjs', IO_GUARD_SETUP])
  })
  test('unit 은 전체에서 io 를 빼고, io 는 io 목록만', () => {
    const { unit, io } = byName(make('linux', undefined))
    assert.deepEqual(unit.include, [TEST_INCLUDE])
    assert.deepEqual(unit.exclude, ['**/node_modules/**', 'src/a.test.ts'])
    assert.deepEqual(io.include, ['src/a.test.ts'])
  })
})

describe('io 실측 모드 (0298 ΔV2)', () => {
  const base = { environment: 'node', setupFiles: ['./scripts/vitest-setup.mjs'] }
  const io = ['src/git.test.ts', 'src/db.test.ts']
  const make = (mode, platform = 'linux', ci = undefined) =>
    Object.fromEntries(
      buildProjects({
        platform,
        ci,
        io,
        ioSqlite: ['src/db.test.ts'],
        base,
        exclude: [],
        mode
      }).map((p) => [
        p.test.name,
        {
          include: p.test.include,
          maxWorkers: p.test.maxWorkers,
          group: p.test.sequence.groupOrder,
          pool: p.test.pool,
          isolate: p.test.isolate
        }
      ])
    )
  test('resolveIoMode: 미설정·빈 값 → undefined, 목록 값 그대로, 그 밖은 throw', () => {
    assert.equal(resolveIoMode({}), undefined)
    assert.equal(resolveIoMode({ ORCINUS_ORCA_TEST_IO_MODE: ' ' }), undefined)
    for (const mode of IO_MODES)
      assert.equal(resolveIoMode({ ORCINUS_ORCA_TEST_IO_MODE: mode }), mode)
    assert.throws(
      () => resolveIoMode({ ORCINUS_ORCA_TEST_IO_MODE: 'fast' }),
      /ORCINUS_ORCA_TEST_IO_MODE=fast/
    )
    assert.deepEqual(IO_MODES, ['serial', 'sqlite-serial', 'parallel'])
  })
  test('미설정 = parallel: Windows CI 에서도 io 기본 워커·unit 과 같은 그룹 (ΔV4)', () => {
    for (const [platform, ci] of [
      ['win32', 'true'],
      ['linux', undefined]
    ]) {
      assert.deepEqual(make(undefined, platform, ci), make('parallel', platform, ci))
      assert.deepEqual(make(undefined, platform, ci).io, {
        include: io,
        maxWorkers: undefined,
        group: 0,
        pool: 'forks',
        isolate: undefined
      })
    }
  })
  test('serial: 플랫폼과 무관하게 io 1워커·unit 뒤', () => {
    assert.deepEqual(make('serial').io, {
      include: io,
      maxWorkers: 1,
      group: 1,
      pool: 'forks',
      isolate: undefined
    })
    assert.equal(make('serial').unit.group, 0)
  })
  test('parallel: io 기본 워커·unit 과 같은 그룹', () => {
    assert.deepEqual(make('parallel', 'win32', 'true').io, {
      include: io,
      maxWorkers: undefined,
      group: 0,
      pool: 'forks',
      isolate: undefined
    })
  })
  test('sqlite-serial: SQLite io 만 1워커로 group 1, 나머지 io 는 unit 과 group 0', () => {
    const p = make('sqlite-serial', 'win32', 'true')
    assert.deepEqual(p['io-sqlite'], {
      include: ['src/db.test.ts'],
      maxWorkers: 1,
      group: 1,
      pool: 'forks',
      isolate: undefined
    })
    assert.deepEqual(p.io, {
      include: ['src/git.test.ts'],
      maxWorkers: undefined,
      group: 0,
      pool: 'forks',
      isolate: undefined
    })
    assert.equal(p.unit.group, 0)
  })
  test('모든 모드: 같은 group 의 프로젝트는 maxWorkers 가 같다(vitest 제약)', () => {
    for (const mode of [undefined, ...IO_MODES]) {
      for (const [platform, ci] of [
        ['win32', 'true'],
        ['linux', undefined]
      ]) {
        const byGroup = new Map()
        for (const p of Object.values(make(mode, platform, ci))) {
          const seen = byGroup.get(p.group)
          if (seen === undefined) byGroup.set(p.group, p.maxWorkers)
          else assert.equal(p.maxWorkers, seen, `${mode} ${platform} group ${p.group}`)
        }
      }
    }
  })
})

describe('partitionTestFiles — ioSqlite 는 sqlite 신호 io 만 (ΔV5)', () => {
  test('DB·Git·순수 파일을 구별해 전체 분할과 SQLite 부분집합을 운반한다', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orcinus-orca-pool-partition-'))
    try {
      mkdirSync(join(dir, 'src'))
      writeFileSync(join(dir, 'src', 'db.test.ts'), 'openDb(path)\n')
      writeFileSync(
        join(dir, 'src', 'git.test.ts'),
        "import { execGit } from './temp-repo.testfixture'\n"
      )
      writeFileSync(join(dir, 'src', 'pure.test.ts'), 'expect(1).toBe(1)\n')
      assert.deepEqual(partitionTestFiles(dir), {
        io: ['src/db.test.ts', 'src/git.test.ts'],
        unit: ['src/pure.test.ts'],
        ioSqlite: ['src/db.test.ts']
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('vitest.config.ts 배선 — 실측 모드와 SQLite 부분집합 전달 (ΔV5)', () => {
  function configuredProjects(mode) {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const c = (await import(${JSON.stringify(pathToFileURL(join(APP, 'vitest.config.ts')).href)})).default; console.log(JSON.stringify(c.test.projects.map((p) => p.test).sort((a, b) => a.name.localeCompare(b.name))))`
      ],
      { cwd: APP, env: { ...process.env, ORCINUS_ORCA_TEST_IO_MODE: mode }, encoding: 'utf8' }
    )
    assert.equal(result.status, 0, result.stdout + result.stderr)
    return Object.fromEntries(
      JSON.parse(result.stdout.trim().split('\n').at(-1)).map((p) => [p.name, p])
    )
  }

  test('serial: env 에서 고른 모드가 io 1워커·group 1까지 닿는다', () => {
    const { io, unit } = configuredProjects('serial')
    assert.equal(io.maxWorkers, 1)
    assert.equal(io.sequence.groupOrder, 1)
    assert.equal(unit.sequence.groupOrder, 0)
  })

  test('sqlite-serial: 트리의 SQLite 부분집합만 io-sqlite 에 전달한다', () => {
    const projects = configuredProjects('sqlite-serial')
    assert.deepEqual(Object.keys(projects), ['io', 'io-sqlite', 'unit'])
    const { ioSqlite } = partitionTestFiles(APP)
    assert.ok(ioSqlite.length > 0)
    assert.deepEqual(projects['io-sqlite'].include, ioSqlite)
    assert.deepEqual(
      projects.io.include.filter((file) => projects['io-sqlite'].include.includes(file)),
      []
    )
  })
})

describe('installUnitGuard — 워커 스레드에서 실제 모듈로', () => {
  // 가드는 그 스레드의 builtin 만 바꾼다 — 이 프로세스(main thread)는 건드리지 않는다.
  function inWorker(body) {
    const source = `
      const { parentPort } = require('node:worker_threads')
      const cp = require('node:child_process')
      const { syncBuiltinESMExports } = require('node:module')
      import(${JSON.stringify(new URL('./test-pools.mjs', import.meta.url).href)}).then(async ({ installUnitGuard, UNIT_GUARD }) => {
        const out = {}
        const tryIt = (name, fn) => { try { fn(); out[name] = 'ok' } catch (e) { out[name] = String(e.message) } }
        ${body}
        parentPort.postMessage(out)
      })`
    return new Promise((resolve, reject) => {
      const worker = new Worker(source, { eval: true })
      worker.once('message', resolve)
      worker.once('error', reject)
    })
  }

  test('설치 후 spawn·spawnSync·execFileSync·execSync 가 [test-pools] 로 throw', async () => {
    const out = await inWorker(`
      installUnitGuard({ childProcess: cp, sync: syncBuiltinESMExports })
      out.flag = Array.isArray(process[UNIT_GUARD]?.violations)
      tryIt('spawn', () => cp.spawn(process.execPath, ['-e', '0']))
      tryIt('execFile', () => cp.execFile(process.execPath, ['-e', '0'], () => {}))
      tryIt('spawnSync', () => cp.spawnSync(process.execPath, ['-e', '0']))
      tryIt('execFileSync', () => cp.execFileSync(process.execPath, ['-e', '0']))
      tryIt('execSync', () => cp.execSync('echo x'))`)
    assert.equal(out.flag, true)
    for (const name of ['spawn', 'execFile', 'spawnSync', 'execFileSync', 'execSync']) {
      assert.match(out[name], /^\[test-pools\] unit 풀/, name)
    }
  })
  test('better_sqlite3.node 로드는 throw, 그 밖의 dlopen 은 원래 함수로 넘긴다', async () => {
    const out = await inWorker(`
      const seen = []
      const original = process.dlopen
      process.dlopen = (m, f) => { seen.push(f) }
      installUnitGuard({ childProcess: cp })
      tryIt('sqlite', () => process.dlopen({}, '/x/build/Release/better_sqlite3.node'))
      tryIt('other', () => process.dlopen({}, '/x/other.node'))
      out.seen = seen
      process.dlopen = original`)
    assert.match(out.sqlite, /네이티브 SQLite/)
    assert.equal(out.other, 'ok')
    assert.deepEqual(out.seen, ['/x/other.node'])
  })
  test('설치 전에는 spawnSync 가 동작한다', async () => {
    const out = await inWorker(
      `tryIt('spawnSync', () => cp.spawnSync(process.execPath, ['-e', '0']))`
    )
    assert.equal(out.spawnSync, 'ok')
  })
  test('재설치는 첫 상태를 돌려주고 위반은 그 상태에 쌓인다 (ΔV5)', async () => {
    const out = await inWorker(`
      const a = installUnitGuard({ childProcess: cp, sync: syncBuiltinESMExports })
      const firstSpawnSync = cp.spawnSync
      const b = installUnitGuard({ childProcess: cp, sync: syncBuiltinESMExports })
      out.sameState = a === b
      out.sameWrapper = firstSpawnSync === cp.spawnSync
      tryIt('spawnSync', () => cp.spawnSync(process.execPath, ['-e', '0']))
      out.violations = a.violations.length`)
    assert.equal(out.sameState, true)
    assert.equal(out.sameWrapper, true)
    assert.match(out.spawnSync, /^\[test-pools\] unit 풀/)
    assert.equal(out.violations, 1)
  })
})

describe('alignThreadHomedir — 워커 스레드의 os.homedir 를 스레드 env 에 맞춘다', () => {
  const run = (align) =>
    new Promise((resolve, reject) => {
      const source = `
        const { parentPort } = require('node:worker_threads')
        const os = require('node:os')
        import(${JSON.stringify(new URL('./test-pools.mjs', import.meta.url).href)}).then(({ alignThreadHomedir }) => {
          const key = process.platform === 'win32' ? 'USERPROFILE' : 'HOME'
          const before = os.homedir()
          process.env[key] = before + '-thread'
          if (${align}) alignThreadHomedir({ os })
          parentPort.postMessage({ before, after: os.homedir() })
        })`
      const worker = new Worker(source, { eval: true })
      worker.once('message', resolve)
      worker.once('error', reject)
    })
  test('맞추면 스레드에서 바꾼 홈을 돌려준다', async () => {
    const { before, after } = await run(true)
    assert.equal(after, before + '-thread')
  })
  test('맞추지 않으면 프로세스 홈 그대로다 — 맞춤이 필요한 이유', async () => {
    const { before, after } = await run(false)
    assert.equal(after, before)
  })
})

describe('unit setup 의 훅 배선 — 테스트 밖에서 삼킨 위반도 파일을 red 로 만든다', () => {
  // afterEach 는 `src/main/infra/test-pools.test.ts` 의 it.fails 가 잠근다. afterAll(파일 정리 훅에서 삼킨
  // 위반)은 그 파일 안에서 관측할 수 없어 최소 vitest 를 한 번 띄운다 — threads 1스레드, 워커 프로세스 없음.
  test('afterAll 에서 삼킨 자식 프로세스 시도 → vitest 비정상 종료 + [test-pools]', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orcinus-orca-unit-guard-'))
    try {
      writeFileSync(
        join(dir, 'vitest.config.mjs'),
        `export default { test: { globals: true, include: ['guard.test.mjs'], pool: 'threads', setupFiles: [${JSON.stringify(join(APP, 'scripts', 'vitest-unit-guard.mjs'))}] } }\n`
      )
      writeFileSync(
        join(dir, 'guard.test.mjs'),
        "test('passes', () => expect(1).toBe(1))\nafterAll(() => { try { process.getBuiltinModule('node:child_process').spawnSync(process.execPath, ['-e', '0']) } catch {} })\n"
      )
      const result = spawnSync(
        process.execPath,
        [
          join(APP, 'node_modules', 'vitest', 'vitest.mjs'),
          'run',
          '--config',
          join(dir, 'vitest.config.mjs'),
          '--root',
          dir
        ],
        { cwd: APP, encoding: 'utf8', env: { ...process.env, CI: '' } }
      )
      assert.notEqual(result.status, 0, result.stdout + result.stderr)
      assert.match(result.stdout + result.stderr, /\[test-pools\] unit 풀/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('partitionTestFiles — 실제 트리', () => {
  test('io 와 unit 이 겹치지 않고 합이 전체 *.test.ts 다', () => {
    const { io, unit } = partitionTestFiles(APP)
    const all = readdirSync(join(APP, 'src'), { recursive: true, encoding: 'utf8' })
      .filter((entry) => entry.endsWith('.test.ts'))
      .map((entry) => `src/${entry.split(sep).join('/')}`)
      .sort()
    assert.deepEqual([...io, ...unit].sort(), all)
    assert.equal(io.filter((file) => unit.includes(file)).length, 0)
    for (const forced of Object.keys(FORCED_IO)) assert.ok(io.includes(forced), forced)
  })
  test('FORCED_IO 는 프로세스 격리가 필요한 파일만 남기고 Git 조회를 대체한 send 검사는 unit 이다', () => {
    assert.deepEqual(Object.keys(FORCED_IO).sort(), ['src/main/infra/loopback-callback.test.ts'])
    const profile = 'src/main/app/chat-turn/send.agent-profile.test.ts'
    assert.equal(classifyTestSource(readFileSync(join(APP, profile), 'utf8'), profile).pool, 'unit')
  })
})

describe('저장소별 git 신원·줄바꿈 설정 (0298 — 격리 전역 설정이 대신한다)', () => {
  test('테스트 소스에 `git config user.*`·`core.autocrlf` 호출이 없다', () => {
    const offenders = readdirSync(join(APP, 'src'), { recursive: true, encoding: 'utf8' })
      .filter((entry) => /\.test(?:fixture)?\.tsx?$/.test(entry))
      .flatMap((entry) =>
        readFileSync(join(APP, 'src', entry), 'utf8')
          .split('\n')
          .map((line, index) => [entry, index + 1, line])
          .filter(([, , line]) =>
            /'config',\s*'(?:user\.email|user\.name|core\.autocrlf)'/.test(line)
          )
          .map(([file, line]) => `${file}:${line}`)
      )
    assert.deepEqual(offenders, [])
  })
})

describe('io git guard — J1~J9', () => {
  const testFile = 'src/main/infra/git/example.test.ts'
  const fixture = 'src/main/infra/git/temp-repo.testfixture.ts'
  const frames = [
    { file: fixture, fn: 'execGit' },
    { file: testFile, fn: 'test' }
  ]
  const judge = (patch = {}) =>
    judgeGitSpawn({ file: '/usr/bin/git', args: ['init'], frames, ...patch })
  test('git 식별·production·비동기로 끊긴 경로·일반 명령', () => {
    assert.equal(judge({ file: 'node' }).kind, 'ignore')
    assert.equal(
      judge({ frames: [...frames, { file: 'src/main/infra/git/git-cli.ts', fn: 'resolveDirty' }] })
        .kind,
      'pass'
    )
    assert.equal(
      judge({ frames: [{ file: 'src/main/infra/git/runner.ts', fn: 'runGit' }] }).kind,
      'pass'
    )
    for (const args of [['status'], ['remote', 'add'], ['worktree', 'add']])
      assert.equal(judge({ args }).kind, 'pass')
    assert.equal(
      judge({ frames: [...frames, { file: 'src/main/infra/git/runner.ts', fn: 'runGit' }] }).kind,
      'violation'
    )
  })
  test('빌더 예외는 두 함수·정본 파일만, 허용 목록은 계수', () => {
    for (const fn of ['createRepo', 'appendCommit']) {
      assert.equal(judge({ frames: [...frames, { file: fixture, fn }] }).kind, 'pass')
      assert.equal(judge({ frames: [...frames, { file: testFile, fn }] }).kind, 'violation')
    }
    for (const entry of IO_GIT_ALLOWED) {
      const result = judge({ args: [entry.subcommand], frames: [{ file: entry.file }] })
      assert.equal(result.kind, 'allowed')
      assert.equal(result.entry, entry)
    }
    const allowed = [{ file: testFile, subcommand: 'init', count: 2, reason: 'test' }]
    for (const count of [0, 1, 2, 3]) {
      const state = { violations: [], counts: new Map([[`${testFile}:init`, count]]) }
      finishGitAllowances(state, testFile, allowed)
      assert.equal(state.violations.length, count === 2 ? 0 : 1)
    }
  })
  test('이름 실행은 빌더·허용 목록에서도 red', () => {
    for (const file of ['git', 'git.exe', 'GIT.EXE']) {
      assert.equal(judge({ file, args: ['status'] }).kind, 'violation')
      assert.equal(
        judge({ file, frames: [...frames, { file: fixture, fn: 'createRepo' }] }).kind,
        'violation'
      )
    }
  })
  test('앞 옵션을 건너뛰고 app 스택을 정규화한다', () => {
    for (const args of [
      ['-C', 'dir', 'commit'],
      ['-c', 'k=v', 'commit'],
      ['--no-optional-locks', 'commit'],
      ['--git-dir=x', 'commit'],
      ['-C', 'dir', '-c', 'x=y', '--no-optional-locks', '--work-tree=x', 'commit']
    ]) {
      assert.equal(gitSubcommand(args), 'commit')
      assert.equal(judge({ args }).kind, 'violation')
    }
    assert.equal(gitSubcommand([]), undefined)
    assert.deepEqual(
      gitSpawnFrames(
        'Error\n    at async createRepo (C:\\repo\\app\\src\\main\\infra\\git\\temp-repo.testfixture.ts:88:4)\n    at test (file:///repo/app/src/main/test.test.ts:1:2)\n    at record (/repo/app/scripts/test-pools.mjs:10:2)'
      ),
      [
        { file: fixture, fn: 'createRepo' },
        { file: 'src/main/test.test.ts', fn: 'test' }
      ]
    )
  })
})

test('io 감시는 async spawn·sync 3형태를 보존하고 builtin을 한 번 동기화한다', () => {
  const calls = []
  const original = function (...args) {
    calls.push({ receiver: this, args })
    return 'original'
  }
  const childProcess = {
    ChildProcess: function () {
      this.testChild = true
    },
    spawnSync: original,
    execFileSync: original,
    execSync: original
  }
  childProcess.ChildProcess.prototype.spawn = original
  const proc = {}
  let synced = 0
  const input = { childProcess, proc, sync: () => synced++ }
  const state = installIoGitGuard(input)
  assert.equal(installIoGitGuard(input), state)
  assert.equal(synced, 1)
  const child = new childProcess.ChildProcess()
  const options = { file: '/usr/bin/git', args: ['git', '-C', 'repo', 'status'] }
  assert.equal(child.spawn(options), 'original')
  for (const name of ['spawnSync', 'execFileSync'])
    assert.equal(childProcess[name]('/usr/bin/git', ['status']), 'original')
  assert.equal(childProcess.execSync('"/usr/bin/git" status'), 'original')
  assert.equal(calls.length, 4)
  assert.equal(calls[0].receiver, child)
  assert.equal(calls[0].args[0], options)
  assert.deepEqual(
    state.spawns.map(({ file, args }) => ({ file, args })),
    [
      { file: '/usr/bin/git', args: ['-C', 'repo', 'status'] },
      ...Array.from({ length: 3 }, () => ({ file: '/usr/bin/git', args: ['status'] }))
    ]
  )
})

test('외부 라이브러리의 src 프레임을 production 앱 프레임으로 세지 않는다', () => {
  const frames = gitSpawnFrames(
    'Error\n    at wrapper (/repo/app/node_modules/tool/src/helper.ts:1:2)\n    at fixture (/repo/app/src/example.test.ts:3:4)'
  )
  assert.deepEqual(frames, [{ fn: 'fixture', file: 'src/example.test.ts' }])
  assert.equal(judgeGitSpawn({ file: '/usr/bin/git', args: ['init'], frames }).kind, 'violation')
})

test('io 감시는 promisify(execFile)의 stdout·stderr·child 계약을 보존한다', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
import cp from 'node:child_process'
import { promisify } from 'node:util'
import { syncBuiltinESMExports } from 'node:module'
import assert from 'node:assert/strict'
import { installIoGitGuard } from ${JSON.stringify(pathToFileURL(join(APP, 'scripts/test-pools.mjs')).href)}
installIoGitGuard({ childProcess: cp, sync: syncBuiltinESMExports })
const pending = promisify(cp.execFile)(process.execPath, ['-e', 'process.stdout.write("out"); process.stderr.write("err")'])
assert.ok(pending.child)
assert.deepEqual(await pending, { stdout: 'out', stderr: 'err' })
`
    ],
    { encoding: 'utf8', timeout: scaleMs(20_000) }
  )
  assert.equal(result.status, 0, result.stderr)
})

describe('실측 워크플로의 env·Variables 이름 (0306 EP-08)', () => {
  // 워크플로는 이름을 문자열로 쥔다 — 스크립트 상수와 어긋나면 설정한 모드·배율이 조용히 무시된다.
  const workflow = readFileSync(
    join(APP, '..', '.github', 'workflows', 'test-pools-experiment.yml'),
    'utf8'
  )
  const literal = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  test('작업 env 가 스크립트가 읽는 이름으로 모드와 배율을 넘기고 작업 상한이 CI 변수를 읽는다', () => {
    assert.match(
      workflow,
      new RegExp(`^      ${literal(IO_MODE_ENV)}: ${literal('${{ matrix.mode }}')}$`, 'm')
    )
    assert.match(
      workflow,
      new RegExp(
        `^      ${literal(TEST_TIME_SCALE_ENV)}: ${literal(`\${{ vars.${TEST_TIME_SCALE_ENV} }}`)}$`,
        'm'
      )
    )
    assert.match(
      workflow,
      /^ {4}timeout-minutes: \$\{\{ fromJSON\(vars\.ORCINUS_ORCA_CI_TIMEOUT_MINUTES \|\| '90'\) \}\}$/m
    )
  })
})
