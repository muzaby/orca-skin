import { MailError } from '../errors'
import { selectAuthenticator, type Pop3CommandPort } from './auth'
import type { CredentialMaterial } from '../../../../contracts/auth'
import type { MailReadSession, MailReadSessionFactory } from '../transport'
import type { Pop3Socket, Pop3SocketFactory, Pop3SocketOptions } from '../types'

// **read-only 명령집합이다** (0237 D-059 — 구 `ALLOWED_COMMANDS`). 이름이 축을 담아야 write
// (SMTP)가 올 때 두 집합이 섞이지 않는다. **`DELE` 는 없다** — 서버 메일함은 읽기 전용으로
// 다루고 되돌릴 수 없는 삭제를 만들지 않는다(D-031).
//
// `AUTH` 는 SASL 메커니즘이 쓰는 로그인 명령이라 여기 있다(D-055 이음매). `CAPA` 는 메커니즘
// 협상이 부른다 — 구 집합에도 있었으나 호출부가 0건이었다.
export const READ_ONLY_COMMANDS = new Set([
  'USER',
  'PASS',
  'AUTH',
  'CAPA',
  'UIDL',
  'TOP',
  'RETR',
  'STAT',
  'QUIT'
])

export interface Pop3SessionOptions extends Pop3SocketOptions {
  readonly credential: CredentialMaterial
  readonly signal?: AbortSignal
}

export interface Pop3Session extends MailReadSession {
  readonly commands: readonly string[]
}

type StreamLike = Pop3Socket

// 수신 줄 버퍼. **완성된 줄은 큐에 쌓고 버리지 않는다** (0237 ΔV3).
//
// 구 구현은 `data` 하나에 여러 줄이 실려 오면 대기자가 없는 줄을 `waiters.shift()?.()` 로
// **조용히 버렸다.** 실 소켓은 줄이 나뉘어 도착하는 일이 잦아 드러나지 않았지만, 서버가
// multiline 응답(`CAPA`·`UIDL`·`TOP`·`RETR`)을 한 번에 보내면 첫 줄만 남고 본문이 사라진다 —
// `readMultiline` 이 첫 줄 resolve **후**(마이크로태스크)에야 대기자를 등록하기 때문이다.
interface LineState {
  buffer: string
  lines: string[]
  waiters: ((line: string) => void)[]
}

function createLineState(): LineState {
  return { buffer: '', lines: [], waiters: [] }
}

function waitForLine(stream: StreamLike, state: LineState): Promise<string> {
  const queued = state.lines.shift()
  if (queued !== undefined) return Promise.resolve(queued)
  return new Promise((resolve, reject) => {
    const onError = (error: unknown): void => reject(error)
    stream.once('error', onError)
    state.waiters.push((line) => {
      stream.removeListener('error', onError)
      resolve(line)
    })
  })
}

function attachLineParser(stream: StreamLike, state: LineState): void {
  stream.on('data', (...args: unknown[]) => {
    const chunk = args[0]
    if (typeof chunk !== 'string' && !(chunk instanceof Uint8Array)) return
    state.buffer += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    for (;;) {
      const index = state.buffer.indexOf('\r\n')
      if (index < 0) return
      const line = state.buffer.slice(0, index)
      state.buffer = state.buffer.slice(index + 2)
      const waiter = state.waiters.shift()
      // 대기자가 없으면 **큐에 쌓는다.** 버리면 multiline 본문이 통째로 사라진다.
      if (waiter) waiter(line)
      else state.lines.push(line)
    }
  })
}

async function readMultiline(stream: StreamLike, state: LineState): Promise<string[]> {
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
  const state = createLineState()
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
    if (!READ_ONLY_COMMANDS.has(name)) throw new MailError('protocol_failed')
    const { stream: socket } = ensure()
    if (options.signal?.aborted) throw new MailError('cancelled')
    const line = args ? `${name} ${args}` : name
    commands.push(name)
    socket.write(`${line}\r\n`)
    const response = await waitForLine(socket, state)
    if (!response.startsWith('+OK')) {
      // **자격증명 거부만 `auth_failed` 다** — 인증 명령이 아닌 실패는 강등을 부르지 않는다(D-045).
      const authCommand = name === 'PASS' || name === 'AUTH'
      throw authCommand ? new MailError('auth_failed') : new MailError('protocol_failed')
    }
    return multiline ? readMultiline(socket, state) : [response.slice(3).trim()]
  }

  // authenticator 에 주는 최소 표면 — 세션 전체를 넘기지 않는다.
  const commandPort: Pop3CommandPort = { send: (name, args) => command(name, args) }

  let advertised: readonly string[] | undefined

  const session: Pop3Session = {
    commands,
    async capabilities() {
      if (advertised) return advertised
      const { greeting: hello } = ensure()
      const initial = await hello
      if (!initial.startsWith('+OK')) throw new MailError('protocol_failed')
      try {
        advertised = await command('CAPA', '', true)
      } catch {
        // `CAPA` 는 RFC 2449 확장이라 광고하지 않는 서버가 있다. 그 경우 능력 없음으로 본다 —
        // `USER`/`PASS` 는 RFC 1939 필수라 광고를 요구하지 않는다.
        advertised = []
      }
      return advertised
    },
    async login() {
      const capabilities = await session.capabilities()
      // **메커니즘 선택은 여기서 한 번이고 폴백하지 않는다** (D-055). 광고되지 않은 메커니즘으로
      // 흘러가면 액세스 토큰이 평문 비밀번호로 나간다.
      const authenticator = selectAuthenticator(options.credential, capabilities)
      await authenticator.authenticate(commandPort, options.credential)
    },
    async list() {
      const lines = await command('UIDL', '', true)
      return lines.flatMap((line) => {
        const [ordinal, uid] = line.trim().split(/\s+/, 2)
        const parsed = Number(ordinal)
        return Number.isInteger(parsed) && uid ? [{ ordinal: parsed, uid }] : []
      })
    },
    async header(ref) {
      return (await command('TOP', `${ref.ordinal} 0`, true)).join('\r\n')
    },
    async body(ref) {
      return Buffer.from(
        (await command('RETR', String(ref.ordinal), true)).join('\r\n') + '\r\n',
        'utf8'
      )
    },
    async close(kind) {
      if (kind === 'abort' || !stream) {
        stream?.destroy()
        stream = undefined
        return
      }
      try {
        await command('QUIT')
      } finally {
        stream?.destroy()
        stream = undefined
      }
    }
  }
  return session
}

// `MailReadSessionFactory` 구현 — **`sync-manager` 가 아는 유일한 진입점**이다.
export const createPop3ReadSession: MailReadSessionFactory = (input) =>
  createPop3Session(
    {
      ...input.connection,
      credential: input.credential,
      ...(input.signal ? { signal: input.signal } : {})
    },
    input.socketFactory
  )
