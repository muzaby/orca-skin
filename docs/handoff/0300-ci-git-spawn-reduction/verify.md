# Verify — 0300-ci-git-spawn-reduction

## 메타

| 항목 | 값 |
|---|---|
| slug | `0300-ci-git-spawn-reduction` |
| 검증자 | Claude Code (설계자 = 검증자 — plan validity는 자기 설계 감사) |
| 일자 | 2026-11-09 |
| 대상 커밋/range | `ba62912..8b175c5` (구현 `b627538`·`57cbaaa`·증거 `8b175c5`, 전부 `origin/main` 조상 확인) |
| 구현 전 plan 기준 | `ba62912` (ΔV3 READY) |
| V mode / 유효 V | Delta V — `V1 + ΔV1 + ΔV2 + ΔV3` |
| 라운드 | 1 → 2 |
| 상태 | **RETURN_TO_PLAN** (PAIR_FAIL 0 · PLAN_GAP 1: 확장 후보) |
| 확장 창 | verify 1회째 — 창 안. 창이 다시 열린 노드 없음 |
| 독립 축(⑥) | 설계 밖 변이 13개(V-01~V-13: 경로 상한 경계·msys 순서·MSYS 병합·시스템 디렉토리 기본값·J9 옵션·허용 수 방향·fsync 키) |
| 열거 sweep(⑦) | 1회째 전수 — 구현자 변이 121 전부 재실행 red(`mut-rerun.tsv` 121행), 못 잡음 0 |
| 발견 분류 | 이행 0 · 현재 0 · 확장 1(막음 1) · 경계 0 · 비귀속 0 |

## 0. 기준선

- 구현 커밋의 `plan.md` 변경은 헤더 상태 칸과 `[구현자 기입]`뿐이다(`git diff ba62912..8b175c5 -- plan.md` hunk 2개). Decision·AC·V·§10 변경 없음.
- Plan validity: §10 자리 검색 재실행 — EP-01 2(`runner.ts` · `temp-repo.testfixture.ts:65`) · EP-11 2 · EP-12 2 · EP-09 1(`naming.ts:68`) 모두 목록과 차집합 ∅. 유효.

## 1. gate (이번 턴 실측, 구현 보고와 독립)

| gate | 관측 | 판정 |
|---|---|---|
| migrations / doc-inventory / test-budgets | 모두 ok(`20 real-git suites ok`) | PASS |
| typecheck | 3프로젝트 오류 0 | PASS |
| lint | error 0 · warning 2(기존) · 트리 변화 없음 | PASS |
| `node --test scripts/*.test.mjs` | 827 pass · 0 fail | PASS |
| 파일 필터 없는 vitest (ABI Node 재빌드 후) | head 29파일·22케이스 실패 / base(`ba62912`) 29파일·22케이스 — 실패 파일 집합 차집합 ∅ (Electron 미설치·C:/ 경로 서명) | 기준선 분리 성립 |
| AC13 케이스 비교(JSON) | base 8432 · head 8472 ID. 상태 변경 0. 기존 ID 소실 5건은 worktree 경로가 이름에 박힌 케이스(base 경로 차이)이며 head에 대응 5건 존재. 순증 40 | PASS |
| AC12 집계 | `829 total / 377 test-side`, git-cli 122 · consistency 68 · diff 106 · service 114 (≤840/380/135/85/115/115) | PASS |
| Windows CI #1032 | 구현자 인용(`impl-r1-ci1032.txt`). 이번 턴 재확인 불가 | 못 봄 |

## 2. pair closeout

| Pair | 판정 | 근거 |
|---|---|---|
| VP-06·07·08·09·10·12·03·04 | PASS | 등록 변이 M-01~M-11 + sweep 121 전부 red(재실행). 자리 수 EP-02 1 · EP-03 1 · EP-04 18 · EP-05~07 11 · EP-08 3 · EP-09 1 · EP-11 2 · EP-12 2 |
| VP-01·11 | PASS(위임) | win32 oracle은 Linux skip — Windows CI 결과에 의존, 이번 턴 미관측 |
| VP-02 | PASS | 위 AC12·AC13 |
| VP-05 | PASS | M-11 red 재확인, 예산·풀 가드 green |
| VP-13 | 사람 실기 | AC18 폐쇄망 전후 각 2회 — 이 환경 관측 불가 |

## 3. 고장 이력 (설계 밖 독립 축)

| ID | 자리 | 종류 | 변경 | 결과 | 분류 |
|---|---|---|---|---|---|
| V-01 | `repository.ts` listBranchRefs | 제거 | 정확 일치 패턴 삭제 | 잡음(`repository.test.ts` 인자 벡터) | — |
| V-02 | 같은 곳 | 다른 값 | `-*` → `-1*` | 잡음(같은 테스트) | — |
| V-03 | `naming.ts` | 다른 값 | 초기 `selected`=base | 잡음(naming 1) | — |
| V-04 | `git-executable.ts` HOME 길이 | 뒤집기 | `<` → `<=` | 잡음 | — |
| V-05 | 같은 곳 MSYS 행 | 다른 값 | `startsWith('MSYS=')` → `startsWith('MSYS')` | **못 잡음** | 확장 후보 |
| V-06 | msys 순서 | 맞바꿈 | ucrt64↔clangarm64 | 잡음 | — |
| V-07 | `gitSubcommand` | 제거 | `-c` 건너뛰기 | 잡음 | — |
| V-08 | `finishGitAllowances` | 뒤집기 | `!==` → `<` | 잡음(많음 입력) | — |
| V-09 | `runner.ts` | 호출 대체 | env 해석 생략 | 잡음 | — |
| V-10 | `test-host.mjs` | 제거 | `fsync = none` | 잡음 | — |
| V-11 | 기존 `MSYS` 병합 | 제거 | 기존 값 접미 삭제 | 잡음 | — |
| V-12 | MSYS 행 판별 | 다른 값 | `startsWith` → `includes('MSYS=')` | **못 잡음** | 확장 후보 |
| V-13 | 시스템 디렉토리 기본값 | 다른 값 | `C:\Windows` → `C:\Other` | 잡음 | — |

## 4. 발견

| # | 발견 | 분류 | disposition |
|---|---|---|---|
| 1 | R10의 `git-bash.config` 입력이 `MSYS=` 행 하나뿐이다(`git-executable.test.ts:57`). `MSYSTEM=…` 같은 다른 키 행이나 행 중간의 `MSYS=`가 섞여도 관측이 같다(V-05·V-12). 코드 동작은 현재 맞고, 칸 문장의 입력은 "config 유/무"라 이 분기를 인용할 수 없다 | 확장 후보 | 창 안 → `PLAN_GAP`: 설계자가 입력 추가 채택 또는 경계 선언 |

## 5. Review Signals

- 설계자 = 검증자 → plan 사각 공유 가능성을 ⑥ 13개로 보완했다. 독립 축 발견 1건(확장).
- 반복 한계: Windows 전용 oracle(AC3·AC4 win32)과 AC18은 이 환경에서 못 본다.

## 판정

**RETURN_TO_PLAN.** 이행·현재 결함 0, 모든 gate·AC12·AC13 재현. 확장 후보 1건(R10 config 행 판별 입력)을 설계자가 채택하거나 경계로 선언하면 구현 턴 없이(경계) 또는 입력 1개 추가(채택)로 닫힌다. AC18은 사람 실기로 남는다.
