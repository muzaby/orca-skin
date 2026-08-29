# Verify — 0209-git-worktree-isolation

> 절차 정본은 [`.agents/skills/handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md).
> 설계 기준은 [`plan.md`](plan.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0209-git-worktree-isolation` |
| 검증자 | Claude Code |
| 일자 | 2026-08-29 |
| 대상 커밋/range | `04ab7ad..418dc1e` (구현 `aec9fe9`(r1) · `dd9f47c`(r2) · `418dc1e`(r3)) |
| 구현 전 plan 기준 | `04ab7ad` |
| V mode / 유효 V | `Baseline V: V1` |
| 검증 기준 plan revision | `04ab7ad:V1` |
| 라운드 | 3 |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니오 — 설계 Claude, 구현 Codex, 검증 Claude |

## 0. 기준선 / plan 변경 확인

- 기준선이 diff로 성립하는가: **예**. 설계 커밋 `04ab7ad`와 구현 커밋 3개가 갈려 있다.
- 구현 커밋의 `plan.md` 변경: `§19 [구현자 기입]` 8필드와 r2·r3 절만. `git show aec9fe9 -- docs/handoff/0209-git-worktree-isolation/plan.md` = §19 한 hunk.
- Decision Ledger 변경: 없음. D-001~D-015 전부 `04ab7ad` 원문 그대로다.
- Product/UX Contract 변경: 없음.
- AC 변경: 없음. §7 20행이 `04ab7ad`와 byte-identical(`git diff 04ab7ad..418dc1e -- plan.md`의 hunk가 §19 이후에만 있다).
- V node/pair·requiredness·§10·oracle 변경: 없음. node 17 · pair 17 · EP 12군 불변.
- 채점에 사용할 원 기준: `04ab7ad:V1`의 §3 Decision · §7 AC1~AC20 · §7-A pair 17 · §10 EP-01~EP-12.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode·상속 기준 | 유효 | 신규 capability, 기준 V `none`, 상속 재구성 불필요 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R/SD/AR/MD NEW·CHANGED 13노드 전부 동레벨 REQUIRED pair 보유 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | R-04→VP-04, SD-04→VP-08 |
| pair별 path·§10 전수·직접 oracle | 유효 | 17행 모두 production path·oracle·EP 열이 채워져 있다 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | 구조적 proxy를 쓰는 VP-04·VP-09·VP-11에 변이가 등록돼 있다 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | §15에 10개 gate가 열거돼 있고 전부 이번 산출물에 적용된다 |

- root PLAN_GAP: **없음**. 아래 FAIL은 모두 plan이 이미 명시한 oracle을 구현이 만들지 않은 것이지, 구현자가 새 계약을 발명해야 하는 자리가 아니다.
- 다만 plan §16의 "AC 전건 pair 매핑" 주장과 §7-A registry가 어긋난다 — **AC9·AC20을 인용하는 pair 행이 없다**(pair 17행의 AC 인용 집합에 9·20 부재). AC9는 §7 AT-09 행이 oracle을 직접 지정하므로 구현자의 선택 여지는 없다. 다음 revision의 기록 사항으로 §13 D8에 남긴다.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path | 충족 |
|---|---|---|---|
| D-001 Git은 Main Host 기능 | Adapter/Runtime이 worktree를 모른다 | `features/worktrees` → `infra/git` | ✅ `rg -in worktree app/src/main/adapters app/src/main/features/sessions` = 1줄, 전부 주석(`hooks.ts:8`) |
| D-002 PATH `git` + `execFile` | shell 미경유·Git 라이브러리 없음 | `infra/git/runner.ts:runGit` 단일 호출부 | ✅ 신규 dependency 0(`git diff aec9fe9^..418dc1e -- app/package*.json` 빈 diff) |
| D-005 tracked+untracked dirty 거부 | mutation 전 종료 | `repository.ts:isClean` `--untracked-files=all` | ✅ M2 변이 red |
| D-006 base = 준비 초기 full OID | branch 이동에 불변 | `service.ts:65 resolveHead` → `addWorktree(base)` | ⚠️ 코드로 성립, 잠금 0(§4 M3) |
| D-008/D-009 naming 실패 강등 | 격리는 계속 성공 | `naming.ts:chooseBranchName` | ⚠️ 코드로 성립, 잠금 0(§4 M5) |
| D-010 nullable row → bind | 동일 row가 세션에 결합 | `queries.ts:insertSession` 내부 `bindManagedWorktreeForCwd` | ⚠️ 결합은 하지만 **유일성 판정이 없다**(§13 D3) |
| D-011 이번 호출 산출물만 rollback | 반쯤 준비된 경로로 Agent 미실행 | `service.ts:90-93` / `service.ts:108-111` | ❌ add 실패 경로가 worktree를 지우지 않는다(§13 D1) |
| D-012 clean+HEAD==base만 자동 제거 | 그 외 전부 보존 | `service.ts:removeForSession` → `handlers/session.ts:105` | ✅ 코드·2상태 테스트 |
| D-013 종료·LRU에 worktree 무명령 | resume cwd 보존 | 소비처 전수 | ✅ `removeWorktree` 프로덕션 참조 3건 전부 `service.ts` |
| D-014 repo 단위 mutation queue | 같은 repo write 직렬 | `mutation-queue.ts` ← checkout·add·remove·branch | ❌ 두 생산자의 key 정규화가 다르다(§13 D2) |
| D-015 extraDirs 원값 유지 | executionCwd만 치환 | `send.ts` payload 통과 | ✅ 코드, 잠금 0 |

### end-to-end 흐름 (실측)

```text
CwdPanel 칩 → chatReducer.SET_WORKTREE_ISOLATION → chatStore.send(worktreeIsolation:true)
  → SendChatMessageSchema.superRefine → send.ts:139 prepare
      → canonicalPath → resolveRepoRoot → isClean → resolveHead
      → chooseBranchName → addWorktree(queue) → insertManagedWorktree
  → buildTurnContext(cwd=executionCwd) → turn.cwd → TurnRequest.cwd → claude.ts query cwd
  → HistoryWriter.persist(session.updated) → insertSession(cwd) → bindManagedWorktreeForCwd
  → session:delete → removeForSession → isClean/HEAD 비교 → removeWorktree → deleteBranch → DB
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 부분 실패가 남는다 | `worktree add` 실패·취소 시 `deleteBranch`만 실행 — 등록된 worktree와 디렉터리가 남는다(§13 D1) |
| false success 가능성 | 있다 | 서비스 성공 여부와 무관하게 `executionCwd`가 worktree 안임을 보는 유일 단언이 항등식이다(§4) |
| partial failure/rollback | 비대칭 | DB insert 실패 경로(`service.ts:108-111`)는 remove+branch+rm 3단, add 실패 경로는 branch 1단 |
| Product/UX의 A가 아닌 B를 구현했는가 | 두 곳 | plan §9의 `prepare-worktree.ts` seam 미생성 · plan §10 DB표의 "유일 row·모호하면 보존"이 first-match로 대체 |
| 증상만 제거하고 상태가 남았는가 | 해당 없음 | — |
| 최적화가 잃은 관측 | 해당 없음 | — |
| 출력/요청 worst-case 상한 | 유계 | naming completion 1회·10초, 충돌 루프 상한 9999(실측 도달 불가), Git read 4~6 + write 1 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 04ab7ad..418dc1e   # 26 파일
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `infra/git/worktree.ts::listWorktrees` | **미배선** | 프로덕션 0 · 테스트 0. plan §13(취소 후 실제 상태 확인)과 §5(외부 worktree 비교 관측)의 유일한 메커니즘이다 → §13 D1·D6 |
| `infra/git/worktree.ts::parseWorktreeList` | 테스트 전용 | 프로덕션 참조 1건이 `listWorktrees` 자신뿐 — 죽은 가지 안의 잎 |
| `service.ts::PrepareWorktreeResult`·`DeleteManagedWorktreeResult` | 정상 | 정의 파일 시그니처용 타입 export |
| `queries.ts::listUnboundManagedWorktrees*` | 정상 | private stmt, `bindManagedWorktreeForCwd`가 소비 |
| 형제 정책 비대칭 | **결함 1** | `git-cli.ts:repoRoot`는 raw `--show-toplevel`, `repository.ts:resolveRepoRoot`는 `canonicalPath` — 같은 queue key를 다른 정규화로 만든다(§13 D2) |
| producer ↔ consumer 파생 불일치 | 없음 | `DeleteSessionResult`가 main·preload·renderer facade·store 4좌표에서 같은 union |
| 동일 규칙 중복 구현 | SSOT 유지 | branch 문자셋은 `GitBranchNameSchema`(사용자 입력)와 `check-ref-format`(내부 생성)로 역할이 갈린다 |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 실제 존재: ✅ `git-cli.test.ts`·`handlers/git.test.ts`·`migrate.test.ts` 전건 green.
- structural proxy만으로 통과시킨 AC: **AC3·AC5(cwd 절반)·AC10·AC18** — 아래 소거 변이가 전부 침묵했다.
- **선택된 적대 증거 재측정** — plan §12 등록 변이 7건 중 **검출 3 · 미검출 3 · 실행 불가 1**:

| 변이 | 재현 | 결과 | 판정 |
|---|---|---|---|
| M1 prepare await 제거 | 관측 가능한 스위트 없음 | 실행 불가 | 아래 소거 변이로 대체 |
| M2 untracked 무시 | `--untracked-files=all` → `=no` | **red 2건** | 검출 |
| M2(구현자 보고형) | 플래그 자체를 제거 | **green 4/4** | 보고된 형태는 동작 보존 변이다 — `--porcelain` 기본값이 이미 `??`를 낸다 |
| M3 base OID → `'HEAD'` | `service.ts:87` | **전 스위트 green 2584** | 미검출 |
| M4 Adapter가 worktree 생성 | 정적 sweep | 0줄 | 검출(구조) |
| M5 naming catch 제거 | `naming.ts` try/catch | **전 스위트 green 2584** | 미검출 |
| M6 dirty를 clean 취급 | `removeForSession` dirty 분기 삭제 | **red 1건** | 검출 |
| M7 global queue key | `tails` key 상수화 | **red 1건** | 검출 |

- **추가 소거 변이(검증자 실행)** — 세 건 모두 침묵했다:

| 변이 | 범위 | 결과 |
|---|---|---|
| `send.ts`의 격리 배선 **전체 삭제**(블록 + `cwd: payload.cwd ?? null` 복귀 + 미사용 import 정리) | typecheck 3구성 · lint · 전 스위트 | **전부 green**(0 error, 255/256 파일, 2584/2584) |
| `executionCwd = resolve(actualRoot, subpath)` → `actualRoot`(하위 cwd 보존 제거) | 전 스위트 | **green 2584** |
| VP-04 등록 변이 `runner가 read env를 잃는다`(`GIT_OPTIONAL_LOCKS` 제거) | `infra/git` + `app/handlers` 9파일 | **green 47** |

- 소거 변이의 잔여물 수렴: 배선 삭제 변이는 미사용 import까지 치운 2단계 상태에서 lint 0 error·typecheck 0줄이다. 잔여물에 걸린 red가 아니라 **진짜 침묵**이다.
- 구조적 proxy 엄격화: 구현자의 `rg "createWorktree|addWorktree|removeWorktree"` 0건을 `rg -in "worktree"`로 넓혀 재측정 → 차집합 1줄, `adapters/hooks.ts:8`의 SDK 훅 이름 주석이며 호출이 아니다. **0건은 전수다.**
- `N회`/순서 기준의 관측 주체: 없다. AC3의 "add resolve 전 runtime acquire 미호출"을 관측하는 훅·로그·주입 경계가 코드에 없다.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | req. | 결과 | 직접 검증 증거 | production path / §10 |
|---|---|---|---|---|---|
| VP-17 | MD-04 ↔ UT-04 / UT | REQUIRED | **PASS** | `mutation-queue.test.ts` 1케이스 + M7 red | canonical root → chain → mutation / EP-12 4/4 진입 |
| VP-16 | MD-03 ↔ UT-03 / UT | REQUIRED | **PAIR_FAIL** | untracked만 닫힘(M2 red). managed/external 분류가 코드에 없다 | EP-11 2/3 |
| VP-15 | MD-02 ↔ UT-02 / UT | REQUIRED | **PAIR_FAIL** (root) | `naming.test.ts` 부재. M5 미검출 | EP-10 4분기 구현·0 잠금 |
| VP-14 | MD-01 ↔ UT-01 / UT | REQUIRED | **PAIR_FAIL** (root) | 유일 단언이 항등식(§4). path table·`<userData>` containment·AC18 단언 부재 | EP-09 2/2 구현·0 잠금 |
| VP-12 | AR-04 ↔ IT-04 / IT | REQUIRED | **PAIR_FAIL** | exec seam 미구현(plan §7 "AC 검증 주의사항"이 요구). 생산자 2개의 key 정규화 상이 | EP-04 5/5 · EP-12 key 불일치 |
| VP-13 | AR-05 ↔ IT-05 / IT | REQUIRED | **PASS** | `managed-worktrees.test.ts` 실 SQLite: insert(null) → bind → `ON DELETE SET NULL` | migration → queries → service / EP-05 2/2 |
| VP-11 | AR-03 ↔ IT-03 / IT | REQUIRED | **PAIR_FAIL** | 정적 절반만(adapter import 0). 최종 query cwd·extraDirs 단언 0 | EP-08 4좌표 구현·0 잠금 |
| VP-10 | AR-02 ↔ IT-02 / IT | REQUIRED | **PAIR_FAIL** | DbQueries 원자성만. HistoryWriter 이벤트 순서 관측 0, 등록 변이(순서 swap) 미실행 | EP-06 2/3 |
| VP-09 | AR-01 ↔ IT-01 / IT | REQUIRED | **BLOCKED_BY:VP-05** | IPC→service 통합 요청/args 테스트 부재 | EP-01~04 |
| VP-08 | SD-04 ↔ ST-04 / ST | REGRESSION | **PAIR_FAIL** | 음성 절반은 전수로 성립(`removeWorktree` 호출부 3건 전부 service). 짝인 양성 resume 관측 0 | EP-07 2/2 |
| VP-07 | SD-03 ↔ ST-03 / ST | REQUIRED | **PAIR_FAIL** | 4상태 중 2(clean·dirty). has-commits·check-failed 관측 0, 호출 순서 단언 0 | EP-06·EP-07 |
| VP-06 | SD-02 ↔ ST-02 / ST | REQUIRED | **PAIR_FAIL** | reopen/resume 미관측. bind가 유일성 판정 없이 first-match(§13 D3) | EP-05 2/2 · EP-06 2/3 |
| VP-05 | SD-01 ↔ ST-01 / ST | REQUIRED | **PAIR_FAIL** (root) | 배선 전체 삭제가 green(§4). AC4 rollback 자체도 불완전(§13 D1) | EP-03 1/2 — `prepare-worktree.ts` 미생성 |
| VP-04 | R-04 ↔ AT-19 / AT | REGRESSION | **PAIR_FAIL** | 양성 회귀는 green(전 스위트 2584). 등록 변이(read env 상실) 미검출 | EP-04 5/5 |
| VP-03 | R-03 ↔ AT-15 / AT | REQUIRED | **BLOCKED_BY:VP-07** | handler 경로·결과 union 관측 0 | EP-06·EP-07 |
| VP-02 | R-02 ↔ AT-14 / AT | REQUIRED | **PAIR_FAIL** | ENOENT/non-repo fixture 없음. 후속 send 생존 관측 0 | EP-03·EP-08 |
| VP-01 | R-01 ↔ AT-02 / AT | REQUIRED | **PAIR_FAIL** | reducer 절반만(`chatReducer.worktree.test.ts`). 칩 관측 0 — 등록 변이 "chip 제거 시 red"가 성립하지 않는다 | EP-01 3/3 구현 |

- root `PAIR_FAIL`: **VP-05**(송신 경로 seam·oracle 부재) · **VP-14**(항등 단언) · **VP-15**(naming oracle 부재).
- 종속 `BLOCKED_BY`: VP-09 → VP-05 · VP-03 → VP-07.
- 합계: **PASS 2 · PAIR_FAIL 13 · BLOCKED_BY 2 = 17**. 자기보고 `SELF_PASS 17/17`과 불일치.
- 이번 라운드 실행 범위: 최초 검증 — 유효 V의 REQUIRED/REGRESSION 17건 전건 + §15 gate 10건.

### AT / AC 세부와 합계

| AC | 결과 | 검증 증거 |
|---|---|---|
| AC1 execFile 배열·shell=false | ✅ | `runner.ts:29` 단일 execFile 호출부 · shell git 0건 · 신규 dep 0 |
| AC2 신규 세션만·기본 off | ✅ | `chatReducer.worktree.test.ts` 3단언 재실행 green |
| AC3 Agent 실행 전 생성 | ⚠️ | `send.ts:139-160` prepare await가 `startNew`·`acquireTurnRuntime`보다 앞. 관측 oracle 0 |
| AC4 실패·취소 시 이번 산출물만 rollback | ❌ | add 실패 경로가 worktree를 제거하지 않는다(`service.ts:90-93`) |
| AC5 Adapter는 executionCwd만 | ✅ | 정적 sweep 0(엄격화 후에도) · typecheck 3구성 green |
| AC6 Runtime 구조 불변 | ✅ | `session-runtime.ts`·`turn-coordinator.ts` diff 0 · 전 스위트 green |
| AC7 신규 일반 세션 전용 | ✅ | `protocol.worktree.test.ts` 4조합 재실행 green |
| AC8 tracked+untracked dirty 거부 | ✅ | `service.test.ts` untracked 케이스 + M2 red |
| AC9 base = 최초 HEAD OID | ⚠️ | 코드로 성립. M3 미검출 — 잠금 0, 인용 pair 0 |
| AC10 repo 밖 UUID 경로 + 하위 cwd 보존 | ⚠️ | 경로 구성은 코드로 성립. **하위 cwd 보존은 잠금 0**(소거 변이 green) |
| AC11 naming 실패가 격리를 실패시키지 않음 | ⚠️ | 코드로 성립. M5 미검출, 테스트 파일 없음 |
| AC12 null row → 동일 row bind | ⚠️ | bind는 성립(`managed-worktrees.test.ts`). 동일성 보장이 cwd 포함 first-match |
| AC13 resume 동일 cwd · 종료 시 미제거 | ⚠️ | 미제거는 전수로 성립. resume은 `turn-context.ts:63` 독해뿐 |
| AC14 Git 오류가 해당 send 오류 | ⚠️ | 코드로 성립. 테스트 0. 사유가 `schema_validation_error`로 분류된다(§13 D5) |
| AC15 clean+HEAD==base만 제거 | ⚠️ | 4상태 중 2 관측 |
| AC16 external 무mutation | ✅ | 삭제 대상이 managed row에서만 나온다 — 구조로 성립(설계한 분류기는 미배선) |
| AC17 같은 repo 직렬·다른 repo 병렬 | ❌ | queue 단위는 green. **두 생산자의 key 정규화가 달라 Windows에서 갈린다**(§13 D2) |
| AC18 extraDirs 원값 | ✅ | `send.ts:179` payload 통과 — 코드로 성립, 잠금 0 |
| AC19 기존 Git 의미 유지 | ✅ | `git-cli.test.ts` 포함 전 스위트 2584 green |
| AC20 한국어·키보드 접근 | ⚠️ | ko/en 키 2쌍 존재 · `<button>` 실체. 토글 상태가 `aria-pressed` 없이 색으로만 표현된다(§13 D4) |

- **합계 재측정**: **✅ 9 · ⚠️ 9 · ❌ 2 = 20**. 자기보고 `✅19 · ⚠️1 · ❌0` — **불일치**.
- **합계 사본 대조**: plan §19 `19/20` ↔ 커밋 trailer 3개 `Criteria-Met: 19/20` ↔ INDEX 비고 `19/20` — 자기보고끼리는 일치, 재측정과 불일치.

### pair별 plan §10 강제 지점 분모 (검증자 재열거)

| EP | plan이 적은 지점 | 코드에서 확인 | 결과 |
|---|---|---|---|
| EP-01 renderer 3축 | reducer·store·CwdPanel | 3/3 | PASS |
| EP-02 shared/preload 4축 | ipc·protocol·preload type·renderer api | 4/4 (`index.d.ts`가 `OrcaApi` 파생) | PASS |
| EP-03 준비 순서 2곳 | `send.ts` + `prepare-worktree.ts` | **1/2** — seam 모듈 미생성 | PAIR_FAIL(VP-05) |
| EP-04 Git process 5곳 | runner·repository·worktree·git-cli·handler | 5/5 | PASS |
| EP-05 migration 2곳 | 0018 SQL + migrate.ts | 2/2 (`check-migrations-appendonly` sync ok: 18) | PASS |
| EP-06 metadata 3곳 | DbQueries + HistoryWriter/app callback + service | **2/3** — bind가 `insertSession` 내부로 접혔다 | PAIR_FAIL(VP-06·VP-10) |
| EP-07 lifecycle | session handler + shutdown/supervisor 전수 | 2/2 | PASS |
| EP-08 cwd 종단 4좌표 | prepare→context→request→query | 4/4 | PASS(잠금 없음) |
| EP-09 path SSOT 2곳 | paths + service mapping | 2/2 | PASS(잠금 없음) |
| EP-10 naming 4분기 | prompt·normalize·collision·fallback | 4/4 | PASS(잠금 0 → VP-15) |
| EP-11 분류 3종 | porcelain · HEAD/base · managed/external | **2/3** — 세 번째 분류기 미배선 | PAIR_FAIL(VP-16) |
| EP-12 mutation 4진입 | checkout·add·remove·deleteBranch | 4/4 진입, **key 정규화 1/2 생산자** | PAIR_FAIL(VP-12) |

- 재열거 합계 **9군 일치 · 3군 부분**(EP-03 1/2 · EP-06 2/3 · EP-11 2/3). 자기보고 `12/12군`과 불일치.
- 표 밖인데 같은 불변식이 필요한 지점: 없음.

### 현재 변경의 운영 gate (plan §15)

| Gate | 결과 | 관측한 실행 산출 |
|---|---|---|
| 1 `npm run typecheck` | PASS | node·web·test 3구성, 출력 0줄 |
| 2 `npm run lint` + 트리 확인 | PASS | 0 error · warning 1(기존 `useTranscriptVirtualizer`) · `git status` 변화 없음 |
| 3 관련 순수 suite | PASS | `vitest run src/main/features/worktrees src/main/infra/git src/main/infra/db …` = **10파일 75케이스** |
| 4 DB suite | PASS(조건부) | `npm rebuild better-sqlite3`(Node ABI) 후 전 스위트 **255/256 파일 · 2584/2584 케이스** |
| 5 `check-migrations-appendonly.mjs` | PASS | `sync ok: 18 migrations` · `no-copies ok: 807 files` |
| 6 `check-doc-inventory.mjs --check` | PASS | `generated doc ok (9 items, 79 channels)` · prose ok · links ok |
| 7 `git diff --check` | PASS | 출력 0줄 |
| 8 architecture sweep | PASS | 엄격화 후 차집합 1줄(주석), 호출 0 |
| 9 dependency sweep | PASS | package/lock diff 0 · shell git 0 |
| 10 Windows 사람 실기 | 미수행 | 이 환경에 Electron 바이너리·Windows 없음 |
| (추가) `node --test scripts/*.test.mjs` | PASS | 59/59 |

- 환경 기인 실패 분리: **1파일 0건 수집** — `app/chat-turn.continuity.test.ts`가 `Electron failed to install correctly`. `app/AGENTS.md §제약 환경` 의 알려진 서명이며 변경 무관이다. 이 스위트는 이번 변경의 어떤 pair도 인용하지 않는다(격리 코드 참조 0).
- 게이트가 작업 트리를 바꿨는가: **없음**. `lint --fix` 실행 후 `git status --short` 빈 출력.
- 검증 중 실행한 명령의 잔여물: `npm ci --ignore-scripts` + `npm rebuild better-sqlite3`가 `app/node_modules`를 만들었다. 추적 대상이 아니며(`.gitignore`) 커밋에 섞이지 않았다.

## 6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| `orca:session:delete` → `DeleteSessionResult` | ✅ main·preload·facade·store 동일 union | ⚠️ `handle(..., {fallback: undefined})`가 zod 실패 때 `undefined`를 돌려준다 — 타입은 union이다(§13 D7) | 부분 |
| `orca:chat:send.worktreeIsolation` | ✅ `IPC_CONTRACT.md` 갱신됨 | ✅ superRefine 4조합 test | PASS |
| `0018_managed_worktrees` | ✅ `persistence.md` 갱신됨 | ✅ 실 SQLite FK 동작 | PASS |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 신규 테스트 파일 재측정: **6개**(service·mutation-queue·worktree·managed-worktrees·protocol.worktree·chatReducer.worktree) + `migrate.test.ts` 기대값 1행. plan §14가 예고한 신규 test는 9종이다.
- plan §14 신규 파일 중 미생성: `runner.test.ts` · `repository.test.ts` · `naming.test.ts` · `mutation-queue` 외 `prepare-worktree.ts`+test — **4종**.
- 0건 게이트의 정당한 예외 보존: `rg -in worktree` 차집합 1줄이 SDK 훅 이름 주석이다. 지워야 할 항목이 아니다.
- 상한 재계산: naming 충돌 루프는 최대 9999회 × Git read 2회. 실제 도달 조건(같은 slug 9999 branch)은 없지만 상한이 시간으로 유계가 아니다 — §13 D9.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증 가능 범위(미구현) | 남은 사람 실기 |
|---|---|---|
| 준비 순서 AC3/AC4 | `prepare-worktree.ts` seam을 만들면 deferred promise로 순서·rollback 전부 UT | 없음 |
| naming AC11 | `complete`/`validate`/`exists` 주입 포트가 이미 인자다 — fixture만 있으면 전건 UT | 없음 |
| path AC10 | `subpath != ''` fixture 한 줄이면 잠긴다 | 없음 |
| Git 인자/env AC1·AC17 | `runGit`에 `execFile` 주입 인자를 두면 args·env·queue 순서 전부 관측(plan이 이미 요구) | 없음 |
| 칩 AC2/AC20 | 렌더 하네스는 없지만 `CwdPanel.landing.test.ts`의 소스 스윕 선례가 있다 | Windows 포커스·배치 시각 확인 |

- "UI/electron이라 불가"로 남길 항목은 **AC20의 시각·포커스 실기 하나뿐**이다. 나머지는 전부 순수 seam이다.

## 9. 게이트 재실행

실행 명령과 관측 산출은 §5 「현재 변경의 운영 gate」 표에 있다. 요약: lint 0 error · typecheck 0줄 · vitest 255/256 파일 2584 케이스 · scripts 59/59 · 문서·마이그레이션·diff gate 전건 green.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/자동 테스트 | 에이전트 실행 — 위 산출 |
| AC ↔ production path 1:1 | 에이전트 — 20행 재대조, 재측정 합계 §5 |
| 레이어/계약/문서 링크 | 에이전트 — boundaries lint 0 error, doc-inventory links ok |
| 제품 의도 / Open Question | 없음 — 이번 라운드에 사용자 결정 필요 항목 0 |
| UI 시각 품질 | 사람 — AC20 Windows 실기 |
| 신규 의존성 | 해당 없음 — 0건 |

## 11. Repository operation checks

### AGENTS.md 위생

- 이번 변경에 `AGENTS.md` 수정 없음 — 위생 검사 대상 아님.

### INDEX 보드 정합성

- 상태·다음 주체·라운드: 이번 커밋에서 `verify/FAIL` · `Codex` · 라운드 4로 갱신했다.
- 대상 커밋 좌표: 검증자가 기입 — `aec9fe9`(r1) · `dd9f47c`(r2) · `418dc1e`(r3). 넷 다 `git cat-file -t` = commit.
- 비고 5줄 이내: 갱신한 0209 행을 5줄 이내로 적었다.

### Commit / reference 정합성

- trailer 허용값: ✅ 세 구현 커밋 모두 `Agent: codex` · `Status: implemented` · `Criteria-Met/Pending` · `Verified-By: pending`.
- trailer 파싱: ✅ `git log -1 --format='%(trailers:only=true)' <각 커밋>`이 적힌 5키를 그대로 돌려준다.
- 인용 해시 실재: ✅ `04ab7ad`·`aec9fe9`·`dd9f47c`·`418dc1e` 전부 commit.
- 재구현 라운드 `[구현자 기입]` 7필드: **r2·r3 절이 4~5줄 산문 5항목**이다 — 강제 지점 전수·이번 라운드 수정의 잠금·Product/UX 파생 검토·놓친 잠재 문제가 개별 필드로 없다. r3의 "AC/V/EP 분모는 r2와 같다" 한 줄이 세 필드를 대신한다.
- 이동/삭제한 reference·script: 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| "M2는 service test dirty case red" | **미성립** | 보고된 형태(`--untracked-files=all` 제거)는 동작 보존 변이다 — 재현 시 4/4 green. 충실한 형태(`=no`)는 red |
| r2 "문자열 prefix proxy를 path containment 술어로 교체" | 타당하나 무효 | 술어는 옳아졌지만 fixture의 `subpath`가 `''`이라 단언이 `isWithinDir(x, x)` 항등식이다 |
| r3 "child와 parent 모두 canonical identity" | 타당하나 무효 | identity 단계는 맞춰졌다. 같은 항등식이 남아 잠그는 것이 없다 — 소거 변이 green |
| "V pair SELF_PASS 17/17" | **미성립** | 재측정 PASS 2 |
| "강제 지점 12/12군" | **부분 미성립** | 재열거 9군 일치 · 3군 부분 |
| NON_BLOCKING D1/D2(외부 worktree·branch 정리 후속) | 타당 | §13에 승계 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | `worktree add` 실패·취소 시 worktree를 제거하지 않는다 — `deleteBranch`만 실행하고 등록 entry·디렉터리가 남는다(`service.ts:90-93`). plan §13의 `listWorktrees`로 실제 상태 확인 후 조건부 rollback이 미배선 | D-011 · AC4 · VP-05 | **BLOCKING** | 구현 |
| D2 | 같은 repo의 두 mutation 생산자가 다른 queue key를 만든다 — `git-cli.ts:repoRoot`는 raw `--show-toplevel`, `repository.ts:resolveRepoRoot`는 `canonicalPath`. POSIX에서는 두 값이 일치(실측)하지만 Windows의 `C:/…` ↔ `path.win32.normalize` `C:\…`는 다른 Map key다 | D-014 · AC17 · VP-12 · EP-12 | **BLOCKING** | 구현 |
| D3 | bind가 `worktree_root`가 cwd의 조상인 **첫** unbound row를 잡는다(`queries.ts:bindManagedWorktreeForCwd`). plan §10 DB표는 "유일 row … 모호하면 보존+로그"를 요구한다. 미bind orphan이 남은 뒤 사용자가 그 디렉터리를 cwd로 고르면 무관한 세션이 그 row를 가져가고, 그 세션 삭제가 남의 worktree를 지운다 | D-010 · AC12 · VP-06 | **BLOCKING** | 구현 |
| D4 | 토글 칩이 상태를 색으로만 알린다 — `aria-pressed` 없음. 또한 `ComposerChip`의 `className` 계약("색·테두리·높이는 chipSurface가 소유, 여기서 덮지 않는다")을 `border-accent text-accent`로 위반한다 | AC20 · VP-01 | NON_BLOCKING | 구현(다음 라운드에 함께) |
| D5 | Git/dirty 거부가 `makeClassifiedError('schema_validation_error', …)`로 나간다(`send.ts:157`). 스키마 오류가 아니다 | AC14 · VP-02 | NON_BLOCKING | 구현 |
| D6 | `listWorktrees`·`parseWorktreeList`가 프로덕션 미배선(참조 0). D-013의 부팅 reconciliation과 §5의 external 비교 관측이 코드에 없다 | D-013 · AC16 | NEXT_HANDOFF | 후속 handoff |
| D7 | `session:delete` 핸들러가 `{fallback: undefined}`인 채 `DeleteSessionResult`를 반환 타입으로 선언한다 — zod 실패 시 renderer가 `undefined.ok`를 읽는다 | AC15 | NON_BLOCKING | 구현 |
| D8 | plan §16은 AC 전건 pair 매핑을 주장하지만 §7-A registry에 AC9·AC20을 인용하는 pair 행이 없다 | plan §7-A | 기록 | planner(다음 revision) |
| D9 | naming 충돌 루프 상한이 9999회 × Git read 2회다. 도달 조건은 비현실적이나 시간으로 유계가 아니다 | 성능 | NON_BLOCKING | 구현 |
| D10(승계) | 외부 worktree UI·orphan 관리 · add 실패 후 branch 잔여 | 구현자 D1·D2 | NEXT_HANDOFF | 후속 |

- `PLAN_GAP`: **없음**. 위 BLOCKING 3건과 pair 미달 13건은 전부 plan이 이미 지정한 계약·oracle을 구현이 만들지 않은 것이다.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: **있다.** r2·r3 두 라운드가 같은 한 단언(`service.test.ts`의 containment)만 고쳤고, 그 단언은 이번 재측정에서 항등식으로 확인됐다. 세 라운드에 걸쳐 잠금이 늘지 않았다.
- 관련 plan 지침/AC의 존재 여부: **있었다.** `prepare-worktree.ts` seam(§9·§14·EP-03)과 `execFile` 주입 seam(§7 "AC 검증 주의사항")은 plan이 명시했고, 둘 다 미구현이다. 이 두 seam의 부재가 VP-05·VP-09·VP-11·VP-12의 oracle 부재와 같은 원인이다.
- 사용자 결정 변경 근거: 없음. SUPERSEDED 0.
- 반복된 검증 환경 한계: `chat-turn.continuity.test.ts` 0건 수집(Electron 바이너리 부재)이 r1부터 이번 라운드까지 동일하다. 렌더 하네스 부재(`@testing-library` 0건)도 반복 조건이다.

## 15. 결론

- 상태: **FAIL**
- pair 결과: PASS 2(VP-13·VP-17) · root PAIR_FAIL 3(VP-05·VP-14·VP-15) · PAIR_FAIL 10 · BLOCKED_BY 2
- PLAN_GAP: 없음 — 다음 주체는 구현자다
- Product/UX 및 ACTIVE Decision: D-011·D-014·D-010 세 건 미충족(§13 D1·D2·D3). 나머지 12건은 코드로 성립
- AC: ✅ 9 · ⚠️ 9 · ❌ 2 = 20 (자기보고 19/20과 불일치)
- 현재 변경 운영 gate: 10건 중 9건 PASS · 1건(Windows 사람 실기) 미수행. 환경 기인 red 1파일은 변경 무관
- NON_BLOCKING: D4·D5·D7·D9 / NEXT_HANDOFF: D6·D10 / 기록: D8
- repository operation checks: trailer·해시·INDEX는 정합. `[구현자 기입]` r2·r3 절이 impl §8의 7필드를 갖추지 못했다
- 남은 사람 확인: AC20의 Windows Electron 배치·포커스 시각 확인 하나뿐
- 다음 단계: 라운드 4다. **재구현 전에 `handoff-review`를 수행한다**(라운드 3 초과). 그 뒤 구현자는 (1) `prepare-worktree.ts`와 `runGit`의 주입 seam을 만들어 VP-05·VP-09·VP-11·VP-12의 oracle을 세우고, (2) D1·D2·D3를 고치고, (3) VP-14·VP-15·VP-16의 fixture를 `subpath != ''`·naming failure matrix·managed/external로 채운다
