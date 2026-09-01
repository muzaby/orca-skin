// git 3채널의 **검증 실패 정책**이 코드와 문서에서 같은지 대조한다 (AC20).
//
// 정책은 등록부의 세 번째 인자 하나뿐이라 오타 한 글자로 뒤집히는데, 뒤집혀도 아무 테스트도
// 깨지지 않았다: 읽기가 `reject` 가 되면 **저장소 아닌 폴더에서 컴포저가 통째로 깨진다**.
// 형상(`ipc-documentation.test.ts`)이 아니라 semantics 를 보는 자리다.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handleMock, gitDiffSummaryMock, gitDiffFileMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  gitDiffSummaryMock: vi.fn(async () => ({ kind: 'clean' })),
  gitDiffFileMock: vi.fn(async () => ({ kind: 'unavailable', reason: 'error' }))
}))
vi.mock('../../infra/ipc/handle', () => ({ handle: handleMock }))
vi.mock('../../infra/git/git-diff', () => ({
  EMPTY_DIFF_SUMMARY: { kind: 'clean' },
  gitDiffSummary: gitDiffSummaryMock,
  gitDiffFile: gitDiffFileMock
}))

import { CHANNELS } from '../../../shared/ipc'
import { registerGitHandlers } from './git'

const IPC_DOCUMENT = fileURLToPath(new URL('../../../../../docs/IPC_CONTRACT.md', import.meta.url))
const GIT_HANDLER_SOURCE = fileURLToPath(new URL('./git.ts', import.meta.url))

// 등록부에서 채널 → 정책만 뽑는다.
function registeredPolicies(): Map<string, 'reject' | 'fallback'> {
  handleMock.mockClear()
  // 0211 — base 조회 포트는 **필수 인자**다(배선을 잊으면 모든 세션이 조용히 HEAD 범위로
  // 떨어진다). 이 테스트는 정책만 보므로 row 없음 스텁으로 충분하다.
  registerGitHandlers({ getSessionBaseline: () => null })
  return new Map(
    handleMock.mock.calls.map((call) => [
      call[0] as string,
      call[2] === 'reject' ? 'reject' : 'fallback'
    ])
  )
}

// §2.6-b 표의 행들 — `| \`orca:git:xxx\` | … |` 한 줄이 한 채널이다.
function documentedRows(): Map<string, string> {
  const document = readFileSync(IPC_DOCUMENT, 'utf8')
  const section = document.slice(document.indexOf('### 2.6-b Git'))
  const body = section.slice(0, section.indexOf('\n### '))
  return new Map(
    [...body.matchAll(/^\| `(orca:git:[a-zA-Z]+)` \|(.*)$/gm)].map((row) => [row[1], row[2]])
  )
}

describe('git 채널 검증 실패 정책 — 코드 ↔ IPC_CONTRACT §2.6-b', () => {
  beforeEach(() => {
    handleMock.mockClear()
    gitDiffSummaryMock.mockClear()
    gitDiffFileMock.mockClear()
  })

  it('session baseline lookup의 OID를 summary·file 둘에 같이 전달하고 commit 범위를 넘기지 않는다', async () => {
    const getSessionBaseline = vi.fn(() => 'c'.repeat(40))
    registerGitHandlers({ getSessionBaseline })
    const summaryHandler = handleMock.mock.calls.find(
      (call) => call[0] === CHANNELS.gitDiffSummary
    )?.[3] as (request: { cwd: string; sessionId: string; commit?: string }) => Promise<unknown>
    const fileHandler = handleMock.mock.calls.find(
      (call) => call[0] === CHANNELS.gitDiffFile
    )?.[3] as (request: {
      cwd: string
      sessionId: string
      path: string
      commit?: string
    }) => Promise<unknown>

    await summaryHandler({ cwd: '/repo', sessionId: 'session-1', commit: 'a'.repeat(40) })
    await fileHandler({
      cwd: '/repo',
      sessionId: 'session-1',
      path: 'src/a.ts',
      commit: 'a'.repeat(40)
    })

    expect(getSessionBaseline).toHaveBeenCalledTimes(2)
    expect(getSessionBaseline).toHaveBeenNthCalledWith(1, 'session-1')
    expect(getSessionBaseline).toHaveBeenNthCalledWith(2, 'session-1')
    expect(gitDiffSummaryMock).toHaveBeenCalledWith({
      cwd: '/repo',
      baseOid: 'c'.repeat(40)
    })
    expect(gitDiffFileMock).toHaveBeenCalledWith({
      cwd: '/repo',
      path: 'src/a.ts',
      baseOid: 'c'.repeat(40)
    })
    expect(readFileSync(GIT_HANDLER_SOURCE, 'utf8')).not.toContain('getManagedWorktreeBySession')
  })

  it('문서 §2.6-b 가 서술하는 채널 집합이 등록부와 같다', () => {
    const registered = [...registeredPolicies().keys()].sort()
    const documented = [...documentedRows().keys()].sort()

    expect(registered).toEqual(
      [
        CHANNELS.gitBranches,
        CHANNELS.gitCheckout,
        CHANNELS.gitStatus,
        // 0211 — 변경사항 타일의 읽기 2종.
        CHANNELS.gitDiffSummary,
        CHANNELS.gitDiffFile
      ].sort()
    )
    expect(documented).toEqual(registered)
  })

  it('읽기 4종은 무해 폴백이고 전환만 reject 다', () => {
    const policies = registeredPolicies()

    expect(policies.get(CHANNELS.gitStatus)).toBe('fallback')
    expect(policies.get(CHANNELS.gitBranches)).toBe('fallback')
    // 0211 — diff 읽기도 같은 규칙이다: 저장소가 아니어도 타일은 떠야 하고 그 판정이
    // 곧 "볼 것이 없음" 이라는 UI 입력이다.
    expect(policies.get(CHANNELS.gitDiffSummary)).toBe('fallback')
    expect(policies.get(CHANNELS.gitDiffFile)).toBe('fallback')
    expect(policies.get(CHANNELS.gitCheckout)).toBe('reject')
  })

  it('각 채널의 문서 행이 코드와 같은 정책을 말한다', () => {
    const policies = registeredPolicies()
    const rows = documentedRows()

    for (const [channel, policy] of policies) {
      const row = rows.get(channel) ?? ''
      // 폴백 채널의 행은 '폴백' 을 말하고 reject 를 정책으로 내걸지 않는다. 전환 행은 그 반대다.
      if (policy === 'fallback') {
        expect(row, `${channel} 는 폴백인데 문서가 그렇게 말하지 않는다`).toMatch(/폴백/)
        expect(row, `${channel} 는 폴백인데 문서가 reject 라 한다`).not.toMatch(/reject/)
      } else {
        expect(row, `${channel} 는 reject 인데 문서가 그렇게 말하지 않는다`).toMatch(/reject/)
        expect(row, `${channel} 는 reject 인데 문서가 폴백이라 한다`).not.toMatch(/폴백/)
      }
    }
  })

  it('읽기 폴백 값은 "저장소 아님"·"빈 목록" 이다 — 컴포저가 그 값으로 칩을 지운다', () => {
    registeredPolicies()
    const byChannel = new Map(handleMock.mock.calls.map((call) => [call[0] as string, call[2]]))

    expect(byChannel.get(CHANNELS.gitStatus)).toEqual({
      fallback: { isRepo: false, branch: null, detached: false, root: null }
    })
    expect(byChannel.get(CHANNELS.gitBranches)).toEqual({
      fallback: { current: null, branches: [] }
    })
  })
})
