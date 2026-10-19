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

---

# r2 검증

## 메타 (r2)

| 항목 | 값 |
|---|---|
| 일자 | 2026-10-17 |
| 대상 커밋/range | `9df1b3bb..e024b87c` — ΔV3 설계 `9d52e072` → r2 구현 `ce7aa102`, 기록 `7be5d723` → r2.1 fixture `6492828c`, 기록 `3e9cbf86` (0262 공통 `eb333bff`·`e7645433`·`e024b87c` 포함) |
| 구현 전 plan 기준 | `9d52e072`(ΔV3, 설계 단독 커밋) |
| V mode / 유효 V | Baseline V1 + ΔV1 + ΔV2 + ΔV3 |
| 검증 HEAD | `e024b87c` |
| 라운드 | 2 |
| 상태 | **FAIL** — root PAIR_FAIL 1(VP3-A: 복구 상한의 하네스 추가 지시 edge 미잠금) · PLAN_GAP 0 |
| 자기 검증 여부 | ΔV3 설계·구현 Codex(사용자 지시) · 검증 Claude — 구현자 ≠ 검증자 |

## 0. 기준선 / plan validity (r2)

- 구현 커밋의 `plan.md` 삭제 줄: 메타 상태 1 · ΔV2 기입 표제 1 · `### 운영 gate / Review Signals` 1(7필드 복원으로 교체). Decision·AC·V·§10 변경 없음(`git diff 9d52e072 e024b87c -- …/plan.md`).

| 검사 | 판정 | 근거 |
|---|---|---|
| G-0265-1 복구 상한 | 해소 | ΔV3 D17 — 사용자 답변 인용("전송을 중단하고 안내 — 보관 대화 유지"), 상한 공식(보관 prompt+새 입력+정규화 첨부+추가 지시의 UTF-8 bytes ≤ window×0.8)·초과 시 생성/binding/receipt 0 · VP3-A/M/R 신설 |
| G-0265-2 D02·AC5 모순 | 해소 | D02 `PARTIALLY SUPERSEDED`, D18이 대체 범위(명시 전송의 확인된 missing)를 한정 · R05/AC5·§8 문장 정정 · `app/AGENTS.md:86`과 `docs/arch/backend/persistence.md`가 같은 구별을 따름 |
| ΔV3 oracle | 유효 | 직접 oracle, 선택 mutation not selected · §10 VP3-A 3자리 + VP3-M 2자리 |

## 2. 비판적 읽기 (r2)

| 질문 | 판정 | 근거 |
|---|---|---|
| 상한이 외부 쓰기 전에 걸리는가 | 예 | `chat-turn/native-session.ts:49` missing 경로·`:92` 빈 replacement 재시도 경로 모두 `observe`/`recoverSession`/`prepareRecovery` 앞 |
| false success | 없음 | 차단 시 `recoverSession` 호출 0 · recovery 행 불변 · 신규 DB 메시지 0(`native-session.test.ts:rejects oversized recovery before creation and preserves the archive and receipt on retry`) |
| 안내의 소비자 | 있음 | 오류 문구가 `TurnErrorBanner.tsx:21` `error.message`로 표시 |
| 첨부 이미지 계산 | 과차단 가능 | `send.ts:261` `JSON.stringify(normalizedAttachments)` — 이미지 `data`(base64, `attachments.ts:27`) 바이트까지 세므로 200k 창(예산 160,000 bytes)에서 원본 약 120KB 넘는 이미지 하나로도 짧은 보관 대화의 복구가 막힌다. 설계 문장 "정규화된 첨부 포함"의 보수적 결과(N-0265-5) |
| 예산 기본값 | 우회 여지 | `prepareNativeSession`의 `input` 기본값 `{ text: '', contextWindow: 200000 }` — production 호출처 1(`resolve-turn.ts:131`)은 명시하지만 생략 호출은 새 입력·첨부를 세지 않는다(N-0265-6) |

## 4. 적대 증거 재측정 (r2)

범위: main 변이는 `src/main`(4,057케이스), store 변이는 `features/chat/{store,components}`(429케이스). 모든 변이 후 원본 SHA256 일치.

| 변이 | r1 | r2 | 귀속 |
|---|---|---|---|
| D-0265-1 인용: O22 mock 비교를 `realpath` 이전(`f.file`)으로 되돌림 · symlink TMPDIR | (CI red 3) | **red** 3/14 — r1 CI와 같은 3케이스 | D-0265-1 |
| 같은 되돌림 · 일반 TMPDIR(대조) | — | green 0/14 | 수정이 정확히 경로 정규화 차이를 닫음 |
| N-0265-1 인용: fixture가 상속 `PWD` 유지(`PWD=…/app`) | red(timeout) | **red** 1/1 `Command failed` | N-0265-1 |
| R2-02 첨부 제외 · R2-03 새 입력 제외 · R2-04 extra 무시 | — | **red** 2 · 1 · 1 | VP3-A 입력 배선 |
| R2-05 창 200000 고정 · R2-06 선택 모델 미전달 | — | **red** 1 · 1 — `uses the selected engine model context limit before creating a replacement` | VP3-A 모델 배선 |
| R2-07 재시도 경로 검사 제거 · R2-08 missing 경로 검사 제거 | — | **red** 1 · 3 | VP3-A 두 경로 |
| R2-09 비율 0.8→1.0 · R2-12 bytes 대신 문자 수 | — | **red** 2 · 1 — `bounds the complete UTF-8 recovery prompt…` | VP3-M |
| R2-10 Claude 1m 무시 · R2-11 OpenCode 엔진 limit 무시 | — | **red** 1 · 2 — `registry.test.ts:uses each harness context policy…` | VP3-M |
| **R2-01 하네스 추가 지시(`harnesses[id].instructions`) 제외** | — | **green** 0/4,057 | **VP3-A root PAIR_FAIL (D-0265-3)** |
| M0265-01~04·06~19 (r1 독립 18건) | red | **red** 전부 | 덮개 유지 |
| M0265-21~23 (store 3건) | red | **red** 전부 | 덮개 유지 |

- r1 red 22건 중 재실행 21건 red · 덮개 회귀 0. M0265-05(Claude echo 마스킹)는 r1 변이 자리를 이번에 재식별하지 못해 미재실행 — `adapter.fork.test.ts`·`adapters/claude/adapter.ts` 복구 경로는 `655fa0e0..e024b87c` 변경 0줄이다.
- R2-01 green의 이유: `send.harness.test.ts:routes OpenCode independently of global Claude`가 5번째 인자를 `JSON.stringify({ attachmentTexts: [], attachmentImages: [] })`로 단언하지만 fixture에 하네스 지시가 없어 지시 항이 production·변이 모두 `''`이다.

## 5. V-pair closeout (r2)

| Pair | r2 결과 | 근거 |
|---|---|---|
| VP12 MD02↔UT02 | **PASS** | `adapters/claude/native-history.test.ts` 14/14 — symlink TMPDIR에서도 통과(r1 3 실패), 인용 변이 red · Windows CI #783·#785·#787·#788 success |
| VP05 R05↔AT05 | **PASS** | r1 `BLOCKED_BY:VP12` 해소, AC5 문장은 D18 범위로 정정 |
| **VP3-A R19↔AT19·AR3↔IT3** | **PAIR_FAIL** | 3자리 중 missing 준비(R2-08)·재시도(R2-07) 닫힘 · "resolve 모델/입력 배선" 자리는 모델(R2-05·06)·새 입력(R2-03)·첨부(R2-02)·extra(R2-04) red, **추가 지시 edge(`send.ts:261-262`) 좌표 없음** — R2-01 green |
| VP3-M MD3↔UT3 | **PASS** | `native-session.test.ts:bounds the complete UTF-8 recovery prompt including new text and attachments` · `app/harnesses/registry.test.ts:uses each harness context policy through the registered module` · R2-09~12 red |
| VP3-R REGRESSION | **PASS** | r1 독립 변이 21건 red · 실제 OpenCode 1.19.0 CLI 통합 1/1(38.7초, 상속 `PWD`) |
| VP2-3·VP2-4 | **PASS** | r1 "G-0265-1 영향"은 ΔV3가 상한을 정의해 해소 — 정의된 상한의 잠금은 VP3-A/M이 소유 |
| V1·ΔV1·VP2-1·VP2-2·VP2-R | PASS (r1 좌표) | r1 §5 좌표, HEAD 전체 실행 통과 |

- root PAIR_FAIL: VP3-A. 종속 BLOCKED_BY: 없음(VP3-M·VP3-R은 독립 관측).
- §10 분모: ΔV3 5자리(VP3-A 3 + VP3-M 2)를 계약 운반 edge로 다시 세면 VP3-A "입력 배선" 1자리 = 새 입력·첨부·추가 지시 3 edge → 닫힘 VP3-A 4/5 edge · VP3-M 2/2.

### AT / AC 합계 (r2)

| 범위 | 결과 |
|---|---|
| V1 AC1~8 | ✅8 (r1 ⚠️ AC5 해소) |
| ΔV1 AC9~14 | ✅6 |
| ΔV2 AC15~18 | ✅4 (r1 ⚠️ AC17·18 해소) |
| ΔV3 AC19 | ⚠️1 — 코드는 지시를 포함하지만 그 edge가 미잠금 |

- 합계: `✅ 18 · ⚠️ 1 · ❌ 0 = 19`.
- 사본 대조: 구현 보고 ΔV3 r2·r2.1 `✅5`(AC15~19) ↔ trailer `ce7aa102`·`7be5d723` `19/21` 중 0265 몫 5 · `6492828c`·`3e9cbf86` `6/6` 중 5 — 사본끼리 일치, 검증 결과와 AC19에서 갈림.

## 9. 게이트 (r2)

[0264 r2 §9](../0264-harness-module-isolation/verify.md)의 HEAD `e024b87c` 공통 실행(typecheck exit 0 · ESLint error 0 · Vitest 754파일 7,404케이스 실패 0 · production build exit 0 · scripts 142/142 · inventory/migration/budget/diff check · 원격 Windows CI #788 success)에 더해:

- symlink TMPDIR(`TMPDIR=<scratchpad>/linktmp` → 실제 디렉터리) `adapters/claude/native-history.test.ts` 14/14.
- 실제 OpenCode 1.19.0 CLI(`ORCA_TEST_OPENCODE_EXE`, 상속 `PWD=/home/user/orca-skin/app`) `native-storage.integration.test.ts` 1/1 · 38.7초.
- 원격 CI 이력: r2 범위 7회 중 #782(`ce7aa102`)·#784(`7be5d723`)·#786(`3e9cbf86`) red — DB 재개방·native cursor seed·mail 정리 훅 timeout, r2.1이 fixture 정리와 Windows CI 파일 worker 1로 보완. 최종 #787·#788 연속 success.
- 잔여물: fixture 임시 디렉터리 `app/.tmp/native-cli-test-*`는 실행 뒤 비어 있음(`.gitignore:4`).

## 11. Repository operation checks (r2)

- INDEX 0265 행: 대상 커밋 `9d52e072`(ΔV3 설계)·`ce7aa102`(r2)·`7be5d723`·`6492828c`(r2.1)·`3e9cbf86` 기입 — 전부 commit, 공유 브랜치 ancestor.
- trailer: `9d52e072` 3키(`designed`) · `ce7aa102`·`7be5d723` 9키 · `6492828c` 7키 · `3e9cbf86` 6키 파싱, 허용값 정상.
- `[구현자 기입]` ΔV2 복원·ΔV3 r2·r2.1 각 7필드 전수 존재 → D-0265-2 closed.
- `app/AGENTS.md:86` 변경: 비밀·일회성 정보 없음, 상위 규칙과 충돌 없음.

## 13. Finding disposition (r2)

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| G-0265-1 · G-0265-2 | 복구 상한 부재 · D02/AC5 모순 | ΔV3 | closed | — |
| D-0265-1 | O22 Windows realpath | VP12 | closed — 인용 변이 red, 대조 green, CI green | — |
| D-0265-2 | ΔV2 기입 필드 접힘 | 필드 계약 | closed | — |
| N-0265-1 · 3 · 4 | PWD 상속 · CI red 미보고 · 메타 V mode | — | closed | — |
| N-0265-2 | 중복 가드 전용 oracle 없음 | — | NON_BLOCKING 유지 | — |
| **D-0265-3** | 복구 상한의 하네스 추가 지시 edge(`send.ts:261-262` → `resolveTurn(…, recoveryExtra)`)가 어떤 oracle에도 없다 — R2-01(지시 항 제거) green 0/4,057. ΔV3 TD "정규화된 첨부·추가 지시도 계산에 포함" | VP3-A · AC19 · ΔV3 §10 | **BLOCKING** | 구현: `ctx.settings.getAll().harnesses[id].instructions`가 있는 fixture에서 실제 `handleChatSend`→`resolveTurn` 인자(또는 차단 결과)를 단언. R2-01 red로 닫힘 |
| N-0265-5 | 이미지 첨부의 base64 바이트를 입력 예산으로 세어 짧은 보관 대화의 복구도 차단될 수 있다 | D17 공식의 결과 | NON_BLOCKING | 의도한 보수성인지 사용자 확인 후보 |
| N-0265-6 | `prepareNativeSession` 예산 입력의 기본값이 새 입력·첨부를 세지 않는다 | 우회 여지 | NON_BLOCKING | 기본값 제거 후보 |

## 14. Review Signals (r2)

- r1과 다른 축의 새 실패다 — r1은 상한 계약 부재(PLAN_GAP), r2는 정의된 상한의 한 입력 edge 미잠금.
- 관련 지침: `docs/handoff/AGENTS.md §공통 V` "계약 값을 운반하는 edge는 모두 자리" · 0264 r1 D-0264-1과 같은 형태(조립 인자 중 한 항이 fixture에서 빈 값).
- 반복 환경 한계: 없음 — 이번 검증 환경은 Electron 바이너리·SQLite·OpenCode 1.19.0 CLI를 모두 갖췄다.

## 15. 결론 (r2)

- 상태: **FAIL**.
- pair: root PAIR_FAIL 1(VP3-A) · 나머지 REQUIRED/REGRESSION PASS · BLOCKED_BY 0 · PLAN_GAP 0.
- AC: ✅18 · ⚠️1(AC19) · ❌0. 운영 gate PASS.
- NON_BLOCKING: N-0265-2·5·6.
- 다음 단계: 구현자 r3 — D-0265-3 oracle 추가 후 R2-01 red 보고.

---

# r3 검증

## 메타 (r3)

| 항목 | 값 |
|---|---|
| 일자 | 2026-10-17 |
| 대상 커밋/range | `4b4433b1..8868097f` — r3 구현 `0d2096c5`(0265) · 같은 테스트 파일을 고친 0262 r3 `8868097f` 포함 |
| 구현 전 plan 기준 | `9d52e072`(ΔV3, 설계 단독 커밋) — r2 이후 규범 행 변경 없음 |
| V mode / 유효 V | Baseline V1 + ΔV1 + ΔV2 + ΔV3 |
| 검증 HEAD | `8868097f` (공유 브랜치 `origin/codex-opencode-harness`) |
| 라운드 | 3 |
| 상태 | **PASS** — root PAIR_FAIL 0 · PLAN_GAP 0 |
| 자기 검증 여부 | 구현 Codex · 검증 Claude — 구현자 ≠ 검증자 |

## 0. 기준선 / plan validity (r3)

- 구현 커밋의 `plan.md` 삭제 줄은 메타 `상태` 1줄뿐이다(`git show 0d2096c5 -- …/plan.md`). Decision·AC·V·§10 변경 없음 → r2의 plan validity 판정 유지.
- r3 범위의 `app/` 변경은 테스트 5파일 추가·수정뿐이다(`git diff --name-only 3c798ab5..8868097f -- app/ | grep -v '\.test\.'` 0건). production 변경 0.

## 2. 비판적 읽기 (r3)

| 질문 | 판정 | 근거 |
|---|---|---|
| 새 oracle이 production edge에 진입하는가 | 예 | `send.harness.test.ts:includes only the saved %s harness instructions in the recovery budget input` — 실제 `handleChatSend`가 `send.ts:256-263`에서 5번째 인자를 조립한다. mock은 `resolveTurn`·`normalizeAttachments`·`sendChatEvent`뿐 |
| 하네스 오선택을 구별하는가 | 예 | 두 하네스 지시를 서로 다른 문자열로 두고 `toHaveBeenCalledExactlyOnceWith(…, JSON.stringify(attachments) + instructions[backend])` |
| mock한 `resolveTurn` 안쪽은 누가 닫는가 | 기존 좌표 | `native-session.test.ts:passes new input and additional context through resolve before native recovery`(실제 resolve·SQLite) — 아래 R2-04·I-0265-1 red |

## 4. 적대 증거 재측정 (r3)

범위: 모든 변이 `src/main`(4,065케이스). 변이 후 원본 SHA256 일치 · `git status` clean.

| 변이 | r2 | r3 | 귀속 |
|---|---|---|---|
| **R2-01** 하네스 추가 지시 항 제거(`send.ts:261-262`) | green 0/4,057 | **red** 2 — `send.harness.test.ts:includes only the saved claude/opencode harness instructions…` | D-0265-3 인용 |
| X03 지시를 항상 `harnesses.claude`로(구현자 대조) | — | **red** 1 — `…saved opencode harness instructions…` | 형제 하네스 맞바꿈 |
| R2-02 첨부 항 제거 | red 2 | **red** 4 — 위 2 + `routes OpenCode independently of global Claude (null)/(s)` | 덮개 유지 |
| R2-03 새 입력 제외 · R2-04 extra 무시 | red 1 · 1 | **red** 1 · 1 — `native-session.test.ts:passes new input and additional context…` | 덮개 유지 |
| R2-05 창 200000 고정 · R2-06 선택 모델 미전달 | red 1 · 1 | **red** 1 · 1 — `…uses the selected engine model context limit…` | 덮개 유지 |
| R2-07 재시도 경로 검사 제거 · R2-08 missing 경로 검사 제거 | red 1 · 3 | **red** 1 · 3 | 덮개 유지 |
| M0265-05 Claude recovery echo 마스킹 제거(`claude/adapter.ts:851`) | 미재실행 | **red** 1 — `adapter.fork.test.ts:recreates an expired conversation with the original UUID…` | r2가 재식별 못한 r1 변이 |
| I-0265-1 `prepareNativeSession`이 `input.extra`를 예산에 미전달 | — | **red** 1 — `…passes new input and additional context…` | 검증자 독립 축(같은 계약의 다음 edge) |
| I-0265-2 `recoveryFitsContext`의 `+ extra` 제거 | — | **red** 2 — `…bounds the complete UTF-8 recovery prompt…` 외 1 | 검증자 독립 축 |

- 인용 변이 1/1 검출 → D-0265-3 closed. 구현자 보고 수(R2-01 2 · X03 1 · M0265-05 1)와 일치.
- 이전 라운드 red 재실행 8/8 red — 덮개 회귀 0. 지시 조립(send) → resolve → `prepareNativeSession` → `recoveryFitsContext` 네 edge가 모두 red 좌표를 갖는다.
- 미재실행: r2 red 중 R2-09~12·M0265-01~04·06~19·21~23은 검출 좌표 파일과 production이 `e024b87c..8868097f`에서 무변경이다(변경 테스트 5파일에 해당 좌표 없음). D-0265-1 realpath·N-0265-1 `PWD` 변이는 OpenCode CLI가 없는 이번 환경에서 재실행하지 않았다.

## 5. V-pair closeout (r3)

| Pair | r3 결과 | 근거 |
|---|---|---|
| **VP3-A R19↔AT19·AR3↔IT3** | **PASS** | 3자리 + 입력 배선 3 edge 전부 좌표: missing 준비 R2-08 · 재시도 R2-07 · 모델 R2-05/06 · 새 입력 R2-03 · 첨부 R2-02 · **추가 지시 R2-01·X03** |
| VP3-M · VP3-R · VP2-1~4 · V1 · ΔV1 | PASS (r2 좌표) | 위 재실행 + HEAD 전체 Vitest 통과. r3 변경이 닿지 않음 |

- root PAIR_FAIL 0 · BLOCKED_BY 0 · PLAN_GAP 0.
- §10 분모: ΔV3 VP3-A 3자리(입력 배선을 edge로 세면 5) 5/5 · VP3-M 2/2.

### AT / AC 합계 (r3)

| 범위 | 결과 |
|---|---|
| V1 AC1~8 · ΔV1 AC9~14 · ΔV2 AC15~18 | ✅18 (r2 판정 유지) |
| ΔV3 AC19 | ✅1 — r2 ⚠️ 해소 |

- 합계: `✅ 19 · ⚠️ 0 · ❌ 0 = 19`.
- 사본 대조: 구현 보고 `✅1 = 이번 대상 1(AC19)` ↔ trailer `0d2096c5` `Criteria-Met: 1/1` ↔ INDEX `AC19 자기확인 1/1` — 일치.

## 9. 게이트 (r3)

HEAD `8868097f`, `cd app`. 설치: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` → `npm rebuild better-sqlite3`(Node ABI) → `node node_modules/electron/install.js`.

| Gate | 관측 |
|---|---|
| `./node_modules/.bin/vitest run --reporter=json` 전체 | 756파일 · 7,429케이스 중 7,422 pass · 0 fail · 7 skip(구현자 보고와 동일) |
| `npm run typecheck` | node/web/test 3구성 exit 0 |
| `./node_modules/.bin/eslint ./src ./scripts --format json`(`--fix` 없음) | 1,736파일 · error 0 · warning 2(`react-hooks/incompatible-library` 기존 2) |
| `node --test scripts/*.test.mjs` | 142/142 pass |
| `check-doc-inventory --check` · `check-migrations-appendonly` · `check-test-budgets` | generated·prose·links ok · append-only ok since v0.3.1 · real-git 16 suites ok |
| `npm --ignore-scripts run build` | main 378 · preload 3 · renderer 1,820 modules built, exit 0 |
| `git diff --check 3c798ab5..8868097f` | 0 |
| 원격 Windows CI | [#790](https://github.com/muzaby/orca-skin/actions/runs/38998153983) `head_sha 8868097f` · `gate` success |

- 작업 트리: 게이트와 변이 36회(0265 12 · 0262 24) 뒤 `git status` clean. 잔여물은 ignore된 `node_modules`·`out`뿐.
- 실제 OpenCode CLI 통합(O23)은 이번 환경에 실행 파일이 없어 skip 1이다. r2의 1/1(38.7초) 이후 그 경로 변경 0.

## 11. Repository operation checks (r3)

- INDEX 0265 행: `(r3 구현 — 검증자 기입)`을 `0d2096c5`로 채웠다(`git cat-file -t` commit, 공유 브랜치 ancestor). PASS라 행을 archive로 옮긴다 — 사람 인수 대기 AC 없음.
- trailer: `0d2096c5` 5키(`Agent: codex`·`Handoff`·`Status: implemented`·`Criteria-Met: 1/1`·`Verified-By: pending`) 파싱·허용값 정상.
- `[구현자 기입]` r3 7필드(설계 리뷰·강제 지점 전수·잠금·Product/UX·놓친 문제·구현 보고·Review Signals) 전수 존재.

## 13. Finding disposition (r3)

| # | finding | disposition | 후속 |
|---|---|---|---|
| D-0265-3 | 복구 상한의 하네스 추가 지시 edge 미잠금 | **closed** — R2-01 red 2 · X03 red 1 | — |
| N-0265-2 | 중복 가드 전용 oracle 없음 | NON_BLOCKING 유지 | — |
| N-0265-5 | 이미지 base64 바이트를 예산으로 세는 보수성 | NON_BLOCKING 유지 | 사용자 확인 후보 |
| N-0265-6 | `prepareNativeSession` 예산 입력 기본값 | NON_BLOCKING 유지 | 기본값 제거 후보 |

## 14. Review Signals (r3)

- r2와 같은 축(VP3-A 추가 지시 edge)을 r3이 닫았다. 새 증상 없음.
- 반복 환경 한계: 실제 OpenCode CLI 부재로 O23은 이번에 skip(r2 실측 승계).

## 15. 결론 (r3)

- 상태: **PASS**.
- pair: REQUIRED/REGRESSION 전건 PASS · root PAIR_FAIL 0 · BLOCKED_BY 0 · PLAN_GAP 0.
- AC: ✅19 · ⚠️0 · ❌0. 운영 gate PASS(원격 CI #790 포함).
- NON_BLOCKING: N-0265-2·5·6.
- 다음 단계: 완료 — INDEX 행을 archive로 이동. N-0265-5는 사용자 확인 후보로 남긴다.
