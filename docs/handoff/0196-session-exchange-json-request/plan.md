# Plan — 0196-session-exchange-json-request

## 메타

| 항목 | 값 |
|---|---|
| slug | `0196-session-exchange-json-request` |
| 작성자 | Claude Code |
| 일자 | 2026-08-21 |
| 매핑 | 0195 요구사항 정정 (`docs/handoff/0195-browser-session-token-exchange/`) |
| 상태 | verify/PASS (r1) |

> **0195 의 후속 정정이다.** 0195 는 `verify/PASS (r1)` 로 끝나 archive 로 갔고 그 판정은 그대로
> 유효하다 — 정정되는 것은 *통과 여부* 가 아니라 그때의 **요구 해석**이다. Decision Ledger 는
> 0195 의 ID(`D-001`~`D-007`)를 번호까지 승계하고 이번 턴의 결정을 `D-008`~`D-010` 으로 잇는다.

# Part I — Product & UX Contract

## 1. Context / 목표

- **해결하려는 문제**: 0195 가 요구 ② 의 "code 쿼리" 를 **교환 요청의 형상 지시**로 읽었다. 실제 뜻은 "SP 가 final URL 에 쿼리로 코드를 돌려준다" 였다 — 추출 지점 서술이다. 그 오독이 `code.in: 'query'|'form'` 과 `exchange.method` 라는 **배포가 고를 것이 없는 선택지**를 계약에 남겼다.
- **완료 후 달라지는 것**: 교환 요청은 항상 `POST` + `application/json` 이다. 배포 선언에서 `code.in`·`method` 두 필드가 사라지고, 남는 선택지는 "코드를 final URL 어디서 꺼내(`param`) 본문에 어떤 이름으로(`name`) 무엇과 함께(`params`) 실을 것인가" 셋뿐이다.
- **성공 한 문장**: 폐쇄망 배포가 교환 endpoint 의 전송 형상을 고민하지 않고 이름 셋만 적으면 "SSO 로그인 → final URL 의 코드 → JSON POST → Bearer API" 가 성립한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ⑥ | "code의 query 는 final url에 code (쿼리) 로 반환한다는 의미이다. 코드 획득을 위해 파라미터를 추출해야한다는 의미였음." | 라이브 세션 2026-08-21 (정정 4) |
| 명시 요구 ⑦ | "exchane.code 에서 교환 요청(in)은 json만 지원하도록 수정하라. -> 왜냐하면 post로 밖에 교환이 안됨. method도 post 고정이기때문에 필드 삭제." | 〃 (정정 5) |
| 명시 선택 ⑧ | `code.in` 필드 자체도 삭제한다 (제시한 두 안 중 선택) | 〃 |
| 추론 의도 | ⑥ 은 새 기능 요구가 아니라 **0195 D-002 의 전제가 틀렸다는 통보**다 — 그래서 D-002 를 SUPERSEDED 로 내린다 | 설계자 판단 |

## 3. Decision Ledger

> `D-001`~`D-007` 은 0195 승계다. 이번 턴에 다시 언급되지 않은 항목도 유지한다.

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | `SessionTokenExchange.present` 를 **필수**로 둔다 | `contracts/auth.ts` 의 "kind 에서 추론하지 않는다" 승계 | 0195 사용자 선택 | ACTIVE | — |
| D-002 | 교환 요청 형상은 **선언이 정한다** — `code.in`·`code.name`·`code.params`·`method` | 코드 이름이 SP 마다 다르다 = 비표준 AS 이므로 요청 형상도 비표준일 수 있다 | 0195 사용자 선택 | **SUPERSEDED** | → D-009 · D-010 |
| D-003 | refresh token 은 **저장만 한다. 갱신 기능은 지금 지원하지 않는다** | 원문: "저장하되 만료시 재로그인. refresh 토큰 반환하면 저장만. 기능은 지금 지원하지 않는다." | 0195 사용자 답변 | ACTIVE | — |
| D-004 | 세션 grant 요청이 **401/403 또는 `definition.origin` 미복귀**면 `markExpired` 한다 | SSO 는 세션이 죽으면 401 이 아니라 IdP 폼을 200 으로 준다 | 0195 사용자 선택 | ACTIVE | — |
| D-005 | code 는 final URL 에서 추출한다. `code.param` 미지정 시 기본 이름은 `'code'` | 원문: "code 미선언 시 디폴트로 'code' 쿼리 추출. 선언시 해당 값으로 쿼리추출" | 0195 사용자 정정 1 | ACTIVE | — (D-008 이 재확인) |
| D-006 | `exchange` 선언 시 **`code` 필수**. 쿠키만으로 토큰을 얻던 0181 경로를 **제거**한다 | 원문: "code 미선언시 code를 반환하지 않는 sp 로 간주하라. 쿠키에서 토큰 추출도 하지 말것." | 0195 사용자 정정 2 | ACTIVE | — |
| D-007 | 교환 요청은 **`sessions.send()`** 로 보내 파티션·쿠키를 유지한다 | 원문: "파티션을 유지하여 쿠키사용되도록. 내 말은 쿠키에서 무언가를 파싱하는 행위는 하지 말라는 것" | 0195 사용자 정정 3 | ACTIVE | 0195 의 "netFetch" 선택을 대체 |
| D-008 | 요구 ② 의 "code 쿼리" 는 **final URL 의 쿼리 파라미터를 추출한다**는 뜻이다 — 교환 **요청**의 형상을 지시한 문장이 아니다 | 원문 ⑥ 그대로. D-002 는 이 문장을 요청 형상 지시로 읽어 성립했다 | 이번 턴 사용자 정정 4 | ACTIVE | D-002 의 전제를 무효화 |
| D-009 | 교환 요청은 **`POST` + `application/json` 본문 고정**이다. `SessionTokenExchange.method` 필드를 **삭제**한다 | 원문: "교환 요청(in)은 json만 지원하도록 수정하라. -> 왜냐하면 post로 밖에 교환이 안됨. method도 post 고정이기때문에 필드 삭제." | 이번 턴 사용자 정정 5 | ACTIVE | D-002 대체 |
| D-010 | `SessionCodeExchange.in` 필드도 **삭제**한다 — 단일 값 union 으로 남기지 않는다 | 값이 하나뿐인 필드는 배포가 결정할 것이 없는 죽은 필드다(0195 D-003 이 `refreshExpiresAtPath` 를 두지 않은 것과 같은 근거). 되살릴 때는 `in?: 'json'\|'form'` 선택 필드로 넓히면 기존 선언이 그대로 유효하다 | 이번 턴 사용자 선택 ⑧ | ACTIVE | D-002 대체 |

### 갱신 메모

- **새로 추가된 결정**: D-008 · D-009 · D-010.
- **변경된 결정**: D-002 → **SUPERSEDED**. 근거는 사용자 정정 4 가 밝힌 **요구 원문의 뜻**이다 — 설계 실패가 아니라 해석 실패였고, 그래서 verify/FAIL 파생 이슈가 아니라 결정 대체로 처리한다.
- **유지되는 ACTIVE**: D-001·D-003·D-004·D-005·D-006·D-007. 이번 턴에 D-003·D-004·D-007 은 언급되지 않았으나 그것을 삭제 근거로 쓰지 않는다.
- **D-005 는 좁히지 않는다**: 정정 4 가 "쿼리" 라고 말했지만 현재 `pickUrlParam` 은 쿼리와 프래그먼트를 모두 본다. 프래그먼트 지원은 쿼리로 돌려주는 SP 의 결과를 바꾸지 않는 **상위집합**이고, 지우면 `response_mode=fragment` 배포만 잃는다 — 요구되지 않은 축소라 하지 않는다. **설계자 해석이며 사용자 결정이 아니다.**
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0.
  - D-001("`present` 필수") ↔ AC1 — AC1 이 `present` 를 지우면 컴파일이 깨짐을 단언한다 → 같은 방향.
  - D-005("`param` 미지정 시 `'code'`") ↔ AC4 — AC4 가 두 절(기본값·지정값)을 각각 덮는다 → 같은 방향.
  - D-006("`code` 필수") ↔ AC1·AC8 — AC1 이 컴파일 강제를, AC8 이 `exchange` 미선언 시 세션 grant 를 단언 → 같은 방향.
  - D-007("`sessions.send`") ↔ AC2 — AC2 의 관측 지점이 `sessions.send` 가 받은 요청이다 → 같은 방향.
  - D-009("POST + JSON 고정") ↔ AC2·AC3 — AC2 가 method·content-type·본문을, AC3 이 URL 무쿼리를 단언 → 같은 방향.
  - D-010("`in` 삭제") ↔ AC1 — **AC1 이 D-010 의 반대(필드 유지)를 요구하지 않는지 확인함**: AC1 의 술어는 "`in` 을 적은 선언이 컴파일에 실패한다" 이므로 삭제를 단언한다.
  - **전수 확인**: AC1~AC10 중 `code.in`·`exchange.method` 를 살아 있는 선택지로 요구하는 행은 **0건**.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | **타당** — 원인은 요구 ② 의 오독이고, 그 오독의 산물이 정확히 두 필드다 | `contracts/auth.ts:152`(`in`) · `:174`(`method`) |
| 이미 기존 코드가 충족하는가 | **아니오** — `exchangeRequest` 가 `in==='form'` 분기를 갖고 JSON 갈래는 아예 없다 | `runner.ts:248-260` |
| 더 작은 해법이 있는가 / 제거라면 능력 자체가 없어도 되는가 | **없어도 된다** — 사용자가 "post로 밖에 교환이 안됨" 으로 능력 자체의 불필요를 명시했다. 프로덕션 `exchange` 선언이 **0건**이라 잃는 사용자도 0이다 | `auth-definitions.ts` 실측 · §8 전수 조사 |
| 선행 자료의 주장을 코드와 대조했는가 | **문서 3곳이 구 동작을 현재형으로 서술한다** — 가이드 예제·필드표·arch 서술 | `closed-network-extensions.md:369`·`:387` · `auth.md:330` |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | **충돌 없음** — §16. D-006·D-007 은 오히려 강화된다(형상이 하나면 우회 경로가 줄어든다) | §16 표 |

- **사용자에게 올릴 결정**: 없음. `in` 필드의 존치 여부는 이번 턴에 물어 ⑧ 로 닫았다.
- **코드 조사로 닫은 사실**: `code.in` 참조 11곳(코드 2·테스트 9) · `exchange.method` 참조 3곳 · `getJson` 의 `query` 소비자 1곳 · 프로덕션 `exchange` 선언 0건 (§8).

## 5. 동작 / 사용자 흐름

```text
[연결] 클릭
  → 로그인 창 (sessionGroup cookie jar · WIA/ADFS)
  → doneUrlPrefix 도달 → finalUrl 확보
  ├ exchange 미선언 → session grant (변화 없음)
  └ exchange 선언  → finalUrl 에서 `code.param ?? 'code'` 추출   ← D-005·D-008
        ├ 없음 → ❌ exchange_failed (변화 없음)
        └ 있음 → sessions.send(POST, application/json)          ← D-009 (여기가 이번 변경)
                 body = { ...code.params, [code.name ?? 유효 param]: code }
                 → access token (+ refresh 선택)
  → probe → ✅ 연결됨
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| `exchange` 선언 Auth 로그인 성공 | **POST + JSON** 으로 교환 → token grant 커밋 | 연결됨 (0195 와 같음) |
| 배포가 `code.in`·`method` 를 적었다 | **컴파일 실패** (excess property) | 빌드가 깨진다 — 런타임에 도달하지 않는다 |
| SP 가 form-urlencoded 만 받는다 | 교환이 비-2xx → `exchange_failed` | "토큰 교환이 415 로 실패했습니다" 등 기존 문장 |
| final URL 에 코드 없음 / 응답에 토큰 없음 / 비-JSON | 기존 경로 그대로 | 변화 없음 |
| `exchange` 미선언 Auth 로그인 | session grant | 변화 없음 |

### 파생 UX / 엣지케이스

- **error**: 새 실패 사유가 없다. `ProviderFailureReason` 도 문장 4종도 그대로라 renderer·i18n 변경이 0이다.
- **cancel / retry / concurrency**: 변화 없음 — 창 취소, attempt fence, 재시도 경로를 건드리지 않는다.
- **비밀 노출은 줄어든다**: 코드가 URL 쿼리에 실릴 갈래가 사라져 프록시·서버 액세스 로그에 인가 코드가 남을 경로가 0이 된다(AC3 이 이것을 잠근다).
- **폐쇄망**: 전송은 여전히 `sessions.send()` 하나다(D-007) — 파티션·OS 프록시·사설 CA 가 그대로다.
- **되돌리기**: form 갈래가 다시 필요해지면 `in?: 'json'|'form'` 을 선택 필드로 더한다. 그때 기존 선언은 한 글자도 고치지 않아도 유효하다(D-010).

## 6. 범위 / 비범위

- **범위**: `SessionCodeExchange.in` 삭제 · `SessionTokenExchange.method` 삭제 · `exchangeRequest` 를 POST+JSON 단일 형상으로 · `getJson` 의 죽은 `query` 인자 제거 · 0195 파생 이슈 **D2**(코드 이름 충돌 우선순위 무테스트) 종료 · 0195 파생 이슈 **D5**(auth.md 구분선 중복) 종료 · 가이드·arch 문서 정정 · 0195 plan 에 전방 포인터.
- **비범위**: 아래 표.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 0195 D6 — `getJson` 이 `checkRequestPath` 를 지나지 않는다 | **아니오** — 강제 지점 신설이라 별도 설계가 필요하고, 선행 결함(0181/0182)이라 이 정정의 원인과 무관하다 | 후속 handoff |
| 0195 D1·D3·D4 — 가드 공백 3건 | 아니오 — 전부 이번 변경이 건드리지 않는 함수다(`authenticationReturned`·`pickSecretPath`·위생 테스트 배선) | 후속 handoff |
| `code.params` 평문 노출(0195 파생 ②) | 아니오 — 타입으로 막을 수 없고 배포 소스 정책 문제다 | 후속 |
| 프래그먼트 추출 지원 제거 | 아니오 — 요구되지 않은 축소다(§3 갱신 메모) | 하지 않는다 |
| browser-session refresh 실행 | 아니오 — D-003 유지 | 후속 |

## 7. Acceptance Criteria — 제품 계약

| # | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|
| AC1 | 배포 선언이 `code.in` 또는 `exchange.method` 를 적으면 **컴파일이 깨진다**. `code`·`present` 는 여전히 빠지면 깨진다 | `auth-definitions.ts` 에 ⓐ `in:'json'` ⓑ `method:'POST'` ⓒ `code` 누락 ⓓ `present` 누락 을 각각 넣고 `npm run typecheck` 가 **4/4 모두 실패**하는 것을 확인한 뒤 되돌린다(0181 5단계-e · 0182 AC11 선례) | 배포 선언 컴파일 |
| AC2 | `exchange` 를 선언한 로그인의 교환 요청은 **`POST`** 이고 `content-type: application/json` 이며, 본문 JSON 객체가 `code.params` 의 항목과 코드를 **함께** 갖는다 | `runner.test.ts` — `sessions.send` 가 받은 `method`·`headers['content-type']` 단언 + `JSON.parse(body)` 로 키·값 비교 | `SessionRunner.login` → `exchange` → `sessions.send` |
| AC3 | 교환 요청 URL 에 **쿼리가 붙지 않는다** — 인가 코드가 URL 에 남을 경로가 없다 | `runner.test.ts` — `new URL(req.url).search === ''` **그리고** `req.url` 이 코드 값 문자열을 포함하지 않음 | 〃 |
| AC4 | `code.param` 미지정이면 final URL 에서 `'code'` 로 찾고, 지정하면 그 이름으로 찾는다 (D-005) | `runner.test.ts` 2케이스 — ⓐ `?code=xyz` + `code:{}` ⓑ `?ticket=abc` + `code:{param:'ticket'}` → 각각 교환 **본문**의 코드 값 단언 | 〃 |
| AC5 | `code.name` 미지정이면 본문의 코드 필드 이름이 **유효 param**(= `param ?? 'code'`)과 같고, 지정하면 그 이름이다 | `runner.test.ts` 2케이스 — ⓐ `{param:'ticket'}` → 본문 키 `ticket` ⓑ `{param:'ticket', name:'authorization_code'}` → 본문 키 `authorization_code` (그리고 `ticket` 키 부재) | 〃 |
| AC6 | `code.params` 에 코드와 **같은 이름**이 있으면 실제 인가 코드가 이긴다 (0195 D2 종료) | `runner.test.ts` — `params:{code:'PLACEHOLDER'}` + `code:{}` → 본문 `code` 가 final URL 의 값. **전개 순서를 뒤집으면 이 케이스가 실패해야 한다**(구현 턴이 변이로 확인) | 〃 |
| AC7 | 교환 실패 4종(코드 없음·전송 실패·비-2xx·비-JSON)의 사유 문장과 로그 이름이 0195 와 같다 — 값은 로그에 실리지 않는다 | `runner.test.ts` 기존 케이스 무변경 통과 + `JSON.stringify(events)` 가 코드 값을 포함하지 않음 | `absorb('failed')` → `ProviderStepInfo.message` |
| AC8 | `exchange` 미선언 Auth 는 여전히 세션 grant 로 끝나고 401/origin 미복귀에 `expired` 가 된다 (D-004·D-006 회귀) | `runner.test.ts` 세션 케이스 + `authenticated-request.test.ts` 의 기존 세션 describe 무변경 통과 | `resolveCarrier`(session) → `transport` |
| AC9 | 가이드 §2-b 의 **새 예제**를 실제 `auth-definitions.ts` 에 대입하면 `npm run typecheck` 3/3 을 통과한다 | 붙여넣고 실행한 뒤 되돌린다 | 배포 선언 컴파일 |
| AC10 | `code.in`·`exchange.method` 를 **현재 선언 표면으로 서술하는 문장이 0건**이다 | `rg -n "code\.in\b\|exchange\.method\b\|in: '(query\|form\|json)'" app/src docs/guides docs/arch` → **0**. 허용 예외 = `docs/handoff/**`·`docs/archive/**`(과거 판정의 원문 보존)와 이 plan 자신 — 검색 범위에서 제외된다 | — (불변식 가드) |

### AC 검증 주의사항

- **기존 테스트 재사용 — 실재 확인**: `runner.test.ts` 의 `exchangeSpec` 헬퍼(`:29-38`)·교환 describe·실패 케이스(`:192`·`:207`·`:281`)·세션 케이스가 모두 실재한다. `authenticated-request.test.ts:351` 과 `login.test.ts:1265` 의 `code:{in:'query'}` 두 자리는 **`code:{}` 로 바뀌어야 컴파일된다** — AC1 이 그 강제의 정본이다.
- **AC1 의 술어는 4갈래를 각각 센다**: "typecheck 가 깨진다" 하나로 묶으면 `code` 누락 때문에 깨진 것을 `in` 거부로 오인할 수 있다. 네 변형을 **한 번에 하나씩** 넣어 각각 실패를 확인한다.
- **AC3 은 부정형이 아니라 관측이다**: `search === ''` 만으로는 코드가 path 에 붙는 변이를 못 본다. 그래서 `req.url` 이 코드 값을 포함하지 않는지도 함께 본다 — 두 단언이 같은 불변식("코드는 URL 어디에도 없다")의 두 면이다.
- **AC6 은 주석이 아니라 케이스다**: 0195 verify 가 이 불변식을 무테스트로 판정했다(변이 M-G 미검출, 파생 D2). `exchangeRequest` 를 이번에 다시 쓰므로 같은 자리를 케이스 없이 통과시키지 않는다.
- **AC10 의 음성 게이트 분해**: 제거 대상 = 선언 표면 서술. 허용 대상 = ① handoff/archive 의 과거 원문 ② 이 plan 의 인용. 술어가 `app/src`·`docs/guides`·`docs/arch` 세 경로만 훑으므로 허용 대상은 술어에 들어오지 않는다. `AuthProbe.method`(`contracts/auth.ts:257`)·`AuthenticatedRequest.method`(`:291`)는 **다른 계약**이고 `exchange.method` 로 표기되지 않아 술어가 잡지 않는다.
- **N회/총량 기준**: 해당 없음. 이번 변경은 요청 수·방송 수를 늘리지 않는다.
- **사람 실기 항목**: 없다. 창·전송이 전부 포트라 순수 테스트로 닫는다. 실 SP 왕복은 0195 와 마찬가지로 이 환경에서 관측 불가이며 **이번 정정의 인수 조건이 아니다**.

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| `in: 'query' \| 'form'` 이 계약의 필수 필드다 | `app/src/main/contracts/auth.ts:152` |
| `method?: string` 이 `SessionTokenExchange` 에 있다 | 같은 파일 `:174` |
| 같은 파일의 `method?: string` 두 자리는 **다른 계약**이다 — `AuthProbe`(`:257`)·`AuthenticatedRequest`(`:291`) | 같은 파일 |
| `exchangeRequest` 가 `in==='form'` 에서만 본문을 만든다 | `browser-session/runner.ts:248-260` |
| 그 함수의 "겹치면 코드가 이긴다" 는 주석뿐이고 케이스가 없다 | `runner.ts:234-235`(주석) · 0195 verify §13 D2 |
| `getJson` 의 `query` 인자를 채우는 유일한 호출부가 `exchangeRequest` 다 | `runner.ts:259` (whoami 는 `{path}` 만: `:96`) |
| `getJson` 은 `contentType` 을 그대로 헤더에 싣는다 — JSON 갈래에 새 배선이 필요 없다 | `runner.ts:137-141` |
| `PreparedRequest` 는 `{url, method, headers, body?}` 라 JSON 본문을 이미 받는다 | `infra/net/transport.ts:8-13` |
| `exchange` 선언에 대한 **런타임 검증이 없다** — 강제는 TypeScript 뿐이다 | `features/auth/registry.ts` 에 `exchange` 참조 0건 |
| `auth.md` §4.6 뒤에 `---` 가 2개 연속이다 | `docs/arch/backend/auth.md:347`·`:349` (0195 파생 D5) |
| 가이드 §2-b 예제·필드표가 구 형상을 현재형으로 서술한다 | `closed-network-extensions.md:369`·`:372`·`:387` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `code.in` / `in:'query'\|'form'` 참조 (app/src) | `rg -n "code\.in\b\|\bin: '(query\|form)'" app/src` | **11** | 계약 2(`:152`·`:173` 주석) · 구현 1(`runner.ts:248`) · 테스트 8 |
| `exchange.method` 참조 | `rg -n "exchange\.method" app/src` | **2** | `runner.ts:251`·`:258`. 계약 선언(`auth.ts:174`)은 별도 |
| 같은 파일의 다른 `method?: string` | `rg -n "method\?: string" app/src/main/contracts/auth.ts` | **3** | `:174`(삭제 대상) · `:257` `AuthProbe` · `:291` `AuthenticatedRequest` — **뒤 둘은 건드리지 않는다** |
| `getJson` 의 `query` 를 채우는 호출부 | `rg -n "query:" app/src/main/features/auth` | **1** | `runner.ts:259` — 삭제 후 죽은 인자가 된다 |
| 프로덕션 `config.exchange` 선언 | `auth-definitions.ts` 확인 | **0** | 계약 파괴 비용이 여전히 0이다 |
| `code.in`·`exchange.method` 문서 참조 (핸드오프 이력 제외) | `rg -n "code\.in\b\|exchange\.method\|in: '(form\|query)'" docs --glob '!docs/handoff/**' --glob '!docs/archive/**'` | **3** | 가이드 2(`:369`·`:387`) · arch 1(`auth.md:330`). 가이드 `:372` 의 `method:` 는 예제 줄이라 이 술어에는 안 잡히나 같은 대상 |
| `SessionCodeExchange` 참조 | `rg -n "SessionCodeExchange" app/src` | **2** | 계약 1 · `runner.ts` import 1 |

### 수치 / 전칭 표현 검산

- 위 수치는 전부 이번 세션에서 직접 셌다. 승계한 값은 없다.
- 내역 합 검산: `code.in` **11** = 계약 2 + 구현 1 + 테스트 8(`runner.test.ts` 6 · `login.test.ts` 1 · `authenticated-request.test.ts` 1).
- "`getJson` 의 `query` 소비자는 하나뿐" — `rg "query:"` 를 `features/auth` 전수로 돌려 반례를 확인했다(다른 1건은 `authenticated-request.ts:338` 의 `withQuery` 로 다른 함수다).
- "런타임 검증이 없다" — `registry.ts` 에 `exchange` 문자열 0건으로 확인했다.
- 문서 앵커 확인: `closed-network-extensions.md §2-b`(존재, `:352`) · `§1.7`(존재, `:213`) · `§9 자주 막히는 곳`(존재, `:1038`) · `auth.md §4.6`(존재, `:315`).
- 기존 테스트 케이스 확인: `runner.test.ts` 의 `exchangeSpec`(`:29`) · 교환 케이스(`:140`·`:156`·`:183`) · 실패 케이스(`:192`·`:207`·`:281`) 실재.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- **책임 소유자**: `SessionRunner` 가 창·코드 추출·교환·whoami 를, `LoginService` 가 grant 조립·probe·커밋을 갖는다. 이번 변경은 이 배치를 바꾸지 않는다.
- **흐름**: 창 → finalUrl → `pickUrlParam` → `exchangeRequest` 가 **`in` 을 보고 두 갈래로 갈린다** → `getJson` → `sessions.send`.
- **오류 경로**: 교환 실패 4종이 `exchange_failed` 로 접힌다.
- **문제의 직접 원인**: `exchangeRequest` 의 분기가 **존재하지 않는 요구**를 섬긴다. `'query'` 갈래는 요구 ② 를 오독해 만들어졌고(D-008), 실제 SP 는 POST 로만 교환한다(D-009). 남은 대가는 죽은 분기 하나와, 인가 코드가 URL 에 실릴 수 있는 갈래 하나다.

```text
finalUrl → pickUrlParam → exchangeRequest
                            ├ in==='form' → POST + urlencoded body
                            └ else        → GET  + query(코드가 URL 에)
                          → getJson(path, method, query?, body?, contentType?)
                          → sessions.send
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- **책임 소유자**: 그대로다. 옮기는 책임도 새 모듈도 없다.
- **흐름**: 창 → finalUrl → `pickUrlParam` → `exchangeRequest` 가 **분기 없이** POST+JSON 하나를 만든다 → `getJson` → `sessions.send`.
- **오류 경로**: 그대로다. 새 실패 사유도 새 문장도 없다.
- **유지**: `pickUrlParam` 의 쿼리+프래그먼트 규칙 · `getJson` 의 2xx+JSON 판정 · whoami 갈래 · `params` 보다 코드가 이기는 우선순위 · 세션 grant 경로 전부.
- **제거**: `in` 분기 · `method` 오버라이드 · `getJson` 의 `query` 인자(소비자 0).

```text
finalUrl → pickUrlParam → exchangeRequest
                          → { path, body: JSON.stringify({...params, [name]: code}) }
                          → getJson(path, method='POST', body, contentType='application/json')
                          → sessions.send   ← 파티션·쿠키 유지 (D-007 무변경)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | 구현/검증 연결 |
|---|---|---|---|---|
| 계약 표면 | `code.in` 필수 · `method` 선택 | **두 필드 삭제** | D-009·D-010 | `contracts/auth.ts` · AC1 |
| 요청 형상 | 선언이 고르는 2갈래 | POST + `application/json` 고정 | D-009 | `runner.ts` · AC2 |
| 코드 위치 | `'query'` 갈래에서 URL 에 실렸다 | **본문에만** 실린다 | D-009 부수 효과 | `runner.ts` · AC3 |
| 이름 규칙 | `param`·`name` 기본값 | **유지** | D-005 | `runner.ts` · AC4·AC5 |
| `params` 우선순위 | 코드가 이긴다(주석만) | 유지 + **케이스로 잠근다** | 0195 D2 | `runner.test.ts` · AC6 |
| `getJson` 인자 | `{path, method?, query?, body?, contentType?}` | `query` **삭제** | 소비자 0 | `runner.ts` · typecheck |
| 실패 경로 | 4종 | **무변경** | 정정 범위 밖 | `runner.test.ts` · AC7 |
| 세션 grant | 쿠키 · 401/origin 강등 | **무변경** | D-004·D-006 | `authenticated-request.test.ts` · AC8 |
| test seam | 포트 fake | **무변경** — 새 포트 0 | — | `runner.test.ts` |

> AS-IS 에서 사라진 책임은 **삭제**다(이동 아님). "요청 형상을 고른다" 는 능력이 코어·선언 어디에도 남지 않는다 — 그것이 D-009·D-010 의 요구다.

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `contracts/auth.ts` | 선언 형상 | 타입만 | 전부 |
| `specs/browser-session.ts` | 순수 파싱 헬퍼(`pickUrlParam` 등) | url/이름 → 값 \| undefined | `runner.ts` |
| `browser-session/runner.ts` | 창 → 코드 → 교환 → `AuthResult` | `AuthDefinition`·spec → `AuthResult` | `LoginService` |

## 10. 계약 / 타입 / 강제 지점

| 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|
| `code.in` 부재 | `contracts/auth.ts` | TypeScript excess property check | **컴파일** — 선언 지점 전부(배포 1파일 + 테스트 3파일 = **4지점**) | 남으면 배포가 고를 것 없는 선택지를 계속 적는다 |
| `exchange.method` 부재 | 〃 | TypeScript | **컴파일** — 같은 4지점 | 남으면 POST 고정이라는 사실이 계약에서 읽히지 않는다 |
| `code`·`present` 필수 (D-001·D-006 유지) | 〃 | TypeScript | **컴파일** | 빠지면 쿠키 교환·`grant_not_valid` 경로가 되살아난다 |
| 교환 요청 = POST + `application/json` | `runner.ts` `exchangeRequest()` | 그 함수 | **교환 요청 조립 시 — 지점 1곳** | 갈리면 SP 가 415/405 로 거절한다 |
| 코드가 `params` 를 이긴다 | 〃 (전개 순서) | 테스트 | **CI** (AC6) | 자리표시자가 실제 인가 코드를 조용히 덮는다 |
| 코드가 URL 에 실리지 않는다 | 〃 (본문 전용) | 테스트 | **CI** (AC3) | 프록시·서버 액세스 로그에 인가 코드가 남는다 |
| 토큰 출처 = 응답 JSON (D-006 유지) | 불변식 | `no-cookie-token.test.ts` | **CI** | 쿠키에서 토큰을 만드는 코드가 들어온다 |
| 문서가 구 형상을 서술하지 않는다 | 가이드 · arch | AC10 음성 게이트 | **검증 턴** | 배포가 존재하지 않는 필드를 적는다 |

- **같은 규칙의 SSOT**: 코드 필드 이름 규칙(`name ?? param ?? 'code'`)은 `exchangeRequest` 한 곳에서만 계산한다. 문서는 그 규칙을 **서술만** 하고 재구현하지 않는다.
- **선택적 필드 의미**: `code.param` `undefined` = `'code'`(D-005). `code.name` `undefined` = 유효 `param`. `code.params` `undefined` = 코드만 싣는다. `code` 는 **필드가 전부 선택**이 되므로 `code: {}` 가 "이 SP 는 코드를 돌려준다" 는 표식이 된다 — D-006 의 컴파일 강제는 `code` 객체 자체의 필수 여부가 담당하므로 그대로 성립한다.
- **외부 SDK 경계**: 없음. `JSON.stringify` 로 본문을 만든다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/contracts/auth.ts` | 계약 | `SessionCodeExchange.in` 삭제 · `SessionTokenExchange.method` 삭제 · `code` 주석에서 요구 ② 인용을 **정정된 뜻**(D-008)으로 다시 쓴다 · POST+JSON 고정과 그 이유를 남긴다 | 타입 |
| `app/src/main/features/auth/browser-session/runner.ts` | 교환 조립 | `exchangeRequest` 를 분기 없는 POST+JSON 으로 · `getJson` 에서 `query` 인자와 `searchParams` 루프 제거 · `URLSearchParams` 사용 제거 | 순수 단위 (포트 fake) |
| `app/src/main/features/auth/browser-session/runner.test.ts` | 회귀 | `exchangeSpec` 기본값 `code:{}` · 구 `'query'`/`'form'` 케이스를 AC2~AC6 로 재작성 · AC6 신설 | — |
| `app/src/main/features/auth/login.test.ts` | 회귀 | `:1265` 의 `code:{in:'query'}` → `code:{}` | — |
| `app/src/main/features/auth/authenticated-request.test.ts` | 회귀 | `:351` 의 `code:{in:'query'}` → `code:{}` | — |
| `docs/guides/closed-network-extensions.md` | 절차 | §2-b 예제에서 `in`·`method` 삭제 + JSON 본문 결과를 주석으로 · 필드표에서 `code.in` 행 삭제, `code.name` 행을 "본문 필드 이름" 으로 · §9 에 "SP 가 form 만 받으면 415/405" 행 1개 | AC9 |
| `docs/arch/backend/auth.md` | 구조 | §4.6 의 "형상은 선언이 정한다" 문단을 POST+JSON 고정으로 재작성 · `---` 중복 1건 제거(0195 D5) | AC10 |
| `docs/handoff/0195-.../plan.md` | 이력 | 메타 아래 한 줄 — 이 계약은 0196 이 정정했다(전방 포인터) | — |
| `docs/handoff/INDEX.md` | 보드 | 0196 행 추가 | — |

### 테스트 가능성

- **electron 분리**: `runner.ts`·`specs/browser-session.ts` 는 electron 을 import 하지 않는다(현행 유지). 새 포트가 없어 `bootstrap.ts` 는 무변경이다.
- **기존 메커니즘 재사용 적합성**: `getJson` 의 `contentType` 배선(`:137-141`)이 이미 임의 content-type 을 헤더에 싣는다 — JSON 갈래에 새 경로가 필요 없다. `PreparedRequest.body` 도 문자열이라 그대로 맞는다.
- **`auth-definitions.ts` 를 인수 수단으로 쓰는 이유**: 배포 선언이 계약의 **유일한 외부 진입점**이고, 테스트 픽스처는 `as` 로 우회할 수 있어 excess property check 를 실제 배포 지점에서 확인해야 한다(AC1·AC9).
- **순서 관측**: 필요 없음. 순서를 요구하는 AC 가 없다.

## 12. End-to-end 영향

### producer → consumer

```text
SP final URL → pickUrlParam → JSON POST 교환 → 응답 JSON → TokenValue
  → Grant{token,…} → AuthStore → resolveCarrier → applyPresentation → 요청 헤더
```

- **producer 기준**: 토큰의 유일한 출처는 교환 응답의 `valuePath` 다(D-006 무변경).
- **consumer 파생 규칙**: 변화 없음. `connection-views.ts` 는 `activeMethod` 를 그대로 싣고 GUI 표시가 바뀌지 않는다.
- **정본 우회 없음**: 요청 형상이 하나뿐이라 소비자가 고를 자리가 사라진다 — 이번 변경은 우회 표면을 **줄인다**.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `auth-resume` (복원·재로그인) | 변화 없음 — grant 형태·`authKind`·만료 판정이 그대로다 | AC8 |
| gate 판정 (`features/gate`) | 변화 없음 — `status`·`verified` 어휘 불변 | AC8 |
| IPC · settings · migration | **변화 없음** — 채널 0 · 키 0 · 마이그레이션 0 | — |
| 배포 선언 (`auth-definitions.ts`) | 프로덕션 `exchange` 선언 0건이라 고칠 선언이 없다 | AC1·AC9 |

## 13. Lifecycle / 오류 / 정리

- **생성/시작 · 취소/중단 · retry/timeout · cleanup/rollback**: 전부 0195 그대로다. 이번 변경은 요청 **본문 조립**만 건드린다.
- **다중 저장소 쓰기**: **코드에는 해당 없음** — vault·grant 쓰기 순서와 실패 처리를 건드리지 않는다(0195 §13 의 분석이 그대로 유효하다).
- **문서 사본**: 이 handoff 의 판정·상태는 `plan.md`(이 파일)와 `docs/handoff/INDEX.md` 보드 **2곳**에 산다. 상태를 바꾸는 커밋은 둘을 함께 갱신한다. 0195 의 archive 행은 **고치지 않는다** — 그 판정은 그때의 요구 기준으로 참이다.

## 14. 성능 / 상한 / 최적화

- **새 요청 수**: **0**. 요청 1회가 1회로 남는다.
- **새 출력 상한**: **0**. 새 로그·새 실패 사유가 없다.
- **구조적 목표**: 계약 필드 **−2**, 구현 분기 **−1**, `getJson` 인자 **−1**. 전부 §8 에서 소비처를 전수로 세어 달성 가능함을 확인했다.
- **잃는 부수 효과**: form-urlencoded·GET 교환 능력. 사용자가 "post로 밖에 교환이 안됨" 으로 불필요를 명시했고 프로덕션 선언이 0건이라 잃는 사용자가 0이다.

## 15. 외부 구현 포트 / 문서 계약

- **외부/배포가 구현할 것**: `AuthDefinition.methods[].config.exchange` — 폐쇄망 배포가 채운다.
- **구현 문서**: `docs/guides/closed-network-extensions.md §2-b` (진입점) · `docs/arch/backend/auth.md §4.6` (구조 서술).
- **shape 검증**: AC9 — 가이드 예제를 실제 `auth-definitions.ts` 에 대입해 `npm run typecheck` 3/3.
- **semantics 검증**: AC1 — 삭제된 두 필드를 적으면 **거부**되는지 확인한다. shape 만 보면 "예제가 컴파일된다" 는 사실이 "구 필드가 사라졌다" 를 보장하지 않는다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| D-002 "교환 요청 형상은 선언이 정한다" | 0195 plan §3 | §3 · §9 Delta · §11 | **변경** — SUPERSEDED (사용자 정정 4·5) |
| D-005 "final URL 에서 추출, 기본 `'code'`" | 0195 plan §3 | §7 AC4 | 유지 (D-008 이 재확인) |
| D-006 "`code` 필수 · 쿠키 교환 제거" | 0195 plan §3 | §10 `code` 필수 행 | 유지 — `code` 필드가 전부 선택이 돼도 객체 자체는 필수다 |
| D-007 "`sessions.send` 로 전송" | 0195 plan §3 | §9 TO-BE | 유지 |
| "kind 에서 추론하지 않는다" | `contracts/auth.ts` `Presentation` 주석 | §10 `present` 필수 행 | 유지 |
| "main 전역 `fetch(` 는 `net-fetch.ts` 에만" | `infra/net/no-node-fetch.test.ts` | 없음 — 전송을 건드리지 않는다 | 유지 |
| "docs/arch 는 현재 상태만 서술한다" | root `AGENTS.md` §핵심 원칙 5 | §11 auth.md 행 | 유지 — §4.6 을 **현재 동작으로 재작성**하고 델타는 여기(plan)와 커밋이 갖는다 |
| "코드에서 셀 수 있는 수치를 문서에 적지 마라" | root `AGENTS.md` §핵심 원칙 4 | 없음 — 채널·키·마이그레이션 수를 건드리지 않는다 | 유지 (`inventory.md` 무영향) |
| 0195 파생 D2 (코드 우선순위 무테스트) | 0195 verify §13 | §7 AC6 | **종료** |
| 0195 파생 D5 (`---` 중복) | 0195 verify §13 | §11 auth.md 행 | **종료** |
| 0195 파생 D1·D3·D4·D6 | 0195 verify §13 | §6 비범위 표 | 유지 — 후속 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 실 SP 가 form-urlencoded 만 받으면 교환이 불가능해진다 | 사용자가 "post로 밖에 교환이 안됨" 으로 판단했다. 되돌리기 비용이 낮다(D-010: `in?` 를 선택 필드로 넓히면 기존 선언 무변경) |
| 실 SP 왕복을 이 환경에서 확인할 수 없다 | 0195 와 같은 한계다. 인수는 순수 테스트로 닫고, 실기는 배포 시점의 확인 사항으로 남긴다 |
| 테스트 3파일이 `code:{in:'query'}` 를 쓰고 있어 계약을 지우면 즉시 컴파일이 깨진다 | **의도된 신호다** — AC1 이 그 깨짐을 인수 조건으로 삼는다. 4지점을 전부 §10 에 열거했다 |
| 0195 archive 행이 구 형상을 서술한 채 남는다 | 고치지 않는다(그때의 판정은 참이다). 대신 0195 `plan.md` 에 전방 포인터 한 줄을 둔다 |

- **되돌리기 어려운 결정**: `code.in` 삭제. 다만 선택 필드로 되살릴 수 있어 실질 비용은 낮다(위 표).
- **신규 의존성**: **0**. `JSON.stringify` 는 내장이다.

## 18. 영향 받는 파일 / 문서

- `app/src/main/contracts/auth.ts`
- `app/src/main/features/auth/browser-session/runner.ts`
- `app/src/main/features/auth/browser-session/runner.test.ts`
- `app/src/main/features/auth/login.test.ts`
- `app/src/main/features/auth/authenticated-request.test.ts`
- `docs/guides/closed-network-extensions.md`
- `docs/arch/backend/auth.md`
- `docs/handoff/0195-browser-session-token-exchange/plan.md` (전방 포인터 1줄)
- `docs/handoff/INDEX.md`

## 19. 게이트

- **적용할 하위 가이드**: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md`(레이어 방향 — 이번엔 새 import 가 없다).
- **ABI/네트워크 등 환경 제약**: egress 차단으로 electron ABI 재빌드가 403 이다. DB 로드 스위트 red 는 **알려진 베이스라인**으로 분리 보고한다.
- **기본 정적 게이트**: `npm run lint` (0 error) + `npm run typecheck` (3/3).
- **관련 테스트**: `./node_modules/.bin/vitest run src/main/features/auth` — `npm test` 는 쓰지 않는다(ABI 를 Node 로 뒤집는다).
- **사람 실기**: 없음. 실 SP 왕복은 인수 조건이 아니다(§17).

## READY self-review

- [x] Decision Ledger 의 ACTIVE/SUPERSEDED/OPEN 이 여러 턴의 결정을 보존한다 — 0195 의 D-001~D-007 을 ID 까지 승계했고 D-002 만 SUPERSEDED 다.
- [x] Part I 만 읽어도 완료 상태가 이해된다 — §5 흐름이 구현 파일 없이 결과를 서술한다.
- [x] 조건절·이유절을 재해석하지 않았다 — ⑥·⑦ 을 §2 에 **원문 그대로** 인용했고, "post로 밖에 교환이 안됨" 이라는 이유절을 §4·§14·§17 세 곳의 판단 근거로 썼다.
- [x] Product/UX 의 각 핵심 동작이 AC 와 Technical Design 에 연결된다 — §9 Delta 9행이 전부 AC 또는 파일로 이어진다.
- [x] AS-IS·TO-BE 가 같은 축(책임·흐름·오류·유지/제거)으로 있다.
- [x] AS-IS 에서 사라진 책임을 **삭제**로 명시했다 (§9 Delta 아래 인용).
- [x] 수치·전칭·앵커·기존 테스트를 실측했다 — §8 전수 조사 7행, 내역 합 검산 1건, 앵커 4건, 케이스 6건.
- [x] 각 AC 가 행동 단언·검증 수단·프로덕션 도달 경로를 갖는다.
- [x] 사람 실기로 미룬 순수 로직이 없다 (§7 주의사항 마지막 항).
- [x] semantic 목표가 structural proxy 만으로 검증되지 않는다 — AC1 은 "필드가 없다" 가 아니라 **"적으면 거부된다"** 를 4갈래로 센다. AC3 은 `search===''` 에 URL 전체 검사를 더한다.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam 이 있다 (§10 8행).
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 (§12 — 부팅 경로 변경 0).
- [x] producer/consumer 양쪽 의미를 확인했다 (§12).
- [x] 상한·총량·one-way door 를 계산했다 (§14 · §17 — 되돌리기 비용 포함).
- [x] 게이트 명령이 `app/AGENTS.md` 현재 지침과 충돌하지 않는다 — `npm test` 를 쓰지 않고 `vitest run` 직접 호출을 적었다.
- [x] 본문 완성 후 Decision Ledger 를 전체 교차검증했고 결과를 §3 갱신 메모에 관측으로 적었다 — `ACTIVE 결정 ↔ AC` 7행 + 전수 확인 1줄(구 필드를 요구하는 AC 0건).
- [x] 산출물 문장 규칙 — Part I 은 관측 결과, Part II 는 경로·계약이다. §8 조사는 표로 적었다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

**판정: 설계대로 구현 가능했다.** Decision·AC·§10 을 재해석 없이 수행했고 규범 행을 고치지 않았다.
plan §8 의 전수 수치는 구현 전에 직접 재측정해 전건 일치했다 — 예외 1건은 아래 ②.

| # | 발견 | 성격(§6) | 처리 |
|---|---|---|---|
| ① | AC7 이 "교환 실패 **4종**(코드 없음·전송 실패·비-2xx·비-JSON)" 을 "기존 케이스 무변경 통과" 로 닫는데, 교환 describe 에 **전송 실패(send throw) 케이스가 없었다**. 그 갈래(`exchangeReason` `case 'send'`)는 whoami describe 에만 케이스가 있다(`runner.test.ts:454` '전송 예외') | 명백한 누락 | **선조치** — 교환 실패 케이스 배열에 `'전송 실패'` 1건을 더하고 사유 문장(`네트워크 끊김`)까지 단언했다. 변이 M7(`getJson` 의 `catch` 제거)이 이 케이스를 검출한다 |
| ② | plan §8 전수표의 `SessionCodeExchange` 참조 행이 **N=2**(계약 1·import 1)인데 실측은 **4**다 — 계약 선언(`:146`)·필드 타입(`:168`)·import(`runner.ts:13`)·파라미터 타입(`runner.ts:227`) | 수치 오차(작업에 무영향) | **보고만** — 이 행은 어느 AC·강제 지점도 참조하지 않아 구현 판단을 바꾸지 않았다. 나머지 6행은 전건 일치 |
| ③ | 계약 주석에 "0196 에서 `code.in`·`method` 를 삭제했다" 를 남기면 **AC10 의 술어가 자기 문장에 걸린다**(술어 범위가 `app/src` 를 포함) | 구현 세부 | **선조치** — 주석을 삭제 이력이 아니라 **현재 규칙 + 되돌리는 법**으로 썼다. root `AGENTS.md` 원칙 5(델타 이력은 changelog 지 정본이 아니다)와 같은 방향이다 |

**AC10 술어의 한계 — 토큰 축만으로는 부족하다.** `code.in`·`exchange.method` 라는 *해법의 이름*
으로 세면 그 토큰을 쓰지 않는 stale 문장은 잡히지 않는다. 그래서 **불변식의 주어**(교환 요청 형상을
서술하는 문장)로 한 번 더 훑었다 — `rg "urlencoded|형상은 선언|선언이 정한다|교환 요청" app/src
docs/guides docs/arch` → 9히트 전건 확인, stale 0. 토큰 축이 놓쳤을 문장이 실제로는 없었다.

## [구현자 기입] 구현 보고

**판정: AC 10/10 · 강제 지점 17/17 을 닫았다.** 남긴 곳 없음. 대상 커밋 `d98c7bd`.

### 변경 파일 (8)

| 파일 | 변경 |
|---|---|
| `app/src/main/contracts/auth.ts` | `SessionCodeExchange.in` 삭제 · `SessionTokenExchange.method` 삭제 · `code` 주석을 D-008 의 정정된 뜻으로 재작성 · `SessionTokenExchange` 에 POST+JSON 고정과 되돌리는 법(D-010) 주석 신설 |
| `.../browser-session/runner.ts` | `exchangeRequest` 분기 제거 → POST+JSON 단일 형상(`:236-253`) · `getJson` 에서 `query` 인자와 `searchParams` 루프 제거 · `URLSearchParams` 사용 0 |
| `.../browser-session/runner.test.ts` | `exchangeSpec` 기본값 `code:{}` · `sentBody` 헬퍼 신설 · AC2·AC3·AC6 신설, AC4·AC5 재작성 · AC7 전송 실패 케이스 추가 (총 25케이스) |
| `.../auth/login.test.ts` · `.../auth/authenticated-request.test.ts` | `code:{in:'query'}` → `code:{}` |
| `docs/guides/closed-network-extensions.md` | §2-b 예제에서 `in`·`method` 삭제 + 실제 요청 형상 문단 신설 · 필드표 `code.in` 행 삭제, `code.name`·`code.params` 를 "본문" 으로 · §9 에 415/405 행 1개 |
| `docs/arch/backend/auth.md` | §4.6 형상 문단을 POST+JSON 고정으로 재작성 · `---` 중복 1건 제거(0195 D5) |
| `docs/handoff/0195-.../plan.md` | 메타 아래 전방 포인터 — D-002 SUPERSEDED, r1 PASS 판정 자체는 유효 |

### 게이트 — 관측한 산출

| 명령 | 관측값 |
|---|---|
| `npm run typecheck` | **3/3 통과** (node·web·test), `error TS` **0건** |
| `npm run lint` | **0 error · 1 warning**. 그 warning 은 `useTranscriptVirtualizer.ts:22`(react-hooks/incompatible-library)로 **이번 변경과 무관한 기존 것** — 실행 전후 `git diff --name-only` 가 동일해 `--fix` 가 쓴 파일 0 |
| `vitest run src/main/features/auth` | **12파일 237케이스 전건 green** |
| `vitest run` (전체) | **207파일 중 202 green · 5 red / 2058케이스 중 2016 green · 42 red** |
| `node scripts/check-doc-inventory.mjs --check` | generated ok(9 items·76 channels) · prose ok · **links ok** |

**red 42건은 환경 기인이다 — 변경과 무관.** 실패 파일은 `app/AGENTS.md` 가 적은 알려진 베이스라인
**5파일과 정확히 같다**(`infra/db/{queries,migrate}` · `features/extensions/builder` ·
`features/orchestration/fork` · `app/chat-turn.continuity`), 서명은 전건
`Module did not self-register: …/better_sqlite3.node`(egress 차단 → Electron ABI 재빌드 403).
**추정이 아니라 실측이다**: `git stash` 로 변경을 뺀 트리에서 같은 5파일을 돌려 **42 failed 동일**
을 관측했다. 인증 스위트는 이 5파일과 겹치지 않는다.

### 강제 지점 전수 (§10 8행 → 17지점)

| §10 행 | 지점 수 | 결과 | 이번 턴 재현한 관측값 |
|---|---:|---|---|
| `code.in` 부재 | 4 (배포1+테스트3) | **4/4** | 배포: `TS2353 … 'in' does not exist in type 'SessionCodeExchange'` · 테스트 3파일: `rg "\bin: '(query\|form)'" app/src` → **0건** |
| `exchange.method` 부재 | 4 (같은 지점) | **4/4** | 배포: `TS2353 … 'method' does not exist in type 'SessionTokenExchange'` · `rg "exchange\.method" app/src` → **0건** |
| `code`·`present` 필수 | 2 | **2/2** | `TS2741 Property 'code' is missing` · `TS2741 Property 'present' is missing` |
| 교환 요청 = POST + `application/json` | 1 | **1/1** | `runner.ts:247-252`. 지점 수는 **주어 축**으로 셌다 — `rg "sessions\.send" features/auth --glob '!*.test.ts'` 중 browser-session 로그인 경로는 `runner.ts:131` 하나(나머지는 로그인 후 API 전송). 변이 M1·M2 검출 |
| 코드가 `params` 를 이긴다 | 1 | **1/1** | 신설 케이스 `code.params 에 같은 이름이 있어도…` · 변이 M3(전개 순서 반전) 검출 |
| 코드가 URL 에 실리지 않는다 | 1 | **1/1** | 신설 케이스 `교환 요청 URL 에 쿼리가 붙지 않고…` · 변이 M6(0196 이전 query 갈래 복원) 검출 |
| 토큰 출처 = 응답 JSON | 1 | **1/1** | `no-cookie-token.test.ts` 1파일 4케이스 green. **이번 턴 무변경 장치**라 변이를 심지 않았다 |
| 문서가 구 형상을 서술하지 않는다 | 3 | **3/3** | 토큰 축 `rg "code\.in\b\|exchange\.method\b\|in: '(query\|form\|json)'" app/src docs/guides docs/arch` → **0건** + 주어 축 sweep(설계 리뷰 참조) stale **0** |

`✅ 8행 · ⚠️ 0 · ❌ 0 = 총 8행` / 지점 합 `4+4+2+1+1+1+1+3 = 17`.
(1·2행은 같은 4파일에 걸리는 **서로 다른 두 불변식**이라 따로 센다.)

### 검사 장치의 적대 검사 — 이번 턴에 만든 장치에 결함을 심었다

**AC1(typecheck 거부)은 control 을 함께 돌렸다.** 유효 선언 1회 + 변형 4회 = 5회. control 이
PASS 해야 4건의 FAIL 이 "무엇을 넣어도 빨간 것" 이 아님을 말한다 — control **PASS**, 변형 **4/4
FAIL** 이고 각 오류가 지목한 필드가 서로 달랐다(위 표의 TS 코드).

**신설 테스트에는 판정 지점마다 변이를 하나씩 심었다** (7건 전건 검출, 전부 되돌림):

| 변이 | 심은 결함 | 검출한 케이스 |
|---|---|---|
| M1 | `method: 'POST'` → `'GET'` | AC2 |
| M2 | `contentType` → `x-www-form-urlencoded` | AC2 |
| M3 | 전개 순서 반전 — 자리표시자가 이긴다 | AC6 |
| M4 | `code.name` 무시 (항상 유효 param) | AC5 · AC2 |
| M5 | `param` 기본값 `'code'` → `'ticket'` | AC4 외 11건 |
| M6 | 코드를 본문에서 빼 URL 쿼리로 (**0196 이전 갈래 복원**) | AC3 외 5건 |
| M7 | `getJson` 의 `catch` 제거 — 전송 예외를 흘려보낸다 | AC7 신설 케이스 |

**AC9 는 문서를 다시 타이핑하지 않았다** — 가이드 §2-b 의 ```ts 펜스를 정규식으로 **파일에서 추출**해
그대로 `auth-definitions.ts` 에 대입했다. 내 기억이 아니라 문서가 검증 대상이다.

### AC 자기보고 (검증자는 증거로 받지 않는다)

| AC | 판정 | 이번 턴 재현한 관측값 |
|---|---|---|
| AC1 | ✅ | control PASS + 4변형 FAIL, TS2353×2·TS2741×2. 대입 후 `git diff` 빈 출력으로 원복 확인 |
| AC2 | ✅ | `method='POST'` · `content-type='application/json'` · 본문 `{authorization_code, grant_type, client_id}` `toEqual` |
| AC3 | ✅ | `new URL(req.url).search === ''` **그리고** `req.url` 에 `secret-code` 부재 **그리고** 본문에 존재 |
| AC4 | ✅ | ⓐ `code:{}`+`?code=xyz` → 본문 `{code:'xyz'}` ⓑ `{param:'ticket'}`+`?ticket=abc` → `{ticket:'abc'}` |
| AC5 | ✅ | ⓐ `{param:'ticket'}` → 본문 키 `ticket` ⓑ `+name` → `{authorization_code:'abc'}` (`toEqual` 이 `ticket` 키 부재까지 센다) |
| AC6 | ✅ | `params:{code:'PLACEHOLDER'}` → 본문 `{code:'auth-code-1', grant_type:'x'}` |
| AC7 | ✅ | 실패 4종 전건(코드 없음·**전송 실패**·비-2xx·비-JSON) → `exchange_failed`. 로그 케이스의 `JSON.stringify(events)` 에 `secret-code` 부재. 4번째 갈래는 이번 턴에 신설(설계 리뷰 ①) |
| AC8 | ✅ | `runner.test.ts` 세션 케이스 + `authenticated-request.test.ts` 무변경 통과 — auth 12파일 237케이스 green 에 포함 |
| AC9 | ✅ | 가이드 예제 추출 → 대입 → `typecheck` **3/3, error 0** → 원복(`git diff` 빈 출력) |
| AC10 | ✅ | 토큰 축 **0건** + 주어 축 stale **0**. 부수로 `---` 중복은 `docs/**`(handoff·archive 제외) 전수 **0** — 지적받은 auth.md 1곳만이 아니라 전 축을 확인했다 |

`✅ 10 · ⚠️ 0 · ❌ 0 = 총 10` — plan §7 의 현재 AC 총수도 **10** 이라 분모 변경 없음.

### 구현 중에만 보인 것 (§3)

- **다중 저장소 쓰기 — 코드에는 없다.** vault·grant 쓰기 순서를 건드리지 않았다. **문서에는 있다**:
  이 handoff 의 상태가 `plan.md` 메타와 `INDEX.md` 보드 **2곳**에 산다. 같은 커밋에서 둘 다 갱신했다.
- **제거한 분기가 건너뛰던 것은 없다.** `getJson` 의 `query` 루프는 소비자가 `exchangeRequest`
  하나뿐이었고(whoami 는 처음부터 `{path}` 만 넘긴다) 삭제 후 재검증을 잃는 경로가 없다.
- **`getJson` 의 `method ?? 'GET'` 기본값은 살려 뒀다** — whoami 가 여전히 그 갈래의 유일한
  소비자다. 교환이 POST 를 명시하므로 두 소비자가 갈리지 않는다.
- **false success 가능성 0** — `exchangeRequest` 는 순수 함수라 삼킬 오류가 없고, 전송 예외는
  `getJson` 의 `catch` 가 사유로 접는다(M7 이 그 catch 의 실재를 센다).
- **동시 호출·늦은 응답·종료 중**: 이번 변경이 만드는 새 상태가 없다 — 본문 조립만 바뀌었다.

### Product/UX 파생 검토 (§4)

- **새 사용자 대면 문자열 0.** `ProviderFailureReason` 도 문장 4종도 그대로라 renderer·i18n 변경이
  0이다 — `rg "exchange" src/renderer src/shared` 의 히트는 전부 chat turn 의 동음이의어이고
  `shared/ipc.ts:1301` 의 `'exchange_failed'` 는 무변경이다.
- **이번에 만든 실패 경로는 Part I 상태 전이표의 기존 행이다.** "SP 가 form 만 받는다" → 비-2xx →
  `토큰 교환이 415 로 실패했습니다`(`exchangeReason` `case 'status'`). **표에 빠진 행이 없다.**
  그 문장을 사용자가 어디서 보는지까지 확인해 가이드 §9 에 진단 행 1개로 남겼다.
- **"아무 일도 안 일어남" 없음** — 모든 실패가 `exchange_failed` 로 화면에 뜬다.
- **보안은 좋아졌다**: 인가 코드가 URL 에 실릴 갈래가 사라져 프록시·서버 액세스 로그 노출 경로가
  **0**이 됐다. AC3 이 그 상태를 잠근다.

### Review Signals (사실만 — 분류는 `handoff-review` 몫)

- **현재 라운드: 1.** 재구현이 아니라 신규 구현 턴이다.
- **같은 축의 재발**: 0195 파생 D2(`params` 우선순위 무테스트)와 이번 설계 리뷰 ①(AC7 의 4갈래 중
  1갈래 무케이스)은 **같은 축**이다 — *주석·문장이 선언한 불변식에 케이스가 없다*. 0195 verify 가
  D1~D4 로 같은 축 4건을 이미 적었고, 이번 턴에 그중 D2 를 닫으면서 같은 형태를 하나 더 만났다.
- **그것을 막았어야 할 지침**: plan §7 "AC 검증 주의사항" 이 "기존 테스트 재사용 — 실재 확인" 을
  요구하고 그 확인을 **케이스 파일·줄 단위로** 했으나, AC7 처럼 "N종" 을 세는 AC 는 *케이스가
  실재하는가* 가 아니라 *N갈래가 각각 덮이는가* 를 물어야 걸린다. 실재 확인은 통과했고 갈래
  누락은 통과하지 못했다.
- **환경 한계(반복)**: egress 차단으로 Electron ABI 재빌드가 403 — DB 로드 5파일 red 가 이번에도
  베이스라인이다. 실 SP 왕복은 이 환경에서 관측 불가(§17 이 인수 조건에서 제외).

## [검증자 기입] 파생 이슈

**r1 = PASS.** 판정 원문은 [`verify.md`](verify.md). 아래는 그 §13 이관분이며 **전부 문서·라벨·
미관측 축이라 제품 동작을 바꾸지 않는다** — 프로덕션 결함 0건이다.

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| W1 | `INDEX.md` 0196 비고 1,079자 — `docs/handoff/AGENTS.md §산출물 문장 규칙 3` 의 5줄 상한 초과(형제 PASS 행 474~584자). **0195 D7 과 같은 증상의 연속 재발** | verify §11 | verify 갱신에서 5줄 이내로 교체 | **닫힘** |
| W2 | `runner.test.ts` 의 AC 라벨이 0195·0196 두 체계로 섞였다 — `// AC6 (0196)`(`:232`)과 `// AC6`(`:244`)이 서로 다른 기준을 가리킨다 | verify §13 | 라벨에 handoff 번호를 붙이거나 라벨을 뗀다 | 열림 |
| W3 | `code` 는 필수인데 하위 3필드가 전부 선택이라 최소값이 `code: {}` 하나다 — 타입만으로는 `code?:` 와 구별되지 않는다. §10 이 "표식" 으로 의도를 적었고 D-006 이 부재에 다른 의미를 배정했으므로 **결함이 아니라 기록** | verify §13 | 유지. 되돌린다면 D-006 의 의미 충돌을 먼저 닫는다 | 기록 |
| W4 | 실 SP 로그인 왕복 미관측 — 폐쇄망 SP 가 이 환경에 없다 | verify §8 | 배포 시점 사람 1회 확인. 415/405 면 가이드 §9 진단 행 | 사람 |
