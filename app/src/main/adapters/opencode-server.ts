import { spawn, execFile, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { delimiter, isAbsolute, join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { harnessEnvFingerprint } from './harness-config'
import type { HarnessPreferences } from '../../shared/harness'

export interface OpenCodeConnection {
  url: string
  headers: Record<string, string>
}

export function resolveOpenCodeExecutable(configured = '', env = process.env): string {
  if (configured) {
    if (!isAbsolute(configured) || !existsSync(configured)) {
      throw new Error('OpenCode 실행 파일의 절대 경로를 확인해 주세요.')
    }
    if (process.platform === 'win32' && !configured.toLowerCase().endsWith('.exe')) {
      throw new Error('OpenCode 실행 파일(.exe)을 선택해 주세요.')
    }
    return configured
  }
  const name = process.platform === 'win32' ? 'opencode.exe' : 'opencode'
  for (const dir of (env.PATH ?? env.Path ?? '').split(delimiter)) {
    if (!dir) continue
    for (const candidate of [
      join(dir, name),
      join(dir, 'node_modules', 'opencode-ai', 'bin', name),
      join(dir, 'node_modules', '@opencode', 'cli', 'bin', name)
    ]) {
      if (existsSync(candidate)) return candidate
    }
  }
  throw new Error(
    'OpenCode 실행 파일을 찾을 수 없습니다. 설치 후 하네스 설정에서 경로를 지정해 주세요.'
  )
}

export interface OpenCodeServerDependencies {
  dataDirectory: string
  preferences: () => HarnessPreferences | undefined
  fetchImpl: typeof fetch
  spawnProcess?: typeof spawn
  executable?: () => string
  timeoutMs?: number
}

/** Only processes created here are owned. No attachment to an existing port/process. */
export class OpenCodeServerPool {
  private readonly entries = new Map<
    string,
    { ready: Promise<OpenCodeConnection>; child?: ChildProcess }
  >()
  private stopped = false
  private readonly shutdown = new AbortController()

  constructor(private readonly deps: OpenCodeServerDependencies) {}

  executable(): string {
    return (
      this.deps.executable?.() ?? resolveOpenCodeExecutable(this.deps.preferences()?.executablePath)
    )
  }

  async installed(): Promise<{ installed: boolean; binPath?: string; version?: string }> {
    try {
      const binPath = this.executable()
      const version = await new Promise<string>((resolve, reject) => {
        execFile(binPath, ['--version'], { windowsHide: true, timeout: 5000 }, (error, stdout) => {
          if (error) reject(error)
          else resolve(stdout.trim().slice(0, 100))
        })
      })
      return { installed: true, binPath, version }
    } catch {
      return { installed: false }
    }
  }

  acquire(
    config: Record<string, unknown> = {},
    env?: Record<string, string>
  ): Promise<OpenCodeConnection> {
    if (this.stopped) return Promise.reject(new Error('OpenCode 서버 관리자가 종료되었습니다.'))
    const executable = this.executable()
    const key = harnessEnvFingerprint({
      config: JSON.stringify(config),
      env: JSON.stringify(env),
      executable
    })
    const existing = this.entries.get(key)
    if (existing) return existing.ready
    const entry: { ready: Promise<OpenCodeConnection>; child?: ChildProcess } = {
      ready: Promise.resolve({ url: '', headers: {} })
    }
    this.entries.set(key, entry)
    entry.ready = this.start(executable, config, env, (child) => {
      entry.child = child
    }).catch((error) => {
      if (this.entries.get(key) === entry) this.entries.delete(key)
      entry.child?.kill()
      throw error
    })
    return entry.ready
  }

  private async start(
    executable: string,
    config: Record<string, unknown>,
    env: Record<string, string> | undefined,
    own: (child: ChildProcess) => void
  ): Promise<OpenCodeConnection> {
    mkdirSync(this.deps.dataDirectory, { recursive: true })
    const password = randomBytes(32).toString('base64url')
    const child = (this.deps.spawnProcess ?? spawn)(
      executable,
      ['serve', '--hostname=127.0.0.1', '--port=0'],
      {
        windowsHide: true,
        cwd: this.deps.dataDirectory,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...env,
          XDG_DATA_HOME: join(this.deps.dataDirectory, 'data'),
          XDG_CONFIG_HOME: join(this.deps.dataDirectory, 'config'),
          XDG_STATE_HOME: join(this.deps.dataDirectory, 'state'),
          XDG_CACHE_HOME: join(this.deps.dataDirectory, 'cache'),
          OPENCODE_CONFIG_CONTENT: JSON.stringify({ ...config, share: 'disabled' }),
          OPENCODE_SERVER_USERNAME: 'opencode',
          OPENCODE_SERVER_PASSWORD: password
        }
      }
    )
    own(child)
    const exited = new AbortController()
    const timeout = new AbortController()
    const timer = setTimeout(
      () => timeout.abort(new DOMException('OpenCode 서버 시작 시간 초과', 'TimeoutError')),
      this.deps.timeoutMs ?? 15000
    )
    const signal = AbortSignal.any([this.shutdown.signal, exited.signal, timeout.signal])
    child.once('exit', () => {
      exited.abort(new Error('OpenCode 서버가 종료되었습니다. 실행 파일과 설정을 확인해 주세요.'))
      for (const [key, entry] of this.entries) if (entry.child === child) this.entries.delete(key)
    })
    // Drain stderr without copying credentials or provider diagnostics into application logs.
    child.stderr?.resume()
    try {
      const url = await new Promise<string>((resolve, reject) => {
        let output = ''
        const finish = (error?: Error, value?: string): void => {
          signal.removeEventListener('abort', onAbort)
          child.stdout?.off('data', onData)
          child.stdout?.resume()
          if (error) reject(error)
          else resolve(value!)
        }
        const onAbort = (): void =>
          finish(
            signal.reason instanceof Error
              ? signal.reason
              : new Error('OpenCode 서버 시작이 취소되었습니다.')
          )
        const onData = (chunk: Buffer): void => {
          output = (output + chunk.toString()).slice(-8192)
          const match = /(?:opencode )?server listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(output)
          if (match) finish(undefined, match[1])
        }
        child.stdout?.on('data', onData)
        child.once('error', (error) => finish(error))
        signal.addEventListener('abort', onAbort, { once: true })
        if (signal.aborted) onAbort()
      })
      if (this.stopped) {
        child.kill()
        throw new Error('OpenCode 서버 시작이 취소되었습니다.')
      }
      const headers = {
        Authorization: `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`
      }
      const health = await this.deps.fetchImpl(`${url}/global/health`, {
        headers,
        signal,
        redirect: 'error'
      })
      if (!health.ok) throw new Error(`OpenCode 서버 상태 확인 실패 (${health.status})`)
      if (!health.headers.get('content-type')?.includes('application/json')) {
        throw new Error(
          'OpenCode CLI와 SDK의 서버 API가 호환되지 않습니다. 하네스 설정에서 SDK와 호환되는 실행 파일을 지정해 주세요.'
        )
      }
      const body = (await health.json()) as { healthy?: boolean }
      signal.throwIfAborted()
      if (body.healthy !== true) throw new Error('OpenCode 서버가 준비되지 않았습니다.')
      return { url, headers }
    } finally {
      clearTimeout(timer)
    }
  }

  close(): void {
    this.stopped = true
    this.shutdown.abort(new Error('OpenCode 서버 관리자가 종료되었습니다.'))
    for (const entry of this.entries.values()) entry.child?.kill()
    this.entries.clear()
  }
}
