import { describe, expect, it, vi } from 'vitest'
import type { GitRunOptions, GitRunResult } from './runner'
import { gitDiffSummary } from './git-diff'

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
  metadata(sha, 'real body') +
  '\x00:100644 100644 aaaaaaa bbbbbbb M\x00a.ts\x00' +
  '2\t1\ta.ts\x00'

function fakeRunner(logResults: GitRunResult[]): ReturnType<typeof vi.fn<Runner>> {
  return vi.fn<Runner>(async (_cwd, args) => {
    if (args[0] === 'rev-parse' && args.includes('--is-inside-work-tree')) return result('true\n')
    if (args[0] === 'rev-parse' && args.includes('HEAD')) return result('head-oid\n')
    if (args[0] === 'diff' && args.includes('--numstat')) return result('2\t1\ta.ts\x00')
    if (args[0] === 'diff' && args.includes('--name-status')) return result('M\x00a.ts\x00')
    if (args[0] === 'log') return logResults.shift() ?? result('', false)
    return result('')
  })
}

describe('commit history 질의·fallback 계약 (EP-17)', () => {
  it('normal history를 raw+numstat 한 프로세스·8 MiB로 조회한다', async () => {
    const runner = fakeRunner([result(withOneFile('c1'))])

    const summary = await gitDiffSummary({ cwd: '/repo', baseOid: 'base-oid' }, runner)

    const logCalls = runner.mock.calls.filter(([, args]) => args[0] === 'log')
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

    const logCalls = runner.mock.calls.filter(([, args]) => args[0] === 'log')
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

    expect(runner.mock.calls.filter(([, args]) => args[0] === 'log')).toHaveLength(2)
    expect(summary.commits).toEqual([])
    expect(summary.commitFilesUnavailable).toBe(true)
  })
})
