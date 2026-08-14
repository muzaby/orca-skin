// 자격증명 주입 + 전송 (0181 — 0180 이 지운 `infra/auth/authenticated-fetch.ts` 복원).
//
// **자격증명을 요청에 넣는 유일한 지점**이다. 정책 판정(origin·절대 URL·예약 헤더)은
// `policy.ts` 가 순수 함수로 하고, 여기서는 판정을 통과한 요청에 `Presentation` 을 적용해
// 실제로 보낸다.
//
// 여기서 만들어진 요청은 raw secret 을 담지만 **그 값이 호출자에게 되돌아가지 않는다** —
// 반환 타입에 요청 헤더가 없다.
//
// 0181 변경점: `CredentialPresentation`(구 shared DTO) → `Presentation`(contracts). 스킴 이름이
// 소문자가 됐고, `BasicPair` 는 `basic` 으로 합쳐졌다 — 새 `basic` 은 값이 이미 `user:pass`
// 형태임을 전제한다(`password` 방식의 compose 가 그 형식을 보장한다).

import type { Presentation } from '../../contracts/auth'
import type { PreparedRequest } from '../../infra/net/transport'

// presentation 대로 secret 을 심는다. **kind 에서 추론하지 않는다** — 같은 PAT 를 서비스별로
// Bearer / Basic password / PRIVATE-TOKEN 으로 다르게 붙이는 것이 이 함수의 존재 이유다.
//
// 순수 함수 — vitest 대상.
export function applyPresentation(
  req: PreparedRequest,
  presentation: Presentation,
  secret: string
): PreparedRequest {
  switch (presentation.location) {
    case 'header': {
      return {
        ...req,
        headers: { ...req.headers, [presentation.name]: formatScheme(presentation.scheme, secret) }
      }
    }
    case 'cookie': {
      // 기존 Cookie 헤더를 덮어쓰지 않고 덧붙인다(세션 쿠키와 공존).
      const existing = req.headers['Cookie']
      const pair = `${presentation.name}=${secret}`
      return {
        ...req,
        headers: { ...req.headers, Cookie: existing ? `${existing}; ${pair}` : pair }
      }
    }
    case 'query': {
      const url = new URL(req.url)
      url.searchParams.set(presentation.name, secret)
      return { ...req, url: url.toString() }
    }
  }
}

function formatScheme(scheme: Presentation['scheme'], secret: string): string {
  switch (scheme) {
    case 'bearer':
      return `Bearer ${secret}`
    case 'basic':
      // 값이 `user:pass` 형태임을 전제한다. 사용자명 없이 PAT 만 password 로 쓰는 서비스는
      // 선언에서 `:<pat>` 을 만들어 넘긴다 — 형식 책임을 선언에 두는 편이 두 개의 비슷한
      // 스킴 이름(구 `Basic`/`BasicPair`)으로 나누는 것보다 읽힌다.
      return `Basic ${Buffer.from(secret).toString('base64')}`
    case 'token':
      return `Token ${secret}`
    case 'raw':
    case undefined:
      return secret
  }
}
