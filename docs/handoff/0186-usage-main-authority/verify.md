# Verify — 0186-usage-main-authority

## 메타

| 항목 | 값 |
|---|---|
| slug | `0186-usage-main-authority` |
| 검증자 | Claude Code |
| 일자 | 2026-08-12 |
| 대상 커밋 | `546a605`(r1) · `c145261`(r1 문서) · `e0e6a3f`(r2) · `9fd90a6`(r2 문서) · `e2e246a`(r3) · `6886b64`(r4) · **`642e9c9`(r5 문서 동기화)** — 검증 base = `546a605~1`(`a2a3948`) |
| 라운드 | verify **r1**(구현 라운드 4 누적분) → verify **r2**(구현 라운드 5 재검증) |
| 상태 | r1 **FAIL** → **r2 PASS** (아래 §라운드 2 재검증) |
| 자기 검증 여부 | **부분 자기 검증** — 설계·r1·r2 구현 = Claude, r3·r4 구현 = Codex, 검증 = Claude. 설계자와 검증자가 같으므로 §0·§역방향 탐색을 먼저·강하게 적용했다 |

> **FAIL 사유 요약**: 코드는 20개 인수 기준 중 기계 검증 가능한 18건을 전부 충족하고 게이트도
> 깨끗하다. 그러나 **r3 가 `UsageFetcher` 포트에 필수 멤버 `supports` 를 추가하고 r4 가 `null` 의
> 의미를 "정상"에서 "실패"로 뒤집었는데, 그 두 변경이 배포 절차 SSOT(`closed-network-extensions.md`
> §5-b)에 반영되지 않았다.** 지금 그 문서를 따라 배포가 fetcher 를 구현하면 **컴파일되지 않고**,
> 컴파일을 고쳐도 문서가 지시한 실패 처리(`return null` = 다음 틱 대기)가 **런타임에 정반대로
> 동작한다**. 이 작업은 스스로를 "§5-b 의 첫 살아 있는 선례" 로 선언했으므로 이 문서는 부가물이
> 아니라 산출물이다. 함께 발견된 계약 문서 자기모순 1건 + 죽은 심볼 서술 4곳을 같은 라운드에서 닫는다.

---

## 구현 결과 비판적 검토 (수석 엔지니어 관점 — 최우선)

> 인수 기준을 열기 **전에** `git diff a2a3948..HEAD` 를 남의 PR 처럼 통째로 읽은 결과.

| 질문 | 판단 | 근거 / 후속 |
|---|---|---|
| 실환경에서 실패하는 방식 (지연·부분 실패·동시 호출·종료 중·권한 거부) | **원격 상시 실패가 완전히 침묵한다.** `jobs.ts:71-73` 의 `catch {}` 는 로그도 남기지 않고, `Scheduler.invoke` 는 액션이 던지지 않았으므로 `schedule_runs` 에 **`success`** 를 적는다. 폐쇄망에서 "사용량이 왜 안 늘지" 를 확인할 경로가 0이다. 잡 겹침·타임아웃·앱 종료(`stopAll` → `closeDb` 순서)는 기존 계약대로 안전하고, 동시 호출(cron ↔ 수동)은 upsert last-write-wins 라 무해 | **D22**(후속) — `getLogger().child('usage').warn(...)` 한 줄이면 닫힌다 |
| **잘못된 성공(false success)** 이 가능한 경로 | **두 갈래.** ⓐ *닫힘* — r4 가 지원 provider 의 빈 snapshot 을 로컬 폴백 성공으로 접던 경로를 실제로 막았다(`tracker.ts:119`, 테스트가 reject·미저장·미broadcast 를 단언). ⓑ *남음(경미)* — 미지원 provider 에서 동기화 버튼은 로컬 뷰를 성공으로 돌려주고 `providerUpdatedAt` 이 **로컬 수신 시각**으로 갱신돼, 원격이 며칠 죽어 있어도 "방금 업데이트" 로 보인다. 뷰에 원격 신선도(`fetchedAt`)가 실리지 않는다 | **D24**(후속). ⓐ 는 이번 라운드의 가장 값진 수정으로 판단 |
| 되돌릴 수 있는가 (마이그레이션·파일 쓰기·외부 상태) | **예.** 마이그레이션 **0건**(16개 불변, `check-migrations-appendonly` exit 0). 유일한 쓰기는 `provider_usage_report_cache` upsert 이고 **로컬 원장(`turn_usage`·`turn_model_usage`)은 어떤 경로에서도 건드리지 않는다**(테스트가 insert 호출 0을 단언). 합성은 읽기 시점에만 일어난다 | — |
| 설계가 의도한 것을 구현이 실제로 했는가 (비슷한 다른 것 아닌가) | **코어는 그렇다. 배포 계약은 아니다.** 주간 로컬 전량 보존(R1)·fail-closed 게이트·affected-provider 재집계는 설계 문장 그대로다. 그러나 r3·r4 가 `UsageFetcher` 의 **모양과 실패 의미를 둘 다 바꾸고** 절차 문서를 따라가지 않아, 문서가 서술하는 포트와 코드가 요구하는 포트가 다르다 | **미충족 1(D18)** — plan §파생 UX "미인증·사내망 밖은 정상 상태 → 다음 틱 대기" 도 r4 이후 성립하지 않는데 plan 이 개정되지 않았다 |
| 구현자 선조치(✅)가 경계를 넘지 않았나 | **넘지 않았다.** r1 의 D1(신규 파일 3개째 `jobs.ts`)·D2(뷰 2필드 추가)는 인수 기준을 바꾸지 않고 *검증 가능하게* 만든 조치다. r3 의 `supports` 추가는 **내부 포트**(배포가 구현하지만 IPC 공개 계약은 아님)라 선조치 범위로 인정한다 — 다만 그 대가가 문서 동기화였고 그것을 하지 않았다. r4 는 새 Result 계층·의존성 없이 한 지점만 고쳤다(범위 준수) | 신규 의존성 0 · IPC 스키마 변경 0(r3·r4) |

---

## 역방향 탐색 (매트릭스 전 선행)

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh 546a605~1..HEAD` — 대상 30 파일.

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 export `usage-compose.ts::baselineApplies` | **정상(오탐)** — 같은 파일 `:76` 이 소비. 스캐너는 파일 내 참조를 세지 않는다 | `usage-compose.ts:37,76` |
| 테스트에만 등장 `usageStore.ts::useUsageStore`·`reloadProviderUsage` | **정상(오탐)** — 같은 파일의 셀렉터/`ensureProviderUsage` 가 소비 | `usageStore.ts:68-69,100-113` |
| 테스트에만 등장 `jobs.ts::USAGE_BOUNDARY_CRON`·`USAGE_FETCH_CRON`·`UsageJobScheduler`·`UsageJobTracker` | **정상** — 상수는 같은 파일 `:57,78` 이 쓰고, 두 인터페이스는 `registerUsageJobs` 시그니처용 구조적 포트다. `bootstrap.ts:447` 이 실제 소비자 | `jobs.ts:16-25` · `bootstrap.ts:447` |
| **`UsageFetcher` 구현체가 프로덕션에 0개** (`bootstrap.ts:417` `const usageFetcher: UsageFetcher \| undefined = undefined`) | **설계상 정상. 단 한계를 명시한다** — r3·r4 가 고친 원격 경로 전체(`supports` 게이트·실패 전파·빈 snapshot 승격)는 **기본 빌드에서 도달 불가**하고 테스트 + 배포 빌드에서만 실행된다. 그래서 §5-b 문서가 **유일한 프로덕션 진입 경로**이고, 그것이 틀렸다는 사실의 무게가 커진다 | plan §범위 "실 endpoint 는 배포 소유" · AC11 이 미주입 케이스를 명시 검증 |
| 형제 파일 정책 비대칭 | **없음** (스캐너 0건). `handle()` 실패 정책은 읽기=`fallback`/쓰기=`reject` 로 일관 — `costUsage`·`costUsageStats`=fallback, `costRefreshUsage`·`costSetProviderLimit`=reject | `handlers/cost.ts:28-73` |
| (추가) `supports` 이중 검사 — `jobs.ts:66` 과 `tracker.ts:117` | **의도된 중복** — 잡 쪽은 AbortController 생성 자체를 아끼고, tracker 쪽은 manual 경로에도 같은 게이트가 필요하다. 근거 성립 | — |
| (추가) 인수 기준 핵심 동사의 테스트 등장 | `기준선`·`경계`·`무효화`·`영향받은 provider`·`schedule`·`왕복` 전부 테스트 제목에 실재 | `usage-compose.test.ts` 15건 · `jobs.test.ts` 11건 · `tracker.test.ts` 20건 · `usageStore.test.ts` 11건 · `chatReducer.usage.test.ts` 6건 |
| (추가) 문서가 인용한 심볼의 역방향 확인 — **여기서 FAIL 3건이 나왔다** | `rg 'costStore\|ProviderUsageEntry\|cost:summary' docs app/src` 로 죽은 심볼을 거꾸로 훑어 `GLOSSARY.md:44` · 코드 주석 3곳을 찾았고, `UsageFetcher` 를 문서 쪽에서 되짚어 §5-b 예제 결함을 찾았다 | 아래 §미충족 |

---

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 §1 — AC11·AC12 를 `bootstrap.ts` 에서 검증 불가(electron import → P29) → `jobs.ts` 분리 | **타당.** `bootstrap.ts` 가 vitest 대상이 아님을 재확인했고, 분리된 순수 함수가 `register`·`schedule` 양쪽을 fake 로 단언한다. "쓰지 않을 adapter" 와 다르다는 논거도 성립(유일 소비자 `bootstrap.ts:447` 실재) | AC11·AC12 ✅ |
| 이견 §2 — §4-e 를 만족시킬 데이터가 계약에 없어 `budgetSource`·`configuredLimitUsd` 2필드 추가(D2) | **타당.** 뷰 레벨 배치 근거(주간 예산은 월 한도의 일할 파생 → 출처 동일)도 맞다. 다만 **IPC 공개 계약이 늘어난 변경**이라 문서 동기화가 필수였는데, `IPC_CONTRACT.md` 타입 블록은 이 2필드는 반영했고 뒤이은 `boundary` variant 는 놓쳤다 | 미충족 2(D19) |
| 우려 3 — `chatStore` fork 승계 누락(D4) | **타당.** `chatStore.ts:905` 승계 확인 | AC17 주변 회귀 없음 |
| D1~D7(r1) · D8~D14(r2) · D15~D17(r3) · r4 | **전건 코드에서 실측 확인.** D12(설명 정정)·D13·D14(후속 유예)의 근거도 재현됨 | 아래 매트릭스 |
| r3 §"P2 유예 비용" — generation race·Composer loading·`jobs.ts` 이설·snapshot 다이어트는 후속 | **동의.** 셋 다 공개 계약·DB 를 바꾸지 않아 나중 비용이 커지지 않는다. `applyProviderUsage` 가 providerKey 로 키잉하므로 race 가 **다른 provider 를 오염시키지는 않는다**(확인) | 유예 인정 |
| ⚠️ 보고만 항목 | **없었다** — OQ1(사내 endpoint·watermark)은 착수 전부터 사용자 미결로 분리돼 있고 `baselineUsable:false` 로 파라미터화됐다 | 사용자 결정 대기(비차단) |

---

## 요구사항 충족 매트릭스

> 구현 보고의 `Criteria-Met` 을 증거로 쓰지 않았다. 각 기준의 테스트를 직접 열어 제목이 아니라
> **단언 내용**을 확인했고, 인용 수치는 재측정했다.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 턴 종료 시 global 1회 + 해당 provider 1회 (목록 스캔 0) | ✅ | `subscriber.ts:63` → `tracker.ts:54-64`. **테스트** `subscriber.test.ts` 3건 — fake db 호출 횟수 + `providerKey` 없는 턴은 전역만 |
| 2 | renderer 사용량 모듈이 정해진 채널만 부르고 삭제된 hook 3개가 없다 | ✅ **(D10 으로 개정됨)** | `rg costApi. usageStore.ts` → `usage`·`onUsage`·`refreshUsage`·`setProviderLimit`. **plan 본문의 "두 채널만" 은 r2 의 `refreshUsage` 신설로 낡았다**(D25). 삭제는 확인 — `features/cost/{hooks,store}` 디렉토리 부재 |
| 3 | `as_of` 가 이번 주 안이어도 `week` 온전 + 같은 행에서 `monthDelta` (R1) | ✅ | **실 DB 테스트** `queries.test.ts:746` — week=7(전량), monthDelta=4(asOf 이후만). WHERE 하한이 `monthStart` 로 유지됨을 `queries.ts:309` 에서 확인 |
| 4 | 기준선 + `as_of` 이후 증분, `source==='remote-baseline'` | ✅ | `usage-compose.ts:86-97` · **테스트** `usage-compose.test.ts:47` |
| 5 | `baselineUsable` 미지정이면 기준선 미사용 (fail-closed) | ✅ | `usage-compose.ts:42` (`!== true`) · **테스트** `:57`·`:64`(false)·`:71`(필드 결손) 3분기 |
| 6 | `as_of` 가 지난달이면 폐기, `source==='local'` | ✅ | `usage-compose.ts:45` · **테스트** `:80` |
| 7 | 기준선을 못 써도 `budget` 은 원격 한도 | ✅ | `usage-compose.ts:67-68`(게이트 **밖**에서 계산) · **테스트** `:88`·`:101`(폴백) |
| 8 | `week.source` 항상 `'local'` | ✅ | `usage-compose.ts:81,95` · **테스트** `:107` |
| 9 | 전역 조회는 원격을 보지 않고 `spendingLimitUsd` 파생 | ✅ | `usage-compose.ts:50-56` · **테스트** `:143` + `tracker.test.ts:143` |
| 10 | refresh 전후 로컬 원장 행 수 불변 | ✅ **(대리 검증)** | `tracker.test.ts:255` 는 행 수가 아니라 **원장 insert 호출 0회**를 단언한다 — 더 강한 형태지만 fake db 기준이다. 실 DB 행 수 대조는 아님을 명시 |
| 11 | fetcher 미주입이면 `usage-fetch` 가 register·schedule 어느 쪽도 안 됨 | ✅ | `jobs.ts:61` · **테스트** `jobs.test.ts:79` — `register`·`schedule` 인자 **양쪽** 단언 |
| 12 | `usage-boundary` 는 `schedule` 까지 호출 (P0-5) | ✅ | `jobs.ts:56-57` · **테스트** `jobs.test.ts:48`(schedule 단언)·`:62`(cron 값)·`:69`(**`refreshBoundary` 호출** — r2 회귀 잠금). `applySettings` 가 이 잡을 덮지 않음을 `scheduler.ts:61-72` 에서 재확인 |
| 13 | 좌표 조인이 기존 `findLlmProvider` 재사용 (신규 파생 0) | ✅ **(기준 문구는 약함)** | `rg providerKeyOf src/main/app/` → **0건**(실행함). 다만 `rg findLlmProvider src/main/app/` → 2건은 **둘 다 주석**이다. *실질* 재사용은 `bootstrap.ts:45,453` 의 `llmProviderKey` — 신규 파생 구현이 없다는 요구는 충족하나, **AC 의 grep 술어가 주석에도 걸리는 형태**였다(P30 계열) |
| 14 | 0014 왕복(upsert→read) 실 DB 성립 | ✅ | **실 DB 테스트** `queries.test.ts:807`(왕복)·`:836`(재수집 upsert 1행). 고아 해소 확인 |
| 15 | 마이그레이션 16개 불변 + append-only 통과 | ✅ | `node scripts/check-migrations-appendonly.mjs` → `sync ok: 16 migrations` (직접 실행) · `ls migrations/*.sql | wc -l` = **16** |
| 16 | `CHANNELS` 실측 = `inventory.md` 채널 수 | ✅ | `CHANNELS` 키 실측 **76** ↔ `inventory.md:13` **76** ↔ `check-doc-inventory.mjs --check` **exit 0**. cost 채널은 5(=`usage`·`usageEvent`·`refreshUsage`·`setProviderLimit`·`usageStats`) — plan 의 "5→4" 는 D10 의 `refreshUsage` 신설로 5 유지 |
| 17 | telemetry 시점 provider 고정, provider 선택만으로는 불변 | ✅ | `chatReducer.ts:466-473` · **테스트** `chatReducer.usage.test.ts` 6건(SET_MODEL 불변·턴 도중 전환·컨텍스트 0 턴·세션 복원) |
| 18 | ko/en i18n 리프 키 일치 + 빈 값 없음 | ✅ | `resources.test.ts` green(전체 스위트 통과) · `accountLimitApplied` ko/en 양쪽 존재 |
| 19 | 자정을 넘겨도 주/월 바가 새 기간 반영 | ⏸ **사람 실기** | 기계 검증은 계약까지만 — `jobs.test.ts:69`(경계 액션이 `refreshBoundary`) + `tracker.test.ts:119,134`(boundary delta 1건·provider 재집계 없음) + `usageStore.test.ts:94,107`(mirror 무효화·재조회). **croner 실발화와 effect 재조회는 미검증** |
| 20 | 모델 전환 후 새 턴 없이 도넛 값 유지 | ⏸ **사람 실기** | reducer 계약은 AC17 로 잠겼으나 렌더 경로(`useUsageForTelemetryProvider`)는 hook 렌더 테스트가 없다(jsdom·testing-library 미도입) |

**충족 = 18/20 기계 검증 통과, 2건 사람 실기 대기.** 인수 기준만 보면 통과지만, 아래 미충족 4건은
**어느 기준에도 걸리지 않는 결함**이라 역방향 탐색으로 잡았다(SKILL §1 의 존재 이유).

---

## 검증 책임 분리 (사람 vs 에이전트) — 정본 표

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행 + 출력 | — | lint 0 error/1 warn · typecheck 3/3 · vitest 1,779/1,779 |
| 인수 기준 ↔ 코드 1:1 대조 | ✅ 증거(`파일:라인` + 테스트 단언) | 이견 시 중재 | 18/20 |
| 레이어 경계(eslint-boundaries) 위반 0 | ✅ | — | 0 (lint error 0) |
| 문서 형식/링크/한국어 컨벤션 | ✅ | — | `check-doc-inventory --check` links ok / **내용 정합은 FAIL 3건** |
| 배포 절차 문서(§5-b)가 실제로 컴파일되는가 | ✅ 정적 대조 | — | **불가 — 미충족 1** |
| 자정 경계 실발화 · 도넛 시각 확인 | ✖ | ✅ | AC19·AC20 대기 |
| 원격 fetcher 를 꽂은 배포에서의 동작(인증·타임아웃·응답 매핑) | ✖ 코어 계약까지만 | ✅ | OQ1 확정 후 실기 |
| PRD §11 / TRD §15 Open Questions (OQ1 — `as_of` 가 watermark 인가) | ✖ 단독 결정 금지 | ✅ 결정 | 사람 확인 대기 (비차단) |
| PR 머지 승인 | ✖ | ✅ | — |

---

## 게이트 재실행 결과

```
$ cd app && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci          # exit 0
$ npm run lint
  ✖ 1 problem (0 errors, 1 warning)     ← useTranscriptVirtualizer(0102 베이스라인)
$ npm run typecheck                      # node + web + test = 3/3, exit 0
$ ./node_modules/.bin/vitest run
  Test Files  5 failed | 193 passed (198)
  Tests      42 failed | 1737 passed (1779)
      → 실패 전량 `Module did not self-register: better_sqlite3.node` (Electron ABI)

$ npm rebuild better-sqlite3             # Node ABI 로 전환 (app/AGENTS.md DO ✅)
$ ./node_modules/.bin/vitest run
  Test Files  1 failed | 197 passed (198)
  Tests      1779 passed (1779)
      → 유일한 실패는 **테스트 실패가 아니라 로드 실패**:
        src/main/app/chat-turn.continuity.test.ts
        Error: Electron failed to install correctly  (egress 차단, 변경 무관)

$ ./node_modules/.bin/vitest run --exclude 'src/main/app/chat-turn.continuity.test.ts'
  Test Files  197 passed (197)
  Tests      1779 passed (1779)          ← 베이스라인 제외 시 **0건**

$ node scripts/check-migrations-appendonly.mjs   # sync ok: 16 migrations
$ node scripts/check-doc-inventory.mjs --check   # generated ok(9 items, 76 channels) · prose ok · links ok
```

**환경 기인 분리**: ABI 재빌드 전 red 5파일/42건은 전부 DB 인스턴스화 스위트였고, `npm rebuild
better-sqlite3` 후 **전량 green** 이 되어 코드 무관임이 실증됐다(추론이 아니라 재현으로 분리). 남은
1파일은 `electron` 모듈 자체를 못 여는 로드 실패로, 이 저장소의 알려진 egress 베이스라인이다.

**재측정한 수치** (SKILL §3 — 구현 보고를 승계하지 않음):

| 항목 | 구현 보고 | 재측정 | 판정 |
|---|---|---|---|
| 전체 변경 (r1~r4) | — | **55 파일 · +2,717 / −444** | — |
| r1 커밋 diffstat | 51 파일 · +2,187/−447 | 51 파일 · **+2,219 / −447** | 파일 수 일치, 삽입 32줄 차 (경미) |
| `app/src` 신규/삭제 | 신규 9 · 삭제 4 | **신규 11**(프로덕션 5 + 테스트 6) · **삭제 4** | 프로덕션 신규 5 = 설계 3 + D1(`jobs.ts`) + D5(`useUsageForTelemetryProvider.ts`), 둘 다 문서화된 정정 |
| 테스트 총계 | 1,772(r2) | **1,779** (r3 +5 · r4 +2) | 일치 |
| IPC 채널 | 76 | **76** (`CHANNELS` 키 실측) | 일치 |
| 마이그레이션 | 16 | **16** | 일치 |

---

## 위생 검토

- `AGENTS.md` 변경 **없음**(이번 범위에 포함되지 않음) — 키/토큰/이메일/IP 스캔 대상 없음.
- 신규 의존성 **0**, DB 마이그레이션 **0**, `contracts/provider.ts` 무변경(0183 r2 의 "선언 슬롯
  금지" 유지) — 전부 확인.
- `bootstrap.ts` 의 배포 예제 주석에 실 endpoint·호스트명이 들어가지 않았다(`'/api/usage'`·
  `'corp-gateway'` 는 플레이스홀더).

## INDEX 보드 정합성

- 보드의 대상 커밋 해시(`c159e13`·`0007b7e`·`3ed13af`·`51ad538`)가 **현재 브랜치에 존재하지
  않는다** — 이 브랜치의 실제 커밋은 `546a605`·`c145261`·`e0e6a3f`·`9fd90a6`·`e2e246a`·`6886b64`
  다(리베이스/재적용 흔적). 검증 커밋에서 실제 해시로 정정한다.
- 라운드 표기: 구현 라운드가 이미 **4** 라 `AGENTS.md` 의 "라운드 3 초과 → 에스컬레이션" 조건에
  걸린다. 다만 r2~r4 는 verify FAIL 이 아니라 **외부 PR 리뷰(#329·#330)** 로 열린 라운드이고,
  이번이 **첫 verify** 다 — 이 사실을 보드에 명시하고 사용자 판단을 구한다(아래 §결론).

---

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: ⓐ **AC13 의 검증 수단이 grep 이라 주석에도 걸린다** — `rg findLlmProvider
  src/main/app/` 는 실제로 주석 2건만 잡았고 기준은 "통과" 했다. 0180 D3(P30)이 지적한 것과 같은
  형태가 재발했다: *심볼의 존재*가 아니라 **호출부의 존재**를 세는 술어여야 했다.
  ⓑ **plan 이 "배포가 구현할 포트" 의 문서 동기화를 인수 기준에 넣지 않았다.** 0181·0182·0183 은
  문서를 AC 안에 뒀는데(AC10~14), 0186 은 문서 5건을 §범위에만 적고 AC 로 잠그지 않았다 — 그래서
  r3 가 포트 모양을 바꿨을 때 아무 기준도 울리지 않았다.
- **구현 단계**: r1·r2 는 선조치 경계를 잘 지켰고 설계를 그대로 받아쓰지 않았다(D1~D14 가 증거).
  r3·r4 는 **코드 품질은 높으나 "내가 바꾼 계약을 누가 읽는가" 를 묻지 않았다** — `UsageFetcher`
  의 유일한 독자는 배포자이고 그 독자가 읽는 문서가 §5-b 하나뿐인데, 포트 시그니처와 실패 의미를
  둘 다 바꾸고 그 문서를 열지 않았다.
- **검증 단계 — 이번 verify 가 못 본 것**:
  - **hook 렌더를 검증하지 못했다.** `useUsageForTelemetryProvider`·`ProviderUsageTab` 의 effect
    의존(`[providerKey, provider]`)이 실제로 재조회를 트리거하는지는 **코드 리뷰로만** 봤다
    (jsdom·testing-library 미도입, vitest 가 `environment:'node'` + `*.test.ts` 만 수집). 대리
    검증한 것은 **store 계약**(`usageStore.test.ts:94,107`)이고, 그것이 재조회를 증명하지는 않는다.
  - **croner 실발화를 검증하지 못했다.** `schedule('0 0 * * *')` 호출까지만 단언되고 자정에 실제로
    깨어나는지는 사람 실기(AC19) 몫이다.
  - **원격 경로를 실행해 보지 못했다.** fetcher 구현체가 프로덕션에 0개라 r3·r4 의 수정은 전부
    fake 를 통한 검증이다. 실 endpoint 의 인증·타임아웃·응답 매핑은 OQ1 확정 후 사람 몫.
  - **§5-b 예제를 실제로 컴파일해 보지 않았다.** 결함은 정적 대조로 찾았으나, 0181 5단계-e 가
    확립한 "예제를 실제 파일에 채워 typecheck 를 통과시킨 뒤 되돌린다" 를 이번에 돌리지 않았다 —
    재구현 라운드에서는 그 절차로 확인할 것을 미충족 1에 적었다.

---

## [FAIL] 미충족 요구사항 (구현자 액션 아이템)

- [ ] **미충족 1 (D18) — 배포 절차 SSOT 가 현재 포트와 어긋난다.**
      `docs/guides/closed-network-extensions.md:620-632` 의 "살아 있는 선례" 예제를 고친다.
      ⓐ `supports(providerKey: string): boolean` 이 **필수 멤버**가 됐다(`fetcher.ts:51`) — 예제에
      없어 그대로 쓰면 TS2739 로 컴파일되지 않는다. ⓑ `if (!res.ok) return null // 미인증·사내망
      밖은 정상 상태다` 는 **r4 이후 거짓**이다 — 지원 provider 의 `null` 은
      `tracker.ts:119` 가 Error 로 승격해 manual 은 reject, cron 은 침묵 삼킴이 된다. "지원 여부는
      `supports` 로, 이번 틱 실패는 throw/null 로" 라는 새 규약을 문장으로 적는다.
      ⓒ **검증 방법**: 0181 5단계-e 선례대로 예제를 실제 `bootstrap.ts` 에 채워 `npm run typecheck`
      3/3 을 통과시킨 뒤 되돌린다.
      ⓓ 같은 이유로 plan §파생 UX 의 "미인증·사내망 밖 … 오류로 올리지 않고 다음 틱을 기다린다" 를
      현행 의미로 개정한다.
- [ ] **미충족 2 (D19) — `docs/IPC_CONTRACT.md` 가 자기모순이다.**
      `:320-322` 의 `UsageDelta` 타입 블록에 r2 가 추가한 `{ scope: 'boundary'; value }` variant 가
      없다. 같은 문서 `:277` 채널 행은 3-variant 를 서술한다. 이 문서만 읽고 consumer 를 짜면
      `boundary` 를 처리하지 않아 **D8 이 고친 자정 stale 버그를 그대로 재현**한다.
- [ ] **미충족 3 (D20) — `docs/GLOSSARY.md:44` 가 삭제된 심볼을 정본으로 서술한다.**
      "실사용 SSOT(UsageTracker/**costStore**)에서 `computeUsageLimits` 로 파생만" — `costStore` 는
      이번에 삭제됐고 파생 위치도 renderer → **main** 으로 옮겼다. 현재 구조로 문장을 고친다.
- [ ] **미충족 4 (D21) — 죽은 심볼을 가리키는 코드 주석 3곳.**
      `features/chat/components/Composer.tsx:49`("page 가 실사용 SSOT(costStore)+월 한도로 공용
      파생해 주입") · `features/chat/components/UsagePanel.tsx:12` · `src/shared/protocol.ts:530`.
      셋 다 **폐기된 renderer 파생 모델**을 현재형으로 설명한다 — plan 이 두 컴포넌트를 "손대지
      않음" 으로 뒀기 때문에 남았다.

> **후속(비차단) 파생 이슈 D22~D25 는 plan 의 "파생 이슈" 챕터로 이관했다** — 이번 FAIL 의 조건이
> 아니다. 요지: D22 원격 실패의 완전 침묵(로그·`schedule_runs` 둘 다 `success`) · D23 동기화 실패의
> UI 무표시 · D24 "마지막 업데이트" 가 원격 신선도가 아님(+ 미지원 provider 의 성공처럼 보이는
> 동기화) · D25 plan AC2 문구가 D10 이후 낡음.

---

## 결론 / 다음 단계

- 상태: **FAIL** → 구현자 재구현(구현 라운드 5). 미충족 4건은 전부 **문서·주석**이며 코드 동작
  변경이 없다 — 예상 diff 는 수십 줄이다. 코어 구현 자체는 이번 검증에서 결함을 찾지 못했고,
  게이트·테스트·레이어 경계·되돌림 가능성 모두 양호하다.
- **에스컬레이션 표기(사용자 판단 요청)**: 구현 라운드가 이미 4라 `docs/handoff/AGENTS.md` 의
  "라운드 3 초과" 조건에 해당한다. 다만 r2~r4 는 verify FAIL 이 아니라 외부 PR 리뷰가 연 라운드이고
  이번이 첫 verify 다. **전제를 의심할 지점은 발견되지 않았다** — 설계 축(Main 정본화 · 기준선
  fail-closed · affected-provider 재집계)은 4라운드 내내 흔들리지 않았고, 라운드가 늘어난 이유는
  *원격 경로가 프로덕션에서 실행되지 않아 리뷰·테스트로만 의미 충돌을 발견할 수 있었기 때문*이다.
  그 구조적 한계는 OQ1(사내 endpoint 실값)이 닫히기 전까지 유지된다.
- 사람 몫으로 남는 것: AC19(자정 경계 실기) · AC20(모델 전환 후 도넛) · OQ1 결정 · 원격 fetcher 를
  꽂은 배포에서의 실동작.

---

# 라운드 2 재검증 (구현 라운드 5 — 문서·주석 동기화)

| 항목 | 값 |
|---|---|
| 대상 커밋 | `642e9c9` |
| 일자 | 2026-08-12 |
| 판정 | **PASS** |
| 범위 | r1 의 미충족 4건(D18~D21)만. 사용자가 제시한 PR #331 평가서의 경량 수정 권고를 따랐다 |

> r1 본문은 **지우지 않는다** — 무엇을 놓쳤고 왜 놓쳤는지가 이 문서의 값이다. 아래는 그 위에
> 덧붙이는 재검증이다.

## 미충족 4건 재대조

| # | r1 미충족 | 재검증 증거 | 판정 |
|---|---|---|---|
| **D18** | §5-b 예제에 `supports` 없음 + `null` 의미 반대 | `closed-network-extensions.md:620-654` — 예제에 `supports` 추가, `if (!res.ok)` 가 **throw** 로 바뀜. 세 상태(`supports:false` / 스냅샷 / `null`·throw)와 호출자별 실패 정책(cron=fail-soft · manual=reject)이 표로 고정됐고, "`null` 을 정상의 뜻으로 쓰지 않는다 — 그건 `supports:false` 의 자리다" 를 명문화. **`bootstrap.ts:401-416` 쌍둥이 주석도 같은 내용으로 정정**(배포가 실제 편집하는 파일) | ✅ |
| **D19** | `UsageDelta` 타입 블록에 `boundary` 없음 | `IPC_CONTRACT.md:320-323` ↔ `shared/usage/limits.ts:52,53,60` **3 variant 일치**(기계 대조: `rg "scope: '"` 양쪽 3건). 설명은 같은 문서 `:277` 채널 행에 두고 타입 블록은 한 줄 포인터만 — 사실 복제 회피(`docs/AGENTS.md` 3항) | ✅ |
| **D20** | `GLOSSARY.md` 가 삭제된 `costStore` 를 SSOT 로 서술 | 해당 행에서 `costStore` 제거(한도 = **예산 축**으로만 재정의) + **`사용량 정본(UsageLimitsView)` 표제어 신설** — Main 이 만들고 renderer 는 mirror 만 한다는 소유 구조를 개념 수준으로 서술 | ✅ |
| **D21** | 죽은 심볼을 가리키는 주석 3곳 | `Composer.tsx:49-50` · `UsagePanel.tsx:12-13` · `protocol.ts:530` 전부 현행화. 컴포넌트 로직·prop 구조·hook 은 무변경 | ✅ |

## 이번 라운드의 기계 검증 — 문서 검증 2층 (shape + semantics)

> **정정(사용자 지적, 2026-08-12)**: 이 절은 처음에 compile-backed 검증을 "D18 재발을 막는 **유일한**
> 기계 장치" 로 적었다. **틀렸다.** `fetchUsage` 의 반환형이 `Promise<UsageSnapshot | null>` 이라
> `if (!res.ok) return null` 예제는 **그대로 컴파일된다** — typecheck 는 포트의 *모양*만 보고
> *실패 의미*는 보지 못한다. D18 은 실제로 두 종류였다: **구조 드리프트**(`supports` 누락 → TS2739 로
> 잡힘)와 **의미 드리프트**(`null`=정상 서술 → 컴파일로 안 잡힘). 아래를 2층으로 다시 적는다.

### A. shape — 예제를 실제 타입에 대입 (실행함)

```
1. 고친 §5-b 예제를 bootstrap.ts 의 usageFetcher 자리에 실제 코드로 삽입
   (+ toSnapshot stub, findLlmProvider/UsageSnapshot import)
2. npm run typecheck   → typecheck:node · typecheck:web · typecheck:test 3/3 PASS
3. 되돌림 → const usageFetcher: UsageFetcher | undefined = undefined
4. git diff 필터로 주석 외 변경 0줄 확인
```

**이 층은 r1 에서 돌지 않았다** — r1 은 결함을 정적 대조로 찾았고 "재구현 라운드에서 이 절차로
확인할 것" 을 미충족 1에 적었다. 이번에 실제로 돌렸고 통과했다.

**A 가 잡지 못하는 것**: 고치기 전 예제에 `supports` 만 채우고 `if (!res.ok) return null` 을 그대로
뒀어도 **typecheck 는 통과한다**(반환형이 `Promise<UsageSnapshot | null>`). 즉 A 는 D18 의 절반만
검사한다.

### B. semantics — 문서 설명 ↔ contract test 대조 (실행함)

| 문서가 말하는 것 (`§5-b` 상태 표) | 그 의미를 잠그는 테스트 |
|---|---|
| `supports === false` → 캐시가 있어도 로컬/설정값으로 접는다 | `tracker.test.ts::"현재 미지원 provider 면 과거 cache row 를 무시한다"` · `::"미지원 provider 는 fetch 와 cache write 를 건너뛴다"`(resolve `null`) |
| `supports === true` + 스냅샷 → upsert + 그 provider delta 1건 | `tracker.test.ts::"갱신 후 해당 provider delta 만 push 한다"` · `::"성공 시 provider 를 한 번 집계하고 broadcast value 를 반환한다"` |
| `supports === true` + `null`/throw → **이번 갱신 실패** | `tracker.test.ts::"지원 provider 의 fetch 가 null 이면 실패로 올리고 상태를 갱신하지 않는다"`(reject·미저장·미broadcast) · `::"fetch 오류를 caller 에 전달하고 저장하지 않는다"` |
| 주기 잡 = fail-soft / 수동 = reject | `jobs.test.ts::"한 provider 실패를 삼키고 다음 provider 를 계속 갱신한다"` · `handlers/cost.ts:44-54` 의 `'reject'` 정책 |

**네 줄 전부 대응 테스트가 실재한다** — 고친 문서가 코드의 실패 의미와 일치한다. 이 대조를
했기 때문에 A 만 돌고 넘어갔을 때 남았을 의미 드리프트가 없다고 말할 수 있다.

> 이 2층 규칙은 `failure-patterns.md` **P36** 이 갖는다(SSOT). 0186 plan 에는 요약 + 링크 + AC21 만 둔다.

## 역방향 스캔 재실행

| 스캔 | 결과 |
|---|---|
| `rg "costStore\|computeProviderUsageLimits" docs app` (archive·handoff·etc 제외) | **0건** |
| `rg "ProviderUsageEntry\|cost:summary\|providerSummaries" docs app` | 잔존 6건 전부 **"0186 에서 제거됐다/흡수했다" 는 과거형 마이그레이션 서술** — 현재형 계약 서술 0건 |
| `UsageDelta` variant 3종 ↔ 문서 | 일치 |

## 게이트 — r1 과 동일해야 한다 (문서 변경의 자기 증명)

```
npm run lint          ✖ 1 problem (0 errors, 1 warning)   ← useTranscriptVirtualizer, 0102 베이스라인
npm run typecheck     3/3 PASS
./node_modules/.bin/vitest run
                      Test Files  1 failed | 197 passed (198)
                      Tests       1779 passed (1779)
                      → 유일한 실패는 chat-turn.continuity 의 electron 로드 실패(egress 베이스라인)
node scripts/check-migrations-appendonly.mjs   sync ok: 16 migrations
node scripts/check-doc-inventory.mjs --check   generated ok(9 items, 76 channels) · prose ok · links ok
```

**r1 대비 변동 0** — 파일 수·테스트 수·채널 수·마이그레이션 수가 전부 같다. 실행 코드를 건드리지
않았다는 주장의 기계적 근거다(주장이 아니라 재측정).

## 남는 것 (사람 몫 — 이번 라운드가 바꾸지 않았다)

| 항목 | 상태 |
|---|---|
| AC19 자정 경계 실기 · AC20 모델 전환 후 도넛 | **사람 실기 대기** — egress 차단으로 `npm run dev` 불가(0019·0102·0180 AC9 선례) |
| OQ1 — 사내 endpoint 실값 + `as_of` 가 billing watermark 인지 | **사용자 결정 대기**(비차단 — `baselineUsable:false` 로 동작) |
| 원격 fetcher 를 꽂은 배포에서의 실동작 | 코어 계약까지만 기계 검증 · 실기는 배포 몫 |
| 후속 D22~D25 | **plan 파생 이슈 챕터에 `후속` 으로 보존**(사용자 결정 — 새 핸드오프를 만들지 않는다) |

## 검증 자기 리뷰 (r2)

- **이번에도 hook 렌더는 못 봤다** — 이번 라운드가 renderer 로직을 바꾸지 않았으므로 r1 의 한계가
  그대로 유효하다(jsdom·testing-library 미도입). 새로 생긴 사각지대는 없다.
- **문서 수정을 "읽어서" 검증하지 않았다는 점이 r1 과의 차이다.** §5-b 는 컴파일 + contract test
  대조로, `UsageDelta` 는 기계 대조로, 죽은 심볼은 grep 으로 확인했다. 남은 육안 판정은 GLOSSARY
  문장의 *적절성* 하나다.
- **처음 쓴 검증 규칙이 과했다(사용자 지적으로 정정).** "컴파일해 보는 것이 유일한 기계 검증" 이라
  적었으나 **typecheck 는 shape 만 본다** — `return null` 의 잘못된 의미 설명은 그대로 통과한다.
  이 과장을 4곳(P36 · plan 구현 보고 · 본 절 · INDEX 아카이브 행)에 복제해 뒀던 것도 함께 고쳤다.
  **검증 규칙을 쓸 때 "무엇을 못 잡는가" 를 같이 적지 않으면 규칙 자체가 다음 라운드를 오도한다.**
- **되먹임**: 이번 실패 유형은 `handoff-plan` 스킬의 `references/failure-patterns.md` 에 **P36**
  ("배포가 구현할 포트를 만들면서 그 포트의 문서를 인수 기준에 넣지 않았다")으로 축적했고, 위
  정정에 따라 **A(shape=typecheck 대입) + B(semantics=contract test 대조) 2층**으로 다시 썼다.
  P36 이 그 규칙의 SSOT 이고 plan·verify 는 링크만 한다 — 문서 드리프트를 고치면서 같은 규칙을
  네 곳에 복제하면 그것이 다음 드리프트다.

## 결론

**PASS.** 인수 기준 18/20(기계) + r1 미충족 4건 해소. 0186 종료 — INDEX 행은
`docs/archive/handoffs/INDEX-history.md` 로 옮기고, 후속 D22~D24 는 plan 파생 이슈 챕터가 갖는다.
