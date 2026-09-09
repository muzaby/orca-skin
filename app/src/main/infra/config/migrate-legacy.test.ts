import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `paths.ts` 의 설정 루트는 `homedir()` 파생이다. 임시 홈으로 갈아끼워 실 디스크에서 이관을 돈다.
let home = ''
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>()
  return { ...actual, homedir: () => home, default: { ...actual, homedir: () => home } }
})

const { migrateLegacyRoots, migrationBlocksBoot } = await import('./migrate-legacy')

let root = ''
let appData = ''

function write(path: string, body = 'x'): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, body, 'utf8')
}

/** 0225 이전 설치본의 디스크 레이아웃. */
function seedLegacyLayout(): void {
  const userData = join(appData, 'orca')
  write(join(userData, 'orca.db'), 'db')
  write(join(userData, 'orca.db-wal'), 'wal')
  write(join(userData, 'orca.db-shm'), 'shm')
  write(join(userData, 'orca.db.backup.before-0.3.0.2026-01-01T00-00-00-000Z'), 'bak')
  for (const name of ['settings', 'secrets', 'provider-grants', 'provider-oauth']) {
    write(join(userData, `orca-${name}.json`), '{}')
  }
  const config = join(home, '.config', 'orca')
  write(join(config, 'orca.json'), '{}')
  write(join(config, 'sources', 'skills', '.orca-builtin.json'), '{}')
  write(join(config, 'sources', 'skills', 'demo', 'SKILL.md'), '# demo')
  write(join(config, 'dist', 'claude', '.orca-deploy.json'), '{}')
  write(join(config, 'dist', 'claude', 'plugins', 'orca', '.mcp.json'), '{}')
  write(join(config, 'projects', 'default', 'note.txt'), 'note')
}

function snapshot(dir: string, prefix = ''): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    out.push(rel)
    if (entry.isDirectory()) out.push(...snapshot(join(dir, entry.name), rel))
  }
  return out.sort()
}

function run(
  overrides: Partial<Parameters<typeof migrateLegacyRoots>[0]> = {}
): ReturnType<typeof migrateLegacyRoots> {
  return migrateLegacyRoots({
    appDataDir: appData,
    isDev: false,
    userDataDir: join(appData, 'orcinus-orca'),
    ...overrides
  })
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-migrate-legacy-'))
  home = join(root, 'home')
  appData = join(root, 'appData')
  mkdirSync(home, { recursive: true })
  mkdirSync(appData, { recursive: true })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

// §10 EP-06 / VP-06 — 이관 종단 시나리오.
describe('migrateLegacyRoots', () => {
  it('두 루트를 옮기고 내부 이름을 전부 새 슬러그로 바꾼다', () => {
    seedLegacyLayout()
    const report = run()

    const userData = join(appData, 'orcinus-orca')
    const config = join(home, '.config', 'orcinus-orca')
    expect(existsSync(join(appData, 'orca'))).toBe(false)
    expect(existsSync(join(home, '.config', 'orca'))).toBe(false)
    expect(snapshot(userData)).toEqual([
      'orcinus-orca-provider-grants.json',
      'orcinus-orca-provider-oauth.json',
      'orcinus-orca-secrets.json',
      'orcinus-orca-settings.json',
      'orcinus-orca.db',
      'orcinus-orca.db-shm',
      'orcinus-orca.db-wal',
      'orcinus-orca.db.backup.before-0.3.0.2026-01-01T00-00-00-000Z'
    ])
    expect(existsSync(join(config, 'orcinus-orca.json'))).toBe(true)
    expect(existsSync(join(config, 'sources', 'skills', '.orcinus-orca-builtin.json'))).toBe(true)
    expect(existsSync(join(config, 'sources', 'skills', 'demo', 'SKILL.md'))).toBe(true)
    expect(existsSync(join(config, 'dist', 'claude', '.orcinus-orca-deploy.json'))).toBe(true)
    expect(existsSync(join(config, 'dist', 'claude', 'plugins', 'orcinus-orca', '.mcp.json'))).toBe(
      true
    )
    expect(existsSync(join(config, 'projects', 'default', 'note.txt'))).toBe(true)
    expect(report.failed).toEqual([])
    expect(report.configRoots).toEqual({
      legacy: join(home, '.config', 'orca'),
      current: join(home, '.config', 'orcinus-orca')
    })
  })

  it('dev 는 `orca-dev` → `orcinus-orca-dev` 를 옮긴다', () => {
    write(join(appData, 'orca-dev', 'orca.db'), 'db')
    run({ isDev: true, userDataDir: join(appData, 'orcinus-orca-dev') })
    expect(existsSync(join(appData, 'orcinus-orca-dev', 'orcinus-orca.db'))).toBe(true)
    expect(existsSync(join(appData, 'orca-dev'))).toBe(false)
  })

  // §10 EP-10 / VP-10 — 멱등.
  it('두 번 불러도 한 번 부른 것과 같은 디스크 상태다', () => {
    seedLegacyLayout()
    run()
    const once = [
      snapshot(join(appData, 'orcinus-orca')),
      snapshot(join(home, '.config', 'orcinus-orca'))
    ]
    const second = run()
    const twice = [
      snapshot(join(appData, 'orcinus-orca')),
      snapshot(join(home, '.config', 'orcinus-orca'))
    ]
    expect(twice).toEqual(once)
    expect(second.moved).toEqual([])
    expect(second.failed).toEqual([])
  })

  it('이관이 끝난 설치본(옛 루트 없음)에서는 아무것도 하지 않는다', () => {
    write(join(appData, 'orcinus-orca', 'orcinus-orca.db'), 'db')
    const report = run()
    expect(report.moved).toEqual([])
    expect(report.conflicts).toEqual([])
    expect(report.failed).toEqual([])
  })

  it('옛 루트와 새 루트가 둘 다 있으면 옛 루트를 건드리지 않고 conflict 로 남긴다', () => {
    seedLegacyLayout()
    write(join(appData, 'orcinus-orca', 'orcinus-orca.db'), 'new')
    const report = run()
    expect(existsSync(join(appData, 'orca', 'orca.db'))).toBe(true)
    expect(report.conflicts.map((c) => c.to)).toContain(join(appData, 'orcinus-orca'))
  })

  // §10 EP-06 / D-018 — 실패 등급.
  it('DB 3종 이동 실패는 critical 이라 부팅을 막는다', () => {
    seedLegacyLayout()
    const report = run({
      rename: (from, to) => {
        if (from.endsWith('orca.db-wal')) throw new Error('EBUSY')
        renameSync(from, to)
      }
    })
    const critical = report.failed.filter((failure) => failure.critical)
    expect(critical).toHaveLength(1)
    expect(critical[0]?.from.endsWith('orca.db-wal')).toBe(true)
    expect(migrationBlocksBoot(report)).toBe(true)
  })

  it('DB 밖의 이동 실패는 부팅을 막지 않는다', () => {
    seedLegacyLayout()
    const report = run({
      rename: (from, to) => {
        if (from.endsWith('orca-settings.json')) throw new Error('EBUSY')
        renameSync(from, to)
      }
    })
    expect(report.failed).toHaveLength(1)
    expect(report.failed[0]?.critical).toBe(false)
    expect(migrationBlocksBoot(report)).toBe(false)
  })

  // 순서 계약 — `.db` 를 먼저 옮기면 다음 부팅의 가드가 `orca.db` 부재를 보고 WAL 을 고아로 만든다.
  it('DB 묶음은 -wal · -shm · .db 순서로 옮긴다', () => {
    seedLegacyLayout()
    const order: string[] = []
    run({
      rename: (from, to) => {
        if (from.includes('orca.db')) order.push(from.slice(from.lastIndexOf('orca.db')))
        renameSync(from, to)
      }
    })
    expect(order.slice(0, 3)).toEqual(['orca.db-wal', 'orca.db-shm', 'orca.db'])
  })

  it('WAL 만 옮기고 끊긴 상태에서 재실행하면 나머지가 이어서 옮겨진다', () => {
    seedLegacyLayout()
    run({
      rename: (from, to) => {
        if (from.endsWith('orca.db-shm')) throw new Error('EBUSY')
        renameSync(from, to)
      }
    })
    // 루트 이동이 먼저라 남은 파일은 **새 루트 안**에 옛 이름으로 있다.
    expect(existsSync(join(appData, 'orcinus-orca', 'orca.db-shm'))).toBe(true)
    const second = run()
    expect(existsSync(join(appData, 'orcinus-orca', 'orcinus-orca.db-shm'))).toBe(true)
    expect(second.failed).toEqual([])
  })
})
