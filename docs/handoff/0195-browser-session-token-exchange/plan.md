# Plan — 0195-browser-session-token-exchange

## 메타

| 항목 | 값 |
|---|---|
| slug | `0195-browser-session-token-exchange` |
| 작성자 | Claude Code |
| 일자 | 2026-08-21 |
| 매핑 | — |
| 상태 | IMPL_DONE (r1) |

# Part I — Product & UX Contract

## 1. Context / 목표

- **해결하려는 문제**: browser-session 로그인이 access token 을 받아 쓸 수 없다. `config.exchange` 를 선언하면 로그인이 `probe_failed` 로 끝나거나(probe 선언 시), 커밋되더라도 이후 모든 API 호출이 `grant_not_valid` 로 던진다 — 근거는 §8.
- **완료 후 달라지는 것**: SP 가 로그인 final URL 로 돌려준 인가 코드를 토큰으로 교환하고, 그 토큰을 `Authorization: Bearer` 로 실어 API 를 호출한다. 토큰을 주지 않는 세션 기반 SP 는 쿠키로 계속 호출하되 인증이 끊기면 `expired` 로 강등돼 재인증 지점이 뜬다.
- **성공 한 문장**: 폐쇄망 배포가 선언 하나로 "SSO 로그인 → 코드 → 토큰 → Bearer API" 를 얻고, 토큰 없는 SP 도 같은 선언 형식 안에서 동작한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ① | "browser session 로그인 시 access token 교환도 지원해야 함." | 라이브 세션 2026-08-21 |
| 명시 요구 ② | "sp가 final url에서 code 쿼리 반환 (code 이름이 아닐 수 있음)" | 〃 |
| 명시 요구 ③ | "code 로 access token 교환. refresh token 을 포함할수도 아닐수도 있음." | 〃 |
| 명시 요구 ④ | "api 호출 시, access token을 가지고 있는 경우에는 헤더 bearer 에 실어야 함." | 〃 |
| 명시 요구 ⑤ | "sp의 구현에 따라 token 지원을 안할 수도 있음. (세션기반). 이 경우 api 호출 시 token 없어도 됨. 단 api 실패시 expired 상태가 되며 재인증 필요." | 〃 |
| 추론 의도 | ④ 는 신규 기능이 아니라 **잠재 결함 수정**이다 — 교환 경로가 지금 어느 방향으로도 동작하지 않는다(§8) | 코드 조사, 설계자 판단 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | `SessionTokenExchange.present: Presentation` 을 **필수**로 둔다 | `contracts/auth.ts:33-36` 의 "kind 에서 추론하지 않는다" 를 승계한다. 헤더 이름이 다른 SP 도 같은 자리로 흡수된다 | 사용자 선택 "exchange.present 필수" | ACTIVE | — |
| D-002 | 교환 요청 형상은 **선언이 정한다** — `code.in`·`code.name`·`code.params`·`method` | code 이름이 SP 마다 다르다는 요구 ② 가 곧 비표준 SP 를 뜻한다. 한 형상으로 고정하면 표준·비표준 중 하나를 버린다 | 사용자 선택 "선언이 정한다" | ACTIVE | — |
| D-003 | refresh token 은 **저장만 한다. 갱신 기능은 지금 지원하지 않는다** | 원문: "저장하되 만료시 재로그인. refresh 토큰 반환하면 저장만. 기능은 지금 지원하지 않는다." | 사용자 답변 | ACTIVE | — |
| D-004 | 세션 grant 요청이 **401/403 또는 `definition.origin` 미복귀**면 `markExpired` 한다 | SSO 는 세션이 죽으면 401 이 아니라 IdP 로그인 폼을 200 으로 준다(`contracts/auth.ts:272-277`). 401 만 보면 요구 ⑤ 가 성립하지 않는다 | 사용자 선택 "401/403 + origin 미복귀" | ACTIVE | — |
| D-005 | code 는 final URL 에서 추출한다. `code.param` 미지정 시 기본 이름은 `'code'` | 원문: "code 미선언 시 디폴트로 'code' 쿼리 추출. 선언시 해당 값으로 쿼리추출" | 사용자 정정 1 | ACTIVE | — |
| D-006 | `exchange` 선언 시 **`code` 필수**. 쿠키만으로 토큰을 얻던 0181 경로를 **제거**한다 | 원문: "code 미선언시 code를 반환하지 않는 sp 로 간주하라. 쿠키에서 토큰 추출도 하지 말것." 코드를 안 주는 SP 는 `exchange` 자체를 선언하지 않는다 → 세션 grant | 사용자 정정 2 | ACTIVE | — |
| D-007 | 교환 요청은 **`sessions.send()`** 로 보내 파티션·쿠키를 유지한다 | 원문: "파티션을 유지하여 쿠키사용되도록. 내 말은 쿠키에서 무언가를 파싱하는 행위는 하지 말라는 것". "쿠키 사용안함" 은 **토큰 출처** 에 대한 제약이지 전송에 대한 제약이 아니다 | 사용자 정정 3 | ACTIVE | 직전 "netFetch" 선택을 대체 |

### 갱신 메모

- **새로 추가된 결정**: D-001 ~ D-007 (이번 handoff 가 최초).
- **변경된 결정**: 사용자 답변 "쿠키 없이 (netFetch)" → 정정 3 으로 **D-007** 이 됐다. 정정 근거는 사실 오류였다 — 제시한 선택지가 "netFetch 는 파티션을 탄다" 를 전제하지 않았음을 사용자가 확인 요청했고, 실측 결과 `netFetch` 는 세션 인자 없이 `net.fetch` 를 부르고(`infra/net/net-fetch.ts:40`) `createSender` 가 `credentials:'omit'` 을 박아(`infra/net/transport.ts:54`) 파티션도 쿠키도 타지 않는다. 파티션 유지 경로는 `BrowserSessionStore.send()` 하나다.
- **정정 1 과 정정 2 의 관계**: 둘은 서로 다른 층이다. 정정 1 은 **파라미터 이름의 기본값**(`'code'`)을, 정정 2 는 **`code` 객체 자체의 필수 여부**를 정했다. 둘 다 ACTIVE 로 성립한다 — `code` 는 필수이고 그 안의 `param` 은 선택이며 기본값이 `'code'` 다.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0.
  - D-001 ↔ AC1·AC2 — `present` 가 있어야 bearer 가 실린다. 일치.
  - D-002 ↔ AC3·AC4 — `in:'query'` / `in:'form'` 두 형상을 각각 단언. 일치.
  - D-003 ↔ AC9·AC10 — AC9 는 "저장한다", AC10 은 "갱신하지 않는다". **AC10 이 D-003 의 반대를 요구하지 않는지 확인함** — D-003 은 "기능은 지금 지원하지 않는다" 이고 AC10 은 `'unsupported'` 를 단언하므로 같은 방향이다.
  - D-004 ↔ AC12·AC13 — AC12 는 강등을, AC13 은 그 강등이 방송 상한을 늘리지 않음을 단언. 일치.
  - D-005 ↔ AC3·AC5 — AC3 은 선언한 이름(`ticket`), AC5 는 기본 이름(`code`). 둘이 D-005 의 두 절을 각각 덮는다.
  - D-006 ↔ AC6·AC11 — AC6 은 code 부재 시 실패(=쿠키 폴백 없음), AC11 은 `exchange` 미선언 시 세션 grant. **"쿠키 교환 제거" 를 반증하는 AC 가 없는지 전수 확인함** — AC1~AC14 중 쿠키로 토큰을 얻는 경로를 요구하는 행은 0건.
  - D-007 ↔ AC7·AC8 — AC7 은 `sessions.send` 경로(파티션 유지), AC8 은 토큰이 쿠키에서 파생되지 않음. 두 결정 절을 각각 덮는다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | **타당 + 전제 정정** — ④ 는 "기능 추가" 로 요청됐으나 실제로는 교환 경로 전체가 죽어 있다 | `authenticated-request.ts:330-332` → `:286-291` throw. §8 표 |
| 이미 기존 코드가 충족하는가 | **부분 충족** — ⑤ 의 401 강등은 있다. 그러나 SSO 의 200+로그인폼 경로가 빠져 있다 | `authenticated-request.ts:165-176` · `contracts/auth.ts:272-277` |
| 더 작은 해법이 있는가 | **없다** — `oauth` + `redirect:{kind:'window'}` 는 전용 세션 그룹 `'oauth'` 를 쓰고 allowlist 가 authorize origin 하나라 SSO jar 공유도 ADFS→portal 체인도 불가 | `app/bootstrap.ts:211-213`(그룹 상수) · `:258-269`(allowlist 조립) |
| 선행 자료의 주장을 코드와 대조했는가 | **가이드 1건 정정 필요** — §2-b 가 "쿠키로 토큰을 받는다" 를 현재 동작으로 서술하는데 그 경로는 D-006 으로 제거된다 | `docs/guides/closed-network-extensions.md:351-373` |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | **충돌 없음** — §16 참조. D-003 은 0194 의 refresh 계약을 **건드리지 않는** 방향이다 | `login.ts:374` 의 `authKind !== 'oauth'` 게이트 유지 |

- **사용자에게 올릴 결정**: 없음 (D-001~D-007 로 전부 닫혔다).
- **코드 조사로 닫은 사실**: 프로덕션 `exchange` 선언 0건 · `markExpired` 프로덕션 호출부 2곳 · `presentationFor` 호출부 1곳 · `getJson` 호출부 2곳 (§8 전수 조사).

## 5. 동작 / 사용자 흐름

```text
[연결] 클릭
  → 로그인 창 (sessionGroup cookie jar · WIA/ADFS)
  → doneUrlPrefix 도달 → finalUrl 확보
  ├ exchange 미선언 → session grant (쿠키가 곧 자격증명)
  └ exchange 선언  → finalUrl 에서 `code.param ?? 'code'` 추출
        ├ 없음 → ❌ exchange_failed · grant 미커밋 · 이전 자격증명 보존
        └ 있음 → sessions.send() 로 교환 (파티션·쿠키 유지)
                 → access token (+ refresh token 선택)
                 → token grant (authKind:'browser-session')
  → probe (present 로 bearer 를 싣고 나간다)
  ├ 통과 → ✅ 연결됨 · 이후 API 는 Authorization: Bearer <token>
  └ 실패 → ❌ probe_failed · [연결] 을 다시 눌러 창부터 다시 연다
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| `exchange` 선언 Auth 로그인 성공 | code 추출 → 교환 → token grant 커밋 | 연결됨. 사이드바에 principal(있으면) |
| final URL 에 code 파라미터 없음 | `exchange_failed` · 로그에 **찾던 이름만** | "인가 코드를 찾지 못했습니다" · 이전 연결 유지 |
| 교환 응답이 비-2xx / 비-JSON | `exchange_failed` (기존 문장 유지) | "토큰 교환이 N 로 실패했습니다" 등 |
| 교환 응답에 `valuePath` 값 없음 | `exchange_failed` · 로그에 `valuePath` | "토큰 응답에서 값을 찾지 못했습니다" |
| token grant 로 API 호출 | `Authorization: Bearer <token>` | 정상 응답 |
| token grant 가 401/403 | `markExpired` + 통지 | 연결 만료 · 재인증 지점 |
| token grant 시계 만료 | 기존 `settleExpiry` 경로 | 만료 · 부팅 시 자동 재로그인 시도(창) |
| **세션 grant 요청이 401/403** | `markExpired` + 통지 (현행) | 만료 · 재인증 지점 |
| **세션 grant 요청 체인이 origin 밖에서 끝남** | `markExpired` + 통지 (**신규** D-004) | 만료 · 재인증 지점 |
| `exchange` 미선언 Auth 로그인 | session grant | 연결됨. 토큰 없음 |

### 파생 UX / 엣지케이스

- **error**: 교환 실패 4종은 모두 `exchange_failed` 로 접히고 `ProviderStepInfo.message` 로 화면에 뜬다. 새 사유(`code 없음`)도 같은 자리를 쓴다 — `ProviderFailureReason` 을 늘리지 않으므로 renderer·i18n 변경이 0이다.
- **cancel**: 사용자가 창을 닫으면 `cancelled` (현행 `runner.ts:59-62` 그대로).
- **concurrency**: 교환 중 사용자가 [연결 해제]·재시도하면 `settleGrant` 의 attempt fence 가 커밋을 버린다(현행 유지).
- **비밀 노출**: code 값·access token·refresh token 은 **로그에 싣지 않는다.** 실패 로그는 찾던 이름(`param`·`valuePath`)만 찍는다 — 0182 의 whoami 로그 규칙과 같다.
- **폐쇄망**: 교환 요청이 `sessions.send()` 를 타므로 Chromium 스택·OS 프록시·사설 CA·파티션이 전부 유지된다(D-007).

## 6. 범위 / 비범위

- **범위**: `SessionTokenExchange` 계약 확장 · final URL code 추출 · code→token 교환 · bearer presentation 수정 · 세션 grant 의 origin 미복귀 강등 · 배포 가이드/아키텍처 문서 갱신.
- **비범위**: browser-session 의 refresh 갱신 실행(D-003) · PKCE/state(아래) · `whoami` 전송 경로 변경 · redirect 차단(`checkRedirect` throw) 시의 강등 · `oauth` 방식 변경.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| browser-session refresh 실행 | **아니오** — `Grant.refreshKey` 는 이번에 채워지므로 나중에 `LoginService.refresh` 게이트만 열면 된다 | 후속 |
| code 흐름의 PKCE·state | 아니오 — `loginUrl` 이 정적 문자열이라 challenge 를 실으려면 `BrowserSessionConfig` 가 `AuthCtx` 를 받아야 한다. 별도 설계 | 후속. 표준 AS 를 상대하면 `oauth` 방식이 이미 있다 |
| `refreshExpiresAtPath` | 아니오 — D-003 으로 소비자가 0이라 지금 두면 죽은 필드다 | 두지 않는다 |
| redirect 차단 시 강등 | 아니오 — 정책 위반은 만료가 아니라 **선언 오류**일 수 있고, 강등하면 재로그인 루프가 된다 | 후속(§17) |

## 7. Acceptance Criteria — 제품 계약

| # | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|
| AC1 | `exchange` 를 선언한 browser-session 의 token grant 로 API 를 부르면 요청 헤더에 `Authorization: Bearer <token>` 이 실린다 | `authenticated-request.test.ts` — token grant(`authKind:'browser-session'`) 를 넣고 `api.request()` 호출 → 주입 `fetchImpl` 이 받은 헤더 단언. **현행은 throw 하므로 이 테스트가 지금 실패한다** | `BoundAuth.request` → `resolveCarrier` → `applyPresentation` |
| AC2 | 같은 Auth 의 **로그인 probe** 가 후보 token 을 bearer 로 싣고 나가 로그인이 `done` 으로 끝난다 | `login.test.ts` — `probe` 선언 + `exchange` 선언 Auth 로 `begin()` → step `done` + probe 요청 헤더 단언 | `LoginService.settleGrant` → `probeOk(candidate)` |
| AC3 | final URL 이 `?ticket=abc` 이고 `code:{param:'ticket', in:'query'}` 면 교환 요청 URL 에 `ticket=abc` 가 실린다 | `runner.test.ts` — fake `openLoginWindow` 가 그 finalUrl 을 주고, fake `sessions.send` 가 받은 url 단언 | `SessionRunner.login` → `exchange` |
| AC4 | `code.in:'form'` 이면 교환 요청이 POST + `content-type: application/x-www-form-urlencoded` 이고 본문에 code 와 `code.params` 항목이 함께 실린다 | `runner.test.ts` — `sessions.send` 가 받은 `method`·`headers`·`body` 단언(본문은 `URLSearchParams` 파싱 후 키·값 비교) | 〃 |
| AC5 | `code.param` 미지정이면 `'code'` 라는 이름으로 찾는다 | `runner.test.ts` — `?code=xyz` finalUrl + `code:{in:'query'}` → 교환 요청에 `code=xyz` | 〃 |
| AC6 | final URL 에 그 파라미터가 없으면 `exchange_failed` 로 끝나고 grant 가 커밋되지 않으며, 로그에 **값이 아니라 찾던 이름**이 남는다 | `runner.test.ts` — 결과 `{kind:'failed', reason:'exchange_failed'}` + fake logger 인자에 `param` 존재·code 값 부재 단언. `login.test.ts` — 재인증 실패 후 `store.get()` 이 이전 grant 그대로 | 〃 → `absorb('failed')` |
| AC7 | 교환 요청이 **`sessions.send()`** 로 나간다 — 파티션·쿠키가 유지된다 | `runner.test.ts` — `sessions.send` 가 교환 URL 로 호출됨을 단언하고, `SessionRunner` 가 `fetchImpl` 을 **받지 않음**을 타입으로 고정(deps 에 없다) | `SessionRunner` → `BrowserSessionPort.send` → `sendOnce({session, credentials:'include'})` |
| AC8 | 토큰은 **교환 응답 JSON 에서만** 나온다 — 쿠키를 읽어 토큰을 만드는 경로가 0건이다 | ⓐ `runner.test.ts` — 같은 쿠키·다른 응답 본문이면 grant 토큰이 응답을 따라 바뀐다 ⓑ 위생 테스트 — `rg` 로 `features/auth/**` 에 `cookies` 읽기 API 호출 0건(허용 예외: `BrowserSessionPort.clear`) | — (불변식 가드) |
| AC9 | `refreshTokenPath` 가 값을 주면 `Grant.refreshKey` 가 생기고 vault 에 봉인된다. 경로 미선언이거나 값이 없으면 `refreshKey` 는 `undefined` 다 | `login.test.ts` — 두 케이스로 `store.get()` 의 `refreshKey` 와 `vault.names()` 단언 | `absorbToken` → `tokenCandidate` → `writeVault` |
| AC10 | browser-session token grant 에 `auth.refresh()` 를 부르면 `'unsupported'` 다 (D-003) | `login.test.ts` — `refreshKey` 가 **있는** grant 로도 `'unsupported'` 임을 단언(있으니 되겠지를 막는다) | `LoginService.refresh` |
| AC11 | `exchange` 미선언 Auth 는 토큰 없이 cookie jar 로 요청하고 401 에 `expired` 가 된다 | `authenticated-request.test.ts` — 기존 세션 grant 케이스 + 401 응답 → `store.status()==='expired'` | `resolveCarrier`(session) → `transport` |
| AC12 | 세션 grant 요청의 체인이 200 이어도 `definition.origin` 밖에서 끝나면 `expired` 로 강등되고 `onUnauthorized` 가 **1회** 나간다 | `authenticated-request.test.ts` — allowedOrigins 안의 IdP 로 302 → 200 으로 끝나는 fake → `status()==='expired'` + 통지 호출 수 1 | `request()` 의 강등 분기 |
| AC13 | AC12 의 강등을 부팅 복원 probe 가 다시 관측해도 방송이 늘지 않는다 — `auth.md §5.2` 의 `P + 1` 이 불변이다 | `auth-resume.test.ts` 방송 상한 describe 에 케이스 추가 — origin 미복귀로 실패하는 probe 후보 1건에서 `pushConnectionState` 호출 수가 기존 식과 같음 | `auth-resume.resumeRemainingOnce` |
| AC14 | 가이드 §2-b 의 새 예제를 실제 `auth-definitions.ts` 에 대입하면 `npm run typecheck` 3/3 을 통과한다 | 붙여넣고 실행한 뒤 되돌린다(0181 5단계-e · 0182 AC11 · 0183 선례) | 배포 선언 컴파일 |

### AC 검증 주의사항

- **기존 테스트 재사용**: `runner.test.ts` 에 `describe('SessionRunner — ② 세션으로 토큰 교환')` 이 실재하고 케이스 2건(`:89`, `:111`)이 있다 — **그 2건은 쿠키 교환을 단언하므로 D-006 으로 재작성 대상**이다. `authenticated-request.test.ts` 의 세션 grant describe(`:100`)도 실재하며 AC11 은 그 자리에 붙는다.
- **AC8-ⓑ 의 술어는 해법 이름이 아니라 불변식의 주어다**: "쿠키를 읽는 호출" 을 찾는다(`\.cookies\b`), "내가 만든 함수가 안 불린다" 를 찾지 않는다. 허용 예외는 `BrowserSessionPort.clear` 의 구현(`infra/browser-session.ts:171`) 하나이고 그것은 `features/auth/**` 밖이라 검색 범위에서 이미 빠진다.
- **AC12 의 "1회"**: sink 는 `onUnauthorized` 이고 프로덕션 **호출**부는 `authenticated-request.ts:174` **1곳**이다(`rg -n 'onUnauthorized\?\.\(' src/main -g '!*.test.ts'` → 1건). 관측 지점(fake 콜백)이 그 유일한 호출부를 그대로 모형한다 — 모형되지 않는 항이 없다.
- **AC13 의 상한 식**: `P + 1` 은 `docs/arch/backend/auth.md §5.2` 가 정본이다. 이 AC 는 **새 항을 더하지 않음**을 단언하지 실제 총량을 다시 세지 않는다 — 총량은 조건부라 상수가 아니라고 그 문서가 이미 적었다.
- **사람 실기 항목**: 없다. 창·전송·vault 는 전부 포트로 주입되므로 순수 테스트로 닫는다.

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| `presentationOf` 가 `browser-session` 에 대해 무조건 `null` 을 돌려준다 | `app/src/main/features/auth/authenticated-request.ts:330-332` |
| 그 `null` 이 `resolveCarrier` 에서 `AuthPolicyError('grant_not_valid')` 로 바뀐다 | 같은 파일 `:286-291` |
| 세션 교환은 `Grant{kind:'token', authKind:'browser-session'}` 를 만든다 — 위 두 줄과 만나면 못 쓰는 grant 다 | `browser-session/runner.ts:174` → `login.ts:781` → `tokenCandidate:847-861` |
| probe 도 같은 경로를 타므로 `probe` 선언 시 **로그인 자체가 실패**한다 | `login.ts:483-489`(요청) · `:502-509`(catch → false) · `settleGrant:548-552`(rejected) |
| `openLoginWindow` 의 `{finalUrl}` 이 버려진다 | `browser-session/runner.ts:55-58` — `await` 만 하고 대입이 없다 |
| `getJson` 은 GET 고정이다 — method·body 를 받을 자리가 없다 | 같은 파일 `:105-129` |
| 401/403 강등은 있으나 origin 미복귀는 보지 않는다 | `authenticated-request.ts:165-176` |
| SSO 미인증은 **200 + IdP 폼**이 정상이라 status 만으로는 오독한다 | `contracts/auth.ts:272-277` (0174 실기 주석) |
| `probeOk` 는 이미 `isAllowedOrigin(finalUrl, [origin])` 으로 그 판정을 한다 — 규칙이 이미 존재한다 | `login.ts:492` |
| `refresh` 는 `authKind !== 'oauth'` 를 `unsupported` 로 접는다 | `login.ts:374` |
| `netFetch` 는 세션 인자 없이 `net.fetch` 를 부른다 — 파티션을 타지 않는다 | `infra/net/net-fetch.ts:40` |
| `createSender` 는 `credentials:'omit'` 을 박는다 — 쿠키를 싣지 않는다 | `infra/net/transport.ts:54` |
| 파티션+쿠키를 쓰는 유일한 전송은 `BrowserSessionStore.send()` 다 | `infra/browser-session.ts:138-146` (`session: entry.ses, credentials:'include'`) |
| `isAllowedOrigin` 은 `features/auth/policy.ts:14` 가 재export 한다 — feature 에서 바로 쓸 수 있다 | 원본 `infra/browser-session-policy.ts:39` |
| main 전역 `fetch(` 금지 가드가 `src/main/**` 전수를 훑는다 — 배포 선언도 대상이다 | `infra/net/no-node-fetch.test.ts` (`MAIN_ROOT = src/main`) |
| `oauth` 의 window 분기는 **전용 그룹** `'oauth'` + authorize origin 하나만 허용한다 | `app/bootstrap.ts:211-213` · `:258-269` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 프로덕션 `config.exchange` 선언 | `AUTH_DEFINITIONS` 배열 확인 | **0** | 계약 파괴 비용이 지금 최소다. 선언은 테스트 3건·가이드 예제 2건뿐 |
| `markExpired` 프로덕션 호출부 | `rg -n 'store\.markExpired\(' src/main -g '!*.test.ts'` | **2** | `authenticated-request.ts:166` · `login.ts:339`. §10 강제 지점 |
| `presentationFor` 호출부 | `rg -n 'presentationFor\(' src/main -g '!*.test.ts'` | **1** | `authenticated-request.ts:281` (정의 `:321` 제외) |
| `getJson` 호출부 | `rg -n 'this\.getJson\(' src/main -g '!*.test.ts'` | **2** | whoami(`runner.ts:91`) · exchange(`:150`) — D-007 로 전송이 갈리지 않으므로 둘 다 `sessions.send` 유지 |
| `onUnauthorized` 프로덕션 **호출**부 | `rg -n 'onUnauthorized\?\.\(' src/main -g '!*.test.ts'` | **1** | `authenticated-request.ts:174` — AC12 의 "1회" 가 이 항 하나를 센다. 타입 선언(`:92`)·주입(`runtime.ts:156`)·주석(`login.ts:333`)은 호출이 아니라 제외 |
| `openLoginWindow` 호출부 | `rg -n 'openLoginWindow\(' src/main -g '!*.test.ts'` | **2** | `runner.ts:55`(이번 변경) · `bootstrap.ts:264`(oauth window, 무변경). 포트 선언·구현 제외 |
| `SessionTokenExchange` 참조 | `rg -n 'SessionTokenExchange' src/main` | **3** | 계약 1(`contracts/auth.ts:141`) + runner 2 |

### 수치 / 전칭 표현 검산

- 재측정 수치는 위 표가 전부이며 이번 세션에서 직접 셌다.
- "전역 `fetch` 를 부를 수 있는 파일은 하나뿐" — 가드가 `src/main` 전수를 훑으므로 배포 선언이 교환 요청을 직접 짜면 위반이다. 이 설계는 코어가 요청을 만들어 그 함정을 피한다.
- 문서 앵커 확인: `docs/arch/backend/auth.md §5.2`(존재, "부팅 복원 순서") · `docs/guides/closed-network-extensions.md §2-b`(존재, `:351`) · §1.7(존재, `:213`).
- 기존 테스트 케이스 확인: `runner.test.ts:88-129` 의 교환 describe 2건 실재 · `authenticated-request.test.ts:100` 세션 describe 실재 · `auth-resume.test.ts` 방송 상한 서술 실재(`:1-5` 헤더).

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- **책임 소유자**: `SessionRunner` 가 창·교환·whoami 를, `LoginService` 가 grant 조립·probe·커밋을, `AuthenticatedRequester` 가 자격증명 주입·전송·강등을 갖는다.
- **흐름**: 창 → (finalUrl 폐기) → `exchange.path` 를 쿠키로 GET → `valuePath` → `TokenValue` → `absorbToken` → token grant → probe → 커밋.
- **오류 경로**: 교환 실패 3종이 `exchange_failed` 로, probe 실패가 `probe_failed` 로 접힌다.
- **문제의 직접 원인**: `presentationOf` 가 browser-session 을 "값을 싣지 않는 방식" 으로만 안다. 세션 grant 에는 맞지만 **교환이 만든 token grant** 에는 틀렸고, 두 grant 가 같은 `authKind` 를 쓰기 때문에 구분할 자리가 없었다.

```text
openLoginWindow() ──(finalUrl 폐기)──> getJson(GET, 쿠키)
  → pickPath(valuePath) → TokenValue → Grant{token, authKind:'browser-session'}
  → probeOk() ─┐
               └→ resolveCarrier() → presentationFor('browser-session') → null → THROW
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- **책임 소유자**: 그대로다. `SessionRunner` 가 code 추출까지 갖고, presentation 해석은 `AuthenticatedRequester` 에 남는다.
- **흐름**: 창 → **finalUrl 보존** → code 추출 → `sessions.send()` 로 교환(형상은 선언이 정한다) → `valuePath`/`refreshTokenPath` → `TokenValue` → token grant → probe(**bearer 로 나간다**) → 커밋.
- **오류 경로**: `code 없음` 이 `exchange_failed` 에 한 사유로 더해진다. `ProviderFailureReason` 은 늘지 않는다.
- **유지**: attempt fence · 새 키 커밋 · `getJson` 의 2xx+JSON 판정 · whoami 규칙 · 세션 grant 의 cookie jar 전송.
- **제거**: 쿠키만으로 토큰을 받는 경로(D-006).

```text
openLoginWindow() → finalUrl
  → pickUrlParam(finalUrl, code.param ?? 'code')
  → sessions.send({method, url(+query), body(form)})   ← 파티션·쿠키 유지
  → valuePath / refreshTokenPath / expiresAtPath / principalPath
  → Grant{token, authKind:'browser-session', vaultKey, refreshKey?}
  → resolveCarrier() → presentationFor → exchange.present → Bearer ✅
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | 구현/검증 연결 |
|---|---|---|---|---|
| 토큰 획득 | 쿠키로 GET | **final URL 의 code 로 교환** | D-005·D-006 | `runner.ts` · AC3·AC5·AC6 |
| 교환 요청 형상 | GET 고정 | `method`·`code.in`·`code.params` 를 선언이 정한다 | D-002 | `runner.ts` · AC3·AC4 |
| 교환 전송 | `sessions.send` | **유지** (`sessions.send`) | D-007 — 파티션을 유지하는 유일 경로 | AC7 |
| 토큰 출처 | 응답 JSON | **유지** + 불변식으로 못 박음 | D-007 후단 | AC8 |
| presentation | `null` (죽은 grant) | `exchange.present` (필수) | D-001 · 결함 수정 | `authenticated-request.ts` · AC1·AC2 |
| refresh token | 저장 안 함 | `refreshTokenPath` 로 **저장만** | D-003 | `runner.ts` · AC9·AC10 |
| 세션 만료 판정 | 401/403 | **+ origin 미복귀** | D-004 | `authenticated-request.ts` · AC12·AC13 |
| test seam | 창·전송 포트 주입 | 변화 없음 — 새 포트 0 | D-007 로 `fetchImpl` 주입이 불필요해졌다 | `runner.test.ts` |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `contracts/auth.ts` | 선언 형상 | 타입만 | 전부 |
| `specs/browser-session.ts` | **순수** 파싱 헬퍼(`pickPath`·`pickPrincipal`·`normalizeExpiry`·신규 `pickUrlParam`) + 포트 타입 | url/이름 → 값 \| undefined | `runner.ts` |
| `browser-session/runner.ts` | 창 → code → 교환 → `AuthResult` | `AuthDefinition`·spec → `AuthResult` | `LoginService` |
| `authenticated-request.ts` | presentation 해석 · 전송 · 강등 | 요청 → 응답 | `BoundAuth` |

## 10. 계약 / 타입 / 강제 지점

| 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|
| `exchange.present` 필수 | `contracts/auth.ts` | TypeScript | **컴파일** (배포 선언·테스트 선언 전부) | 빠지면 빌드 실패. 런타임 `null` 이 다시 생길 자리가 없다 |
| `exchange.code` 필수 | 〃 | TypeScript | **컴파일** | 쿠키 교환으로 조용히 떨어지는 경로가 표현 불가 |
| token grant 의 presentation 해석 | `authenticated-request.ts:321-332` | `presentationFor` | **요청 1회** (`:281`) — 실제 API 호출과 **로그인 probe** 둘 다 이 한 지점을 지난다 | 틀리면 API 전체가 `grant_not_valid` |
| 세션 만료 판정(D-004) | `authenticated-request.ts` request 꼬리 | `markExpired` | **① 요청 응답 시**(`:166`) ② **부팅 복원 probe 실패 시**(`login.ts:339`) — **지점 2곳** | 한 곳만 닫으면 그 경로에서만 만료가 정착된다 |
| 토큰 출처 = 응답 JSON | 불변식 | 위생 테스트 | **CI** | 쿠키에서 토큰을 만드는 코드가 들어오면 실패 |
| code 값 비로깅 | `runner.ts` 로그 호출부 | 리뷰 + 테스트 | 실패 로그 작성 시 | 인가 코드가 로그 파일에 남는다 |

- **같은 규칙의 SSOT**: origin 복귀 판정은 `isAllowedOrigin` **한 구현**을 쓴다(`features/auth/policy.ts:14` 재export). `probeOk:492` 와 새 강등 분기가 같은 함수를 부른다 — 두 벌이면 "인증됐는가" 의 판정이 갈린다.
- **선택적 필드 의미**: `code.param` `undefined` = `'code'`(D-005). `code.name` `undefined` = 유효 `param`. `method` `undefined` = `in==='form'` 이면 `POST`, 아니면 `GET`. `refreshTokenPath` `undefined` = **저장하지 않는다**(fail-closed — 있는 줄 알고 refreshKey 를 만들지 않는다).
- **외부 SDK 경계**: 없음. `URLSearchParams` 로 form 본문을 만든다(Node 내장).

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `contracts/auth.ts` | 계약 | `SessionCodeExchange` 신설 · `SessionTokenExchange` 에 `code`(필수)·`present`(필수)·`method`·`refreshTokenPath` | 타입 |
| `features/auth/specs/browser-session.ts` | 순수 헬퍼 | `pickUrlParam(rawUrl, name)` — 쿼리 + 프래그먼트를 모두 본다(`oauth.ts:100-101` 과 같은 규칙) | 순수 단위 |
| `features/auth/browser-session/runner.ts` | 로그인 흐름 | finalUrl 보존 · code 추출 · `getJson` 을 `{path, method, body, contentType}` 로 확장 · `refreshTokenPath` 흡수 · `no-code` 로그 | 순수 단위 (포트 fake) |
| `features/auth/authenticated-request.ts` | 주입·강등 | `presentationOf` 가 browser-session 에서 `spec.config.exchange?.present ?? null` · 세션 carrier 의 origin 미복귀 강등 | 순수 단위 |
| `features/auth/login.ts` | 주석 | `resume()` 의 "origin 미복귀에서는 요청 경로가 강등하지 않는다"(`:337-338`)를 D-004 반영으로 정정 | — |
| `app/deployment/auth-definitions.ts` | 배포 안내 | 헤더 ⚠️ 에 `exchange` 는 `code`+`present` 필수 한 줄 | — |
| `docs/guides/closed-network-extensions.md` | 절차 | §2-b 재작성 · §1.7 표의 exchange 행 갱신 · §9 트러블슈팅 행 | AC14 |
| `docs/arch/backend/auth.md` | 구조 | browser-session 교환의 현재 동작 · §5.2 refresh 대상 표에 browser-session 제외 근거 | — |

### 테스트 가능성

- **electron 분리**: `runner.ts`·`specs/browser-session.ts` 는 electron 을 import 하지 않는다(현행 유지, 파일 헤더가 그 이유를 적고 있다). D-007 덕분에 새 포트를 안 넣으므로 `bootstrap.ts` 도 무변경이다.
- **기존 메커니즘 재사용 적합성**: `pickUrlParam` 은 `parseCallbackUrl`(`oauth.ts:93-111`)의 규칙을 이름만 파라미터화한다. `parseCallbackUrl` 자체를 재사용하지 **않는** 이유는 그것이 `code`/`error`/`state` 라는 OAuth 어휘에 묶여 있어서다 — 이 흐름에는 state 도 error 규약도 없다.
- **순서 관측**: 필요 없음. 이번 변경에 순서 요구 AC 가 없다.

## 12. End-to-end 영향

### producer → consumer

```text
SP final URL → pickUrlParam → 교환 요청 → 응답 JSON → TokenValue
  → Grant{token,…} → AuthStore → resolveCarrier → applyPresentation → 요청 헤더
                                → AuthSnapshot → connection-views → GUI
```

- **producer 기준**: 토큰의 유일한 출처는 교환 응답의 `valuePath` 다.
- **consumer 파생 규칙**: `connection-views.ts:73` 은 `snapshot.activeMethod` 를 그대로 싣는다 — token grant 여도 `activeAuthKind:'browser-session'` 이라 GUI 표시가 바뀌지 않는다(의도).
- **정본 우회 없음**: presentation 은 선언 한 곳에서만 나온다. 소비자가 토큰을 직접 조립할 자리가 없다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `auth-resume.recoverExpired` | D-004 로 `expired` 가 되는 Auth 가 늘 수 있다 → 재로그인 후보가 는다. `AUTO_RELOGIN_KINDS` 에 browser-session 이 이미 있어 창이 뜬다(SSO 쿠키가 살아 있으면 무마찰) | AC13 |
| `auth-resume.refreshOnce` | 변화 없음 — browser-session 은 `refresh` 가 `unsupported` 다(D-003) | AC10 |
| gate 판정(`features/gate`) | 변화 없음 — `status`·`verified` 어휘가 그대로다 | AC12 |
| Harness cache · Plugin tool sync | `credentialChanged` 계약 불변 — 강등 1회당 1회 | AC12 |

## 13. Lifecycle / 오류 / 정리

- **생성/시작**: 로그인 창 → code → 교환. 실패는 전부 `AuthResult{kind:'failed'}` 로 접힌다.
- **취소/중단**: 창을 닫으면 `cancelled`(현행). 교환 중 해제·재시도는 attempt fence 가 커밋을 버린다.
- **retry/timeout**: 교환 요청에 자체 타임아웃을 새로 두지 않는다 — `sessions.send` 는 `sendOnce` 의 동작을 따르고, 로그인 창은 `DEFAULT_TIMEOUT_MS` 를 이미 갖는다.
- **cleanup/rollback**: 없음. 후보는 probe 통과 전에는 store·vault 어디에도 쓰이지 않는다(0188 D-047 유지).
- **다중 저장소 쓰기**: **해당된다.** token grant 는 vault(access + refresh 2키)와 grant 영속 2곳에 쓴다.
  - 쓰기 지점: ① `writeVault()` — 새 키 2개 ② `store.put()` — grant 영속.
  - ① 실패 → `discardKeys(candidate.grant)` 후 `rejected`. 옛 grant·옛 키 그대로. 관측: 이전 연결 유지.
  - ①은 성공, ② 실패 → 같은 `discardKeys` → `rejected`. 새 키는 지워지고 옛 것이 남는다.
  - ② 부분 성공(메모리만) → 옛 키를 **지우지 않는다**(`login.ts:581-585`). 재시작하면 옛 grant 로 정합.
  - **허용 불가 조합 없음** — 새 값은 항상 새 키에 쓰고 grant 저장이 곧 커밋이라(0188 D-050) 어느 지점에서 죽어도 `옛 grant→옛 키` 또는 `새 grant→새 키` 둘 중 하나다. 이번 변경은 이 구조를 바꾸지 않고 `refreshKey` 한 자리를 더 채울 뿐이다.
  - **문서 사본**: 이 handoff 의 판정·상태는 `plan.md`(이 파일)와 `docs/handoff/INDEX.md` 보드 **2곳**에 산다. 상태를 바꾸는 커밋은 둘을 함께 갱신한다.

## 14. 성능 / 상한 / 최적화

- **새 요청 수**: 로그인당 **+0**. 교환 요청은 이미 있던 1회이고 code 추출은 문자열 파싱이다. `principalPath` 가 있으면 whoami 왕복이 0인 것도 그대로다.
- **새 출력 상한**: 로그 1줄 추가(`no-code`)뿐. 값이 아니라 이름만 싣는다.
- **요청당 추가 비용**: D-004 의 판정은 `isAllowedOrigin` 호출 1회(문자열 비교) — vault·네트워크 접근 0.
- **잃는 부수 효과**: 쿠키 교환 능력이 사라진다(D-006). 프로덕션 선언 0건이라 잃는 사용자는 0이고, 가이드에서 그 레시피를 함께 지운다.

## 15. 외부 구현 포트 / 문서 계약

- **외부가 구현할 것**: `AuthDefinition.methods[].config.exchange` — 폐쇄망 배포가 채운다.
- **구현 문서**: `docs/guides/closed-network-extensions.md` §2-b (재작성).
- **shape 검증**: AC14 — 예제를 실제 `auth-definitions.ts` 에 대입해 `npm run typecheck` 3/3.
- **semantics 검증**: 문서가 적을 의미 4가지를 AC 가 각각 고정한다 — 기본 이름 `'code'`(AC5) · code 부재는 실패(AC6) · 교환은 쿠키 경로(AC7) · refresh 는 저장만(AC10).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| "kind 에서 추론하지 않는다" (presentation 은 선언이 정한다) | `contracts/auth.ts:33-36` | §10 `exchange.present` 필수 | **유지** — 오히려 browser-session 을 이 규칙 안으로 들여온다 |
| 세션 교환 = "둘 다 필요" 의 구체 형태 | `specs/browser-session.ts:7-11` | §9 Delta "토큰 획득" | **변경** — 쿠키 GET → code 교환(D-006). 해당 주석을 함께 고친다 |
| refresh 대상은 `authKind='oauth'` | `login.ts:374` · `auth.md §5.2` 표 | §7 AC10 | **유지** — D-003 이 명시적으로 그대로 두기로 했다 |
| "요청 경로는 origin 미복귀를 강등하지 않는다" | `login.ts:337-338` 주석 | §11 login.ts 행 | **변경** — D-004 로 거짓이 되므로 주석을 정정한다. 코드 동작(이중 emit 없음)은 `expirySettled` 가 이미 보장 |
| 방송 상한 `P + 1` | `auth.md §5.2` | §7 AC13 | **유지** — 새 항을 더하지 않음을 AC 로 고정 |
| main 은 전역 `fetch` 를 쓰지 않는다 | `AGENTS.md` · `no-node-fetch.test.ts` | §11 전체 | **유지** — 코어가 요청을 만들어 선언이 fetch 를 부를 이유가 없다 |
| `whoami` 는 별도 왕복이다 (0182) | `contracts/auth.ts:118-127` | §9 "유지" | **유지** — 전송 경로·조건 무변경 |
| 쿠키 반환 표면 제거 (AUTH-PLAT-008) | `infra/browser-session.ts:9-11` | §7 AC8 | **유지** — 그 성질을 테스트로 승격 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| D-004 오탐 — `allowedOrigins` 에 API 응답이 정당하게 끝나는 origin(CDN 등)이 들어 있으면 살아 있는 연결이 만료된다 | `allowedOrigins` 는 **로그인 창이 오가는 origin** 이라는 것이 계약이다(`contracts/auth.ts:113`). 가이드 §2-b 에 "API 종점 origin 을 여기 넣지 않는다" 를 명시한다. 판정은 `probeOk` 가 이미 쓰는 규칙과 같은 구현이라 두 벌로 갈리지 않는다 |
| D-006 이 문서화된 능력을 제거한다 | 프로덕션 선언 0건(§8 전수). 가이드 §2-b 와 `specs/browser-session.ts` 헤더 주석을 같은 변경에서 고쳐 죽은 서술을 남기지 않는다 |
| D-003 으로 쓰이지 않는 refresh token 이 디스크에 남는다 | 사용자가 트레이드오프를 보고 선택했다. vault(safeStorage) 안이고 `vaultKeysOf` 가 해제·sweep 에서 함께 지운다(`store.ts:20-24`) |
| 인가 코드가 로그·URL 에 남을 위험 | 로그는 이름만 찍는다(§10). 창 내비게이션 로그는 이미 `safeOrigin()` 으로 경로·쿼리를 버린다(`infra/browser-session.ts:256-263`) |
| PKCE·state 없이 code 를 받는다 | 창·allowlist·같은 파티션 안에서 완결되는 흐름이고 code 는 즉시 소비된다. 표준 AS 를 상대하면 `oauth` 방식이 이미 PKCE·state 를 제공한다 — §6 에 비범위로 명시 |

- **되돌리기 어려운 결정**: `SessionTokenExchange` 형상(배포가 적는 스키마). 지금 선언 0건이라 비용이 최소다.
- **신규 의존성**: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/main/contracts/auth.ts`
- `app/src/main/features/auth/specs/browser-session.ts` (+ 테스트)
- `app/src/main/features/auth/browser-session/runner.ts` (+ `runner.test.ts`)
- `app/src/main/features/auth/authenticated-request.ts` (+ `authenticated-request.test.ts`)
- `app/src/main/features/auth/login.ts` (주석) (+ `login.test.ts`)
- `app/src/main/app/auth-resume.test.ts`
- `app/src/main/app/deployment/auth-definitions.ts` (주석)
- `docs/guides/closed-network-extensions.md` §1.7 · §2-b · §9
- `docs/arch/backend/auth.md`

## 19. 게이트

- **적용할 하위 가이드**: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`.
- **환경 제약**: egress 차단 시 electron ABI 재빌드가 403 으로 막힌다. DB 로드 스위트 5파일 실패는 **알려진 베이스라인**으로 분리 보고한다.
- **기본 정적 게이트**: `cd app && npm run lint && npm run typecheck`.
- **관련 테스트**: `./node_modules/.bin/vitest run src/main/features/auth src/main/app/auth-resume.test.ts` (pretest 우회 — 이 스위트들은 DB 를 물지 않는다).
- **사람 실기**: 없음.

## READY self-review

- [x] Decision Ledger 의 ACTIVE/SUPERSEDED/OPEN 이 여러 턴의 결정을 보존한다 — D-001~D-007, 정정 3건의 원문 인용 포함.
- [x] Part I 만 읽어도 완료 상태가 이해된다 — §5 흐름·상태 전이표.
- [x] 조건절·이유절을 재해석하지 않았다 — D-003·D-006·D-007 은 사용자 원문을 그대로 인용했다.
- [x] Product/UX 의 각 핵심 동작이 AC 와 Technical Design 에 연결된다 — §9 Delta 각 행이 AC 를 지목한다.
- [x] AS-IS·TO-BE 가 같은 축으로 있고 Delta 8행이 파일 또는 AC 로 추적된다.
- [x] AS-IS 에서 사라진 책임(쿠키 교환)을 **삭제**로 명시했다(§9 Delta · §16).
- [x] 수치·전칭·앵커·기존 테스트를 실측했다 — §8 전수 조사 7행, 문서 앵커 3건, 테스트 케이스 3건.
- [x] 각 AC 가 행동 단언·검증 수단·프로덕션 도달 경로를 갖는다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — §19 "사람 실기: 없음".
- [x] semantic 목표가 structural proxy 만으로 검증되지 않는다 — AC8 은 "함수가 불린다" 가 아니라 "응답을 바꾸면 토큰이 따라 바뀐다" + 쿠키 읽기 0건 차집합으로 센다.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam 이 있다 — §10 6행.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 4행.
- [x] producer/consumer 양쪽 의미를 확인했다 — §12.
- [x] 상한·one-way door 를 계산했다 — §14(요청 +0) · §17(스키마).
- [x] 게이트 명령이 `app/AGENTS.md` 현재 지침과 충돌하지 않는다.
- [x] 본문 완성 후 교차검증했고 `ACTIVE 결정 ↔ AC` 대조를 §3 갱신 메모에 관측으로 적었다 — 충돌 0.
- [x] 문장 규칙 — 판정 먼저, 한 줄에 관측 하나, Part I/II 사실 중복 없음(§8 은 좌표, Part I 은 결과).

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

설계는 계약으로 수행 가능했다. Decision·AC·§10 을 재해석 없이 그대로 옮겼고, ACTIVE Decision 을
바꾼 곳은 없다. 세 가지만 어긋났고 전부 아래 §되먹임에 있다 — **AC13 의 검증 수단**(fake 가
관측 대상을 통째로 빼는 자리) · **§7 주의사항의 기존 테스트 수**(2건이 아니라 3 선언 사이트) ·
`getJson` 시그니처의 파급(whoami 호출부도 함께 바뀐다, §11 이 적지 않음).

## [구현자 기입] 강제 지점 전수 (§10 대조)

**전수 13/13.** 지점 수는 §10 의 `언제 강제` 칸을 세어 잡았고, 각 행의 관측값은 이번 턴에 다시
재현한 것이다.

| 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|
| `exchange.present` 필수 | 컴파일 — 배포 선언·테스트 선언 **전부** | **3/3** | `rg -n 'valuePath' src/main --glob '!*.md'` → 교환 리터럴 3 (`authenticated-request.test.ts:350`·`login.test.ts:1264`·`runner.test.ts:32`) + 프로덕션 0. 한 곳에서 `present` 를 지우고 `tsc -p tsconfig.test.json` → `TS2322 … missing … present` | 없음 |
| `exchange.code` 필수 | 〃 | **3/3** | 같은 3 리터럴. 한 곳에서 `code` 를 지우면 `TS2322 … missing … code` | 없음 |
| token grant 의 presentation 해석 | 요청 1회 (`presentationFor` 호출부) | **1/1** | `rg -n 'presentationFor\(' src/main -g '!*.test.ts'` → 호출 1(`:301`)·정의 1(`:341`). 심은 변이 M1(`null` 복귀) → `login.test.ts` 3케이스 실패 | 없음 |
| 세션 만료 판정(D-004) | ① 요청 응답 시 ② 부팅 복원 probe 실패 시 — **2곳** | **2/2** | `rg -n 'store\.markExpired\(' src/main -g '!*.test.ts'` → `authenticated-request.ts:167`·`login.ts:342`. ①=M2·M3 변이가 `authenticated-request.test.ts`·`login.test.ts` 양쪽을 깨뜨림. ②=이미 존재하던 지점이라 **이중 방송이 없음**을 단언(`snapshots` 가 `unauthorized` 1건) | 없음 |
| 토큰 출처 = 응답 JSON | CI 위생 테스트 | **1/1** | `no-cookie-token.test.ts` — `features/auth/**` 훑어 위반 **0건(차집합)**. 가드에 결함 3건(중첩 디렉토리·추출·주석) 을 심어 전부 잡히는 것을 같은 파일이 단언 | 없음 |
| code 값 비로깅 | 실패 로그 작성 시 | **3/3** | runner 의 `logger?.(` 호출부 3곳의 payload 키 = `{authId,valuePath,reason}`·`{authId,param}`·`{authId,valuePath}` — **값을 나르는 키 0건(차집합)**. 변이 M12(`finalUrl` 추가) → "실패 로그에 코드 값이 실리지 않는다" 실패 | 없음 |

### 표 밖에서 닫은 축 — D-004 조건 문장의 전수

§10 은 코드 지점만 세지만, "요청 경로가 언제 강등하는가" 는 **문장으로도 여러 곳에 산다**. 술어는
해법 이름(`authenticationReturned`)이 아니라 불변식의 주어(`401` 을 강등 조건으로 말하는 서술)로
잡았다.

- 후보 **36** = 두 조건을 함께 말하는 서술 **14** + 조건 열거가 아닌 서술 **22** + **잔여 0**.
- 면제 7종은 각각 다른 축이다 — 후보 자격증명(4) · 세대/동시성(5) · SDK 에러 문자열(3) · 과거
  결함 서술(3) · 값형 grant(2) · 변화 원인 분류표(2, **3사본 일괄 유지**) · Plugin lifecycle(2).
- 이 스윕 자신에게도 결함을 심었다 — `runtime.ts` 의 조건절을 지우자 잔여가 `0 → 2` 로 올라온다.

## [구현자 기입] Product/UX 파생 검토

- **새 문장의 소비자를 확인했다.** `'인가 코드를 찾지 못했습니다'` 는 `AuthResult{kind:'failed',
  reason:'exchange_failed'}` 로 접히고, `login.ts` 의 `fail()` 이 `ProviderStepInfo.message` 에
  실어 화면에 올린다 — `ProviderFailureReason` 을 늘리지 않았으므로 renderer·i18n 변경 0.
- **새 실패 경로가 Part I 상태 전이표의 어느 행인가**: "final URL 에 code 파라미터 없음" 행이다.
  표에 빠진 행은 없다.
- **"아무 일도 안 일어남" 이 되지 않는다.** 교환 실패는 grant 를 커밋하지 않고 실패 step 을 내므로
  화면이 사유와 함께 이전 연결을 유지한다(`login.test.ts` "교환 실패는 grant 를 커밋하지 않는다").
- **파생 이슈 ①(범위 밖 — 적어만 둔다)**: D-004 의 강등은 `AUTO_RELOGIN_KINDS` 를 통해 부팅에서
  **로그인 창을 띄운다**. `allowedOrigins` 를 잘못 적은 배포는 "요청 → 강등 → 부팅마다 창" 이
  되고, 창은 최대 3회까지 뜬다(`auth.md §5.2`). 가이드 §2-c·배포 헤더에 경고를 넣었지만
  **런타임 방어는 없다** — 등록 검사에 "allowedOrigins 에 origin 이 포함되는가" 를 더하는 것이
  후속 후보다.
- **파생 이슈 ②(범위 밖)**: `code.params` 는 배포 소스에 평문으로 앉는다. `client_secret` 을
  요구하는 SP 가 있으면 배포가 그 자리에 적을 유혹이 생긴다 — 계약 주석과 가이드 표에 "비밀을
  적지 않는다" 를 넣었으나 타입으로 막지는 못한다.

## [구현자 기입] 놓친 잠재 문제 + 대응

- **fake 가 관측 대상을 빼는 자리** (AC13). `auth-resume.test.ts` 의 `fakeRuntime.resume` 은 요청
  경로를 갖지 않는다 — 거기서 세는 방송 수는 **fake 자신의 산수**이지 "요청 경로와 resume 이 같은
  강등을 두 번 내는가" 의 관측이 아니다. **대응**: 같은 행동 단언을 진짜 `AuthenticatedRequester`
  를 물린 `login.test.ts` 로 옮겼다(§설계 대비 차이).
- **`getJson` 파급.** 요청 형상을 선언이 정하게 하려면 `getJson` 이 `{path,method,query,body,
  contentType}` 를 받아야 하고, 그러면 **whoami 호출부도 함께 바뀐다**(§11 은 exchange 만 적었다).
  **대응**: 선조치 — 두 호출부를 같은 객체 형태로 통일하고 whoami 의 기존 단언(`method:'GET'` ·
  `accept` 헤더)이 그대로 통과하는 것을 확인했다.
- **`vitest` 초록이 `typecheck` 초록을 뜻하지 않는다.** 새 fake 응답의 삼항이 `SendResult` 로 좁혀
  지지 않아 `typecheck:test` 만 2건 실패했는데 테스트는 전부 통과했다. **대응**: 반환 타입을
  명시했고, 게이트 판정을 exit code 가 아니라 세 명령의 산출로 각각 적는다.
- **`store.put()` 은 `verified` 를 세운다.** 복원 grant 를 `put` 으로 심으면 `restorable()` 이
  false 가 되어 `resume()` 이 probe 를 아예 내지 않는다 — 처음 쓴 AC13 하네스가 이 함정에 빠져
  "아무 일도 안 일어나는" 초록을 낼 뻔했다. **대응**: 부팅과 같은 경로(`createMemoryGrantPersistence`
  + `store.restore`)로 심고, 그 이유를 하네스 주석에 남겼다.
- **`refreshTokenPath` 를 무조건 흡수하면 죽은 비밀이 남는다.** D-003 으로 소비자가 0이므로
  fail-closed 로 뒀다 — 선언한 배포만 저장한다(`runner.test.ts` 2케이스).

## [구현자 기입] 구현 보고

### 설계 대비 차이 — AC13 의 검증 수단 위치

plan §7 은 AC13 을 `auth-resume.test.ts` 방송 상한 describe 에 두라고 적었다. **행동 단언은 그대로
두고 파일만 옮겼다** — `login.test.ts` 의 `LoginService — 세션 grant 의 origin 미복귀 강등` 이다.
이유는 위 §놓친 잠재 문제 첫 항이다. `auth-resume.test.ts` 는 무변경이고 `P + 1` 상한 describe 는
그대로 통과한다(3케이스). 이것은 §6 가운데 갈래의 **plan 수정 제안**이기도 하다 — §7 AC13 행의
`검증 수단` 칸을 이 위치로 정정하는 것이 맞다.

### 변경 파일

| 파일 | 변경 |
|---|---|
| `contracts/auth.ts` | `SessionCodeExchange` 신설 · `SessionTokenExchange` 에 `code`(필수)·`present`(필수)·`method`·`refreshTokenPath` |
| `features/auth/specs/browser-session.ts` | `pickUrlParam` 신설(쿼리+프래그먼트) · 헤더 ② 를 코드 교환으로 정정 |
| `features/auth/browser-session/runner.ts` | finalUrl 보존 · 코드 추출 · `getJson` 형상 확장 · `exchangeRequest`/`codeParam`/`pickSecretPath` · `no-code` 로그 |
| `features/auth/authenticated-request.ts` | `presentationOf` 가 `exchange.present` 를 돌려준다 · `authenticationReturned` 로 D-004 강등 |
| `features/auth/login.ts` | `resume()` 주석 정정(요청 경로의 강등 조건 2가지) |
| `features/auth/runtime.ts` · `store.ts` | 같은 축의 조건 문장 정정(위 전수 스윕) |
| `app/deployment/auth-definitions.ts` | 헤더 ⚠️ — `exchange` 는 `code`+`present` 필수 · `allowedOrigins` 에 API 종점 금지 |
| `features/auth/no-cookie-token.test.ts` | **신규** — 토큰 출처 위생 가드 + 자기 결함 심기 3건 |
| `runner.test.ts` · `authenticated-request.test.ts` · `login.test.ts` | AC1~AC13 |
| `docs/arch/backend/auth.md` | §4.5 관측 지점 표 · **§4.6 신설**(browser-session 의 두 grant) · §5.2 refresh 제외 행 · 모듈 지도 |
| `docs/guides/closed-network-extensions.md` | §2-b 재작성 · **§2-c 신설**(세션이 끊기면) · §1.7·§3-b·§4·§9 |

### 게이트 — 관측한 산출

| 명령 | 산출 |
|---|---|
| `npm run lint` | **0 error · 1 warning** — warning 은 `useTranscriptVirtualizer.ts` 의 react-compiler 기존 경고(변경 무관). `--fix` 가 만든 트리 변화 없음 |
| `npm run typecheck` | **3/3 통과** (`node`·`web`·`test`) — `error TS` 0줄 |
| `vitest run src/main/features/auth src/main/app/auth-resume.test.ts src/main/features/gate src/main/infra/net` | **16파일 / 321케이스 전부 통과** |
| `vitest run` (전체) | **202파일 통과 · 5파일 실패 / 2014 통과 · 42 실패** — 실패 5는 전부 `Module did not self-register: better_sqlite3.node` 로 **알려진 ABI 베이스라인**(`app/AGENTS.md` 실측 5파일과 동일: `infra/db/{queries,migrate}` · `features/extensions/builder` · `features/orchestration/fork` · `app/chat-turn.continuity`). 변경 무관 |
| `node --test scripts/*.test.mjs` | **49 pass · 0 fail** |
| `node scripts/check-doc-inventory.mjs --check` | generated ok · prose ok · **links ok** |

### AC 자기보고 — 재현 명령 동반

| # | 판정 | 재현 명령 / 관측 |
|---|---|---|
| AC1 | ✅ | `authenticated-request.test.ts` "선언한 present 대로 Authorization: Bearer 가 실린다" — 주입 fetch 가 받은 헤더 `Bearer tok-abc` |
| AC2 | ✅ | `login.test.ts` "로그인 probe 가 후보 토큰을 bearer 로 싣고 나가 done 으로 끝난다" — 나간 요청 1건, URL `/api/me`, 헤더 `Bearer tok-1` |
| AC3 | ✅ | `runner.test.ts` "선언한 이름으로 final URL 에서 코드를 꺼내 그 이름으로 실어 보낸다" — 교환 URL 의 `ticket=abc` |
| AC4 | ✅ | `runner.test.ts` "code.in:'form' 이면 POST 폼 본문에 코드와 code.params 가 함께 실린다" — `POST` · `x-www-form-urlencoded` · 본문 3키 · 쿼리 빈 문자열 |
| AC5 | ✅ | `runner.test.ts` "code.param 미지정이면 code 라는 이름으로 찾는다" — 교환 URL 의 `code=xyz` |
| AC6 | ✅ | `runner.test.ts` "final URL 에 그 이름이 없으면…" — `exchange_failed` + `sessions.send` **미호출** + 로그 `{authId,param}`. `login.test.ts` "교환 실패는 grant 를 커밋하지 않는다" — `store.get()` 이 이전 grant 그대로 |
| AC7 | ✅ | `runner.test.ts` "교환은 sessions.send 로 나간다" — handle `handle-1`·`acquire('corp')`. 같은 파일 `@ts-expect-error` 케이스가 `fetchImpl` 자리 부재를 컴파일로 고정 |
| AC8 | ✅ | ⓐ `runner.test.ts` "같은 세션·다른 응답 본문이면 토큰이 응답을 따라간다" — `A`/`B`. ⓑ `no-cookie-token.test.ts` — 위반 0건 차집합 |
| AC9 | ✅ | `login.test.ts` "refreshToken 이 오면 refreshKey 가 생기고…" — `vault.names()` **2** (서로 다른 키). 미선언 케이스는 **1** · `refreshKey` 부재 |
| AC10 | ✅ | `login.test.ts` "refreshKey 가 있는 browser-session token grant 도 refresh 는 unsupported 다" — 먼저 `refreshKey` 존재를 단언한 뒤 `'unsupported'` |
| AC11 | ✅ | `authenticated-request.test.ts` "401 이면 expired 로 강등된다" — `status()==='expired'` · 통지 1건 |
| AC12 | ✅ | `authenticated-request.test.ts` "200 이어도 체인이 origin 밖에서 끝나면 expired 이고 통지는 1회다" — `finalUrl` = IdP · 통지 배열 길이 **1** |
| AC13 | ✅ | **위치 이동**(§설계 대비 차이). `login.test.ts` "부팅 복원 probe 가 IdP 폼(200)에서 끝나면 expired 이고 통지는 1회다" — `snapshots` 가 `[{unauthorized}]` 하나. `auth-resume.test.ts` 의 `P + 1` describe 3케이스는 무변경 통과 |
| AC14 | ✅ | 가이드 §2-b 예제를 `auth-definitions.ts` 에 대입 → `npm run typecheck` **3/3 통과** → `git diff --stat` 으로 되돌림 확인(남은 변경 = 헤더 주석 4줄) |

**검산 — ✅ 14 · ⚠️ 0 · ❌ 0 = 총 14.** 현재 AC 총수를 §7 표에서 다시 셌다(AC1~AC14, 분할·추가
없음). 이전 라운드가 없으므로 분모 비교 대상 없음.

### 심은 결함 (§3 적대 검사)

이번 턴에 만들거나 고친 검사 장치가 **결함을 실제로 보는지** 확인했다 — 프로덕션 변이 **13건**과
타입 변이 **2건**, 전부 검출(13/13 · 2/2). 스윕 가드는 판정 지점 3곳(대상 집합·추출·실재 판정)에
각각 심어 자기 파일이 단언하고, D-004 문장 스윕에도 조건절 제거를 심어 잔여 `0 → 2` 를 확인했다.

| 변이 | 잡은 케이스 |
|---|---|
| M1 `presentationOf` 가 다시 `null` | AC2·AC9 등 3케이스 |
| M2 강등 조건에서 origin 항 제거 · M3 origin 판정 무조건 참 | AC12·AC13 |
| M4 선언한 `param` 무시 | AC3·AC6 |
| M5 form 이 쿼리로 · M6 form 기본 GET · M10 `getJson` GET 고정 · M11 본문 폐기 | AC4 |
| M7 `refreshToken` 미흡수 | AC9 |
| M8 프래그먼트 미조회 · M9 빈 문자열을 값으로 | `pickUrlParam` 단위 |
| M12 `no-code` 로그에 finalUrl 추가 | AC6 · "코드 값이 실리지 않는다" |
| M13 코드 없이도 교환 요청(쿠키 교환 복귀) | AC6 |
| T1 `present` 제거 · T2 `code` 제거 | `tsc -p tsconfig.test.json` |

### 대상 커밋

`995f1cd` — `feat(auth): browser-session 이 final URL 의 인가 코드를 토큰으로 교환한다`
(`Agent: claude` · `Status: implemented` · `Criteria-Met: 14/14` · `Verified-By: pending`).
보고 해시를 채우는 이 문단 자체는 그 다음 커밋에 담긴다 — 커밋은 자기 해시를 담을 수 없다.

## [구현자 기입] Review Signals — 사실만

- **현재 라운드**: 1 (신규 handoff, 재구현 아님).
- **이전 라운드와 같은 축인가**: 해당 없음. 다만 이번에 닫은 D-004 는 0194 r4 가 401 경로에서
  닫은 **"같은 강등을 두 지점이 보면 방송이 두 배가 된다"** 와 같은 불변식의 새 조건절이다 —
  그 축이 조건을 하나 늘릴 때마다 다시 열린다는 사실이 남는다.
- **plan 지침이 막았어야 했는데 못 막은 것**: AC13 의 `검증 수단` 칸이 **관측 대상을 갖지 않는
  fake 를 지목**했다. plan 의 "프로덕션 도달 경로" 열은 채워져 있었지만(`auth-resume.resumeRemainingOnce`),
  그 경로가 *테스트에서* 진입되는지는 열이 묻지 않는다.
- **반복해서 부딪히는 환경 한계**: electron ABI(egress) — DB 로드 5스위트가 계속 red 다. 이번에도
  `npm test` 를 쓰지 않고 `./node_modules/.bin/vitest run` 으로 우회했다.
- **게이트 산출의 함정**: `vitest` 초록과 `typecheck:test` 초록이 갈렸다(2건). 두 명령을 모두 돌려야
  한다는 것이 `app/AGENTS.md` 의 기본 게이트(lint+typecheck)와 일치한다.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| | | | | |
