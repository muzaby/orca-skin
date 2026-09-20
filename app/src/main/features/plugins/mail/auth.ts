import type { AuthCredential, AuthDefinition, ExecutableAuthProbe } from '../../../contracts/auth'
import { createPop3Socket } from '../../../infra/net/pop3-socket'
import { createPop3Session, type Pop3Session } from './pop3/session'
import { Pop3Error, normalizePop3Error } from './pop3/errors'
import type { MailPluginOptions, Pop3SocketFactory } from './types'

// 실행 지원과 분리된 확장 인터페이스. core에는 프로토콜/인증 방식 분기를 추가하지 않는다.
export type MailCredential =
  | { mechanism: 'password' | 'app-password'; username: string; password: string }
  | { mechanism: 'xoauth2'; username: string; accessToken: string }

export interface MailConnection {
  protocol: 'pop3' | 'imap'
  host: string
  port: number
  tls: boolean
}

export function mailOrigin(options: Pick<MailPluginOptions, 'host' | 'port' | 'tls'>): string {
  const host =
    options.host.includes(':') && !options.host.startsWith('[') ? `[${options.host}]` : options.host
  const origin = `${options.tls === false ? 'pop3' : 'pop3s'}://${host}:${options.port ?? (options.tls === false ? 110 : 995)}`
  const parsed = new URL(origin)
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
  options: MailPluginOptions,
  socketFactory: Pop3SocketFactory,
  signal: AbortSignal | undefined,
  operation: (session: Pop3Session) => Promise<T>
): Promise<T> {
  const { username, password } = passwordCredential(credential)
  const session = createPop3Session(
    {
      host: options.host,
      port: options.port ?? (options.tls === false ? 110 : 995),
      tls: options.tls !== false,
      tlsOptions: options.tlsOptions,
      user: username,
      password,
      signal,
      timeoutMs: options.timeouts?.commandMs ?? 30_000,
      connectTimeoutMs: options.timeouts?.connectMs ?? 15_000
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

export function mailProbe(options: MailPluginOptions): ExecutableAuthProbe {
  return {
    async execute(credential, signal) {
      try {
        await withMailSession(credential, options, createPop3Socket, signal, async () => undefined)
        return { ok: true, rejected: false }
      } catch (error) {
        return { ok: false, rejected: normalizePop3Error(error).authFailure }
      }
    }
  }
}

export function createMailAuth(
  id: string,
  label: string,
  options: MailPluginOptions
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
