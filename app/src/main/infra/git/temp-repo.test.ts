import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { mkdtemp, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import childProcess, { type ExecFileOptions } from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import { dirname, join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { IO_GUARD, type IoGitGuardState } from '../../../../scripts/test-pools.mjs'
import type { RepoCommit } from './fast-import-stream.testfixture'
import { scaledBudget } from '../../../../scripts/test-time.mjs'
import {
  createRepo,
  appendCommit,
  execGit,
  FIXTURE_GIT_TIMEOUT_MS,
  removeTempRoots
} from './temp-repo.testfixture'

vi.setConfig(scaledBudget({ testTimeout: 180_000, hookTimeout: 180_000 }))
const roots: string[] = []
afterEach(() => removeTempRoots(roots.splice(0)))
const state = (): IoGitGuardState =>
  (process as unknown as Record<symbol, IoGitGuardState>)[IO_GUARD]
const git = (root: string, args: string[], env?: NodeJS.ProcessEnv): ReturnType<typeof execGit> =>
  execGit('git', args, { cwd: root, env, timeout: FIXTURE_GIT_TIMEOUT_MS })

it('B1~B11 — porcelain과 OID·브랜치·HEAD·트리가 같다', async () => {
  const commits: Array<Required<RepoCommit>> = [
    {
      message: 'first\nbody',
      date: '2000-01-01T00:00:00Z',
      files: { '한글 a.txt': 'text\n', binary: Buffer.from([0, 255, 1]), remove: 'old' }
    },
    {
      message: 'second',
      date: '2001-01-01T00:00:00Z',
      files: { '한글 a.txt': 'changed\n', remove: null }
    }
  ]
  const start = state().spawns.length
  const built = await createRepo(roots, {
    branch: 'trunk',
    commits,
    branches: { topic: 0, other: 1 },
    detach: 0
  })
  expect(state().spawns.length - start).toBe(3)
  const beforePlain = state().spawns.length
  const plain = await createRepo(roots, { branch: 'trunk' })
  expect(state().spawns.length - beforePlain).toBe(1)
  for (const commit of commits) {
    for (const [path, content] of Object.entries(commit.files)) {
      if (content === null) await rm(join(plain.root, path))
      else {
        await mkdir(dirname(join(plain.root, path)), { recursive: true })
        await writeFile(join(plain.root, path), content)
      }
    }
    await git(plain.root, ['add', '-A'])
    await git(plain.root, ['commit', '-m', commit.message], {
      ...process.env,
      GIT_AUTHOR_DATE: commit.date,
      GIT_COMMITTER_DATE: commit.date
    })
  }
  const oids = (await git(plain.root, ['log', '--reverse', '--format=%H'])).stdout
    .trim()
    .split(/\r?\n/)
  expect(built.oids).toEqual(oids)
  await git(plain.root, ['branch', 'topic', oids[0]])
  await git(plain.root, ['branch', 'other', oids[1]])
  await git(plain.root, ['checkout', '--detach', oids[0]])
  for (const args of [
    ['show-ref', '--head'],
    ['status', '--porcelain', '-b']
  ])
    expect((await git(built.root, args)).stdout).toBe((await git(plain.root, args)).stdout)
  expect(await readFile(join(built.root, 'binary'))).toEqual(Buffer.from([0, 255, 1]))
  expect(state().spawns.every((spawn) => spawn.timeout === FIXTURE_GIT_TIMEOUT_MS)).toBe(true)
})

it('B2·B3·B11·B12 — 생성·추가 호출 수, 빈 커밋과 파일 커밋', async () => {
  const start = state().spawns.length
  const repo = await createRepo(roots, { commits: [{ message: 'empty' }, { message: 'empty2' }] })
  expect(state().spawns.length - start).toBe(2)
  expect(repo.oids).toHaveLength(2)
  const before = state().spawns.length
  const empty = await appendCommit(repo, { message: 'append empty' })
  expect(state().spawns.length - before).toBe(1)
  const second = state().spawns.length
  const file = await appendCommit(repo, { message: 'append file', files: { a: 'next' } })
  expect(state().spawns.length - second).toBe(2)
  expect(file).not.toBe(empty)
  expect((await git(repo.root, ['rev-parse', 'HEAD'])).stdout.trim()).toBe(file)
  expect(await readFile(join(repo.root, 'a'), 'utf8')).toBe('next')
  expect((await git(repo.root, ['status', '--porcelain'])).stdout).toBe('')
  expect(state().spawns.every((spawn) => spawn.timeout === FIXTURE_GIT_TIMEOUT_MS)).toBe(true)
})

it('B11 — 일반 브랜치도 파일과 index를 채워 clean 상태로 만든다', async () => {
  const start = state().spawns.length
  const repo = await createRepo(roots, { commits: [{ message: 'file', files: { a: 'tree' } }] })
  expect(state().spawns.length - start).toBe(3)
  expect(await readFile(join(repo.root, 'a'), 'utf8')).toBe('tree')
  expect((await git(repo.root, ['status', '--porcelain'])).stdout).toBe('')
})

it('B13 — fast-import 실패는 stderr를 보고하고 정리 경로에 남는다', async () => {
  await expect(
    createRepo(roots, { commits: [{ message: 'broken', date: 'not a date' }] })
  ).rejects.toThrow(/fatal|invalid|exec/i)
  expect(roots).toHaveLength(1)
})

it('B13 — 끊긴 자식은 루트를 지우기 전에 kill하고 종료를 기다린다', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-tracked-child-'))
  roots.push(root)
  const child = Object.assign(new EventEmitter(), {
    exitCode: null as number | null,
    signalCode: null,
    stdin: Object.assign(new EventEmitter(), { end: vi.fn() }),
    kill: vi.fn()
  })
  vi.spyOn(childProcess, 'execFile').mockImplementation(((
    _file: string,
    _args: string[],
    options: ExecFileOptions,
    callback: (error: Error | null, stdout: string, stderr: string) => void
  ) => {
    expect(options.timeout).toBe(FIXTURE_GIT_TIMEOUT_MS)
    child.kill.mockImplementation(() => {
      expect(existsSync(root)).toBe(true)
      child.exitCode = 1
      callback(new Error('stopped'), '', 'stopped')
      child.emit('close')
      return true
    })
    return child
  }) as never)
  syncBuiltinESMExports()
  try {
    const stopped = execGit('/fake-child', [], {
      cwd: root,
      timeout: FIXTURE_GIT_TIMEOUT_MS
    }).catch((error) => error)
    await removeTempRoots([root])
    expect(child.kill).toHaveBeenCalledTimes(1)
    expect(await stopped).toMatchObject({ message: 'stopped' })
    expect(await stat(root).catch(() => null)).toBeNull()
  } finally {
    vi.restoreAllMocks()
    syncBuiltinESMExports()
  }
})
