// Static credential provider (0157) — API key · Auth token · PAT.
//
// 세 값은 모두 opaque string 이지만 **같은 것으로 뭉개지 않는다**. 의미와 관리 정책이 달라
// 서로 다른 `CredentialKind` 로 저장하고, 요청에 넣는 방식은 여기서 정하지 않는다 —
// connector 의 `CredentialPresentation` 이 선언한다 (AUTH-PLAT-007).
//
//   api_key                : 서비스가 발급한 식별·인증 key
//   auth_token             : 사용자가 직접 입력하는 일반 opaque token
//   personal_access_token  : 사용자 계정·scope 에 연결된 장기 token
//
// refresh 는 개념이 없으므로 **not_supported** 를 반환한다 — 메서드를 빼지 않는다
// (AUTH-PLAT-002). 만료·probe 실패는 `reauth_required` 가 아니라 status 가 expired 로 알린다.

import type {
  AuthLogoutResult,
  AuthPluginContext,
  AuthProviderDescriptor,
  AuthProviderV1,
  AuthRefreshResult,
  AuthStatusResult,
  AuthStep
} from '../../../contracts/auth-plugin'
import type { AuthMechanism, CredentialKind } from '../../../../shared/ipc'
import { BINDING_SECRET_NAME } from '../broker'

// 이 provider 가 다루는 credential 종류 ↔ mechanism 대응.
const KIND_BY_MECHANISM: Partial<Record<AuthMechanism, CredentialKind>> = {
  api_key: 'api_key',
  auth_token: 'auth_token',
  personal_access_token: 'personal_access_token',
  basic: 'basic'
}

export interface StaticCredentialOptions {
  id: string
  pluginId: string
  label: string
  mechanism: Extract<AuthMechanism, 'api_key' | 'auth_token' | 'personal_access_token' | 'basic'>
  // 이 credential 이 유효한 서비스(표시·감사용).
  service?: string
  // probe 로 유효성을 확인할 URL. 없으면 status 는 저장 여부만 본다.
  probeUrl?: string
  allowedOrigins?: readonly string[]
  // 입력 라벨 커스터마이즈(회사 언어 재량).
  fieldLabel?: string
  // 이 credential 로 무엇을 여는가. 기본값은 둘 다지만 **`application` 을 포함하면 앱 로그인
  // 게이트가 켜진다**(`broker.status().required`) — 서비스 연결 전용 credential 은 반드시
  // `['connector']` 로 좁힌다. 0164 verify D1: Confluence PAT 이 기본값을 쓰는 바람에 서버가
  // 0개인 설치에서도 prod 로그인 게이트가 켜졌다(DEV 는 bypass 라 보이지 않았다).
  targets?: readonly ('application' | 'connector')[]
}

export function createStaticCredentialProvider(opts: StaticCredentialOptions): AuthProviderV1 {
  const kind = KIND_BY_MECHANISM[opts.mechanism] ?? 'auth_token'
  const descriptor: AuthProviderDescriptor = {
    id: opts.id,
    pluginId: opts.pluginId,
    apiVersion: 1,
    label: opts.label,
    // static credential 은 앱 로그인에도 서비스 연결에도 쓸 수 있다 — 같은 lifecycle.
    // 기본값을 그대로 쓰면 앱 로그인 게이트가 켜지므로, 연결 전용이면 호출자가 좁힌다.
    targets: [...(opts.targets ?? ['application', 'connector'])],
    mechanisms: [opts.mechanism],
    // refresh 는 지원하지 않으므로 **선언하지 않는다**. conformance 가 이 선언과 실제 동작의
    // 일치를 검사한다.
    capabilities: opts.probeUrl ? ['status', 'logout'] : ['logout'],
    allowedOrigins: [...(opts.allowedOrigins ?? [])]
  }

  const fieldName = 'credential'

  return {
    descriptor,

    // 1단계: 신뢰된 secret prompt 로 값을 받는다. 플러그인이 만든 임의 UI 가 아니라 Orca 의
    // 필드 선언을 renderer 가 렌더링한다.
    async begin(): Promise<AuthStep> {
      return {
        kind: 'collect',
        fields: [
          {
            name: fieldName,
            label: opts.fieldLabel ?? opts.label,
            type: 'password',
            required: true
          }
        ]
      }
    },

    // 2단계: 값을 vault 에 봉인하고 binding 을 만든다. 반환 결과에는 값이 없다.
    async continue(ctx: AuthPluginContext): Promise<AuthStep> {
      const value = (ctx.input[fieldName] ?? '').trim()
      if (value.length === 0) {
        return { kind: 'failed', reason: 'invalid_input', message: '값을 입력해 주세요' }
      }

      // probeUrl 이 있으면 저장 전에 실제로 통하는지 본다 — 잘못된 키가 조용히 저장되지 않게.
      if (opts.probeUrl) {
        const ok = await probe(ctx, opts.probeUrl, value)
        if (!ok) {
          return {
            kind: 'failed',
            reason: 'invalid_credentials',
            message: '자격증명이 거부되었습니다'
          }
        }
      }

      ctx.vault.set(BINDING_SECRET_NAME, value, {
        kind,
        ...(opts.service !== undefined ? { service: opts.service } : {}),
        createdAt: ctx.clock()
      })

      return {
        kind: 'done',
        binding: {
          mechanism: opts.mechanism,
          // handleId 만 — 값은 vault 에만 존재한다.
          artifact: {
            kind: 'vault_credential',
            handleId: BINDING_SECRET_NAME,
            credentialKind: kind
          }
        }
      }
    },

    async status(ctx: AuthPluginContext): Promise<AuthStatusResult> {
      if (!opts.probeUrl) {
        // probe 대상이 없으면 저장 여부만 판정한다. 값이 없으면 revoked 가 아니라 unknown —
        // 복호화 실패와 부재를 구분하지 못하는 상황에서 단정하지 않는다.
        return { kind: 'status', status: ctx.vault.get(BINDING_SECRET_NAME) ? 'valid' : 'unknown' }
      }
      const value = ctx.vault.get(BINDING_SECRET_NAME)
      if (!value) return { kind: 'status', status: 'unknown' }
      const ok = await probe(ctx, opts.probeUrl, value)
      return { kind: 'status', status: ok ? 'valid' : 'expired' }
    },

    // static credential 에는 자동 갱신이 없다. 메서드를 빼지 않고 표준 결과로 알린다.
    async refresh(): Promise<AuthRefreshResult> {
      return { kind: 'not_supported' }
    },

    async logout(ctx: AuthPluginContext): Promise<AuthLogoutResult> {
      ctx.vault.delete(BINDING_SECRET_NAME)
      return { kind: 'logged_out' }
    }
  }
}

// probe 는 provider 가 자기 credential 로 직접 호출한다 — 아직 binding 이 없어 broker 의
// authenticatedFetch 를 쓸 수 없는 단계이기 때문이다. origin 검사는 ctx.fetch 가 강제한다.
async function probe(ctx: AuthPluginContext, url: string, value: string): Promise<boolean> {
  try {
    const res = await ctx.fetch(url, { headers: { Authorization: `Bearer ${value}` } })
    return res.status >= 200 && res.status < 400
  } catch {
    return false
  }
}
