// 자격증명 인증 방식 (0178) — 구 `providers/{static,basic}-credential.ts` 를 합쳤다.
//
// 두 파일이 따로였던 이유는 "값이 하나냐 둘이냐" 뿐이고, 그 차이는 **필드 선언 한 줄**이다.
// 나머지(입력 수집 → vault 봉인 → 레코드 생성 → 삭제)는 글자까지 같았다.
//
// 값은 `user:pass` 든 단일 opaque 든 vault 에 **한 문자열**로 넣는다. 요청에 넣는 형식은 여기서
// 정하지 않는다 — 대상의 `CredentialPresentation` 이 선언한다.
//
// **자격증명 실검증은 여기서 하지 않는다.** 인증 방식은 대상의 origin 을 모른다. 검증은
// connector 의 `start()` 가 실제 요청 경로로 한다 — 검증 경로와 사용 경로가 같아진다.

import type {
  AuthContext,
  AuthMethod,
  AuthMethodDescriptor,
  AuthOutcome,
  AuthRecordStatus
} from '../../../contracts/auth-method'
import type {
  AuthFieldSpec,
  AuthMechanism,
  AuthTargetKind,
  CredentialKind
} from '../../../../shared/ipc'

// 인증 레코드가 봉인한 credential 의 vault 키. 방식이 이 이름으로 값을 넣고 api 가 읽는다.
export const RECORD_SECRET_NAME = 'secret'

export const CREDENTIAL_GROUP_ID = 'credential'
export const PAT_METHOD_ID = 'credential-pat'
export const BASIC_METHOD_ID = 'credential-basic'
export const AUTH_TOKEN_METHOD_ID = 'credential-auth-token'

export const BASIC_USERNAME_FIELD = 'username'
export const BASIC_PASSWORD_FIELD = 'password'
const SINGLE_FIELD = 'credential'

export interface CredentialMethodOptions {
  id: string
  label: string
  mechanism: Extract<AuthMechanism, 'api_key' | 'auth_token' | 'personal_access_token' | 'basic'>
  credentialKind: CredentialKind
  fields: readonly AuthFieldSpec[]
  // 로그인 체인의 단위. 기본은 자격증명 그룹.
  groupId?: string
  // **기본은 연결 전용이다.** `application` 을 넣으면 앱 로그인 게이트가 켜지므로(0164 verify D1)
  // 넓히는 쪽은 항상 명시해야 한다.
  targets?: readonly AuthTargetKind[]
  // 입력값 → vault 에 넣을 한 문자열. 실패하면 사용자에게 보일 문구를 돌려준다.
  compose(
    input: Record<string, string>
  ): { value: string; principalId?: string } | { error: string }
}

export function createCredentialMethod(opts: CredentialMethodOptions): AuthMethod {
  const descriptor: AuthMethodDescriptor = {
    id: opts.id,
    groupId: opts.groupId ?? CREDENTIAL_GROUP_ID,
    label: opts.label,
    // 기본은 서비스 연결 전용이다 — 앱 로그인 게이트를 여는 수단이 아니다(0164 verify D1:
    // 기본값이 넓어 서버 0개 설치에서도 게이트가 켜졌다).
    targets: [...(opts.targets ?? ['connector'])],
    mechanisms: [opts.mechanism],
    allowedOrigins: []
  }

  return {
    descriptor,

    // 재진입 1회차는 입력이 비어 있으므로 필드를 알린다. 사용자가 채워 다시 부르면 봉인한다.
    // 신뢰된 prompt 다 — 인증 방식이 만든 임의 UI 가 아니라 Orca 가 이 필드 선언을 렌더링한다.
    async authenticate(ctx: AuthContext): Promise<AuthOutcome> {
      if (!opts.fields.some((field) => ctx.input[field.name] !== undefined)) {
        return { kind: 'input-required', fields: opts.fields }
      }

      const composed = opts.compose(ctx.input)
      if ('error' in composed) {
        return { kind: 'failed', reason: 'invalid_input', message: composed.error }
      }

      ctx.vault.set(RECORD_SECRET_NAME, composed.value, {
        kind: opts.credentialKind,
        ...(ctx.target.kind === 'connector' ? { service: ctx.target.connectorId } : {}),
        createdAt: ctx.clock()
      })

      return {
        kind: 'authenticated',
        record: {
          mechanism: opts.mechanism,
          // handleId 만 — 값은 vault 에만 존재한다.
          artifact: {
            kind: 'vault_credential',
            handleId: RECORD_SECRET_NAME,
            credentialKind: opts.credentialKind
          },
          // 사용자명은 비밀이 아니라 표시용 식별자다. 어느 계정으로 붙었는지 UI 가 보여준다.
          ...(composed.principalId !== undefined
            ? { principal: { id: composed.principalId, displayName: composed.principalId } }
            : {})
        }
      }
    },

    // 저장 여부만 본다. 값이 없으면 revoked 가 아니라 unknown — 복호화 실패와 부재를 구분하지
    // 못하는 상황에서 단정하지 않는다.
    async status(ctx: AuthContext): Promise<AuthRecordStatus> {
      return ctx.vault.get(RECORD_SECRET_NAME) ? 'valid' : 'unknown'
    },

    async revoke(ctx: AuthContext): Promise<void> {
      ctx.vault.delete(RECORD_SECRET_NAME)
    }
  }
}

// ── 내장 2종 ─────────────────────────────────────────────────────────────────

// 단일 opaque 값(API key·PAT·auth token). 서비스가 발급한 값을 사용자가 그대로 붙여 넣는다.
export function createPatMethod(): AuthMethod {
  return createCredentialMethod({
    id: PAT_METHOD_ID,
    label: '개인 액세스 토큰(PAT)',
    mechanism: 'personal_access_token',
    credentialKind: 'personal_access_token',
    fields: [
      { name: SINGLE_FIELD, label: '개인 액세스 토큰(PAT)', type: 'password', required: true }
    ],
    compose: (input) => {
      const value = (input[SINGLE_FIELD] ?? '').trim()
      return value.length === 0 ? { error: '값을 입력해 주세요' } : { value }
    }
  })
}

// 서비스가 발급한 일반 opaque token. **PAT 와 뭉개지 않는다** — PAT 는 사용자 계정·scope 에
// 묶인 장기 토큰이고 이것은 그렇지 않다. 값의 모양이 같아도 발급 주체·회수 절차·만료 정책이
// 달라 `CredentialKind` 를 나눠 저장한다(감사·표시가 그 구분을 쓴다).
export function createAuthTokenMethod(): AuthMethod {
  return createCredentialMethod({
    id: AUTH_TOKEN_METHOD_ID,
    label: '인증 토큰',
    mechanism: 'auth_token',
    credentialKind: 'auth_token',
    fields: [{ name: SINGLE_FIELD, label: '인증 토큰', type: 'password', required: true }],
    compose: (input) => {
      const value = (input[SINGLE_FIELD] ?? '').trim()
      return value.length === 0 ? { error: '값을 입력해 주세요' } : { value }
    }
  })
}

// ID + 비밀번호. 값이 둘이고 서버가 받는 형식이 `base64(user:pass)` 라 단일 필드로 뭉갤 수 없다 —
// 필드가 하나면 사용자가 직접 `user:pass` 를 조립해야 하고 형식 책임이 사람에게 넘어간다.
export function createBasicMethod(): AuthMethod {
  return createCredentialMethod({
    id: BASIC_METHOD_ID,
    label: 'ID/비밀번호',
    mechanism: 'basic',
    credentialKind: 'basic',
    fields: [
      { name: BASIC_USERNAME_FIELD, label: '아이디', type: 'text', required: true },
      { name: BASIC_PASSWORD_FIELD, label: '비밀번호', type: 'password', required: true }
    ],
    compose: (input) => {
      const username = (input[BASIC_USERNAME_FIELD] ?? '').trim()
      // 비밀번호는 trim 하지 않는다 — 앞뒤 공백이 유효한 비밀번호일 수 있다.
      const password = input[BASIC_PASSWORD_FIELD] ?? ''
      if (username.length === 0) return { error: '아이디를 입력해 주세요' }
      if (password.length === 0) return { error: '비밀번호를 입력해 주세요' }
      // `user:pass` 는 **첫 `:`** 를 구분자로 쓴다. 아이디에 `:` 가 있으면 서버가 받는 사용자명이
      // 입력값과 달라지므로, 조용히 잘리게 두지 않고 여기서 거부한다.
      if (username.includes(':')) return { error: '아이디에 콜론(:)을 쓸 수 없습니다' }
      return { value: `${username}:${password}`, principalId: username }
    }
  })
}
