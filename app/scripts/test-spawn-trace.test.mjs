// 집계기의 source 프레임과 감시기 프레임을 섞지 않는다. 실제 git 없이 두 호출 스택을 만든다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import cp from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { Script } from 'node:vm'
import { fileURLToPath } from 'node:url'
import { syncBuiltinESMExports } from 'node:module'
import { scaleMs } from './test-time.mjs'

test('git census는 감시기를 빼고 테스트 측·production을 구분하며 초과를 거부한다', async () => {
  const root = mkdtempSync(join(tmpdir(), 'orca-spawn-trace-'))
  const trace = join(root, 'src_probe.test.ts.jsonl')
  const previous = process.env.ORCA_SPAWN_TRACE
  const saved = {
    spawn: cp.ChildProcess.prototype.spawn,
    spawnSync: cp.spawnSync,
    execFileSync: cp.execFileSync
  }
  const source = (name) => join(root, 'app', name).split(sep).join('/')
  try {
    process.env.ORCA_SPAWN_TRACE = trace
    cp.spawnSync = () => ({ status: 0 })
    cp.execFileSync = () => Buffer.alloc(0)
    await import('../../docs/handoff/0300-ci-git-spawn-reduction/evidence/spawn-trace.mjs')
    const intercepted = new Script(
      '(function intercepted() { cp.spawnSync("git", ["fast-import"]) })',
      {
        filename: source('scripts/observer.mjs')
      }
    ).runInNewContext({ cp })
    new Script('intercepted()', { filename: source('src/probe.test.ts') }).runInNewContext({
      intercepted
    })
    const production = new Script('(function production() { cp.spawnSync("git", ["status"]) })', {
      filename: source('src/main/infra/git/repository.ts')
    }).runInNewContext({ cp })
    new Script('production()', { filename: source('src/probe.test.ts') }).runInNewContext({
      production
    })
    const records = readFileSync(trace, 'utf8').trim().split('\n').map(JSON.parse)
    assert.deepEqual(
      records[0].frames.map(({ file }) => file),
      ['src/probe.test.ts']
    )
    assert.deepEqual(
      records[1].frames.map(({ file }) => file),
      ['src/main/infra/git/repository.ts', 'src/probe.test.ts']
    )
    const census = fileURLToPath(
      new URL(
        '../../docs/handoff/0300-ci-git-spawn-reduction/evidence/git-spawn-census.mjs',
        import.meta.url
      )
    )
    const run = (...flags) =>
      saved.spawnSync(process.execPath, [census, root, ...flags], {
        encoding: 'utf8',
        timeout: scaleMs(20_000)
      })
    const valid = run('--max-total', '2', '--max-test-side', '1')
    assert.equal(valid.status, 0, valid.stderr)
    assert.match(valid.stdout, /SUM\t2\t1\t1\t1/)
    const over = run('--max-total', '1')
    assert.equal(over.status, 1)
    assert.match(over.stderr, /total 2 > 1/)
  } finally {
    cp.ChildProcess.prototype.spawn = saved.spawn
    cp.spawnSync = saved.spawnSync
    cp.execFileSync = saved.execFileSync
    syncBuiltinESMExports()
    if (previous === undefined) delete process.env.ORCA_SPAWN_TRACE
    else process.env.ORCA_SPAWN_TRACE = previous
    rmSync(root, { recursive: true, force: true })
  }
})
