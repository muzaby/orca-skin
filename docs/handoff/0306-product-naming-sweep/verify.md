# Verify — 0306-product-naming-sweep

## 메타

| 항목 | 값 |
|---|---|
| slug | `0306-product-naming-sweep` |
| 검증자 | Claude Code (설계자 = 구현자 = 검증자 — plan validity는 자기 설계 감사다) |
| 일자 | 2026-11-10 |
| 대상 커밋/range | `499d354..703c36b` (설계 `7114768`·`b4b0501`·`206409f` · 구현 `703c36b`) |
| 구현 전 plan 기준 | `206409f`(rev.3 READY). 구현 커밋의 plan 변경은 `[구현자 기입]`·상태 칸뿐 — 규범 행 변경 없음 |
| V mode / 유효 V | `Baseline V: V1` rev.3 |
| 라운드 | 1 |
| 상태 | **RETURN_TO_PLAN** |
| 확장 창 | verify 1회째 — 창 안. ΔV로 다시 열린 노드 없음 |
| 독립 축(⑥) | ① 범위 밖 전수 재검색(검사기와 다른 경로 `git grep`) ② 문서가 인용하는 코드 이름 ↔ 실제 코드 대조 — 발견 2건(아래 F1·F4) |
| 열거 sweep(⑦) | **전수 아님** — 변이 18건(아래). EP-06 이스케이프 6줄 중 1줄 · EP-07 값 34줄 중 0줄 · EP-02 d.ts·`logging.ts` 미시도. 못 본 자리는 못 봤다고 적는다 |
| 발견 분류 | 이행 1(F2) · 현재 1(F1) · 확장 2(F3 — 창 안이라 막음) · 경계 0 · 비귀속 0 · 동치 1(F5) |

## 0. 기준선 / plan validity

- 구현 커밋의 plan diff: 규범 행(Decision·AC·V·§10) 변경 없음. 구현자가 AC를 완화하지 않았다. `git diff 206409f 703c36b -- plan.md`는 상태 칸과 `[구현자 기입]` 추가뿐.
- **plan validity — PLAN_GAP 1건**: D-001은 "현재 문서"를 대상으로 하고 D-003은 제외 목록(handoff·archive·decisions·etc·chats·project·README·references)을 닫아 적었는데, §6 문서 범위 목록에는 `docs/spec/**`가 없다. 어느 쪽에도 안 든 자리가 생겼다(F3).
- V mode·pair 등록: 모든 NEW 왼쪽 node에 같은 레벨 REQUIRED pair, VP-04가 REGRESSION. 이상 없음.

## 1. 재측정한 관측 (이번 턴)

| 항목 | 관측 |
|---|---|
| 의존성 | `npm ci --ignore-scripts` + `npm rebuild better-sqlite3`(Node ABI) 후 `sqlite ok` |
| 이름 검사기 | `node scripts/check-product-naming.mjs` → `OK — 2163파일 · 허용 13항목` |
| 마이그레이션 · 문서 · 예산 가드 | append-only OK(2009 소스) · doc-inventory prose+links OK · test-budgets 20 suites OK |
| lint · typecheck | lint error 0 · warning 2 · 트리 변화 0(`git status` 빈 출력) · typecheck error 0 |
| `node --test scripts/*.test.mjs` | 862 pass · 0 fail |
| 전체 vitest(변경 후) | 945파일: **22 failed · 8795 passed · 11 skipped** |
| 전체 vitest(`499d354` worktree, 같은 `node_modules`) | 22 failed · 8787 passed · 11 skipped — 실패 목록 64줄 vs 64줄, 파일명 3건 정규화 후 `diff` **빈 출력**. 순증 8케이스 = 구현 보고와 일치 |
| 실패 서명 | DB 로드가 아닌 Electron 미설치·Windows 경로 전제(구현 보고와 같음). 변경 전과 집합이 같아 기준선으로 분리 — 환경 원인 자체는 서명 대조만 했고 22건 각각은 읽지 않았다 |
| D-003 경로 diff | `git diff --name-only 499d354 703c36b`에서 D-003 경로 = `docs/handoff/0306…/plan.md` · `docs/handoff/INDEX.md`뿐 |
| EP-09 허용 12파일 | `--report-allowed` 13항목, 파일 집합 12 — 구현 보고와 일치 |
| `product-identity.test.ts` | 40 passed |

## 2. 고장 이력

범위: 검사기 4분기 · EP-02~EP-08 대표 자리 · 워크플로 env. 원복은 `git status` 빈 출력으로 확인(하네스가 자체 확인도 출력).

| ID | 파일 | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 분류 |
|---|---|---|---|---|---|---|
| V01 | `check-product-naming.mjs` ③ | 제거 | `orca-skin` 허용 꼴 제거 | 잡음 | 검사기 테스트 1 | — |
| V02 | 같은 파일 FORMS | 제거 | `title` 꼴 제거 | 잡음 | 5 | — |
| V03 | 같은 파일 `pathShapes` | 뒤집기 | 범위 안 경로 건너뛰기 무력화(⑦) | 잡음 | 1 | — |
| V04 | 같은 파일 ④⑤ | 제거 | 허용 개수 대조 루프 제거 | 잡음 | 3 | — |
| V05 | `preload/index.ts` | 다른 값 | 노출 키 `'xx'` | 잡음 | `src/preload` 28 | — |
| V06 | `history/writer.ts:63` | 다른 값 | 영수증 type 소비 | 잡음 | 4 | — |
| V07 | `artifacts/tool.ts:30` | 다른 값 | `connectorId` 값 | **못 잡음** | 없음 | **동치** — F5 |
| V08 | `artifacts/tool.ts:29` | 다른 값 | 서버 `id` | 잡음 | 1 | — |
| V09 | `infra/db/artifact-queries.ts:134` | 다른 값 | 도구 이름 소비 | 잡음 | 7 | — |
| V10 | `diff-requirements.ts` 이스케이프 1줄 | 다른 값 | 이스케이프 리터럴 | 잡음 | 1 | — |
| V11 | `mcp/store.ts:44` | 다른 값 | env 접두사 | 잡음 | 1 | — |
| V12 | `managed-mcp.ts:43` | 다른 값 | env 접두사 | 잡음 | 4 | — |
| V13 | `diagnostics.ts:34` | 다른 값 | env 접두사 | 잡음 | 6 | — |
| V14 | `test-time.mjs:14` | 다른 값 | env 이름 | 잡음 | 5 | — |
| V15 | `check-doc-inventory.mjs:44` | 다른 값 | 채널 정규식 | 잡음 | 2 | — |
| V16 | `ci.yml:81` | 다른 값 | Test 단계 env 이름 | 잡음 | `test-time.test.mjs` 1 | — |
| V17 | `ci.yml:31` | 다른 값 | `vars.` 이름 | 잡음 | `test-time.test.mjs` 1 | — |
| V18 | `test-pools-experiment.yml:40` | 다른 값 | `ORCINUS_ORCA_TEST_IO_MODE` 이름 | **못 잡음** | 없음 | **이행 결함** — F2 |

## 3. Finding disposition

| ID | 분류 | disposition | 근거 |
|---|---|---|---|
| F1 | 현재 결함 | BLOCKING | 현재 문서가 코드에 없는 이름을 인용한다. `docs/GLOSSARY.md:67` `exposeInMainWorld('orcinus-orca', ...)` ↔ `preload/index.ts:454` `exposeInMainWorld('oo', oo)`. 채널 접두사는 D-004 N4가 `oo:`인데 `docs/TRD.md:170`·`:172`·`docs/IPC_CONTRACT.md:374`가 `orcinus-orca:message:*`·`orcinus-orca:credentials:*`·`orcinus-orca:runtime:*`로 적었다. 재현: `git grep -nE "orcinus-orca:[a-z]\|exposeInMainWorld\('orcinus" -- docs`. §11 "현재 문서 — 코드 식별자 인용은 새 이름" |
| F2 | 이행 결함 | BLOCKING | §10 EP-08 자리 목록 "워크플로 `env:`·`vars.` 10줄"을 어김 — `test-pools-experiment.yml`의 env 이름(`:40`)을 바꿔도 oracle이 없다(V18). 구현 보고는 EP-08을 `2/2 (스크립트)`로 닫고 이 워크플로 자리를 `남긴 곳`에 적지 않았다. `ci.yml`·`release.yml` 자리는 `test-time.test.mjs`가 잠근다(V16·V17) |
| F3 | 확장 후보 | **PLAN_GAP**(창 안) | 범위 목록 누락 2곳. ① `docs/spec/AGENTS.md:18·33·41` · `docs/spec/claude/agent-sdk/INDEX.md:119` · `docs/spec/opencode/INDEX.md:13`이 `Orca`를 산문으로 쓴다 — §6 문서 범위에도 D-003 제외에도 없다(plan 내부 불일치). ② `app/.gitignore:162` `node_modules/.cache/orca/` — 같은 변경이 `ensure-sqlite-abi.mjs:12`의 캐시 폴더를 `orcinus-orca`로 바꿨는데 무시 항목은 옛 이름이다. `node_modules/`(`:46`·`:149`)가 이미 무시하므로 동작 영향은 없다. 재검색: `git grep -nIE "orca\|Orca\|ORCA" -- . ':!docs/handoff' ':!docs/archive' ':!docs/decisions' ':!docs/etc' ':!chats' ':!project' ':!README.md' ':!.agents/**/references'`에서 허용 12파일 밖 잔여는 위 두 곳뿐 |
| F4 | (F1에 포함) | — | ⑥ 독립 축 ②의 산출 |
| F5 | 동치 | NON_BLOCKING | `tool.ts:30` `connectorId`는 읽는 곳이 `runtime-tool-registry.ts:56` 동등 비교와 타입 선언 `runtime-tools.ts:18`뿐이다 — 이름 합성에 쓰이지 않아 값을 바꿔도 동작이 같다(V07 green). §10 EP-05 `:30` 자리가 oracle 없이 3/3으로 보고된 점은 보고 정정 사항 |

- 이행 결함 F2와 현재 결함 F1은 같이 고친다. F3은 설계자가 항목마다 범위 편입(`docs/spec` 4파일 · `.gitignore`) 또는 경계 선언을 정한다 — 이 판단은 D-003 "원문 미러 편집 금지"(`docs/AGENTS.md` 표 `spec/`)와 얽혀 있어 사용자 결정이 필요할 수 있다.

## 4. V-pair closeout

| Pair | 결과 | 직접 oracle 좌표 · 관측 |
|---|---|---|
| VP-08 | PASS | `scripts/check-product-naming.test.mjs` — V01~V04 red |
| VP-01 | PASS | `gate: node scripts/check-product-naming.mjs` OK · 엄격화: 위 `git grep` 재검색이 같은 허용 외 잔여(F3)를 낸다 — 검사기 범위 밖이라 AC1 자체는 충족 |
| VP-02 | PASS | `product-identity.test.ts` 40 passed |
| VP-03 | PASS | 위 §1 — 실패 집합 차집합 ∅, 순증 +8 |
| VP-04 | PASS | `migrate-legacy.test.ts`·`rebase-path.test.ts`·`legacy-paths.test.ts` 실패 집합 밖 · LEGACY 상수 케이스 pass |
| VP-05 | PASS | V05 red 28 |
| VP-06 | PASS | V06·V08~V13 red. `tool.ts:30`은 F5(동치) |
| VP-07 | **PAIR_FAIL** | `ci.yml`·`release.yml` 자리 PASS(V16·V17) · `test-pools-experiment.yml` 자리 oracle 없음(V18, F2) |
| VP-09 | PASS(부분) | V10 red 1 — 이스케이프 6줄 중 1줄만 재시도, 나머지 5줄은 구현자 보고(6/6 red)에 의존한다 |

## 5. 사람 · 환경 경계

- AC9(GitHub Variables 이름 3개) · AC10(설치본 실기): 사람. 이 환경에서 `dev`/`build`는 하지 않았다.
- 순수 로직(검사기·채널 수·문서 가드)은 전부 기계 검증했다.

## 6. Repository operation checks

- 커밋 `703c36b` trailer 파싱: `Agent`·`Handoff`·`Status: implemented`·`Criteria-Met: 8/10`·`Criteria-Pending`·`Verified-By: pending` 모두 반환 — 허용값 준수.
- 인용 해시 `7114768`·`b4b0501`·`206409f`·`703c36b` 전부 `commit`. `origin/main` ref가 이 환경에 없어 `main` 조상 여부는 확인하지 못했다.
- INDEX 0306 행의 대상 커밋 자리표시자를 위 좌표로 채웠다. 비고 5줄 이내.
- AC 합계 자기보고 `✅8 · ⚠️2 · ❌0 = 10` — 행 10개와 일치. 단 AC6·AC1의 ✅는 F1·F3로 재판정 대상이다.
- `[구현자 기입]` 일곱 필드 모두 있음. 강제 지점 표는 EP-08을 스크립트 2만 담았다(F2).

## 7. Review Signals — 사실만

- 구현 보고의 "잠금" 표는 자기가 고른 대표 변이만 담았고, 열거된 EP-08 워크플로 자리와 EP-05 `:30`이 빠졌다.
- 일괄 변환이 코드 식별자 인용을 문서에서 긴 꼴로 바꾼 사례가 4곳(F1). 검사기는 "옛 표기 없음"만 봐서 통과한다 — plan §10 선언 경계 문장이 이 형태를 예고했다.
- ⑥ 독립 축 2개에서 발견 3건(F1·F3 ①②).
- 반복된 환경 한계: Electron 미설치(DB 외 22건 서명 동일), 설치본 실기 불가.

## 8. 결론

**RETURN_TO_PLAN** — PLAN_GAP 1(F3)이 있어 설계자가 먼저다. 동시에 막는 결함 2건(F1 현재 · F2 이행)이 있어 설계자 정정 뒤 구현이 이어진다.

설계자에게 넘길 것: F3 항목별 편입/경계 선언(`docs/spec` 4파일 · `app/.gitignore`). 구현자에게 넘길 것: F1(문서 인용 4곳을 코드와 일치시키고 가능하면 AT-02에 `GLOSSARY` 노출 키 단언) · F2(`test-pools-experiment.yml` env 이름 oracle).
