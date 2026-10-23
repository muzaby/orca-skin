# Verify — 0277-opencode-mcp-catalog

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0277-opencode-mcp-catalog` |
| 검증자 | Claude Code |
| 일자 | 2026-10-22 |
| 대상 커밋/range | 관측 구현은 0278 커밋에 동봉: `c765135`·`e4853cb`(0278 V1) · `a082776`(ΔV1 r1.2) · 검증 HEAD `32b43cc` |
| 구현 전 plan 기준 | ΔV1 `087543e` · READY §8 `10f52f9` |
| V mode / 유효 V | Delta V / `V1@256ddd24 + ΔV1`(최종 관측 경계 = §8 + 0278 §27 FEP1·2·7·8·10·12) |
| 라운드 | 1 (verify 1회째) |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니오 — 설계·구현 Codex, 검증 Claude |

**FAIL — 이 handoff에 남은 관측 경계에서 파일 근거 없는 열기 capability(AC11, O3)를 어떤 테스트도 잡지 못한다.** 전역 선언 reader·MCP 제어 거부·capability 표시·패널 읽기 전용은 잠겼다. renderer push scope(AC5)·plugin 선언 revision(AC6)·stale revision 폐기(AC10)는 0278이 이 plan을 뒤집은 계약이라 **PLAN_GAP으로 0278에 이관**했고 여기서는 판정하지 않는다(§0-1).

## 0. 기준선 / plan 변경 확인

- 구현 커밋 `a082776`의 0277 `plan.md` 변경: `[구현자 기입] — ΔV1 r1.2` 절 추가만.
- 기준선: ΔV1/READY가 별도 설계 커밋(`087543e`·`8137313`·`10f52f9`). U1·U2(nav 선택기)는 사용자 정정(D10, 0278 D23)으로 SUPERSEDED.
- 채점 기준: R1–R11/AC1–11, DV1-P1–4, V1 VP7, §8 자리 5행.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V·SUPERSEDED 이관 | 유효 | nav scope control의 AC·부분 실패·지각 응답·동적 MCP 증거를 page/panel 경로로 이관 명시 |
| §8 자리·oracle | 유효(관찰 1) | §8이 `nativeResourceState.test.ts`를 좌표로 적었으나 그 파일은 없다. 0278 r2 구현 보고가 실제 좌표를 `nativeResourceState.composer.test.ts` 외 4파일로 구체화 |
| 운영 gate | 유효 | Vitest·lint·typecheck·build·문서 |

- 정책 충돌은 **최신 handoff가 정본**(사용자 지시): 프로젝트 MCP/plugin 제어는 0278 D32(관측만), Composer 표현은 0281 기준.
- root PLAN_GAP: 없음(설계자 반려 사유 없음). 아래 §0-1의 PLAN_GAP은 최신 handoff 이관분이다.

### 0-1. 최신 handoff 이관 — PLAN_GAP (사용자 결정 2026-10-22)

0281부터 0277까지 역순으로 대조해, 갭 항목의 계약을 뒤집은 가장 최신 handoff에 책임을 넘긴다. 이 handoff에서는 해당 항목을 판정하지 않는다.

| 갭 항목 | 뒤집은 요소 | 이관 대상 | 이 handoff 처리 |
|---|---|---|---|
| D2 · P11–P13 renderer push scope(AC5) | 0278 D23(nav는 하네스 전역·프로젝트 상태는 패널의 현재 cwd)이 V1 nav scope control을 SUPERSEDED, 패널 push 경계를 0278 §27 FEP12로 재정의 | **0278 verify r2** R5 | 미판정 — 0278 책임 |
| D3 · A23 plugin 선언 revision(AC6) | 0278 D30·ΔV2(`8137313`)가 관측 원천을 native 프로젝트 파일로 바꾸고 §27 FEP8로 고정 | **0278 verify r2** R3 | 미판정 — 0278 책임 |
| D3 · A6 observer stale revision(AC10) | 같은 FEP8 경로(native 파일→revision→`ProjectResourceSync`) | **0278 verify r2** R3 | 미판정 — 0278 책임 |

- 0279·0280·0281은 이 세 계약을 다시 뒤집지 않는다(0279 최종 경계는 FEP3–6·9–11). 따라서 최신 책임 handoff는 0278이다.
- O3(`canOpen`)는 0277 D8 자체 결정이고 뒤집힌 적이 없어 이 handoff에 남는다.

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 | production path (HEAD) |
|---|---|---|
| D1·D10 | nav는 하네스 전역, 패널은 현재 cwd·실행 구성 | `globalOpenCodeResources`(`configured-resources.ts:120`) → `extension-catalog` IPC → `useNativeMcpCatalog` / session-resources → `NativeResourcesTile` |
| D2 | 서버 없이 선언 표시, 기존 준비 instance에서만 실행 상태 | catalog는 reader만, 패널은 기존 lease의 `mcp`·`plugins` part |
| D4·D7 | 같은 범위·이름 병합·runtime 우선, 다른 cwd 격리, 이전 세대 폐기 | `nativeResourceState` scope·generation fence, `ProjectResourceSync` version fence |
| D8 | 실제 선언 파일 근거가 있을 때만 열기 | `canOpen: result.files.has(item.id)`(`configured-resources.ts:128`) |
| D9·D32 | 프로젝트 MCP/plugin 제어 없음(관측만) | `OpenCodeMcpControl.set` 거부(`mcp-control.ts:43`) |

## 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 관측이 서버를 시작하는가 | ✅ | nav catalog는 파일 reader만 호출, 패널은 기존 lease part만 읽음 |
| 읽기 전용 항목 숨김 | ✅ | `canToggle=false`여도 행 유지(F12d 잡음) |
| 비밀 노출 | ✅ | 목록 DTO에 경로·credential 없음, 열기는 handler가 파일을 재조회(`extension-catalog.ts:50`) |
| 열기 capability | ⚠️ | 파일 근거 판정을 `true`로 고정해도 green(O3) — §4 |

## 3. 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| test-only symbol | 없음 | `globalOpenCodeResources`·`globalOpenCodeMcpFile` 모두 harness module 경유 production 호출 |
| 형제 정책 비대칭 | 관찰 | Claude reader는 plugin key 변화를 revision에 반영하고 검증, OpenCode는 반영만 하고 oracle 없음(A23) |

## 4. 고장 내 보기

- 등록 변이 0. §8 자리·0278 FEP1·2·7·8·10·12 재량 고장. 0278 r2와 공유하는 행은 같은 ID([0278 verify §r2-4](../0278-harness-extension-isolation/verify.md#r2-4-고장-내-보기)).

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|
| O1 | `opencode/v1/configured-resources.ts:124` | 빈 값 | global-only 인자 제거(기본 workspace 포함) | 잡음 | `configured-resources.test: discovers global config.json and excludes the default workspace and its .opencode files` | §8 global reader · AC1 |
| O2 | 같은 파일 `:127` | 고정값 | `canToggle: true`(plugin 포함) | 잡음 | 같음 | §8 global reader · AC1 |
| O3 | 같은 파일 `:128` | 고정값 | `canOpen: true` | **못 잡음** | — | §8 source file lookup · AC11 |
| A20 | `handlers/extension-catalog.ts:37` | 제거 | `canToggle` 거부 삭제 | 잡음 | `extension-catalog.test: …keeps supported explicit choices only in memory` | FEP1 |
| A21·A22 | `opencode/v1/mcp-control.ts:70·43` | 제거·호출 대체 | 프로젝트 우선 필터 / 직접 set 거부 | 잡음 | `session-context.test: freezes global choices per directory…`·`adapter.test: …rejects unsafe project controls…` | FEP7 · AC3·AC9 |
| A23 | `opencode/v1/project-settings.ts:24` | 제거 | revision에서 `plugin` 선언 삭제 | 관측: 못 잡음 → **0278 이관(미판정)** | — | FEP8 · AC6 → 0278 R3 |
| A5·A6 | `app/project-resource-sync.ts:44·178` | 제거 | idle 조건 / 읽는 중 version 변경 폐기 | A5 잡음 · A6 관측: 못 잡음 → **0278 이관(미판정)** | `project-resource-sync.test: counts …activity as busy` | FEP8 · AC10 → 0278 R3 |
| A11 | `handlers/session-resources.ts:256` | 제거 | `canToggle` 확인 삭제 | 잡음 | `session-resources.test: rejects …read-only resources before writing` | FEP10 |
| F12a–d | `CustomizeList.tsx`·`CatalogToggle.tsx`·`nativeResourcesMenu.ts` | 고정값·제거 | capability 표시·토글 조건 | 잡음 4/4 | `useNativeMcpCatalog.test`·`CustomizeList.render.test`·`NativeResourcesTile.test: lists read-only OpenCode resources…` | FEP12 · AC7 |
| P11–P13 | `lib/nativeResourceState.ts:308-310` | 제거 | push scope의 backend/cwd/projectId 항 | 관측: 못 잡음 ×3 → **0278 이관(미판정)** | — | FEP12 · AC5 → 0278 R5 |

- 검산: 시도 17 = 잡음 11 · 이 handoff 판정 못 잡음 1(O3) · 0278 이관 5(A23·A6·P11·P12·P13) · 동치 0. O3는 고정 자리 → `PAIR_FAIL`.
- FEP2(X1)는 전역 선택 적용 경로로 0278 소유 — 0277의 관측 계약에는 귀속하지 않는다.

## 5. V-pair closeout

| Pair | 레벨 | requiredness | 결과 | 증거 |
|---|---|---|---|---|
| DV1-P4 | UT | INHERITED REGRESSION | **PAIR_FAIL** | O1·O2 잡음, **O3** 못 잡음(파일 근거 없는 열기) |
| DV1-P3 | IT | CHANGED REQUIRED | PASS(이관 제외) | A20·A11·F12a–d 잡음. push scope 경계(P11–P13)는 0278 이관 |
| DV1-P2 | ST | CHANGED REQUIRED | PASS(이관 제외) | A21·A22·A5 잡음. native 파일 revision·stale 폐기(A23·A6)는 0278 이관 |
| DV1-P1 | AT | CHANGED REQUIRED | BLOCKED_BY:DV1-P4 | AC1–4·7–9 관측 PASS, AC11은 DV1-P4 root, AC5·6·10은 0278 이관 |
| V1 VP7 | ST | INHERITED REGRESSION | BLOCKED_BY:0275 VP11·0276 VP3·VP6 | 각 verify의 못 잡음(L8·L15·Q2·Q8) |

### AT / AC

| AC | 결과 | 근거 |
|---|---|---|
| AC1 nav global-only·패널 cwd | ✅ | O1·O2 잡음 |
| AC2 서버 없이 선언 표시 | ✅ | `configured-resources.test` 2건 pass, O1 잡음 |
| AC3 기존 instance 상태 병합 | ✅ | A21 잡음 |
| AC4 동적 MCP·plugin 분리 | ✅ | A22 잡음(`…retains partial observations safely`) |
| AC5 같은 범위 단일 행·A/B 분리 | 이관 | 0278 verify r2 R5(P11–P13) 책임 |
| AC6 진입·전환·ready·status 변경 갱신 | 이관 | 0278 verify r2 R3(A23) 책임 |
| AC7 오류·부분·빈 성공 구분 | ✅ | F12a–d 잡음, 0280 verify의 오류 구분 잠금 |
| AC8 종료 후 connected 제거 | ✅ | 0274 E4(instance disposed) 잡음 |
| AC9 관측이 실행을 바꾸지 않음 | ✅ | A22·A11 잡음 |
| AC10 전환·교체 후 이전 결과 폐기 | 이관 | 0278 verify r2 R3(A6) 책임 |
| AC11 가짜 파일 열기 없음·민감정보 비노출 | ❌ | O3 green |

- 합계 재측정: `✅ 7 · ❌ 1 · 이관 3 = 11`. 자기보고: 0277 단독 trailer 없음(`c765135`·`e4853cb`는 0278 V1 `10/10`, `a082776`은 0278 `21/21`) → 대조 불가.

### §8 / FEP 강제 지점 분모

| 자리 | 결과 |
|---|---|
| global IPC→native reader→nav hook/list | PASS (O1·O2·A20·F12a–c) |
| session/draft IPC→기존 준비 context | PASS (A21·A22·A11) |
| observer ready/dirty/closing→패널 | 이관 → 0278 FEP8 (A6·A23) |
| preload/API→query scope | 이관 → 0278 FEP12 (P11–P13) |
| source file lookup→shell | PAIR_FAIL (O3) |

- 이 handoff 판정 3자리 중 2 PASS · 1 PAIR_FAIL(O3), 2자리 0278 이관. 목록 밖 발견 없음.

### 운영 gate (HEAD `32b43cc`)

[0281 verify](../0281-opencode-menu-cache/verify.md#운영-gate-head-32b43cc)와 동일 실행: typecheck 0 · lint 0 error · renderer 374/3060 · main 465파일 중 15 red 전부 Windows 전용 fixture · Windows CI #853 green.

## 8. 남은 사람 실기

| 항목 | 기계 검증 | 사람 |
|---|---|---|
| 실제 OpenCode CLI의 동적 MCP·두 테마 패널 | 설치 SDK transport 테스트 | 실제 창 확인 |

## 11. Repository operation checks

- INDEX: `impl/IMPL_DONE`·다음 Claude → `verify/FAIL`·Codex·라운드 2.
- 대상 커밋: `c765135`·`e4853cb`·`a082776`·`087543e`·`10f52f9` 모두 `git cat-file -t` = commit. 0277 구현은 전부 0278 trailer 커밋에 동봉 — 0277 메시지 버스로는 찾을 수 없다(N1).
- `[구현자 기입] ΔV1 r1.2` 7필드는 있으나 `2. 강제 지점·V pair`가 산문 — §8 5자리별 `N/M`·좌표 없음(N1).

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | O3: `canOpen`을 `true`로 고정해도 green | §8 source file lookup · AC11 · DV1-P4 | BLOCKING | 파일 없는 plugin/MCP 행의 `canOpen=false` 단언 |
| D2 | P11–P13: push scope 3항 미잠금 | 0278 D23·§27 FEP12가 뒤집은 계약 | PLAN_GAP → 0278 이관 | 0278 verify r2 R5가 책임. 이 handoff 미판정 |
| D3 | A23·A6: plugin 선언 revision·stale revision emit 미잠금 | 0278 D30·§27 FEP8이 뒤집은 계약 | PLAN_GAP → 0278 이관 | 0278 verify r2 R3가 책임. 이 handoff 미판정 |
| N1 | 구현이 0278 trailer로만 커밋, 강제 지점 필드 산문 | repository operation | NON_BLOCKING | 다음 구현 커밋에 0277 trailer·자리별 표 |

## 14. Review Signals

- 이전 라운드: 첫 verify. 관련 plan 지침: §8이 "dynamic MCP에는 shell 무호출·실제 파일만 열기"를 oracle로 명시.
- 사용자 결정 변경: D10(nav 표면)·D32(관측만) — 최신 handoff 기준 채점.
- 반복 환경 한계: Windows 전용 fixture, 실제 OpenCode 창 미실행.

## 15. 결론

- 상태: **FAIL** — verify 1회째.
- pair: root PAIR_FAIL 1(DV1-P4) · PASS(이관 제외) 2(DV1-P2·P3) · BLOCKED_BY 2(DV1-P1·V1 VP7). PLAN_GAP 3건은 0278 이관(반려 아님).
- AC: ✅7 · ❌1 · 이관 3 / 11.
- 다음 단계: Codex r2 — D1(O3), 다음 verify는 O3 재실행. A6·A23·P11–P13은 0278 verify에서 재실행한다.

---

# r2 재검증 (2026-10-23)

| 항목 | 값 |
|---|---|
| 검증자 | Claude Code |
| 대상 커밋/range | `32b43cc..e42d1e2` 중 0277: `9ad2224`(r2 — 테스트 1파일) |
| 구현 전 plan 기준 | r1과 같음 — `9ad2224`의 `plan.md` `-` 줄은 메타 상태 1줄 |
| V mode / 유효 V | Delta V / V1 + ΔV1 (§8, 최종 경계 0278 §27) |
| 라운드 | 2 (verify 2회째) |
| 자기 검증 여부 | 아니오 — 구현 Codex, 검증 Claude |

**PASS — 이 handoff에 남은 유일한 미검출 O3(파일 근거 없는 열기)가 잡히고 나머지 자체 고장도 유지된다.** 0278로 이관한 AC5·AC6·AC10(P11–P13·A23·A6)은 [0278 verify r3](../0278-harness-extension-isolation/verify.md#r3-13a-이관-수령분-판정)에서 PASS로 닫혔다.

## r2-0. 기준선 / plan validity

- 앱 변경은 테스트 22파일뿐(production 0) — §8 경계와 경로는 r1과 같다.
- 새 단언: `configured-resources.test: discovers global config.json…`이 파일 근거 없는 plugin 행의 `canOpen: false`를 기대에 더했다(기존 단언 유지, 항 추가).

## r2-4. 고장 재실행

| ID | r1 | r2 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|
| O1 | 잡음 | 잡음 | `configured-resources.test: discovers global config.json and excludes the default workspace…` | §8 global reader · AC1 |
| O2 | 잡음 | 잡음 | 같음 | §8 global reader · AC1 |
| O3 | 못 잡음 | **잡음** | 같음(`canOpen: false` 기대) | §8 source file lookup · AC11 · D1 |
| A20 | 잡음 | 잡음 | `extension-catalog.test: …keeps supported explicit choices only in memory` | FEP1 |
| A21·A22 | 잡음 | 잡음 | `session-context.test`·`adapter.test`·`opencode/v1/project-settings.test` | FEP7 · AC3·AC9 |
| A5 | 잡음 | 잡음 | `project-resource-sync.test: counts …activity as busy` | FEP8 |
| A11 | 잡음 | 잡음 | `session-resources.test: rejects …read-only resources before writing` 외 1 | FEP10 |
| F12a–d | 잡음 | 잡음 | `useNativeMcpCatalog.test`·`CustomizeList.render.test`·`NativeResourcesTile.test` | FEP12 · AC7 |

- 검산(이 handoff 판정 행): 시도 12 = 잡음 12 · 못 잡음 0 · 동치 0. r1 못 잡음 1(O3) → 잡음, r1 잡음 11 → 잡음(덮개 회귀 0). 이관 5행(A23·A6·P11–P13)은 0278 r3에서 잡음.

## r2-5. V-pair closeout

| Pair | 레벨 | r1 | r2 | 증거 |
|---|---|---|---|---|
| DV1-P4 | UT | PAIR_FAIL | **PASS** | O1·O2·O3 잡음 |
| DV1-P3 | IT | PASS(이관 제외) | PASS(이관 제외) | A20·A11·F12a–d 잡음, push scope는 0278 PASS |
| DV1-P2 | ST | PASS(이관 제외) | PASS(이관 제외) | A21·A22·A5 잡음, revision·stale은 0278 PASS |
| DV1-P1 | AT | BLOCKED_BY:DV1-P4 | **PASS** | root 해소, AC1–4·7–9·11 관측 |
| V1 VP7 | ST | BLOCKED_BY:0275 VP11·0276 VP3·VP6 | **PASS** | 0276 verify r2 PASS, 0275 VP11 축 L3–L7 잡음·L8 동치 |

| AC | 결과 | 근거 |
|---|---|---|
| AC1–AC4·AC7–AC9 | ✅ | r1과 같은 축 잡음 |
| AC11 가짜 파일 열기 없음·민감정보 비노출 | ✅ | O3 잡음 |
| AC5·AC6·AC10 | 이관 | 0278 r3 R5·R3 PASS |

- 합계 재측정: `✅ 8 · ❌ 0 · 이관 3 = 11`. 자기보고 `Criteria-Met: 8/11`·`Criteria-Pending: AC5·AC6·AC10은 0278로 책임 이관`(`9ad2224`) 일치.
- §8: 이 handoff 판정 3자리 3/3 PASS, 이관 2자리는 0278 FEP8·FEP12 PASS.
- 운영 gate: [0281 verify r2](../0281-opencode-menu-cache/verify.md#r2-운영-gate-head-e42d1e2)와 같은 HEAD 실행.

## r2-11. Repository operation checks

- INDEX: `impl/IMPL_DONE`(r2) → PASS, archive 이동. `9ad2224` `git cat-file -t` = commit, trailer 6키 파싱(0277 단독 trailer).
- `[구현자 기입] ΔV1 r2` 7필드, §8 대조 표 존재.

## r2-13. Finding disposition

| # | r2 상태 | 근거 |
|---|---|---|
| D1 | closed | O3 잡음 |
| D2·D3 | transferred → closed in 0278 r3 | P11–P13·A23·A6 잡음 |
| N1 | closed | `9ad2224`가 0277 trailer와 자리별 표를 갖는다 |

## r2-15. 결론

- 상태: **PASS** — verify 2회째. 판정 pair 전부 PASS, PLAN_GAP 없음, AC ✅8/8 + 이관 3(0278 PASS).
