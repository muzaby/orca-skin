# Verify — 0251-remote-usage-breakdown

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0251-remote-usage-breakdown` |
| 검증자 | Claude Code |
| 일자 | 2026-10-06 |
| 대상 커밋/range | `67010dc0..eff720e7` (r1 구현 1커밋) |
| 구현 전 plan 기준 | `67010dc0` (ΔV1 병합, plan/READY) |
| V mode / 유효 V | `Baseline V: V1` + `Delta V: ΔV1` / `V1 + ΔV1` |
| 검증 기준 plan revision | `a73e0760:V1` · `1bb85139`/`67010dc0:ΔV1` |
| 라운드 | 1 |
| 상태 | **PASS** — 사람 실기 항목 없음(plan §7 주의사항) |
| 자기 검증 여부 | 아니오 — 설계·검증 Claude, 구현 Codex(`Agent: codex`). 그래도 독립 축 X1·X2를 추가했다(§4) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` 변경: 메타 `상태` 1행(`@@ -12`) + `[구현자 기입]` 절(`@@ -800`)만.
- 기준선이 diff로 성립하는가: 예 — 설계 `a73e0760`·`1bb85139`·`67010dc0`과 구현 `eff720e7`이 별도 커밋.
- Decision Ledger · Product/UX · AC · V node/pair · §10 · oracle 변경: 없음.
- 채점 기준: `67010dc0:plan.md` §3·§7·§7-A·§10 + §ΔV1(Δ4 AC′·Δ5 pair·강제 지점 EP-05′·06′·09′·11′·13~16).

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | ΔV1 기준 `0251:V1@a73e0760` — `git cat-file -t a73e0760` = commit |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | ΔV1 R-03·04·07·10, AR-01~03, MD-02·03 → VP-03′·04′·07′·19·12′·13′·14′·17′·18′ |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | R-05·R-08′·R-09·AR-04 → VP-05·08′·09·15 |
| pair별 path·§10 전수·직접 oracle | 유효 | Δ5 pair 표 전 행에 path·EP·oracle 있음 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | 음성·순서·구조 proxy pair에만 M1~M24·음성 probe 2 |
| `SUPERSEDED` pair의 AC·적대 증거 이관 | 유효 | Δ5: M7→M7′, M9 폐기(기대 반전), 기준선 사례 14건 이관 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | §7-A gate 5종 |

- root PLAN_GAP과 영향 pair: 없음.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-001~004·013·017 | 내역 검증 → 기간별 누적·최신 교체, 미제공 쓰기 0 | `refreshProvider` → `normalizeUsageBreakdown`(`breakdown.ts:78`) → `saveProviderUsageReport` transaction(`usage-queries.ts:238`) |
| D-018·019·020 | 원격 칸은 커밋된 원격 값만, NULL→0, SDK 무시 | `usageStats` → `composeUsageStats`(`usage-stats-compose.ts:15`) |
| D-021·022·024 | 월 3단·주 엄격, `baselineUsable` 미사용 | `getProviderUsage` → `providerPeriodCosts` → `composeProviderUsage`(`usage-compose.ts:32`) |
| D-006·012·025 | 전역·원장 로컬, SDK 기록 유지 | `recordTurnUsage` → `recordAndBroadcast` → `globalView`(무변경) |
| D-011 | `supports()` 게이트 | `tracker.ts:145`(provider 뷰) · `tracker.ts:241-245`(사용량 탭 필터) |

```text
cron usage-fetch / cost:refreshUsage → fetchUsage → normalize(throw → 쓰기 0·push 0)
  → transaction{0014 upsert · periods upsert · model set replace} → getProviderUsage → push provider delta
cost:usage → getProviderUsage(supports? → providerPeriodCosts → [days 有] sumUsageByDayForProvider) → compose
cost:usageStats → fetcher 有 → 지원 원격 행 有 ? provider별 로컬 2문 + composeUsageStats : 기존 SQL 2문
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 안전 | 정규화 throw는 save 이전(`tracker.ts:206`), 저장 throw는 transaction 롤백 후 전파 — push는 그 뒤(`:225-226`) |
| false success 가능성 | 없음 | 형식 오류·PK 실패 모두 reject, 세 테이블 동등(통합 테스트 `:206`·`:217`·`:236`) |
| partial failure/rollback | 안전 | M14(transaction 제거) → 롤백 2케이스 red |
| Product/UX의 A가 아닌 B | 아님 | 월 ① `remote?.month?.costUsd ?? monthUsedUsd ?? 0`(`usage-compose.ts:59`) = D-021 원문 |
| 증상만 제거 | 해당 없음 | — |
| 최적화가 잃은 관측 | 없음 | 원격 행 0이면 기존 SQL(EP-08), M12 red |
| 출력/요청 worst-case | 유효 | 스냅샷당 ≤10,000행(`USAGE_BREAKDOWN_LIMITS`) · provider 뷰 조회 +2 이하(AC12′) |

## 3. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh 67010dc..eff720e`

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 값 export `remoteMonthUsed` | 정상 | 같은 파일 `composeProviderUsage`가 호출(`usage-compose.ts:55`); Δ6이 신설을 지정 |
| 테스트 전용 `UsageBreakdownError`·`USAGE_BREAKDOWN_LIMITS` | 정상 | production `breakdown.ts` 내부에서 throw·상한 판정에 사용 |
| 형제 정책 비대칭 | 없음 | 스크립트 §3 0건 |
| 신규 등록값의 기존 소비처 | 무영향 | 0028 빈 테이블 2개, `migrate.test`·append-only green |
| producer ↔ consumer | 일치 | renderer `.source` 소비 0(`rg` 사용량 소비 파일) — 어휘 3값 변경 무영향 |
| 동일 규칙 중복 | SSOT 유지 | 주·월 합이 공용 `sumDays` 1곳, 날짜 키는 `localDayKey`·`localMonthKey`(`stats.ts:45`) |

## 4. 기존 테스트 / semantic 검증 확인

- 선택된 적대 증거 재측정: 등록 기능 변이 29자리 + 음성 probe 2 = 31건 중 검출 31 · 미검출 0. 일반 hunk 자동 확장 0.
- 이전 라운드 대조: 해당 없음(최초 verify).
- 자기검증 분모: 구현자 ≠ 검증자. 독립 축 X1·X2(EP-10 미래 날짜 상한, 보고에 자리별 변이 없음) 추가 — 둘 다 red.
- 실행: 검증자 스크립트가 각 변이를 production 파일에 심고 관련 12파일을 실행한 뒤 원본 복원. 최종 `git status` 빈 트리.

| 변이 (검증자 재현) | 범위 | 결과 | 귀속 |
|---|---|---|---|
| M1 빈 모델 집합도 push | 12파일 | red 3 | VP-01·16 |
| M2 미제공 수치를 0 | 12파일 | red 6 | VP-01·16 |
| M3 중복 기간 허용 | 12파일 | red 2 | VP-01·16 |
| M4 total 미제공을 NULL 행으로 | 12파일 | red 6 | VP-02 |
| M5 total 기간의 모델 삭제 | 12파일 | red 1 | VP-02 |
| M6 delete 생략 + INSERT OR REPLACE | 12파일 | red 2 | VP-02 |
| M7′a monthly 비용↔usedUsd 순서 | 12파일 | red 4 | VP-03′·17′ |
| M7′b 월 ①↔② 단 | 12파일 | red 5 | VP-03′·17′ |
| M8 주 하한 = 주 시작 | 12파일 | red 1 | VP-03′·17′ |
| M9′ 일 NULL을 SDK로 / 모델 NULL을 SDK로 | 12파일 | red 4 / red 5 | VP-04′·18′ |
| M10 SDK 전용 모델 유지 | 12파일 | red 1 | VP-04′·18′ |
| M11 전역 월에 원격 날짜 비용 혼입 | 12파일 | red 2 | VP-05 |
| M12 원격 행 0에도 합성 | 12파일 | red 2 | VP-09 |
| M13 캐시 저장 뒤 정규화 | 12파일 | red 3 | VP-10 |
| M14 transaction 제거(ASI 보정 `;(() =>`) | 12파일 | red 2 | VP-10 |
| M15 provider `supports` 게이트 제거 | 12파일 | red 2 | VP-14′ |
| M16 stats total 필터 / 모델 필터 제거 | 12파일 | red 1 / red 1 | VP-14′ |
| M17 ①에 SDK 월 합 더함 | 12파일 | red 16 | VP-03′·17′ |
| M18 NULL 날짜 칸을 SDK로 | 12파일 | red 3 | VP-03′·17′ |
| M19 compose 날짜 / stats 일 / stats 모델에 SDK 더함 | 12파일 | red 11 / 6 / 5 | VP-19 |
| M20 지원 provider 원장 기록 생략 | 12파일 | red 2 | VP-19 |
| M21 비용 없는 월만 있을 때 SDK 폴백 | 12파일 | red 2 | VP-03′·17′ |
| M22 asOf 없으면 usedUsd 폐기 | 12파일 | red 2 | VP-03′·17′ |
| M23 `baselineUsable !== true`면 usedUsd 폐기 | 12파일 | red 6 | VP-03′·17′ |
| M24 봉투 파싱 실패 시 usedUsd 폐기 | 12파일 | red 1 | VP-12′ |
| 음성: `limits.ts`에 `'remote-baseline'` / `compose`에 `baselineApplies` | AC23′ `rg` | 0 → 1 / 0 → 1 | VP-12′ |
| X1 compose 미래 날짜 상한 제거(독립) | 12파일 | red 2 | VP-03′ EP-10 |
| X2 stats `inRange` 상한 제거(독립) | 12파일 | red 1 | VP-04′ EP-10 |

- M14 첫 시도는 `prepare(...)` 뒤 줄 머리 `(`의 ASI로 호출 오류(18 red)가 되어 판정에서 제외하고 `;`를 붙여 재실행했다(2 red — 구현 보고와 같은 케이스).
- 동작 보존 추출 라운드: 아니오. 소거 변이 잔여물 수렴: 해당 없음(vitest는 타입 진단 없이 실행).
- `N회` 관측 주체: AC12′는 실 SQLite `UsageQueries` 메서드 spy(`tracker-integration.test.ts:435`) — 4모드 호출 수 + 경계 집계 인자 `['p', boundaries(NOW)]`.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right | requiredness | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|---|
| VP-16 | MD-01 ↔ UT-01 | REQUIRED | PASS | `breakdown.test.ts` 미제공·실패·상한 경계 표 · M1~M3 | EP-03 정규화 4 + EP-11′ |
| VP-17′ | MD-02 ↔ UT-02 | REQUIRED | PASS | `usage-compose.test.ts` 월 4갈래·주 창·경계 주·asOf/fetchedAt·호환 3값 | EP-05′ 6/6 · EP-10 |
| VP-18′ | MD-03 ↔ UT-03 | REQUIRED | PASS | `usage-stats-compose.test.ts` 5케이스 · M9′·M10 | EP-06′ 3/3 |
| VP-12′ | AR-01 ↔ IT-01 | REQUIRED | PASS | typecheck · 배포 예제 2종(`deployment-wiring.test.ts:788`) · `rg` 0 · M24 | EP-11′ 2/2 · EP-14 5/5 |
| VP-13′ | AR-02 ↔ IT-02 | REQUIRED | PASS | 실 SQLite 왕복·NULL 보존(`:115`·`:374`) · 0028 등록 | EP-02 3/3 · EP-12 3자리 · EP-16 1/1 |
| VP-14′ | AR-03 ↔ IT-03 | REQUIRED | PASS | 4모드 호출 수(`:435`) · M15·M16 | EP-04 3자리 |
| VP-15 | AR-04 ↔ IT-04 | REGRESSION | PASS | 원장 행 수 불변(`:115`) · tracker `'원격 갱신이 로컬 원장을…'` | 0 + 이유 |
| VP-10 | SD-01 ↔ ST-01 | REQUIRED | PASS | 오류 세 테이블 동등·push 0·PK 롤백 · M13·M14 | EP-01 1/1 · EP-02 3/3 |
| VP-11 | SD-02 ↔ ST-02 | REQUIRED | PASS | 새 tracker fetch 0으로 원격값(`:318`) | 0 + 이유 |
| VP-01 | R-01 ↔ AT-01 | REQUIRED | PASS | AC1~3 · M1~M3 | EP-03 5/5 |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | PASS | AC4~6 실 SQLite(`:115`·`:148`·`:176`) · M4~M6 | EP-02·EP-03 저장 1 |
| VP-03′ | R-03 ↔ AT-03 | REQUIRED | PASS | AC13′ 3시나리오 조회=push(`:251`) | EP-05′·EP-04·EP-10·EP-16 |
| VP-04′ | R-04 ↔ AT-04 | REQUIRED | PASS | AC16′ 7d/30d/all(`:285`) | EP-06′·EP-04·EP-10 |
| VP-05 | R-05 ↔ AT-05 | REGRESSION | PASS | 전역·boundary local(`:318`·`:337`) · M11 | EP-07 1/1 |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | PASS | `git show --stat eff720e7 -- app/src/renderer` 0줄 | 0 + 이유 |
| VP-07′ | R-07 ↔ AT-07 | REQUIRED | PASS | Δ6 음성 스윕 0행 · 자리별 양성(아래) | EP-09′ 10/10 · EP-15 4/4 |
| VP-08′ | R-08′ ↔ AT-08′ | REGRESSION | PASS | compose `:97`·`:103`·`:113`·`:121` · tracker `:215`·`:225`·`:234` · jobs·limits green | 0 + 이유 |
| VP-09 | R-09 ↔ AT-09 | REGRESSION | PASS | 3모드 기존 SQL 동등 + spy 0(`:412`) · M12 | EP-08 1/1 |
| VP-19 | R-10 ↔ AT-10 | REQUIRED | PASS | AC25 원장 +1·세션 비용 13·최신 2·전역 13, 원격 칸 불변/대조 +4(`:337`) · M19·M20 | EP-13 4자리 |

- root `PAIR_FAIL`: 없음 · 종속 `BLOCKED_BY`: 없음.
- 실행 범위: 최초 검증 — 유효 V REQUIRED 15 + REGRESSION 4 = 19 전건.

### AT / AC 세부와 합계

| AC | 결과 | 검증 증거 |
|---|---|---|
| AC1 | ✅ | 호환 리터럴 + 내역 예제 BoundAuth → 정규화(`deployment-wiring.test.ts:789`·`:806`) |
| AC2·AC3 | ✅ | `breakdown.test.ts` 표 · M1~M3 red |
| AC4·AC5·AC6 | ✅ | 실 SQLite `:115`·`:148`·`:176` · M4~M6 red |
| AC7 | ✅ | `:206`·`:217`·`:236` · M13·M14 red |
| AC8 | ✅ | `:115` 원장 행 수 · tracker `:271` |
| AC9′·AC10′·AC11 | ✅ | compose 표 · M7′·M8·M17·M18·M21~M23 red |
| AC12′ | ✅ | `:435` 4모드 · M15 red |
| AC13′ | ✅ | `:251` 3시나리오, push = 조회 |
| AC14′·AC15′·AC16′ | ✅ | stats 표 · `:285` · M9′·M10 red |
| AC17 | ✅ | `:412` · M12 red |
| AC18 | ✅ | `:318` · M11 red |
| AC19′ | ✅ | 기존 사례 green(전체 vitest) |
| AC20 | ✅ | `:318` fetch 0 |
| AC21 | ✅ | `check-migrations-appendonly` sync 28 · `migrate.test` · inventory `--check` |
| AC22′ | ✅ | 음성 스윕 0 · 가이드 `:1168-1263` · `auth.md §8` · IPC §2.12 문단·타입 블록·usage 3행 · persistence 0014/0028 · 코드 주석 4 |
| AC23′ | ✅ | `rg` 4어휘 0 · `baselineUsable` production = `fetcher.ts:56`·`tracker.ts:213` · renderer `.source` 0 · 음성 probe 2 red |
| AC24 | ✅ | renderer diff 0줄 |
| AC25 | ✅ | `:337` 2시나리오 · M19·M20 red |

- 합계 재측정: ✅ 25 · ⚠️ 0 · ❌ 0 = 25(AC9′·10′·11과 AC14′·15′·16′, AC2·3, AC4~6을 행별로 세면 25).
- 합계 사본 대조: plan 구현 보고 25/25 ↔ trailer `Criteria-Met: 25/25` ↔ INDEX `AC 25/25` — 일치.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| lint | PASS | `npm run lint`: 0 error · 1 warning(`useTranscriptVirtualizer.ts:22`, 기존). 실행 후 `git status` 빈 트리 |
| typecheck | PASS | node/web/test 3구성 오류 출력 0 |
| 관련 vitest | PASS | 12파일·245케이스 green(Node ABI 재빌드 후 DB 스위트 포함) |
| 전체 vitest | PASS | 620파일 pass · 1 skip, 6298 pass · 6 skip(아래 §9 환경 분리) |
| migration append-only | PASS | `sync ok … 28 migrations`; 로컬에 `v*` 태그가 없어 append-only 비교는 스크립트가 건너뜀 — 대신 range diff에서 기존 마이그레이션 수정 0 확인 |
| doc inventory | PASS | `generated doc ok (9 items, 102 channels)` · prose·links ok |
| trailer 파싱 | PASS | `git log -1 --format='%(trailers:only=true)' eff720e7` → 6키 |
| 원격 CI | PASS | PR #494 run `37425385848`(head `5564f28a`, 이 커밋 포함) success |

## 7. 숫자 / 음성 기준 / 상한 재측정

- `rg -n "remote-baseline|monthDeltaCostUsd|month_delta_cost_usd|baselineApplies" app/src` = 0(구현 전 26).
- Δ6 음성 스윕(10경로, 테스트 제외) = 0행(구현 전 41).
- `getProviderUsage(` 호출부는 무변경 — AC12′ 단언은 메서드 1회 호출당 쿼리 수라 호출부 수와 무관.
- 상한: daily 400 · monthly 120 · 기간 모델 500 · 행 10,000 경계(=통과, +1 실패) 표가 `breakdown.test.ts:118-146`에 있다.

## 8. 남은 사람 실기

없음 — 기본 배포는 fetcher 미주입이라 화면 경로가 없고 renderer 무변경(AC24). 화면이 받는 값은 같은 tracker 메서드를 실 SQLite 통합 테스트가 관측했다.

## 9. 게이트 재실행

- 명령: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` → `npm run typecheck` → `npm run lint` → `npm rebuild better-sqlite3`(Node ABI) → `vitest run`(전체) → 위생 스크립트 2종 → `node --test scripts/*.test.mjs`(132 pass).
- 환경 분리: 전체 1차 실행에서 8파일이 `Electron failed to install correctly`(바이너리 생략 설치)로 import 실패 — `node node_modules/electron/install.js` 후 같은 8파일 36케이스 green. 변경 무관 환경 서명.
- 게이트가 작업 트리를 바꿨는가: 없음(`lint --fix` 후 `git status` 빈 트리).
- 잔여물: `app/node_modules`(ignored)뿐. 변이 스크립트·로그는 scratchpad.

## 11. Repository operation checks

- INDEX: 상태 `IMPL_DONE`·다음 주체 Claude 일치. 비고 3줄(5줄 이내). 대상 커밋 자리표시자 → 이번 턴 기입.
- 대상 커밋 좌표: `a73e0760`·`1bb85139`·`67010dc0`·`eff720e7` 모두 `git cat-file -t` = commit.
- trailer: `Agent: codex` · `Status: implemented` · `Criteria-Met: 25/25` · `Verified-By: pending` — 허용값, 파싱 6키.
- `[구현자 기입]` 7필드: 설계 리뷰·강제 지점 전수·잠금·Product/UX·놓친 문제·구현 보고·Review Signals 모두 존재.
- AGENTS.md 변경: 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 판단 |
|---|---|
| 배포 예제가 `AuthRequest` text body를 JSON 해석 | 타당 — 구현 세부, 가이드와 테스트가 같은 코드(`deployment-wiring.test.ts:728-786` ↔ 가이드 `:1175-1229`) |
| M4 초기 감도 0 → 시점 단언 보강 | 타당 — 검증자 재현에서도 M4 red 6 |
| AC12′를 가짜 DB 대신 실 SQLite spy로 | 타당 — 같은 메서드 경계에서 호출 수를 관측 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | `monthly` 항목이 `models`만 싣고 `total`이 없으면 월 total 행이 생기지 않아 월 바 ①이 아니라 ②/③으로 간다(`providerPeriodCosts`는 total 행만 읽음). D-021 "monthly 항목"이 total을 뜻하는지 plan에 명시가 없다 | 비귀속(AC9′ 표는 total 있는 항목만 규정) | NON_BLOCKING | 배포가 월 사용액을 주려면 `total.costUsd`를 실어야 한다 — 가이드 "비용 동반" 행이 이미 안내. 필요 시 문구 보강 |
| D2 | `persistence.md` 마이그레이션 표가 0018 다음에 0028 행을 두고 0019~0027 행이 없다(기존 공백) | 비귀속 | NON_BLOCKING | 표는 "현재 목록은 생성 인벤토리"를 링크 — 문서 정리 후보 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 없음(최초 verify).
- 관련 plan 지침/AC: 등록 변이 31자리 모두 plan Δ5에 있었고 전부 red.
- 사용자 결정 변경 근거: ΔV1(구현 전) — Δ1에 원문 인용.
- 반복된 검증 환경 한계: `ELECTRON_SKIP_BINARY_DOWNLOAD` 설치 시 electron import 스위트 8파일 실패 → `install.js`로 해소.

## 15. 결론

- 상태: **PASS**
- pair 결과: REQUIRED 15 · REGRESSION 4 = 19 PASS · PAIR_FAIL 0 · BLOCKED_BY 0
- PLAN_GAP: 없음
- AC: ✅ 25/25
- 운영 gate: lint·typecheck·관련/전체 vitest·migration·inventory·trailer·원격 CI PASS
- NON_BLOCKING: D1·D2
- 남은 사람 확인: 없음 → INDEX 행을 archive로 이동
