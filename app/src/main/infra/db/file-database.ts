import Database from 'better-sqlite3'

export interface FileDatabaseOptions extends Database.Options {
  readonly initialize?: (db: Database.Database) => void
}

/** The caller owns schema initialization and closes the returned connection. */
export function openFileDatabase(
  path: string,
  { initialize, ...options }: FileDatabaseOptions = {}
): Database.Database {
  const db = new Database(path, options)
  try {
    db.pragma('journal_mode = WAL')
    // WAL 권장 조합(0107). 코어 DB 와 같은 내구성 설정을 쓴다 — 여기가 갈리면 plugin DB 만
    // 커밋마다 fsync 해 도구 호출이 이벤트 루프를 점유한다.
    db.pragma('synchronous = NORMAL')
    db.pragma('foreign_keys = ON')
    initialize?.(db)
    return db
  } catch (error) {
    db.close()
    throw error
  }
}
