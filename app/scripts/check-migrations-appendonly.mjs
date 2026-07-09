#!/usr/bin/env node
// DB 마이그레이션 가드 — 두 가지를 강제한다.
// 1) 동기화: migrations/*.sql 디렉토리와 migrate.ts 의 ?raw import 집합이 정확히 일치하고,
//    파일명이 NNNN_name.sql 형식 + 0001 부터 연속 번호여야 한다.
// 2) append-only: 직전 v* 태그 이후 기존 마이그레이션 파일의 수정/삭제/개명을 금지한다
//    ("머지된 마이그레이션 파일은 절대 수정 금지" — app/AGENTS.md). 이전 태그가 없으면 스킵.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const MIGRATIONS_DIR = join('src', 'main', 'infra', 'db', 'migrations')
const MIGRATE_SOURCE = join('src', 'main', 'infra', 'db', 'migrate.ts')
const MIGRATION_FILE_PATTERN = /^(\d{4})_[a-z0-9_]+\.sql$/

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

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = runCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
