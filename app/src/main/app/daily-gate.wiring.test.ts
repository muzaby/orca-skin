import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { stripCommentsAndStrings } from '../infra/source-scan'

const source = readFileSync(new URL('./data-host/bootstrap.ts', import.meta.url), 'utf8')
const code = stripCommentsAndStrings(source)

describe('bootstrap daily gate wiring', () => {
  it('owns one daily gate start and disposal site', () => {
    expect(code.match(/\bstartDailyGate\s*\(/g)).toHaveLength(1)
    expect(code.match(/this\.dailyGate\?\.dispose\s*\(/g)).toHaveLength(1)
    const shutdown = code.slice(code.indexOf('async shutdown(): Promise<void>'))
    expect(shutdown).toContain('this.dailyGate?.dispose()')
  })

  // 깨어남 신호는 셸이 알린다(0324 EP-10) — Bootstrap 은 셸 서비스 포트를 구독하고 그 해제를
  // 돌려준다. 원인 세 가지(절전 해제·화면 잠금 해제·창 포커스)는 셸(`index.ts`)이 낸다.
  it('subscribes the boundary check to shell wake signals and returns the unsubscribe', () => {
    expect(
      code.match(
        /subscribeWake:\s*\(check\)\s*=>\s*shellServices\(\)\.onWake\(\(\)\s*=>\s*check\(\)\)/g
      )
    ).toHaveLength(1)
  })

  // 셸은 깨어남을 두 호스트의 감독자로 보낸다 — 기동 중에도 가야 하므로 `send` 다(준비 뒤만 가는
  // `post` 가 아니다). 호스트는 `host-process.ts` 가 세운 셸 클라이언트로 받는다.
  const index = readFileSync(new URL('../index.ts', import.meta.url), 'utf8')
  it('the shell forwards wake to both host supervisors', () => {
    expect(index).toMatch(
      /const wake = \(reason: 'resume' \| 'unlock-screen' \| 'window-focus'\): void => \{\s*supervisors\.data\?\.send\(\{ type: 'wake', reason \}\)\s*supervisors\.agent\?\.send\(\{ type: 'wake', reason \}\)\s*\}/
    )
    const hostProcess = stripCommentsAndStrings(
      readFileSync(new URL('./host-process.ts', import.meta.url), 'utf8')
    )
    expect(hostProcess.match(/setShellServices\(runtime\.shell\)/g)).toHaveLength(1)
  })
  it.each([
    ['powerMonitor', 'resume', 'resume'],
    ['powerMonitor', 'unlock-screen', 'unlock-screen'],
    ['app', 'browser-window-focus', 'window-focus']
  ])('the shell turns %s %s into a wake(%s) for the hosts', (owner, event, reason) => {
    expect(
      index.match(
        new RegExp(`${owner}\\.on\\('${event}',\\s*\\(\\)\\s*=>\\s*wake\\('${reason}'\\)\\)`, 'g')
      )
    ).toHaveLength(1)
  })

  it('connects the existing Auth change consumer to the live gate login recorder', () => {
    expect(code).toMatch(
      /recordGateLogin:\s*\(authId, revision\)\s*=>\s*gate\.noteLoginCommit\(authId, revision\)/
    )
  })
})
