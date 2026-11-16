// 실제 프로세스로 제한 시간 종료를 본다 — 셸만 끝내면 자손(손자) 프로세스가 출력 파이프를 잡고
// 있어 실행이 제한 시간을 한참 넘겨 끝난다(0320 verify r1 D4). 자식 프로세스를 띄우므로 io 풀이다.

import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { scaleMs } from '../../../../scripts/test-time.mjs'
import { runShellCommand, type SpawnLike } from './shell-runner'

const isWin = process.platform === 'win32'

// 끝난 고아 프로세스는 거둘 부모가 없으면 좀비(Z)로 남는다 — 좀비는 살아 있는 것이 아니다.
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
  } catch {
    return false
  }
  try {
    return readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1]?.[0] !== 'Z'
  } catch {
    return true
  }
}
// 셸 아래에서 30초 동안 사는 자손 하나를 띄우고, 그 pid 를 출력한다(POSIX).
const LONG_CHILD = isWin ? 'ping -n 30 127.0.0.1 > $null' : 'sleep 30 & echo $!; wait'

describe('runShellCommand — 실제 프로세스', () => {
  it('제한 시간이 지나면 자손까지 끝내고 곧바로 결과를 돌려준다', async () => {
    const startedAt = Date.now()
    const result = await runShellCommand({
      command: LONG_CHILD,
      cwd: process.cwd(),
      // 제한 시간 자체를 시험하는 의미 값이다(SEMANTIC_DELAYS).
      timeoutMs: 300,
      maxOutputBytes: 4096,
      spawnImpl: spawn as unknown as SpawnLike
    })
    expect(result.timedOut).toBe(true)
    expect(Date.now() - startedAt).toBeLessThan(scaleMs(2000))
    if (!isWin) {
      const pid = Number(result.output.trim())
      expect(Number.isInteger(pid) && pid > 0).toBe(true)
      await vi.waitFor(() => expect(alive(pid)).toBe(false))
    }
  })

  // TERM 을 무시하는 자손도 남기지 않는다 — 그룹 종료는 무시할 수 없는 신호여야 한다.
  it.skipIf(isWin)('TERM 을 무시하는 자손도 제한 시간에 끝낸다', async () => {
    const result = await runShellCommand({
      command: `sh -c 'trap "" TERM; exec sleep 30' & echo $!; wait`,
      cwd: process.cwd(),
      // 제한 시간 자체를 시험하는 의미 값이다(SEMANTIC_DELAYS).
      timeoutMs: 300,
      maxOutputBytes: 4096,
      spawnImpl: spawn as unknown as SpawnLike
    })
    expect(result.timedOut).toBe(true)
    const pid = Number(result.output.trim())
    expect(Number.isInteger(pid) && pid > 0).toBe(true)
    await vi.waitFor(() => expect(alive(pid)).toBe(false))
  })
})
