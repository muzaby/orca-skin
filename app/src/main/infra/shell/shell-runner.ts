// 사용자가 적은 shell 명령을 지정한 폴더에서 한 번 실행하고, 합쳐진 stdout/stderr 의 꼬리와
// 종료 코드를 돌려준다. `electron` 을 import 하지 않는다. feature 는 프로세스를 직접 만들지
// 않으므로 infra 에 두고 컴포지션 루트가 넘긴다. 상한(제한 시간·출력 크기)은 호출자가 정한다.

import { spawn as nodeSpawn } from 'node:child_process'

export interface ShellRunResult {
  exitCode: number | null
  output: string
  truncated: boolean
  timedOut: boolean
  // 프로세스를 띄우지 못했을 때의 사유.
  error: string | null
}

interface ChildLike {
  stdout: { on(event: 'data', listener: (chunk: Buffer) => void): unknown } | null
  stderr: { on(event: 'data', listener: (chunk: Buffer) => void): unknown } | null
  on(event: 'error', listener: (error: Error) => void): unknown
  on(event: 'close', listener: (code: number | null) => void): unknown
  kill(): boolean
}

export type SpawnLike = (
  file: string,
  args: string[],
  options: { cwd: string; windowsHide: boolean; stdio: ['ignore', 'pipe', 'pipe'] }
) => ChildLike

export interface ShellRunInput {
  command: string
  cwd: string
  timeoutMs: number
  // 넘으면 꼬리만 남긴다.
  maxOutputBytes: number
  signal?: AbortSignal
  platform?: NodeJS.Platform
  spawnImpl?: SpawnLike
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

export function runShellCommand(input: ShellRunInput): Promise<ShellRunResult> {
  const max = input.maxOutputBytes
  const { file, args } = shellInvocation(input.platform ?? process.platform, input.command)
  return new Promise((resolve) => {
    let chunks: Buffer[] = []
    let size = 0
    let truncated = false
    let timedOut = false
    let settled = false
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
      child?.kill()
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
    if (input.signal?.aborted) kill()
    else input.signal?.addEventListener('abort', kill, { once: true })
  })
}
