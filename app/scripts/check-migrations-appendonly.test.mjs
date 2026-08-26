import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  checkAppendOnly,
  checkNoListCopies,
  checkSync,
  findMigrationListCopies,
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

// ── 사본 스캔 ───────────────────────────────────────────────────────────────
// 이 검사의 눈은 네 지점에서 각각 멀 수 있다 — 대상 집합(무엇을 훑는가) · 추출(어떤 토큰을
// 뽑는가) · 허용 판정(무엇을 정본으로 세는가) · 분류(무엇을 error 로 올리는가).

const OWNERS = new Set(['src/main/infra/db/migrate.ts', 'src/main/infra/db/migrate.test.ts'])

test('findMigrationListCopies 는 정본과 골든 목록을 사본으로 세지 않는다', () => {
  const copies = findMigrationListCopies(
    [
      {
        path: 'src/main/infra/db/migrate.ts',
        source: `import m from './migrations/0001_initial.sql?raw'`
      },
      {
        path: 'src/main/infra/db/migrate.test.ts',
        source: `import m from './migrations/0006_turn_usage.sql?raw'`
      }
    ],
    OWNERS
  )
  assert.deepEqual(copies, [])
})

test('findMigrationListCopies 는 상대경로 import 도 잡는다 (from 절·인용부호에 앵커하지 않는다)', () => {
  const copies = findMigrationListCopies(
    [
      {
        path: 'src/main/features/orchestration/fork.test.ts',
        source: [
          `import a from '../../infra/db/migrations/0001_initial.sql?raw'`,
          `import b from "../../infra/db/migrations/0013_schedules.sql?raw"`
        ].join('\n')
      }
    ],
    OWNERS
  )
  assert.deepEqual(copies, [
    {
      path: 'src/main/features/orchestration/fork.test.ts',
      names: ['0001_initial', '0013_schedules']
    }
  ])
})

test('findMigrationListCopies 의 허용 판정은 정확 경로다 — 동명 파일은 면제되지 않는다', () => {
  const copies = findMigrationListCopies(
    [
      {
        path: 'src/main/features/x/migrate.ts',
        source: `import m from '../../infra/db/migrations/0001_initial.sql?raw'`
      }
    ],
    OWNERS
  )
  assert.equal(copies.length, 1)
  assert.equal(copies[0].path, 'src/main/features/x/migrate.ts')
})

test('findMigrationListCopies 는 windows 구분자 경로를 정규화해 비교한다', () => {
  const copies = findMigrationListCopies(
    [
      {
        path: 'src\\main\\infra\\db\\migrate.ts',
        source: `import m from './migrations/0001_initial.sql?raw'`
      }
    ],
    OWNERS
  )
  assert.deepEqual(copies, [])
})

test('checkNoListCopies 는 사본 파일명과 인용 개수를 오류에 싣는다', () => {
  const result = checkNoListCopies([
    {
      path: 'src/main/features/extensions/builder.test.ts',
      names: ['0001_initial', '0002_projects']
    }
  ])
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /builder\.test\.ts references 2 migration\(s\)/)
  assert.match(result.errors.join('\n'), /applyMigrations\(db\)/)
})

test('checkNoListCopies 는 사본이 없으면 통과한다', () => {
  assert.equal(checkNoListCopies([]).ok, true)
})
