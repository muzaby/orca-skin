import { spawn, type ChildProcess } from 'node:child_process'
import { promisify } from 'node:util'
import { exec as execCb } from 'node:child_process'
import type { ChatEvent } from '../../shared/protocol'
import type { SessionAdapter } from './types'

const exec = promisify(execCb)

const WHICH_CMD = process.platform === 'win32' ? 'where' : 'which'
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

export class ClaudeCodeAdapter implements SessionAdapter {
  readonly id = 'claude-code' as const

  async isInstalled(): Promise<{ installed: boolean; version?: string }> {
    try {
      await exec(`${WHICH_CMD} ${BIN}`)
    } catch {
      return { installed: false }
    }
    try {
      const { stdout } = await exec(`${BIN} --version`)
      const version = stdout.trim().split('\n')[0]
      return { installed: true, version }
    } catch {
      return { installed: true }
    }
  }

  async *install(): AsyncIterable<{ step: string; log?: string; error?: string; done?: boolean }> {
    yield { step: 'starting', log: 'npm install -g @anthropic-ai/claude-code' }

    const child = spawn('npm', ['install', '-g', '@anthropic-ai/claude-code'], {
      shell: false,
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
      child = spawn(BIN, args, { cwd, shell: false, env: process.env })
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
