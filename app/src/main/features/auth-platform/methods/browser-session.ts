// 브라우저 세션 인증 방식 (0178) — 구 `providers/corp-adfs-wia.ts`.
//
// ── 전제 (사용자 확인 2026-07-31) ────────────────────────────────────────────
// 폐쇄망 사내 앱은 첫 로그인에서 WIA 로 ADFS 세션을 만든 뒤, 후속 서비스 로그인에 **동일한
// Electron partition** 을 써서 ADFS 쿠키를 재사용한다. 중앙 OAuth OBO 나 KCD 가 아니다.
//
// 그래서 이 방식은 `application` 과 `connector` 를 **같은 session group** 으로 처리한다:
//   - 앱 로그인      → target.kind='application', WIA 완료 후 root 레코드
//   - 사내 서비스 연결 → target.kind='connector', 같은 group 이라 재입력 없이 통과
//
// 같은 partition 을 쓰는 대상들은 **같은 cookie jar 를 직접 공유**한다(복사 아님). SSO cookie 는
// 각 서비스의 redirect 에서 공동 재사용되고, 서비스별 cookie 도 같은 jar 에 저장되지만 domain
// 규칙 때문에 교차 전송되지 않는다.
//
// **SSO 는 MCP 로 반출되지 않는다** (사용자 결정 2026-08-06). cookie jar 는 값이 아니므로
// `InternalApi.token` 이 null 을 돌려주고, 그 MCP 서버는 사유와 함께 배포에서 빠진다.
//
// ── 미검증 항목 ──────────────────────────────────────────────────────────────
// Electron 39 에서 session group 별 WIA allowlist 가 실제로 분리되는지는 실기 확인 대상이다
// (per-session `allowNTLMCredentialsForDomains` vs 프로세스 전역 `--auth-server-allowlist`).

import type {
  AuthContext,
  AuthMethod,
  AuthMethodDescriptor,
  AuthOutcome,
  AuthRecordRef,
  AuthRecordStatus
} from '../../../contracts/auth-method'

export const BROWSER_SESSION_GROUP_ID = 'browser-session'

export interface BrowserSessionConfig {
  // 인증 방식 id. 대상의 `acceptedMethods` 가 이 값을 참조한다.
  id: string
  label: string
  // 로그인 체인의 단위. 같은 그룹의 application 방식들이 하나의 논리 로그인이 된다(0172).
  // 기본은 브라우저 세션 그룹 — 앱 로그인이 SSO 하나로 끝나는 보통의 경우다.
  groupId?: string
  // 같은 이름을 쓰는 대상들이 cookie jar 를 공유한다.
  sessionGroup: string
  loginUrl: string
  // 로그인 완료 판정 — 이 URL 패턴에 도달하면 창을 닫는다.
  doneUrlPrefix: string
  // 인증 상태 확인용 endpoint (200 이면 세션 유효).
  authenticationProbeUrl: string
  allowedOrigins: readonly string[]
  // 사용자 식별자를 뽑을 수 있는 endpoint (선택). 없으면 principal 없이 레코드만 만든다.
  principalUrl?: string
}

export function createBrowserSessionMethod(config: BrowserSessionConfig): AuthMethod {
  const descriptor: AuthMethodDescriptor = {
    id: config.id,
    groupId: config.groupId ?? BROWSER_SESSION_GROUP_ID,
    label: config.label,
    // 하나의 방식을 앱 로그인과 여러 대상이 재사용한다.
    targets: ['application', 'connector'],
    mechanisms: ['adfs_browser_session'],
    allowedOrigins: [...config.allowedOrigins],
    sessionGroup: config.sessionGroup
  }

  async function authenticatedRecord(ctx: AuthContext, handleId: string): Promise<AuthOutcome> {
    return {
      kind: 'authenticated',
      record: {
        mechanism: 'adfs_browser_session',
        artifact: { kind: 'browser_session', handleId, sessionGroup: config.sessionGroup },
        ...(await readPrincipal(ctx, handleId, config))
      }
    }
  }

  return {
    descriptor,

    // 브라우저 흐름은 이 호출 **안에서** 끝난다 — 사용자 입력을 되받는 단계가 없으므로
    // `input-required` 를 돌려줄 일이 없다.
    async authenticate(ctx: AuthContext): Promise<AuthOutcome> {
      const handleId = await ctx.browserSessions.acquire(config.sessionGroup)

      // 이미 세션이 살아 있으면 창을 띄우지 않는다 — 두 번째 서비스 연결이 재입력 없이 통과하는
      // 것이 이 방식의 존재 이유다. **여기서 probe 오판의 대가는 "창이 한 번 더 뜬다"** 라
      // 판정을 그대로 신뢰한다(창 완료 *후* 의 확인은 아래 — 거기서는 대가가 "로그인 불가"다).
      const reused = await ctx.browserSessions.probe(handleId, config.authenticationProbeUrl)
      if (reused.ok) return authenticatedRecord(ctx, handleId)

      // 세션이 없으면 통제된 로그인 창을 연다. WIA 는 창 안에서 자동 처리되고, 쿠키는 이 세션의
      // jar 에 남는다 — 호출자에게 넘어오지 않는다.
      try {
        await ctx.browserSessions.openLoginWindow(handleId, {
          url: config.loginUrl,
          isDone: (url) => url.startsWith(config.doneUrlPrefix)
        })
      } catch (err) {
        const message = String(err)
        return {
          kind: 'failed',
          reason: message.includes('타임아웃') ? 'timeout' : 'cancelled',
          message
        }
      }

      // **창이 `doneUrlPrefix` 에 도달했다 = 배포가 선언한 "로그인 완료" 신호다.** 그 위에 probe 를
      // *추가 관문* 으로 세우면 probe 규칙이 배포마다 조금만 어긋나도 로그인이 통째로 막힌다 —
      // 실제로 그렇게 됐다(0174: 인증에 성공해도 probe 가 302 로 로그인 URL 을 가리키는 배포).
      // 그래서 여기서는 probe 를 **확인용으로만** 쓰고, 실패해도 레코드를 만든다. 오판의 최악이
      // "이미 만료된 세션으로 레코드를 만들었다" 인데 그건 첫 요청의 401 로 드러난다.
      try {
        const confirmed = await ctx.browserSessions.probe(handleId, config.authenticationProbeUrl)
        if (!confirmed.ok) {
          ctx.logger('로그인 창은 완료됐지만 probe 가 인증을 확인하지 못했다', {
            status: confirmed.status
          })
        }
      } catch (err) {
        ctx.logger('로그인 후 probe 실패(무시하고 진행)', { message: String(err) })
      }
      return authenticatedRecord(ctx, handleId)
    },

    async status(ctx: AuthContext, record: AuthRecordRef): Promise<AuthRecordStatus> {
      if (record.artifact.kind !== 'browser_session') return 'unknown'
      const probe = await ctx.browserSessions.probe(
        record.artifact.handleId,
        config.authenticationProbeUrl
      )
      return probe.ok ? 'valid' : 'expired'
    },

    // 대상 하나의 연결 해제가 공유 partition 전체를 삭제하면 다른 서비스와 앱 로그인까지 끊긴다.
    // 그래서 서비스 레코드는 **해당 origin 쿠키만** 지운다.
    async revoke(ctx: AuthContext, record: AuthRecordRef): Promise<void> {
      if (record.artifact.kind !== 'browser_session') return
      const scope = record.target.kind === 'application' ? 'group' : 'origin'
      await ctx.browserSessions.clear(record.artifact.handleId, {
        scope,
        ...(scope === 'origin' ? { origin: originOf(config.authenticationProbeUrl) } : {})
      })
    }
  }
}

async function readPrincipal(
  ctx: AuthContext,
  handleId: string,
  config: BrowserSessionConfig
): Promise<{ principal?: { id?: string; email?: string; displayName?: string } }> {
  if (!config.principalUrl) return {}
  try {
    const probe = await ctx.browserSessions.probe(handleId, config.principalUrl)
    // probe 는 판정만 준다(본문 비노출) — 신원 상세가 필요하면 대상 API 로 조회한다.
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
