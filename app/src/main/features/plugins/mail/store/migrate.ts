// mail.db 마이그레이션 **목록** (0237 ΔV2 — D-056).
//
// 적용 **절차**(PRAGMA·트랜잭션·`_migrations`·미지 마이그레이션 판정)는 `infra/db/open.ts` 가
// 소유하고 Core DB 도 같은 함수를 통과한다. 여기 남는 것은 목록 하나다 — `?raw` import 집합이
// `check-migrations-appendonly.mjs` 의 앵커이므로 **이 파일이 계속 목록 소유자**여야 한다.

import type { SqliteMigration } from '../../../../infra/db/open'
import migration0001 from '../migrations/0001_mail.sql?raw'

export const MAIL_MIGRATIONS: readonly SqliteMigration[] = [
  { name: '0001_mail', sql: migration0001 }
]

export const MAIL_MIGRATION_NAMES = MAIL_MIGRATIONS.map((migration) => migration.name)
