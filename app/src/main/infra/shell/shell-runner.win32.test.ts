// win32 프로세스 트리 종료 — `taskkill` 을 띄우는 인자와 그 실행이 실패했을 때의 폴백을 본다.
// 실제 Windows 가 아니어도 관측되도록 `node:child_process` 의 spawn 을 대체한다 — exe 를 띄우지 않으므로 unit 풀이다.

import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const spawned = vi.hoisted(() => ({
  calls: [] as { file: string; args: string[]; options: Record<string, unknown> }[],
  killers: [] as import('node:events').EventEmitter[]
}))

vi.mock('node:child_process', async () => {
  const { EventEmitter: Emitter } = await import('node:events')
  const spawn = (
    file: string,
    args: string[],
    options: Record<string, unknown>
  ): import('node:events').EventEmitter => {
    spawned.calls.push({ file, args, options })
    const killer = new Emitter()
    spawned.killers.push(killer)
    return killer
  }
  return { spawn, default: { spawn } }
})
import { killProcessTree } from './shell-runner'

class Shell extends EventEmitter {
  kills = 0
  constructor(readonly pid: number) {
    super()
  }
  stdout = null
  stderr = null
  kill(): boolean {
    this.kills += 1
    return true
  }
}

beforeEach(() => {
  spawned.calls.length = 0
  spawned.killers.length = 0
})

describe('killProcessTree — win32', () => {
  it('taskkill 로 그 pid 의 자손까지 강제로, 창 없이 끝낸다', () => {
    const shell = new Shell(4321)
    killProcessTree(shell, 'win32')
    expect(spawned.calls).toHaveLength(1)
    expect(spawned.calls[0]).toMatchObject({
      file: 'taskkill',
      args: ['/pid', '4321', '/T', '/F'],
      options: { windowsHide: true }
    })
    // taskkill 이 맡았으면 셸을 따로 죽이지 않는다.
    expect(shell.kills).toBe(0)
  })

  it('taskkill 을 띄우지 못하면 셸이라도 끝낸다', () => {
    const shell = new Shell(4321)
    killProcessTree(shell, 'win32')
    spawned.killers[0]!.emit('error', new Error('spawn taskkill ENOENT'))
    expect(shell.kills).toBe(1)
  })
})
