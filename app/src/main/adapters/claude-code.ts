import { spawn, type ChildProcess } from 'node:child_process'
import { promisify } from 'node:util'
import { exec as execCb } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ChatEvent } from '../../shared/ipc'
import type { SessionAdapter } from './types'

const exec = promisify(execCb)

const IS_WIN = process.platform === 'win32'
const BIN = 'claude'

const AUTH_EXPIRED_PATTERNS = [/\b401\b/i, /\bunauthori[sz]ed\b/i, /\bOAuth\b/i, /\bexpired\b/i]

function looksLikeAuthExpired(s: string): boolean {
  return AUTH_EXPIRED_PATTERNS.some((re) => re.test(s))
}

// 라인 버퍼 — chunk 경계가 임의이므로 \n 만나면 emit
function* drainLines(buf: { acc: string }, chunk: string, flush = false): Iterable<string> {
  buf.acc += chunk
  let idx: number
  while ((idx = buf.acc.indexOf('\n')) >= 0) {
    const line = buf.acc.slice(0, idx)
    buf.acc = buf.acc.slice(idx + 1)
    if (line.trim() !== '') yield line
  }
  if (flush && buf.acc.trim() !== '') {
    yield buf.acc
    buf.acc = ''
  }
}

// claude-code stream-json NDJSON 라인 → ChatEvent 들
// 외부 스키마는 변할 수 있으니 best-effort 매핑하고 모르는 이벤트는 무시
export function normalizeLine(line: string): ChatEvent[] {
  let obj: unknown
  try {
    obj = JSON.parse(line)
  } catch {
    return []
  }
  if (typeof obj !== 'object' || obj === null) return []
  const o = obj as Record<string, unknown>
  const type = typeof o.type === 'string' ? o.type : ''
  const subtype = typeof o.subtype === 'string' ? o.subtype : ''

  // system/init
  if (type === 'system' && (subtype === 'init' || subtype === '')) {
    const sessionId = typeof o.session_id === 'string' ? o.session_id : undefined
    if (sessionId) {
      const model = typeof o.model === 'string' ? o.model : undefined
      const cwd = typeof o.cwd === 'string' ? o.cwd : ''
      return [{ type: 'init', data: { sessionId, model, cwd } }]
    }
    return []
  }

  // system/api_retry → 표시는 future. Phase 1 은 무시.
  if (type === 'system' && subtype === 'api_retry') return []
  if (type === 'system' && subtype === 'plugin_install') return []

  // stream_event (text_delta)
  if (type === 'stream_event') {
    const ev = o.event as Record<string, unknown> | undefined
    const delta = ev?.delta as Record<string, unknown> | undefined
    if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
      return [{ type: 'assistant_delta', data: { text: delta.text } }]
    }
    return []
  }

  // assistant 완성 메시지 (tool_use 포함 가능)
  if (type === 'assistant') {
    const msg = o.message as Record<string, unknown> | undefined
    const content = (msg?.content as unknown[]) ?? []
    const events: ChatEvent[] = []
    let assembled = ''
    for (const part of content) {
      if (typeof part !== 'object' || part === null) continue
      const p = part as Record<string, unknown>
      if (p.type === 'text' && typeof p.text === 'string') {
        assembled += p.text
      } else if (p.type === 'tool_use') {
        const toolUseId = typeof p.id === 'string' ? p.id : ''
        const name = typeof p.name === 'string' ? p.name : ''
        if (toolUseId && name) {
          events.push({
            type: 'tool_use',
            data: { toolUseId, name, input: p.input }
          })
        }
      }
    }
    if (assembled !== '') {
      events.push({ type: 'assistant_message', data: { text: assembled } })
    }
    return events
  }

  // user (tool_result)
  if (type === 'user') {
    const msg = o.message as Record<string, unknown> | undefined
    const content = (msg?.content as unknown[]) ?? []
    const events: ChatEvent[] = []
    for (const part of content) {
      if (typeof part !== 'object' || part === null) continue
      const p = part as Record<string, unknown>
      if (p.type === 'tool_result') {
        const toolUseId = typeof p.tool_use_id === 'string' ? p.tool_use_id : ''
        if (!toolUseId) continue
        events.push({
          type: 'tool_result',
          data: {
            toolUseId,
            output: p.content,
            isError: p.is_error === true
          }
        })
      }
    }
    return events
  }

  // result — 턴 종료
  if (type === 'result') {
    const usage = o.usage as Record<string, unknown> | undefined
    const inputTokens = typeof usage?.input_tokens === 'number' ? usage.input_tokens : undefined
    const outputTokens = typeof usage?.output_tokens === 'number' ? usage.output_tokens : undefined
    return [
      {
        type: 'result',
        data:
          inputTokens != null && outputTokens != null
            ? { usage: { inputTokens, outputTokens } }
            : {}
      }
    ]
  }

  return []
}

// Windows 에서는 npm 글로벌의 `claude.cmd` shim 을 거치면 cmd 의 인자 파싱이
// 멀티라인 텍스트의 `\n` 이후를 truncate 시킨다. 항상 native `claude.exe` 절대경로로
// spawn 하면 execve 가 argv 를 그대로 전달해 인용/이스케이프 문제가 사라진다.
// POSIX 는 `which claude` 결과를 그대로 사용 (셸 스크립트라도 shebang 으로 직행).
async function findFileRecursive(root: string, name: string): Promise<string | undefined> {
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(root, { withFileTypes: true })
  } catch {
    return undefined
  }
  for (const e of entries) {
    const full = path.join(root, e.name)
    if (e.isFile() && e.name === name) return full
    if (e.isDirectory()) {
      const found = await findFileRecursive(full, name)
      if (found) return found
    }
  }
  return undefined
}

async function resolveBinPath(): Promise<string | undefined> {
  if (IS_WIN) {
    try {
      const { stdout } = await exec('npm prefix -g')
      const prefix = stdout.trim()
      if (!prefix) return undefined
      const pkgDir = path.join(prefix, 'node_modules', '@anthropic-ai', 'claude-code')
      return await findFileRecursive(pkgDir, 'claude.exe')
    } catch {
      return undefined
    }
  }
  try {
    const { stdout } = await exec('which claude')
    return stdout.trim().split('\n')[0] || undefined
  } catch {
    return undefined
  }
}

// sendMessage 의 spawn 옵션. binPath 는 항상 실파일이므로 shell:false 안전.
// stdin 을 명시적으로 끊는다 (Claude CLI 가 non-TTY 환경에서 stdin 을 기다리지 않도록).
function spawnOpts(cwd?: string): {
  cwd?: string
  shell: false
  env: NodeJS.ProcessEnv
  stdio: ['ignore', 'pipe', 'pipe']
} {
  return {
    ...(cwd ? { cwd } : {}),
    shell: false,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  }
}

export class ClaudeCodeAdapter implements SessionAdapter {
  readonly id = 'claude-code' as const
  private binPath: string | undefined

  async isInstalled(): Promise<{ installed: boolean; version?: string; binPath?: string }> {
    const resolved = await resolveBinPath()
    if (!resolved) return { installed: false }
    this.binPath = resolved
    try {
      const { stdout } = await exec(`"${resolved}" --version`)
      const version = stdout.trim().split('\n')[0]
      return { installed: true, version, binPath: resolved }
    } catch {
      return { installed: true, binPath: resolved }
    }
  }

  async *install(): AsyncIterable<{ step: string; log?: string; error?: string; done?: boolean }> {
    yield { step: 'starting', log: 'npm install -g @anthropic-ai/claude-code' }

    // npm 은 Windows 에서 .cmd shim 이므로 spawn 에 shell:true 가 필요하다.
    // sendMessage 와 달리 args 가 정적이고 special chars 가 없어 안전.
    const child = spawn('npm', ['install', '-g', '@anthropic-ai/claude-code'], {
      shell: IS_WIN,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env
    })

    const queue: { step: string; log?: string; error?: string }[] = []
    let resolveNext: (() => void) | null = null
    const wake = (): void => {
      if (resolveNext) {
        const r = resolveNext
        resolveNext = null
        r()
      }
    }
    const push = (item: (typeof queue)[number]): void => {
      queue.push(item)
      wake()
    }

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => push({ step: 'progress', log: chunk }))
    child.stderr.on('data', (chunk: string) => push({ step: 'progress', log: chunk }))

    let exited = false
    let exitErr: string | undefined
    child.on('error', (err) => {
      exited = true
      exitErr = err.message
      wake()
    })
    child.on('close', (code) => {
      exited = true
      if (code !== 0) exitErr = `npm exited with code ${code}`
      wake()
    })

    while (!exited || queue.length > 0) {
      if (queue.length > 0) {
        yield queue.shift()!
        continue
      }
      await new Promise<void>((r) => (resolveNext = r))
    }

    if (exitErr) {
      yield { step: 'failed', error: exitErr, done: true }
    } else {
      yield { step: 'complete', done: true }
    }
  }

  async *sendMessage(
    sessionId: string | null,
    text: string,
    cwd: string,
    signal?: AbortSignal
  ): AsyncIterable<ChatEvent> {
    const args = [
      '-p',
      text,
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages'
    ]
    if (sessionId) args.push('--resume', sessionId)

    let child: ChildProcess
    try {
      child = spawn(this.binPath ?? BIN, args, spawnOpts(cwd))
    } catch (err) {
      yield {
        type: 'error',
        data: {
          code: 'cli.spawn-failed',
          message: err instanceof Error ? err.message : String(err),
          recoverable: true
        }
      }
      return
    }

    const onAbort = (): void => {
      if (!child.killed) child.kill('SIGTERM')
    }
    signal?.addEventListener('abort', onAbort)

    const stdoutBuf = { acc: '' }
    const stderrBuf = { acc: '' }
    const queue: ChatEvent[] = []
    let resolveNext: (() => void) | null = null
    const wake = (): void => {
      if (resolveNext) {
        const r = resolveNext
        resolveNext = null
        r()
      }
    }
    const enqueue = (ev: ChatEvent): void => {
      queue.push(ev)
      wake()
    }

    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')

    child.stdout?.on('data', (chunk: string) => {
      for (const line of drainLines(stdoutBuf, chunk)) {
        for (const ev of normalizeLine(line)) enqueue(ev)
      }
    })

    child.stderr?.on('data', (chunk: string) => {
      for (const line of drainLines(stderrBuf, chunk)) {
        if (looksLikeAuthExpired(line)) {
          enqueue({
            type: 'error',
            data: {
              code: 'auth.expired',
              message: 'Claude Code 인증이 만료되었습니다.',
              recoverable: true
            }
          })
        }
      }
    })

    let exited = false
    let exitErr: ChatEvent | null = null
    child.on('error', (err) => {
      exited = true
      exitErr = {
        type: 'error',
        data: {
          code: 'cli.spawn-failed',
          message: err.message,
          recoverable: true
        }
      }
      wake()
    })
    child.on('close', (code) => {
      // flush any trailing line
      for (const line of drainLines(stdoutBuf, '', true)) {
        for (const ev of normalizeLine(line)) enqueue(ev)
      }
      for (const line of drainLines(stderrBuf, '', true)) {
        if (looksLikeAuthExpired(line)) {
          enqueue({
            type: 'error',
            data: {
              code: 'auth.expired',
              message: 'Claude Code 인증이 만료되었습니다.',
              recoverable: true
            }
          })
        }
      }
      exited = true
      if (code !== 0 && code !== null) {
        exitErr = {
          type: 'error',
          data: {
            code: 'cli.crashed',
            message: `claude exited with code ${code}`,
            recoverable: true
          }
        }
      }
      wake()
    })

    try {
      while (!exited || queue.length > 0) {
        if (queue.length > 0) {
          yield queue.shift()!
          continue
        }
        await new Promise<void>((r) => (resolveNext = r))
      }
      if (exitErr) yield exitErr
    } finally {
      signal?.removeEventListener('abort', onAbort)
      if (!child.killed) child.kill('SIGTERM')
    }
  }
}
