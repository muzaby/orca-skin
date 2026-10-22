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

**FAIL — 관측 경계 4곳에서 심은 고장이 green이었다.** 전역 선언 reader·MCP 제어 거부·capability 표시·패널 읽기 전용은 잠겼지만, 파일 근거 없는 열기 capability(AC11)·renderer push scope(AC5)·plugin 선언 revision(AC6)·읽는 중 stale revision 폐기(AC10)를 어떤 테스트도 잡지 못한다.

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
- root PLAN_GAP: 없음.

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
| A23 | `opencode/v1/project-settings.ts:24` | 제거 | revision에서 `plugin` 선언 삭제 | **못 잡음** | — | FEP8 · AC6 |
| A5·A6 | `app/project-resource-sync.ts:44·178` | 제거 | idle 조건 / 읽는 중 version 변경 폐기 | A5 잡음 · **A6 못 잡음** | `project-resource-sync.test: counts …activity as busy` | FEP8 · AC10 |
| A11 | `handlers/session-resources.ts:256` | 제거 | `canToggle` 확인 삭제 | 잡음 | `session-resources.test: rejects …read-only resources before writing` | FEP10 |
| F12a–d | `CustomizeList.tsx`·`CatalogToggle.tsx`·`nativeResourcesMenu.ts` | 고정값·제거 | capability 표시·토글 조건 | 잡음 4/4 | `useNativeMcpCatalog.test`·`CustomizeList.render.test`·`NativeResourcesTile.test: lists read-only OpenCode resources…` | FEP12 · AC7 |
| P11–P13 | `lib/nativeResourceState.ts:308-310` | 제거 | push scope의 backend/cwd/projectId 항 | **못 잡음** ×3 | — | FEP12 · AC5 |

- 검산: 시도 17(O1–O3·A20·A21·A22·A23·A5·A6·A11·F12a–d·P11–P13) = 잡음 11 · 못 잡음 6(O3·A23·A6·P11·P12·P13) · 동치 0. 전부 고정 자리 → `PAIR_FAIL`.
- FEP2(X1)는 전역 선택 적용 경로로 0278 소유 — 0277의 관측 계약에는 귀속하지 않는다.

## 5. V-pair closeout

| Pair | 레벨 | requiredness | 결과 | 증거 |
|---|---|---|---|---|
| DV1-P4 | UT | INHERITED REGRESSION | **PAIR_FAIL** | O1·O2 잡음, **O3** 못 잡음(파일 근거 없는 열기) |
| DV1-P3 | IT | CHANGED REQUIRED | **PAIR_FAIL** | A20·A11·F12a–d 잡음, **P11–P13** 못 잡음 |
| DV1-P2 | ST | CHANGED REQUIRED | **PAIR_FAIL** | A21·A22·A5 잡음, **A23·A6** 못 잡음 |
| DV1-P1 | AT | CHANGED REQUIRED | BLOCKED_BY:DV1-P2·P3·P4 | AC1–4·7–9 관측 PASS, AC5·6·10·11은 위 root |
| V1 VP7 | ST | INHERITED REGRESSION | BLOCKED_BY:0275 VP11·0276 VP3·VP6 | 각 verify의 못 잡음(L8·L15·Q2·Q8) |

### AT / AC

| AC | 결과 | 근거 |
|---|---|---|
| AC1 nav global-only·패널 cwd | ✅ | O1·O2 잡음 |
| AC2 서버 없이 선언 표시 | ✅ | `configured-resources.test` 2건 pass, O1 잡음 |
| AC3 기존 instance 상태 병합 | ✅ | A21 잡음 |
| AC4 동적 MCP·plugin 분리 | ✅ | A22 잡음(`…retains partial observations safely`) |
| AC5 같은 범위 단일 행·A/B 분리 | ❌ | P11–P13 green |
| AC6 진입·전환·ready·status 변경 갱신 | ❌ | A23(plugin 선언만 바뀐 외부 편집 미관측) green |
| AC7 오류·부분·빈 성공 구분 | ✅ | F12a–d 잡음, 0280 verify의 오류 구분 잠금 |
| AC8 종료 후 connected 제거 | ✅ | 0274 E4(instance disposed) 잡음 |
| AC9 관측이 실행을 바꾸지 않음 | ✅ | A22·A11 잡음 |
| AC10 전환·교체 후 이전 결과 폐기 | ❌ | A6 green |
| AC11 가짜 파일 열기 없음·민감정보 비노출 | ❌ | O3 green |

- 합계 재측정: `✅ 7 · ❌ 4 = 11`. 자기보고: 0277 단독 trailer 없음(`c765135`·`e4853cb`는 0278 V1 `10/10`, `a082776`은 0278 `21/21`) → 대조 불가.

### §8 / FEP 강제 지점 분모

| 자리 | 결과 |
|---|---|
| global IPC→native reader→nav hook/list | PASS (O1·O2·A20·F12a–c) |
| session/draft IPC→기존 준비 context | PASS (A21·A22·A11) |
| observer ready/dirty/closing→패널 | PAIR_FAIL (A6·A23) |
| preload/API→query scope | PAIR_FAIL (P11–P13 — renderer 수락 scope) |
| source file lookup→shell | PAIR_FAIL (O3) |

- 2/5 PASS. 목록 밖 발견 없음.

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
| D2 | P11–P13: push scope 3항 미잠금 | §8 query scope · AC5 · DV1-P3 | BLOCKING | 0278 R5와 같은 테스트로 닫힘 |
| D3 | A23·A6: plugin 선언 revision·stale revision emit 미잠금 | §8 observer · AC6·AC10 · DV1-P2 | BLOCKING | 0278 R3와 같은 테스트로 닫힘 |
| N1 | 구현이 0278 trailer로만 커밋, 강제 지점 필드 산문 | repository operation | NON_BLOCKING | 다음 구현 커밋에 0277 trailer·자리별 표 |

## 14. Review Signals

- 이전 라운드: 첫 verify. 관련 plan 지침: §8이 "dynamic MCP에는 shell 무호출·실제 파일만 열기"를 oracle로 명시.
- 사용자 결정 변경: D10(nav 표면)·D32(관측만) — 최신 handoff 기준 채점.
- 반복 환경 한계: Windows 전용 fixture, 실제 OpenCode 창 미실행.

## 15. 결론

- 상태: **FAIL** — verify 1회째.
- pair: root PAIR_FAIL 3(DV1-P2·P3·P4) · BLOCKED_BY 2(DV1-P1·V1 VP7). PLAN_GAP 없음.
- AC: ✅7 · ❌4 / 11.
- 다음 단계: Codex r2 — D1–D3(D2·D3는 0278 R3·R5와 공동), 다음 verify는 O3·A6·A23·P11–P13 재실행.
