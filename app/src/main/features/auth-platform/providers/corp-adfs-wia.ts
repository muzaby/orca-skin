// ADFS/WIA browser session provider (0157).
//
// ── 전제 (사용자 확인 2026-07-31) ────────────────────────────────────────────
// 폐쇄망 사내 앱은 첫 로그인에서 WIA 로 ADFS 세션을 만든 뒤, 후속 서비스 로그인에 **동일한
// Electron partition** 을 써서 ADFS 쿠키를 재사용한다. 중앙 OAuth OBO 나 KCD 가 아니다.
//
// 그래서 이 provider 는 `application` 과 `connector` 를 **같은 session group** 으로 처리한다:
//   - 앱 로그인      → target.kind='application', ADFS/WIA 완료 후 root binding
//   - 사내 서비스 연결 → target.kind='connector', 같은 group 이라 재입력 없이 통과
//
// 같은 partition 을 쓰는 대상들은 **같은 cookie jar 를 직접 공유**한다(복사 아님). ADFS SSO
// cookie 는 각 서비스의 redirect 에서 공동 재사용되고, 서비스별 cookie 도 같은 jar 에 저장되지만
// domain 규칙 때문에 교차 전송되지 않는다.
//
// ── 미검증 항목 ──────────────────────────────────────────────────────────────
// Electron 39 에서 session group 별 WIA allowlist 가 실제로 분리되는지는 실기 확인 대상이다
// (per-session `allowNTLMCredentialsForDomains` vs 프로세스 전역 `--auth-server-allowlist`).
// 분리가 불가능하면 allowlist 는 전역 합집합 의미로 강등된다 — 0157 plan §게이트.

import type {
  AuthLogoutResult,
  AuthPluginContext,
  AuthProviderDescriptor,
  AuthProviderV1,
  AuthRefreshResult,
  AuthStatusResult,
  AuthStep,
  AuthBindingRef
} from '../../../contracts/auth-plugin'

export interface AdfsWiaOptions {
  id: string
  pluginId: string
  label: string
  // 같은 이름을 쓰는 대상들이 cookie jar 를 공유한다.
  sessionGroup: string
  loginUrl: string
  // 로그인 완료 판정 — 이 URL 패턴에 도달하면 창을 닫는다.
  doneUrlPrefix: string
  // 인증 상태 확인용 endpoint (200 이면 세션 유효).
  authenticationProbeUrl: string
  allowedOrigins: readonly string[]
  // 사용자 식별자를 뽑을 수 있는 endpoint (선택). 없으면 principal 없이 binding 만 만든다.
  principalUrl?: string
}

export function createAdfsWiaProvider(opts: AdfsWiaOptions): AuthProviderV1 {
  const descriptor: AuthProviderDescriptor = {
    id: opts.id,
    pluginId: opts.pluginId,
    apiVersion: 1,
    label: opts.label,
    // 하나의 provider 를 앱 로그인과 여러 connector 가 재사용한다 (AUTH-PLAT-005).
    targets: ['application', 'connector'],
    mechanisms: ['adfs_browser_session'],
    capabilities: ['browser_session', 'status', 'logout'],
    allowedOrigins: [...opts.allowedOrigins],
    sessionGroup: opts.sessionGroup
  }

  // 이미 세션이 살아 있으면 창을 띄우지 않고 바로 binding 을 만든다 — 두 번째 서비스 연결이
  // 재입력 없이 통과하는 것이 이 provider 의 존재 이유다 (AUTH-PLAT-006).
  async function bindIfAuthenticated(
    ctx: AuthPluginContext,
    handleId: string
  ): Promise<AuthStep | null> {
    const probe = await ctx.browserSessions.probe(handleId, opts.authenticationProbeUrl)
    if (!probe.ok) return null
    return {
      kind: 'done',
      binding: {
        mechanism: 'adfs_browser_session',
        artifact: { kind: 'browser_session', handleId, sessionGroup: opts.sessionGroup },
        ...(await readPrincipal(ctx, handleId, opts))
      }
    }
  }

  return {
    descriptor,

    async begin(ctx: AuthPluginContext): Promise<AuthStep> {
      const handleId = await ctx.browserSessions.acquire(opts.sessionGroup)

      const reused = await bindIfAuthenticated(ctx, handleId)
      if (reused) return reused

      // 세션이 없으면 통제된 로그인 창을 연다. WIA 는 창 안에서 자동 처리되고, 쿠키는
      // 이 세션의 jar 에 남는다 — 호출자에게 넘어오지 않는다.
      try {
        await ctx.browserSessions.openLoginWindow(handleId, {
          url: opts.loginUrl,
          isDone: (url) => url.startsWith(opts.doneUrlPrefix)
        })
      } catch (err) {
        const message = String(err)
        return {
          kind: 'failed',
          reason: message.includes('타임아웃') ? 'timeout' : 'cancelled',
          message
        }
      }

      const bound = await bindIfAuthenticated(ctx, handleId)
      return (
        bound ?? {
          kind: 'failed',
          reason: 'invalid_credentials',
          message: '로그인 후에도 세션이 확인되지 않았습니다'
        }
      )
    },

    // 브라우저 플로우는 begin() 안에서 끝난다 — 사용자 입력을 되받는 단계가 없다.
    async continue(): Promise<AuthStep> {
      return { kind: 'not_supported' }
    },

    async status(ctx: AuthPluginContext, binding: AuthBindingRef): Promise<AuthStatusResult> {
      if (binding.artifact.kind !== 'browser_session') {
        return { kind: 'status', status: 'unknown' }
      }
      const probe = await ctx.browserSessions.probe(
        binding.artifact.handleId,
        opts.authenticationProbeUrl
      )
      return { kind: 'status', status: probe.ok ? 'valid' : 'expired' }
    },

    // ADFS 세션 갱신은 브라우저가 redirect 로 처리한다 — 앱이 흉내낼 자동 갱신이 없다.
    // capabilities 에 refresh 를 선언하지 않았고, 여기서도 표준 결과로 알린다.
    async refresh(): Promise<AuthRefreshResult> {
      return { kind: 'not_supported' }
    },

    // connector 하나의 연결 해제가 공유 partition 전체를 삭제하면 다른 서비스와 앱 로그인까지
    // 끊긴다. 그래서 service binding 은 **해당 origin 쿠키만** 지운다 (AUTH-PLAT-010).
    async logout(ctx: AuthPluginContext, binding: AuthBindingRef): Promise<AuthLogoutResult> {
      if (binding.artifact.kind !== 'browser_session') return { kind: 'not_supported' }
      const scope = binding.target.kind === 'application' ? 'group' : 'origin'
      await ctx.browserSessions.clear(binding.artifact.handleId, {
        scope,
        ...(scope === 'origin' ? { origin: originOf(opts.authenticationProbeUrl) } : {})
      })
      return { kind: 'logged_out' }
    }
  }
}

async function readPrincipal(
  ctx: AuthPluginContext,
  handleId: string,
  opts: AdfsWiaOptions
): Promise<{ principal?: { id?: string; email?: string; displayName?: string } }> {
  if (!opts.principalUrl) return {}
  try {
    const probe = await ctx.browserSessions.probe(handleId, opts.principalUrl)
    // probe 는 판정만 준다(본문 비노출) — 신원 상세가 필요하면 connector 로 조회한다.
    return probe.ok ? { principal: {} } : {}
  } catch {
    return {}
  }
}

function originOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).origin
  } catch {
    return ''
  }
}
