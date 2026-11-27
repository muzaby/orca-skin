import { test } from 'node:test'
import assert from 'node:assert/strict'
import { imageLane } from './measure-stage-d.mjs'
import {
  compatibleRun,
  distribution,
  hostDecision,
  rendererDecision
} from './stage-d/measurement.mjs'

test('R-W uses the per-job percentile and includes the threshold', () => {
  const jobs = [{ imageTimesMs: [...Array(18).fill(10), 50, 70] }]
  assert.deepEqual(imageLane(jobs, 50), { p95: 50, max: 70, lane: 'image' })
  assert.deepEqual(imageLane(jobs, 51), { p95: 50, max: 70, lane: 'compute' })
})

test('R-W stays unmeasured when work timing or the threshold is missing', () => {
  assert.equal(imageLane([], 50), null)
  assert.equal(imageLane([{}], 50), null)
  assert.equal(imageLane([{ imageTimesMs: [10, undefined] }], 50), null)
  assert.equal(imageLane([{ imageTimesMs: [10] }], undefined), null)
})

const sample = {
  T1: 40,
  T2: 20,
  T3: 10,
  T4: 10,
  T5: 20,
  T6: null,
  C1: 8_000_000,
  C2: 10_000,
  longTasks: []
}

test('R-H uses elapsed host and window time without adding byte and row counts', () => {
  assert.equal(hostDecision([sample], 50).decision, 'on')
  assert.equal(hostDecision([{ ...sample, T5: 50 }], 50).decision, 'off')
  assert.equal(hostDecision([{ ...sample, T1: 29 }], 50).decision, 'off')
  assert.equal(hostDecision([{ ...sample, T1: 30, T5: 29 }], 50).decision, 'on')
  assert.equal(hostDecision([{ ...sample, T5: 40 }], 50).decision, 'off')
})

test('missing timing makes R-H and host-related R-R unavailable', () => {
  const missing = { ...sample, T2: null }
  assert.deepEqual(hostDecision([missing], 50), { decision: 'unavailable', missing: ['T2'] })
  assert.deepEqual(rendererDecision([missing], 50), { decision: 'unavailable', missing: ['T2'] })
})

test('R-R uses task duration and synchronous processing, independent of RAF wait', () => {
  assert.equal(rendererDecision([{ ...sample, longTasks: [50] }], 50).decision, 'on')
  assert.equal(rendererDecision([{ ...sample, longTasks: [49] }], 50).decision, 'off')
  assert.equal(rendererDecision([{ ...sample, T3: 50, longTasks: null }], 50).decision, 'on')
  assert.equal(rendererDecision([{ ...sample, T4: 50, longTasks: null }], 50).decision, 'on')
  assert.equal(rendererDecision([{ ...sample, T5: 80 }], 50).decision, 'off')
})

test('summaries retain the median, p95 and maximum and distinguish missing samples', () => {
  assert.deepEqual(distribution([12, 3, 6, 2]), { median: 4.5, p95: 12, max: 12 })
  assert.equal(distribution([2, null]), null)
  assert.equal(distribution([]), null)
})

test('comparison checks build provenance, input size and actual/diagnostic producer identity', () => {
  const before = {
    baseline: true,
    sha: 'base',
    environment: 'linux-electron',
    electron: '39.8.10',
    measurements: [{ id: 'S-D8', size: 0, source: 'actual-install' }]
  }
  const after = { ...before, baseline: false, sha: 'candidate' }
  assert.equal(compatibleRun(before, after), true)
  assert.equal(compatibleRun(before, { ...after, sha: 'base' }), false)
  assert.equal(compatibleRun(before, { ...after, electron: '40' }), false)
  assert.equal(compatibleRun(before, { ...after, measurements: [null] }), false)
  assert.equal(
    compatibleRun(before, {
      ...after,
      measurements: [{ ...after.measurements[0], size: 1 }]
    }),
    false
  )
  assert.equal(
    compatibleRun(before, {
      ...after,
      measurements: [{ ...after.measurements[0], source: 'diagnostic-install' }]
    }),
    false
  )
})

import {
  appSourceIdentity,
  measurementEnvironment,
  parseMeasureArgs,
  provenance,
  stampProvenance
} from './stage-d/measurement.mjs'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const archive = new URL(
  '../../docs/handoff/0328-composer-panels-lists-shell/evidence/',
  import.meta.url
)
const readRun = (side) => JSON.parse(readFileSync(new URL('r1.2-host-' + side + '.json', archive)))
const oldSource = '7'.repeat(40)
const fakeGit =
  (difference = false, untracked = '') =>
  (...args) => {
    switch (args[0]) {
      case 'rev-parse':
        return args[1].endsWith(':./src')
          ? 'source-tree'
          : args[1] === 'HEAD'
            ? 'tool-head'
            : args[1]
      case 'diff':
        if (difference && args[1] === '--quiet') throw Error('diff')
        return 'changed bytes'
      case 'status':
        return difference ? ' M src/a' : ''
      case 'ls-files':
        return untracked
      default:
        throw Error('unexpected git command')
    }
  }

test('environment follows the generating platform', () => {
  for (const platform of ['win32', 'linux', 'darwin'])
    assert.equal(measurementEnvironment(platform), platform + '-electron')
})

test('child records carry no provenance of their own', () => {
  for (const path of ['./stage-d-host/electron-main.mjs', './stage-d-shell/probe.ts']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /\bmeasurementEnvironment\b|\benvironment\s*:/, path)
  }
})

test('provenance stamps every scenario result', () => {
  const p = provenance({ platform: 'win32', git: fakeGit(), baseline: oldSource })
  assert.deepEqual(p, {
    environment: 'win32-electron',
    tool: 'tool-head',
    sha: oldSource,
    dirty: false,
    appSource: { commit: oldSource, tree: 'source-tree', dirty: false }
  })
  for (const result of [{ env: false }, { geometry: {} }, { ...structuredClone(p) }])
    assert.deepEqual(stampProvenance(result, p), { ...result, ...p })
  for (const key of Object.keys(p))
    assert.equal(stampProvenance({ [key]: 'different' }, p).provenanceConflict, true)
})

test('baseline identity checks application sources, not HEAD', () => {
  assert.deepEqual(appSourceIdentity({ git: fakeGit(), baseline: oldSource }), {
    commit: oldSource,
    tree: 'source-tree',
    dirty: false
  })
  for (const git of [fakeGit(true), fakeGit(false, 'src/new.ts')])
    assert.throws(
      () => appSourceIdentity({ git, baseline: oldSource }),
      /Baseline application sources must equal/
    )
  assert.deepEqual(appSourceIdentity({ git: fakeGit() }), {
    commit: 'tool-head',
    tree: 'source-tree',
    dirty: false
  })
  const dirty = appSourceIdentity({ git: fakeGit(true) })
  assert.equal(dirty.tree, null)
  assert.equal(dirty.dirty, true)
  assert.match(dirty.diffSha256, /^[a-f0-9]{64}$/)
})

test('app-source names the owner follow-up application', () => {
  const parse = (argv) => parseMeasureArgs(argv, { fixedBaseline: oldSource })
  assert.deepEqual(parse(['--baseline']), { baseline: oldSource, expected: undefined })
  assert.deepEqual(parse(['--app-source', oldSource]), { baseline: undefined, expected: oldSource })
  assert.equal(
    appSourceIdentity({ git: fakeGit(), ...parse(['--app-source', oldSource]) }).commit,
    oldSource
  )
  assert.throws(
    () => appSourceIdentity({ git: fakeGit(true), expected: oldSource }),
    /Application sources must equal/
  )
  for (const argv of [
    ['--app-source'],
    ['--app-source', 'abc'],
    ['--baseline', '--app-source', '8'.repeat(40)]
  ])
    assert.throws(() => parse(argv))
})

test('comparison requires the same allowed environment and distinct sources', () => {
  const before = readRun('baseline'),
    after = readRun('applied')
  for (const environment of ['linux-electron', 'win32-electron', 'darwin-electron', undefined])
    assert.equal(
      compatibleRun({ ...before, environment }, { ...after, environment }),
      ['linux-electron', 'win32-electron'].includes(environment)
    )
  assert.equal(compatibleRun(before, { ...after, environment: 'win32-electron' }), false)
  for (const key of ['before', 'after'])
    assert.equal(
      compatibleRun(
        { ...before, provenanceConflict: key === 'before' },
        { ...after, provenanceConflict: key === 'after' }
      ),
      false
    )
  assert.equal(
    compatibleRun(
      { ...before, appSource: { tree: 'one' } },
      { ...after, appSource: { tree: 'one' } }
    ),
    false
  )
  assert.equal(
    compatibleRun(
      { ...before, appSource: { tree: 'one' } },
      { ...after, appSource: { tree: 'two' } }
    ),
    true
  )
})

for (const [name, patch, expected] of [
  ['existing Linux evidence', {}, 0],
  ['mixed environments', { environment: 'win32-electron' }, 1],
  ['conflicting provenance', { provenanceConflict: true }, 1]
]) {
  test('compare CLI ' + name, (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'oo-compare-'))
    t.after(() => rmSync(dir, { recursive: true, force: true }))
    const before = readRun('baseline'),
      after = { ...readRun('applied'), ...patch }
    for (const [path, run] of [
      ['before', before],
      ['after', after]
    ])
      writeFileSync(join(dir, path), JSON.stringify(run))
    const result = spawnSync(
      process.execPath,
      [
        join(import.meta.dirname, 'measure-stage-d.mjs'),
        '--compare',
        join(dir, 'before'),
        join(dir, 'after')
      ],
      { encoding: 'utf8' }
    )
    assert.equal(result.status, expected, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.equal(report.verdict, !expected)
    if (!expected)
      assert.deepEqual(
        report.sources,
        [before, after].map(({ environment, sha }) => ({
          environment,
          sha,
          tool: null,
          appSource: null
        }))
      )
  })
}

test('non-comparison CLI stamps unavailable results and rejects a mismatched baseline first', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'oo-electron-missing-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const shim = join(dir, 'unavailable.cjs')
  writeFileSync(
    shim,
    `const Module=require('node:module'); const load=Module._load;
    Module._load=function(name,...args){return name === 'electron' ? '' : load.call(this,name,...args)}`
  )
  for (const [name, args] of [
    ['measure-stage-d.mjs', ['--geometry']],
    ['measure-stage-e.mjs', ['--old-db', 'small']]
  ]) {
    const command = (...extra) =>
      spawnSync(
        process.execPath,
        ['--require', shim, join(import.meta.dirname, name), ...args, ...extra],
        { encoding: 'utf8' }
      )
    const absent = command()
    assert.equal(absent.status, 3, absent.stderr)
    const result = JSON.parse(absent.stdout)
    assert.equal(result.env, false)
    assert.equal(result.environment, measurementEnvironment())
    assert.equal(result.sha, result.appSource.commit)
    assert.match(result.tool, /^[a-f0-9]{40}$/)
    const invalid = command('--baseline')
    assert.equal(invalid.status, 1)
    assert.match(invalid.stderr, /Baseline application sources must equal/)
    const otherSource = '7db1c7cefcdd3ef6d7f44cadbb9e6dc10fde76e6'
    const mismatched = command('--app-source', otherSource)
    assert.equal(mismatched.status, 1)
    assert.ok(mismatched.stderr.includes('Application sources must equal ' + otherSource))
    const missing = command('--app-source')
    assert.equal(missing.status, 1)
    assert.match(missing.stderr, /full commit SHA/)
  }
})

test('compare CLI carries each producer and application separately', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'oo-source-comparison-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const expected = []
  for (const phase of ['baseline', 'applied']) {
    const run = {
      ...readRun(phase),
      environment: 'win32-electron',
      tool: 'tool-' + phase,
      appSource: { tree: phase, commit: phase, dirty: false }
    }
    writeFileSync(join(dir, phase), JSON.stringify(run))
    const { environment, tool, appSource, sha } = run
    expected.push({ environment, tool, appSource, sha })
  }
  const run = spawnSync(
    process.execPath,
    [
      join(import.meta.dirname, 'measure-stage-d.mjs'),
      '--compare',
      join(dir, 'baseline'),
      join(dir, 'applied')
    ],
    { encoding: 'utf8' }
  )
  assert.equal(run.status, 0, run.stderr)
  assert.deepEqual(JSON.parse(run.stdout).sources, expected)
})
