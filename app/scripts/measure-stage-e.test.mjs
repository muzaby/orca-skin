import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { baselineHostSource } from './stage-e/baseline-source.mjs'
import { stageEVerdict } from './stage-e/verdict.mjs'
import { selectionExitCode } from './check-transcript-selection.mjs'

test('baseline host source is pinned', () => {
  const commit = '4412276f248ffe6a447760f56ad2fa424fa0e78a'
  for (const [broken, error] of [
    ['cat-file', /commit missing/],
    ['rev-parse', /blob mismatch/],
    ['merge-base', /not reachable/],
    ['', null]
  ]) {
    const commands = []
    const git = (...args) => {
      commands.push(args)
      if (args[0] === broken) {
        if (broken === 'rev-parse') return 'wrong-hash'
        throw Error('git')
      }
      return args[0] === 'rev-parse' ? '1c4bcb1a7c0319ff9fdbff92cae8c220b3742a79' : 'baseline TS'
    }
    if (error) assert.throws(() => baselineHostSource(git), error)
    else {
      assert.equal(baselineHostSource(git), 'baseline TS')
      const file = commit + ':app/scripts/stage-e/host.ts'
      assert.deepEqual(commands, [
        ['cat-file', '-e', commit],
        ['rev-parse', file],
        ['merge-base', '--is-ancestor', commit, 'HEAD'],
        ['show', file]
      ])
    }
  }
})

for (const [name, args, message] of [
  ['baseline', ['--baseline'], 'Baseline application sources must equal 7db1c7ce'],
  [
    'app-source',
    ['--app-source', '7db1c7cefcdd3ef6d7f44cadbb9e6dc10fde76e6'],
    'Application sources must equal 7db1c7ce'
  ]
])
  test(name + ' CLI refuses mismatched application sources', () => {
    const result = spawnSync(
      process.execPath,
      [join(import.meta.dirname, 'measure-stage-e.mjs'), ...args, '--old-db', 'small'],
      { encoding: 'utf8' }
    )
    assert.equal(result.status, 1)
    assert.ok(result.stderr.includes(message), result.stderr)
  })

test('stage-e verdict keeps Windows functional and Linux latency results separate', () => {
  const input = {
    visible: true,
    receivedMessages: 2,
    clickToBodyFrameMs: 3730,
    readerPayloadBytes: 10,
    replyJsonBytes: 100,
    prepared: { sourceBytes: 1 },
    warm: { visible: true, receivedMessages: 2, readerPayloadBytes: 0, replyJsonBytes: 100 }
  }
  for (const environment of ['linux-electron', 'win32-electron']) {
    const options = { isBaseline: false, size: 'long', environment }
    const check = (patch = {}, change = {}) =>
      stageEVerdict({ ...input, ...patch }, { ...options, ...change })
    const expected = environment === 'win32-electron'
    assert.deepEqual(check(), {
      functional: true,
      bounded: true,
      linuxLatencyGate: { limitMs: 3729, pass: false, applies: !expected },
      verdict: expected
    })
    assert.equal(selectionExitCode({ env: true, ...check() }), expected ? 0 : 1)
    assert.equal(check({ clickToBodyFrameMs: 3729 }).verdict, true)
    for (const patch of [
      { visible: false },
      { receivedMessages: 1 },
      { clickToBodyFrameMs: 0 },
      { readerPayloadBytes: 0 },
      { replyJsonBytes: 0 },
      { error: 'failure' }
    ]) {
      assert.equal(check(patch).functional, false)
      assert.equal(selectionExitCode({ env: true, ...check(patch) }), 1)
    }
    for (const patch of [
      { replyJsonBytes: 262145 },
      { prepared: {} },
      ...[
        { visible: false },
        { receivedMessages: 1 },
        { readerPayloadBytes: 1 },
        { prepared: {} },
        { replyJsonBytes: 262145 }
      ].map((p) => ({ warm: { ...input.warm, ...p } }))
    ])
      assert.equal(check(patch).bounded, false)
    assert.equal(check({}, { size: 'small' }).linuxLatencyGate, undefined)
    assert.equal(check({ receivedMessages: 100000 }, { isBaseline: true }).verdict, true)
    assert.equal(
      check({ receivedMessages: 100 }, { isBaseline: true, size: 'small' }).linuxLatencyGate,
      undefined
    )
  }
})
