# Verify — 0196-session-exchange-json-request

> 절차 정본은 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md),
> 협업·상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0196-session-exchange-json-request` |
| 검증자 | Claude Code |
| 일자 | 2026-08-21 |
| 대상 커밋/range | `58a8a06..d98c7bd` (좌표 커밋 `df379bb` 포함) |
| 구현 전 plan 기준 | `58a8a06` (plan/READY) |
| 라운드 | 1 |
| 상태 | **PASS** |
| 자기 검증 여부 | **설계·구현·검증이 모두 Claude** — 독립 주체가 아니다. 그래서 §0 의 기준선 diff 가 유일한 자기 증명 방지 장치이며, 아래 관측이 그 장치의 성립을 먼저 보인다 |

## 0. 기준선 / plan 변경 확인

**기준선이 diff 로 성립한다.** 설계 커밋(`58a8a06`)과 구현 커밋(`d98c7bd`)이 갈려 있고,
구현 커밋의 `plan.md` diff 에서 **삭제된 줄은 `| 상태 | plan/READY |` 한 줄뿐**이다
(`git diff 58a8a06 d98c7bd -- docs/handoff/0196-*/plan.md`).

| 축 | 관측 | 판정 |
|---|---|---|
| Decision Ledger | 삭제·수정 0줄. D-001~D-010 원문 그대로 | 무단 변경 없음 |
| Product/UX Contract (§1·§5) | 삭제·수정 0줄 | 〃 |
| AC (§7 10행) | 삭제·수정 0줄. 추가분은 전부 `[구현자 기입]` 절 | 〃 |
| §10 강제 지점 표 | 삭제·수정 0줄 | 〃 |

- 채점에 사용한 원 기준: `58a8a06` 시점의 §3 Decision Ledger · §7 AC1~AC10 · §10 강제 지점 8행.
- `df379bb` 는 `__COMMIT__` 자리표시자를 `d98c7bd` 로 채운 좌표 커밋이다 — 규범 행 무변경.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-005 · D-008 | 코드는 final URL 에서 추출, 기본 이름 `'code'` | `runner.ts:178` `pickUrlParam(finalUrl, codeParam(exchange.code))` |
| D-009 | 교환 요청은 `POST` + `application/json` 고정 | `runner.ts:236-253` `exchangeRequest` — 분기 0 |
| D-010 | `code.in` 이 계약에 없다 | `contracts/auth.ts:148-158` — 필드 3개(`param`·`name`·`params`) |
| D-006 | `exchange` 선언 시 `code` 필수, 쿠키→토큰 경로 없음 | `auth.ts:175` `code: SessionCodeExchange` · `no-cookie-token.test.ts` |
| D-007 | 전송은 `sessions.send` 하나 | `runner.ts:131` — features/auth 프로덕션에서 로그인 경로 send 는 이 1곳 |
| D-001 | `present` 필수 | `auth.ts:179` — 미기재 시 TS2741 (§5 AC1) |
| D-003 · D-004 | refresh 저장만 · 401/origin 미복귀에 `markExpired` | 무변경. `authenticated-request.test.ts` 세션 describe green |

### end-to-end 흐름 (실제로 걸은 경로)

```text
로그인 창 finalUrl (?code=…)
  → SessionRunner.login (bootstrap.ts:272 에서 주입되는 프로덕션 인스턴스)
  → pickUrlParam(param ?? 'code')          없으면 exchange_failed + no-code 로그
  → exchangeRequest → { path, POST, JSON.stringify({...params,[name]:code}), application/json }
  → getJson → sessions.send (파티션·쿠키 유지) → 2xx + JSON 판정
  → valuePath → TokenValue → Grant{kind:'token'} → present → 이후 API 헤더
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 실환경 실패 방식 | 기존 4갈래로 접힌다 | `getJson` 의 catch/status/parse 3분기 + 코드 부재 1분기 → 전부 `exchange_failed` |
| false success 가능성 | 없다 | `exchangeRequest` 는 순수 조립이라 삼킬 오류가 없고, 토큰은 `valuePath` 값이 비-빈 문자열일 때만 성립(`runner.ts:193`) |
| partial failure / rollback | 해당 없음 | 저장 쓰기 순서 무변경 — diff 가 grant·vault 코드를 건드리지 않는다 |
| A 대신 B 를 구현했는가 | 아니오 | 요구 ⑦ "json만 · method 필드 삭제" 와 코드가 1:1 |
| 증상만 지우고 상태가 남았는가 | 아니오 | `query` 인자·`URLSearchParams` 사용이 함께 사라졌다(`rg URLSearchParams features/auth` → 프래그먼트 파싱 2곳만) |
| 최적화가 잃은 관측 | 없다 | 요청 수·로그 수 불변 |
| 출력/요청 worst-case | 불변 | 교환 요청 1회, 본문 크기는 `params` 선언 크기에 비례 |

**부수 효과 하나를 확인했다**: `exchangeReason(case 'send')` 는 전송 예외 메시지를 그대로
사용자 문장으로 쓴다(`runner.ts:283`). 0196 이전 `'query'` 갈래에서는 그 메시지가 인가 코드가 박힌
URL 을 담을 수 있었다 — 코드가 본문으로 옮겨지며 그 경로도 함께 닫혔다.

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 58a8a06..d98c7bd
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 export `AuthProbe`·`OAuthRedirect` | 정상 | 같은 파일 시그니처가 쓴다(`auth.ts:285` `probe?: AuthProbe`). 이번 diff 산물이 아니다 |
| 테스트 전용 `SessionRunnerDeps` | 정상(오탐) | 프로덕션 생성자 파라미터 타입(`runner.ts:44`) |
| 형제 정책 비대칭 | 없음 | 스크립트 0건 |
| 신규 등록값의 기존 소비처 | 해당 없음 | 등록·부팅 경로 변경 0 |
| producer ↔ consumer 불일치 | 없음 | 소비자(`resolveCarrier`·`applyPresentation`)는 `Grant` 만 본다 — 교환 형상이 닿지 않는다 |
| 동일 규칙 중복 구현 | SSOT 유지 | 이름 규칙(`name ?? param ?? 'code'`)은 `exchangeRequest`·`codeParam` 두 함수 한 쌍뿐, 문서는 서술만 |

**테스트가 프로덕션 심볼을 부르는지 따로 확인했다.** `runner.test.ts:16` 이
`import { SessionRunner } from './runner'` 로 실제 클래스를 쓰고, fake 는 주입 포트
(`BrowserSessionPort`)뿐이다 — 로컬 재구현 없음. 그 클래스는 `bootstrap.ts:272` 가 만든다.

## 4. 기존 테스트 / semantic 검증 확인

- plan 이 인용한 기존 케이스 실재: `exchangeSpec`(`:29`) · 실패 케이스 배열(`:336`) · 세션 케이스 — 전건 실재.
- 핵심 분기 실행: 아래 §5-c 의 자체 변이 5건이 전부 케이스를 빨갛게 만들었다(= 분기가 실제로 실행된다).
- structural proxy 만으로 통과한 AC: **없다.** AC1 은 "필드가 없다" 가 아니라 "적으면 거부된다" 를 4갈래로 세고, AC3 은 `search===''` 에 URL 전체 검사를 더한다 — 둘 다 내가 다시 돌렸다.
- `N회`/순서 기준: 해당 AC 없음.

## 5. 요구사항 충족 매트릭스

| # | 기준 | 결과 | 검증 증거(내가 재현한 관측) |
|---|---|---|---|
| AC1 | 구 필드를 적으면 컴파일이 깨진다 · `code`·`present` 는 여전히 필수 | ✅ | 가이드 예제로 만든 **control PASS**(error 0) + 변형 4/4 FAIL: `in`→TS2353 `'in' does not exist in type 'SessionCodeExchange'` · `method`→TS2353 `'method' … 'SessionTokenExchange'` · `code` 누락→TS2741 · `present` 누락→TS2741 |
| AC2 | 교환은 POST + `application/json`, 본문에 코드와 `params` 가 함께 | ✅ | 케이스 `교환 요청은 POST + application/json …` green. 변이 N3(`; charset=utf-8` 만 덧붙임)·N4 를 검출 |
| AC3 | 요청 URL 에 쿼리도 코드 값도 없다 | ✅ | 케이스 green + 변이 **N1**(코드를 URL path 에 붙임)을 검출 — `search===''` 만으로는 못 보는 변이를 실제로 잡는다 |
| AC4 | `param` 미지정 `'code'` · 지정 시 그 이름 | ✅ | 두 갈래 한 케이스에서 본문 `{code:'xyz'}` / `{ticket:'abc'}` |
| AC5 | `name` 미지정=유효 param · 지정 시 그 이름만 | ✅ | `toEqual({authorization_code:'abc'})` 가 `ticket` 키 부재까지 센다. 변이 N4 검출 |
| AC6 | `params` 와 이름이 겹치면 인가 코드가 이긴다 | ✅ | 변이 **N2**(전개 순서 반전)를 이 케이스 **하나만** 검출 — 0195 D2 가 닫혔다 |
| AC7 | 실패 4종의 사유·로그가 0195 와 같고 값은 로그에 없다 | ✅ | 코드 없음(`:246`) + 배열 3종(비-2xx·비-JSON·**전송 실패**) 전건 `exchange_failed`, 전송 실패는 문장 `네트워크 끊김` 까지 단언 |
| AC8 | `exchange` 미선언은 세션 grant, 401/origin 미복귀에 `expired` | ✅ | auth 12파일 237케이스 green 에 `authenticated-request.test.ts` 세션 describe 포함, 해당 파일 diff 는 `code:{}` 1줄뿐 |
| AC9 | 가이드 §2-b 예제가 실제 선언에서 컴파일된다 | ✅ | 가이드 ```ts 펜스를 **파일에서 정규식 추출**해 `auth-definitions.ts` 에 대입 → `typecheck` 3/3 · error 0 → `git checkout` 원복 확인 |
| AC10 | 구 형상을 현재 표면으로 서술하는 문장 0건 | ✅ | plan 술어 0건 + **더 엄격한 술어**(§7)로 재측정해도 0건 |

- **합계 재측정**: `✅ 10 · ⚠️ 0 · ❌ 0 = 총 10`. 분모는 §7 AC 행을 직접 세어 10.
- **합계 사본 대조**: 본문 `10/10` ↔ 커밋 trailer `Criteria-Met: 10/10`(`d98c7bd`·`df379bb`) ↔ INDEX 비고 `10/10` — **세 사본 일치**.

### 5-b. plan §10 강제 지점 표 — AC 와 별개로 걸었다

| §10 행 | plan 이 적은 지점 | 코드에서 확인 | 결과 |
|---|---|---|---|
| `code.in` 부재 | 4 (배포 1 + 테스트 3) | 선언 지점 4개 실측: `auth-definitions.ts`(TS2353 재현) · `runner.test.ts:36` · `login.test.ts:1265` · `authenticated-request.test.ts:351`, 셋 다 `code: {}` | **4/4** |
| `exchange.method` 부재 | 4 (같은 지점) | 같은 4지점 + TS2353 재현. `rg "exchange\.method" app/src` → 0 | **4/4** |
| `code`·`present` 필수 | 2 | TS2741 2건, 각각 다른 필드를 지목 | **2/2** |
| POST + `application/json` | 1 | `runner.ts:236-253` 단일 조립. 로그인 경로 `sessions.send` 는 `runner.ts:131` 하나 | **1/1** |
| 코드가 `params` 를 이긴다 | 1 | 변이 N2 검출 | **1/1** |
| 코드가 URL 에 없다 | 1 | 변이 N1 검출 | **1/1** |
| 토큰 출처 = 응답 JSON | 1 | `no-cookie-token.test.ts` 4케이스 green (auth 스위트에 포함) | **1/1** |
| 문서가 구 형상을 서술하지 않는다 | 3 (가이드 2 · arch 1) | 세 자리 모두 새 형상으로 재작성됨(§7 sweep) | **3/3** |

`✅ 8행 · ❌ 0` / 지점 합 `4+4+2+1+1+1+1+3 = **17**` — 자기보고 17 과 일치한다.

- **표에 없는데 같은 불변식이 필요한 지점**: 없다. `exchange.path` 자체에 쿼리를 적으면 URL 에
  쿼리가 생기지만 그것은 배포가 적은 상수이지 인가 코드가 아니다 — "코드가 URL 에 없다" 를 깨지 않는다.

### 5-c. 검사 장치의 적대 검사 — 구현자와 다른 변이를 내가 심었다

구현자의 M1~M7 을 다시 돌리는 것은 재현이지 검증이 아니라, **판정을 한 단계 미세하게** 바꾼 5건을
프로덕션 코드에 심었다(전부 되돌림, `git status` 클린 확인).

| 변이 | 심은 결함 | 검출 |
|---|---|---|
| N1 | 코드를 URL **path** 에 붙인다(쿼리가 아니라) | AC3 + 경로 케이스 (2 failed) |
| N2 | `{...params, [name]:code}` → `{[name]:code, ...params}` | AC6 **단독** (1 failed) |
| N3 | `application/json` → `application/json; charset=utf-8` | AC2 (1 failed) |
| N4 | `code.name` 무시 | AC2·AC5 (2 failed) |
| N5 | `getJson` 기본 메서드 `GET`→`POST` (whoami 커버리지 탐침) | whoami 케이스 (1 failed) |

N5 는 결함 심기가 아니라 **탐침**이었다 — `query` 인자를 지우며 남긴 `method ?? 'GET'` 기본값이
잠겨 있는지 물었고, whoami 케이스가 잡았다. 커버리지 공백 없음.

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `config.exchange` (폐쇄망 배포가 채운다) | AC9 — 가이드 예제 추출·대입 후 typecheck 3/3 | AC1 — 구 필드 4갈래 **거부** 재현 | ✅ 둘 다 성립 |

가이드가 새로 적은 "위 예제가 실제로 내보내는 본문" 문장도 대조했다 —
`{"grant_type":…,"client_id":"orca","authorization_code":"<코드>"}` 는
`{...params, [name]: code}` 의 실제 직렬화 순서·키와 일치한다.

## 7. 숫자 / 음성 기준 / 상한 재측정

| 항목 | plan/보고 | 내 재측정 | 판정 |
|---|---|---|---|
| `code.in`·`exchange.method` (app/src) | 0 | 0 | 일치 |
| 문서 술어 (`docs/guides`·`docs/arch`) | 0 | 0 | 일치 |
| **더 엄격한 술어** — `app`+`docs` 전체(handoff·archive 제외)에 `urlencoded` 토큰 추가 | — | **0** | 차집합 공집합 → `0건` 이 전수를 뜻한다 |
| 주어 축 sweep(`교환 요청`·`형상은 선언`·`폼 본문` 등) | stale 0 | 12히트 전건 신형상 서술 | 일치 |
| 교환 선언 지점 | 4 | 4 | 일치 |
| 로그인 경로 `sessions.send` | 1 | 1 (`runner.ts:131`) | 일치 |
| `SessionCodeExchange` 참조 | plan §8 = 2, 구현자 실측 = 4 | **식별자 참조 4** + 주석 언급 2 = 6줄 | 구현자 보고가 맞다. plan §8 의 2 는 오차(어느 AC·강제 지점도 참조하지 않는 행) |
| 요청 수·로그 수 상한 | 증가 0 | 증가 0 (diff 에 새 `send`·새 `logger` 호출 없음) | 일치 |

## 8. 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| 교환 요청 형상 | 조립·전송 인자·URL·본문 전부 포트 fake 로 단언 | 없음 |
| 실 SP 왕복 | 불가(폐쇄망 SP 없음) | 배포 시 1회 — 실제 token endpoint 가 JSON 본문을 받는지. 받지 않으면 415/405 로 뜨고 가이드 §9 진단 행이 그 자리를 가리킨다 |

## 9. 게이트 재실행 — exit code 가 아니라 산출을 적는다

| 명령 | 관측한 산출 |
|---|---|
| `npm run typecheck` | node·web·test **3/3**, `error TS` **0** |
| `npm run lint` | **0 error · 1 warning** (`useTranscriptVirtualizer.ts:22` react-hooks/incompatible-library — 이번 변경 무관·선재) |
| `./node_modules/.bin/vitest run src/main/features/auth` | **12파일 / 237케이스 green** |
| `./node_modules/.bin/vitest run` (전체) | **207파일 중 202 green · 5 red** / **2058케이스 중 2016 green · 42 red** |
| `node scripts/check-doc-inventory.mjs --check` | generated ok(9 items·76 channels) · prose ok · links ok |

- **red 42건 = 알려진 ABI 베이스라인.** 실패 파일이 `app/AGENTS.md` 가 적은 5파일과 정확히 같고
  (`infra/db/{queries,migrate}` · `extensions/builder` · `orchestration/fork` · `app/chat-turn.continuity`),
  로그에 `Module did not self-register` 6건 · `better_sqlite3.node` 10건이 찍힌다. 인증 스위트와 겹치지 않는다.
- **리포터 사고 하나를 잡았다**: 첫 시도 `vitest run --reporter=basic` 은 vitest 4 에서 그 리포터가
  없어 **테스트를 하나도 실행하지 않고** 끝났다. exit code 만 봤으면 게이트 자체가 false 가 됐다 —
  그래서 위 표는 전부 파일 수·케이스 수로 적는다.
- **게이트가 트리를 바꿨는가**: 아니오. `npm run lint`(`--fix`) 실행 후 `git status` 빈 출력.
- **검증 중 만든 잔여물**: `auth-definitions.ts` 임시 선언 5회 → `git checkout` 원복 확인(빈 `git status`).
  변이 5건도 전부 원복. 로그·스크립트는 저장소 밖 스크래치패드에만 남겼다.

## 10. 검증 책임 분리

| 항목 | 결과 |
|---|---|
| lint/typecheck/테스트 | 에이전트 실행·산출 기록 (§9) |
| AC ↔ production path | 에이전트 1:1 대조 (§5) |
| 계약·문서 형식·링크 | 에이전트 (§7 · doc-inventory) |
| 제품 의도 / Open Question | 없음 — plan §4 가 "사용자에게 올릴 결정 없음" 으로 닫았고 이번 검증에서 새로 생기지 않았다 |
| 실 SP 왕복 · PR merge | **사람** (§8) |

## 11. Repository operation checks

- `AGENTS.md` 변경: **없다** (diff 10파일에 포함되지 않음) — 위생 스캔 대상 없음.
- INDEX 보드: 단계·상태·다음 주체·대상 커밋 `d98c7bd` 가 실제와 일치. **비고는 1,079자로 §산출물
  문장 규칙 3 의 5줄 상한을 넘었다**(형제 PASS 행 474~584자) → 아래 W1, 이번 verify 커밋의 행 교체로 닫는다.
- 커밋 trailer: `Agent: claude` · `Handoff: docs/handoff/0196-…/` · `Status: implemented` ·
  `Criteria-Met: 10/10` · `Verified-By: pending` — 허용값·주체 규칙에 맞다. 빈 줄로 끊긴 곳 없음.
- 인용 해시 실재: `58a8a06`·`d98c7bd`·`df379bb` 전건 `git show` 로 확인.
- 이동·삭제한 reference/script: 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| ① AC7 의 4갈래 중 '전송 실패' 무케이스 → 케이스 신설 | **타당**. AC 를 고치지 않고 케이스를 더한 것이라 기준 확대가 아니다 | 유지 |
| ② plan §8 `SessionCodeExchange` 행 N=2 vs 실측 4 | **타당**. 내 재측정도 식별자 4 | 유지 — plan 규범 행 아님 |
| ③ 계약 주석을 삭제 이력이 아니라 현재 규칙으로 작성 | **타당**. root `AGENTS.md` 원칙 5 와 같은 방향이고 AC10 자기 술어 충돌도 피한다 | 유지 |

## 13. 파생 이슈 (PASS 를 막지 않는 관찰)

- **W1 — INDEX 비고 1,079자.** §산출물 문장 규칙 3 의 5줄 상한 초과. **0195 D7 과 같은 증상의 재발**(그때는 631자). 이번 verify 커밋에서 5줄 이내로 교체해 닫는다.
- **W2 — `runner.test.ts` 의 AC 라벨이 두 체계로 섞였다.** `// AC6 (0196)`(`:232`)과 `// AC6`(`:244`, 0195 기준)이 같은 파일에서 서로 다른 기준을 가리킨다. `:191`·`:208` 도 0196 기준으로 다시 쓰였으나 라벨은 0195 번호와 겹친다. 다음 라운드가 이 파일에서 "AC 번호 → 케이스" 를 되짚을 때 갈린다 — 라벨에 handoff 번호를 붙이거나 라벨을 떼는 편이 낫다.
- **W3 — `code` 는 필수인데 하위 3필드가 전부 선택이다.** 최소값이 `code: {}` 뿐이라 타입만 보면 `code?:` 와 구별되지 않는다. plan §10 이 "빈 객체가 곧 표식" 으로 의도를 적었고 D-006 이 부재에 다른 의미(코드를 안 주는 SP)를 이미 배정했으므로 **결함이 아니라 기록**이다.
- **W4 — 실 SP 왕복 미관측.** §8 대로 배포 시점 사람 확인으로 남는다.

## 14. Review Signals — 사실만

- **이전 라운드와 동일 증상**: W1 은 0195 파생 D7(INDEX 비고 상한 초과)과 같은 축이다 — 연속 2회.
- **관련 지침 존재 여부**: 있다. `docs/handoff/AGENTS.md §산출물 문장 규칙 3` 이 5줄 상한을 명시하고, 0195 verify 가 이미 같은 행에서 지적했다. 지침이 없어서가 아니라 지켜지지 않아서 재발했다.
- **0195 파생 D2 종료 확인**: 변이 N2 를 AC6 케이스가 단독 검출 — 무테스트 상태가 실제로 닫혔다.
- **사용자 결정 변경 근거**: D-002 SUPERSEDED 는 §2 에 인용된 사용자 정정 4·5 원문에 근거한다. 이번 검증에서 새 결정 변경 없음.
- **반복된 환경 한계**: egress 차단으로 Electron ABI 재빌드 403 — DB 로드 5파일 red 가 이번에도 베이스라인이다.

## 15. 결론

- **상태: PASS (r1).**
- Product/UX 및 ACTIVE Decision: 충족. D-009·D-010 이 계약·구현·문서 세 층에서 같은 사실을 말하고, 승계한 D-001·D-003~D-007 은 회귀 없이 유지된다.
- AC: **10/10** — 전건 내가 다시 실행하거나 다시 세었다. 자기보고와 일치한다.
- 강제 지점: **17/17** — AC 와 별개로 걸었고 지점 수까지 재계수했다.
- 기준 밖 결함: 없다. 관찰 4건(W1~W4)은 전부 문서·라벨·미관측 축이라 제품 동작을 바꾸지 않는다.
- repository operation checks: 미스매치 1건(W1) — 이번 커밋에서 닫는다.
- 남은 사람 확인: 실 SP 로그인 왕복(§8) · PR merge.
- 다음 단계: INDEX 행을 `verify/PASS` 로 갱신한 뒤 완료 행을 archive 로 옮긴다.
