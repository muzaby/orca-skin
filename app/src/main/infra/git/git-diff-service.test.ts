import { describe, expect, it, vi } from 'vitest'
import type { GitRunOptions, GitRunResult } from './runner'
import { gitDiffFile, gitDiffSummary } from './git-diff'

type Runner = (cwd: string, args: string[], options?: GitRunOptions) => Promise<GitRunResult>

const result = (stdout: string, ok = true): GitRunResult => ({
  ok,
  stdout,
  stderr: ok ? '' : 'failed',
  code: ok ? 0 : 1,
  aborted: false
})

const metadata = (sha: string, body = ''): string =>
  `\x00orca-commit\x00${sha}\x00subject ${sha}\x00tester\x001756500000\x00${body}\x00`

const withOneFile = (sha: string): string =>
  metadata(sha, 'real body') + '\x00:100644 100644 aaaaaaa bbbbbbb M\x00a.ts\x00' + '2\t1\ta.ts\x00'

// 어떤 git 명령인가 = **첫 비-플래그 인자**다. 인덱스로 세면 읽기 플래그가 하나 붙을 때마다
// 모든 단언이 함께 깨지고, 그때 고치는 방향이 "인덱스를 옮긴다" 라 계약이 흐려진다.
export const subcommand = (args: readonly string[]): string | undefined =>
  args.find((arg) => !arg.startsWith('-'))

function fakeRunner(logResults: GitRunResult[]): ReturnType<typeof vi.fn<Runner>> {
  return vi.fn<Runner>(async (_cwd, args) => {
    const cmd = subcommand(args)
    if (cmd === 'rev-parse' && args.includes('--is-inside-work-tree'))
      return result('true\n/repo\n')
    if (cmd === 'rev-parse' && args.includes('HEAD')) return result('head-oid\n')
    // `--raw --numstat -z` 한 스트림 — raw 블록 뒤 numstat 블록이다(실측 형식).
    if (cmd === 'diff') return result(':100644 100644 aaa bbb M\x00a.ts\x002\t1\ta.ts\x00')
    if (cmd === 'log') return logResults.shift() ?? result('', false)
    return result('')
  })
}

describe('commit history 질의·fallback 계약 (EP-17)', () => {
  it('normal history를 raw+numstat 한 프로세스·8 MiB로 조회한다', async () => {
    const runner = fakeRunner([result(withOneFile('c1'))])

    const summary = await gitDiffSummary({ cwd: '/repo', baseOid: 'base-oid' }, runner)

    const logCalls = runner.mock.calls.filter(([, args]) => subcommand(args) === 'log')
    expect(logCalls).toHaveLength(1)
    expect(logCalls[0][1]).toEqual(
      expect.arrayContaining(['--raw', '--numstat', '-z', 'base-oid..HEAD'])
    )
    expect(logCalls[0][2]).toMatchObject({ readOnly: true, maxBuffer: 8 * 1024 * 1024 })
    expect(summary.commitFilesUnavailable).toBe(false)
    expect(summary.commits[0]).toMatchObject({
      sha: 'c1',
      body: 'real body',
      fileCount: 1,
      totals: { added: 2, removed: 1 }
    })
  })

  it('normal 실패 시 format은 같고 raw·numstat만 뺀 fallback을 한 번 실행한다', async () => {
    const runner = fakeRunner([result('', false), result(metadata('fallback', 'kept body'))])

    const summary = await gitDiffSummary({ cwd: '/repo', baseOid: 'base-oid' }, runner)

    const logCalls = runner.mock.calls.filter(([, args]) => subcommand(args) === 'log')
    expect(logCalls).toHaveLength(2)
    const normalFormat = logCalls[0][1].find((arg) => arg.startsWith('--format='))
    const fallbackFormat = logCalls[1][1].find((arg) => arg.startsWith('--format='))
    expect(fallbackFormat).toBe(normalFormat)
    expect(logCalls[1][1]).not.toContain('--raw')
    expect(logCalls[1][1]).not.toContain('--numstat')
    expect(logCalls[1][1]).not.toContain('--shortstat')
    expect(summary.commitFilesUnavailable).toBe(true)
    expect(summary.commits).toEqual([
      {
        sha: 'fallback',
        subject: 'subject fallback',
        author: 'tester',
        committedAt: 1756500000000,
        body: 'kept body',
        files: [],
        filesTruncated: false,
        fileCount: null,
        totals: null
      }
    ])
  })

  it('fallback까지 실패하면 커밋은 빈 목록이고 unavailable을 유지한다', async () => {
    const runner = fakeRunner([result('', false), result('', false)])

    const summary = await gitDiffSummary({ cwd: '/repo', baseOid: 'base-oid' }, runner)

    expect(runner.mock.calls.filter(([, args]) => subcommand(args) === 'log')).toHaveLength(2)
    expect(summary.commits).toEqual([])
    expect(summary.commitFilesUnavailable).toBe(true)
  })
})

// 0211 ΔV3 AT-39 / §10 EP-25 — **같은 결과를 더 적은 프로세스로**.
//
// 호출 수만 세면 결과를 덜 내는 구현이 통과한다. 산출 동등은 `git-diff.test.ts` 의 임시 저장소
// 케이스가 갖고(같은 스위트에서 함께 돈다), 여기서는 **호출의 형태**만 센다.
describe('읽기 조회의 호출 형태 (AT-39 · EP-25)', () => {
  it('요약 1회는 name-status 를 부르지 않고 raw+numstat 를 범위마다 한 번씩만 부른다', async () => {
    const runner = fakeRunner([result(withOneFile('c1'))])

    await gitDiffSummary({ cwd: '/repo', baseOid: 'base-oid' }, runner)

    const calls = runner.mock.calls.map(([, args]) => args)
    // 음성: 두 벌 조회의 잔재가 없다.
    expect(calls.filter((args) => args.includes('--name-status'))).toHaveLength(0)
    // 양성: 세션 범위 + 미커밋 범위 각 1건이고, 둘 다 한 호출에 두 플래그를 함께 든다.
    const diffCalls = calls.filter((args) => subcommand(args) === 'diff')
    expect(diffCalls).toHaveLength(2)
    for (const args of diffCalls) {
      expect(args).toContain('--raw')
      expect(args).toContain('--numstat')
    }
  })

  it('파일 열기 1회는 저장소 좌표를 한 rev-parse 로 얻는다', async () => {
    const runner = fakeRunner([])

    await gitDiffFile({ cwd: '/repo', path: 'a.ts', baseOid: 'base-oid' }, runner)

    const revParse = runner.mock.calls
      .map(([, args]) => args)
      .filter((args) => subcommand(args) === 'rev-parse')
    expect(revParse).toHaveLength(1)
    expect(revParse[0]).toContain('--is-inside-work-tree')
    expect(revParse[0]).toContain('--show-toplevel')
  })

  it('같은 runner 의 두 번째 조회는 좌표를 다시 묻지 않는다', async () => {
    const runner = fakeRunner([result(withOneFile('c1')), result(withOneFile('c1'))])
    // 술어는 불변식의 주어다 — `rev-parse` 전체가 아니라 **좌표 질의**를 센다. 같은 명령의
    // 다른 용도(`--verify HEAD`)는 이 계약이 말하는 대상이 아니다.
    const coordCalls = (): number =>
      runner.mock.calls.filter(([, a]) => a.includes('--is-inside-work-tree')).length

    await gitDiffSummary({ cwd: '/repo', baseOid: 'base-oid' }, runner)
    const afterFirst = coordCalls()
    await gitDiffSummary({ cwd: '/repo', baseOid: 'base-oid' }, runner)
    const afterSecond = coordCalls()
    await gitDiffFile({ cwd: '/repo', path: 'a.ts', baseOid: 'base-oid' }, runner)
    const afterFile = coordCalls()

    // 첫 조회가 묻고, 그 뒤로는 캐시가 답한다 — 요약이든 파일 열기든 같다.
    expect(afterFirst).toBe(1)
    expect(afterSecond).toBe(1)
    expect(afterFile).toBe(1)
  })

  it('읽기 조회 전건이 --no-optional-locks 로 시작한다 — 누락 0건', async () => {
    const runner = fakeRunner([result(withOneFile('c1'))])

    await gitDiffSummary({ cwd: '/repo', baseOid: 'base-oid' }, runner)
    await gitDiffFile({ cwd: '/repo', path: 'a.ts', baseOid: 'base-oid' }, runner)

    const all = runner.mock.calls.map(([, args]) => args)
    // 대상 집합이 비면 스윕은 아무것도 보지 않는다 — 분모부터 세운다.
    expect(all.length).toBeGreaterThan(3)
    // 완결성 주장은 **차집합**으로 센다. "있다" 를 몇 건 세는 방식은 새 호출부를 놓친다.
    const missing = all.filter((args) => args[0] !== '--no-optional-locks')
    expect(missing).toEqual([])
  })
})
