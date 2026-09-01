#!/usr/bin/env node
// DB 마이그레이션 가드 — 세 가지를 강제한다.
// 1) 동기화: migrations/*.sql 디렉토리와 migrate.ts 의 ?raw import 집합이 정확히 일치하고,
//    파일명이 NNNN_name.sql 형식 + 0001 부터 연속 번호여야 한다.
// 2) append-only: 직전 v* 태그 이후 기존 마이그레이션 파일의 수정/삭제/개명을 금지한다
//    ("머지된 마이그레이션 파일은 절대 수정 금지" — app/AGENTS.md). 이전 태그가 없으면 스킵.
// 3) 사본 없음: `src/` 안에서 마이그레이션 목록을 손으로 적어 둔 파일이 정본 밖에 없어야 한다.
//
// (3) 이 없던 동안 실제로 두 가지가 터졌다. **A(즉시)** — 0017 이 `sessions` 에 컬럼을 더하자
// 목록을 베껴 둔 픽스처 4곳이 `new DbQueries(db)` 의 statement 준비에서 즉사했다(5파일 39건).
// **B(조용)** — 0013 은 새 테이블이라 아무도 안 죽었고, 픽스처 3곳이 실제 스키마와 갈라진 채로
// 계속 초록이었다. lint·typecheck 에는 16개짜리 목록과 17개짜리 목록이 똑같이 유효하고,
// (1) 은 `migrate.ts` 하나만 읽으므로 둘 다 이 가드 밖이었다.
import { pathToFileURL } from 'node:url'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const MIGRATIONS_DIR = join('src', 'main', 'infra', 'db', 'migrations')
const MIGRATE_SOURCE = join('src', 'main', 'infra', 'db', 'migrate.ts')
const MIGRATION_FILE_PATTERN = /^(\d{4})_[a-z0-9_]+\.sql$/

// 사본 스캔 대상 — 앱 소스 전체. 마이그레이션 목록을 들 수 있는 확장자만 본다.
const SOURCE_ROOT = 'src'
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']

// 목록을 손으로 적어도 되는 두 파일. 경로는 항상 `/` 로 정규화해 비교한다 — CI 는
// windows-latest 라 `path.join` 산출이 `\\` 다.
const LIST_OWNERS = new Set([
  // 정본.
  'src/main/infra/db/migrate.ts',
  // 골든 목록(명세) + 마이그레이션 SQL 자체의 동작 테스트. 둘 다 "그 시점" 에 고정된
  // 부분집합이라 정본을 통해 만들 수 없다.
  'src/main/infra/db/migrate.test.ts'
])

// **인용부호나 `from` 절에 앵커하지 않는다.** 기존 `parseImportedMigrations` 는
// `'./migrations/…'` 로 앵커돼 있어 픽스처의 `'../../infra/db/migrations/…'` 를 한 건도
// 매칭하지 못했다 — 사본 4곳이 그 눈먼 지점에 그대로 살아 있었다.
const MIGRATION_RAW_REF = /migrations\/(\d{4}_[a-z0-9_]+)\.sql\?raw/g

// **`path.sep` 으로 자르지 않는다.** 그러면 같은 입력이 러너마다 다르게 판정된다 — CI 는
// windows-latest 라 `\` 를 접지만, 개발자 Linux 에서는 `\` 가 그대로 남아 정본 경로가
// 허용 목록과 어긋난다(= 정본이 사본으로 잡히거나, 반대로 새어 나간다). 두 구분자를 항상 접는다.
function toPosix(path) {
  return path.replace(/\\/g, '/')
}

export function collectSourceFiles(cwd, root = SOURCE_ROOT) {
  const found = []
  const walk = (dir) => {
    for (const entry of readdirSync(join(cwd, dir))) {
      const rel = join(dir, entry)
      if (statSync(join(cwd, rel)).isDirectory()) {
        walk(rel)
        continue
      }
      if (SOURCE_EXTENSIONS.some((ext) => entry.endsWith(ext))) found.push(toPosix(rel))
    }
  }
  walk(root)
  return found
}

// 정본 밖에서 마이그레이션 목록을 인용하는 파일. `sources` = `[{ path, source }]`.
export function findMigrationListCopies(sources, owners = LIST_OWNERS) {
  const copies = []
  for (const { path, source } of sources) {
    const normalized = toPosix(path)
    if (owners.has(normalized)) continue
    const names = [...source.matchAll(MIGRATION_RAW_REF)].map((match) => match[1])
    if (names.length > 0) copies.push({ path: normalized, names: [...new Set(names)] })
  }
  return copies
}

export function checkNoListCopies(copies) {
  const errors = copies.map(
    ({ path, names }) =>
      `migration list copy outside migrate.ts (use applyMigrations(db) instead): ` +
      `${path} references ${names.length} migration(s) [${names.join(', ')}]`
  )
  return { ok: errors.length === 0, errors }
}

export function parseImportedMigrations(migrateSource) {
  const names = []
  const importPattern = /from\s+'\.\/migrations\/([^']+)\.sql\?raw'/g
  let match
  while ((match = importPattern.exec(migrateSource)) !== null) {
    names.push(match[1])
  }
  return names
}

export function checkSync(files, importedNames) {
  const errors = []

  const fileNames = []
  for (const file of files) {
    const match = file.match(MIGRATION_FILE_PATTERN)
    if (!match) {
      errors.push(`migration file does not match NNNN_name.sql: ${file}`)
      continue
    }
    fileNames.push(file.slice(0, -'.sql'.length))
  }

  const numbers = fileNames.map((name) => Number(name.slice(0, 4))).sort((a, b) => a - b)
  numbers.forEach((number, index) => {
    if (number !== index + 1) {
      errors.push(
        `migration numbering must be sequential from 0001 without gaps/duplicates, ` +
          `got ${String(number).padStart(4, '0')} at position ${index + 1}`
      )
    }
  })

  const fileSet = new Set(fileNames)
  const importedSet = new Set(importedNames)
  for (const name of importedNames) {
    if (!fileSet.has(name)) {
      errors.push(`migrate.ts imports missing file: ${name}.sql`)
    }
  }
  for (const name of fileNames) {
    if (!importedSet.has(name)) {
      errors.push(`orphan migration file not imported by migrate.ts: ${name}.sql`)
    }
  }
  if (importedNames.length !== importedSet.size) {
    errors.push('migrate.ts contains duplicate migration imports')
  }

  return { ok: errors.length === 0, errors }
}

export function checkAppendOnly(nameStatusLines) {
  const errors = []
  for (const line of nameStatusLines) {
    if (!line.trim()) continue
    const [status, ...paths] = line.split('\t')
    if (status.startsWith('A')) continue
    errors.push(
      `append-only violation (merged migrations must never be modified): ${status} ${paths.join(' -> ')}`
    )
  }
  return { ok: errors.length === 0, errors }
}

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', shell: false })
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.error}`)
  }
  return result.stdout
}

export function findPreviousTag({ currentTag, listTags }) {
  return listTags().filter((tag) => tag && tag !== currentTag)[0] ?? null
}

export function runCli(argv = process.argv.slice(2), cwd = process.cwd()) {
  const currentTag = argv.find((arg) => arg.length > 0) ?? ''

  const files = readdirSync(join(cwd, MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql'))
  const imported = parseImportedMigrations(readFileSync(join(cwd, MIGRATE_SOURCE), 'utf8'))
  const sync = checkSync(files, imported)
  if (!sync.ok) {
    for (const error of sync.errors) {
      console.error(`[migrations] ${error}`)
    }
    return 1
  }
  console.log(`[migrations] sync ok: ${imported.length} migrations, dir == migrate.ts imports`)

  const sources = collectSourceFiles(cwd).map((path) => ({
    path,
    source: readFileSync(join(cwd, path), 'utf8')
  }))
  const copies = checkNoListCopies(findMigrationListCopies(sources))
  if (!copies.ok) {
    for (const error of copies.errors) {
      console.error(`[migrations] ${error}`)
    }
    return 1
  }
  console.log(
    `[migrations] no-copies ok: scanned ${sources.length} source files, ` +
      `${LIST_OWNERS.size} list owners`
  )

  const previousTag = findPreviousTag({
    currentTag,
    listTags: () => git(['tag', '--list', 'v*', '--sort=-v:refname'], cwd).split('\n')
  })
  if (!previousTag) {
    console.log('[migrations] no previous v* tag — append-only check skipped (first release)')
    return 0
  }

  const diff = git(
    ['diff', '--name-status', `${previousTag}..HEAD`, '--', MIGRATIONS_DIR],
    cwd
  ).split('\n')
  const appendOnly = checkAppendOnly(diff)
  if (!appendOnly.ok) {
    for (const error of appendOnly.errors) {
      console.error(`[migrations] ${error}`)
    }
    return 1
  }
  console.log(`[migrations] append-only ok since ${previousTag}`)
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
