import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runShellCommand, shellInvocation, type KillTree, type SpawnLike } from './shell-runner'

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
    // 콘솔 코드페이지(cp949 등)가 아니라 UTF-8 로 받도록 명령 앞에 출력 인코딩을 고정한다(AC14).
    expect(win.args[3]).toBe(
      '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); Get-Date'
    )
    expect(win.args).toHaveLength(4)
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

  it('POSIX 는 새 프로세스 그룹으로 띄우고 win32 는 그러지 않는다', () => {
    const seen: boolean[] = []
    const spawn = ((_file, _args, options) => {
      seen.push(options.detached)
      return new FakeChild()
    }) as SpawnLike
    void runShellCommand({
      ...LIMITS,
      command: 'x',
      cwd: '/w',
      platform: 'linux',
      spawnImpl: spawn
    })
    void runShellCommand({
      ...LIMITS,
      command: 'x',
      cwd: 'C:\\w',
      platform: 'win32',
      spawnImpl: spawn
    })
    expect(seen).toEqual([true, false])
  })

  // 자손이 출력 파이프를 잡고 있으면 close 가 오지 않는다 — 종료를 요청한 뒤에는 exit 로 끝낸다.
  it('제한 시간 종료는 프로세스 트리를 끝내고 파이프가 닫히지 않아도 exit 로 결과를 확정한다', async () => {
    const child = new FakeChild()
    const spawn = (() => child) as SpawnLike
    const trees: { child: unknown; platform: NodeJS.Platform }[] = []
    const killTreeImpl: KillTree = (target, platform) => {
      trees.push({ child: target, platform })
      // 셸은 끝났지만 손자 프로세스가 stdout 을 잡고 있다 — close 없이 exit 만 온다.
      queueMicrotask(() => child.emit('exit', null))
    }
    const result = runShellCommand({
      ...LIMITS,
      command: 'x',
      cwd: '/w',
      platform: 'linux',
      spawnImpl: spawn,
      killTreeImpl
    })
    await vi.advanceTimersByTimeAsync(LIMITS.timeoutMs)
    await expect(result).resolves.toMatchObject({ timedOut: true, exitCode: null })
    expect(trees).toEqual([{ child, platform: 'linux' }])
    expect(child.killed).toBe(0)
  })

  // 끝난 실행의 pid 는 다른 프로세스가 다시 받을 수 있다 — 정상 종료 뒤에는 어떤 경로로도 종료를 부르지 않는다.
  it('정상 종료 뒤에는 제한 시간이 지나도 프로세스 트리 종료를 부르지 않는다', async () => {
    const child = new FakeChild()
    const killTreeImpl = vi.fn<KillTree>()
    const result = runShellCommand({
      ...LIMITS,
      command: 'x',
      cwd: '/w',
      platform: 'linux',
      spawnImpl: (() => child) as SpawnLike,
      killTreeImpl
    })
    child.emit('close', 0)
    await expect(result).resolves.toMatchObject({ exitCode: 0, timedOut: false })
    await vi.advanceTimersByTimeAsync(LIMITS.timeoutMs * 2)
    expect(killTreeImpl).not.toHaveBeenCalled()
  })

  it('정상 종료 뒤 중단 신호가 와도 프로세스 트리 종료를 부르지 않는다', async () => {
    const child = new FakeChild()
    const killTreeImpl = vi.fn<KillTree>()
    const controller = new AbortController()
    const result = runShellCommand({
      ...LIMITS,
      command: 'x',
      cwd: '/w',
      platform: 'linux',
      spawnImpl: (() => child) as SpawnLike,
      killTreeImpl,
      signal: controller.signal
    })
    child.emit('close', 0)
    await expect(result).resolves.toMatchObject({ exitCode: 0 })
    controller.abort()
    expect(killTreeImpl).not.toHaveBeenCalled()
  })

  it('셸은 플랫폼과 무관하게 창 없이 띄운다', () => {
    const seen: { platform: string; windowsHide: boolean }[] = []
    for (const platform of ['linux', 'win32'] as const) {
      void runShellCommand({
        ...LIMITS,
        command: 'x',
        cwd: '/w',
        platform,
        spawnImpl: ((_file, _args, options) => {
          seen.push({ platform, windowsHide: options.windowsHide })
          return new FakeChild()
        }) as SpawnLike
      })
    }
    expect(seen).toEqual([
      { platform: 'linux', windowsHide: true },
      { platform: 'win32', windowsHide: true }
    ])
  })

  it('종료를 요청하지 않았으면 exit 만으로 끝내지 않고 남은 출력을 기다린다', async () => {
    const child = new FakeChild()
    const result = runShellCommand({
      ...LIMITS,
      command: 'x',
      cwd: '/w',
      platform: 'linux',
      spawnImpl: (() => child) as SpawnLike
    })
    child.emit('exit', 0)
    child.stdout.emit('data', Buffer.from('late'))
    child.emit('close', 0)
    await expect(result).resolves.toMatchObject({ exitCode: 0, output: 'late' })
  })
})
