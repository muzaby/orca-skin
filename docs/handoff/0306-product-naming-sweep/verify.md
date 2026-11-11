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
| 라운드 | 1 (아래 §r2 = 2회째 verify, 라운드 2) |
| 상태 | r1 **RETURN_TO_PLAN** → r2 **RETURN_TO_PLAN** (§r2) → r3 **PASS** (§r3) |
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


---

# r2 — verify 2회째 (라운드 2)

**RETURN_TO_PLAN** — r1 F1·F2·F3은 닫혔고 `PLAN_GAP` 1건(F6, 확장 후보·창 안)만 남았다. 막는 이행·현재 결함 0.

## r2-0. 기준선 · 확장 창

- 대상 `a6cfaec..df0883a`(설계 `a6cfaec` · 구현 `df0883a`). 구현 커밋의 plan diff는 메타 상태 칸과 `[구현자 기입]` r2 절뿐 — 규범 행 변경 없음(`git diff a6cfaec df0883a -- plan.md`).
- 확장 창: verify **2회째 — 창 안**. ΔV1 NEW·CHANGED 노드(MD-01 ⑥·R-02·AR-02·AR-01 EP-05)도 이번 verify가 그 뒤 첫 회차.
- plan validity: ΔV1 pair마다 production path·자리 목록·oracle 있음. EP-08 7자리·EP-05 2자리·EP-10 8건 목록 고정. PLAN_GAP 없음(F6은 구현이 아니라 잠금 공백).
- 독립 축(⑥): 검사기 파일 항목 일치 방식(`excludes`)과 EP-10 테스트의 문서 범위 5곳 — 발견 1건(F6).

## r2-1. 재측정 (이번 턴, `npm ci --ignore-scripts` + `npm rebuild better-sqlite3`, `sqlite ok`)

| 항목 | 관측 |
|---|---|
| 이름 검사기 | `OK — 2236파일 · 허용 13항목` |
| 문서 가드 · 예산 · 마이그레이션 | doc-inventory prose+links OK(117채널) · test-budgets 20 suites OK · no-copies OK(append-only는 `v*` 태그 없어 skip) |
| lint · typecheck | lint error 0 · warning 2 · `git status` 변화 0 · typecheck error 0 |
| `node --test scripts/*.test.mjs` | 868 pass · 0 fail |
| 전체 vitest | 945파일: 29 failed 파일 · **22 failed / 8797 passed / 11 skipped**. 서명: `Electron failed to install` 3건 등 Electron·Windows 경로 전제 |
| 기준선 분리 | 이번에 `a6cfaec` worktree 재실행은 **하지 않았다**. 근거: r2 diff에 production 코드 0(`app/src` 변경은 `product-identity.test.ts` 1개), 실패 29파일에 수정 파일 없음. r1 verify가 `499d354`와 22건 일치를 확인했고 케이스 수 8795→8797 = EP-10 2케이스 |
| D-003 경로 diff | `git diff --name-only 499d354 df0883a` → handoff 디렉토리·INDEX뿐 |
| 잔여 옛 표기(엄격화) | 제외 8종을 뺀 `git grep -nIE "orca|Orca|ORCA"` 잔여 = 허용 12파일 + 범위 밖 파일을 가리키는 경로·옛 이름 서술 6줄(`docs/INDEX.md:96` · `TRD.md:242·248·503` · `adapters.md:182` · `overview.md:74·161`) — 전부 EP-01 ⑦ 또는 허용 목록, 검사기 OK와 일치 |

## r2-2. 고장 이력 (하네스 `mutate.py`, spec 36행, 원복 "모든 파일 원문 그대로")

| ID | 자리 | 종류 | 바꾼 내용 | 결과 | 잡은 것 | 분류 |
|---|---|---|---|---|---|---|
| W01~W08 | `EXCLUDED` 항목 | 제거 | 8종 각각 제거 | 잡음 8/8 | 검사기 테스트 2~5 | — |
| W09·W10 | `inScope` | 고정값 | 항상 false / true | 잡음 | 20 / 12 | — |
| W11 | `excludes` `*` 마디 | 다른 값 | `[^/]+` → `.*` | 잡음 | 1 | — |
| W12 | `readTracked` | 제거 | 심볼릭 링크 분기 | 잡음 | gate exit 1 | — |
| **W13** | `excludes` 파일 항목 | 다른 값 | 파일 항목 일치 `===` → `startsWith` | **못 잡음** | 없음 | **확장 후보 F6** |
| W20~W23 | `ci.yml`·`release.yml` 4자리 | 다른 값 | env·vars 이름 | 잡음 4/4 | `test-time.test.mjs` 각 1 | — |
| W24~W27 | 실측 워크플로 `:35`·`:40`·`:42` | 다른 값 | 이름 · vars 이름 | 잡음 4/4 | `test-pools.test.mjs` 신규 1케이스 | — |
| W28 | 실측 `:40` 값 | 맞바꿈 | 모드 값 → `vars.…TIME_SCALE` | 잡음 | 같은 케이스 | — |
| W30·W31 | EP-05 `:29`·`:134` | 다른 값 | 서버 id · 도구 이름 | 잡음 | 1 · 6 | — |
| W40~W43 | E2·E3 4파일 | 다른 값 | 옛 표기로 되돌림 | 잡음 4/4 | gate exit 1 | — |
| W50~W52 | EP-10 문서 3자리(노출 키 1·채널 꼴 2) | 다른 값 | 긴 꼴로 되돌림 | 잡음 3/3 | `product-identity.test.ts` 각 1 | — |
| W60~W64 | EP-10 ② 범위 5곳 | 제거(삽입) | `orcinus-orca:x:y` 를 `app/src/{renderer,main}/AGENTS.md`·`docs/guides/AGENTS.md`·`docs/spec/AGENTS.md`·루트 `AGENTS.md`에 | 잡음 5/5 | 각 1 | — |

- 못 본 것: EP-10 채널 꼴 6건 중 3건·r1 V01~V04·EP-06 이스케이프 6줄·EP-07 값 34줄은 이번에 재시도하지 않았다(이번 diff가 닿지 않음 — 구현 보고 M23~M28 등에 의존).

## r2-3. Finding disposition

| ID | 분류 | disposition | 근거 |
|---|---|---|---|
| F1 | 현재 결함 | **closed** | `git grep -noIE "orcinus-orca:[a-zA-Z*{]+"`(범위 문서) 0건 · 노출 키 인용 `'oo'` · W50~W52 red |
| F2 | 이행 결함 | **closed** | 실측 3자리 oracle 신설 — W24~W28 red (r1 V18 = W25) |
| F3 | 확장 후보 | **closed** | E1~E3 구현 — 검사기 OK 2236파일, W40~W43 red, `docs/spec` 3파일 `Orcinus orca` |
| F6 | 확장 후보 | **PLAN_GAP(창 안)** | W13: `excludes`의 파일 항목 일치(`path === entry`)를 `startsWith`로 바꿔도 검사기 테스트 40건과 gate가 green. 원문 인용 불가 — EP-01 ⑥ 입력은 "제외 8종 + 목록 밖 4종"이고 `README.md`로 시작하는 다른 파일(`README.md.orig`)은 입력에 없다. 현재 결함도 아니다 — `git ls-files \| grep -E '^README\.md.'` 0건. 규칙이 "그 밖의 추적 파일은 전부 읽는다"를 주어로 쓴다는 해석이 필요해 확장으로 둔다 |

설계자 선택(ΔV2): ① `README.md.x` 류 1입력(위반 기대)을 EP-01 ⑥ 입력에 채택 — 입력 1개 추가로 닫힘 ② 경계 선언(파일 항목은 정확 일치가 아니어도 무방, 현재 트리에 그 형태 없음). 코드 수정이 필요하면 구현자 몫이다.

## r2-4. V-pair closeout

| Pair | 결과 | 직접 oracle 좌표 · 관측 |
|---|---|---|
| VP-01 | PASS | `gate: node scripts/check-product-naming.mjs` OK · 엄격화 재검색 잔여 = 허용·⑦ 해당뿐 |
| VP-08 | PASS | `check-product-naming.test.mjs` 40 pass — W01~W12 red. W13은 F6 |
| VP-02 | PASS | `product-identity.test.ts` 42 pass — W50~W52·W60~W64 red |
| VP-07 | PASS | EP-08 7자리: `test-time.test.mjs` 4자리(W20~W23) · `test-pools.test.mjs:'작업 env 가 스크립트가 읽는 이름으로…'` 3자리(W24~W28) |
| VP-06 | PASS | EP-05 2자리 W30·W31 red. EP-04·EP-07은 r1 좌표(이번 diff가 닿지 않음) |
| VP-03 | PASS | §r2-1 — production diff 0, 실패 집합은 환경 서명(기준선 재실행은 안 함, 위 표) |
| VP-04·05·09 | INHERITED PASS | r1 §4 좌표 유지 — 이번 diff가 닿지 않아 재실행 안 함 |

## r2-5. Repository operation checks

- 커밋 `df0883a` trailer: `Agent`·`Handoff`·`Status: implemented`·`Criteria-Met: 8/10`·`Criteria-Pending`·`Verified-By: pending` 반환 — 허용값 준수. 인용 해시 `7114768`·`b4b0501`·`206409f`·`703c36b`·`8b345fb`·`a6cfaec`·`df0883a` 전부 `commit`. `origin/main` ref가 이 환경에 없어 `main` 조상 여부는 확인하지 못했다.
- AC 합계 `✅8 · ⚠️2 = 10` 행과 일치. `[구현자 기입]` r2 일곱 필드 모두 있음 · 강제 지점 표가 EP-01 ⑥·EP-05·EP-08·EP-10 자리 전부를 담았다.
- 사람: AC9·AC10 그대로. 순수 로직 전부 기계 검증.

## r2-6. Review Signals — 사실만

- r1의 이행 결함 F2와 같은 증상(워크플로 이름 자리 oracle 부재)은 재발하지 않았다.
- r2의 발견 1건(F6)은 ⑥ 독립 축에서 나왔고 같은 파일 r1 변이(V01~V04)와 다른 분기(`excludes`)다 — 열거된 규칙 칸 분기가 아니라 ΔV1이 새로 만든 일치 함수의 하위 분기.
- 반복된 환경 한계: Electron 미설치(22건), 설치본 실기 불가.
- 이번 verify로 라운드 2 종료 → 라운드 3. 다음 verify는 3회째로 창 밖이다.

## r2-7. 결론

**RETURN_TO_PLAN** — F6 하나. 설계자가 ΔV2로 ①(입력 1개 채택) 또는 ②(경계 선언)를 정한다. ①이면 구현 턴이 입력을 더하고, ②면 구현 없이 verify로 갈 수 있다. 그 밖의 pair·gate는 전부 PASS라 F6만 닫히면 PASS 후보다.


---

# r3 — verify 3회째 (라운드 3)

**PASS (기계 범위)** — 막는 발견 0. 사람 판정은 AC9·AC10만 남는다. 설계자 = 구현자 = 검증자라 plan validity는 자기 설계 감사다.

## r3-0. 기준선 · 확장 창

- 대상 `df0883a..32fe1b0`(r2 verify `d313035` · ΔV2 설계 `426eab7`·`cc712e6` · 구현 `32fe1b0`). 구현 커밋의 plan diff는 상태 칸과 `[구현자 기입]` r3 절뿐 — Decision·AC·V·§10 규범 행 삭제 0(`git diff 426eab7 32fe1b0 -- plan.md`의 삭제 행 = 상태 칸 1줄).
- 확장 창: verify **3회째 — 창 밖**. ΔV2의 새 열거 항목(M-1~M-4)은 출처가 F6(r2 verify 확장 후보, 설계자 채택)이고 창 안 마지막 설계 턴에서 열거됐다. 창 밖 ΔV 아님.
- plan validity: ΔV2는 pair(VP-08)·자리(`excludes` 1자리)·분기 4개·입력·등록 변이를 갖는다. PLAN_GAP 없음.
- 독립 축(⑥): `excludes` 하위 분기의 **등록 목록 밖 변이 14종**(X01~X14: 파일 항목 맞바꿈 4·디렉토리 항목 3·`*` 마디·앵커·꼬리·이스케이프·`.some`→`.every`·`*` 분기 무력화).

## r3-1. 재측정 (이번 턴)

| 항목 | 관측 |
|---|---|
| 코드 diff | `git diff --name-only df0883a 32fe1b0 -- app` → `app/scripts/check-product-naming.test.mjs` 1개. 검사기 `.mjs` diff 0, `app/src` diff 0 |
| 이름 검사기 | `OK — 2236파일 · 허용 13항목` · 검사기 테스트 40 pass(케이스 수 불변 — 입력만 추가) |
| `node --test scripts/*.test.mjs` | 868 pass · 0 fail |
| lint · typecheck | lint error 0 · warning 2 · `git status` 변화 0 · typecheck(`tsc` 3종 포함 test) exit 0 |
| 문서 · 예산 가드 | doc-inventory prose+links OK · test-budgets `20 real-git suites ok` |
| 전체 vitest | 945파일: **29 failed 파일 · 22 failed / 8797 passed / 11 skipped** — r2 실행과 수치 동일. production diff 0이라 기준선 worktree 재실행은 하지 않았다(r2와 같은 근거 · 22건 각각은 읽지 않음) |
| D-003 경로 diff | `499d354..32fe1b0` 중 D-003 경로 = `docs/handoff/` 파일뿐(이 handoff · INDEX) |
| 새 입력 단언 | `check-product-naming.test.mjs:'제외 항목과 이름만 비슷한 경로는 검사한다'` — 입력 4개 각각 `inScope === true` + 옛 표기 3꼴 → 위반 3건(`assert.equal(…, path)`) |

## r3-2. 고장 이력 (`mutate.py`, oracle `node --test scripts/check-product-naming.test.mjs`, 원복 "모든 파일 원문 그대로" · `git status` 빈 출력)

| ID | 자리 | 종류 | 바꾼 내용 | 결과 | 잡은 것 | 분류 |
|---|---|---|---|---|---|---|
| X01 | `excludes` 파일 항목 | 다른 값 | `===` → `startsWith` (= r2 W13·M-1) | 잡음 | `…이름만 비슷한…` 1 | — |
| X02 | 디렉토리 항목 | 다른 값 | `startsWith` → `includes` (M-2) | 잡음 | 1 | — |
| X03 | 파일 항목 | 맞바꿈 | `===` → `endsWith` | 잡음 | 1 | — |
| X04 | 파일 항목 | 다른 값 | `===` → `includes` | 잡음 | 1 | — |
| X05 | 디렉토리 항목 | 다른 값 | `startsWith` → `===` | 잡음 | 10 | — |
| X06 | 디렉토리 항목 | 맞바꿈 | `startsWith` → `endsWith` | 잡음 | 10 | — |
| X07 | `*` 치환 | 다른 값 | `[^/]+` → `.+` | 잡음 | 1 | — |
| **X08** | `*` 치환 | 다른 값 | `[^/]+` → `[^/]*` | **못 잡음** | 없음 | **동치** — 아래 |
| X09 | 정규식 앵커 | 제거 | `^` 제거 (M-3) | 잡음 | 1 | — |
| X10 | 정규식 앵커 | 다른 값 | `$` 추가(꼬리 고정) | 잡음 | 2 | — |
| X11 | 이스케이프 | 제거 | `.map(…)` 줄 제거 (M-4) | 잡음 | 1 | — |
| X12 | 이스케이프 문자 집합 | 제거 | `.` 제외 | 잡음 | 1 | — |
| X13 | `inScope` | 뒤집기 | `.some` → `.every` | 잡음 | 12 | — |
| X14 | `excludes` 분기 | 고정값 | `*` 분기 무력화(`if (false)`) | 잡음 | 1 | — |
| R01~R08 | `EXCLUDED` 항목 | 제거 | 8종 각각 (직전 W01~W08 재실행, ③④) | 잡음 8/8 | 검사기 테스트 2~5 | — |
| R20·R21 | `inScope` | 고정값 | 항상 false / true (W09·W10) | 잡음 | 20 / 12 | — |

- **X08 동치 근거**: `*`가 빈 문자열이면 경로에 빈 마디(`//`)가 있어야 맞는데 git 추적 경로에는 빈 마디가 없다. `EXCLUDED`의 `*` 항목은 `.agents/skills/*/references/` 1개(`check-product-naming.mjs:46`)이고 `*`는 마디 전체다. 열거 원문(M-1~M-4·`*`가 한 마디)에 빈 마디 분기가 없어 이행 결함도 아니다.
- ③ 직전 `못 잡음` W13 = X01 → 이제 red(r2 `못 잡음` 해소). ④ W11(`*` → `.*`) = X07 재앵커로 red 유지.
- 못 본 것: 검사기 `pathShapes`·`findOld`·허용 개수 대조는 이번 diff가 닿지 않아 재시도하지 않았다(r1 V01~V04 · r2 W12 좌표 유지).

## r3-3. Finding disposition

| ID | 분류 | disposition | 근거 |
|---|---|---|---|
| F6 | 확장 후보(r2) | **closed** | M-1~M-4 = X01·X02·X09·X11 red. 형제 변이 X03~X06·X10·X12 red |
| — | 이행 결함 · 현재 결함 | 0 | 열거 원문(AC · §10 EP-01 ⑥ 일치 규칙 4분기 · 등록 변이 4 · gate) 전부 충족 |
| — | 확장 후보 | 0 | X01~X14 중 `못 잡음` 1(X08)은 동치 |

## r3-4. V-pair closeout

| Pair | 결과 | 직접 oracle 좌표 · 관측 |
|---|---|---|
| VP-08 | PASS | `check-product-naming.test.mjs:'제외 항목과 이름만 비슷한 경로는 검사한다'` — M-1 `README.md.orig` · M-2 `app/project/x.md` · M-3 `app/.agents/skills/a/references/c.md` · M-4 `xagents/skills/a/references/c.md`. 입력마다 분기에서만 갈리는 값(경로 조각이 항목과 비슷하되 다름) · X01·X02·X09·X11 red |
| VP-01 | PASS | `gate: node scripts/check-product-naming.mjs` OK 2236파일 |
| VP-03 | PASS | §r3-1 — 실패 집합은 r2와 수치 동일, production diff 0 |
| VP-02·04·05·06·07·09 | INHERITED PASS | r2 §r2-4 좌표 유지 — 이번 diff가 닿지 않음(`git diff --name-only df0883a 32fe1b0 -- app` 1파일). 이번 턴에 재실행하지 않았다 |

## r3-5. Repository operation checks

- 커밋 `32fe1b0` trailer: `Agent: claude`·`Handoff`·`Status: implemented`·`Criteria-Met: 8/10`·`Criteria-Pending`·`Verified-By: pending` 반환 — 허용값 준수. 인용 해시 11개(`7114768`~`32fe1b0`) 전부 `commit`. `origin/main` ref가 이 환경에 없어 `main` 조상 여부는 확인하지 못했다(PR 미생성 — 병합 뒤 교정).
- `[구현자 기입]` r3 일곱 필드 모두 있음 · 강제 지점 표가 EP-01 ⑥ 4분기 전부를 담았다. AC 합계 `✅8 · ⚠️2 = 10` 행과 일치(AC2·4~7은 이번 diff가 닿지 않아 전체 gate로만 재확인).
- 사람: **AC9**(GitHub Variables 3개 이름 변경) · **AC10**(설치본 부팅·대화·산출물 게시). 순수 로직은 전부 기계 검증했다.

## r3-6. Review Signals — 사실만

- r2 F6와 같은 증상(일치 함수 하위 분기의 잠금 공백)은 ΔV2가 분기 4개를 열거한 뒤 재발하지 않았다. 등록 목록 밖 독립 축 14종 중 `못 잡음` 1은 동치.
- 반복된 환경 한계: Electron 미설치(22건), 설치본 실기 불가.
- 발견 분류: 이행 0 · 현재 0 · 확장 0 · 경계 0 · 비귀속 0 · 동치 1(X08).

## r3-7. 결론

**PASS (기계 범위)** — 모든 REQUIRED·REGRESSION pair와 필수 gate PASS. 사람 판정(AC9·AC10) 뒤 archive로 옮긴다.
