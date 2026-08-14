// 브라우저 세션 인증 방식의 **선언 표면과 포트** (0181 → 0188 분리).
//
// ── 전제 (사용자 확인 2026-07-31, 2026-08-10 재확인) ─────────────────────────
// 폐쇄망 사내 앱은 첫 로그인에서 WIA 로 ADFS 세션을 만든 뒤, 후속 서비스 로그인에 **동일한
// Electron partition** 을 써서 ADFS 쿠키를 재사용한다. 중앙 OAuth OBO 나 KCD 가 아니다.
//
// ── "둘 다 필요" 의 구체 형태 (사용자 2차 결정) ──────────────────────────────
//   ① 게이트 로그인    — 창이 doneUrlPrefix 에 도달 → probe 로 판정 → `session` grant
//   ② 토큰이 필요한 곳 — `config.exchange` 가 선언돼 있으면 **그 세션의 cookie jar 로** 사내
//      API 를 불러 토큰을 받아 `token` grant 로 승격한다. 표준 OAuth 왕복이 아니라 세션 교환이다.
//
// **로그인 흐름 자체는 `../browser-session/runner.ts` 가 갖는다** (0188) — 여기에는 포트와
// 응답 해석 헬퍼만 둔다. Electron partition/cookie jar 구현은 `infra/browser-session.ts` 다.
//
// **electron 을 import 하지 않는다** — 창·세션은 포트로 주입받는다(`BrowserSessionPort`).
// 그래야 이 파일이 vitest 대상으로 남는다(P29: electron 을 무는 파일은 테스트가 즉시 죽는다).

import type { SessionGroupPolicy } from '../../../infra/browser-session-policy'
import type { PreparedRequest, SendOptions, SendResult } from '../../../infra/net/transport'

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
