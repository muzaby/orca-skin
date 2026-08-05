// Chromium 네트워크 스택 전송자 (0173) — **electron `net` 을 무는 유일한 파일**.
//
// ── 왜 Node 전역 fetch 가 아닌가 ──────────────────────────────────────────────
// Node(undici) 스택과 Chromium 스택은 폐쇄망 사내 배포에서 세 가지가 결정적으로 다르다:
//   1. **프록시** — Chromium 은 OS 프록시 설정·PAC 를 따르고, undici 는 따르지 않는다.
//   2. **인증서** — Chromium 은 OS 신뢰 저장소를 본다. undici 는 Node 자체 CA 번들만 보므로
//      사내 사설 CA 로 서명된 서버는 검증에 실패한다 — *브라우저로는 열리는데 앱만 안 되는*
//      증상이 여기서 나온다.
//   3. **클라이언트 인증서·세션 설정**이 붙지 않는다.
//
// ── 이 파일을 테스트가 import 하지 않는다 (P29) ──────────────────────────────
// `vitest.config.ts` 에 electron alias 가 없어서 electron 을 무는 모듈을 테스트가 import 하면
// 즉시 죽는다. 그래서 electron 경계를 **파일 단위로** 긋고, 이 파일은 컴포지션 루트
// (`app/bootstrap.ts`)만 import 한다. 소비자들은 `typeof fetch` 포트로 주입받는다.
//
// ── 호출 시점 ────────────────────────────────────────────────────────────────
// `net.fetch` 는 **app ready 이후**에만 동작한다. 여기의 export 는 함수이므로 모듈 로드 시점에는
// 아무것도 하지 않는다 — 요청하는 순간에만 `net` 에 닿는다. 모듈 최상위에서 부르지 마라.

import { net } from 'electron'

// 표준 `RequestInit` 을 그대로 받는다(`redirect`·`credentials`·`signal`·`body` 전부 통과).
// `bypassCustomProtocolHandlers` 를 켜는 이유: 이 앱은 `app://` 커스텀 프로토콜 핸들러를
// 등록하므로(`index.ts`), 외부 API 요청이 자기 핸들러로 말려들 여지를 없앤다.
export const netFetch: typeof fetch = (input, init) =>
  net.fetch(input as string | Request, { ...init, bypassCustomProtocolHandlers: true })
