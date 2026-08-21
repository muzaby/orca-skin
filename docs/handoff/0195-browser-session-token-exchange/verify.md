# Verify — 0195-browser-session-token-exchange

## 메타

| 항목 | 값 |
|---|---|
| slug | `0195-browser-session-token-exchange` |
| 검증자 | Claude Code |
| 일자 | 2026-08-21 |
| 대상 커밋/range | `e3dc021..995f1cd` (+ 좌표 커밋 `0cfba20`) |
| 구현 전 plan 기준 | `e3dc021` |
| 라운드 | 1 |
| 상태 | **PASS** |
| 자기 검증 여부 | **동일 에이전트** (설계·구현·검증 모두 Claude Code) — 아래 §0 의 기준선 고정과 §5 의 전건 변이 검출로 자기 증명을 막았다 |

## 0. 기준선 / plan 변경 확인

- **기준선이 diff 로 성립한다.** 설계 커밋 `e3dc021`(plan 427줄 신설)과 구현 커밋 `995f1cd` 가 갈려 있다 — §0 의 자기 증명 방지 장치가 작동한다.
- 구현 커밋의 `plan.md` diff 는 **`메타.상태` 한 줄(`READY` → `IMPL_DONE (r1)`) + `[구현자 기입]` 6절**뿐이다. 재현: `git diff e3dc021 995f1cd -- docs/handoff/0195-*/plan.md` → 404행 이전의 변경은 8행 한 줄.
- **Decision Ledger 변경 없음** — D-001~D-007 전부 ACTIVE 원문 그대로. SUPERSEDE 0건.
- **Product/UX Contract 변경 없음** — §5 흐름·상태 전이표·엣지케이스 무변경.
- **AC 변경 없음** — AC1~AC14 의 `동작 기준`·`검증 수단`·`프로덕션 도달 경로` 세 칸 전부 원문. 구현이 AC13 의 검증 수단과 다르게 구현했으나 **AC 행을 고치지 않고** `구현 보고`에 차이로 적었다(§12 D8).
- 채점 기준: `e3dc021` 의 §7 AC 14행 + §10 강제 지점 6행 + §3 Decision 7행.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 `present` 필수 | 교환 토큰이 bearer 로 실린다 | `resolveCarrier` → `presentationFor` → `presentationOf`(`authenticated-request.ts:360`) → `applyPresentation` |
| D-002 요청 형상은 선언이 정한다 | `in`·`name`·`params`·`method` 가 요청을 만든다 | `exchangeRequest`(`runner.ts:237`) → `getJson` → `sessions.send` |
| D-003 refresh 는 저장만 | `refreshKey` 는 생기고 갱신은 `unsupported` | `tokenCandidate`(`login.ts:837`) 저장 · `refresh`(`login.ts:376`) 가 `authKind!=='oauth'` 로 차단 |
| D-004 401/403 + origin 미복귀 | 세션 grant 가 `expired` 로 강등 | `authenticationReturned`(`authenticated-request.ts:263`) → `markExpired` → `onUnauthorized` |
| D-005 code 는 final URL, 기본 이름 `'code'` | 선언 이름 또는 `'code'` 로 추출 | `codeParam`(`runner.ts:227`) → `pickUrlParam`(`specs/browser-session.ts:69`) |
| D-006 `code` 필수 · 쿠키 교환 제거 | 코드 없으면 실패, 쿠키 폴백 0 | `runner.ts:181-189` early return · `no-cookie-token.test.ts` |
| D-007 `sessions.send` 로 교환 | 파티션·쿠키 유지 | `getJson` 의 유일 전송(`runner.ts:135`) · `SessionRunnerDeps` 에 `fetchImpl` 자리 없음 |

### end-to-end 흐름 (직접 걸었다)

```text
로그인 창 → doneUrlPrefix 도달 → finalUrl 보존 (runner.ts:56-63)
  → pickUrlParam(finalUrl, code.param ?? 'code')
  ├ 없음 → logger('…no-code', {authId, param}) → failure('exchange_failed', '인가 코드를 찾지 못했습니다')
  │         → login.ts absorb('failed') → fail() → ProviderStepInfo.message
  │         → GateLogin.tsx:79 `{failure.message}` (화면 도달 확인)
  └ 있음 → exchangeRequest → sessions.send → valuePath/refreshTokenPath/principalPath
            → Grant{token, authKind:'browser-session', refreshKey?}
            → probe(bearer) → 커밋 → BoundAuth.request 가 Authorization: Bearer 로 나간다
```

- `ProviderFailureReason` 은 늘지 않았다 — `exchange_failed` 가 `src/shared/ipc.ts:1301` 에 이미 있다. renderer·i18n 변경 0 이라는 plan §5 주장이 성립한다.

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 실환경 실패 방식 | 전부 `exchange_failed` 로 접힌다 | 코드 부재·비-2xx·비-JSON·`valuePath` 부재 4종. `runner.test.ts` "교환 실패·형식 불일치" 3케이스 + no-code 1케이스 |
| false success 가능성 | **없다** | 빈 코드(`?code=`)는 값이 아니다(`pickUrlParam` 길이 검사, 변이 M-F 검출). 코드 없이 교환 요청이 나가지 않는다(변이 M13 검출) |
| partial failure/rollback | 기존 구조 유지 | 후보는 probe 전 store·vault 미기입. `refreshKey` 한 자리만 추가되고 `vaultKeysOf`(`store.ts:22`)가 두 키를 함께 해제·sweep 한다 |
| A 대신 B 를 구현했는가 | 아니오 | 요구 ①~⑤ 가 AC1·AC3~5·AC9·AC1/AC2·AC11/AC12 에 각각 대응. 대체 설계 흔적 없음 |
| 증상만 제거했는가 | 아니오 | `presentationOf` 가 `null` 을 돌려주던 원인 자체를 고쳤다(변이 M1 → 7케이스 실패) |
| 최적화가 잃은 관측 | 없다 | `principalPath` 왕복 0 은 0182 의 기존 규칙. 새 캐시·스냅샷 0 |
| 출력/요청 worst-case 상한 | 로그인당 요청 **+0** | 교환은 이미 있던 1회. 새 로그 1줄(`no-code`), 값이 아니라 이름만 싣는다 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh e3dc021..995f1cd
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 값 export | **없음** | 1a 항목 0건. `pickUrlParam` 은 `runner.ts:25` 가 import 해 프로덕션에서 부른다 |
| `SessionRunnerDeps` 테스트 전용 | **정상** | 타입 전용 export 이고 `SessionRunner` 생성자의 **실제** 파라미터 타입(`runner.ts:44`)이다. AC7 의 `@ts-expect-error` 가 프로덕션 타입을 겨눈다 — 재현: deps 에 `fetchImpl?` 을 더하면 `TS2578 Unused '@ts-expect-error' directive` |
| 형제 정책 비대칭 | 스캐너 0건 · **수동 1건** | `pickUrlParam` 은 빈 문자열 거부를 케이스로 잠갔고 형제 `pickSecretPath` 는 잠그지 않았다 → D3 |
| 신규 등록값의 기존 소비처 | 무영향 | `connection-views.ts:73` 은 `activeMethod` 를 그대로 싣는다 — token grant 여도 `browser-session` 이라 GUI 표시 불변 |
| producer ↔ consumer | 일치 | 토큰 출처는 교환 응답 `valuePath` 하나. 소비자가 토큰을 조립할 자리 없음 |
| 동일 규칙 중복 구현 | **SSOT 유지** | origin 판정은 `isAllowedOrigin` 한 구현 — `probeOk`(`login.ts:495`)·`authenticationReturned`(`:264`)·`checkRedirect`(`policy.ts:80`) 가 같은 함수를 부른다 |

## 4. 기존 테스트 / semantic 검증 확인

- plan §7 이 인용한 기존 테스트 실재: `runner.test.ts` 교환 describe(재작성됨) · `authenticated-request.test.ts:100` 세션 describe · `auth-resume.test.ts` 방송 상한 describe **3케이스**(`:347`·`:365`·`:383`, 무변경 통과).
- **structural proxy 만으로 통과한 AC 없음.** AC8ⓐ 는 "함수가 불렸다" 가 아니라 "같은 세션·다른 응답 본문이면 토큰이 따라 바뀐다"(`A`/`B`)를 단언한다.
- **AC12·AC13 의 "1회"** 는 sink(`onUnauthorized` fake 배열)에서 센다. 프로덕션 호출부는 `authenticated-request.ts:174` **1곳**(`rg -n 'onUnauthorized\?\.\(' src/main -g '!*.test.ts'` → 1건) — 모형되지 않는 항이 없다.
- **AC13 의 fake 가 관측 대상을 갖는가**: 갖는다. `login.test.ts` 하네스는 `probeApi` fake 를 쓰지 않고 진짜 `AuthenticatedRequester` 를 같은 store 에 물린다 — 변이 M-O(resume 이 전이 무관하게 방송)를 검출했다.
- 순서 기준 AC 없음 — plan §11 "순서 관측: 필요 없음" 이 성립한다.

## 5. 요구사항 충족 매트릭스

각 행의 `검증 증거` 는 **변이를 심어 그 케이스가 실패하는 것**까지 확인한 것이다. 변이 목록은 §5-b.

| # | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AC1 | token grant 요청에 `Authorization: Bearer` | ✅ | `authenticated-request.test.ts` "선언한 present 대로…" — 주입 fetch 헤더 `Bearer tok-abc`. 변이 M1 검출 | `BoundAuth.request`→`resolveCarrier`→`applyPresentation` |
| AC2 | 로그인 probe 가 bearer 로 나가 `done` | ✅ | `login.test.ts` — 나간 요청 1건 `/api/me`, 헤더 `Bearer tok-1`, `isVerified` true. 변이 M1 검출 | `settleGrant`→`probeOk(candidate)` |
| AC3 | `code:{param:'ticket'}` → 요청에 `ticket=abc` | ✅ | `runner.test.ts` — 교환 URL 의 `ticket=abc`. 변이 M-E(기본값 변경) 검출 | `SessionRunner.login`→`exchange` |
| AC4 | `in:'form'` → POST + urlencoded + code·params 동반 | ✅ | 본문 3키 · 쿼리 빈 문자열. 변이 M-K(기본 GET)·M-L(content-type 제거)·M-J(`name` 무시) 각각 검출 | 〃 |
| AC5 | `param` 미지정이면 `'code'` | ✅ | `?code=xyz` → 교환 URL `code=xyz`. 변이 M-E 검출 | 〃 |
| AC6 | 코드 부재 → `exchange_failed` · grant 미커밋 · 로그는 이름만 | ✅ | `sessions.send` **미호출** + 로그 `{authId,param}`. `login.test.ts` 로 이전 grant 보존. 변이 M13(코드 없이 교환)·M-M(로그에 finalUrl) 검출 | 〃 → `absorb('failed')` |
| AC7 | 교환이 `sessions.send` 로 나간다 | ✅ | handle `handle-1` · `acquire('corp')`. `@ts-expect-error` 가 `fetchImpl` 자리 부재를 컴파일로 고정(위 §3 재현) | `BrowserSessionPort.send` |
| AC8 | 토큰은 응답 JSON 에서만 | ✅ | ⓐ 같은 세션·다른 본문 `A`/`B`. ⓑ 아래 §7 의 **엄격 재측정 0건** | 불변식 가드 |
| AC9 | `refreshTokenPath` 선언 시에만 `refreshKey`+vault | ✅ | `vault.names()` 2(서로 다른 키) ↔ 미선언 1·`refreshKey` 부재. 변이 M7 상당 | `absorbToken`→`tokenCandidate`→`writeVault` |
| AC10 | `refreshKey` 가 있어도 `refresh`=`unsupported` | ✅ | 먼저 `refreshKey` 존재를 단언한 뒤 `'unsupported'`. 게이트는 `login.ts:376` 한 곳 | `LoginService.refresh` |
| AC11 | `exchange` 미선언 Auth 는 쿠키로 요청·401 에 `expired` | ✅ | `WIKI`(exchange 없음) 401 → `status()==='expired'` · 통지 1건 | `resolveCarrier`(session) |
| AC12 | 200 이어도 origin 밖 종료면 `expired` · 통지 1회 | ✅ | `finalUrl`=IdP · 통지 배열 길이 1. 변이 M2(`!returned` 항 제거) 검출 | `request()` 강등 분기 |
| AC13 | 부팅 복원 probe 가 다시 봐도 방송이 늘지 않는다 | ✅ | `login.test.ts` — `snapshots` 가 `[{unauthorized}]` 하나. 변이 M-O(전이 무관 방송) 검출. `auth-resume.test.ts` `P+1` 3케이스 무변경 통과 | `resume()`→`markExpired` |
| AC14 | 가이드 §2-b 예제가 배포 파일에서 컴파일된다 | ✅ | **검증자가 직접 재현** — 예제를 `auth-definitions.ts` 에 대입 → `npm run typecheck` 3/3, `error TS` 0줄 → 되돌려 `git status` 클린 | 배포 선언 컴파일 |

- **합계 재측정**: `✅ 14 · ⚠️ 0 · ❌ 0 = 총 14`. 분모는 `e3dc021` 의 §7 표를 직접 세어 잡았다(AC1~AC14, 분할·추가 0).
- **합계 사본 대조**: 본문 `14/14` ↔ 커밋 `995f1cd` trailer `Criteria-Met: 14/14` ↔ 커밋 `0cfba20` trailer `14/14` ↔ INDEX 비고 `AC 14/14` — **4사본 일치**. 0190 r1 의 갈림(본문 `14/17` ↔ trailer `13/17`)은 재현되지 않는다.

### 5-b. 심은 변이 — 검증자가 직접 실행

명령: 변이 적용 → `./node_modules/.bin/vitest run src/main/features/auth src/main/app/auth-resume.test.ts` → 원복(타입 변이는 `tsc -p tsconfig.test.json`). 전건 원복 후 `git status` 클린 · 284케이스 재통과 확인.

**총 24건: 검출 19 · 미검출 5.** 내역 = 프로덕션 변이 15(검출 11) + 타입 변이 6(검출 6) + 가드 자기 변이 3(검출 2). 합이 24 임을 따로 셌다.

| 변이 | 결과 |
|---|---|
| M1 `presentationOf` 가 다시 `null` | **검출** — 7케이스 |
| M2 강등 조건에서 `!returned` 항 제거 | **검출** — AC12·AC13 2케이스 |
| M-E `code.param` 기본값 변경 | **검출** — 9케이스 |
| M-F `pickUrlParam` 이 빈 문자열 수용 | **검출** — 1케이스 |
| M-J `code.name` 무시 · M-K form 기본 GET · M-L content-type 제거 | **각각 검출** — AC4 |
| M-M `no-code` 로그에 `finalUrl` 추가 | **검출** — 2케이스 |
| M-N 후보 면제(`!candidate`) 제거 | **검출** — `runtime.test.ts` 3케이스 |
| M-O `resume` 이 전이 무관하게 방송 | **검출** — AC13 + `runtime.test.ts` 2케이스 |
| M13 코드 없이 교환 요청(쿠키 교환 복귀) | **검출** — AC6 |
| T1/T2 3 선언 사이트 × `present`/`code` 제거 | **6/6 검출** — `TS2741`/`TS2322` |
| G1 가드 스윕 비재귀 · G2 테스트 파일 포함 | **각각 검출** — 가드 자기 케이스 |
| **M-D 값형 면제 가드 제거** | **미검출** — 전체 스위트 2056케이스에서 0 실패 → D1 |
| **M-G `params` 가 코드를 덮도록 순서 반전** | **미검출** → D2 |
| **M-H `refreshTokenPath` 미선언 시 기본 경로로 흡수** | **미검출** → D3. 픽스처의 refresh 값이 `data.refresh` 라 표준 이름을 기본값으로 준 변이를 못 본다 |
| **M-I `pickSecretPath` 가 빈 문자열 수용** | **미검출** → D3 |
| **G3 `stripCommentsAndStrings` 배선 제거** | **미검출** → D4 |

### plan §10 강제 지점 표 — AC 와 별개로 걸었다

| 계약/필드 | plan 이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| `exchange.present` 필수 | 컴파일 — 배포·테스트 선언 **전부** | 배포 0 + 테스트 3 = **3** (T1a/b/c 전건 `TS2741`/`TS2322`) | ✅ 3/3 |
| `exchange.code` 필수 | 〃 | 같은 3 사이트 (T2a/b/c) | ✅ 3/3 |
| presentation 해석 | 요청 1회 (`presentationFor` 호출부) | `rg -n 'presentationFor\(' src/main -g '!*.test.ts'` → 호출 1(`:301`)·정의 1(`:341`) | ✅ 1/1 |
| 세션 만료 판정(D-004) | ① 요청 응답 ② 부팅 복원 probe — **2곳** | `rg -n 'store\.markExpired\(' src/main -g '!*.test.ts'` → `authenticated-request.ts:167`·`login.ts:342`. ①=M2 ②=M-O 로 각각 관측 | ✅ 2/2 |
| 토큰 출처 = 응답 JSON | CI 위생 테스트 | `no-cookie-token.test.ts` — 엄격 재측정 0건(§7) | ✅ 1/1 |
| code 값 비로깅 | 실패 로그 작성 시 | `runner.ts` `logger?.(` 호출부 **3**(`:160`·`:185`·`:198`), payload 키가 값을 나르지 않는다 | ✅ 3/3 |

- **분모 재계산**: `3+3+1+2+1+3 = 13`. 자기보고 `13/13` 과 일치하며, 분모 산출 근거(§10 6행의 `언제 강제` 칸)도 같다.
- **표에 없는데 같은 불변식이 필요한 지점**: `SessionRunner` 자신의 교환·whoami 요청은 `AuthenticatedRequester` 를 지나지 않아 D-004 판정 밖이다 — 로그인 중이라 강등할 grant 가 없으므로 지점이 아니다(설계 누락 아님).

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `AuthDefinition…config.exchange` | AC14 — 가이드 §2-b 예제 대입 후 `typecheck` 3/3 (검증자 재현) | 기본 이름 `'code'`(AC5) · 코드 부재는 실패(AC6) · 전송은 세션 경로(AC7) · refresh 는 저장만(AC10) | ✅ |
| 가이드 문서 앵커 | §1.5(`:171`)·§2-b(`:352`)·§2-c(`:404`)·§3-b(`:479`) 실재 | 새 표 6행이 각 필드의 "흔한 실수" 를 적는다 | ✅ |
| `auth.md` 앵커 | §2.1(`:47`)·§4.5(`:279`)·§4.6(`:315`)·§5.2(`:391`) 실재 | §4.6 표가 두 grant 의 만료 관측 방법을 가른다 — 코드와 일치 | ✅ |
| 로그 이벤트 이름 | `auth.probe.result` 실재(`login.ts:498`) · 옛 `providers.session.probe.unauthenticated` 는 전 저장소 **0건** | 가이드 §9 트러블슈팅이 실재 이름을 지목한다 | ✅ |

## 7. 숫자 / 음성 기준 / 상한 재측정

- **교환 선언 리터럴 3** — `authenticated-request.test.ts:350` · `login.test.ts:1264` · `runner.test.ts:32`. 프로덕션 `AUTH_DEFINITIONS = []`(`auth-definitions.ts:48`) → **0건**. plan §8 의 "프로덕션 선언 0" 이 여전히 참이다.
- **AC8ⓑ 의 `0건` 을 엄격 기준으로 재측정했다** — 구현 가드는 `/\.cookies\b/` 를 주석·문자열 제거 후 훑는다. 한 단계씩 엄격하게:
  - ⓐ 주석·문자열 **미제거** 원본에 같은 정규식 → `features/auth/**` 비테스트 **0건**. 차집합 공집합 — 제거가 무언가를 가리고 있지 않다.
  - ⓑ 술어를 `\bcookies\b` 로 넓혀(대괄호 접근·구조분해까지) → **0건**. 차집합 공집합.
  - ⓒ 구조적으로도 닫혀 있다 — `BrowserSessionPort`(`specs/browser-session.ts:27-42`)의 표면은 `register`·`acquire`·`openLoginWindow`·`send`·`clear` 5개뿐이라 `features/auth/**` 가 닿을 쿠키 읽기 API 자체가 없다.
- **`P + 1` 상한 describe 3케이스** — `auth-resume.test.ts:347`·`:365`·`:383`. 파일 무변경(`git diff --stat` 빈 출력), 전건 통과.
- **`onUnauthorized` 프로덕션 호출부 1** — 재측정 일치.
- **요청 상한**: 로그인당 +0. D-004 판정은 `isAllowedOrigin` 문자열 비교 1회 — vault·네트워크 접근 0.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| 코드 추출·교환 요청 형상 | 전부 (포트 fake) | 없음 | — |
| bearer 주입·강등·방송 | 전부 (진짜 `AuthenticatedRequester`) | 없음 | — |
| **실제 창이 final URL 에 코드를 담아 오는가** | 불가 | **남는다** | `npm run dev` → [연결] → SP 로그인 → 연결됨 확인 |
| **`sessions.send` 가 파티션 쿠키를 싣는가** | 불가 | **남는다** | 〃. `infra/browser-session.ts` 는 electron 을 import 해 vitest 대상이 아니다 |
| **SSO 미인증이 200+폼으로 오는가** | 불가 | **남는다** | 세션 만료 후 API 호출 → 연결 탭에 재인증 지점이 뜨는지 |

- 순수 로직을 사람에게 넘긴 항목은 없다. 남은 셋은 전부 electron/실 SP 왕복이고, plan §19 의 "사람 실기: 없음" 은 **plan 이 정의한 AC 범위**에 한해 맞다 — 위 세 항목은 AC 가 아니라 배포 실기다.

## 9. 게이트 재실행

적용 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`. `npm test` 는 쓰지 않았다 — DB 동작을 볼 이유가 없다.

| 명령 | **관측한 산출**(exit code 아님) |
|---|---|
| `npm run typecheck` | **3/3**(`node`·`web`·`test`) · `error TS` **0줄** |
| `npm run lint` | **0 error · 1 warning** — `useTranscriptVirtualizer.ts:22` react-compiler 경고, 변경 무관 파일 |
| `vitest run src/main/features/auth src/main/app/auth-resume.test.ts` | **13파일 / 284케이스 통과** |
| `vitest run …auth …auth-resume …gate …infra/net`(구현자 명령 재현) | **16파일 / 321케이스 통과** — 자기보고와 일치 |
| `vitest run`(전체) | **202파일 통과 · 5파일 실패 / 2014 통과 · 42 실패** |
| `node scripts/check-doc-inventory.mjs --check` | generated ok(9 items, 76 channels) · prose ok · links ok |

- **환경 기인 실패 분리**: 실패 5파일은 `infra/db/{queries,migrate}` · `features/extensions/builder` · `features/orchestration/fork` · `app/chat-turn.continuity` 로 `app/AGENTS.md:135` 의 실측 목록과 **동일**하고, 오류는 전건 `Module did not self-register: better_sqlite3.node` 다. 변경 무관 ABI 베이스라인.
- **게이트가 작업 트리를 바꿨는가**: **없음**. `npm run lint` 는 `--fix` 라 파일을 쓸 수 있어 실행 전후 `git status --porcelain` 을 대조했고 둘 다 빈 출력이었다.
- **검증 중 실행한 명령의 잔여물**: 없음. 변이 15건·AC14 대입 1건은 전부 `.bak` 원복 후 `git status` 클린을 확인했다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/관련 테스트 | 에이전트 — §9 에 산출 기재 |
| AC ↔ production path | 에이전트 — §5 1:1 + 변이 검출 |
| 레이어/계약/문서 링크 | 에이전트 — `check-doc-inventory` links ok · 앵커 8건 실재 확인 |
| AGENTS 위생 | 해당 없음 — 이번 변경에 `AGENTS.md` 수정 0 |
| 제품 의도 / Open Question | **사람** — D-004 오탐 리스크(§17)는 사용자가 이미 선택한 트레이드오프 |
| UI 시각 품질 | 해당 없음 — renderer 변경 0 |
| 신규 의존성 | 없음 |
| 실 SP 왕복 | **사람** — §8 세 항목 |

## 11. Repository operation checks

### AGENTS.md 위생

- 이번 커밋의 `AGENTS.md` 변경 **0건** — 대상 없음.
- 새 문서의 비밀 패턴 스캔: 가이드 §2-b 예제의 `client_id: 'orca'` 는 공개 식별자이고, 같은 표가 "`code.params` 에 비밀을 적지 않는다" 를 명시한다. 토큰·키·이메일·IP 유입 0건.

### INDEX 보드 정합성

- 상태 `impl`/`IMPL_DONE` · 다음 주체 `Claude (검증)` · 라운드 `1` — 실제 상태와 일치.
- **대상 커밋 `995f1cd` 실재** — `git show 995f1cd --oneline` 성공. plan `구현 보고 §대상 커밋` 사본과 값이 같다(0cfba20 이 두 사본을 함께 채웠다).
- **비고 631자 · 6문장** — `docs/handoff/AGENTS.md §산출물 문장 규칙 3` 의 "5줄 이내" 를 넘본다 → D7. 이번 검증 턴에서 verify 판정으로 갱신하며 줄인다.

### Commit / reference 정합성

- trailer 3커밋 전건이 `git interpret-trailers --parse` 로 파싱된다 — 블록 내부 빈 줄 없음.
- 허용값 준수: `Agent: claude` · `Status: designed|implemented` · `Verified-By: pending` · `Handoff:` 경로 실재. 설계 커밋에 `Criteria-*`·`Next-Action` 없음(규약대로).
- `Agent: claude` 로 구현 커밋을 낸 것은 root `AGENTS.md §협업 워크플로우` 의 "Claude 가 직접 구현까지 수행" 갈래를 따른다 — 위반 아님.
- 이동/삭제한 reference·script 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| AC13 검증 수단을 `auth-resume.test.ts` → `login.test.ts` 로 이동 | **타당** — 그 파일의 `fakeRuntime.resume`(`:155`)은 요청 경로를 갖지 않아 두 emitter 가 존재하지 않는다. 옮긴 하네스가 더 강하다(M-O 검출) | AC 행동 기준으로 채점해 ✅. plan §7 AC13 행 정정 필요 → D8 |
| `getJson` 시그니처 파급으로 whoami 호출부도 바꿨다(선조치) | **타당** — whoami 테스트가 요청 형상을 정확히 단언(`{url,method:'GET',headers:{accept}}`)해 회귀가 잠긴다 | 수용 |
| 파생 이슈 ①(`allowedOrigins` 오기 시 부팅마다 창) | **타당** — 창은 `MAX_RELOGIN_ATTEMPTS=3`(`auth-resume.ts:50`)으로 상한이 있다. 런타임 방어 부재도 사실 | 범위 밖으로 기록 |
| 파생 이슈 ②(`code.params` 평문) | **타당** — 타입으로 막지 못한다 | 범위 밖으로 기록 |
| "가드에 결함 3건을 심어 전부 잡히는 것을 단언" | **부분 과장** — 3축 중 2축(대상 집합·추출)은 end-to-end 로 잠기지만 주석 제거는 **함수 단위만** 잠긴다(G3 미검출) | D4 |

## 13. 파생 이슈

**전부 가드·문서 공백이고 프로덕션 결함이 아니다** — 그래서 PASS 를 막지 않는다. plan 의 `[검증자 기입] 파생 이슈` 로 이관한다.

- [ ] **D1** `authenticationReturned` 의 값형 면제(`carrier.kind !== 'session'`)가 전수 무테스트 — 가드를 지워도 **전체 2056케이스에서 0 실패**. 동명 테스트("값형 grant 는 origin 판정을 받지 않는다")의 체인이 `definition.origin` 안에서 끝나 항진명제다. 현재는 `redirectOrigins` 가 값형을 `[definition.origin]` 하나로 묶어 무해하지만, 그 목록이 넓어지는 순간 이 가드가 하중을 받는데 잠겨 있지 않다.
- [ ] **D2** `exchangeRequest` 의 "같은 이름이 겹치면 코드가 이긴다"(`runner.ts:243` 주석)가 무테스트 — 전개 순서를 뒤집어도 0 실패. 배포가 `code.params` 에 같은 이름의 자리표시자를 남기면 실제 인가 코드가 조용히 덮인다.
- [ ] **D3** refresh 흡수 축이 두 자리에서 무테스트 — ⓐ `pickSecretPath` 의 빈 문자열 거부(변이 M-I), ⓑ `refreshTokenPath` fail-closed(변이 M-H: 미선언 시 `'refresh_token'` 을 기본 경로로 주면 통과한다 — 픽스처가 값을 `data.refresh` 에 두기 때문이다). 형제 `pickUrlParam` 은 `?code=` 케이스로 같은 축을 잠갔다.
- [ ] **D4** `no-cookie-token.test.ts` 의 `stripCommentsAndStrings` **배선**이 무테스트 — 함수 자체는 3케이스로 잠기지만 `offendersIn` 에서 떼도 0 실패. 실패 방향이 fail-loud(오탐)라 위험도는 낮다.
- [ ] **D5** `docs/arch/backend/auth.md` 347·349행에 `---` 가 **2개 연속** — §4.6 신설이 넣은 구분선이 기존 것과 겹쳤다.
- [ ] **D6** `SessionRunner.getJson` 이 `checkRequestPath` 를 지나지 않는다 — `exchange.path`·`whoami.path` 에 절대 URL 을 적으면 세션 쿠키가 `provider.origin` 밖으로 나간다. **선행 결함**(0181/0182)이지만 0195 가 같은 요청에 **인가 코드**를 함께 실으면서 노출이 넓어졌다. 계약 주석(`contracts/auth.ts:163`)은 규칙을 적지만 강제 지점이 없다.
- [ ] **D7** INDEX 비고 631자·6문장 — 5줄 상한 초과. 이번 verify 갱신에서 줄인다.
- [ ] **D8** plan §7 AC13 행의 `검증 수단` 칸이 아직 `auth-resume.test.ts` 를 지목한다 — 실제 위치는 `login.test.ts` 다. 규범 행 정정이므로 **설계 커밋**으로 고친다.

## 14. Review Signals — 사실만

- **이전 라운드**: 없음(r1, 신규 handoff).
- **동일/유사 증상**: D-004 는 0194 r4 가 401 경로에서 닫은 "같은 강등을 두 지점이 보면 방송이 두 배" 와 같은 불변식의 새 조건절이다. 그 축은 조건이 하나 늘 때마다 다시 열린다.
- **관련 plan 지침의 존재**: AC13 의 `검증 수단` 칸이 **관측 대상을 갖지 않는 fake 를 지목**했다. `프로덕션 도달 경로` 열은 채워져 있었지만 "그 경로가 *테스트에서* 진입되는가" 는 어느 열도 묻지 않는다.
- **미검출 변이 5건(D1~D4)의 공통 축**: 전부 **코드 주석이 불변식을 선언했는데 케이스가 없는 자리**다. plan §10 은 계약 필드의 강제 지점을 열거하지만, 구현이 주석으로 새로 선언한 불변식은 어느 표에도 들어가지 않는다.
- **사용자 결정 변경 근거**: 없음. D-001~D-007 전건 ACTIVE 유지.
- **반복된 검증 환경 한계**: electron ABI(egress 차단) — DB 로드 5스위트가 계속 red 다. `npm test` 대신 `./node_modules/.bin/vitest run` 우회를 이번에도 썼다.

## 15. 결론

- **상태: PASS.**
- **Product/UX 및 ACTIVE Decision 충족** — D-001~D-007 전건이 production path 에 도달한다(§1). 새 실패 문장이 `GateLogin.tsx:79` 까지 닿고 `ProviderFailureReason` 은 늘지 않았다.
- **AC 충족 — 14/14.** 분모를 직접 세었고 4사본(본문·trailer 2·INDEX)이 일치한다. 각 AC 를 변이 검출까지 확인했고 AC14 는 검증자가 직접 재현했다.
- **§10 강제 지점 — 13/13.** 각 행의 지점을 다시 세고(3·3·1·2·1·3) 각각 코드에서 확인했다. 부분 구현 0.
- **기준 밖 결함**: 프로덕션 결함 **0건**. 가드·문서 공백 8건(D1~D8)을 파생 이슈로 남긴다 — 미검출 변이 5건(24건 중)은 전부 "코드가 주석으로 선언한 불변식에 케이스가 없다" 는 한 축이다.
- **repository operation checks**: trailer·보드·해시·앵커 전건 정합. 비고 길이 1건(D7)만 초과.
- **못 본 것**: 실제 Electron 창의 final URL, `sessions.send` 의 파티션 쿠키, 실 SP 의 200+로그인폼 — 셋 다 electron/실 SP 왕복이라 이 환경에서 관측 불가다(§8).
- **다음 단계**: 보드 `verify/PASS`. **D8 은 규범 행 정정이라 설계 커밋으로 처리한다.** D1~D6 은 후속 handoff 후보이고 배포 전 차단 요인이 아니다. archive 이동은 D8 정정 뒤에 한다.
