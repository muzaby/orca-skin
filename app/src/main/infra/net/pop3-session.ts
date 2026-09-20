import { Pop3Error, normalizePop3Error } from './pop3-errors'
import type { Pop3Socket, Pop3SocketFactory, Pop3SocketOptions } from './pop3-socket'

const ALLOWED_COMMANDS = new Set(['USER', 'PASS', 'UIDL', 'TOP', 'RETR', 'STAT', 'CAPA', 'QUIT'])
const CRLF = Buffer.from('\r\n')

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
  capa?(): Promise<readonly string[]>
  quit(): Promise<void>
  destroy(): void
  readonly commands: readonly string[]
}

/** One reader owns all socket events; complete lines survive gaps between awaiters. */
class LineReader {
  private buffer: Buffer = Buffer.alloc(0)
  private waiter?: { resolve: (line: Buffer) => void; reject: (error: Pop3Error) => void }
  private failure?: Pop3Error

  constructor(
    private readonly socket: Pop3Socket,
    private readonly onFailure: () => void
  ) {
    socket.on('data', this.onData)
    socket.on('error', this.onError)
    socket.on('end', this.onEnd)
    socket.on('close', this.onClose)
    socket.on('timeout', this.onTimeout)
  }

  private readonly onData = (...args: unknown[]): void => {
    if (this.failure) return
    const chunk = args[0]
    // Decoded socket streams cannot preserve MIME bytes and are not supported.
    if (!(chunk instanceof Uint8Array)) {
      this.fail(new Pop3Error('protocol_failed'))
      return
    }
    this.buffer = Buffer.concat([this.buffer, chunk])
    this.drain()
  }

  private readonly onError = (...args: unknown[]): void => {
    const error = normalizePop3Error(args[0])
    this.fail(
      new Pop3Error(
        error.code === 'tls_failed' || error.code === 'timeout' ? error.code : 'connection_failed'
      )
    )
  }
  private readonly onEnd = (): void => this.fail(new Pop3Error('connection_failed'), false)
  private readonly onTimeout = (): void => this.fail(new Pop3Error('timeout'))
  private readonly onClose = (): void => {
    this.fail(new Pop3Error('connection_failed'), false)
    this.socket.removeListener('error', this.onError)
    this.socket.removeListener('close', this.onClose)
  }

  fail(error: Pop3Error, discard = true): void {
    if (this.failure) return
    this.failure = error
    this.onFailure()
    if (discard) this.buffer = Buffer.alloc(0)
    this.drain()
    this.socket.removeListener('data', this.onData)
    this.socket.removeListener('end', this.onEnd)
    this.socket.removeListener('timeout', this.onTimeout)
    // Keep the error sink until close: destroy may still deliver a queued error.
    this.socket.destroy()
  }

  get error(): Pop3Error | undefined {
    return this.failure
  }

  private drain(): void {
    if (!this.waiter) return
    const index = this.buffer.indexOf(CRLF)
    if (index >= 0) {
      const line = this.buffer.subarray(0, index)
      this.buffer = this.buffer.subarray(index + 2)
      const waiter = this.waiter
      this.waiter = undefined
      waiter.resolve(line)
    } else if (this.failure) {
      const waiter = this.waiter
      this.waiter = undefined
      waiter.reject(this.failure)
    }
  }

  read(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this.waiter = { resolve, reject }
      this.drain()
    })
  }
}

function validateArgument(value: string): void {
  if (/[\r\n\0]/.test(value)) throw new Pop3Error('protocol_failed')
}

function positiveInteger(value: number): string {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Pop3Error('protocol_failed')
  return String(value)
}

function status(line: Buffer, name?: string): string {
  const response = line.toString('latin1')
  if (/[\r\n\0]/.test(response)) throw new Pop3Error('protocol_failed')
  if (/^-ERR(?: |$)/.test(response)) {
    throw new Pop3Error(name === 'USER' || name === 'PASS' ? 'auth_failed' : 'protocol_failed')
  }
  if (!/^\+OK(?: |$)/.test(response)) throw new Pop3Error('protocol_failed')
  return response.slice(3).trim()
}

export function createPop3Session(
  options: Pop3SessionOptions,
  socketFactory: Pop3SocketFactory
): Pop3Session {
  let socket: Pop3Socket | undefined
  let reader: LineReader | undefined
  let terminal: Pop3Error | undefined
  let authenticated = false
  let busy = false
  const commands: string[] = []
  const commandMs = options.timeoutMs ?? 30_000
  const loginMs = options.connectTimeoutMs ?? 15_000

  const terminate = (error: Pop3Error): void => {
    terminal ??= error
    options.signal?.removeEventListener('abort', abort)
    reader?.fail(error)
  }
  const abort = (): void => terminate(new Pop3Error('cancelled'))
  const check = (): void => {
    if (options.signal?.aborted) throw new Pop3Error('cancelled')
    if (terminal) throw terminal
  }
  const run = async <T>(timeout: number, action: () => Promise<T>): Promise<T> => {
    check()
    if (reader?.error) throw reader.error
    if (busy) throw new Pop3Error('protocol_failed')
    if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 2_147_483_647) {
      throw new Pop3Error('protocol_failed')
    }
    busy = true
    const timer = setTimeout(() => terminate(new Pop3Error('timeout')), timeout)
    try {
      const result = await action()
      check()
      return result
    } catch (error) {
      const normalized = normalizePop3Error(error)
      terminate(normalized)
      throw normalized
    } finally {
      clearTimeout(timer)
      busy = false
    }
  }

  const exchange = async (name: string, args: string, multiline: boolean): Promise<Buffer[]> => {
    check()
    if (!socket || !reader || !ALLOWED_COMMANDS.has(name)) throw new Pop3Error('protocol_failed')
    if (reader.error) throw reader.error
    validateArgument(args)
    commands.push(name)
    socket.write(`${name}${args ? ` ${args}` : ''}\r\n`)
    const response = status(await reader.read(), name)
    if (!multiline) return [Buffer.from(response, 'latin1')]
    const lines: Buffer[] = []
    for (;;) {
      const line = await reader.read()
      if (line.length === 1 && line[0] === 46) return lines
      if (line[0] === 46) {
        if (line[1] !== 46) throw new Pop3Error('protocol_failed')
        lines.push(line.subarray(1))
      } else lines.push(line)
    }
  }

  const command = async (name: string, args = '', multiline = false): Promise<Buffer[]> => {
    if (!Number.isFinite(commandMs) || commandMs <= 0 || commandMs > 2_147_483_647) {
      throw new Pop3Error('protocol_failed')
    }
    const timer = setTimeout(() => terminate(new Pop3Error('timeout')), commandMs)
    try {
      return await exchange(name, args, multiline)
    } finally {
      clearTimeout(timer)
    }
  }

  const transaction = <T>(action: () => Promise<T>): Promise<T> =>
    run(commandMs, async () => {
      if (!authenticated) throw new Pop3Error('protocol_failed')
      return action()
    })

  return {
    commands,
    login: () =>
      run(loginMs, async () => {
        if (socket) throw new Pop3Error('protocol_failed')
        validateArgument(options.user)
        validateArgument(options.password)
        socket = socketFactory(options)
        reader = new LineReader(socket, () => options.signal?.removeEventListener('abort', abort))
        options.signal?.addEventListener('abort', abort, { once: true })
        check()
        status(await reader.read())
        await command('USER', options.user)
        await command('PASS', options.password)
        authenticated = true
      }),
    uidls: () =>
      transaction(async () => {
        const numbers = new Set<number>()
        const identifiers = new Set<string>()
        return (await command('UIDL', '', true)).map((line) => {
          const match = /^([1-9]\d*) ([\x21-\x7e]{1,70})$/.exec(line.toString('latin1'))
          if (!match) throw new Pop3Error('protocol_failed')
          const messageNumber = Number(match[1])
          const uidl = match[2]
          positiveInteger(messageNumber)
          if (numbers.has(messageNumber) || identifiers.has(uidl))
            throw new Pop3Error('protocol_failed')
          numbers.add(messageNumber)
          identifiers.add(uidl)
          return { messageNumber, uidl }
        })
      }),
    top: (number) =>
      transaction(async () =>
        (await command('TOP', `${positiveInteger(number)} 0`, true))
          .map((line) => line.toString('latin1'))
          .join('\r\n')
      ),
    retr: (number) =>
      transaction(async () =>
        Buffer.concat(
          (await command('RETR', positiveInteger(number), true)).flatMap((line) => [line, CRLF])
        )
      ),
    stat: () =>
      transaction(async () => {
        const [line] = await command('STAT')
        const match = /^(\d+) (\d+)(?: .*)?$/.exec(line.toString('latin1'))
        if (!match) throw new Pop3Error('protocol_failed')
        const count = Number(match[1])
        const bytes = Number(match[2])
        if (!Number.isSafeInteger(count) || !Number.isSafeInteger(bytes))
          throw new Pop3Error('protocol_failed')
        return { count, bytes }
      }),
    capa: () =>
      transaction(async () =>
        (await command('CAPA', '', true)).map((line) => line.toString('latin1'))
      ),
    async quit() {
      if (!socket || terminal) return
      try {
        await run(commandMs, async () => {
          await command('QUIT')
        })
      } finally {
        terminate(new Pop3Error('connection_failed'))
      }
    },
    destroy: () =>
      terminate(new Pop3Error(options.signal?.aborted ? 'cancelled' : 'connection_failed'))
  }
}
