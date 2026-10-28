import { spawn, execFile, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { allocateLoopbackPort } from '../../../infra/net/loopback-port'
import { delimiter, isAbsolute, join } from 'node:path'
import { randomBytes, randomUUID } from 'node:crypto'
import { retentionTrace } from './retention-trace'
import type { HarnessPreferences } from '../../../../shared/harness'
import { openCodeExecutableIdentity, openCodeServerProfile } from './server-profile'

export interface OpenCodeConnection {
  url: string
  headers: Record<string, string>
  release?: () => void
  retire?: () => void
}

interface ServerEntry {
  ready: Promise<OpenCodeConnection>
  child?: ChildProcess
  owners: number
  databasePath?: Promise<string>
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
      join(dir, 'node_modules', 'opencode-ai', 'bin', name)
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
  readVersion?: (executable: string) => Promise<string>
  allocatePort?: () => Promise<number>
  timeoutMs?: number
}

/** Only processes created here are owned. No attachment to an existing port/process. */
export class OpenCodeServerPool {
  private readonly entries = new Map<string, ServerEntry>()
  private readonly ownedEntries = new Set<ServerEntry>()
  private version?: { identity: string; ready: Promise<string> }
  private readonly terminated = new WeakSet<ChildProcess>()
  private readonly identities = new WeakMap<ChildProcess, string>()
  private stopped = false
  private readonly shutdown = new AbortController()

  constructor(private readonly deps: OpenCodeServerDependencies) {}

  executable(): string {
    return (
      this.deps.executable?.() ?? resolveOpenCodeExecutable(this.deps.preferences()?.executablePath)
    )
  }

  private readVersion(executable: string): Promise<string> {
    const identity = openCodeExecutableIdentity(executable)
    if (this.version?.identity === identity) return this.version.ready
    const ready = this.probeVersion(executable).catch((error) => {
      if (this.version?.ready === ready) this.version = undefined
      throw error
    })
    this.version = { identity, ready }
    return ready
  }

  private async probeVersion(executable: string): Promise<string> {
    const output = this.deps.readVersion
      ? await this.deps.readVersion(executable)
      : await new Promise<string>((resolve, reject) => {
          execFile(
            executable,
            ['--version'],
            { windowsHide: true, timeout: 15000 },
            (error, stdout) => {
              if (error) reject(error)
              else resolve(stdout)
            }
          )
        })
    return output.trim().slice(0, 100)
  }

  async installed(): Promise<{ installed: boolean; binPath?: string; version?: string }> {
    try {
      const binPath = this.executable()
      const version = await this.readVersion(binPath)
      return { installed: true, binPath, version }
    } catch {
      return { installed: false }
    }
  }

  private key(
    executable: string,
    config: Record<string, unknown>,
    env?: Record<string, string>,
    cwd?: string
  ): string {
    return openCodeServerProfile(executable, config, env, cwd).key
  }

  acquire(
    config: Record<string, unknown> = {},
    env?: Record<string, string>,
    cwd?: string
  ): Promise<OpenCodeConnection> {
    if (this.stopped) return Promise.reject(new Error('OpenCode 서버 관리자가 종료되었습니다.'))
    const executable = this.executable()
    const profile = openCodeServerProfile(executable, config, env, cwd)
    const key = profile.key
    let entry = this.entries.get(key)
    if (!entry) {
      const created: ServerEntry = { ready: Promise.resolve({ url: '', headers: {} }), owners: 0 }
      entry = created
      this.entries.set(key, created)
      this.ownedEntries.add(created)
      created.ready = this.start(executable, profile, (child) => {
        created.child = child
      }).catch((error) => {
        if (this.entries.get(key) === created) this.entries.delete(key)
        this.terminate(created.child)
        this.ownedEntries.delete(created)
        throw error
      })
    }
    const owned = entry
    owned.owners++
    return owned.ready.then((connection) => {
      let released = false
      return {
        ...connection,
        retire: () => {
          if (this.entries.get(key) === owned) this.entries.delete(key)
        },
        release: () => {
          if (released) return
          released = true
          owned.owners--
          if (owned.owners !== 0) return
          if (this.entries.get(key) === owned) this.entries.delete(key)
          this.terminate(owned.child)
          this.ownedEntries.delete(owned)
        }
      }
    })
  }

  retireAll(): void {
    this.entries.clear()
  }

  private terminate(child?: ChildProcess): void {
    if (!child || this.terminated.has(child)) return
    retentionTrace('process.terminate-request', { runtime: this.identities.get(child) })
    this.terminated.add(child)
    if (child.exitCode != null) return
    if (process.platform === 'win32' && child.pid) {
      // Only an owned child tree. Killing just Bun leaves stdio MCP children behind on Windows.
      execFile(
        join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe'),
        ['/PID', String(child.pid), '/T', '/F'],
        { windowsHide: true, timeout: 5000 },
        (error) => {
          if (error && child.exitCode == null) child.kill()
        }
      )
    } else child.kill()
  }

  private async start(
    executable: string,
    profile: ReturnType<typeof openCodeServerProfile>,
    own: (child: ChildProcess) => void
  ): Promise<OpenCodeConnection> {
    const runtime = randomUUID()
    retentionTrace('process.start-request', { runtime })
    const version = await this.readVersion(executable)
    // SDK의 /v2/client export와 제품 CLI의 major는 별개다. 실행 대상은 1.x만 지원한다.
    if (!/^(?:opencode\s+)?v?1\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(version)) {
      this.version = undefined
      throw new Error(
        'OpenCode CLI 1.x가 필요합니다. 하네스 설정에서 1.x 실행 파일을 지정해 주세요.'
      )
    }
    // 버전 조회 중 close()가 호출됐다면 서버를 만들지 않는다.
    this.shutdown.signal.throwIfAborted()
    const port = await (this.deps.allocatePort ?? allocateLoopbackPort)()
    this.shutdown.signal.throwIfAborted()
    const password = randomBytes(32).toString('base64url')
    const child = (this.deps.spawnProcess ?? spawn)(
      executable,
      ['serve', '--hostname=127.0.0.1', `--port=${port}`],
      {
        windowsHide: true,
        cwd: profile.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...profile.environment,
          OPENCODE_SERVER_USERNAME: 'opencode',
          OPENCODE_SERVER_PASSWORD: password
        }
      }
    )
    own(child)
    this.identities.set(child, runtime)
    retentionTrace('process.spawn', { runtime })
    const exited = new AbortController()
    const timeout = new AbortController()
    const timer = setTimeout(
      () => timeout.abort(new DOMException('OpenCode 서버 시작 시간 초과', 'TimeoutError')),
      this.deps.timeoutMs ?? 15000
    )
    const signal = AbortSignal.any([this.shutdown.signal, exited.signal, timeout.signal])
    child.once('exit', () => {
      retentionTrace('process.exit', { runtime })
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
          const match = /opencode server listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(output)
          if (match) finish(undefined, match[1])
        }
        child.stdout?.on('data', onData)
        child.once('error', (error) => finish(error))
        signal.addEventListener('abort', onAbort, { once: true })
        if (signal.aborted) onAbort()
      })
      if (this.stopped) {
        this.terminate(child)
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

  async databasePath(
    config: Record<string, unknown>,
    env?: Record<string, string>,
    cwd?: string
  ): Promise<string> {
    if (this.stopped) throw new Error('OpenCode 서버 관리자가 종료되었습니다.')
    const executable = this.executable()
    const entry = this.entries.get(this.key(executable, config, env, cwd))
    if (entry?.databasePath) {
      const cached = await entry.databasePath
      if (existsSync(cached)) return cached
      entry.databasePath = undefined
    }
    const ready = this.readDatabasePath(executable, config, env, cwd).catch((error) => {
      if (entry?.databasePath === ready) entry.databasePath = undefined
      throw error
    })
    if (entry) entry.databasePath = ready
    return ready
  }

  private async readDatabasePath(
    executable: string,
    config: Record<string, unknown>,
    env?: Record<string, string>,
    cwd?: string
  ): Promise<string> {
    const output = await new Promise<string>((resolveOutput, reject) => {
      const profile = openCodeServerProfile(executable, config, env, cwd)
      execFile(
        executable,
        ['db', 'path'],
        {
          windowsHide: true,
          timeout: 15000,
          cwd: profile.cwd,
          env: profile.environment
        },
        (error, stdout) => (error ? reject(error) : resolveOutput(stdout))
      )
    })
    const value = output.trim()
    if (!isAbsolute(value) || /[\r\n]/.test(value) || !existsSync(value))
      throw new Error('OpenCode 원본 저장 경로를 확인할 수 없습니다.')
    return value
  }

  close(): void {
    this.stopped = true
    this.shutdown.abort(new Error('OpenCode 서버 관리자가 종료되었습니다.'))
    for (const entry of this.ownedEntries) this.terminate(entry.child)
    this.ownedEntries.clear()
    this.entries.clear()
    this.version = undefined
  }
}
