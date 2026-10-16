# Verify — 0265-harness-native-storage

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 문장은 [`§산출물 문장 규칙`](../AGENTS.md)을 따른다 — 판정 먼저, 주장 한 줄에 관측 하나.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0265-harness-native-storage` |
| 검증자 | Claude Code |
| 일자 | 2026-10-16 |
| 대상 커밋/range | V1 `8dcf8ee3..4dc81c8f` · ΔV1 `0aecaa8d..bb6ce719` · ΔV2 `350281c7..655fa0e0` |
| 구현 전 plan 기준 | V1 `8dcf8ee3` · ΔV1 `0aecaa8d` · ΔV2 `350281c7` (각각 설계 단독 커밋) |
| V mode / 유효 V | Baseline V1 + ΔV1 + ΔV2 (plan 메타는 `V1 + ΔV1`로 남음 — N-0265-4) |
| 검증 HEAD | `655fa0e0` (공유 브랜치 `origin/codex-opencode-harness`) |
| 라운드 | 1 (V1·ΔV1·ΔV2 모두 첫 검증) |
| 상태 | **RETURN_TO_PLAN** — PLAN_GAP 2 + BLOCKING 2 |
| 자기 검증 여부 | 설계 Claude(V1·ΔV1 초안)·Codex(ΔV1 확정·ΔV2) · 구현 Codex · 검증 Claude — 구현자 ≠ 검증자 |

## 0. 기준선 / plan validity

- 기준선 성립: 예 — 세 구현 커밋의 plan 삭제 줄은 메타 `상태`(ΔV1은 `V mode` 1줄 추가)뿐이다. EP10~13은 구현 전 설계 커밋 `8dcf8ee3`이 추가했다.
- V1·ΔV1: NEW node마다 같은 레벨 REQUIRED pair, 영향 INHERITED는 VP-Δ1-R1 REGRESSION. 분모 V1 50 · ΔV1 22. 유효.
- ΔV2: AC15~18마다 R↔AT와 하위 레벨 node를 한 pair ID(VP2-1~4)에 묶었다. 이 문서는 행마다 두 레벨을 공유 증거로 판정한다. 분모 16.

| 검사 | 판정 | 근거 |
|---|---|---|
| Decision 정합 | **PLAN_GAP** | ΔV2 D14·D15(원본 부재 시 보관 대화를 첫 prompt에 실어 복구)가 V1 **D02 ACTIVE**("원본 실행 컨텍스트를 DB 전문 재전송으로 대체하지 않음")·V1 §8 "Orca 저장 본문으로 새 세션을 만들거나 자동 prompt하지 않는다"·AC5와 정면 충돌하는데 ledger에 SUPERSEDED 표시가 없다. `app/AGENTS.md:86`도 "원본 오류 때 DB 전문을 재전송해 새 세션을 만들지 않는다"를 유지 (G-0265-2) |
| 출력/요청 상한 | **PLAN_GAP** | D15·AC17은 복구 첫 prompt에 보관 대화 전체를 싣는다고만 정한다. `features/history/native-recovery.ts:38-41 archivePrompt`는 전체 메시지의 role+parts를 JSON으로 직렬화하고 `adapters/common/recovery.ts recoveredPrompt`가 그대로 앞에 붙인다 — 상한·초과 시 동작이 없다 (G-0265-1) |
| 운영 gate 범위 | 유효 | §11·ΔV1·ΔV2가 관련 Vitest·SQLite·migration·inventory·build를 열거. PR CI는 `docs/handoff/AGENTS.md §구현 게이트의 정본`이 통합 gate로 둔다 |

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 | 실제 production path |
|---|---|---|
| D01·D05 | native 원본 경로, 하네스별 해석 | `adapters/claude/native-history.ts`·`opencode/v1/native-history.ts` ← `app/native-history.ts` 조립 |
| D04 | 목록 제거 = `hidden_at`, 원본·worktree 보존 | `app/handlers/session.ts` delete → `queries.ts` 숨김 필터 6자리 |
| D06·D08~D10 | DB 선표시 → 두 frame 뒤 lazy refresh → snapshot+cursor+FTS 원자 교체 | `chatStore.ts:1572-1592` → `session.refresh` → `native-sync.ts` → `native-history-queries.ts` |
| D11 | 로딩 중 hydration·SET_MODEL·send 보류, 저장 backend 복원 | `Composer.tsx:188` · `chatReducer.ts:1604` · `chatStore.ts:931` · `LOAD_SESSION` |
| D13 | lazy 실패는 조용히 보관 유지 | `chatStore.native-history.test.ts:quietly shows the retained archive when native is %s` |
| D14~D16 | missing만 복구, Claude 같은 UUID fresh · OpenCode 새 ID binding, 첫 prompt 영수증 | `chat-turn/native-session.ts prepareNativeSession` → `send.ts:557-574` → adapter `recovery` |

## 2. 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 대상 플랫폼 실패 | **있음** | Windows PR CI가 #773(`8c94b449`)부터 #779(HEAD)까지 7회 연속 red. 매번 같은 3케이스: `adapters/claude/native-history.test.ts` `distinguishes an absent original from permission failures`(ready≠unavailable)·`does not replace a snapshot if its revision changes at read boundary 3/4`(ready≠busy) |
| 그 실패의 원인 | 테스트 결함 | 테스트 mock이 `String(target) === f.file`로 비교하는데 reader는 `realpath(native.projects)`로 경로를 정규화한다(`native-history.ts:139`). symlink TMPDIR로 Linux에서 같은 3건 재현, 비교를 basename으로 바꾼 임시 사본은 14/14 통과 → production 분류는 정상, oracle이 대상 플랫폼에서 production 경로를 관측하지 못함 |
| false success | 있음(보고) | 구현 보고·INDEX 어디에도 CI red가 없다. 로컬 gate만 PASS로 적었다 |
| 복구 worst-case | 미정의 | 긴 대화에서는 보관 JSON이 모델 컨텍스트를 넘길 수 있다. 첫 사용자 메시지가 native에 저장된 뒤 거절되면 이후 resume마다 같은 거대 메시지를 싣게 된다 — 제품 결정 필요(G-0265-1) |
| 분산 쓰기 | 설계대로 | native create 성공 후 DB CAS 실패 시 빈 native 세션이 남는다(D16 수용). CAS 제거 변이 M0265-07 red |
| 원본 보존 | 정상 | 실제 CLI 통합(아래 §6)에서 native config 바이트·legacy export 불변 |

## 3. 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| `native-storage.testfixture.ts` 환경 격리 | 결함(테스트 위생) | `PWD`를 지우지 않아 상속된 `PWD`(저장소 app 경로)로 `opencode run`이 별도 인스턴스를 만들고 종료하지 않는다 → 90초 timeout. `env -u PWD`로는 통과 (N-0265-1) |
| `app/AGENTS.md:86` | drift | ADR-009·persistence.md는 ΔV2로 갱신, 작업 규칙은 미갱신 (G-0265-2) |
| reducer `SET_MODEL` 로딩 가드 | 중복 가드 | 제거 변이 M0265-20 green — Composer 효과 가드(EP18a)·LOAD_SESSION 복원(EP18c)·send 차단(EP18d)이 같은 실패 의미를 막는다 |
| store load token 비교 | 중복 가드 | 제거 변이 M0265-24 green — 새 LOAD_SESSION이 messages identity를 바꿔 늦은 응답을 이미 거부 |

## 4. 적대 증거 재측정

등록 적대 증거: V1·ΔV1·ΔV2 모두 `not selected`(직접 oracle). 아래는 구현 보고에 없던 독립 축이며 blocking 범위를 정하지 않는다.

| 변이 | 결과 | 검출 oracle |
|---|---|---|
| M0265-01 unavailable도 복구 | **red** | `native-session.test.ts:… does not create a session for unavailable` |
| M0265-02 flush 요청에 `recovery` 잔존 | **red** | `continuation.test.ts:buildFlushRequest …` |
| M0265-03 재조회 마스킹 제거 | **red** | `app/native-history.test.ts:… masks its recovery input …` |
| M0265-04 Claude freshStart 무시 · M0265-05 echo 마스킹 제거 | **red** ×2 | `adapter.fork.test.ts:… recreates an expired conversation with the original UUID …` |
| M0265-06 writer `acceptRecovery` 제거 | **red** | `native-session.test.ts:… settles its receipt through the real history writer` |
| M0265-07 `prepareRecovery` CAS 제거 | **red** | `native-session.test.ts:… a concurrent write invalidates preparation` |
| M0265-08 OpenCode 후속 입력에도 prefix · M0265-09 `onPrompt` 미기록 | **red** ×2 | `adapter.persistent.test.ts:… sends archived context only to the model …` |
| M0265-10 빈 snapshot 재전송 분기 제거 | **red** | `native-session.test.ts:… replaces only a confirmed missing native identity …` |
| M0265-11~14·16 숨김 필터 제거(전체·getSessionById·프로젝트·로컬 검색·native 검색) | **red** ×5 | `native-history.db.test.ts:… hides every discovery path …` 등 |
| M0265-15 검색 frontier 중복 제외 제거 | **red** | `native-history.db.test.ts` 2케이스 |
| M0265-17·18·19 read 후 guard(version·isBusy)·cursor 검증 제거 | **red** ×3 | `native-sync.test.ts` |
| M0265-21 로딩 중 send 허용 · 22 stale 판정 messages identity 제거 · 23 paint 경계 없이 즉시 refresh | **red** ×3 | `chatStore.native-history.test.ts` |
| M0265-20 · 24 | green — 중복 가드(§3) | — |

- 독립 변이 24건 중 22 red · 2 등가. 첫 검증이라 덮개 회귀 해당 없음.

## 5. V-pair closeout — `UT → IT → ST → AT`

좌표는 plan `[구현자 기입]`의 O01~O23·L1~L12·ΔV2 표다. 전체 실행 색인 대조: V1 33건·ΔV1/ΔV2 19건 전부 실재·통과(O23은 아래 별도 실행). 단 Windows CI에서는 O22의 3케이스가 red다.

| Pair | 결과 | 근거 |
|---|---|---|
| **VP12 MD02↔UT02** | **PAIR_FAIL** | O22 `distinguishes an absent original from permission failures`·`does not replace a snapshot if its revision changes at read boundary %s`가 대상 플랫폼 CI에서 red(D-0265-1) |
| VP05 R05↔AT05 | BLOCKED_BY:VP12 | "부재와 접근 오류 구별"의 직접 oracle이 O22 |
| VP11·VP13·VP01~04·06~10 (V1 나머지 11) | PASS | O01~O21·O23 통과 + M0265-06·11~19 red |
| VP-Δ1-01~11 · VP-Δ1-R1 (12) | PASS | L1~L12 통과 + M0265-21~23 red. EP18b·EP19a 등가 가드는 §3 |
| VP2-1 R15↔AT15·MD2-1↔UT2-1 | PASS | `chatStore.native-history.test.ts:… quietly shows the retained archive when native is %s`(3) · `… retains the cached history and reports an IPC failure, then allows a later retry` |
| VP2-2 R16↔AT16·AR2-2↔IT2-2 | PASS | `native-session.test.ts` 복구 4케이스 + unavailable·migration-required 2케이스 · `adapter.fork.test.ts:… recreates an expired conversation …` · `adapter.persistent.test.ts:… sends archived context only to the model and routes the replacement native session …` · M0265-01·04·09 red |
| VP2-3 R17↔AT17·SD2-3↔ST2-3 | PASS(정의된 계약) · G-0265-1 영향 | `send.agent-profile.test.ts:… (recovery: true)` · `native-session.test.ts:… keeps the recovery prefix out of native reload …` · M0265-02·03·05·08 red. 보관 대화가 컨텍스트를 넘는 경우는 계약이 없다 |
| VP2-4 R18↔AT18·MD2-4↔UT2-4 | PASS(정의된 계약) · G-0265-1 영향 | `native-session.test.ts:… retains the archive when native creation fails …`·`… persists a replacement across restart …` · M0265-06·07·10 red |
| VP2-R REGRESSION | PASS | native sync/projection/reader·load/store·send 회귀 전부 통과 |

- 실제 OpenCode 1.19.0 CLI 통합(O23, `ORCA_TEST_OPENCODE_EXE`): 상속 `PWD` 그대로면 timeout red, `env -u PWD`로 **1/1 통과(38초)** — `nativeIdPreserved`·`terminalFollowupImported`·`nativeConfigUnchanged`·`customXdgAndDatabase`·`auxiliarySessionRemoved`·`legacyMigratedAndTerminalResumed` 모두 true, 모델 요청 8·외부 0. CI는 이 케이스를 skip한다.
- §10 분모: V1 50 · ΔV1 22 · ΔV2 16. 닫힘: O22가 덮는 자리(EP08 reader·EP02 read 후 guard의 Claude 경계)는 대상 플랫폼에서 미닫힘.

### AT / AC 합계

| 범위 | 결과 |
|---|---|
| V1 AC1~8 | ✅7 · ⚠️1(AC5 — O22 CI red) |
| ΔV1 AC9~14 | ✅6 |
| ΔV2 AC15~18 | ✅2(AC15·16) · ⚠️2(AC17·18 — G-0265-1) |

- 합계: `✅ 15 · ⚠️ 3 · ❌ 0 = 18`. 자기보고 8/8 · 6/6 · 4/4, 커밋 trailer `4dc81c8f` 8/8 · `bb6ce719` 9/9(0262 ΔV16 3 포함) · `655fa0e0` 9/9(0262 3 + 0263 2 + 0265 4) — 사본끼리는 일치, 검증 결과와 3건 갈림.

## 6. 운영 gate

| Gate | 결과 | 관측 |
|---|---|---|
| **PR CI (Windows)** | **FAIL** | run 38903073840(#779, HEAD) `Test` 단계 — 753파일 중 1 실패, 7,390 중 3 실패. #773~#778 동일 |
| readonly ESLint · typecheck · build (HEAD) | PASS | [0003 F-4](../0003-debug-panel-mock-adapter/verify.md) 공통 실행 |
| 전체 Vitest (Linux, Node ABI) | PASS | 7,383 통과 · 실패 0 — symlink TMPDIR에서는 CI와 같은 3 실패 |
| migration append-only | PASS | `a09109bb..HEAD` 마이그레이션 변경은 0029~0032 추가(A)뿐 · `check-migrations-appendonly` sync ok |
| 문서 inventory·링크 | PASS | `check-doc-inventory --check` ok |

## 7. Repository operation

- INDEX 0265 행: 상태·다음 주체 일치. 대상 커밋을 검증자가 기입한다.
- trailer: 범위 9커밋 파싱·허용값 정상.
- `[구현자 기입] ΔV2`는 문단+표 1개+`운영 gate / Review Signals` 한 절로 접혔다 — `이번 라운드 수정의 잠금`·`Product/UX 파생 검토`·`놓친 잠재 문제` 필드가 없다(D-0265-2). V1·ΔV1 r1.2는 7필드 존재.
- plan 메타 `V mode / revision`이 ΔV2를 포함하지 않는다(N-0265-4).

## 8. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| G-0265-1 | 복구 첫 prompt의 보관 대화에 상한·초과 시 동작이 없다(`archivePrompt` 전체 직렬화). 컨텍스트 초과 거절 후 native에 저장된 거대 메시지가 이후 resume마다 실릴 수 있다 | D15·AC17·AC18 / §1 출력 상한 | **PLAN_GAP** | planner: 상한(예: 토큰 예산·요약·최근 N턴)과 초과 시 사용자 표시·영수증 의미를 사용자와 결정 |
| G-0265-2 | D14·D15가 V1 D02·§8·AC5와 모순되는데 ledger에 SUPERSEDED가 없고 `app/AGENTS.md:86`이 반대 규칙을 유지 | Decision Ledger | **PLAN_GAP** | planner: D02/AC5의 대체 범위(missing만)를 ledger에 명시, AGENTS 한 줄 정정 |
| D-0265-1 | O22 3케이스가 Windows CI에서 red(PR CI 7회 연속). mock이 realpath 정규화된 production 경로를 잡지 못함 | VP12 / PR CI gate | **BLOCKING** | 구현: mock 비교를 `realpath`/정규화 경로로 바꾸고 CI green 확인 |
| D-0265-2 | `[구현자 기입] ΔV2` 필드 접힘(잠금·Product/UX·놓친 문제 부재) | `docs/handoff/AGENTS.md §2` 재구현 턴 필드 계약 | **BLOCKING** | 구현: 7필드 재기입 |
| N-0265-1 | native CLI fixture가 `PWD`를 격리하지 않는다 | 테스트 위생 | NON_BLOCKING | fixture env에서 `PWD` 제거/고정 |
| N-0265-2 | EP18b reducer 가드·EP19a token 비교는 중복 가드라 전용 oracle이 없다 | 관측 범위 | NON_BLOCKING | 필요 시 로딩 중간 상태 단언 |
| N-0265-3 | 구현 보고·INDEX에 PR CI red가 기록되지 않았다 | 보고 정확성 | NON_BLOCKING | 다음 보고에 원격 CI 결과 포함 |
| N-0265-4 | plan 메타 `V mode`가 ΔV2 미포함 | 상태 사본 | NON_BLOCKING | 설계 정정 때 갱신 |

## 9. Review Signals — 사실만

- 첫 검증이다. PR CI red가 7회 연속이었지만 이후 3개 구현 턴(ΔV1·ΔV2 및 0262/0263 공동 커밋)의 보고 어디에도 없다.
- 관련 지침: `docs/handoff/AGENTS.md §구현 게이트의 정본`은 `.github/workflows/ci.yml`을 PR/CI 통합 gate로 둔다.
- 사용자 결정 변경 근거: ΔV2 본문 "사용자 요구로 … V1 계약 … 대체" · ADR-009 "사용자 후속 결정" — 원 발화 인용은 없다.
- 반복 환경 한계: 검증 환경 Electron 바이너리 부재(설치 후 해소), CLI fixture의 `PWD` 상속.

## 10. 결론

- 상태: **RETURN_TO_PLAN** — PLAN_GAP 2(G-0265-1·2) + BLOCKING 2(D-0265-1·2). 다음 주체는 설계자.
- pair: V1 13 중 PASS 11 · PAIR_FAIL 1(VP12) · BLOCKED_BY 1(VP05) / ΔV1 12 PASS / ΔV2 5 PASS(VP2-3·4는 G-0265-1 영향).
- 운영 gate: PR CI FAIL, 로컬 gate PASS.
- 다음 단계: 설계자가 G-0265-1·2를 새 Delta V로 정정(별도 설계 커밋) → 구현자가 D-0265-1·2와 정정분을 반영 → 재검증.
