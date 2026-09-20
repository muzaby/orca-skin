import type { AuthCredential, AuthDefinition, ExecutableAuthProbe } from '../../../contracts/auth'
import { createPop3Socket } from '../../../infra/net/pop3-socket'
import { createPop3Session, type Pop3Session } from './pop3/session'
import { Pop3Error, normalizePop3Error } from './pop3/errors'
import type {
  MailAuthOptions,
  MailEndpoint,
  MailEndpointInput,
  MailSessionConfig,
  Pop3SocketFactory
} from './types'

// 실행 지원과 분리된 확장 인터페이스. core에는 프로토콜/인증 방식 분기를 추가하지 않는다.
// 실행은 POP3 password 하나뿐이지만 이 형태들은 **컴파일로 붙잡혀 있다** —
// `extension-cost.test.ts` 가 실제 `AuthMethod`/`AuthDefinition` 계약에 맞춰 IMAP·XOAUTH2 를
// 조립하므로, 지우거나 드리프트하면 typecheck 가 깨진다.
export type MailCredential =
  | { mechanism: 'password' | 'app-password'; username: string; password: string }
  | { mechanism: 'xoauth2'; username: string; accessToken: string }

export interface MailConnection extends MailEndpoint {
  protocol: 'pop3' | 'imap'
}

function parseUrl(origin: string): URL {
  try {
    return new URL(origin)
  } catch {
    throw new Error('invalid mail endpoint')
  }
}

// 기본값이 적용되는 **유일한** 자리. 포트·TLS 기본을 여기 밖에서 다시 적지 않는다.
export function resolveMailEndpoint(input: MailEndpointInput): MailEndpoint {
  const tls = input.tls !== false
  return { host: input.host, port: input.port ?? (tls ? 995 : 110), tls }
}

export function mailOrigin(input: MailEndpointInput): string {
  const { host, port, tls } = resolveMailEndpoint(input)
  const authority = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
  const origin = `${tls ? 'pop3s' : 'pop3'}://${authority}:${port}`
  // `user:pw@host` 같은 입력은 bracket 안에서 IPv6 리터럴로 깨져 URL 생성 자체가 던진다.
  // 거부 자체는 맞지만 문구가 갈리면 호출자가 한 가지로 잡지 못한다 — 여기서 통일한다.
  const parsed = parseUrl(origin)
  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname ||
    parsed.search ||
    parsed.hash ||
    !parsed.hostname
  ) {
    throw new Error('invalid mail endpoint')
  }
  return origin
}

// 런타임이 좌표를 읽는 유일한 통로. `origin` 이 사본 하나이므로 대조할 상대가 없다.
export function parseMailOrigin(origin: string): MailEndpoint {
  const parsed = parseUrl(origin)
  if (
    (parsed.protocol !== 'pop3s:' && parsed.protocol !== 'pop3:') ||
    parsed.username ||
    parsed.password ||
    parsed.pathname ||
    parsed.search ||
    parsed.hash ||
    !parsed.hostname ||
    !parsed.port
  ) {
    throw new Error('invalid mail endpoint')
  }
  const hostname = parsed.hostname
  return {
    host: hostname.startsWith('[') ? hostname.slice(1, -1) : hostname,
    port: Number(parsed.port),
    tls: parsed.protocol === 'pop3s:'
  }
}

export function mailSessionConfig(
  origin: string,
  options: {
    readonly tlsOptions?: MailAuthOptions['tlsOptions']
    readonly timeouts?: MailAuthOptions['timeouts']
  }
): MailSessionConfig {
  return {
    ...parseMailOrigin(origin),
    ...(options.tlsOptions ? { tlsOptions: options.tlsOptions } : {}),
    ...(options.timeouts ? { timeouts: options.timeouts } : {})
  }
}

function passwordCredential(credential: AuthCredential): { username: string; password: string } {
  if (credential.authKind !== 'password') throw new Pop3Error('auth_failed')
  const separator = credential.value.indexOf(':')
  if (separator < 1) throw new Pop3Error('auth_failed')
  return {
    username: credential.value.slice(0, separator),
    password: credential.value.slice(separator + 1)
  }
}

// probe와 도구 실행이 같은 로그인/정리 경로를 탄다.
export async function withMailSession<T>(
  credential: AuthCredential,
  config: MailSessionConfig,
  socketFactory: Pop3SocketFactory,
  signal: AbortSignal | undefined,
  operation: (session: Pop3Session) => Promise<T>
): Promise<T> {
  const { username, password } = passwordCredential(credential)
  const session = createPop3Session(
    {
      host: config.host,
      port: config.port,
      tls: config.tls,
      tlsOptions: config.tlsOptions,
      user: username,
      password,
      signal,
      timeoutMs: config.timeouts?.commandMs ?? 30_000,
      connectTimeoutMs: config.timeouts?.connectMs ?? 15_000
    },
    socketFactory
  )
  try {
    await session.login()
    const result = await operation(session)
    await session.quit()
    return result
  } finally {
    session.destroy()
  }
}

export function mailProbe(options: MailAuthOptions): ExecutableAuthProbe {
  const config: MailSessionConfig = {
    ...resolveMailEndpoint(options),
    ...(options.tlsOptions ? { tlsOptions: options.tlsOptions } : {}),
    ...(options.timeouts ? { timeouts: options.timeouts } : {})
  }
  return {
    async execute(credential, signal) {
      try {
        await withMailSession(credential, config, createPop3Socket, signal, async () => undefined)
        return { ok: true, rejected: false }
      } catch (error) {
        // POP3 에서 자격증명 거부는 USER/PASS 의 `-ERR` 하나다. 연결·TLS·타임아웃·프로토콜
        // 실패는 서버가 이 자격증명을 판정한 적이 없으므로 복원된 grant 를 만료시키지 않는다.
        const authFailure = normalizePop3Error(error).authFailure
        return { ok: false, rejected: authFailure, preserveGrant: !authFailure }
      }
    }
  }
}

export function createMailAuth(
  id: string,
  label: string,
  options: MailAuthOptions
): AuthDefinition {
  return {
    id,
    label,
    origin: mailOrigin(options),
    methods: [
      {
        kind: 'password',
        label: '아이디 / 비밀번호',
        fields: [
          { name: 'username', label: '아이디', type: 'text', required: true },
          { name: 'password', label: '비밀번호', type: 'password', required: true }
        ],
        compose(input) {
          const username = (input.username ?? '').trim()
          const password = input.password ?? ''
          if (!username || !password || /[:\r\n]/.test(username) || /[\r\n]/.test(password)) {
            return { error: '아이디와 비밀번호를 확인해 주세요.' }
          }
          return { value: `${username}:${password}`, principalId: username }
        },
        probe: mailProbe(options)
      }
    ]
  }
}
