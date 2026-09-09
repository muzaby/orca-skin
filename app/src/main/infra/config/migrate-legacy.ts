// 0225 이전 설치본의 데이터를 새 이름 아래로 옮기는 **1회 이관**. 동기 fs 만 쓴다 — 호출은
// `main/index.ts` 모듈 스코프(`initLog()` 보다 앞)라 await 지점이 없고, 로그가 새 설정 루트를
// 먼저 만들면 "target 없음" 가드가 거짓이 되기 때문이다(§10 EP-07).
//
// **레거시 경로 상수의 유일한 소비자다**(§10 EP-05 / D-010). 다른 모듈이 `legacyConfigDir`·
// `legacyUserDataDir` 를 import 하면 그것이 곧 "옛 경로를 정상 저장소로 쓰는" 폴백이다.
//
// 설계 규약 두 가지:
//   D-017 멱등 — 단계마다 "source 있고 target 없으면 이동". 완료 마커를 두지 않는다(마커
//     직전 크래시가 부분 상태를 영구화한다). 재실행이 곧 복구다.
//   D-018 2등급 실패 — DB 3종(`*.db`·`-wal`·`-shm`)은 한 묶음이라 하나라도 실패하면
//     `critical` 로 표시해 부팅을 막는다(WAL 만 남고 DB 가 옮겨진 상태로 열면 WAL 꼬리가
//     조용히 유실된다). 나머지는 경고로 남기고 부팅을 계속한다.
//
// **DB 3종의 이동 순서는 `-wal` → `-shm` → `.db` 다.** `.db` 를 먼저 옮기고 `-wal` 에서 실패하면
// 다음 부팅의 가드가 `orca.db` 부재를 보고 건너뛰어 WAL 이 고아가 된다. 역순이면 어느 지점에서
// 끊겨도 다음 부팅이 일관된 상태로 수렴한다.

import { existsSync, readdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { LEGACY_PRODUCT_SLUG, PRODUCT_SLUG } from '../../../shared/product'
import { legacyConfigDir, legacyUserDataDir, orcaConfigDir } from './paths'

export interface MigrationMove {
  from: string
  to: string
}

export interface MigrationFailure {
  from: string
  to: string
  message: string
  critical: boolean
}

export interface MigrationReport {
  moved: MigrationMove[]
  /** target 이 이미 있어 건드리지 않은 자리. 상태 전이표의 "옛 루트도 새 루트도 있음" 행. */
  conflicts: MigrationMove[]
  failed: MigrationFailure[]
  /**
   * 이번 부팅이 고려한 설정 루트 쌍. **이동 여부와 무관하게 항상 채운다** — DB 의 저장 절대경로
   * rebase 는 파일 이동이 이전 부팅에서 이미 끝난 뒤에도 돌아야 하기 때문이다(이동이 성공한
   * 부팅이 rebase 전에 죽으면 그 다음 부팅에는 옮길 것이 없다).
   *
   * 이 값이 레거시 루트를 **데이터로** 실어 나르는 유일한 통로다 — 덕분에 `legacyConfigDir` 을
   * import 하는 파일은 이 모듈 하나로 남는다(§10 EP-05 / D-010).
   */
  configRoots: { legacy: string; current: string }
}

export interface MigrateLegacyRootsInput {
  /** `app.getPath('appData')` — userData 루트 2개의 부모. */
  appDataDir: string
  /** `import.meta.env.DEV`. dev 는 `<appData>/orca-dev` → `<appData>/orcinus-orca-dev`. */
  isDev: boolean
  /** `app.getPath('userData')` — dev 리디렉션이 이미 반영된 현재 값. */
  userDataDir: string
  /**
   * 이동 구현 주입 (테스트 seam). 프로덕션은 주지 않는다 — 기본값이 `renameSync` 다.
   * `runGit` 의 `execFileImpl` 과 같은 형상이며, 실패 등급(D-018)을 관측하기 위해 필요하다:
   * rename 실패는 이 환경에서 결정적으로 만들 수 없다(root 는 퍼미션을 무시한다).
   */
  rename?: (from: string, to: string) => void
}

// electron-store 4종. store `name` 이 곧 파일 basename 이다.
const STORE_BASENAMES = ['settings', 'secrets', 'provider-grants', 'provider-oauth'] as const

// DB 묶음의 접미사 — **순서가 계약이다**(파일 헤더 참고).
const DB_SUFFIXES = ['.db-wal', '.db-shm', '.db'] as const

type Rename = (from: string, to: string) => void

function hasCriticalFailure(report: MigrationReport): boolean {
  return report.failed.some((failure) => failure.critical)
}

/** 실패 여부와 무관하게 항상 report 를 돌려준다 — 부팅 차단 판정은 호출자(§부팅 단계)가 한다. */
export function migrateLegacyRoots(input: MigrateLegacyRootsInput): MigrationReport {
  const rename: Rename = input.rename ?? renameSync
  const legacyConfig = legacyConfigDir()
  const configDir = orcaConfigDir()
  const report: MigrationReport = {
    moved: [],
    conflicts: [],
    failed: [],
    configRoots: { legacy: legacyConfig, current: configDir }
  }
  const legacyUserData = legacyUserDataDir(input.appDataDir, input.isDev)

  move(report, rename, legacyUserData, input.userDataDir, false)
  renameUserDataFiles(report, rename, input.userDataDir)

  move(report, rename, legacyConfig, configDir, false)
  renameConfigItems(report, rename, configDir)

  return report
}

export function migrationBlocksBoot(report: MigrationReport): boolean {
  return hasCriticalFailure(report)
}

// source 있고 target 없으면 이동. 그 밖은 전부 no-op 이라 재실행이 안전하다.
function move(
  report: MigrationReport,
  rename: Rename,
  from: string,
  to: string,
  critical: boolean
): boolean {
  if (from === to) return false
  if (!existsSync(from)) return false
  if (existsSync(to)) {
    report.conflicts.push({ from, to })
    return false
  }
  try {
    rename(from, to)
    report.moved.push({ from, to })
    return true
  } catch (error) {
    report.failed.push({ from, to, message: String(error), critical })
    return false
  }
}

function renameUserDataFiles(report: MigrationReport, rename: Rename, userDataDir: string): void {
  if (!existsSync(userDataDir)) return
  // DB 묶음 — 순서가 계약이다(파일 헤더 참고). critical=true.
  for (const suffix of DB_SUFFIXES) {
    move(
      report,
      rename,
      join(userDataDir, `${LEGACY_PRODUCT_SLUG}${suffix}`),
      join(userDataDir, `${PRODUCT_SLUG}${suffix}`),
      true
    )
  }
  // 마이그레이션 백업 — 개수가 가변이라 디렉토리를 훑는다.
  const backupPrefix = `${LEGACY_PRODUCT_SLUG}.db.backup.`
  for (const entry of readDirSafe(userDataDir)) {
    if (!entry.startsWith(backupPrefix)) continue
    const rest = entry.slice(backupPrefix.length)
    move(
      report,
      rename,
      join(userDataDir, entry),
      join(userDataDir, `${PRODUCT_SLUG}.db.backup.${rest}`),
      false
    )
  }
  for (const basename of STORE_BASENAMES) {
    move(
      report,
      rename,
      join(userDataDir, `${LEGACY_PRODUCT_SLUG}-${basename}.json`),
      join(userDataDir, `${PRODUCT_SLUG}-${basename}.json`),
      false
    )
  }
}

function renameConfigItems(report: MigrationReport, rename: Rename, configDir: string): void {
  if (!existsSync(configDir)) return
  move(
    report,
    rename,
    join(configDir, `${LEGACY_PRODUCT_SLUG}.json`),
    join(configDir, `${PRODUCT_SLUG}.json`),
    false
  )
  // 내장 스킬 seed 마커 (features/extensions/skills/seed.ts).
  const skillsDir = join(configDir, 'sources', 'skills')
  move(
    report,
    rename,
    join(skillsDir, `.${LEGACY_PRODUCT_SLUG}-builtin.json`),
    join(skillsDir, `.${PRODUCT_SLUG}-builtin.json`),
    false
  )
  // 엔진별 dist — 배포 마커와 플러그인 디렉토리. 엔진 목록은 디스크가 진실이다.
  const distDir = join(configDir, 'dist')
  for (const engine of readDirSafe(distDir)) {
    const engineDir = join(distDir, engine)
    move(
      report,
      rename,
      join(engineDir, `.${LEGACY_PRODUCT_SLUG}-deploy.json`),
      join(engineDir, `.${PRODUCT_SLUG}-deploy.json`),
      false
    )
    move(
      report,
      rename,
      join(engineDir, 'plugins', LEGACY_PRODUCT_SLUG),
      join(engineDir, 'plugins', PRODUCT_SLUG),
      false
    )
  }
}

function readDirSafe(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}
