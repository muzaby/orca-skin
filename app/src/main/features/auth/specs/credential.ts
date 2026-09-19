// 입력 수집형 인증 방식 3종 (0181 — 0180 이 지운 `methods/credential.ts` 복원·축소).
//
// 세 방식이 다른 것은 **필드 선언과 compose 한 줄**뿐이고, 나머지(입력 수집 → vault 봉인 →
// grant 생성 → 삭제)는 글자까지 같았다. 그래서 팩토리 하나에 접는다.
//
// 값은 `user:pass` 든 단일 opaque 든 vault 에 **한 문자열**로 넣는다. 요청에 싣는 형식은 여기서
// 정하지 않는다 — provider 선언의 `present` 가 정한다.
//
// **자격증명 실검증은 여기서 하지 않는다.** 이 모듈은 대상의 origin 을 모른다. 검증은 실제
// 요청 경로(`api.ts`)가 401 을 관측할 때 일어난다 — 검증 경로와 사용 경로가 같아진다.

import type {
  AuthMethod,
  AuthMethodKind,
  ComposeResult,
  CredentialMaterial,
  FieldSpec,
  Presentation
} from '../../../contracts/auth'

export const FIELD_SECRET = 'secret'
export const FIELD_USERNAME = 'username'
export const FIELD_PASSWORD = 'password'

interface SingleValueOptions {
  label: string
  fieldLabel: string
  present: Presentation
}

function singleValueFields(fieldLabel: string): readonly FieldSpec[] {
  return [{ name: FIELD_SECRET, label: fieldLabel, type: 'password', required: true }]
}

function composeSingle(input: Record<string, string>): ComposeResult {
  const value = (input[FIELD_SECRET] ?? '').trim()
  return value.length === 0 ? { error: '값을 입력해 주세요' } : { value }
}

// 단일 값 방식의 공통 형상. **`kind` 만 다르다** — 두 벌로 적으면 필드·compose 를 고칠 때
// 한쪽만 바뀐다(0190).
function singleValueSpec(kind: 'api-key' | 'pat', opts: SingleValueOptions): AuthMethod {
  return {
    kind,
    label: opts.label,
    fields: singleValueFields(opts.fieldLabel),
    present: opts.present,
    compose: composeSingle
  }
}

// API key — 서비스가 발급한 단일 opaque 값. 계정이 아니라 **애플리케이션**에 묶인다.
export function apiKeySpec(opts: SingleValueOptions): AuthMethod {
  return singleValueSpec('api-key', opts)
}

// PAT — 값의 모양은 API key 와 같아도 **발급 주체·회수 절차·만료 정책이 다르다**. 표시와 감사가
// 그 구분을 쓰므로 뭉개지 않는다 — 구분은 `kind` 가 나른다.
export function patSpec(opts: SingleValueOptions): AuthMethod {
  return singleValueSpec('pat', opts)
}

// ID + 비밀번호. 값이 둘이고 서버가 받는 형식이 `base64(user:pass)` 라 단일 필드로 뭉갤 수 없다 —
// 필드가 하나면 사용자가 직접 `user:pass` 를 조립해야 하고 형식 책임이 사람에게 넘어간다.
export function passwordSpec(opts: { label: string; present: Presentation }): AuthMethod {
  return {
    kind: 'password',
    label: opts.label,
    fields: [
      { name: FIELD_USERNAME, label: '아이디', type: 'text', required: true },
      { name: FIELD_PASSWORD, label: '비밀번호', type: 'password', required: true }
    ],
    present: opts.present,
    compose: (input) => {
      const username = (input[FIELD_USERNAME] ?? '').trim()
      // 비밀번호는 trim 하지 않는다 — 앞뒤 공백이 유효한 비밀번호일 수 있다.
      const password = input[FIELD_PASSWORD] ?? ''
      if (username.length === 0) return { error: '아이디를 입력해 주세요' }
      if (password.length === 0) return { error: '비밀번호를 입력해 주세요' }
      // `user:pass` 는 **첫 `:`** 를 구분자로 쓴다. 아이디에 `:` 가 있으면 서버가 받는 사용자명이
      // 입력값과 달라지므로, 조용히 잘리게 두지 않고 여기서 거부한다.
      if (username.includes(':')) return { error: '아이디에 콜론(:)을 쓸 수 없습니다' }
      return { value: `${username}:${password}`, principalId: username }
    }
  }
}

// ── compose 의 역방향 (0237 ΔV3 — D-054) ─────────────────────────────────────
//
// **접는 쪽과 펴는 쪽이 같은 파일에 있어야 한다.** `passwordSpec.compose` 가 첫 `:` 를 구분자로
// 쓰기로 정했는데 그 규칙이 여기 없으면 소비자가 각자 다시 구현하고, 한쪽만 고쳐진다 —
// 0237 G4 가 정확히 그 상태였다(mail 슬라이스가 규칙을 몰라 합성형을 통째로 전송했다).
//
// `principalId` 는 grant 에 보관된 계정 식별자다. `password` 갈래는 합성값에서 직접 뽑으므로
// 쓰지 않고, `token` 갈래는 값에 계정이 없어 이것이 유일한 출처다.
export function unfoldCredential(
  authKind: AuthMethodKind | undefined,
  secret: string,
  principalId?: string
): CredentialMaterial {
  if (authKind === 'password') {
    // **첫 `:` 만** 구분자다 — 비밀번호에 `:` 가 있어도 그대로 보존된다(compose 가 아이디의
    // `:` 를 거부하므로 첫 것이 항상 경계다).
    const separator = secret.indexOf(':')
    if (separator < 0) return { kind: 'opaque', value: secret }
    return {
      kind: 'password',
      username: secret.slice(0, separator),
      password: secret.slice(separator + 1)
    }
  }
  if (authKind === 'oauth') {
    return { kind: 'token', username: principalId ?? '', accessToken: secret }
  }
  return { kind: 'opaque', value: secret }
}
