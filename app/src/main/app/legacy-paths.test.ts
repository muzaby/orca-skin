// 0225 §10 EP-08 · EP-06 — 이관의 DB·git 단계를 **실 sqlite + 실 git** 으로 본다.
//
// 두 축을 함께 두는 이유: repair 는 rebase 된 `repo_root` 를 cwd 로 쓴다. 둘을 갈라 fake 로
// 이으면 "repo 도 함께 이동한" 케이스에서 무엇이 깨지는지 볼 수 없다.
//
// **컴포지션 루트에 둔다** — rebase 는 infra(db), repair 는 infra(git) 인데 계약은 둘의 합성이다.

import Database from 'better-sqlite3'
import { existsSync, renameSync } from 'node:fs'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { applyMigrations } from '../infra/db/migrate'
import { warmFileSqlite } from '../infra/db/warm-file-sqlite'
import { execGit, removeTempRoots } from '../infra/git/temp-repo.testfixture'
import { runGit } from '../infra/git/runner'
import { rebaseStoredPaths, repairMovedWorktrees } from './legacy-paths'

// `git worktree prune -v` 는 진단을 **stderr** 로 낸다. stdout 만 보면 어떤 상태에서도 빈
// 문자열이라 단언이 항상 통과한다 — 적대 케이스가 이 실수를 잡았다.
async function pruneDiagnostics(repoRoot: string): Promise<string> {
  const result = await runGit(repoRoot, ['worktree', 'prune', '-n', '-v'])
  return `${result.stdout}${result.stderr}`.trim()
}

vi.setConfig({ testTimeout: 117_000, hookTimeout: 117_000 })

beforeAll(warmFileSqlite)

const roots: string[] = []
const handles: Database.Database[] = []

afterEach(async () => {
  for (const handle of handles.splice(0)) if (handle.open) handle.close()
  await removeTempRoots(roots.splice(0))
})

async function tempRoot(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'orca-legacy-paths-'))
  roots.push(dir)
  return dir
}

function openDb(file: string): Database.Database {
  const db = new Database(file)
  handles.push(db)
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  return db
}

function insertSession(
  db: Database.Database,
  id: string,
  cwd: string | null,
  extraDirs: string | null
): void {
  db.prepare(
    `INSERT INTO sessions (id, backend, title, project_id, created_at, updated_at, cwd, extra_dirs)
     VALUES (?, 'claude', 't', NULL, 1, 1, ?, ?)`
  ).run(id, cwd, extraDirs)
}

function insertWorktree(
  db: Database.Database,
  id: string,
  repoRoot: string,
  sourceCwd: string,
  worktreeRoot: string
): void {
  db.prepare(
    `INSERT INTO managed_worktrees (id, session_id, repo_root, source_cwd, worktree_root, branch, base_oid, created_at)
     VALUES (?, NULL, ?, ?, ?, 'feat', 'oid', 1)`
  ).run(id, repoRoot, sourceCwd, worktreeRoot)
}

/** `<root>/<legacy>` 안에 저장소 하나 + 그 밖의 worktree 하나를 세운다. */
async function seedRepo(root: string, repoDir: string, worktreeDir: string): Promise<void> {
  await mkdir(repoDir, { recursive: true })
  await execGit('git', ['init', '-q', repoDir], { cwd: root })
  await execGit('git', ['config', 'user.email', 'a@b.c'], { cwd: repoDir })
  await execGit('git', ['config', 'user.name', 't'], { cwd: repoDir })
  await writeFile(join(repoDir, 'f.txt'), 'hi', 'utf8')
  await execGit('git', ['add', '-A'], { cwd: repoDir })
  await execGit('git', ['commit', '-qm', 'init'], { cwd: repoDir })
  await execGit('git', ['worktree', 'add', '-q', worktreeDir, '-b', 'feat'], { cwd: repoDir })
}

describe('rebaseStoredPaths', () => {
  it('5컬럼을 새 루트로 옮겨 적고 루트 밖 경로는 건드리지 않는다', async () => {
    const root = await tempRoot()
    const oldRoot = join(root, '.config', 'orca')
    const newRoot = join(root, '.config', 'orcinus-orca')
    const db = openDb(join(root, 'db.sqlite'))

    insertSession(
      db,
      's1',
      join(oldRoot, 'projects', 'default'),
      JSON.stringify([join(oldRoot, 'downloads'), '/elsewhere'])
    )
    insertSession(db, 's2', '/elsewhere/repo', null)
    insertWorktree(
      db,
      'w1',
      join(oldRoot, 'projects', 'p'),
      join(oldRoot, 'projects', 'p'),
      join(oldRoot, 'worktrees', 'r', 'feat')
    )
    insertWorktree(
      db,
      'w2',
      '/elsewhere/repo',
      '/elsewhere/repo',
      join(oldRoot, 'worktrees', 'x', 'feat')
    )

    const report = rebaseStoredPaths(db, oldRoot, newRoot)

    expect(report.counts).toEqual({
      sessionCwd: 1,
      sessionExtraDirs: 1,
      repoRoot: 1,
      sourceCwd: 1,
      worktreeRoot: 2
    })
    const s1 = db.prepare('SELECT cwd, extra_dirs FROM sessions WHERE id = ?').get('s1') as {
      cwd: string
      extra_dirs: string
    }
    expect(s1.cwd).toBe(join(newRoot, 'projects', 'default'))
    expect(JSON.parse(s1.extra_dirs)).toEqual([join(newRoot, 'downloads'), '/elsewhere'])
    const s2 = db.prepare('SELECT cwd FROM sessions WHERE id = ?').get('s2') as { cwd: string }
    expect(s2.cwd).toBe('/elsewhere/repo')
    const w2 = db
      .prepare('SELECT repo_root, worktree_root FROM managed_worktrees WHERE id = ?')
      .get('w2') as {
      repo_root: string
      worktree_root: string
    }
    expect(w2.repo_root).toBe('/elsewhere/repo')
    expect(w2.worktree_root).toBe(join(newRoot, 'worktrees', 'x', 'feat'))
    expect(report.repairTargets).toHaveLength(2)
  })

  it('같은 루트면 아무것도 하지 않는다 — 이관 루트 미상(빈 문자열)일 때의 방어', async () => {
    const root = await tempRoot()
    const db = openDb(join(root, 'db.sqlite'))
    insertSession(db, 's1', '/a/b', null)
    const report = rebaseStoredPaths(db, '', '')
    expect(report.counts.sessionCwd).toBe(0)
    expect(report.repairTargets).toEqual([])
  })
})

describe('repairMovedWorktrees', () => {
  it('워크트리만 옮겨진 경우 repo 측 repair 로 prune 대상이 사라진다', async () => {
    const root = await tempRoot()
    const oldRoot = join(root, '.config', 'orca')
    const newRoot = join(root, '.config', 'orcinus-orca')
    const repoDir = join(root, 'repo')
    await seedRepo(root, repoDir, join(oldRoot, 'worktrees', 'r', 'feat'))
    renameSync(oldRoot, newRoot)

    const db = openDb(join(root, 'db.sqlite'))
    insertWorktree(db, 'w1', repoDir, repoDir, join(oldRoot, 'worktrees', 'r', 'feat'))

    const report = await repairMovedWorktrees(rebaseStoredPaths(db, oldRoot, newRoot))

    expect(report.repairFailed).toEqual([])
    expect(report.repaired).toEqual([join(newRoot, 'worktrees', 'r', 'feat')])
    expect(await pruneDiagnostics(repoDir)).toBe('')
    const status = await runGit(join(newRoot, 'worktrees', 'r', 'feat'), ['status', '--short'])
    expect(status.ok).toBe(true)
  })

  // 적대 증거 — repair 를 부르지 않으면 같은 관측이 red 다. 이것이 없으면 "prune 무출력" 은
  // repair 가 아니라 그저 아무 일도 없었음을 뜻할 수 있다.
  it('repair 를 건너뛰면 prune 대상이 그대로 남는다', async () => {
    const root = await tempRoot()
    const oldRoot = join(root, '.config', 'orca')
    const newRoot = join(root, '.config', 'orcinus-orca')
    const repoDir = join(root, 'repo')
    await seedRepo(root, repoDir, join(oldRoot, 'worktrees', 'r', 'feat'))
    renameSync(oldRoot, newRoot)

    const db = openDb(join(root, 'db.sqlite'))
    insertWorktree(db, 'w1', repoDir, repoDir, join(oldRoot, 'worktrees', 'r', 'feat'))
    rebaseStoredPaths(db, oldRoot, newRoot)

    expect(await pruneDiagnostics(repoDir)).toContain('Removing worktrees/')
  })

  // repo 자신이 설정 루트 하위였던 경우 — 워크트리 측 무인자 repair 는 여기서 실패한다.
  it('repo 와 워크트리가 함께 옮겨져도 repo 측 repair 가 양방향을 고친다', async () => {
    const root = await tempRoot()
    const oldRoot = join(root, '.config', 'orca')
    const newRoot = join(root, '.config', 'orcinus-orca')
    const repoDir = join(oldRoot, 'projects', 'p')
    const worktreeDir = join(oldRoot, 'worktrees', 'r', 'feat')
    await seedRepo(root, repoDir, worktreeDir)
    renameSync(oldRoot, newRoot)

    const movedRepo = join(newRoot, 'projects', 'p')
    const movedWorktree = join(newRoot, 'worktrees', 'r', 'feat')
    // 전제 재현: 이동 직후에는 워크트리가 저장소로 열리지 않는다.
    const broken = await runGit(movedWorktree, ['status', '--short'])
    expect(broken.ok).toBe(false)

    const db = openDb(join(root, 'db.sqlite'))
    insertWorktree(db, 'w1', repoDir, repoDir, worktreeDir)

    const report = await repairMovedWorktrees(rebaseStoredPaths(db, oldRoot, newRoot))

    expect(report.repairFailed).toEqual([])
    expect(existsSync(movedRepo)).toBe(true)
    expect(await pruneDiagnostics(movedRepo)).toBe('')
    const status = await runGit(movedWorktree, ['status', '--short'])
    expect(status.ok).toBe(true)
  })

  it('repo 가 사라진 행은 실패로 남기고 나머지를 계속 처리한다', async () => {
    const root = await tempRoot()
    const oldRoot = join(root, '.config', 'orca')
    const newRoot = join(root, '.config', 'orcinus-orca')
    const db = openDb(join(root, 'db.sqlite'))
    insertWorktree(
      db,
      'w1',
      join(root, 'gone'),
      join(root, 'gone'),
      join(oldRoot, 'worktrees', 'r', 'feat')
    )

    const report = await repairMovedWorktrees(rebaseStoredPaths(db, oldRoot, newRoot))

    expect(report.repaired).toEqual([])
    expect(report.repairFailed).toHaveLength(1)
    expect(report.repairFailed[0]?.message).toContain('repo root missing')
  })
})
