import type { SsoContext, SsoLoginOutcome, SsoProviderModule } from '../../../../contracts/sso'

/**
 * Inactive template for a deployment-owned SSO module (0130).
 *
 * This module is typechecked but is not registered by `../index.ts`, so it is
 * never loaded by default. Copy it to `modules/<company>/`, replace the chain
 * with your company's login flow, and register it in `SSO_MODULE_REGISTRATION`
 * when you intentionally opt in. The chain below shows the three capabilities
 * most closed-network deployments need: an internal CLI call, an HTTP token
 * exchange, and handing the acquired token to the usage provider + LLM backend.
 */

// 이 모듈이 토큰을 넘겨줄 provider (sources/settings/<adapter>/<provider>/settings.json).
const ADAPTER = 'claude'
const PROVIDER = 'example-inhouse'
const PROVIDER_KEY = `${ADAPTER}-${PROVIDER}`

async function runChain(ctx: SsoContext): Promise<SsoLoginOutcome> {
  // 1) 사내 CLI 로 1차 자격 획득 (표준 SSO 가 아닐 수 있음 — CLI 도 체인의 1급 스텝).
  const cli = await ctx.exec('inhouse-auth', ['login', '--user', ctx.input.employeeId ?? ''], {
    stdin: ctx.input.password,
    timeoutMs: 30_000
  })
  if (cli.code !== 0) return { ok: false, message: cli.stderr.trim() || 'inhouse-auth failed' }

  // 2) 사내 토큰 교환 엔드포인트 — 프레임워크 타임아웃(signal)을 fetch 에 전파한다.
  const res = await ctx.fetch('https://sso.example.invalid/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ticket: cli.stdout.trim() }),
    signal: ctx.signal
  })
  if (!res.ok) return { ok: false, message: `token exchange failed (${res.status})` }
  const body = (await res.json()) as { accessToken: string; email?: string; expiresAt?: number }

  // 3) 획득 토큰 배포 —
  //    (a) 모듈 전용 캐시(sso:<key>: 네임스페이스) → restore() 의 silent 복원용.
  ctx.secret.set('session-token', body.accessToken)
  ctx.store.set('expiresAt', body.expiresAt ?? null)
  //    (b) usage provider 와 공유(provider:<providerKey>: 네임스페이스) —
  //        정적 usage 모듈의 `${SECRET:usage-report-token}` / ctx.secret 이 읽는다.
  ctx.providerSecrets(PROVIDER_KEY).set('usage-report-token', body.accessToken)
  //    (c) LLM 백엔드 env — settings.json env 블록에 리터럴 병합(디스크 평문 — 원치 않으면 생략).
  ctx.setProviderEnv(ADAPTER, PROVIDER, { ANTHROPIC_AUTH_TOKEN: body.accessToken })

  return { ok: true, identity: { email: body.email } }
}

export const exampleSsoModule: SsoProviderModule = {
  key: 'example-inhouse',
  fields: [
    { name: 'employeeId', label: '사번', type: 'text', required: true },
    { name: 'password', label: '비밀번호', type: 'password', required: true }
  ],
  loginTimeoutMs: 120_000,

  login: runChain,

  // 부팅 시 무입력 복원 — 캐시 토큰이 아직 유효하면 로그인 화면을 건너뛴다.
  async restore(ctx) {
    const token = ctx.secret.get('session-token')
    if (!token) return null
    const expiresAt = ctx.store.get('expiresAt')
    if (typeof expiresAt === 'number' && expiresAt <= ctx.clock()) {
      ctx.secret.delete('session-token')
      return null
    }
    const res = await ctx.fetch('https://sso.example.invalid/verify', {
      headers: { authorization: `Bearer ${token}` },
      signal: ctx.signal
    })
    if (!res.ok) return null
    return { ok: true }
  }
}
