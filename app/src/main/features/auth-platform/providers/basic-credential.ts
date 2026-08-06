// Basic credential provider (0160) — 사용자 ID + 비밀번호.
//
// `static-credential.ts` 는 **단일 opaque 값**(API key·PAT)을 받는다. ID/비밀번호는 값이 두
// 개고 서버가 받는 형식이 `base64(user:pass)` 라 같은 provider 로 뭉갤 수 없다 — 필드가 하나면
// 사용자가 직접 `user:pass` 를 조립해 넣어야 하고, 그 순간 형식 책임이 사람에게 넘어간다.
//
// 저장은 vault 에 `user:pass` **한 문자열**로 한다. 요청에 넣는 형식은 여기서 정하지 않는다 —
// connector 의 `CredentialPresentation`(`scheme:'BasicPair'`)이 선언한다 (AUTH-PLAT-007).

import type {
  AuthLogoutResult,
  AuthPluginContext,
  AuthProviderDescriptor,
  AuthProviderV1,
  AuthStatusResult,
  AuthStep
} from '../../../contracts/auth-plugin'
import { BINDING_SECRET_NAME } from '../broker'

export interface BasicCredentialOptions {
  id: string
  pluginId: string
  label: string
  // 이 credential 이 유효한 서비스(표시·감사용). secret 아님.
  service?: string
  // 입력 라벨 커스터마이즈(회사 언어 재량).
  usernameLabel?: string
  passwordLabel?: string
}

export const BASIC_USERNAME_FIELD = 'username'
export const BASIC_PASSWORD_FIELD = 'password'

export function createBasicCredentialProvider(opts: BasicCredentialOptions): AuthProviderV1 {
  const descriptor: AuthProviderDescriptor = {
    id: opts.id,
    pluginId: opts.pluginId,
    label: opts.label,
    // 앱 로그인이 아니라 서비스 연결용이다 — 앱 게이트를 열 수단이 아니다.
    targets: ['connector'],
    mechanisms: ['basic'],
    // status probe 는 origin 을 알아야 하는데 provider 는 connector 의 baseUrl 을 모른다.
    // 자격증명 실검증은 connector 의 `start()` 가 authenticatedFetch 로 한다 — 실제 요청
    // 경로와 같은 경로로 검증되고, provider 마다 origin 을 또 선언하지 않아도 된다.
    capabilities: ['logout'],
    allowedOrigins: []
  }

  return {
    descriptor,

    // 1단계: 두 필드를 신뢰된 prompt 로 받는다. 플러그인이 만든 임의 UI 가 아니라 Orca 의
    // 필드 선언을 renderer 가 렌더링한다.
    async begin(): Promise<AuthStep> {
      return {
        kind: 'collect',
        fields: [
          {
            name: BASIC_USERNAME_FIELD,
            label: opts.usernameLabel ?? '아이디',
            type: 'text',
            required: true
          },
          {
            name: BASIC_PASSWORD_FIELD,
            label: opts.passwordLabel ?? '비밀번호',
            type: 'password',
            required: true
          }
        ]
      }
    },

    // 2단계: `user:pass` 로 합쳐 vault 에 봉인하고 binding 을 만든다. 반환 결과에는 값이 없다.
    async continue(ctx: AuthPluginContext): Promise<AuthStep> {
      const username = (ctx.input[BASIC_USERNAME_FIELD] ?? '').trim()
      // 비밀번호는 trim 하지 않는다 — 앞뒤 공백이 유효한 비밀번호일 수 있다.
      const password = ctx.input[BASIC_PASSWORD_FIELD] ?? ''

      if (username.length === 0) {
        return { kind: 'failed', reason: 'invalid_input', message: '아이디를 입력해 주세요' }
      }
      if (password.length === 0) {
        return { kind: 'failed', reason: 'invalid_input', message: '비밀번호를 입력해 주세요' }
      }
      // `user:pass` 는 **첫 `:`** 를 구분자로 쓰므로 아이디에 `:` 가 있으면 서버가 받는
      // 사용자명이 입력값과 달라진다. 조용히 잘리게 두지 않고 여기서 거부한다.
      if (username.includes(':')) {
        return {
          kind: 'failed',
          reason: 'invalid_input',
          message: '아이디에 콜론(:)을 쓸 수 없습니다'
        }
      }

      ctx.vault.set(BINDING_SECRET_NAME, `${username}:${password}`, {
        kind: 'basic',
        ...(opts.service !== undefined ? { service: opts.service } : {}),
        createdAt: ctx.clock()
      })

      return {
        kind: 'done',
        binding: {
          mechanism: 'basic',
          // handleId 만 — 값은 vault 에만 존재한다.
          artifact: {
            kind: 'vault_credential',
            handleId: BINDING_SECRET_NAME,
            credentialKind: 'basic'
          },
          // 사용자명은 비밀이 아니라 표시용 식별자다. 어느 계정으로 연결됐는지 UI 가 보여준다.
          principal: { id: username, displayName: username }
        }
      }
    },

    // probe 대상 origin 을 모르므로 저장 여부만 판정한다. 값이 없으면 revoked 가 아니라
    // unknown — 복호화 실패와 부재를 구분하지 못하는 상황에서 단정하지 않는다.
    async status(ctx: AuthPluginContext): Promise<AuthStatusResult> {
      return { kind: 'status', status: ctx.vault.get(BINDING_SECRET_NAME) ? 'valid' : 'unknown' }
    },

    // ID/비밀번호에는 자동 갱신이 없다. 메서드를 빼지 않고 표준 결과로 알린다.
    async logout(ctx: AuthPluginContext): Promise<AuthLogoutResult> {
      ctx.vault.delete(BINDING_SECRET_NAME)
      return { kind: 'logged_out' }
    }
  }
}
