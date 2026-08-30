// 파일 기반 sqlite 워밍업 — **테스트 전용 헬퍼다**. 런타임 경로에서 부르지 않는다
// (`infra/source-scan.ts` 와 같은 성격이다).
//
// **왜 필요한가.** 프로세스가 tmp 에 sqlite 파일을 **처음** 만들 때 CI windows 러너는 몇 초를
// 쓴다. 그 비용이 첫 `it` 안에서 발생하면 케이스의 5초 예산을 먹는다 — 실제로 잰 것은 계약이
// 아니라 프로세스 초기화다.
//
// 판정 근거(0210 r3 CI): `worktree-bind.test.ts` · `worktree-recover.test.ts` 두 파일에서
// **첫 케이스만** 5s 타임아웃이고, 같은 파일의 두 번째 케이스는 파일 DB 를 **하나 더 열고도**
// 통과했다. 케이스별 작업량이 원인이면 더 무거운 쪽이 먼저 깨진다. 로컬(Windows)에서는 7케이스가
// 200~283ms 로 고르고 첫 케이스 스파이크가 없어 여기서는 재현되지 않는다.
//
// 예산을 늘리지 않는 이유: 5초 기본값은 **진짜 멈춤**을 잡는 장치다. 늘리면 이 두 파일뿐 아니라
// 그 장치 전체가 무뎌진다. 비용을 없앨 수는 없으므로 재는 창 **밖**으로 옮긴다.

import Database from 'better-sqlite3'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export async function warmFileSqlite(): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'orca-sqlite-warm-'))
  try {
    const db = new Database(join(dir, 'warm.db'))
    // 열기만 하면 파일이 안 생길 수 있다 — 실제 쓰기까지 가야 같은 비용을 치른다.
    db.exec('CREATE TABLE warm (a INTEGER)')
    db.close()
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
