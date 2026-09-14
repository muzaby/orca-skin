import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  inspectRequest,
  parseArgs,
  requestMarker,
  snapshotTree,
  treeDifference
} from './smoke-work-profile.mjs'

test('native fixture rejects invalid arguments and identifies the latest resume marker', () => {
  assert.throws(() => parseArgs(['--resources-path=']))
  assert.throws(() => parseArgs(['--timeout-ms=0']))
  assert.throws(() => parseArgs(['--unknown']))
  assert.equal(parseArgs(['--workflow']).workflow, true)
  assert.equal(
    requestMarker([
      { role: 'user', content: 'ORCA_WORK_PROFILE_empty_work_new' },
      { role: 'assistant', content: 'ORCA_WORK_PROFILE_empty_code_new' },
      { role: 'user', content: [{ type: 'text', text: 'ORCA_WORK_PROFILE_empty_work_resume' }] }
    ]),
    'ORCA_WORK_PROFILE_empty_work_resume'
  )
})

test('request oracle rejects a coding-first Work prompt and a leaked Code append', () => {
  const approved = '<work_instructions>Approved fixture</work_instructions>'
  const append = 'Common fixture header'
  const style =
    'Follow the Work instructions supplied by Orcinus orca for this session.\n' +
    "Use programming when useful, but do not assume software development is the user's primary goal."
  const coding = 'The user will primarily request you to perform software engineering tasks.'
  const body = { system: `${approved}\n${style}\n${append}`, tools: [{ name: 'Write' }] }
  assert.equal(inspectRequest(body, { kind: 'work', approved, append }).approvedOccurrences, 1)
  assert.throws(
    () =>
      inspectRequest(
        { ...body, system: `${body.system}\n${coding}` },
        { kind: 'work', approved, append }
      ),
    /coding instructions/
  )
  assert.throws(
    () =>
      inspectRequest(
        { ...body, system: `${append}\n${coding}\n${approved}` },
        { kind: 'code', approved, append }
      ),
    /approved prompt/
  )
  assert.throws(
    () =>
      inspectRequest(
        { ...body, system: `${body.system}\n${approved}` },
        { kind: 'work', approved, append }
      ),
    /approved prompt/
  )
})

test('workspace oracle detects injected settings writes, byte changes and deleted entries', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-work-oracle-'))
  try {
    const config = join(root, '.claude')
    const before = await snapshotTree(config)
    assert.deepEqual(before, [])
    await mkdir(config)
    await writeFile(join(config, 'settings.json'), '{}\n')
    const created = await snapshotTree(config)
    assert.equal(treeDifference(before, created).added.length, 2)
    assert.deepEqual(treeDifference(created, created), { added: [], removed: [] })
    await writeFile(join(config, 'settings.json'), '{"outputStyle":"work"}\n')
    const modified = await snapshotTree(config)
    assert.equal(treeDifference(created, modified).added.length, 1)
    assert.equal(treeDifference(created, modified).removed.length, 1)
    assert.equal(treeDifference(created, before).removed.length, 2)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
