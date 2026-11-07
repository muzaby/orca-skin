# Verify — 0298-ci-exe-load-reduction

## 메타

| 항목 | 값 |
|---|---|
| slug | `0298-ci-exe-load-reduction` |
| 검증자 | Claude Code (설계자 = 구현자 = 검증자 — plan validity는 자기 설계 감사) |
| 일자 | 2026-11-07 |
| 대상 range | `9f39f9f..35ff66d` (브랜치 좌표, `main`에 없음 — 병합 뒤 교정) |
| V mode / 유효 V | `Baseline V` / `V1 + ΔV1 + ΔV2 + ΔV3 + ΔV4` |
| 라운드 | 1 → 2 |
| 상태 | **RETURN_TO_PLAN** |
| 확장 창 | verify 1회째 — 창 안. 사용자 요구 변경 ΔV(ΔV2·ΔV4) 노드도 이번 verify가 첫 판정 |
| 독립 축(⑥) | 2축 — (a) 열거 밖 자리 변이(`ioSqlite` 산출·재진입 early-return·`vitest.config` 배선) (b) 저장소별 config 다른 인용 형태 스캔(0건) · 실행 CI 로그 대조 |
| 열거 sweep(⑦) | 1회째 전수 — 변이 57행(+합성 oracle 재실행 17) · 못 잡음 4 |
| 발견 분류 | 이행 2(F1·F3) · 현재 0 · 확장 1(F2, 창 안 → PLAN_GAP) · 동치 1 · 비귀속 0 |

## 0. 기준선 / plan validity

- 기준선: 설계 `9f39f9f`·`1972b16`·`feb240b`·`9e0ff2c`·`fe4eb4e`·`0c962c5`와 구현 `5395937`·`c4c01a2`·`f0ab8e6`·`acb4ac6`가 별도 커밋이다. 구현 커밋의 plan.md 규범 행 변경 없음(`git log -- plan.md` 대조).
- Decision D-002 → D-011 SUPERSEDED·D-009 범위 축소는 사용자 결정(6턴 "Io 병렬, mjs 유지") 근거가 plan에 있다.

| 검사 | 판정 | 근거 |
|---|---|---|
| NEW/CHANGED node ↔ REQUIRED pair | 유효 | VP-01~15 · ΔV1 VP-12 · ΔV2 VP-13(VP-14 폐기 D-009) |
| §10 자리 목록 재검색 | 유효 | `rg -n "id: '" test-pools.mjs` 6 · `rg "violations.push\|afterEach(check)\|afterAll(check)" scripts` 3 · 목록과 차집합 ∅ |
| VP-13 path edge oracle | **PLAN_GAP** | path `env → resolveIoMode → buildProjects({mode, ioSqlite})`의 연결 edge(`vitest.config.ts` 호출 · `partitionTestFiles`의 `ioSqlite` 산출)에 좌표가 없다 — F1 |
| 운영 gate 열거 | 유효 | §7-A 5종 |

## 2~3. 비판적 검토 · 역방향 탐색

- 가드 throw를 production이 삼키는 문제는 D-007 기록·훅으로 닫혀 있다(E3-push·hook-each·hook-all red).
- 신규 export 미배선: `resolveIoMode`·`IO_MODES`·`UNIT_GUARD`는 `vitest.config.ts`·`vitest-unit-guard.mjs`·테스트에서 소비. 죽은 export 없음.
- false success: 실험 모드 오타는 `resolveIoMode`가 로드 실패로 막는다(E2-resolve-bad red).
- Windows 전용 실행(AC7)은 이 환경에서 못 봤다.

## 4. 증거 재측정

- **gate**: `npm ci --ignore-scripts` + `npm rebuild better-sqlite3`(Node ABI) 후 — typecheck 오류 0 · eslint(scripts·src/main/infra) 출력 없음 · `node --test scripts/*.test.mjs` 815/815 · test-budgets 17 suites ok · doc-inventory ok. 작업 트리 변경 없음.
- **AC8 기준선 비교**: 같은 환경(Electron 미설치·Linux)에서 변경 전 `9f39f9f`와 HEAD의 `vitest run` 실패 파일 집합을 `diff` → 동일(29파일·22건, Windows 경로·Electron 미설치). 구현자 보고의 "9파일"과 수는 다르나(환경 차) 집합 동일이 AC8의 기준이다.
- **CI**: run 42233452074 `conclusion: success`, head_sha `acb4ac6` — AC8′ ✅(GitHub API 관측). 러너는 windows-latest라 pwsh가 있으므로 AC7 "pwsh 없는 러너"는 self-hosted 실기 몫이다.
- 합계: 본문 `✅11·⚠️2 = 13`, 커밋 `acb4ac6` trailer `10/13`(AC8′ 대기 시점의 불변 사본) — 사본 불일치, 의도된 시차라 NON_BLOCKING.

### 고장 이력 (mutate.py, 원복 확인 "모든 파일 원문 그대로")

| ID | 자리 | 종류 | 결과 | 잡은 테스트 / 근거 | 분류 |
|---|---|---|---|---|---|
| E1-child·fixture·rungit·runinj·sqlite·tz·forced | `IO_RULES` 7행 | 제거 | 잡음 | `test-pools.test.mjs` classifyTestSource | — |
| E1-sq0~sq5 | `SQLITE` 6분기 | 제거 | 잡음 6/6 | 분기별 입력 | — |
| E1-tzbr·cpimp·strip·f1·f2 | `TIMEZONE` 대괄호·import 형태·주석 제거·`FORCED_IO` 2항 | 제거/다른 값 | 잡음 5/5 | 같은 파일 | — |
| E2-unitpool·iopool·guardsetup·excl·unitgroup·iogroup·iomax | `buildProjects` 기본 필드 | 제거/맞바꿈 | 잡음 7/7 | 'buildProjects — 환경별 필드' · 'ΔV4' 4환경 | — |
| E2-par·serial·serial-grp·sqs-max·sqs-grp·sqs-rest·sqs-swap·resolve-empty·resolve-bad | 모드 분기 | 뒤집기/제거 | 잡음 9/9 | 'io 실측 모드' | — |
| E3-spawn·spawnSync·execFileSync·execSync·dlopen·dlopen-any | 가드 5형태 | 제거/고정 | 잡음 6/6 | 'installUnitGuard' | — |
| E3-push·hook-each·hook-all·drain | 위반 기록·훅·비움 | 제거/뒤집기 | 잡음 4/4(drain은 vitest 포함 oracle에서 red) | `test-pools.test.ts`·afterAll 중첩 실행 | — |
| E7-body·call·key | 홈 정렬 | 제거/고정 | 잡음 3/3 | alignThreadHomedir · hostile | — |
| E4-0~3·write·name | 설정 4키·기록·이름 | 제거/다른 값 | 잡음 6/6 | `test-host.test.mjs`·`hermetic-config.test.ts` | — |
| **E1-iosq** | `test-pools.mjs` `if (reasons.includes('sqlite')) ioSqlite.push` | 제거 | **못 잡음** | `node --test scripts/*.test.mjs` + 2 vitest 스위트 green | 이행(F1) |
| **C-cfg-mode** | `vitest.config.ts` `mode: resolveIoMode()` → `undefined` | 고정값 | **못 잡음** | `test-pools.test.mjs`·`test-time.test.mjs` green | 이행(F1) |
| **E3-reentry** | `installUnitGuard` `if (proc[UNIT_GUARD]) return …` | 제거 | **못 잡음** | 전체 node 테스트 + 2 vitest green | 확장(F2) |
| E2-badmode | `buildProjects` 마지막 `throw` | 호출 대체 | 못 잡음 → 동치 | 유일한 호출자 `vitest.config.ts`는 `resolveIoMode`(목록 밖 throw)를 거쳐서만 부른다 | 동치 |

- 검산: 시도 57(1차) = 잡음 52 · 못 잡음 4 · 동치 1. E3 합성 oracle 행은 `N ; V`의 종료 코드가 V만 반영해 종료 코드를 합치는 형태로 재실행했고 결과 위 표와 같다(최초 green 표시 E3-hook-all·E4-name은 oracle 형태 오류 — 재실행 red).
- ③④ 해당 없음(첫 verify). ⑤ 형제 슬롯: unit/io pool·group·maxWorkers 맞바꿈 포함(E2-iopool·iogroup·iomax·serial-grp·sqs-grp 잡음).

## 판정

| # | 발견 | 분류 | disposition |
|---|---|---|---|
| F1 | VP-13 path edge 2곳 미잠금 — `partitionTestFiles`의 `ioSqlite` 산출(E1-iosq)·`vitest.config.ts`의 `resolveIoMode()`→`buildProjects` 전달(C-cfg-mode). 원문: ΔV2 VP-13 path "env → resolveIoMode → buildProjects({mode, ioSqlite})". 실측 모드가 바뀌어도 어떤 테스트도 red가 아니다 | 이행(path edge) + 그 edge에 좌표가 plan에 없음 | `PLAN_GAP` — 설계자가 두 edge의 oracle 좌표를 VP-13에 고정 |
| F2 | 재진입 early-return이 열거 밖이고 구현자의 "재진입 → 1회 'installUnitGuard'" 축 답변은 이 변이를 잡지 못한다. production은 파일당 setup 1회(isolate)라 동작 차이는 보이지 않았다 | 확장 후보 | `PLAN_GAP` — 채택 또는 경계 선언("setup은 스레드당 1회") |
| F3 | r1.2~r1.4 `[구현자 기입]`이 보고 표 1개뿐이다 — 설계 리뷰·강제 지점 전수 표·잠금 표·Product/UX 파생 검토·놓친 잠재 문제·Review Signals 부재(`handoff-impl` 재구현 턴 일곱 필드) | 이행(운영 gate) | `BLOCKING` — 다음 구현 턴이 필드를 채운다(문서만) |

- **판정: RETURN_TO_PLAN.** PLAN_GAP 2(F1·F2), 이행 결함 F3. 제품 코드 결함(현재 결함)은 못 찾았다 — gate green, 실패 집합 기준선 동일, CI success.
- 설계자 다음 턴: F1 좌표 고정(두 edge에 각 1입력), F2 채택/경계 선언. 이후 구현자가 F1·F3을 닫는다(설계·구현 커밋 분리).
- 사람 몫(기계 불가): AC7 self-hosted 러너(pwsh 없음)에서 잠금 테스트 통과.

## Review Signals

- 같은 증상 선행 없음(첫 verify). 설계자 = 구현자라 `못 잡음` 4건 중 3건이 "열거한 모드 분기 옆의 연결 자리"(§10이 분기만 열거)였다.
- 반복 환경 한계: Linux에서 Windows 전용·Electron 의존 29파일 실패(기준선 동일) · `npm ci --ignore-scripts` 후 better-sqlite3 rebuild 필요.
- 독립 축 발견 3(F1 2 · F2 1) — 이행 2 · 확장 1.
