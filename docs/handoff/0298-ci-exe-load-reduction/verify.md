# Verify — 0298-ci-exe-load-reduction

# Round 2 (2026-11-08)

## 메타

| 항목 | 값 |
|---|---|
| slug | `0298-ci-exe-load-reduction` |
| 검증자 | Claude Code (설계자 = 검증자 — plan validity는 자기 설계 감사. 구현 주체 Codex) |
| 대상 range | 설계 `d75f6c82`(ΔV5) · 구현 `9a994021`(r2) · `8189f647`(Windows CI 기록) — 브랜치 좌표, `main`에 없음 |
| V mode / 유효 V | `Baseline V` / `V1 + ΔV1 + ΔV2 + ΔV3 + ΔV4 + ΔV5` |
| 라운드 | 2 → 종료 |
| 상태 | **PASS** (기계 범위 — AC7 self-hosted 실기는 사람 몫) |
| 확장 창 | verify 2회째 — 창 안. ΔV5 NEW·CHANGED 노드(MD-01·03·06, R-06)도 이번이 첫 판정 |
| 독립 축(⑥) | 3축 — (a) config·정렬·trim·재설치 변이 6행 (b) 실제 vitest unit 풀에 신호 없는 probe 파일 2개 (c) strace로 exe 수 독립 재측정 |
| 열거 sweep(⑦) | diff가 닿은 항목 + 직전 실패 — 구현자 spec 64행 전수 재실행 · 못 잡음 0 |
| 발견 분류 | 이행 0 · 현재 0 · 확장 0 · 경계 0 · 비귀속 0 · 저장소 운영 1(INDEX 좌표, 검증자가 교정) |

## 0. 기준선 / plan validity

- 구현 커밋의 `plan.md` 변경은 추가만이다 — `git diff d75f6c8..HEAD -- plan.md`의 삭제 줄 0. Decision·AC·V·§10 규범 행 무변경. 설계(`d75f6c82`)와 구현(`9a994021`)이 별도 커밋이다.
- 채점 기준: ΔV5 §7-F(VP-13 분기 5 + edge 5, VP-03 R1·R2, VP-01 forced 1, VP-16 표지 3, 의무 1~6).
- plan validity 유효: VP-13 edge마다 좌표가 있고, 자리 검색 `rg -n "UNIT_GUARD\]" app/scripts/test-pools.mjs` 2줄 · `rg -n "test.ts':"` 1줄 · `rg` 표지 3줄이 고정 목록과 차집합 ∅.

## 4. 증거 재측정

| 항목 | 관측 |
|---|---|
| 가드 3종 | migrations append-only ok · doc-inventory ok · test-budgets 17 suites ok |
| lint · typecheck | 0 error 2 warning(기존) · typecheck 3종 오류 0 · 작업 트리 변경 없음(`git status` 빈 출력) |
| `node --test scripts/*.test.mjs` | 819/819 pass (구현 보고와 일치) |
| 파일 필터 없는 `vitest run` | 29파일 22건 실패 · `[test-pools]` 0건. 구현자 기준선 9파일 22건 ⊂ 이 실행 — 차이 20파일은 `npm ci --ignore-scripts`로 Electron 미설치(`Electron failed to install correctly`)·`C:/` 경로. r2 diff는 `app/AGENTS.md`·`scripts/test-pools.test.mjs`뿐이라 vitest 대상 파일 변경 0 |
| Windows CI | run 42460603101 `success`, `head_sha` = `9a994021`(GitHub API 관측) — AC8′ ✅ |
| 합계 | AC `✅13 · ⚠️1 = 14` · 강제 지점 행 합 13+6+10+5+36+1+2+10+3 = 86 · 닫음 85 — 구현 보고와 일치 |
| exe (AC1·AC10) | strace 재측정: vitest 성공 execve 1,200 + `node --test` 35 = 1,235 ≤ 2,420 · 워커 태그 68 ≤ io 파일 75 · `config user.*`/`autocrlf` 쓰기 0 · `maintenance` 0 |
| AC13 | 표지 3 (`rg -n` 3줄) · T3 7개 명령을 전부 직접 실행해 위 표와 일치 · ci.yml 단계 6개의 ABI-중립 대응과 같다 |

## 고장 이력

구현자 spec(`evidence/r2-mutations.jsonl`) 64행을 `mutate.py`로 전수 재실행했다 — **red 64 · green 0**, 원복 확인 "모든 파일 원문 그대로".

| 하한 | 결과 |
|---|---|
| ③ 직전 `못 잡음` | E1-iosq · C-cfg-mode · E3-reentry 직전 `못 잡음` → 지금 red(새 partition·config·재설치 케이스가 잡음). E2-badmode 동치 유지 |
| ④ 직전 `잡음` | 직전 52행이 같은 ID로 spec에 있고 전부 red(`red → green` 0). 공용 setup·헬퍼 무변경 |
| ① 등록 변이 | VP-06 E4-0~3 red 4/4 |
| ⑤ 형제 맞바꿈 | E1-iosq-swap · E2-sqs-swap · E2-iopool · E2-iogroup red |
| ⑦ 열거 sweep | 분기 5 · edge E1~E5 · R1·R2 · 표지 3 각각 red |

독립 축(⑥) — 구현자 목록에 없는 행:

| ID | 자리 | 종류 | 결과 | 분류 |
|---|---|---|---|---|
| N7-trim | `resolveIoMode` `raw.trim()` | 제거 | 잡음 | — |
| N11-cfg-base | `vitest.config.ts` `base` 전달 | 다른 값 | 잡음 | — |
| N12-partition-sort | `partitionTestFiles` 정렬 | 뒤집기 | 잡음 | — |
| N13-guard | R1 반환을 새 상태로 | 호출 대체 | 잡음 | — |
| N1-cfg-exclude | `vitest.config.ts` `exclude: configDefaults.exclude` → `[]` | 빈 값 | green | 동치 — `vitest list --filesOnly` 927파일 전후 동일 · src 아래 제외 패턴 디렉토리 0 |
| N14-sqlite-sort | `io.filter(ioSqlite.includes)` → `ioSqlite` | 호출 대체 | green | 동치 — `ioSqlite` ⊂ `io`가 `partitionTestFiles`에서 성립(`sqlite`는 io 규칙) |
| P-a · P-b | 임시 unit 파일: 신호 없이 `process.getBuiltinModule('node:child_process').spawnSync`/삼킨 `execSync` | 실제 풀 | red 2 | 가드가 `[test-pools]`로 막고 삼켜도 afterEach가 red(probe 삭제 확인) |

## V-pair closeout

| Pair | 결과 | 직접 oracle 확인 |
|---|---|---|
| VP-01 | PASS | forced 1 · sqlite 6분기 · 6규칙 — `test-pools.test.mjs` 케이스 존재, E1-* 변이 red |
| VP-02·05 | PASS | 환경 4종 필드 · 실제 unit 워커(`test-pools.test.ts`) |
| VP-03 | PASS | 10자리: 5형태 + 기록 + 훅 2 + R1·R2 — `재설치는 첫 상태를…` 케이스, E3-reentry·state red, probe 2 red |
| VP-04·06 | PASS | `hermetic-config.test.ts` 실 git 4키 · E4 red 4/4 |
| VP-07 | PASS | strace 재측정(위) |
| VP-08 | PASS | `test-pools.test.mjs` 스캔 + E5-config red |
| VP-09 | PASS(기계 범위) | Windows CI `file-mutation.test.ts` success. pwsh 없는 self-hosted는 사람 실기 |
| VP-10·11 | PASS | 위 gate 표 |
| VP-12 | PASS | E7 3행 red |
| VP-13 | PASS | 10자리 — 분기 6케이스 · E1 partition 케이스 · E2~E5 config 케이스(자식 node가 실제 `vitest.config.ts` import), 변이 C-cfg-* 4행 · E1-iosq* 2행 red |
| VP-15 | PASS(상속) | 실측 워크플로 이번 diff 불변 |
| VP-16 | PASS | 표지 3 + T3 명령 실행 + 표지 제거 3행 red |

## 9. Repository operation

- 트레일러: `9a994021` · `8189f647` 모두 `git log -1 --format='%(trailers:only=true)'`가 Agent·Handoff·Status·Criteria-*·Verified-By를 돌려준다. 실행 시점 차이로 `11/14` → `13/14`(AC8·AC8′ 대기 종료)는 시차 사본이라 일치.
- `[구현자 기입]` r2 일곱 필드 모두 있음. 강제 지점 표는 pair 자리 전부와 `남긴 곳`을 담고 ΔV2~ΔV4 자리(VP-13 · io.maxWorkers·groupOrder)를 포함한다.
- `app/AGENTS.md` 위생: 비밀·IP 없음, 부모 규칙 충돌 없음. 새 AGENTS.md 없음.
- **INDEX 좌표 교정**: 보드에 적힌 r1까지의 해시 14개(`9f39f9f` 등)는 이 클론에 객체가 없다(`git cat-file` 실패). rebase 병합된 `main` 해시로 교정했다 — 설계 `1677fe2e`·`10aee069`·`943b5938`·`0af8d3ce`·`1a815148`·`bea7f818`, 구현 `36f3113f`·`34d0e9bd`·`acd5972e`·`8af157b6`, 기록 `926babf4`·`a96e6bd4`, 검증 `6a40fc87`(전부 `origin/main` 조상 확인). ΔV5 설계 `d75f6c82` · r2 `9a994021`·`8189f647`은 PR 브랜치 좌표(`main`에 없음).

## 판정

**PASS (기계 범위).** 막는 발견 0, 필수 gate·REQUIRED/REGRESSION pair PASS. 남은 것은 AC7 — pwsh 없는 self-hosted 러너에서 Windows 잠금 테스트 통과(사람 실기).

못 본 것: self-hosted 러너 실행(AC7), Windows에서의 execve 수(strace는 Linux 기준), Electron 의존 20파일의 이 환경 실행(미설치).

## Review Signals

- 직전 round의 `못 잡음` 4건 중 이행 2·확장 1이 ΔV5 좌표로 모두 닫혔다. 반복 증상 없음.
- 반복 환경 한계: `npm ci --ignore-scripts` 시 Electron 미설치로 Linux에서 Electron·Windows 경로 의존 파일 실패(기준선 분리 조건: 차집합 ∅ + 환경 원인).
- 독립 축 발견 0(동치 2) · INDEX 좌표 불일치 1(운영, 교정함).

---

# Round 1 (이력 — 2026-11-07, RETURN_TO_PLAN)

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
