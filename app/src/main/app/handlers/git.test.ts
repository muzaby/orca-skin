// git 3채널의 **검증 실패 정책**이 코드와 문서에서 같은지 대조한다 (AC20).
//
// 정책은 등록부의 세 번째 인자 하나뿐이라 오타 한 글자로 뒤집히는데, 뒤집혀도 아무 테스트도
// 깨지지 않았다: 읽기가 `reject` 가 되면 **저장소 아닌 폴더에서 컴포저가 통째로 깨진다**.
// 형상(`ipc-documentation.test.ts`)이 아니라 semantics 를 보는 자리다.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handleMock } = vi.hoisted(() => ({ handleMock: vi.fn() }))
vi.mock('../../infra/ipc/handle', () => ({ handle: handleMock }))

import { CHANNELS } from '../../../shared/ipc'
import { registerGitHandlers } from './git'

const IPC_DOCUMENT = fileURLToPath(new URL('../../../../../docs/IPC_CONTRACT.md', import.meta.url))

// 등록부에서 채널 → 정책만 뽑는다.
function registeredPolicies(): Map<string, 'reject' | 'fallback'> {
  handleMock.mockClear()
  registerGitHandlers()
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
  beforeEach(() => handleMock.mockClear())

  it('문서 §2.6-b 가 서술하는 채널 집합이 등록부와 같다', () => {
    const registered = [...registeredPolicies().keys()].sort()
    const documented = [...documentedRows().keys()].sort()

    expect(registered).toEqual(
      [CHANNELS.gitBranches, CHANNELS.gitCheckout, CHANNELS.gitStatus].sort()
    )
    expect(documented).toEqual(registered)
  })

  it('읽기 2종은 무해 폴백이고 전환만 reject 다', () => {
    const policies = registeredPolicies()

    expect(policies.get(CHANNELS.gitStatus)).toBe('fallback')
    expect(policies.get(CHANNELS.gitBranches)).toBe('fallback')
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
      fallback: { isRepo: false, branch: null, detached: false, dirty: null, root: null }
    })
    expect(byChannel.get(CHANNELS.gitBranches)).toEqual({
      fallback: { current: null, branches: [] }
    })
  })
})
