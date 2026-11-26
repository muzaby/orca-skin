// 0330 W-043 — 격리 프로필 폴더에 시드 DB를 쓰고 H1 대상 파일을 낸다(측정 전용).
//
// node scripts/seed-history-fixture.mjs --user-data <dir> --migrations <dir> --out <targets.json>
//   [--until 0035] [--cwd <dir>]
// 측정 빌드의 better-sqlite3 는 Electron ABI 다 — 그 경우 `ELECTRON_RUN_AS_NODE=1 <electron> scripts/…`로
// 실행한다. 종료 코드: 0 성공 · 2 입력 오류(기존 DB 가 있는 폴더 포함) · 3 better-sqlite3 를 열 수 없음.
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { seedSpec, writeSeed } from './history-seed.mjs'

export const DB_FILE = 'orcinus-orca.db'

export function main(argv) {
  const arg = (name) => {
    const i = argv.indexOf(name)
    return i < 0 ? undefined : argv[i + 1]
  }
  const userData = arg('--user-data')
  const migrationsDir = arg('--migrations')
  const out = arg('--out')
  if (!userData || !migrationsDir || !out) {
    console.error(
      '사용법: --user-data <dir> --migrations <dir> --out <targets.json> [--until 0035] [--cwd <dir>]'
    )
    return 2
  }
  const file = join(userData, DB_FILE)
  if (existsSync(file)) {
    console.error('이미 DB 가 있다 — 쓰지 않는다: ' + file)
    return 2
  }
  let Database
  try {
    Database = createRequire(import.meta.url)('better-sqlite3')
    new Database(':memory:').close()
  } catch (error) {
    console.error('환경 없음: better-sqlite3 를 열 수 없다 — ' + (error?.message ?? error))
    return 3
  }
  mkdirSync(userData, { recursive: true })
  const spec = seedSpec({ cwd: arg('--cwd') ?? join(userData, 'seed-work') })
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  try {
    const applied = writeSeed(db, spec, { migrationsDir, until: arg('--until') ?? '0035' })
    writeFileSync(out, JSON.stringify(spec.targets, null, 1) + '\n')
    console.log(
      JSON.stringify({
        db: file,
        migrations: applied.length,
        sessions: spec.sessions.length,
        targets: Object.keys(spec.targets).length
      })
    )
  } finally {
    db.close()
  }
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = main(process.argv.slice(2))
