import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  checkAppendOnly,
  checkSync,
  findPreviousTag,
  parseImportedMigrations
} from './check-migrations-appendonly.mjs'

const MIGRATE_SNIPPET = `
import migration0001 from './migrations/0001_initial.sql?raw'
import migration0002 from './migrations/0002_projects.sql?raw'
const MIGRATIONS = []
`

test('parseImportedMigrations extracts names in order', () => {
  assert.deepEqual(parseImportedMigrations(MIGRATE_SNIPPET), ['0001_initial', '0002_projects'])
})

test('checkSync passes when dir and imports match', () => {
  const result = checkSync(
    ['0001_initial.sql', '0002_projects.sql'],
    ['0001_initial', '0002_projects']
  )
  assert.equal(result.ok, true)
})

test('checkSync rejects orphan file not imported', () => {
  const result = checkSync(
    ['0001_initial.sql', '0002_projects.sql', '0003_orphan.sql'],
    ['0001_initial', '0002_projects']
  )
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /orphan migration file.*0003_orphan/)
})

test('checkSync rejects import of missing file', () => {
  const result = checkSync(['0001_initial.sql'], ['0001_initial', '0002_projects'])
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /imports missing file.*0002_projects/)
})

test('checkSync rejects numbering gap and bad filename', () => {
  const gap = checkSync(['0001_initial.sql', '0003_late.sql'], ['0001_initial', '0003_late'])
  assert.equal(gap.ok, false)
  assert.match(gap.errors.join('\n'), /sequential/)

  const bad = checkSync(['01_short.sql'], [])
  assert.equal(bad.ok, false)
  assert.match(bad.errors.join('\n'), /does not match NNNN_name\.sql/)
})

test('checkAppendOnly passes on additions only and empty diff', () => {
  assert.equal(checkAppendOnly(['A\tapp/src/main/infra/db/migrations/0013_new.sql']).ok, true)
  assert.equal(checkAppendOnly(['', '  ']).ok, true)
})

test('checkAppendOnly rejects modify/delete/rename of existing migrations', () => {
  for (const line of [
    'M\tapp/src/main/infra/db/migrations/0003_messages_fts.sql',
    'D\tapp/src/main/infra/db/migrations/0002_projects.sql',
    'R100\tapp/src/main/infra/db/migrations/0001_initial.sql\tapp/src/main/infra/db/migrations/0001_renamed.sql'
  ]) {
    const result = checkAppendOnly([line])
    assert.equal(result.ok, false, `expected rejection for: ${line}`)
    assert.match(result.errors.join('\n'), /append-only violation/)
  }
})

test('findPreviousTag skips the tag being built and empty lines', () => {
  const listTags = () => ['v0.2.0', 'v0.1.0', '']
  assert.equal(findPreviousTag({ currentTag: 'v0.2.0', listTags }), 'v0.1.0')
  assert.equal(findPreviousTag({ currentTag: '', listTags }), 'v0.2.0')
  assert.equal(findPreviousTag({ currentTag: 'v0.1.0', listTags: () => ['v0.1.0', ''] }), null)
})
