// 브라우저 세션 인증 방식의 **선언 표면과 포트** (0181 → 0188 분리).
//
// ── 전제 (사용자 확인 2026-07-31, 2026-08-10 재확인) ─────────────────────────
// 폐쇄망 사내 앱은 첫 로그인에서 WIA 로 ADFS 세션을 만든 뒤, 후속 서비스 로그인에 **동일한
// Electron partition** 을 써서 ADFS 쿠키를 재사용한다. 중앙 OAuth OBO 나 KCD 가 아니다.
//
// ── "둘 다 필요" 의 구체 형태 (사용자 2차 결정 · 0195 재정의) ────────────────
//   ① 게이트 로그인    — 창이 doneUrlPrefix 에 도달 → probe 로 판정 → `session` grant
//   ② 토큰이 필요한 곳 — `config.exchange` 가 선언돼 있으면 **final URL 이 돌려준 인가 코드**를
//      같은 세션으로 토큰과 교환해 `token` grant 로 승격한다. 표준 OAuth 왕복이 아니라 창이
//      만든 코드의 교환이다.
//
//      **쿠키에서 토큰을 만들지 않는다** (0195 D-006). 요청은 파티션을 유지해 쿠키를 싣지만,
//      토큰의 출처는 교환 응답 JSON 하나다. 코드를 돌려주지 않는 SP 는 `exchange` 를 선언하지
//      않고 세션 grant 로 끝낸다.
//
// **로그인 흐름 자체는 `../browser-session/runner.ts` 가 갖는다** (0188) — 여기에는 포트와
// 응답 해석 헬퍼만 둔다. Electron partition/cookie jar 구현은 `infra/browser-session.ts` 다.
//
// **electron 을 import 하지 않는다** — 창·세션은 포트로 주입받는다(`BrowserSessionPort`).
// 그래야 이 파일이 vitest 대상으로 남는다(P29: electron 을 무는 파일은 테스트가 즉시 죽는다).

import type { SessionGroupPolicy } from '../../../infra/browser-session-policy'
import type { PreparedRequest, SendOptions, SendResult } from '../../../infra/net/transport'
import { urlParams } from '../url-params'

// `BrowserSessionStore`(infra, electron 의존)가 구조적으로 만족하는 포트.
export interface BrowserSessionPort {
  register(policy: SessionGroupPolicy): void
  acquire(sessionGroup: string): string
  openLoginWindow(
    handleId: string,
    opts: { url: string; isDone(url: string): boolean }
  ): Promise<{ finalUrl: string }>
  send(handleId: string, req: PreparedRequest, options?: SendOptions): Promise<SendResult>
  // cookie jar 를 비운다 (r9). 해제한 session Auth 의 쿠키가 남으면 grant 만 사라지고 **로그인
  // 상태 자체는 서버 쪽에 살아 있다** — 같은 그룹을 쓰는 다른 Auth 가 그 쿠키로 계속 통과하고,
  // 어떤 이유로든 grant 가 되살아나면 probe 가 그대로 성공한다.
  //
  // 기본 scope 는 `'origin'` 이다 — 한 connector 를 끊었다고 공유 세션 그룹을 통째로 비우면
  // 같은 그룹의 다른 연결까지 끊긴다.
  clear(handleId: string, opts: { scope: 'origin' | 'group'; origin?: string }): Promise<void>
}

// 응답 JSON 에서 점 경로로 값을 꺼낸다. 실값(0181 OQ2)이 미정이라 경로를 **선언으로 받는** 것이
// 이 함수의 존재 이유다 — 배포마다 `access_token` 이기도 하고 `data.token` 이기도 하다.
export function pickPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value === null || typeof value !== 'object') return undefined
    return (value as Record<string, unknown>)[key]
  }, source)
}

// 점 경로로 꺼낸 값이 표시할 수 있는 문자열일 때만 돌려준다. 숫자·객체·빈 문자열은 신원이
// 아니다 — 사이드바에 `[object Object]` 를 띄우지 않기 위한 좁힘이다.
export function pickPrincipal(source: unknown, path: string): string | undefined {
  const value = pickPath(source, path)
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

// 점 경로에서 **비밀 문자열**을 꺼낸다. 위 `pickPrincipal` 과 나란히 두는 이유가 그 차이다 —
// **여기는 trim 하지 않는다.** 토큰은 표시용 문자열이 아니라 그대로 전송될 값이라, 코어가
// 임의로 다듬으면 서버가 거부한다. 공백만 있는 값의 판정도 그래서 갈린다(저쪽은 버리고
// 이쪽은 살린다).
export function pickSecret(source: unknown, path: string): string | undefined {
  const value = pickPath(source, path)
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

// 로그인 final URL 에서 파라미터 하나를 꺼낸다. **쿼리와 프래그먼트를 모두 본다** —
// `response_mode=fragment` 로 돌려주는 배포가 있다.
//
// 추출 자체는 `../url-params.ts` 가 갖는다(0197 A-3) — `oauth.ts` 의 `parseCallbackUrl` 과
// 같은 세 줄이 두 벌 있던 것을 하나로 모았다. `parseCallbackUrl` 을 **통째로** 재사용하지
// 않는 이유는 그대로다: 그쪽은 `code`/`error`/`state` 라는 OAuth 어휘에 묶여 있는데 이 흐름에는
// state 도 error 규약도 없고, 파라미터 이름이 배포마다 다르다(0195 D-005).
//
// 빈 문자열은 값이 아니다 — `?code=` 로 끝난 URL 을 "코드를 받았다" 로 읽으면 교환 요청이 빈
// 코드로 나가고 실패 사유가 SP 응답으로 미뤄진다. **이 규칙은 여기만의 것이다**:
// `parseCallbackUrl` 은 `''` 를 값으로 유지한다.
export function pickUrlParam(rawUrl: string, name: string): string | undefined {
  const value = urlParams(rawUrl)?.(name)
  return value !== null && value !== undefined && value.length > 0 ? value : undefined
}

// 만료 표기는 배포마다 초/밀리초/ISO 로 갈린다. 초로 보이는 값은 밀리초로 올린다 —
// 2001년 이전(epoch 1e12 미만)의 만료는 현실에 없다.
export function normalizeExpiry(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw < 1e12 ? Math.round(raw * 1000) : Math.round(raw)
  }
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw)
    return Number.isNaN(parsed) ? undefined : parsed
  }
  return undefined
}
