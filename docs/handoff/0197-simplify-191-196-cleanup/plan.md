# Plan — 0197-simplify-191-196-cleanup

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md),
> 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0197-simplify-191-196-cleanup` |
| 작성자 | Claude Code |
| 일자 | 2026-08-22 |
| 입력 | 사용자 요청 `/simplify 핸드오프 191~196` + 후속 두 턴(명명·문서 동반 갱신) + 리뷰 에이전트 2건 |
| 리뷰 구간 | `02bed26..9f13533` — 0191~0196. `app/src/**` 37파일 · +3,300/−221 |
| 상태 | READY |

---

# Part I — Product & UX Contract

## 1. Context / 목표

- **해결하려는 문제**: 0191~0196 은 verify 라운드를 각각 6·3·2·5·1·1회 돌았다. 그 반복이 세
  종류의 잔여물을 남겼다 — ⓐ 같은 규칙의 복수 철자(`Extract<Grant>` 별칭 3파일, 위생 스캐너 2사본)
  ⓑ 같은 diff 가 도입한 공용 장치를 승계하지 못한 조립부(`compact` 6곳 중 `TokenValue` 만 누락)
  ⓒ 몸통과 어긋나는 이름(`reloginOnce` 가 N회 루프, `label` prop 이 variant).
- **완료 후 달라지는 것**: 위 셋이 정리되고, 폐쇄망 배포자가 읽는 `code.param`/`code.name`/
  `code.params`·`valuePath` 가 뜻이 읽히는 이름이 된다.
- **성공을 사용자 관점에서 한 문장으로**: **앱 사용자가 관측하는 것은 아무것도 달라지지 않는다** —
  달라지는 것은 배포 선언을 쓰는 사람과 로그를 읽는 운영자가 보는 **이름**뿐이다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | `/simplify 핸드오프 191~196` + "**불필요한 구현 및 변수들에 집중하라**" | 라이브 세션 |
| 명시 요구 | "추가로 **변수명이 불확실하거나 뜻이 모호한 것들을 고쳐라**" | 라이브 세션 (2회 반복) |
| 명시 요구 | "**변수 변경시 문서도 업데이트하면 된다**" | 라이브 세션 (2회 반복) |
| 명시 결정 | 죽은 경로 3지선다에서 "**동작 불변 정리만**" 선택 | 라이브 세션 (AskUserQuestion) |
| 명시 결정 | 헬퍼 승격 3지선다에서 "**이번 diff 안만**" 선택 | 라이브 세션 (AskUserQuestion) |
| 추론 의도 | `/simplify` 계열의 "버그 사냥이 아니다" 가 이번에도 유효하다 — **추론**. 근거: 스킬 정의 + 선례 0187·0190 | `.agents/skills/simplify` |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 범위는 **동작 불변 정리만**. 앱 사용자 관측 동작을 바꾸지 않는다 | 사용자가 3지선다에서 선택 | 사용자 턴 | ACTIVE | — |
| D-002 | `SessionTokenExchange.refreshTokenPath` **죽은 경로는 유지**한다 | D-001 의 직접 귀결. 읽는 코드가 없지만(§8) 문서 3곳이 선언한 공개 배포 계약이라 제거는 계약 축소다 | 사용자 턴 | ACTIVE | — |
| D-003 | `numberOr`/`stringOr` 승격의 **소비자는 `store-parse.ts` 하나**. 저장소 기존 인라인 10곳은 건드리지 않는다 | 사용자가 3지선다에서 "이번 diff 안만" 선택 | 사용자 턴 | ACTIVE | — |
| D-004 | **이름이 몸통과 어긋나거나 뜻이 모호한 식별자를 고친다** | 사용자가 두 턴 연속 명시 | 사용자 턴 | ACTIVE | — |
| D-005 | **개명이 문서를 건드려도 된다** — 문서를 함께 갱신한다. 그래서 계약 필드·로그 필드 이름도 범위에 들어온다 | 사용자가 두 턴 연속 명시. D-002 와 충돌하지 않는다: **철자만** 바꾸고 필드의 유무·의미·기본값은 그대로다 | 사용자 턴 | ACTIVE | — |
| D-006 | 개명 대상 판정 기준은 **두 가지뿐** — ⓐ 이름이 몸통과 모순 ⓑ 같은 스코프/diff 에서 한 단어가 두 가지를 지칭. 취향 차이는 제외 | D-004 를 실행 가능한 술어로 좁힌다. 없으면 "더 나은 이름" 이 무한 범위가 된다 | 설계 판단 | ACTIVE | — |
| D-007 | `docs/handoff/**` · `docs/archive/**` 는 개명해도 **갱신하지 않는다** | 루트 `AGENTS.md` §핵심 원칙 1 — 과거 증거지 현재 사양이 아니다. 옛 철자가 남는 것이 정상 | 저장소 규칙 | ACTIVE | — |
| D-008 | `SessionLookup.valuePath` 는 **그대로 둔다** | `SessionTokenExchange` 쪽만 바꾸면 한 철자가 두 대상을 갖는 충돌이 사라진다. 그쪽은 "값 하나를 꺼낸다" 가 실제 계약 | 설계 판단 | ACTIVE | — |

### 갱신 메모

- 이번 턴 신규: D-001~D-008 전부(신규 handoff).
- 변경된 결정: 없음.
- **0191~0196 의 ACTIVE 결정은 전부 유지된다.** 이 handoff 는 그중 어느 것도 뒤집지 않는다 —
  0195 D-003(refresh token 저장만)·D-006(토큰 출처는 교환 응답 JSON 하나)·0196 D-009(POST+JSON
  고정)·0194 D-014(미회전 승계)는 §16 에서 행별로 유지 판정했다.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0.
  `D-001`("동작 불변") ↔ `AC5`("전선 형상 동일")·`AC2`("키 집합 동일") → 서로를 강화한다.
  `D-002`("refreshTokenPath 유지") ↔ `AC11`("`rg refreshTokenPath` ≥ 1, 의미 불변") → 일치.
  `D-005`("철자만") ↔ `AC9`("필드 **개수·선택성**이 변경 전과 같다") → 일치.
  `D-008`("SessionLookup 유지") ↔ `AC8` 의 `valuePath` grep 이 **1건 잔존을 요구** → 일치
  (0건을 요구했다면 D-008 과 정면 충돌이었다).

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | **타당** | 0191 6라운드·0194 5라운드가 남긴 잔여물이 실측된다 — `Extract<Grant` 3파일(`rg -l`), 위생 스캐너 2사본(바이트 동일), `compact` 6/7 승계 |
| 이미 기존 코드가 충족하는가 | **아니오** | `compact`·`ifPresent`·`pickPrincipal` 은 있으나 `TokenValue` 조립·access token 추출이 그것을 안 쓴다(§8) |
| 더 작은 해법이 있는가 / 제거라면 능력 자체가 없어도 되는가 | **제거 아님** — 전부 통합·개명이다. 유일한 제거 후보(`refreshTokenPath`)는 D-002 로 유지 | 사용자가 3지선다에서 "동작 불변 정리만" 선택 |
| 선행 자료의 주장을 코드와 대조했는가 | **1건 정정** | `authenticated-request.ts:265` 주석이 "`probeOk` 와 **같은 구현**" 이라 적었고 그것은 참이다(둘 다 `isAllowedOrigin` 호출). 중복이 아니므로 통합 대상에서 뺐다(§16) |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | **충돌 0** | §16 표에서 0194 D-014 · 0195 D-003/D-006 · 0196 D-009/D-010 을 행별 판정 |

- **사용자에게 올릴 결정**: 없음 — D-001~D-005 가 두 라운드의 질의로 이미 닫혔다.
- **코드 조사로 닫은 사실**: `refreshTokenPath` 체인이 죽어 있다는 것(§8 전수) · `bootPhase:'loading'`
  이 존재하지 않는 phase 라는 것 · 위생 스캐너 두 사본이 커밋 `88f27f0` 에서 함께 고쳐졌다는 것.

## 5. 동작 / 사용자 흐름

앱 사용자 대면 흐름은 **변하지 않는다**(D-001). 관측 주체가 바뀌는 것은 둘이다.

```text
[폐쇄망 배포자가 auth-definitions.ts 에 exchange 를 적는다]
  → 지금:  code: { param, name, params } · valuePath      ← 세 이름의 목적어가 없다
  → 이후:  code: { urlParam, bodyField, extraFields } · accessTokenPath
  → 결과:  선언이 이름만으로 읽힌다. 필드의 유무·의미·기본값은 동일

[운영자가 로그로 로그인 실패를 진단한다]
  → 지금:  auth.probe.result{ok,status,returned}          ← returned 가 무엇인지 가이드를 봐야 안다
  → 이후:  auth.probe.result{ok,status,returnedToOrigin}
  ↘ 대가:  이미 쌓인 JSONL 은 옛 키를 갖는다 — 과거 로그와 새 로그의 철자가 다르다
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 게이트 통과 + 복원 진행 중 | `rootFrame` 이 `waiting-resume` 반환 | 대기 화면 "연결 복원" — **변경 전과 동일** |
| 부팅 미완료 + `resuming:true` | `rootFrame` 이 `waiting` 반환 | 부팅 스피너 "부팅" — **변경 전과 동일** |
| 교환 응답에 refresh token 경로 미선언 | 저장하지 않는다 | **변경 전과 동일**(D-002 로 경로 자체를 유지) |
| SP 가 인가 코드를 다른 이름으로 준다 | `code.urlParam` 이 그 이름을 지정 | 배포 선언의 **철자만** 다름. 동작 동일 |

### 파생 UX / 엣지케이스

- loading / empty / error: 이번 변경이 만드는 새 상태 없음.
- cancel / retry / close / restart: 해당 없음 — 제어 흐름을 바꾸지 않는다.
- concurrency / multi-session: 해당 없음.
- 외부환경/폐쇄망: **배포 선언 철자 변경이 유일한 외부 영향**. in-tree `AUTH_DEFINITIONS` 는
  빈 배열이라(`auth-definitions.ts:마지막 줄`) 저장소 안에 깨질 선언이 없다. 실제 폐쇄망 빌드는
  선언 파일을 함께 고쳐야 한다 — §17 리스크.

## 6. 범위 / 비범위

- **범위**: `app/src/**` 의 재사용 통합 6건(A) · 단순화 9건(B) · 명명 11건(C) · 계약/로그 개명
  3건(D) + 그 개명이 건드리는 현재 사양 문서.
- **비범위**: 정확성 버그 수정(`/code-review` 의 일) · 계약 필드의 추가/삭제/의미 변경 ·
  `docs/handoff/**`·`docs/archive/**` 소급 수정 · 저장소 전역 `numberOr` 마이그레이션(D-003) ·
  `connectionState` 시그니처 객체화.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| `refreshTokenPath` 죽은 경로 제거 | **예 — 공개 계약**. 다만 *유지*가 사용자 결정이라 미룸이 아니라 확정 | D-002 |
| `AuthRefreshResult.'unsupported'` 의 두 의미 분리 | 아니오 — 호출부 분기 변경이라 동작 변경 | 후속 |
| `connectionState` 객체 인자 | 아니오 | 후속 |

## 7. Acceptance Criteria — 제품 계약

| # | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|
| AC1 | `Grant` 에 필수 필드를 더하면 **조립 6곳 전부**에서 컴파일이 깨진다 | 변이: `GrantBase` 에 `x: number` 추가 → `tsc -p tsconfig.node.json` 이 `login.ts` 3좌표 + `store-parse.ts` 3좌표를 **전부** 보고. 변이 되돌림 후 typecheck green | `LoginService.absorb*` 3경로 · `parseGrant` 3갈래 |
| AC2 | 교환이 만드는 `TokenValue` 도 같은 강제를 받고, **결과 객체의 키 집합은 변경 전과 같다** | ⓐ 변이: `TokenValue` 에 필수 필드 추가 → `runner.ts` 조립에서 컴파일 실패. ⓑ `runner.test.ts` 에서 교환 성공 시 `Object.keys(token).sort()` 가 응답이 말한 필드만 담는다 | `SessionRunner.exchange` → `AuthResult{kind:'token'}` → `absorbToken` |
| AC3 | final URL 파라미터 추출이 한 구현에서 나오되, **`parseCallbackUrl` 은 `''` 를 유지하고 `pickUrlParam` 은 `''` 를 버린다** | 기존 `oauth.test.ts:303·308·317·322·323` 5케이스 + `pickUrlParam` 빈문자열 케이스가 **동시에** green. 변이: 공유 lookup 에서 fragment 폴백 제거 → 양쪽 다 실패 | OAuth 콜백 파싱 · browser-session final URL |
| AC4 | 위생 가드 두 개가 한 스캐너를 쓰고, **스캐너의 판정 지점 3곳**(대상 집합 · 주석/문자열 제거 · posix 표기)에 각각 결함을 심으면 검출된다 | `no-cookie-token.test.ts` 의 심은-결함 3케이스가 green. 추가 변이: 스캐너에서 `.test.ts` 제외 제거 → 대상 집합 케이스 실패 | `npm test` 위생 게이트 2건 |
| AC5 | **전선 형상이 변경 전과 동일**하다 — 교환은 `POST`·`content-type: application/json`·body 는 코드+고정필드 JSON, URL 에 코드 없음. whoami 는 `GET`·content-type 없음 | `runner.test.ts:441` 의 `expect(sessions.send).toHaveBeenCalledWith('handle-1', {…})` 가 **수정 없이** 통과. whoami 쪽 `method:'GET'` + content-type 부재 단언 1줄 추가 | 로그인 → 교환 → `sessions.send` |
| AC6 | `rootFrame` 이 **`BootPhase` 만** 받는다 — 존재하지 않는 phase 리터럴은 컴파일되지 않는다 | `typecheck:web` 이 현재 `rootFrame.test.ts:25·44` 의 `'loading'` 에서 **먼저 깨진다**(그것이 타입이 좁아졌다는 증거). `'running'` 으로 고친 뒤 9케이스 전원 green, 반환 프레임은 변경 전과 동일 | `RootGate` → 화면 선택 |
| AC7 | invoke 첫 스냅샷과 push 방송이 **같은 `resuming` 값**을 싣는다 | 기존 `providers.test.ts` "첫 스냅샷에도 복원 진행 여부를 싣는다" green. 변이: `bootstrap.ts` 의 공유 클로저를 한쪽에서 `false` 리터럴로 바꿈 → 그 테스트 실패 | 창 오픈 → `orca:provider:state` invoke |
| AC8 | 개명이 **전수**다 — 코드에 옛 철자 0건, 단 `SessionLookup.valuePath` 는 남는다(D-008) | `rg "reloginOnce\|authenticationReturned\|pickSecretPath\|codeParam\|refreshSecret\|numberOr\|stringOr" src` = **0**. `rg "valuePath" src` = **`SessionLookup` 관련만** (개수를 세어 적는다) | — (정적) |
| AC9 | 계약 필드는 **철자만** 바뀐다 — 필드 개수와 선택성이 변경 전과 같다 | `SessionCodeExchange` 3필드 전부 `?` 유지 · `SessionTokenExchange` 필수 3(`path`·`code`·`present`) + 선택 4 유지. `git diff` 로 `?` 토큰 수 대조 | 배포 선언 typecheck |
| AC10 | 가이드 예제가 **실제 타입에 대입되어 typecheck 된다**(shape) | `closed-network-extensions.md` 의 `ts` 예제 블록을 추출해 `SessionTokenExchange` 에 대입 → `tsc` 통과. 옛 철자(`param`/`name`/`params`/`valuePath`)로 대입하면 **TS2353 으로 거부**된다 | 폐쇄망 배포자가 가이드를 보고 선언을 적는 경로 |
| AC11 | 문서와 코드의 철자가 **양쪽 다** 새것이고, 현재 사양 문서에 옛 철자가 없다 | 새 철자 5개(`urlParam`·`bodyField`·`extraFields`·`accessTokenPath`·`returnedToOrigin`) 각각 `rg` 가 `app/src` ≥1 **그리고** `docs/arch docs/guides` ≥1. 옛 철자 `rg` 가 `docs/arch docs/guides` + `auth-definitions.ts` 에서 0. `docs/handoff`·`docs/archive` 는 제외(D-007) | 배포자·운영자가 읽는 경로 |
| AC12 | 기존 동작 회귀 0 — 베이스라인 대비 **새로 실패하는 테스트가 없다** | `vitest run` 이 `202 passed (207) · 2016 passed` 이상. 실패는 **기존 5파일**(`chat-turn.continuity`·`extensions/builder`·`orchestration/fork`·`db/migrate`·`db/queries`)뿐이고 전부 `Module did not self-register` | 전 스위트 |

### AC 검증 주의사항

- **기존 테스트 재사용 — 케이스 존재 확인 결과**: `oauth.test.ts:303-323` 5케이스 실재(AC3) ·
  `runner.test.ts:441` `toHaveBeenCalledWith` 실재(AC5) · `providers.test.ts` "첫 스냅샷에도 복원
  진행 여부를 싣는다" 실재(AC7) · `no-cookie-token.test.ts` 심은-결함 3케이스 실재(AC4).
- **사람 실기 항목**: 없음. Electron 창을 여는 경로는 이번 변경이 건드리지 않는다 —
  `rootFrame` 은 순수 셀렉터이고 `BootScreen` 변경은 prop 이름뿐이다. **AC6 이 그 판정을 순수
  테스트로 잡는다.**
- **N회/총량 기준**: 이번 AC 에 총량 식 없음. AC1 의 "6곳" 은 sink 호출 횟수가 아니라 **조립
  리터럴 좌표 수**이고, `rg "compact<(Secret|Token|Session)Grant>" src` 로 전수 열거된다
  (실측: `login.ts` 3 · `store-parse.ts` 3).
- **0건 기준의 허용 예외**: AC8 의 `valuePath` 는 **0건이 아니다** — `SessionLookup.valuePath`
  가 남는 것이 D-008 이다. AC11 의 문서 0건은 `docs/handoff`·`docs/archive` 를 제외한 뒤의 값이다
  (D-007). 이 두 예외를 술어에서 빼지 않으면 게이트가 거짓 실패한다.
- **변이 검증의 판정 지점**: AC1·AC2·AC3·AC4·AC7 이 각각 변이를 요구한다. 변이는 **고친 지점
  하나가 아니라 장치의 판정 지점마다** 심는다(AC4 가 3지점).

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| `Extract<Grant, {kind}>` 별칭이 **3파일**에 있다. `authenticated-request.ts` 것이 **0191 이전부터** 있었고 diff 가 둘을 더했다 | `rg -l "Extract<Grant" src` → 3 · `git show 02bed26:app/src/main/features/auth/authenticated-request.ts` |
| `compact` 조립은 **6곳**, 전부 `Grant` 갈래 | `rg "compact<(Secret\|Token\|Session)Grant>" src` → `login.ts` 3 · `store-parse.ts` 3 |
| `TokenValue` 리터럴 조립은 **1곳**이고 `compact` 를 안 쓴다 | `rg ": TokenValue = \{" src --glob '!*.test.ts'` → `runner.ts:213` |
| query+fragment 추출이 **2곳**에 축자 중복 | `rg "url.hash.replace" src` → `specs/browser-session.ts:75` · `oauth.ts:100` |
| 위생 스캐너가 **2사본**이고 같은 버그를 한 커밋이 함께 고쳤다 | `rg -ln "function sourceFiles" src` → 2 · `git show --stat 88f27f0` → 2파일 |
| `getJson` 호출부는 **2곳**뿐 | `rg "this.getJson\(" src` → `runner.ts:96`(`{path}`) · `:189`(`exchangeRequest`) |
| `connectionState` 프로덕션 호출부는 **2곳** | `rg "connectionState\(" src --glob '!*.test.ts'` → `bootstrap.ts:367` · `providers.ts:47` |
| `BootPhase = 'idle'\|'running'\|'ready'\|'failed'` — `'loading'` 은 **없다** | `bootStore.ts:11` · `rootFrame.test.ts:25·44` 가 `'loading'` 단언 |
| `AUTH_DEFINITIONS` 는 **빈 배열** — in-tree 에 `exchange` 선언 0 | `auth-definitions.ts` 마지막 줄 |
| 로그 필드 `returned` 를 운영 가이드가 지목한다 | `closed-network-extensions.md:162·1050` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `refreshSecret` 소비자 | `rg "refreshSecret" src --glob '!*.test.ts'` | 1 | `login.ts:381` 하나. 그 함수는 `grant.authKind !== 'oauth'` 를 먼저 거른다 |
| browser-session token grant 의 refresh 경로 | `LoginService.refresh` 가드 판독 | 0 | `authKind:'browser-session'` 은 `'unsupported'` 로 접힌다 → `refreshTokenPath` 체인은 **읽는 코드가 없다**. D-002 로 **유지** |
| `numberOr`/`stringOr` 와 같은 몸통의 기존 사이트 | `rg "typeof .* === '(string\|number)' \? .* : undefined" src --glob '!*.test.ts'` | 12 | 그중 2건이 `store-parse.ts`(이번 대상), 10건은 범위 밖(D-003) |
| 개명 대상 심볼의 문서 참조 | `rg "refreshSecret\|authenticationReturned\|pickSecretPath\|codeParam\|numberOr\|stringOr" docs .agents` | 0 (handoff 제외 시) | §C 개명은 문서를 건드리지 않는다 — 문서 갱신이 필요한 것은 §D 셋뿐 |
| `valuePath` 문서 사이트 | `rg "valuePath" docs/guides docs/arch` | 6 | `whoami` 것 3 + `exchange` 것 3. **후자만** 바꾼다(D-008) |
| 베이스라인 실패 | `./node_modules/.bin/vitest run` | 5파일 / 42케이스 | 전부 `Module did not self-register` (better-sqlite3 ABI). `app/AGENTS.md` 가 예고한 실측 5파일과 **일치** |

### 수치 / 전칭 표현 검산

- **재측정 수치**: 조립 6 = `login.ts` 3 + `store-parse.ts` 3 (내역 합 = 총계 ✅).
- **베이스라인**: `Test Files 5 failed | 202 passed (207)` · `Tests 42 failed | 2016 passed (2058)`.
  `5 + 202 = 207` ✅ · `42 + 2016 = 2058` ✅.
- **"유일한" 반례 검색**: "`TokenValue` 리터럴 조립은 1곳" → `rg ": TokenValue = \{"` 외에
  `rg "kind: 'token', token"` 도 확인 → `oauth-runner.ts:210` 은 배포가 만든 객체를 **그대로
  넘긴다**(조립 아님). 반례 0.
- **문서 앵커 확인**: `docs/arch/backend/auth.md §4.6`(:315) · `§5.2`(:391) 실재 —
  `grep -n "^### " docs/arch/backend/auth.md`.
- **기존 테스트 케이스 존재 확인**: §7 AC 검증 주의사항에 4건 좌표로 기록.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- **현재 책임 소유자**: `Grant` 타입 별칭 = 3파일이 각자 · URL 파라미터 추출 = 2파일이 각자 ·
  위생 스캐너 = 2 테스트가 각자 · 요청 형상 = `exchangeRequest` 와 `getJson` 이 반씩.
- **현재 flow**: 아래.
- **현재 오류/취소/정리 경로**: 변경 대상 아님.
- **구조적 제약**: `compact` 는 "필드를 빠뜨리면 컴파일이 깨진다" 를 목적으로 도입됐는데,
  그 강제가 **`Grant` 에만** 걸려 있다. `TokenValue` 는 같은 diff 에서 필드가 늘었는데
  (`refreshExpiresAt`) 조립부가 `ifPresent` 누적이라 **그 필드를 안 적고 지나갔다**.

```text
[final URL] → pickUrlParam ─┐                    (oauth.ts 가 같은 3줄을 따로 갖는다)
                            ├→ codeParam ─→ exchangeRequest ─→ getJson(req:4필드) → sessions.send
[exchange 선언]────────────┘                     (method/contentType 이 body 에 종속인데 독립 필드)
                                    ↓
                        payload → pickPath/pickSecretPath → { …ifPresent } : TokenValue
                                                             └ refreshExpiresAt 을 안 적는다
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- **변경 후 책임 소유자**: `Grant` 별칭 = `contracts/auth.ts` 하나 · URL 파라미터 lookup =
  `features/auth` 의 공유 조각 하나 · 위생 스캐너 = `infra/source-scan.ts` 하나 ·
  요청 형상 = `getJson` 하나(빌더는 **필드 맵만** 만든다).
- **변경 후 오류/취소/정리 경로**: 동일 — 이번 변경은 제어 흐름을 만들지 않는다.
- **유지하는 기존 메커니즘**: `compact` · `ifPresent` · `pickPath`/`pickPrincipal` ·
  `isAllowedOrigin` · attempt 세대 · `sessions.send` 단일 전송(0195 D-007).
- **제거/대체하는 메커니즘**: `codeParam()` 헬퍼 · `exchangeRequest` 의 4필드 반환 타입 ·
  `getJson` 의 `method`/`contentType` 독립 필드 · 위생 스캐너 2사본.

```text
[final URL] → urlParams(공유 lookup) ─┐
                                      ├→ exchangeFields(맵) ─→ getJson(path, jsonBody?) → sessions.send
[exchange 선언: urlParam/bodyField/extraFields]                 └ method·content-type 을 body 유무로 파생
                                    ↓
                        payload → pickPath/pickSecret → compact<TokenValue>({ 전 필드 })
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | 구현/검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | `Grant` 별칭 3파일 | `contracts/auth.ts` 1곳 | 별칭이 `compact` 의 타입 인자다 — 사본이 갈리면 강제가 갈린다 | `contracts/auth.ts` · **AC1** |
| data/control flow | 요청 형상이 빌더/`getJson` 에 반씩 | `getJson` 이 형상, 빌더는 필드 맵 | 세 선택 필드가 `body` 유무에 완전 종속 | `runner.ts` · **AC5** |
| state/contract | `TokenValue` 조립만 `ifPresent` | `compact<TokenValue>` | 같은 diff 가 `refreshExpiresAt` 를 더했고 이 리터럴이 놓쳤다 | `runner.ts` · **AC2** |
| state/contract | `code.param`/`name`/`params` · `valuePath` | `urlParam`/`bodyField`/`extraFields` · `accessTokenPath` | 단·복수가 다른 것을 지칭 · 형제 셋만 대상을 담음 | `contracts/auth.ts` + 문서 · **AC9·AC10·AC11** |
| error/lifecycle | 변경 없음 | 변경 없음 | — | **AC12** |
| test seam/관측점 | 위생 스캐너 2사본 | `infra/source-scan.ts` 1 + 심은-결함 3케이스 | `88f27f0` 이 같은 버그를 두 사본에서 고쳤다 | `source-scan.ts` · **AC4** |
| 타입 강도 | `rootFrame(bootPhase: string)` | `bootPhase: BootPhase` | 존재하지 않는 phase 를 테스트가 단언 중 | `rootFrame.ts` · **AC6** |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `contracts/auth.ts` | `Grant` 갈래 별칭 SSOT | — / 타입 | `login.ts` · `store-parse.ts` · `authenticated-request.ts` |
| `shared/obj.ts` | `compact` · `asNumber`/`asString` | unknown / 좁힌 값 | `store-parse.ts` · `login.ts` · `runner.ts` |
| `features/auth/`(공유 lookup) | URL 쿼리+프래그먼트 조회 | rawUrl / `(name)=>string\|null` \| null | `oauth.ts` · `specs/browser-session.ts` |
| `specs/browser-session.ts` | 응답 JSON 해석 헬퍼 | payload+path / 좁힌 값 | `browser-session/runner.ts` |
| `infra/source-scan.ts` | 소스 스윕 + 주석/문자열 제거 + posix 표기 | dir / 파일 목록·정제 소스 | 위생 가드 2 테스트 |

## 10. 계약 / 타입 / 강제 지점

| 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|
| `Grant` 필드 전수 조립 | `CompactSource<T>`(`shared/obj.ts`) | `tsc` | **조립 6지점** — `login.ts` secret·session·token, `store-parse.ts` secret·token·session | 새 필드가 조용히 사라진다(0194 D1·D7 재현) |
| `TokenValue` 필드 전수 조립 | 동상 | `tsc` | **1지점** — `runner.ts` 교환 조립 | 교환 경로에서만 새 필드가 빠진다 |
| `SessionTokenExchange` 필수 3(`path`·`code`·`present`) | `contracts/auth.ts` | `tsc` | 배포 선언 작성 시점 | 개명이 선택성을 바꾸면 기존 선언이 깨진다 — **AC9 가 이것을 잠근다** |
| URL 파라미터 추출 규칙(쿼리 우선·프래그먼트 폴백·잘못된 URL→없음) | 공유 lookup 1곳 | 테스트 | `oauth.test.ts` + browser-session 테스트 | 두 흐름의 규칙이 갈린다 |
| 빈 문자열 정책 | **갈래마다 다르다** — `parseCallbackUrl` 유지 / `pickUrlParam` 배제 | 테스트 | 위 두 스위트 | 공유 조각을 잘못 잡으면 한쪽이 깨진다 — **AC3** |
| 위생 스캐너 판정 3지점(대상 집합·주석/문자열·posix) | `infra/source-scan.ts` | 심은-결함 테스트 | `npm test` | 눈 없는 가드의 `0건`은 전수의 증거가 아니다 |
| 로그 필드 철자 | 코드 + `closed-network-extensions.md` **두 곳** | 사람/grep | 개명 시 | 사본이 갈리면 운영 문서가 즉시 거짓 — **AC11 이 양방향 grep** |
| `resuming` 값의 일치 | `bootstrap.ts` 의 단일 클로저 | 테스트 | invoke·push 두 경로 | 한쪽만 `false` 면 복원 중 메인 셸이 뜬다 — **AC7** |

- **같은 규칙이 여러 레이어에 있을 때 SSOT**: URL 추출 = 공유 lookup, 소스 스윕 = `source-scan.ts`.
  복붙 정규식 금지.
- **선택적 필드의 `undefined` 의미**: `code.urlParam` 미지정 = `'code'` · `code.bodyField` 미지정
  = 유효 `urlParam` · `accessTokenPath` 는 **필수 아님이 아니라 필수** — 전부 변경 전과 동일(D-005).
- **다중 사본 쓰기**: 로그 필드 철자와 계약 필드 철자가 **코드 + 문서** 두 곳에 산다.
  §13 에서 다룬다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `contracts/auth.ts` | 타입 계약 | `Secret/Token/Session/ValueGrant` export(A-1) · `code.urlParam`/`bodyField`/`extraFields`(D-1) · `accessTokenPath`(D-2) | typecheck · 변이(AC1·AC9) |
| `features/auth/login.ts` | 로그인 lifecycle | 별칭 import · `previousPrincipalId`(B-6) · `writeVault` 주석 제거(B-7) · `tokenToCommit`(C-8) · `refreshTokenSecret` 호출(C-11) · 로그 `returnedToOrigin`(D-3) | `login.test.ts` |
| `features/auth/store.ts` | grant 저장 | `refreshSecret` → `refreshTokenSecret`(C-11) | `store.test.ts` |
| `features/auth/store-parse.ts` | grant 파서 | 별칭 import · `asNumber`/`asString` 사용(A-6·C-9) | `store-parse.test.ts` |
| `features/auth/authenticated-request.ts` | 인증 요청 | 별칭 import · `readsAsAuthenticated`(C-4) · 로그 `returnedToOrigin`(D-3) | `authenticated-request.test.ts` |
| `features/auth/browser-session/runner.ts` | 교환 흐름 | `compact<TokenValue>`(A-2) · `pickSecret` 사용(A-4) · `getJson(path, jsonBody?)`(B-1) · URL `.toString()`(B-2) · `codeParam` 제거(B-3) · `accessToken`(C-5) · `urlParam`/`bodyField`(C-7·D-1) | `runner.test.ts` |
| `features/auth/specs/browser-session.ts` | 응답 해석 헬퍼 | 공유 lookup 사용(A-3) · `pickSecret` 수용(A-4·C-6) | 단위 |
| `features/auth/oauth.ts` | OAuth 콜백 | 공유 lookup 사용(A-3) | `oauth.test.ts` |
| `features/auth/url-params.ts` **(신규)** | 쿼리+프래그먼트 lookup | `urlParams(rawUrl)` | 단위 |
| `infra/source-scan.ts` **(신규)** | 소스 스윕 | `sourceFiles`·`stripCommentsAndStrings`·`toPosix` | 위생 2가드의 심은-결함 |
| `app/bootstrap.ts` | 컴포지션 | `resuming` 클로저 1개(B-5) | `providers.test.ts`(AC7) |
| `app/auth-resume.ts` | 부팅 복원 | `relogin`(C-1) · `isDemoted`(C-2) · `firstMethod`(C-10) | `auth-resume.test.ts` |
| `shared/obj.ts` | 순수 유틸 | `asNumber`/`asString` 추가(A-6·C-9) · `OptionalKeysOf` 여집합(B-9) | `obj.test.ts` |
| `renderer/app/rootFrame.ts` | 화면 선택 | `bootPhase: BootPhase`(B-4) | `rootFrame.test.ts`(AC6) |
| `renderer/app/boot/BootScreen.tsx` | 대기 화면 | `variant` prop · `= {}` 제거(B-8·C-3) | 시각 |
| `renderer/app/RootGate.tsx` | 최상위 게이트 | `variant="resuming"`(C-3) | 시각 |
| `docs/guides/closed-network-extensions.md` · `docs/arch/backend/auth.md` | 배포·아키텍처 정본 | §D 철자 동반 갱신 | AC10·AC11 |
| `app/deployment/auth-definitions.ts` | 배포 선언 | `⚠️ config.exchange` 경고 블록 철자 | AC11 |

### 테스트 가능성

- **electron/DB/native 분리**: `url-params.ts`·`source-scan.ts`·`rootFrame.ts` 는 전부 순수이며
  electron 을 물지 않는다. `rootFrame.ts` 의 `BootPhase` 는 **`import type`** 이라 완전 소거된다 —
  zustand 가 vitest 에 로드되지 않는다(B-4 의 전제).
- **`source-scan.ts` 의 레이어**: `infra` 에 두면 `features/auth → infra` · `infra/net → infra`
  둘 다 boundaries 허용 간선이다. 새 모듈은 `no-node-fetch` 스캔 대상에 들어오지만 전역 `fetch(`
  를 쓰지 않는다.
- **기존 메커니즘 재사용 적합성**: `compact<TokenValue>` — `TokenValue` 는 `token` 1필수 + 4선택
  이라 `CompactSource` 의 두 갈래가 그대로 성립한다(필수 키는 `T[K]`, 선택 키는 `T[K]|null`).
- **순서 관측**: 이번 변경에 순서 계약 없음.

## 12. End-to-end 영향

### producer → consumer

```text
SP final URL → urlParams → exchangeFields → getJson → sessions.send
             → 응답 JSON → pickPath/pickSecret → compact<TokenValue> → AuthResult
             → LoginService.absorbToken → tokenCandidate → compact<TokenGrant> → AuthStore
             → connectionState(resuming) → ProviderPlatformState → renderer rootFrame
```

- **producer 기준**: 교환 응답 JSON 이 말한 필드만 `TokenValue` 에 실린다(변경 전과 동일).
- **consumer 파생 규칙**: renderer 는 `resuming` 을 파생하지 않고 wire 값을 그대로 쓴다.
- **파생 가능한 합성값이 정본을 우회하는가**: 아니오 — `rootFrame` 이 유일한 판정자이고
  `BootScreen` 은 variant 를 받기만 한다(0194 D5 가 세운 구조를 유지).

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `bootstrap.ts` push 경로 | `resuming` 클로저 공유로 바뀜 — 값 동일 | AC7 |
| `providers.ts` invoke 경로 | 동상 | AC7 |
| `deployment-wiring.test.ts` · `connection-views.test.ts` | `connectionState` 시그니처 **불변**(E-7) — 수정 불필요 | AC12 |
| 위생 가드 2 테스트 | 스캐너를 import 로 바꿈 — 판정 결과 동일 | AC4 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작·취소/중단·종료·retry/timeout·cleanup: **변경 없음**. 이번 변경은 제어 흐름을
  만들지도 없애지도 않는다.
- **다중 사본 쓰기**: 원자적 저장소 쓰기는 없다. 다만 **철자가 코드와 문서 두 곳에 산다** —
  §D 개명이 한쪽만 되면 두 사본이 서로 다른 말을 한다.
  - 쓰기 지점: ⓐ `app/src/**` 코드 ⓑ `docs/arch/backend/auth.md` ⓒ
    `docs/guides/closed-network-extensions.md` ⓓ `auth-definitions.ts` 경고 블록.
  - 각 지점 누락 시 관측: ⓐ만 하면 가이드가 없는 필드를 안내(배포자가 typecheck 실패) ·
    ⓑⓒⓓ만 하면 코드가 옛 철자(문서가 컴파일 안 되는 예제를 안내).
  - **허용 불가 조합을 없애는 설계**: AC11 이 **양방향 grep** 이다 — 새 철자가 코드·문서 양쪽에
    ≥1, 옛 철자가 현재 사양 문서에서 0. 한쪽만 고치면 둘 중 하나가 반증된다.
- **되돌릴 수 없는 흔적**: 로그 필드 개명(D-3)은 이미 쌓인 JSONL 의 옛 키를 바꾸지 못한다.
  운영자는 과거 로그에서 `returned`, 새 로그에서 `returnedToOrigin` 을 본다 — §17.

## 14. 성능 / 상한 / 최적화

- **새 출력/요청의 `원천 상한 × 배치 상한`**: 없음 — 요청 수·출력 길이를 바꾸지 않는다.
  B-1 은 전선 바이트가 동일함을 AC5 가 잠근다.
- **구조적 목표**: 줄 수 목표 없음. 통합 대상은 좌표로 열거된다(§8).
- **캐시/호출 축소로 잃는 부수 효과**: 없음. B-2(`new URL` → `.toString()`)는 객체 하나를 덜
  들고 있을 뿐이고, B-5 는 같은 함수를 같은 횟수로 부른다.

## 15. 외부 구현 포트 / 문서 계약

**해당함** — `SessionTokenExchange`·`SessionCodeExchange` 는 폐쇄망 배포가 채우는 계약이다.

- **구현 문서**: `docs/guides/closed-network-extensions.md` §2-b(예제·필드 표·트러블슈팅) ·
  `docs/arch/backend/auth.md §4.6`.
- **shape 검증**: 가이드의 `ts` 예제 블록을 추출해 `SessionTokenExchange` 에 대입 → typecheck
  통과. 옛 철자로 대입하면 `TS2353`(알 수 없는 속성)으로 거부 — **AC10**.
- **semantics 검증**: 성공/실패/미지정 의미가 변경 전과 같은지 대조 — `urlParam` 미지정 =
  `'code'` · `bodyField` 미지정 = 유효 `urlParam` · `extraFields` 와 코드 이름 충돌 시 **코드가
  이긴다**. 셋 다 기존 `runner.test.ts` 케이스가 잠근다(**AC5** 와 같은 스위트).
- **시그니처가 안 바뀌어도 의미가 바뀌는가**: 아니오 — 이번은 그 반대다(철자만 바뀌고 의미 불변).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0195 D-003 — refresh token 은 **저장만** 한다 | `auth.md §4.6` | §6 비범위 · D-002 | **유지** — 경로를 지우지 않는다 |
| 0195 D-006 — 토큰 출처는 교환 응답 JSON 하나 | `specs/browser-session.ts` 헤더 | §11 `source-scan.ts`(위생 가드 통합) | **유지** — 가드의 판정은 그대로, 스캐너만 공유 |
| 0195 D-001 — `present` 필수 | `contracts/auth.ts` | §10 필수 3필드 | **유지** — AC9 가 선택성 불변을 잠근다 |
| 0195 D-004 — 세션 grant 는 origin 미복귀로도 강등 | `authenticated-request.ts:259` | C-4 개명 · D-3 로그 개명 | **유지** — 술어 이름만 바뀐다 |
| 0196 D-009 — 요청은 POST+JSON 하나로 고정 | `contracts/auth.ts` | B-1 `getJson` 통합 | **유지** — 갈래를 하나로 유지하고, 오히려 `method:'PUT'` 조합을 타입에서 없앤다 |
| 0196 D-010 — form 본문이 필요하면 `in?:'json'\|'form'` 을 선택 필드로 넓힌다 | `contracts/auth.ts` 주석 | B-1 | **유지** — 그 확장 지점 주석을 새 철자로 옮겨 적는다 |
| 0194 D-014 — 미회전 응답의 refresh 승계 | `login.ts:404` | C-8 개명 · E-4 | **유지** — 2분기 구조를 건드리지 않는다 |
| 0194 D3 — 방송 상한 수치는 `auth.md §5.2` 가 정본 | `auth-resume.ts` 헤더 | B-5 · C-1 | **유지** — 수치를 코드로 되돌리지 않는다 |
| 0194 D5 — 라벨 선택은 셀렉터가, 그리기는 컴포넌트가 | `rootFrame.ts` 헤더 | B-8 · C-3 | **유지** — `variant` 개명이 오히려 그 분리를 이름으로 표현한다 |
| 루트 `AGENTS.md` §1 — 과거 문서를 현재 사양처럼 쓰지 마라 | 루트 | D-007 | **유지** — handoff/archive 소급 수정 금지의 근거 |
| `app/AGENTS.md` — main 은 전역 `fetch` 금지 | `app/AGENTS.md` | `infra/source-scan.ts` 신설 | **유지** — 새 모듈은 `fetch(` 를 쓰지 않고 스캔 대상에 들어와도 통과 |
| `src/renderer/AGENTS.md` — 파생 셀렉터는 단위 테스트와 함께 | renderer 가이드 | B-4 | **유지** — 타입을 좁혀 셀렉터를 더 강하게 만든다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| **폐쇄망 실제 빌드의 선언 파일이 옛 철자를 쓴다** — in-tree 는 빈 배열이라 CI 가 못 잡는다 | 필드 개명이므로 배포 빌드가 typecheck 에서 `TS2353` 으로 **즉시** 깨진다(조용히 무시되지 않는다). 가이드·경고 블록을 같은 커밋에 갱신해 고칠 곳을 지목한다 |
| **로그 철자 변경이 과거 JSONL 과 갈린다** | 되돌릴 수 없다. 유일한 비가역 항목이라 §13 에 명시하고 가이드 트러블슈팅에 새 철자를 적는다 |
| 공유 lookup 이 두 흐름의 빈 문자열 정책을 뭉갠다 | **AC3 이 양쪽 스위트를 동시에 요구**한다. 공유 조각은 `string \| null` lookup 이고 정책은 각자 위에 얹는다 |
| 위생 가드 통합이 가드의 눈을 멀게 한다 | **AC4 가 판정 3지점에 결함을 심는다** — 통합 후에도 전건 검출해야 한다 |
| 개명이 일괄 치환으로 무관한 낱말을 건드린다 | `variant`·`asNumber` 같은 흔한 낱말은 **선언 지점부터 참조를 따라** 바꾼다. AC8·AC11 이 양방향 grep 으로 잔여를 잡는다 |

- **되돌리기 어려운 결정**: 계약 필드 철자(배포 선언이 따라와야 한다) · 로그 필드 철자(과거 로그).
- **신규 의존성**: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/main/contracts/auth.ts` · `features/auth/{login,store,store-parse,authenticated-request,oauth}.ts`
- `app/src/main/features/auth/{browser-session/runner,specs/browser-session}.ts` · `features/auth/url-params.ts`(신규)
- `app/src/main/infra/source-scan.ts`(신규) · `app/src/main/app/{bootstrap,auth-resume}.ts`
- `app/src/main/app/deployment/auth-definitions.ts` · `app/src/shared/obj.ts`
- `app/src/renderer/src/app/{rootFrame.ts,RootGate.tsx,boot/BootScreen.tsx}`
- 테스트: `rootFrame` · `obj` · `store-parse` · `login` · `store` · `auth-resume` ·
  `browser-session/runner` · `authenticated-request` · `oauth` · `no-cookie-token` · `no-node-fetch`
- 문서: `docs/guides/closed-network-extensions.md` · `docs/arch/backend/auth.md` ·
  `docs/handoff/INDEX.md`

## 19. 게이트

- **적용할 하위 가이드**: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` ·
  `app/src/main/AGENTS.md`(레이어 DAG) · `app/src/renderer/AGENTS.md §테스트`.
- **환경 제약**: `npm ci` 완료(exit 0). **better-sqlite3 는 Node ABI 로 빌드되지 않아** DB 로드
  스위트 5파일이 `Module did not self-register` 로 실패한다 — `app/AGENTS.md` 가 예고한 실측
  5파일과 일치하는 **알려진 베이스라인**이다.
- **기본 정적 게이트**: `cd app && npm run lint && npm run typecheck` (ABI 중립).
  `lint` 는 `--fix` 라 트리를 쓴다 — 실행 후 `git diff` 로 자기 실행분을 확인한다.
- **관련 테스트**: `./node_modules/.bin/vitest run` (pretest 우회, ABI 불변).
  **베이스라인**: `Test Files 5 failed | 202 passed (207)` · `Tests 42 failed | 2016 passed (2058)`.
- **문서 게이트**: `docs/handoff/0192-*/doc-gate.sh check`(문서 인용 심볼·경로 실재) +
  `node scripts/check-doc-inventory.mjs --check`(수치 재서술·상대 링크).
  **사각지대**: `doc-gate.sh` 는 심볼의 *실재*만 본다 — 문서가 `valuePath` 라 적어도
  `SessionLookup.valuePath` 가 남아 통과한다. 그 축의 실제 판정은 **AC11 의 grep** 이다.
- **사람 실기**: 없음(§7 AC 검증 주의사항).

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — D-001~D-008, 4개 사용자 턴에서 수집.
- [x] Part I만 읽어도 사용자/제품 완료 상태가 이해된다 — §1 "앱 사용자 관측 불변, 배포자·운영자가 보는 이름만 변경".
- [x] 조건절·이유절·제거/유지 요구를 임의 재해석하지 않았다 — "동작 불변 정리만"을 D-001 로, "문서도 업데이트하면 된다"를 D-005 로 원문 인용.
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다 — §5 두 흐름 ↔ AC9·AC10·AC11 ↔ §11 문서 행.
- [x] Technical Design에 AS-IS와 TO-BE가 모두 있고 같은 비교 축으로 작성되어 있다 — §9 두 ASCII 블록이 같은 경로를 추적.
- [x] AS-IS → TO-BE Delta의 각 변경이 구현 파일/모듈 또는 AC에 추적 가능하다 — Delta 7행 전부 `구현/검증 연결` 칸 있음.
- [x] AS-IS에서 사라진 책임은 삭제/이동/대체 중 무엇인지 명시했다 — §9 TO-BE "제거/대체하는 메커니즘" 4건.
- [x] 수치·전칭 표현·외부 규약·문서 앵커·기존 테스트 인용을 실측했다 — §8 전수 조사 6행 + 검산 4항.
- [x] 각 AC가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다 — AC1~AC12 3칸 모두 채움.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 사람 실기 항목 0.
- [x] semantic 목표가 structural proxy만으로 검증되지 않는다 — AC1·AC2·AC3·AC4·AC7 이 **변이**를 요구한다.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam이 있다 — §10 8행.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 표 4행 + `connectionState` 호출부 2건 실측.
- [x] producer/consumer 양쪽 의미를 확인했다 — §12 `resuming` 은 파생 아님(wire 정본).
- [x] 상한·총량·one-way door를 필요한 곳에서 계산했다 — 상한 변화 없음(§14), one-way door 2건(§17).
- [x] 게이트 명령이 대상 subtree의 현재 `AGENTS.md`와 충돌하지 않는다 — §19 가 lint+typecheck 를 기본으로, `npm test` 를 쓰지 않는다.
- [x] 본문 완성 후 Decision Ledger와 기존 결정을 전체 교차검증했고, `ACTIVE 결정 ↔ AC` 대조 결과를 §3 갱신 메모에 적었다 — 충돌 0, 4쌍 판정.
- [x] 산출물 문장 규칙을 지켰다 — 판정 먼저, 관측 1개/줄, 표 칸 3줄 이내.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- **동의 / 그대로 진행**: A(재사용 6) · B(단순화 9) · C(명명 11) · D(계약·로그 3) 전부 설계대로.
- **이견 / 현실성 문제**: **AC7 의 검증 수단이 실행 불가능하다.** §7 AC7 은 "변이: `bootstrap.ts` 의
  공유 클로저를 한쪽에서 `false` 리터럴로 바꿈 → 그 테스트 실패" 를 요구하는데, `bootstrap.ts` 는
  electron 을 물어 vitest 대상이 아니다 — `deployment-wiring.test.ts:15` 가 그 사실을 명시한다
  ("`bootstrap.ts` 자체는 electron 을 물어 vitest 대상이 아니다"). §6 가운데 갈래로 올린다.
- **ACTIVE Decision과 충돌하는 설계 발견**: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|
| `Grant` 필드 전수 조립 | 조립 6 (`login.ts` 3 · `store-parse.ts` 3) | **6/6** | `GrantBase` 에 `mutantProbe: number` 심고 `tsc -p tsconfig.node.json` → 좌표 6건 전부 보고: `login.ts(618,798,859)` · `store-parse.ts(50,61,75)`. 되돌린 뒤 `error TS` **0** | — |
| `TokenValue` 필드 전수 조립 | 1 (`runner.ts` 교환) | **1/1** | `TokenValue` 에 **선택** 필드 `mutantProbe?: number` 심음 → `runner.ts(225,39) TS2345`. **선택 필드가 판정 지점이다** — 필수 필드는 개명 전 `ifPresent` 판에서도 깨져 변이가 변별력이 없다(`git show 9f13533:…/runner.ts` 의 `: TokenValue = { …ifPresent }` 로 확인) | — |
| `SessionTokenExchange` 필수 3 | 배포 선언 작성 시점 | **3/3** | `path`·`code`·`present` 필수 유지 · 선택 4 유지. 옛 철자 대입은 `TS2353` 으로 거부됨(테스트 12건이 실제로 그렇게 깨져 고쳤다) | — |
| URL 파라미터 추출 규칙 | 공유 lookup 1 (소비자 2) | **2/2** | fragment 폴백 제거 변이 → `oauth.test.ts` "query 와 fragment 를 모두 본다" + `runner.test.ts` "final URL 의 파라미터는 쿼리와 프래그먼트를 모두 본다" **양쪽** 실패(2 failed / 50 passed). 되돌리면 52 passed | — |
| 빈 문자열 정책(갈래별) | 2 (`parseCallbackUrl` 유지 · `pickUrlParam` 배제) | **2/2** | 위 되돌림 후 두 스위트 52/52 green — 공유 조각이 `string \| null` lookup 이라 정책이 각자 유지됨 | — |
| 위생 스캐너 판정 지점 | 3 (대상 집합 · 주석/문자열 · posix) | **2/3** | ① `.test.ts` 제외 삭제 → 3 failed ② 재귀 삭제 → 1 failed ③ `stripCommentsAndStrings` 항등화 → 2 failed. 각 변이 후 되돌려 7/7 green | **posix 축**: linux 는 `sep === '/'` 라 변이해도 산출이 같다 — **이 환경에서 심을 수 없다**(windows CI 전용 축) |
| 로그 필드 철자(코드+문서 2사본) | 2 | **2/2** | 새 철자 5개 각각 `app/src` ≥1 **그리고** `docs/arch docs/guides` ≥1 (표는 아래 구현 보고) | — |
| `resuming` 값의 일치 | 2 (invoke · push) | **1/2** | invoke 축: `providers.test.ts` "첫 스냅샷에도 복원 진행 여부를 싣는다" 3/3 green. 구조: `bootstrap.ts` 에서 `const resuming` 정의 1(`:368`)·사용 2(`:370`·`:391`) | **bootstrap 축 변이 불가** — electron 의존, vitest 대상 아님(위 설계 리뷰) |

- **§10에 없는데 같은 불변식이 필요했던 지점**: 없음.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | **해당 없음** — 새 문구 0. `BootScreen` 은 prop 이름만 바뀌고 i18n 키(`boot.resumingLabel` 등)는 그대로다 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | **새 실패 경로 0.** 제어 흐름을 만들지도 없애지도 않았다 | — |
| 실패가 화면에서 "아무 일도 안 일어남" 으로 보이지 않는가 | 해당 없음(동작 불변) | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 — attempt 세대·`isDemoted` 재읽기 구조를 건드리지 않았다 | — |
| **배포자가 보는 것이 달라지는가** | **예** — 계약 필드 철자 3+1. 옛 선언은 `TS2353` 으로 **빌드에서 즉시** 깨진다(조용히 무시되지 않는다) | 가이드·`auth.md` 동반 갱신 완료 |
| **운영자가 보는 것이 달라지는가** | **예** — 로그 키 `returned` → `returnedToOrigin`. 이미 쌓인 JSONL 은 옛 키를 갖는다 | 비가역. §17 에 기록됨 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | **AC7 의 변이 수단이 존재하지 않는다** — `bootstrap.ts` 는 vitest 대상이 아니다 | 📝 **plan 수정 제안**: AC7 의 검증 수단을 ⓐ `providers.test.ts`(invoke 축, 실재·green) + ⓑ `bootstrap.ts` 의 `resuming` 정의 1·사용 2 구조 관측으로 바꾸고, "bootstrap 축은 사람/CI 실기" 로 명시한다 | `deployment-wiring.test.ts:15` · `grep -n resuming src/main/app/bootstrap.ts` |
| 2 | **AC2 의 변이가 변별력이 없었다** — 필수 필드는 개명 전 `ifPresent` 판에서도 컴파일이 깨진다 | ✅ 선조치: 변이를 **선택 필드**로 바꿔 재실행. 0197 A-2 가 막는 것은 *선택* 필드의 조용한 누락이므로 그것이 옳은 판정 지점이다 | `git show 9f13533:…/runner.ts` 의 옛 조립 |
| 3 | 위생 스캐너의 **posix 축은 linux 에서 심을 수 없다**(`sep === '/'`) | ⚠️ 보고만 — 그 축의 실제 판정자는 windows CI 다 | `node:path` `sep` |
| 4 | **`doc-gate.sh check` 가 시제 축에서 실패한다** — `envKey` 사이트가 baseline `:390` 인데 실제 `:438` | ⚠️ 보고만 — **선재 실패**다. 내 변경을 `git stash` 한 트리에서 **바이트 동일한 출력**을 확인했다. `docs/handoff/0192-*/baselines/` 는 다른 handoff 의 산출물이고 D-007 범위 밖이라 고치지 않았다 | 아래 구현 보고 |
| 5 | 일괄 정규식 치환이 무관한 `name:`·`valuePath:` 를 건드렸다(`Presentation.name`·`SessionLookup.valuePath`) | ✅ 선조치: 세 테스트 파일을 `git checkout` 으로 되돌리고 **좌표 지정**으로 재적용. plan §손댈 파일의 "무분별한 치환 금지" 가 예고한 자리다 | typecheck 16 error → 0 |

### 설계 대비 명시적 차이

- **`auth-definitions.ts` 경고 블록을 고치지 않았다.** plan §11·§18 이 대상으로 적었으나, 실제로
  그 블록은 `config.exchange.path`·`code`·`present` 만 언급하고 개명 대상 철자를 담고 있지
  않다(`grep -n "config.exchange" -A 4`). 고칠 것이 없어 건드리지 않았다.
- 그 밖에는 plan 그대로다.

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 22 modified + 2 new (`features/auth/url-params.ts` · `infra/source-scan.ts`). `+266/−263` |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node scripts/check-doc-inventory.mjs --check` · `doc-gate.sh check` |
| **관측한 게이트 산출** | **lint** 0 error · 1 warning(`useTranscriptVirtualizer.ts` — 미변경 파일, 선재). **typecheck** 3분할 전부 `error TS` **0**. **vitest** `Test Files 5 failed \| 202 passed (207)` · `Tests 42 failed \| 2017 passed (2059)`. **doc-inventory** 3축 ok(exit 0). **doc-gate** 심볼 미분류 0·잔류 0 / 경로 미등재 0·잔류 0 / **시제 미판정 1·잔류 1 → exit 1 (선재)** |
| 환경 기인 실패 분리 | 5파일 42케이스 전부 `Module did not self-register: better_sqlite3.node` — `app/AGENTS.md` 가 예고한 실측 5파일(`chat-turn.continuity`·`extensions/builder`·`orchestration/fork`·`db/migrate`·`db/queries`)과 **일치**. 변경 전 베이스라인과 동일 |
| 회귀 판정 | 베이스라인 `202 passed (207)` · `2016 passed (2058)` → 현재 `202 passed (207)` · `2017 passed (2059)`. **+1 은 이번에 추가한 AC2 키집합 테스트**, 실패 집합 불변 |
| 강제 지점 전수 | **6/8 완전 · 2/8 부분** — posix 축(linux 에서 변이 불가) · bootstrap 축(vitest 대상 아님) |
| **AC 자기보고** | AC1 ✅(변이 6/6 좌표) · AC2 ✅(선택 필드 변이 → `runner.ts(225,39)`) · AC3 ✅(양쪽 스위트 동시 실패→52/52 복원) · AC4 ⚠️(판정 3지점 중 2개 검증, posix 는 linux 에서 심을 수 없음) · AC5 ✅(`runner.test.ts` 의 `toHaveBeenCalledWith` 가 **수정 없이** 통과 — whoami `method:'GET'`+content-type 부재 단언 이미 실재) · AC6 ✅(`'loading'` 2건이 `TS2322` 로 먼저 깨짐 → `'running'` 으로 고친 뒤 9케이스 green) · AC7 ⚠️(invoke 축 green, bootstrap 축 변이 불가) · AC8 ✅(옛 철자 7종 전부 0건, `valuePath` 는 `SessionLookup` 만 잔존) · AC9 ✅(필수 3·선택 4 유지) · AC10 ✅(옛 철자 대입이 실제로 `TS2353` 12건) · AC11 ✅(새 철자 5개 양쪽 ≥1 — `urlParam` 23/8 · `bodyField` 7/3 · `extraFields` 10/4 · `accessTokenPath` 6/3 · `returnedToOrigin` 6/2) · AC12 ✅ |
| **합계 검산** | **✅ 10 · ⚠️ 2 · ❌ 0 = 총 12** — 분모 12 는 §7 표를 다시 세었다(AC1~AC12, 분할·추가 없음) |
| 블로커 / 역질문 | 없음. AC4·AC7 의 ⚠️ 는 **환경 한계**(linux `sep` · electron 의존)이지 미구현이 아니다 |
| 대상 커밋 | `51a79ec` |

## [구현자 기입] Review Signals — 사실만

- **이번에 닫은 불변식이 이전 라운드와 같은 축인가**: 예 — `compact` 전수 조립은 0194 r3→r4 가
  두 라운드에 걸쳐 연 축이고, 이번에 `TokenValue`(7번째 조립부)가 같은 축에서 나왔다.
- **그것을 막았어야 할 plan 지침·AC가 있었는가**: 0194 의 강제 지점 표가 `Grant` 조립만 세었다.
  술어가 `compact<`(해법 이름)였고 `TokenValue` 는 그 집합 밖이라 분모에 오르지 않았다 —
  `handoff-impl §2` 가 경고하는 바로 그 형태다.
- **반복해서 부딪히는 환경 한계**: ① better-sqlite3 ABI(5파일 고정) ② `bootstrap.ts` 가 vitest
  대상이 아니라 컴포지션 배선의 변이 검증이 매번 구조 관측으로 대체된다 ③ posix 축은 linux 에서
  심을 수 없다.
- **현재 라운드 수**: 1

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | … | … | … | open |
