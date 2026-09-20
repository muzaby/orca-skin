import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPop3Session, type Pop3Session, type Pop3SessionOptions } from './pop3-session'
import { normalizePop3Error } from './pop3-errors'

class Socket extends EventEmitter {
  writes: string[] = []
  destroyed = false
  reply: (command: string) => void = () => undefined
  write(chunk: string | Uint8Array): boolean {
    const command = String(chunk)
    this.writes.push(command)
    queueMicrotask(() => this.reply(command))
    return true
  }
  destroy(): void {
    this.destroyed = true
    this.emit('close')
  }
  data(value: string | Buffer): void {
    this.emit('data', typeof value === 'string' ? Buffer.from(value) : value)
  }
}

const sockets: Socket[] = []
function setup(extra: Partial<Pop3SessionOptions> = {}): { session: Pop3Session; socket: Socket } {
  const socket = new Socket()
  sockets.push(socket)
  socket.reply = (command) => {
    if (/^(USER|PASS|QUIT)\b/.test(command)) socket.data('+OK\r\n')
  }
  const session = createPop3Session(
    {
      host: 'mail.test',
      port: 995,
      tls: true,
      user: 'alice',
      password: 'secret',
      timeoutMs: 25,
      ...extra
    },
    () => {
      queueMicrotask(() => socket.data('+OK ready\r\n'))
      return socket
    }
  )
  return { session, socket }
}

afterEach(() => {
  for (const socket of sockets.splice(0)) socket.destroy()
  vi.useRealTimers()
})

describe('POP3 byte stream and lifecycle', () => {
  it('supports synchronous socket replies without a waiter race', async () => {
    const { session, socket } = setup()
    socket.write = (chunk) => {
      socket.reply(String(chunk))
      return true
    }
    await expect(session.login()).resolves.toBeUndefined()
    await session.quit()
    expect(socket.destroyed).toBe(true)
  })

  it('uses only the read-only command whitelist including CAPA', async () => {
    const { session, socket } = setup()
    await session.login()
    socket.reply = (command) => {
      if (command.startsWith('STAT')) socket.data('+OK 2 500\r\n')
      else if (command.startsWith('TOP')) socket.data('+OK\r\nDate: today\r\n.\r\n')
      else if (command.startsWith('CAPA')) socket.data('+OK\r\nUIDL\r\nTOP\r\n.\r\n')
      else if (command.startsWith('QUIT')) socket.data('+OK\r\n')
      else socket.data('+OK\r\n.\r\n')
    }
    await expect(session.capa?.()).resolves.toEqual(['UIDL', 'TOP'])
    await expect(session.stat()).resolves.toEqual({ count: 2, bytes: 500 })
    await expect(session.top(1)).resolves.toBe('Date: today')
    await expect(session.uidls()).resolves.toEqual([])
    await expect(session.retr(1)).resolves.toEqual(Buffer.alloc(0))
    await session.quit()
    expect(socket.writes).toEqual([
      'USER alice\r\n',
      'PASS secret\r\n',
      'CAPA\r\n',
      'STAT\r\n',
      'TOP 1 0\r\n',
      'UIDL\r\n',
      'RETR 1\r\n',
      'QUIT\r\n'
    ])
    expect(socket.eventNames()).toEqual([])
  })

  it('bounds the greeting without receiving any socket event', async () => {
    vi.useFakeTimers()
    const socket = new Socket()
    sockets.push(socket)
    const session = createPop3Session(
      { host: 'mail.test', user: 'a', password: 'b', connectTimeoutMs: 20 },
      () => socket
    )
    const result = expect(session.login()).rejects.toMatchObject({ code: 'timeout' })
    await vi.advanceTimersByTimeAsync(21)
    await result
    expect(socket.destroyed).toBe(true)
  })

  it('rejects an already aborted login without opening a socket', async () => {
    const controller = new AbortController()
    controller.abort()
    const factory = vi.fn(() => new Socket())
    const session = createPop3Session(
      { host: 'mail.test', user: 'a', password: 'b', signal: controller.signal },
      factory
    )
    await expect(session.login()).rejects.toMatchObject({ code: 'cancelled' })
    expect(factory).not.toHaveBeenCalled()
  })

  it('aborts a partial RETR without returning its incomplete bytes', async () => {
    const controller = new AbortController()
    const { session, socket } = setup({ signal: controller.signal })
    await session.login()
    socket.reply = () => {
      socket.data('+OK\r\npartial\r\n')
      controller.abort()
    }
    await expect(session.retr(1)).rejects.toMatchObject({ code: 'cancelled' })
    expect(socket.destroyed).toBe(true)
  })

  it('does not allow trickled bytes to reset the command deadline', async () => {
    vi.useFakeTimers()
    const { session, socket } = setup()
    await session.login()
    socket.reply = () => socket.data('+OK\r\n')
    const result = expect(session.retr(1)).rejects.toMatchObject({ code: 'timeout' })
    await vi.advanceTimersByTimeAsync(10)
    socket.data('part')
    await vi.advanceTimersByTimeAsync(10)
    socket.data('ial')
    await vi.advanceTimersByTimeAsync(6)
    await result
    expect(socket.destroyed).toBe(true)
  })

  it('does not return completed buffered data after cancellation wins', async () => {
    const controller = new AbortController()
    const { session, socket } = setup({ signal: controller.signal })
    await session.login()
    socket.reply = () => {
      socket.data('+OK 1 4\r\n')
      controller.abort()
    }
    await expect(session.stat()).rejects.toMatchObject({ code: 'cancelled' })
  })

  it('releases abort subscription and never writes after an idle socket failure', async () => {
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const { session, socket } = setup({ signal: controller.signal })
    await session.login()
    socket.emit('error', new Error('socket failure'))
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    await expect(session.stat()).rejects.toMatchObject({ code: 'connection_failed' })
    expect(socket.writes).toEqual(['USER alice\r\n', 'PASS secret\r\n'])
  })

  it('rejects status lines containing stray LF', async () => {
    const { session, socket } = setup()
    socket.reply = () => socket.data('+OK accepted\nmalformed\r\n')
    await expect(session.login()).rejects.toMatchObject({ code: 'protocol_failed' })
  })
  it('keeps every line in a coalesced UIDL response', async () => {
    const { session, socket } = setup()
    await session.login()
    socket.reply = () => socket.data('+OK list\r\n1 first\r\n2 second\r\n.\r\n')
    await expect(session.uidls()).resolves.toEqual([
      { messageNumber: 1, uidl: 'first' },
      { messageNumber: 2, uidl: 'second' }
    ])
  })

  it('preserves non-UTF8 bytes and fragmented CRLF while removing one stuffed dot', async () => {
    const { session, socket } = setup()
    await session.login()
    socket.reply = () => {
      socket.data('+OK\r')
      socket.data(Buffer.from([10, 0x80, 0xff, 13]))
      socket.data('\n..dot\r\n\r\n.\r')
      socket.data('\n')
    }
    await expect(session.retr(1)).resolves.toEqual(
      Buffer.from([0x80, 0xff, 13, 10, 46, 100, 111, 116, 13, 10, 13, 10])
    )
  })

  it.each(['USER', 'PASS'])(
    'classifies explicit %s rejection as authentication failure and closes',
    async (name) => {
      const { session, socket } = setup()
      socket.reply = (command) =>
        socket.data(command.startsWith(name) ? '-ERR private detail\r\n' : '+OK\r\n')
      await expect(session.login()).rejects.toMatchObject({
        code: 'auth_failed',
        message: 'auth_failed'
      })
      expect(socket.destroyed).toBe(true)
    }
  )

  it('does not infer authentication rejection from arbitrary error text', () => {
    expect(normalizePop3Error(new Error('PASS socket error')).authFailure).toBe(false)
  })

  it.each(['+OKAY\r\n', '-ERROR\r\n', 'garbage\r\n'])(
    'rejects malformed status %s without expiring auth',
    async (response) => {
      const { session, socket } = setup()
      socket.reply = () => socket.data(response)
      await expect(session.login()).rejects.toMatchObject({
        code: 'protocol_failed',
        authFailure: false
      })
      expect(socket.destroyed).toBe(true)
    }
  )

  it.each(['0 zero', '-1 negative', '1', '1 a extra', '1 dup\r\n2 dup', '1 a\r\n1 b'])(
    'rejects malformed/duplicate UIDL rows: %s',
    async (rows) => {
      const { session, socket } = setup()
      await session.login()
      socket.reply = () => socket.data(`+OK\r\n${rows}\r\n.\r\n`)
      await expect(session.uidls()).rejects.toMatchObject({ code: 'protocol_failed' })
    }
  )

  it.each(['one two', '-1 2', '1 -2', '1', '9007199254740992 1'])(
    'rejects malformed STAT counts: %s',
    async (row) => {
      const { session, socket } = setup()
      await session.login()
      socket.reply = () => socket.data(`+OK ${row}\r\n`)
      await expect(session.stat()).rejects.toMatchObject({ code: 'protocol_failed' })
    }
  )

  it.each(['end', 'close', 'error', 'timeout'])(
    'settles a pending multiline command after %s',
    async (event) => {
      const { session, socket } = setup()
      await session.login()
      socket.reply = () => {
        socket.data('+OK\r\npartial\r\n')
        queueMicrotask(() => socket.emit(event, new Error('socket failure')))
      }
      await expect(session.retr(1)).rejects.toMatchObject({
        code: event === 'timeout' ? 'timeout' : 'connection_failed'
      })
      expect(socket.destroyed).toBe(true)
    }
  )

  it('aborts a pending greeting and destroys the socket', async () => {
    const controller = new AbortController()
    const socket = new Socket()
    sockets.push(socket)
    const session = createPop3Session(
      {
        host: 'mail.test',
        port: 995,
        tls: true,
        user: 'a',
        password: 'b',
        signal: controller.signal
      },
      () => socket
    )
    const login = session.login()
    controller.abort()
    await expect(login).rejects.toMatchObject({ code: 'cancelled' })
    expect(socket.destroyed).toBe(true)
  })

  it.each(['USER', 'PASS', 'RETR', 'QUIT'])(
    'bounds a silent %s response and destroys the socket',
    async (name) => {
      vi.useFakeTimers()
      const { session, socket } = setup()
      socket.reply = (command) => {
        if (!command.startsWith(name)) socket.data('+OK\r\n')
      }
      let pending: Promise<unknown>
      if (name === 'USER' || name === 'PASS') pending = session.login()
      else {
        await session.login()
        pending = name === 'QUIT' ? session.quit() : session.retr(1)
      }
      const assertion = expect(pending).rejects.toMatchObject({ code: 'timeout' })
      await vi.advanceTimersByTimeAsync(30)
      await assertion
      expect(socket.destroyed).toBe(true)
    }
  )

  it.each([{ user: 'a\r\nDELE 1' }, { password: 'b\nDELE 1' }])(
    'rejects credential command injection before opening a socket',
    async (extra) => {
      const factory = vi.fn(() => new Socket())
      const session = createPop3Session(
        { host: 'mail.test', port: 995, tls: true, user: 'a', password: 'b', ...extra },
        factory
      )
      await expect(session.login()).rejects.toMatchObject({ code: 'protocol_failed' })
      expect(factory).not.toHaveBeenCalled()
    }
  )

  it('rejects an invalid message number without writing another command', async () => {
    const { session, socket } = setup()
    await session.login()
    await expect(session.retr(Number.NaN)).rejects.toMatchObject({ code: 'protocol_failed' })
    expect(socket.writes).toEqual(['USER alice\r\n', 'PASS secret\r\n'])
  })
})
