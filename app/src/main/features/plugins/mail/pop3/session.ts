import { Pop3Error } from './errors'
import type { Pop3Socket, Pop3SocketFactory, Pop3SocketOptions } from '../types'

const ALLOWED_COMMANDS = new Set(['USER', 'PASS', 'UIDL', 'TOP', 'RETR', 'STAT', 'CAPA', 'QUIT'])

export interface Pop3SessionOptions extends Pop3SocketOptions {
  readonly user: string
  readonly password: string
  readonly signal?: AbortSignal
}

export interface Pop3Session {
  login(): Promise<void>
  uidls(): Promise<readonly { messageNumber: number; uidl: string }[]>
  top(messageNumber: number): Promise<string>
  retr(messageNumber: number): Promise<Uint8Array>
  stat(): Promise<{ count: number; bytes: number }>
  quit(): Promise<void>
  destroy(): void
  readonly commands: readonly string[]
}

type StreamLike = Pop3Socket

function waitForLine(
  stream: StreamLike,
  state: { buffer: string; waiters: ((line: string) => void)[] }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const onError = (error: unknown): void => reject(error)
    stream.once('error', onError)
    const existing = state.buffer.indexOf('\r\n')
    if (existing >= 0) {
      const line = state.buffer.slice(0, existing)
      state.buffer = state.buffer.slice(existing + 2)
      stream.removeListener('error', onError)
      resolve(line)
      return
    }
    state.waiters.push((line) => {
      stream.removeListener('error', onError)
      resolve(line)
    })
  })
}

function attachLineParser(
  stream: StreamLike,
  state: { buffer: string; waiters: ((line: string) => void)[] }
): void {
  stream.on('data', (...args: unknown[]) => {
    const chunk = args[0]
    if (typeof chunk !== 'string' && !(chunk instanceof Uint8Array)) return
    state.buffer += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    for (;;) {
      const index = state.buffer.indexOf('\r\n')
      if (index < 0) return
      const line = state.buffer.slice(0, index)
      state.buffer = state.buffer.slice(index + 2)
      state.waiters.shift()?.(line)
    }
  })
}

async function readMultiline(
  stream: StreamLike,
  state: { buffer: string; waiters: ((line: string) => void)[] }
): Promise<string[]> {
  const lines: string[] = []
  for (;;) {
    const line = await waitForLine(stream, state)
    if (line === '.') return lines
    lines.push(line.startsWith('..') ? line.slice(1) : line)
  }
}

export function createPop3Session(
  options: Pop3SessionOptions,
  socketFactory: Pop3SocketFactory
): Pop3Session {
  let stream: StreamLike | undefined
  const state = { buffer: '', waiters: [] as ((line: string) => void)[] }
  let greeting: Promise<string> | undefined
  const commands: string[] = []

  const ensure = (): { stream: StreamLike; greeting: Promise<string> } => {
    if (!stream) {
      stream = socketFactory(options)
      attachLineParser(stream, state)
      greeting = waitForLine(stream, state)
    }
    return { stream, greeting: greeting as Promise<string> }
  }

  const command = async (name: string, args = '', multiline = false): Promise<string[]> => {
    if (!ALLOWED_COMMANDS.has(name)) throw new Pop3Error('protocol_failed')
    const { stream: socket } = ensure()
    if (options.signal?.aborted) throw new Pop3Error('cancelled')
    const line = args ? `${name} ${args}` : name
    commands.push(name)
    socket.write(`${line}\r\n`)
    const response = await waitForLine(socket, state)
    if (!response.startsWith('+OK')) {
      throw name === 'PASS' ? new Pop3Error('auth_failed') : new Pop3Error('protocol_failed')
    }
    return multiline ? readMultiline(socket, state) : [response.slice(3).trim()]
  }

  return {
    commands,
    async login() {
      const { greeting: hello } = ensure()
      const initial = await hello
      if (!initial.startsWith('+OK')) throw new Pop3Error('protocol_failed')
      await command('USER', options.user)
      await command('PASS', options.password)
    },
    async uidls() {
      const lines = await command('UIDL', '', true)
      return lines.flatMap((line) => {
        const [messageNumber, uidl] = line.trim().split(/\s+/, 2)
        const parsed = Number(messageNumber)
        return Number.isInteger(parsed) && uidl ? [{ messageNumber: parsed, uidl }] : []
      })
    },
    async top(messageNumber) {
      return (await command('TOP', `${messageNumber} 0`, true)).join('\r\n')
    },
    async retr(messageNumber) {
      return Buffer.from(
        (await command('RETR', String(messageNumber), true)).join('\r\n') + '\r\n',
        'utf8'
      )
    },
    async stat() {
      const [line] = await command('STAT')
      const [count, bytes] = line.split(/\s+/, 2).map(Number)
      return {
        count: Number.isFinite(count) ? count : 0,
        bytes: Number.isFinite(bytes) ? bytes : 0
      }
    },
    async quit() {
      if (!stream) return
      try {
        await command('QUIT')
      } finally {
        stream.destroy()
        stream = undefined
      }
    },
    destroy() {
      stream?.destroy()
      stream = undefined
    }
  }
}
