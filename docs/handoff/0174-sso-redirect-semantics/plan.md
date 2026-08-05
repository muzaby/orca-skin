# Plan — 0174-sso-redirect-semantics

## 메타

| 항목 | 값 |
|---|---|
| slug | `0174-sso-redirect-semantics` |
| 작성자 | Claude Code |
| 일자 | 2026-08-05 |
| 매핑 | PR: 브랜치 `claude/multi-provider-login-chain-a97lf7` (0172·0173 과 같은 브랜치) |
| 상태 | READY → 구현 완료 |

## 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 보고 | "sso login 요청시 redirect 가 진행되는데 probe에서 redirect에 의한 cancelled 예외가 발생한다. 임의로 return을 했는데, openauthwindow에서도 리다이렉트 이슈로(err=-3, err_abortrd) 발생하여 로그인 브라우저가 안뜨는것도 수정했다. 이후 bind 과정에서 probe 실패로 인해 로그인성공처리가 안되고 있다." | 라이브 세션 실기 (2026-08-05) |
| 명시 실측 ① | 인증에 **성공한 상태**에서도 probe 가 `ok:false` · `status 302` · **본래의 login URL** 을 돌려준다 | 사용자 답변 |
| 명시 실측 ② | 로그인 창이 안 뜬 원인은 **ERR_ABORTED 뿐** — origin 차단 로그(`auth.browser.navigation-blocked`)는 보지 않았다 | 사용자 답변 |
| 명시 실측 ③ | **probe 가 `ok:true` 를 돌려주게만 하면 로그인 체인이 그대로 이어진다** — probe 판정이 유일한 게이트다 | 사용자 답변 |

## Context (왜)

세 증상의 **뿌리는 하나**다 — Electron 의 `redirect: 'manual'` 은 웹 fetch 규약과 **의미가 다르다**:

> `node_modules/electron/electron.d.ts:19836-19841` — "When mode is `manual` the redirection
> **will be cancelled** unless `request.followRedirect` is invoked **synchronously** during the
> `redirect` event."

`net.fetch`/`Session.fetch` 는 그 `redirect` 이벤트를 호출자에게 노출하지 않는다. 그래서 manual 로
요청하면 3xx 가 오는 순간 **요청이 취소**되고 3xx 응답을 받을 방법이 없다. `probe` 가
`ses.fetch(url, {credentials:'include', redirect:'manual'})` 였으므로 ADFS 의 302 에서 그대로
취소된다 — **증상 ①**.

**같은 함정을 0173 이 커넥터 경로에도 심었다.** `authenticated-fetch.ts` 의 sender 와 `broker.ts` 의
`ctx.fetch` 가 `redirect:'manual'` 로 `netFetch` 를 부르는데, `broker.sendFollowingRedirects` 는
**3xx 를 받아** 정책 재검사 후 다음 홉을 보내도록 설계돼 있다(0160). 그 3xx 가 오지 않으므로
**Confluence 첨부 다운로드의 리다이렉트 추종이 깨진 상태였다** — 이번에 같이 닫는다.

**증상 ③ 은 별개의 설계 문제다.** 인증에 성공해도 probe 가 302 로 로그인 URL 을 가리키므로
(사용자 실측 ①), 0157 이 세운 **"3xx = 미인증"(verify r1 D1)** 규칙으로는 **어떤 경우에도 인증
성공 판정이 나올 수 없다.**

## 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 | **타당 — 원인을 1차 출처로 확정** | 사용자 실측(취소 예외)과 `electron.d.ts:19836-19841` 이 같은 메커니즘을 가리킨다 |
| 이미 있는 것 아닌가 | 없음 — `net.request` 의 `'redirect'` 이벤트를 쓰는 코드가 저장소에 0건 | `rg "on\('redirect'" src/main` → 0 |
| 더 작은 해법이 있는가 | **`redirect:'follow'` 로 되돌리는 것**을 먼저 따졌다. 그러면 0157 D1(로그인 폼 200 을 성공으로 오독)이 그대로 재발하고, 커넥터 쪽은 **credential 이 allowlist 밖 origin 으로 따라간다**(0160 이 막은 것). 채택 불가 | `session-policy.ts` D1 주석 · `broker.sendFollowingRedirects` |
| 인용 자료가 요구를 부풀리지 않았나 | 1차 출처 대조함 — `ClientRequestConstructorOptions` 가 `session`·`credentials`·`redirect` 를 지원하고 `'redirect'` 이벤트가 `(statusCode, method, redirectUrl, responseHeaders)` 를 준다 | `electron.d.ts:6656-6664, 19768-19841` |
| 기존 채택 결정을 뒤집는가 | **1건 뒤집음** — 0157 D1 "3xx = 미인증". 아래 §결정 참조 | |

## 뒤집는 결정 — 0157 D1 (사용자 실측 기반)

D1 의 원래 결함은 "`redirect:'follow'` → ADFS **로그인 폼이 200 을 주니** 인증됨으로 오독" 이었다.
그 교정이 "3xx 면 무조건 미인증" 이었는데, 이번 실측이 그 규칙의 **반례**다. 원래 막으려던 것은
*'로그인 폼을 성공으로 착각하는 것'* 이지 *'리다이렉트 자체'* 가 아니다. 판별자를 **최종 origin**
으로 바꾼다:

| 체인의 결말 | 판정 |
|---|---|
| **probe URL 의 origin 으로 돌아와 2xx** | **인증됨** — SP 가 세션을 세웠다 |
| **IdP·로그인 origin 에 머문 채 끝남** | **미인증** — D1 이 막던 바로 그 경우 |
| 홉이 allowlist 밖으로 나감 | 미인증 + 경고(추종 중단) |
| 홉 상한(5) 초과 | 미인증 — 로그인 루프 |

D1 의 *목적* 은 그대로 두고 *수단* 만 바꾼 것이다.

## 설계

### 1. 리다이렉트를 실제로 다루는 전송자 — 신규 `infra/auth/net-request.ts`

`net.request` 는 `'redirect'` 이벤트에 `(statusCode, method, redirectUrl, responseHeaders)` 를 준다.
`followRedirect()` 를 부르지 않으면 요청이 취소되지만, **그 이벤트 인자만으로 3xx 응답을 재구성**
할 수 있다 — `net.fetch` 로는 불가능한 부분이 정확히 이것이다.

- `sendOnce(opts)` — 요청을 **한 번** 보내고 3xx 를 그대로 돌려준다(따라가지 않는다).
  홉을 도는 것은 정책을 아는 호출자의 몫.
- `session`·`credentials`·`signal`·`bypassCustomProtocolHandlers` 지원. `'redirect'`·`'response'`·
  `'error'` 세 경로에 settled 가드(abort 뒤 늦게 오는 error 흡수).

### 2. 0173 회귀 복구 — `net-fetch.ts`

`netFetch` 가 `init.redirect === 'manual'` 이면 `sendOnceAsResponse` 로 우회한다. 그러면
`broker.sendFollowingRedirects` 의 홉 루프와 정책 재검사가 **설계대로 다시 동작한다**.
`follow`/미지정은 `net.fetch` 그대로(규약이 같다).

### 3. probe 실패의 **방향**을 자리마다 다르게 — `corp-adfs-wia.ts`

사용자 실측 ③: probe 판정이 **유일한 게이트**다. 그런데 probe 는 두 자리에서 쓰이고 오판의 대가가 다르다:

| 자리 | 오판의 대가 | 이번 결정 |
|---|---|---|
| **창을 띄우기 전**(세션 재사용, AUTH-PLAT-006) | 창이 한 번 더 뜬다 — 사용자가 알아채고 진행 | 판정 그대로 신뢰 |
| **창이 완료된 뒤**(확인) | **로그인 자체가 불가능** — 실기 증상 그대로 | **확인용으로 강등** — 실패해도 경고 로그만 남기고 binding 을 만든다 |

근거: 창이 `doneUrlPrefix` 에 도달한 것은 **패키지가 선언한 "로그인 완료" 신호**(`isDone`)다.
그 위에 probe 를 추가 관문으로 세우면 규칙이 조금만 어긋나도 로그인이 통째로 막힌다.
fail-safe 방향도 옳다 — 오판의 최악은 "만료 세션으로 binding" 이고 그건 첫 요청 401 로 드러나
재로그인으로 이어진다. 반대 방향은 앱을 아예 못 쓴다.

### 4. probe 홉 루프 — `browser-session-store.ts` + `session-policy.ts`

`ses.fetch` 를 버리고 `sendOnce(session)` 로 홉을 돈다. 홉마다 `isAllowedOrigin` 을 먼저 확인하고,
상한을 넘기면 중단. 최종 status + 최종 URL 로 `classifyProbeChain` 이 판정한다(순수, P29).
**실패 판정의 근거를 로그로 남긴다**(status·hops·finalOrigin·stopped) — 없으면 다음 수정 지점이 안 보인다.

### 5. 로그인 창 — `ERR_ABORTED` 는 실패가 아니다

`loadURL` 거절을 무조건 치명으로 보고 창을 `destroy()` 한 것이 증상 ②다. `isAbortedNavigationError`
(순수)로 판별해 무시하고, 결말은 내비게이션 이벤트·타임아웃·사용자 닫기가 정한다. 차단된 origin 은
로그에 싣는다(어느 호스트를 선언해야 하는지 지목).

## 인수 기준

| # | 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | 인증된 체인(302→IdP→302→probe origin 2xx)이 **인증됨**으로 판정된다 | `browser-session-store.test.ts::"체인이 probe origin 으로 완주하면 인증이다"` | `provider.begin` → `bindIfAuthenticated` |
| 2 | 로그인 폼에서 멈춘 체인은 **미인증**이다 — 0157 D1 회귀 방지 | `::"IdP 로그인 폼에서 멈추면 미인증이다"` | 동상 |
| 3 | allowlist 밖 홉은 추종을 멈추고 미인증 + 경고 | `::"allowlist 밖 홉에서 멈추면 미인증 + 경고다"` | 동상 |
| 4 | 홉 상한 초과는 미인증 | `::"홉 상한을 넘기면 미인증이다"` | 동상 |
| 5 | `ERR_ABORTED(-3)` 는 비치명, 다른 오류는 치명 | `::"errno -3 과 code ERR_ABORTED 를 모두 비치명으로 본다"` · `::"다른 오류는 치명으로 남긴다"` | `openLoginWindow` |
| 5-b | **창 완료 뒤 probe 가 실패해도 binding 이 만들어진다**(경고 로그는 남는다) | `corp-adfs-wia.test.ts::"probe 가 실패해도 로그인은 성공한다…"` · `::"probe 가 예외를 던져도…"` | `provider.begin` → broker `applyStep` |
| 5-c | **창 앞** probe 실패는 창을 연다(세션 재사용 판정은 살아 있다) | `corp-adfs-wia.test.ts::"세션이 없으면 창을 연다…"` · `::"세션이 살아 있으면 창을 열지 않고…"` | 동상 |
| 5-d | 창 자체가 실패하면 로그인도 실패한다(완료 신호가 없으면 근거가 없다) | `corp-adfs-wia.test.ts::"창이 실패하면 로그인도 실패한다"` | 동상 |
| 6 | `redirect:'manual'` 이 **3xx 응답을 돌려준다**(취소되지 않는다) — 커넥터 홉 루프의 전제 | `net-response.test.ts::"합성한 Response 가 3xx status 와 Location 을 그대로 노출한다"` 외 8건 | `broker.sendFollowingRedirects` → 첨부 다운로드 |
| 7 | 사내망에서 **SSO 로그인이 끝까지 성공**한다 | **사람 실기** — `npm run dev` → 로그인 → 사이드바 신원 표시 | 실사용 |
| 8 | 사내망에서 **Confluence 첨부 다운로드**(302 추종)가 성공한다 — 0173 회귀 복구 | **사람 실기** — `confluence_get_pages` 로 이미지 포함 페이지 | 실사용 |

> AC1~6 은 기계 검증(전부 순수 모듈). **AC7·8 은 사람 실기** — `net.request` 는 Electron 런타임
> 전용이라 이 샌드박스에서 실행 불가. "테스트 green = 동작 확인" 으로 보고하지 않는다.

## 영향 받는 파일

- 신규: `infra/auth/net-request.ts`(electron 경계) · `infra/auth/net-response.ts`(순수) +
  `net-response.test.ts` · `features/auth-platform/providers/corp-adfs-wia.test.ts`
- 수정: `infra/auth/net-fetch.ts` · `infra/auth/browser-session-store.ts`(+테스트) ·
  `infra/auth/session-policy.ts` · `features/auth-platform/providers/corp-adfs-wia.ts`
- 문서: 이 문서 · `docs/handoff/INDEX.md` · `src/main/AGENTS.md`

## 게이트

`cd app && npm run lint && npm run typecheck && ./node_modules/.bin/vitest run`

---

## [구현자 기입] 설계 리뷰 (비판적)

- **동의**: "뿌리는 하나(리다이렉트 의미 차이)" 라는 진단이 구현에서 그대로 맞았다. 전송자 하나
  (`sendOnce`)로 probe·커넥터 두 경로가 동시에 풀렸다.
- **동의**: probe 를 자리별로 나눈 것이 핵심이었다. 판정 규칙만 고쳤다면 그 규칙이 또 어긋나는
  배포에서 같은 증상이 재발한다 — 창 완료 후 강등이 **증상의 재발 자체를 막는다**.
- **이견 없음.**

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `Response` 생성자는 **배열 헤더를 받지 못한다**. Electron 응답 헤더는 배열이라 `toResponse` 가 그대로 넣으면 던진다 | ✅ 구현함 — `toResponse` 안에서 `flattenHeaders` 를 거치고, 회귀 테스트(`"배열 헤더를 그대로 넘겨도 Response 가 만들어진다"`)를 붙였다 | `net-response.ts` typecheck 에서 먼저 드러남 |
| 2 | `request.abort()` 뒤에 `'error'` 가 **뒤늦게** 올 수 있다 → 이미 resolve 된 promise 에 reject | ✅ 구현함 — `settled` 가드로 세 경로(redirect·response·error)를 하나로 묶었다 | `net-request.ts` |
| 3 | `signal` 이 이미 abort 된 상태로 들어올 수 있다 | ✅ 구현함 — 요청을 만들기 전에 확인하고 즉시 reject | 동상 |
| 4 | probe 실패 시 **근거가 없으면 다음 수정 지점을 못 찾는다**(이번 디버깅이 그랬다) | ✅ 구현함 — `auth.probe.unauthenticated` 에 status·hops·finalOrigin·stopped 를, 차단 시 `blockedOrigin` 을 싣는다. **경로·쿼리는 싣지 않는다**(토큰 유출 방지 — `safeOrigin`) | `browser-session-store.ts` |
| 5 | 홉 루프가 `MAX_PROBE_HOPS` 를 **초과 요청**할 수 있다(경계 off-by-one) | ✅ 구현함 — 다음 홉을 만들기 **전에** 상한을 확인한다. 상한 도달 시 `stopped:'too_many_hops'` | 동상 |

## [구현자 기입] 구현 체크리스트

- [x] `net-request.ts` — `sendOnce`(redirect 이벤트로 3xx 재구성) + `sendOnceAsResponse`
- [x] `net-response.ts` — 헤더 평탄화 · 3xx 합성 · `locationOf` (순수, 11 테스트)
- [x] `net-fetch.ts` — `redirect:'manual'` 우회로 0173 회귀 복구
- [x] `session-policy.ts` — `classifyProbeChain` · `MAX_PROBE_HOPS` · `isAbortedNavigationError`
- [x] `browser-session-store.ts` — probe 홉 루프 · ERR_ABORTED 무시 · 진단 로그
- [x] `corp-adfs-wia.ts` — 창 완료 후 probe 강등 (+테스트 5건)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 4(`net-request.ts`·`net-response.ts`+테스트·`corp-adfs-wia.test.ts`) / 수정 4(`net-fetch.ts`·`browser-session-store.ts`+테스트·`session-policy.ts`·`corp-adfs-wia.ts`) |
| 게이트 결과 | lint ✅ **0 error**(잔여 warning 1건은 기존 `useTranscriptVirtualizer`) · typecheck ✅ **3/3** · vitest ✅ **2001/2001**(0173 대비 +26) |
| 알려진 환경 실패 | `chat-turn.continuity.test.ts` 1파일 — Electron 바이너리 부재(변경 무관) |
| 블로커 / 역질문 | 없음. **AC7·8(사람 실기)만 미확인** — `net.request` 는 Electron 런타임 전용 |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
