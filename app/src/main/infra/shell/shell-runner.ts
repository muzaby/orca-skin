// 사용자가 적은 shell 명령을 지정한 폴더에서 한 번 실행하고, 합쳐진 stdout/stderr 의 꼬리와
// 종료 코드를 돌려준다. `electron` 을 import 하지 않는다. feature 는 프로세스를 직접 만들지
// 않으므로 infra 에 두고 컴포지션 루트가 넘긴다. 상한(제한 시간·출력 크기)은 호출자가 정한다.

import { spawn as nodeSpawn } from 'node:child_process'
import { parseProcessTable, processTableCommand, type ProcessRow } from './process-table'

export interface ShellRunResult {
  exitCode: number | null
  output: string
  truncated: boolean
  timedOut: boolean
  // 프로세스를 띄우지 못했을 때의 사유.
  error: string | null
}

interface ChildLike {
  pid?: number
  stdout: { on(event: 'data', listener: (chunk: Buffer) => void): unknown } | null
  stderr: { on(event: 'data', listener: (chunk: Buffer) => void): unknown } | null
  on(event: 'error', listener: (error: Error) => void): unknown
  on(event: 'close' | 'exit', listener: (code: number | null) => void): unknown
  kill(): boolean
}

export type SpawnLike = (
  file: string,
  args: string[],
  options: {
    cwd: string
    windowsHide: boolean
    // POSIX 에서는 새 프로세스 그룹을 만들어 종료 시 자손까지 한 번에 끝낸다.
    detached: boolean
    stdio: ['ignore', 'pipe', 'pipe']
  }
) => ChildLike

// 셸과 그 자손 전체를 끝낸다. 셸만 죽이면 자손이 출력 파이프를 잡고 있어 실행이 제한 시간을
// 넘겨서도 끝나지 않는다.
export type KillTree = (child: ChildLike, platform: NodeJS.Platform) => void

export interface ShellRunInput {
  command: string
  cwd: string
  timeoutMs: number
  // 넘으면 꼬리만 남긴다.
  maxOutputBytes: number
  signal?: AbortSignal
  platform?: NodeJS.Platform
  spawnImpl?: SpawnLike
  killTreeImpl?: KillTree
}

// PowerShell 은 콘솔 코드페이지로 출력하므로(한국어 Windows = cp949) UTF-8 로 고정해 받는다.
const POWERSHELL_UTF8 = '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); '

export function shellInvocation(
  platform: NodeJS.Platform,
  command: string
): { file: string; args: string[] } {
  return platform === 'win32'
    ? {
        file: 'powershell.exe',
        args: ['-NoProfile', '-NonInteractive', '-Command', POWERSHELL_UTF8 + command]
      }
    : { file: '/bin/sh', args: ['-c', command] }
}

export const killProcessTree: KillTree = (child, platform) => {
  const pid = child.pid
  try {
    if (pid != null && platform === 'win32') {
      // /T = 자식 프로세스까지, /F = 강제.
      const killer = nodeSpawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore'
      })
      killer.on('error', () => child.kill())
      return
    }
    if (pid != null) {
      // 음수 pid = 그 프로세스 그룹(`detached: true` 로 만든 그룹) 전체.
      process.kill(-pid, 'SIGKILL')
      return
    }
  } catch {
    // 그룹이 이미 없거나 권한이 없으면 셸만이라도 끝낸다.
  }
  child.kill()
}

export function runShellCommand(input: ShellRunInput): Promise<ShellRunResult> {
  const max = input.maxOutputBytes
  const platform = input.platform ?? process.platform
  const { file, args } = shellInvocation(platform, input.command)
  return new Promise((resolve) => {
    let chunks: Buffer[] = []
    let size = 0
    let truncated = false
    let timedOut = false
    let settled = false
    let killRequested = false
    let child: ChildLike | undefined
    const append = (chunk: Buffer): void => {
      chunks.push(chunk)
      size += chunk.length
      if (size <= max) return
      // 꼬리만 남긴다.
      const tail = Buffer.concat(chunks).subarray(size - max)
      chunks = [tail]
      size = tail.length
      truncated = true
    }
    const kill = (): void => {
      if (!child || killRequested) return
      killRequested = true
      ;(input.killTreeImpl ?? killProcessTree)(child, platform)
    }
    const timer = setTimeout(() => {
      timedOut = true
      kill()
    }, input.timeoutMs)
    const done = (exitCode: number | null, error: string | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      input.signal?.removeEventListener('abort', kill)
      resolve({
        exitCode,
        output: Buffer.concat(chunks).toString('utf8'),
        truncated,
        timedOut,
        error
      })
    }
    try {
      child = (input.spawnImpl ?? (nodeSpawn as unknown as SpawnLike))(file, args, {
        cwd: input.cwd,
        windowsHide: true,
        detached: platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe']
      })
    } catch (e) {
      done(null, e instanceof Error ? e.message : String(e))
      return
    }
    child.stdout?.on('data', append)
    child.stderr?.on('data', append)
    child.on('error', (error) => done(null, error.message))
    child.on('close', (code) => done(code, null))
    // 종료를 요청한 뒤에는 파이프가 닫히기를 기다리지 않는다 — 남은 자손이 파이프를 잡아도
    // 셸이 끝난 시점에 결과를 확정한다.
    child.on('exit', (code) => {
      if (killRequested) done(code, null)
    })
    if (input.signal?.aborted) kill()
    else input.signal?.addEventListener('abort', kill, { once: true })
  })
}

// 지금 떠 있는 프로세스의 pid·부모 pid (0324 EP-12 — 죽은 호스트의 고아 선별). 목록을 못 얻으면
// 던진다 — 호출자(`reapOrphans`)가 기록하고 건너뛴다.
export async function listProcesses(input: {
  cwd: string
  timeoutMs: number
  platform?: NodeJS.Platform
  run?: (input: ShellRunInput) => Promise<ShellRunResult>
}): Promise<ProcessRow[]> {
  const platform = input.platform ?? process.platform
  const result = await (input.run ?? runShellCommand)({
    command: processTableCommand(platform),
    cwd: input.cwd,
    timeoutMs: input.timeoutMs,
    maxOutputBytes: 8 * 1024 * 1024,
    platform
  })
  if (result.error) throw new Error(`프로세스 목록 실패: ${result.error}`)
  if (result.exitCode !== 0 || result.truncated) {
    throw new Error(`프로세스 목록 실패: exit ${String(result.exitCode)}`)
  }
  return parseProcessTable(result.output)
}

// pid 하나를 그 자손까지 끝낸다. Windows 는 `taskkill /T /F`, POSIX 는 프로세스 그룹 → 그 프로세스.
export function killPidTree(
  pid: number,
  platform: NodeJS.Platform = process.platform
): Promise<void> {
  if (platform === 'win32') {
    return new Promise((resolve, reject) => {
      const killer = nodeSpawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore'
      })
      killer.on('error', reject)
      killer.on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error(`taskkill exit ${String(code)}`))
      )
    })
  }
  try {
    process.kill(-pid, 'SIGKILL')
  } catch {
    // 그룹 대표가 아니면 그 프로세스만 끝낸다.
    process.kill(pid, 'SIGKILL')
  }
  return Promise.resolve()
}
