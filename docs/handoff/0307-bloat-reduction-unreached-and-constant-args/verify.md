# Verify — 0307-bloat-reduction-unreached-and-constant-args

## 메타

| 항목 | 값 |
|---|---|
| 판정 | **FAIL** — 이행 결함 1건(VP-12 `resolve-turn.ts` 규칙 칸 분기 미잠금). `PLAN_GAP` 0 |
| 검증자 | Claude (설계자와 같은 주체 — 독립 축 ⑥으로 보완) |
| 대상 | V1 + 정정 1·2 · impl r1 = `5816280`(M1) · `9de8a69`(M2·M3). 설계 `197ca62`·`8210b5a`·`5b42d87` |
| 확장 창 | verify **1회째** (창 안). ΔV 없음 |
| 기준선 | plan 규범 행은 impl 커밋이 바꾸지 않았다: `git diff 5b42d87 HEAD -- plan.md`의 삭제 행은 `[구현자 기입]` 표제 7줄뿐 |
| 못 본 것 | AC19 사람 실기(Electron 실행 불가). `origin/main`이 이 환경에 없어 좌표의 `main` 조상 여부는 확인하지 못했다 |

## 0. plan validity

- V mode Baseline · NEW 노드마다 같은 레벨 REQUIRED pair 있음 · 철회 4(VP-09·11·13·14)는 D-013~D-016으로 근거가 있다. 이관할 적대 증거 없음.
- §10 자리 검색 재실행: EP-01·02·04·06~08·10·12·15·16 전부 허용 예외만 남음, EP-03은 SDK 호출 1건(허용) — 차집합 ∅.
- 내부 불일치(비차단): §10 EP-16 칸의 `=12`는 나열한 문서가 11개다(`git diff --name-only 197ca62 HEAD -- docs ':!docs/handoff'` = 11). 구현자 보고가 이미 지적했고 분모는 나열 목록이다.

## 2~3. diff 비판 · 역방향 탐색

- `scan-surface.sh 197ca62..HEAD`: 1a 값 export 12·테스트 전용 15는 전부 이번 diff가 추가한 표면이 아니다(`passthroughRuntimeConfig`는 테스트 fixture 자체).
- C-39: 훅의 `allPlugins`가 `mergePluginMentions(후보, observedPlugins)`이고 컨트롤러가 넘기는 `observedPlugins`가 옛 memo의 두 항(`nativePluginMentions` 2호출)과 같다 — 삭제한 memo와 동치.
- C-17: `contextSession` 한 벌, 폴더·첨부 두 소비자. 정책 불허 시 둘 다 `[]`.
- 보고 밖 부수 발견: `BackgroundTaskTracker.applyLiveSet` production 호출 0(`rg applyLiveSet main -g '!*.test.*'` = 선언 2·인터페이스 1) — 구현자가 이미 비귀속으로 보고. 비귀속.

## 5. gate (이번 턴 재현)

| gate | 관측 |
|---|---|
| 가드 4종 | migrations ok · doc-inventory ok(`--check`) · product-naming ok(2235파일) · test-budgets ok(20 suites) |
| lint · typecheck | 0 error · 2 warning(`useVirtualizer` 등, 변경 전 동일) · typecheck exit 0, `error TS` 0 |
| 전체 vitest | 946파일: 9 failed · 933 passed · 4 skipped / 8962케이스: 22 failed · 8928 passed. `npm rebuild better-sqlite3` 뒤라 DB 스위트 포함 |
| 기준선 분리 | `197ca62` worktree에서 같은 9파일 실행 → 22 failed, 실패 목록 차집합 ∅(양방향 `diff` 빈 출력). 원인: Windows 경로 가정(`expected '/…/C:/two' to be 'C:/two'`) — 환경. 이번 diff가 만진 파일과 겹치지 않음(`git diff --name-only`로 대조, 겹침 0) |
| `node --test scripts/*.test.mjs` | 868/868 |
| `[test-pools]` 위반 | 0 |
| AC17 | `git diff --numstat 197ca62 HEAD -- app/src`: prod +61/−558 = **−497** ✅ · test +194/−187 = **+7** ❌(조건 ≤0). 구현자 보고와 일치 |

gate가 작업 트리를 바꾸지 않았다(`git status` 빈 출력).

## 4. 고장 이력 (하네스 `mutate.py`, 원복 확인 "모든 파일 원문 그대로")

| ID | 파일 | 종류 | 바꾼 내용 | 결과 | 분류 |
|---|---|---|---|---|---|
| V01 | `misc.ts` | 제거(등록 ①) | 읽기 전용 분기 → 항상 `resolve` | 잡음 (2) | — |
| V02 | `misc.ts` | 호출 대체(①) | 항상 `cached` | 잡음 (8) | — |
| V03 | `misc.ts` | 맞바꿈(①) | `harnessId`↔`modelProviderId` | 잡음 (5) | — |
| V04 | `resolve-turn.ts` | 제거(①) | 항상 `resolve` | 잡음 (1) | — |
| V05 | `resolve-turn.ts` | 호출 대체(①) | 항상 `cached` | 잡음 (31) | — |
| V07·V08 | `protocol.ts` | 제거(①) | `Stop`·`Promote` `generation` → optional | 잡음 (2·2) | — |
| V09 | `misc.ts` | 제거(⑦ 규칙 칸) | `!config` 오류 | 잡음 (1) | — |
| V10 | `misc.ts` | 제거(⑦) | `merge` | 잡음 (6) | — |
| **V11** | `resolve-turn.ts:276` | 제거(⑦ 규칙 칸) | `!config` 오류 → `if (false)` | **못 잡음** — `src/main` 전체에서도 22 failed(= 기준선 22) | **이행 결함** |
| V12 | `resolve-turn.ts` | 제거(⑦) | `merge` | 잡음 (4) | — |
| V13·V14 | `engine.ts` | 제거(⑦) | `harnessRuntime.invalidate` · `runtimeModelCatalog.invalidate` | 잡음 (15·15) | — |
| V15 | `engine.ts` | 제거(⑦) | `isReadOnly` → `false` | 잡음 (4) | — |
| V16 | `engine.ts` | 맞바꿈(⑤·⑥) | `isReadOnly(canonical)` → `isReadOnly(key)` | 잡음 (4) | — |
| V17 | `send.ts` | 제거(⑦) | `background.observe` 전달 | 잡음 (1) | — |
| V18·V19 | `send.ts` | 제거(⑥ 독립) | 계정 지침 읽기 · 시그니처 항 | 잡음 (2·2) | — |
| V20 | `files.ts` | 제거(⑦ 규칙 칸) | `contextSession` 정책 판정 | 잡음 (7) | — |
| V21·V22 | `files.ts` | 제거(⑦) | 첨부 가드 우회 · 폴더 가드 우회 | 잡음 (3·5) | — |
| V23·V24 | `files.ts` | 제거/맞바꿈(⑤·⑥) | `extra_dirs` 항 제거 · `cwd` 항 제거 | 잡음 (13·15) | — |
| V25~V27 | `useMentionAutocomplete.ts` | 제거/맞바꿈(⑦) | 관측 합치기 제거 · 후보 항 제거 · 유효 집합을 `menuPlugins`로 | 잡음 (1·5·1) | — |

V06(인자 맞바꿈 `resolve-turn.ts` 자리)은 spec에서 빠졌다 — 시도하지 않았고 구현자 S09(20 failed)를 재현하지 못했다. 독립 축(⑥) 발견 수: 6건 시도(V16·V18·V19·V23·V24·V27) 전부 잠김, 새 결함 0.

구현자 S08(`resolve-turn.ts` `!config` 오류 제거, "6 failed")은 재현되지 않았다 — V11의 동일 변이가 green이다. 구현자 보고의 잠금 주장은 이 자리에서 증거가 아니다.

## 6. V-pair closeout

| Pair | 결과 | 근거 |
|---|---|---|
| VP-01 | PASS | EP-01 0건 · 스키마 변이 V07·V08 red · 개별 중단 테스트 green |
| VP-02·03·04·05·06·07·08 | PASS | 음성 검색 0건(허용 예외만) · typecheck 0 · 인용 테스트 gate 실행 집합에서 green |
| VP-10 | PASS | V20~V24 red — 규칙 칸 3분기(없음·불허·허용) 모두 입력이 있다 |
| **VP-12** | **PAIR_FAIL** | oracle 칸 "읽기 전용 key인데 캐시 없음 → 오류"는 **자리마다**(`misc.ts` · `resolve-turn.ts`) 요구한다. `misc.ts`는 V09 red, `resolve-turn.ts:276`은 V11 `못 잡음`. 이 오류 문구를 단언하는 테스트가 트리에 없다(`rg 'cache is unavailable' app/src` = 선언 1) |
| VP-15 | PASS | V25~V27 red · 3입력(후보+관측·후보 끔+관측·후보 끔+관측 없음) |
| VP-16 | PASS | EP-16 0건 · inventory `--check` ok |

## 7. AC

`✅ 13 → 12 · ⚠️ 2 → 2 · ❌ 0 → 1 = 총 15`. AC12(C-13)가 ❌(VP-12). AC17 test 조건은 ❌가 아니라 ⚠️로 남긴다 — plan §7 AC 주의사항이 "순증이면 수치·사유를 보고하고 설계자 판단"으로 위임했고, +7은 sweep이 요구한 미잠금 3곳의 테스트(첨부 정책 · 스키마 · 관측 플러그인)와 fixture 36줄이다. V11을 닫는 테스트가 test를 더 늘리므로, 설계자가 상한을 정해야 한다(사용자 결정이 아니라 plan §7이 위임한 설계 판단). AC19는 사람 실기.

## 11. Repository operation

- INDEX 비고 갱신분 4줄(5줄 이내). 대상 커밋 좌표는 이번 턴에 채움 — `git cat-file -t`로 5개 해시 모두 `commit`. `main` 조상 여부는 미확인(위 메타).
- 커밋 trailer: `git log -1 --format='%(trailers:only=true)'`가 `5816280`·`9de8a69`·`8210b5a`·`5b42d87` 모두 `Agent`·`Handoff`·`Status` 등을 돌려줌. 구현 커밋 `Criteria-Met: 13/15`은 AC 표 ✅13(구현자 자기 보고)과 일치하나 이번 재집계는 12.
- AGENTS.md 변경 없음.

## 13. 파생 이슈

| # | 이슈 | 출처 | 대응 방향 | 분류 | disposition |
|---|---|---|---|---|---|
| 1 | `resolve-turn.ts:276` 캐시 없음 오류 분기를 잠그는 테스트 없음 (V11) | VP-12 oracle 칸 · §10 EP-12 실패 의미 | 읽기 전용 key + `cached()`가 `undefined`일 때 `resolveTurnProvider`가 `Runtime model cache is unavailable`로 거부하는 케이스를 `resolve-turn.runtime-catalog.test.ts`에 추가. V11 재실행 red 확인 | 이행 결함 | BLOCKING |
| 2 | `applyLiveSet` production 호출 0 | — | 보고만 | 비귀속 | NEXT_HANDOFF(독립) 후보 — 승격은 사용자 요청 시 |

## 14. Review Signals

- 구현자 자기보고 S08과 이번 재현이 갈렸다(같은 변이, 구현자 red 6 vs 이번 green). 구현자 oracle 범위를 이번에 확인하지 못했다.
- 독립 축 ⑥ 6건 시도, 새 결함 0. 이전 라운드 없음(하한 ③④ 해당 없음).
- 환경 한계: Electron·better-sqlite3 설치가 필요했다(`ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` → `node node_modules/electron/install.js` → `npm rebuild better-sqlite3`로 해소).

## 15. 결론

**FAIL** — VP-12 한 자리(`resolve-turn.ts`)의 규칙 칸 분기가 잠겨 있지 않다. 나머지 pair·gate는 PASS이고 기준선 분리 두 조건을 충족했다. 다음 주체: 구현자(Claude). 다음 구현 턴은 파생 이슈 1을 닫고 AC17 test 수치를 다시 보고한다.
