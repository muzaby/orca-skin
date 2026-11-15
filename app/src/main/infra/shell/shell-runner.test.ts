import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runShellCommand, shellInvocation, type SpawnLike } from './shell-runner'

class FakeChild extends EventEmitter {
  stdout = new EventEmitter()
  stderr = new EventEmitter()
  killed = 0
  kill(): boolean {
    this.killed += 1
    // 실제 프로세스처럼 kill 뒤에 close 가 온다.
    queueMicrotask(() => this.emit('close', null))
    return true
  }
}

function fakeSpawn(): {
  spawn: SpawnLike
  calls: { file: string; args: string[]; cwd: string }[]
  child: FakeChild
} {
  const child = new FakeChild()
  const calls: { file: string; args: string[]; cwd: string }[] = []
  return {
    child,
    calls,
    spawn: ((file, args, options) => {
      calls.push({ file, args, cwd: options.cwd })
      return child
    }) as SpawnLike
  }
}

// 상한은 호출자가 정한다 — 가짜 시계 위에서만 흐르는 값이다.
const LIMITS = { timeoutMs: 600_000, maxOutputBytes: 4096 }

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('runShellCommand', () => {
  it('win32 는 PowerShell, 그 외는 sh 로 명령을 넘긴다', () => {
    const win = shellInvocation('win32', 'Get-Date')
    expect(win.file).toBe('powershell.exe')
    expect(win.args.slice(0, 3)).toEqual(['-NoProfile', '-NonInteractive', '-Command'])
    expect(win.args[3]).toMatch(/Get-Date$/)
    expect(shellInvocation('linux', 'date')).toEqual({ file: '/bin/sh', args: ['-c', 'date'] })
    expect(shellInvocation('darwin', 'date').file).toBe('/bin/sh')
  })

  it('프로젝트 폴더를 cwd 로 실행하고 exit 0 과 합쳐진 출력을 돌려준다', async () => {
    const { spawn, calls, child } = fakeSpawn()
    const result = runShellCommand({
      ...LIMITS,
      command: 'echo hi',
      cwd: 'C:\\work\\demo',
      platform: 'linux',
      spawnImpl: spawn
    })
    child.stdout.emit('data', Buffer.from('out '))
    child.stderr.emit('data', Buffer.from('err'))
    child.emit('close', 0)
    await expect(result).resolves.toEqual({
      exitCode: 0,
      output: 'out err',
      truncated: false,
      timedOut: false,
      error: null
    })
    expect(calls).toEqual([{ file: '/bin/sh', args: ['-c', 'echo hi'], cwd: 'C:\\work\\demo' }])
  })

  it('0 이 아닌 종료 코드를 그대로 돌려준다', async () => {
    const { spawn, child } = fakeSpawn()
    const result = runShellCommand({
      ...LIMITS,
      command: 'x',
      cwd: '/w',
      platform: 'linux',
      spawnImpl: spawn
    })
    child.emit('close', 3)
    expect((await result).exitCode).toBe(3)
  })

  it('제한 시간을 넘기면 프로세스를 종료하고 timedOut 으로 끝난다', async () => {
    const { spawn, child } = fakeSpawn()
    const result = runShellCommand({
      ...LIMITS,
      command: 'x',
      cwd: '/w',
      platform: 'linux',
      spawnImpl: spawn
    })
    await vi.advanceTimersByTimeAsync(LIMITS.timeoutMs - 1)
    expect(child.killed).toBe(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(child.killed).toBe(1)
    await expect(result).resolves.toMatchObject({ timedOut: true, exitCode: null })
  })

  it('상한을 넘는 출력은 꼬리만 남기고 잘림을 표시한다', async () => {
    const { spawn, child } = fakeSpawn()
    const result = runShellCommand({
      ...LIMITS,
      command: 'x',
      cwd: '/w',
      platform: 'linux',
      spawnImpl: spawn
    })
    child.stdout.emit('data', Buffer.from('H'.repeat(6 * 1024)))
    child.stdout.emit('data', Buffer.from('m'.repeat(LIMITS.maxOutputBytes)))
    child.stdout.emit('data', Buffer.from('TAIL'))
    child.emit('close', 0)
    const { output, truncated } = await result
    expect(truncated).toBe(true)
    expect(Buffer.byteLength(output)).toBe(LIMITS.maxOutputBytes)
    expect(output.endsWith('TAIL')).toBe(true)
    expect(output).not.toContain('H')
  })

  it('상한 이하 출력은 잘리지 않는다', async () => {
    const { spawn, child } = fakeSpawn()
    const result = runShellCommand({
      ...LIMITS,
      command: 'x',
      cwd: '/w',
      platform: 'linux',
      spawnImpl: spawn
    })
    child.stdout.emit('data', Buffer.from('a'.repeat(LIMITS.maxOutputBytes)))
    child.emit('close', 0)
    expect((await result).truncated).toBe(false)
  })

  it('중단 신호가 오면 프로세스를 종료한다', async () => {
    const { spawn, child } = fakeSpawn()
    const controller = new AbortController()
    const result = runShellCommand({
      ...LIMITS,
      command: 'x',
      cwd: '/w',
      platform: 'linux',
      spawnImpl: spawn,
      signal: controller.signal
    })
    controller.abort()
    expect(child.killed).toBe(1)
    await expect(result).resolves.toMatchObject({ exitCode: null, timedOut: false })
  })

  it('프로세스를 띄우지 못하면 사유를 돌려준다', async () => {
    const thrown = runShellCommand({
      ...LIMITS,
      command: 'x',
      cwd: '/w',
      platform: 'linux',
      spawnImpl: (() => {
        throw new Error('spawn ENOENT')
      }) as SpawnLike
    })
    await expect(thrown).resolves.toMatchObject({ exitCode: null, error: 'spawn ENOENT' })
    const { spawn, child } = fakeSpawn()
    const emitted = runShellCommand({
      ...LIMITS,
      command: 'x',
      cwd: '/w',
      platform: 'linux',
      spawnImpl: spawn
    })
    child.emit('error', new Error('EACCES'))
    await expect(emitted).resolves.toMatchObject({ exitCode: null, error: 'EACCES' })
  })
})
