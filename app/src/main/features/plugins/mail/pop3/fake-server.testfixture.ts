// 메모리 fake POP3 서버 (0237 ΔV3).
//
// **수신한 명령 줄을 그대로 기록한다** — 그것이 G4 를 잡는 판별자다. "로그인이 성공했다" 는
// 합성 문자열을 보내도 서버가 받아 주면 참이 되지만, `PASS alice@corp:pw` 와 `PASS pw` 는
// 수신 로그에서 다르다. 인자까지 남기는 이유가 그것이다.

import type { Pop3Socket, Pop3SocketOptions } from '../../../../infra/net/pop3-socket'

export interface FakeMailbox {
  readonly uid: string
  readonly headers: string
  readonly body: string
}

export interface FakePop3Options {
  readonly user: string
  readonly password: string
  /** 광고할 CAPA 줄. 미지정이면 `UIDL`·`TOP` 만 광고한다(SASL 없음). */
  readonly capabilities?: readonly string[]
  readonly mailboxes?: readonly FakeMailbox[]
  /** 연결 자체를 거부한다 — 도달 실패 축(AC29′). */
  readonly unreachable?: boolean
}

export interface FakePop3Server {
  readonly factory: (options: Pop3SocketOptions) => Pop3Socket
  /** 수신한 명령 줄 전체(`PASS hunter2` 처럼 **인자 포함**). */
  readonly received: readonly string[]
  /** 명령 이름만. allowlist 단언용. */
  readonly commands: readonly string[]
}

type Listener = (...args: unknown[]) => void

export function createFakePop3Server(options: FakePop3Options): FakePop3Server {
  const received: string[] = []
  const commands: string[] = []
  const mailboxes = options.mailboxes ?? []

  const factory = (): Pop3Socket => {
    const listeners = new Map<string, Listener[]>()
    let authenticatedUser: string | undefined
    let destroyed = false

    const emit = (event: string, ...args: unknown[]): void => {
      for (const listener of [...(listeners.get(event) ?? [])]) listener(...args)
    }
    const send = (text: string): void => queueMicrotask(() => emit('data', text))

    const socket: Pop3Socket = {
      on(event, listener) {
        listeners.set(event, [...(listeners.get(event) ?? []), listener])
        return this
      },
      once(event, listener) {
        const wrapped: Listener = (...args) => {
          socket.removeListener(event, wrapped)
          listener(...args)
        }
        return socket.on(event, wrapped)
      },
      removeListener(event, listener) {
        listeners.set(
          event,
          (listeners.get(event) ?? []).filter((item) => item !== listener)
        )
        return this
      },
      write(chunk) {
        if (destroyed) return false
        const line = (
          typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
        ).replace(/\r\n$/, '')
        received.push(line)
        const [name, ...rest] = line.split(' ')
        commands.push(name)
        const arg = rest.join(' ')
        handle(name, arg)
        return true
      },
      destroy() {
        destroyed = true
      }
    }

    const handle = (name: string, arg: string): void => {
      switch (name) {
        case 'CAPA': {
          const lines = options.capabilities ?? ['UIDL', 'TOP']
          send(`+OK capability list follows\r\n${lines.join('\r\n')}\r\n.\r\n`)
          return
        }
        case 'USER':
          authenticatedUser = arg
          send('+OK user accepted\r\n')
          return
        case 'PASS':
          // **정확히 일치해야 한다** — 합성 문자열(`user:pass`)이 오면 거부된다.
          if (authenticatedUser === options.user && arg === options.password) {
            send('+OK mailbox ready\r\n')
          } else {
            send('-ERR invalid credentials\r\n')
          }
          return
        case 'UIDL':
          send(
            `+OK\r\n${mailboxes.map((box, index) => `${index + 1} ${box.uid}`).join('\r\n')}${mailboxes.length ? '\r\n' : ''}.\r\n`
          )
          return
        case 'TOP': {
          const box = mailboxes[Number(arg.split(' ')[0]) - 1]
          send(box ? `+OK\r\n${box.headers}\r\n.\r\n` : '-ERR no such message\r\n')
          return
        }
        case 'RETR': {
          const box = mailboxes[Number(arg) - 1]
          send(
            box ? `+OK\r\n${box.headers}\r\n\r\n${box.body}\r\n.\r\n` : '-ERR no such message\r\n'
          )
          return
        }
        case 'STAT':
          send(`+OK ${mailboxes.length} 0\r\n`)
          return
        case 'QUIT':
          send('+OK bye\r\n')
          return
        default:
          send('-ERR unknown command\r\n')
      }
    }

    if (options.unreachable) {
      queueMicrotask(() => emit('error', new Error('connect ECONNREFUSED 127.0.0.1:995')))
    } else {
      send('+OK fake POP3 ready\r\n')
    }
    return socket
  }

  return { factory, received, commands }
}
