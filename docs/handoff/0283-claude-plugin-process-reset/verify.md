# Verify — 0283-claude-plugin-process-reset

## 메타

| 항목 | 값 |
|---|---|
| slug | `0283-claude-plugin-process-reset` |
| 검증자 | Claude Code |
| 일자 | 2026-10-24 |
| 대상 커밋/range | `d69b4c54..09bbff48` (r1 `09bbff48`) |
| 구현 전 plan 기준 | `d69b4c54` |
| V mode / 유효 V | `Delta V` / `0282@28d25d35 + 0283 ΔV1` |
| 검증 기준 plan revision | `d69b4c54:ΔV1` |
| 라운드 | 1 |
| 상태 | **RETURN_TO_PLAN** — PLAN_GAP 2(G1·G2)와 PAIR_FAIL 4(VP-02·VP-04·VP-05·VP-R5, 근 D1~D5)가 함께 있다 |
| 자기 검증 여부 | 설계·구현·검증 모두 Claude. 구현 세션(`session_01EPpxU7…`)이 이 검증 세션과 같다 → §4에 보고에 없는 축 24건 |

## 0. 기준선 / plan 변경 확인

- 기준선이 diff로 성립한다: 설계 `d69b4c54`와 구현 `09bbff48`이 분리돼 있다.
- 구현 커밋의 `plan.md` 변경은 `[구현자 기입]` 절뿐이다 — diff 첫 hunk가 406줄(구분선 아래)에서 시작하고 삭제 줄 7개는 모두 빈 필드 표제다.
- Decision Ledger · Product/UX · AC · V node/pair · §10 변경: 0건.
- 채점 기준: `d69b4c54` 시점 plan 원문.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | `git cat-file -t 28d25d35` = commit. 0282 verify r2 PASS(기계 범위) |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R-01·R-02→VP-01·02 · SD-01→VP-03 · AR-01·02→VP-04·05 · MD-01~03→VP-06~08 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | VP-R1~R5(0282 R-09·R-03·AR-08·R-06, 0151) |
| §10 EP-01 자리 목록 — 검색 재실행 차집합 | 유효 | `d69b4c54`에서 ① 검색 25줄 = P1 1·P2 1·P3 2·P4 3·P5 1·P6 1·P7 1·P8 1·P9 1·P10 2·P11 1 + 제외 10. 차집합 0 |
| §10 EP-01 — 문서 자리 oracle | **PLAN_GAP G1** | P11~P13은 목록에 있고 VP-01 §10 열이 P13을 담는데, 어느 pair에도 문서 내용 oracle·gate가 없다. 운영 gate의 doc-inventory는 수치·링크만 본다 |
| §10 EP-01 — 술어·범위가 path를 덮는가 | **PLAN_GAP G2** | VP-05 path와 AC3 path가 `ConfirmDialogHost`를 지나는데(`ConfirmDialogHost.tsx:16·28` onConfirm·취소 배선) 술어에 `openConfirmDialog\|ConfirmDialogHost`가 없어 목록 밖이다. X29·X30 못 잡음 |
| EP-10′ 술어 축소 | 유효 | 뺀 4개 술어의 HEAD 적중 15줄은 모두 Claude 확인 계약 자리(P1~P5·P7·P11). OpenCode 파일 0 |
| 선택적 적대 증거·이유 | 유효 | VP-01·02·03·04·06·R1·R4 등록, 선택 이유 §7-A |
| `SUPERSEDED` 이관 | 유효 | 0282 VP-10 adapter 좌표·C1·C41 → VP-R2. 좌표가 linux에서 green(아래 §5) |
| 운영 gate·범위 | 유효 | app 정적·관련 vitest·doc-inventory·CI·trailer |

- root PLAN_GAP: **G1**(문서 자리 oracle 부재 → VP-01) · **G2**(ConfirmDialogHost 목록 누락 → VP-05·VP-02 AC3).

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 판정 | 실제 production path |
|---|---|---|
| D-001 모든 Claude 프로세스 종료 | 충족 | handler `:53-61` → `createClaudeProcessReset.close` → `discardSessionWork`/`discardLease` → supervisor close |
| D-002 동작 중이면 확인, 아니면 즉시 | 충족 | `extension-catalog.ts:57-58` |
| D-003 공용 확인 대화상자·N·[변경]/[취소] | 충족(잠금은 G2·D3) | `useNativeMcpCatalog.ts:92-99` → `openConfirmDialog` → `ConfirmDialogHost` |
| D-004·D-005 동작 중 기준 | 충족 | `claude-processes.ts:40-58` + `session-activity-busy.ts:6-15` |
| D-006 턴 중단·초안 복원 | 충족 | `discard.ts:27-38` → `broadcastChatEvent`(`bootstrap.ts:1247`) |
| D-007 확인 판정~종료 한 동기 구간 | 충족(코드 `:56-61` await 0) · **잠금 없음(D1)** | `extension-catalog.ts:56-61` |
| D-008 OpenCode MCP 현행 | 충족 | `:63-64` else 분기 |
| D-009 프로젝트 토글 현행 | 충족 | diff가 `project-resource-sync`·우측 패널 경로를 건드리지 않음(`git diff --stat` 27파일) |

```text
/plugins 토글 → useNativeMcpCatalog.toggle → sessionApi → preload invoke
  → extensionSetEnabled(schema) → read·canToggle → [Claude plugin] plan() → busy>0 && !confirmed ? confirm
  → setGlobal(저장) → close(targets) → discardSessionWork / discardLease → runtime close
  → applied → accept(행) | confirm → openConfirmDialog → ConfirmDialogHost → onConfirm → toggle(…, true)
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 허용 | 대상별 try/catch 후 `failed` 보고(`claude-processes.ts:89-95`). 보고 배선 잠금 없음(D4) |
| false success | 경미 | close 일부 실패에도 `applied`. plan §13이 허용. 보고 토스트 제목이 `saveFailed`(N1) |
| partial failure/rollback | 충족 | 저장 throw 시 종료 0(M9 red) |
| A 대신 B | 아님 | lease·풀 양쪽 닫음, OpenCode 제외(bootstrap 4건) |
| 증상만 제거 | 아님 | 런타임 자체를 닫는다 |
| 재검증·취소 관측 손실 | 아님 | preparing lease는 `beginClosing`이 lease controller를 abort(`session-chain-lease.ts:152`) → activate 거부 |
| worst-case 상한 | 유한 | 대상 = lease 수 + 유휴 풀(cap). IPC ≤ 2회 |

## 3. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh d69b4c54..09bbff48`

| 후보 | 판정 | 근거 |
|---|---|---|
| `planClaudeProcesses` 테스트 전용 | 정상 | 같은 파일 `createClaudeProcessReset.plan`(`claude-processes.ts:81`)이 production 호출자 |
| 타입 export 4개 | 정상 | 정의 파일 시그니처용 |
| `protocol.ts` 스키마 6개 미사용 | 비귀속 | 이번 diff가 만든 것이 아님 |
| 형제 정책 비대칭 | 없음 | 스크립트 0건 |
| 신규 방송 소비처 | 무영향 | `message.cancelled`는 각 창 `pendingSteer`에 있는 id만 복원(`chatStore.ts:818-833`) |
| 공용 `ConfirmDialogHost` | **G2** | host를 렌더하는 테스트 0파일(`rg -l ConfirmDialogHost src -g '*.test.*'` → 1건, `automaticFeedDebug.integration.test.ts:51`이 host를 `() => null`로 mock). onConfirm 제거·취소 맞바꿈이 전체 스위트 green |

## 4. 기존 테스트 / semantic 검증 확인

- plan·구현 보고가 인용한 기존 테스트 12건 실재: `rg -F` 각 1파일.
- `post-turn.schedules.test.ts:'%s closes the active response exactly once'`의 discard 케이스는 실제 `chatDiscardSession` handler를 지나지만 residual이 없어 `message.cancelled`를 관측하지 않는다(`:586-590`) → X27.
- 렌더러 대화상자 테스트는 `tr`을 mock하고(`useNativeMcpCatalog.test.ts:8-12`) store의 `onConfirm`·`close`를 직접 부른다 → 리소스 본문(X19·X20)과 host 배선(X29·X30)은 실행 구간 밖.
- **선택된 적대 증거 재측정**: 등록 M1~M13·G01(자리 미지정 M2·M5·M11은 자리별로 나눠 18회 + M10 8회) + 구현자 새 oracle S1 = 25건 중 검출 25 · 미검출 0.
- **이전 라운드 대조**: 첫 verify — 해당 없음. 구현 보고 잡음 22건은 이번에 모두 다시 잡음.
- **자기검증 분모**: 구현자 = 검증자. 보고에 없던 축 24건(X1~X30) — 다른 지점(X1 보고 port·X25 동기 구간·X27 Composer 호출자), 형제 지점(X10·X11·X19·X29·X30), 분모 재열거(EP-01 검색 재실행 + path 파일 대조 → G2).

**고장 이력** — 범위 S = §19 관련 스위트 140파일 1,616케이스, 전체 = 830파일 7,995케이스(기준선 red 17건과 집합 비교).

| ID | `파일:줄` | 종류 | 바꾼 내용 | 범위 | 직전 결과 | 이번 결과 | 잡은 테스트 / 근거 | 귀속 |
|---|---|---|---|---|---|---|---|---|
| M1 | `extension-catalog.ts:61` | 제거 | `processes.close(plan.targets)` | S | 보고 잡음 | 잡음(3) | bootstrap `closes every idle…`·`asks before…` · `extension-catalog.test.ts` | VP-01 등록 |
| M2a | `claude-processes.ts:44` | 맞바꿈 | lease 필터 `'claude'`→`'opencode'` | S | 보고 잡음(2곳 합산) | 잡음(4) | bootstrap `asks before…` · `claude-processes.test.ts` 3 | VP-01 등록 |
| M2b | `claude-processes.ts:53` | 맞바꿈 | runtime 필터 `'claude'`→`'opencode'` | S | 〃 | 잡음(14) | bootstrap 2 · 신호 단독 다수 | VP-01 등록 |
| M3 | `extension-catalog.ts:57` | 제거 | `&& !request.confirmed` | S | 보고 잡음 | 잡음(2) | bootstrap `asks before…`·`keeps every…` | VP-02 등록 |
| M4 | `extension-catalog.ts:57` | 다른 값 | `busy > 0`→`>= 0` | S | 보고 잡음 | 잡음(5) | bootstrap `closes every idle…` · 0282 bootstrap 3 | VP-02 등록 |
| M5a | `useNativeMcpCatalog.ts:88` | 제거 | 요청의 `confirmed` spread | S | 보고 잡음 | 잡음(1) | `'confirms before closing busy…'` | VP-02 등록 |
| M5b | `useNativeMcpCatalog.ts:98` | 제거 | onConfirm 재호출 인자 `true` | S | 신규 | 잡음(1) | 같은 테스트 | VP-02 등록 |
| M6 | `extension-catalog.ts:58` | 다른 값 | `sessions: plan.targets.length` | S | 보고 잡음 | 잡음(1) | bootstrap `asks before…` | VP-02 등록 |
| M7 | `discard.ts:37` | 제거 | `message.cancelled` emit | S | 보고 잡음 | 잡음(2) | `discard.test.ts` · bootstrap `asks before…` | VP-03 등록 |
| M8 | `bootstrap.ts:1241` | 고정값 | activity → 유휴 snapshot | S | 보고 잡음 | 잡음(1) | bootstrap `asks before…` | VP-04 등록 |
| M9 | `extension-catalog.ts:60-61` | 뒤집기 | close를 저장 앞으로 | S | 보고 잡음 | 잡음(1) | bootstrap `keeps every Claude process…` | VP-04 등록 |
| M10a~h | `session-activity-busy.ts:7-14` | 제거 | 8신호 각각 `false` | S | 보고 8/8 | 잡음 8/8(각 2~4) | `'counts <신호> alone…'` · `native-history.test.ts:'does not close or replace an occupied session'` | VP-06 등록 |
| M11a | `claude-processes.ts:48` | 다른 값 | 세션 lease `busy: false` | S | 보고 잡음 | 잡음(3) | bootstrap `asks before…` · 복합 · `counts lease alone…` | VP-06 등록 |
| M11b | `claude-processes.ts:49` | 다른 값 | 세션 없는 lease `busy: false` | S | 신규 | 잡음(2) | dispatch · 복합 | VP-06 등록 |
| M12 | `claude-processes.ts:57` | 제거 | `responding` 신호 | S | 보고 잡음 | 잡음(2) | `counts responding alone…` · dispatch | VP-06 등록 |
| M13 | `extension-catalog.ts:53` | 고정값 | Claude 플러그인 조건 → `true` | S | 보고 잡음 | 잡음(1) | bootstrap `applies OpenCode MCP toggles…` | VP-R1 등록 |
| G01 | `opencode/v1/global-plugins.ts:1` | 제거의 역 | `nativeFileMutations` import 삽입 | gate | 보고 잡음 | 잡음(0→1→원복 0) | `gate:` EP-10′ 음성 검색 | VP-R4 등록 |
| S1 | `protocol.ts:767` | 빈 값 | `.transform(() => undefined)` | S | 보고 잡음 | 잡음(2) | bootstrap `asks before…`·`keeps every…` | 구현자 새 oracle |
| X1 | `bootstrap.ts:1249-1255` | 빈 값 | `failed: () => {}` | 전체 | 신규 | **못 잡음** | red 17 = 기준선 17 | 재량 → D4 |
| X2 | `bootstrap.ts:1240` | 고정값 | `backendOf: () => 'claude'` | S | 신규 | 잡음(2) | bootstrap `closes every idle…`·`asks before…` | 재량 |
| X3 | `bootstrap.ts:1247` | 빈 값 | 방송 emit → `() => {}` | S | 신규 | 잡음(1) | bootstrap `asks before…` | 재량 |
| X4 | `bootstrap.ts:1243-1248` | 호출 대체 | discardSession → `supervisor.discardRuntime` | S | 신규 | 잡음(1) | bootstrap `asks before…` | 재량 |
| X5 | `claude-processes.ts:91` | 뒤집기 | dispatch 조건 반전 | S | 신규 | 잡음(3) | bootstrap 2 · dispatch | 재량 |
| X6 | `claude-processes.ts:41` | 제거 | closing 제외 | S | 신규 | 잡음(1) | 복합 | 재량 |
| X7 | `claude-processes.ts:39` | 제거 | lease 세션 `seen` 선등록 | S | 신규 | 잡음(3) | bootstrap `asks before…` · 복합 · `counts lease alone…` | 재량 |
| X8 | `claude-processes.ts:60` | 다른 값 | `busy: targets.length` | S | 신규 | 잡음(4) | bootstrap 2 · dispatch · 복합 | 재량 |
| X9 | `claude-processes.ts:94` | 호출 대체 | `failed(error)` → `throw error` | S | 신규 | 잡음(1) | dispatch | 재량 |
| X10 | `useNativeMcpCatalog.ts:94-95` | 맞바꿈 | title ↔ message | S | 신규 | 잡음(1) | `'confirms before…'` | 형제 슬롯 |
| X11 | `useNativeMcpCatalog.ts:96-97` | 맞바꿈 | confirmLabel ↔ cancelLabel | S | 신규 | 잡음(1) | 같은 테스트 | 형제 슬롯 |
| X12 | `useNativeMcpCatalog.ts:95` | 고정값 | `count: 1` | S | 신규 | 잡음(1) | 같은 테스트 | 재량 |
| X14 | `discard.ts:31-32` | 뒤집기 | abort ↔ discardRuntime 순서 | S | 신규 | 잡음(1) | `discard.test.ts` | 재량 |
| X15 | `supervisor.ts:305` | 제거 | `emitLease(key)` | S | 신규 | 잡음(1) | `'discards a session-less lease…'` | 재량 |
| X16 | `supervisor.ts:303` | 제거 | child abort | S | 신규 | 잡음(2) | supervisor 2 | 재량 |
| X17 | `supervisor.ts:293` | 제거 | `discardRuntime`의 lease 분기 | S | 신규 | 잡음(2) | bootstrap `asks before…` · `'active lease discard…'` | 재량 |
| X18 | `protocol.ts:767` | 다른 값 | `z.literal(true)` → `z.boolean()` | 전체 | 신규 | **못 잡음** | red 17 = 기준선 17 | 재량 → D2 |
| X19 | `en.ts:621·623` | 맞바꿈 | `claudeCloseBody_one` ↔ `_other` 본문 | 전체 | 신규 | **못 잡음** | red 17 = 기준선 17 | 형제 슬롯 → D3 |
| X20 | `ko.ts:625·627` · `en.ts:621·623` | 제거 | 본문 `{{count}}` 4곳 | 전체 | 신규 | **못 잡음** | red 17 = 기준선 17 | 재량 → D3 |
| X21 | `native-history.ts:7` | 고정값 | 재수출 판정 → `false` | S | 신규 | 잡음(9) | `native-history.test.ts` 9 | 재량 |
| X25 | `extension-catalog.ts:56` | 뒤집기 | `plan()` 뒤 `await Promise.resolve()` | 전체 | 신규 | **못 잡음** | red 17 = 기준선 17 | 재량 → D1 |
| X27 | `chat-turn/index.ts:177` | 빈 값 | 요청 창 emit → `void e` | 전체 | 신규 | **못 잡음** | red 17 = 기준선 17 | 재량 → D5 |
| X29 | `ConfirmDialogHost.tsx:16` | 제거 | `request.onConfirm()` | 전체 | 신규 | **못 잡음** | red 17 = 기준선 17 | 재량 → G2 |
| X30 | `ConfirmDialogHost.tsx:28` | 맞바꿈 | `onCancel={close}` → `{handleConfirm}` | 전체 | 신규 | **못 잡음** | red 17 = 기준선 17 | 형제 슬롯 → G2 |

- 검산: 시도 49(M 25 · X 24) = 잡음 41 · 못 잡음 8 · 동치 0. 못 잡음 8건은 §13에서 다음 구현 의무로 이관한다.
- `못 잡음` 확인: 관련 스위트 green 뒤 전체 스위트로 재실행, 실패 집합이 기준선 17건과 같음(집합 차 0). 매 변이 뒤 `git status` 잔여 0.
- 동작 보존 추출 라운드인가: 일부(P10 본문 이동·P15 판정 이동). 해당 자리는 hunk 되돌림이 아닌 고장 주입(X14·X21·X27)으로 쟀다.
- 소거 변이 잔여물: 해당 없음 — vitest는 미사용 import·타입 진단을 내지 않는다.
- 형제 슬롯 맞바꿈: 4쌍(X10·X11·X19·X30) → 검출 2.
- `N회` 관측 주체: close 횟수는 `managed().closed` 카운터, 대상 수는 handler 응답 `sessions`.
- 순서 관측: 저장→종료는 저장 throw 시 close 0(M9), discard 순서는 `order` 배열(`discard.test.ts`).

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 |
|---|---|---|---|---|---|
| VP-06 | MD-01 ↔ UT-01 | REQUIRED | PASS | `claude-processes.test.ts` 13케이스 · `native-history.test.ts` · M2a·b·M10·M11·M12·X5~X9·X21 잡음 | P14·P15 2/2 |
| VP-07 | MD-02 ↔ UT-02 | REQUIRED | PASS | `supervisor.test.ts:'discards a session-less lease…'`·`'active lease discard…'` · X15·X16·X17 잡음 | P9 1/1 |
| VP-08 | MD-03 ↔ UT-03 | REQUIRED | PASS | `discard.test.ts:'returns residual submissions…'` · M7·X14 잡음 | P10 `discard.ts` 부분 |
| VP-04 | AR-01 ↔ IT-01 | REQUIRED | **PAIR_FAIL** | bootstrap 4건이 실제 supervisor·activity·queue로 조립. activity·backendOf·discardSession 항 잠김(M8·X2·X3·X4), `failed` 항 못 잡음(X1) | P6·P14 잠김 · **P8 `failed` 항 열림(D4)** |
| VP-05 | AR-02 ↔ IT-02 | REQUIRED | **PAIR_FAIL** | 렌더러 3건 · M5·X10~X12 잡음. 리소스 본문 X19·X20 못 잡음. host 배선 X29·X30 못 잡음(G2) | P3~P5 잠김 · **P16 열림(D3)** |
| VP-03 | SD-01 ↔ ST-01 | REQUIRED | PASS | bootstrap `asks before…`(abort·close·`message.cancelled ['m-A']`) · `supervisor.test.ts:'creates a new runtime after an idle runtime is discarded'` · CI windows `adapter.native-plugins.test.ts` 7/7(cold resume 포함) · `adapter.fork.test.ts` resume | P9·P14 · P10 토글 경로 부분 |
| VP-R5 | 0151 ↔ ST | REGRESSION | **PAIR_FAIL** | `chatDiscardSession` 경로의 요청 창 emit 항 못 잡음(X27). 공유 함수 부분은 VP-08 좌표 | **P10 `index.ts:175-177` 열림(D5)** |
| VP-01 | R-01 ↔ AT-01 | REQUIRED | BLOCKED_BY:G1 | 코드 자리 잠김(M1·M2·X2 · bootstrap `closes every idle…`). P13 문서 자리는 oracle이 없다 | P13 미판정(G1). P1·P7·P8 열린 항은 VP-02·VP-04에 귀속 |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | **PAIR_FAIL** | bootstrap `asks before…` · 렌더러 `confirms before…` · M3~M6 잡음. 동기 구간 X25·`false` 거절 X18 못 잡음 | **P7 동기 구간(D1) · P1 `literal(true)`(D2) 열림** · P16은 VP-05 근 |
| VP-R1 | R-03 ↔ AT-03 | REGRESSION | PASS | bootstrap `applies OpenCode MCP toggles…` · 0282 `restores global choices…` green · M13 잡음 | P7 OpenCode 분기 |
| VP-R2 | 0282 R-03 | REGRESSION | PASS | 0282 3좌표 linux green(`'applies current global plugin choices…'` 포함) · M4가 0282 bootstrap 3건을 red로 만듦 | 0282 EP-02 |
| VP-R3 | 0282 AR-08 | REGRESSION | PASS | 0282 `restores global choices through production Bootstrap…` green | 0282 EP-11 |
| VP-R4 | 0282 R-06 | REGRESSION | PASS | EP-10′ 0건 · 엄격(테스트 포함) 0건 · view 고정 행 green · G01 잡음 | EP-10′ 29 |

- root `PAIR_FAIL`: VP-02(D1·D2) · VP-04(D4) · VP-05(D3) · VP-R5(D5).
- 종속: VP-01 → G1(PLAN_GAP). VP-02의 P16은 VP-05 근으로 세고 따로 세지 않는다.
- 이번 라운드 실행 범위: 최초 검증 — REQUIRED 8 + REGRESSION 5 전건.
- 좌표의 실행 구간: bootstrap 테스트는 production `Bootstrap.prototype.register`로 들어가 하네스 `globalResources`(카탈로그 입력)와 `ctx.db.getSessionById`(backend 값)만 대체한다(`bootstrap.native-history.test.ts:988-989·1007`). 둘 다 X2·M13으로 운반 항이 구별된다. 렌더러는 `tr`을 mock하고 host를 렌더하지 않는다 — 리소스 본문·host 배선은 구간 밖.

### AT / AC 세부와 합계

| AC | 결과 | 검증 증거 |
|---|---|---|
| AC1 | ✅ | bootstrap `closes every idle…`: close `[1,1,0]` · `applied` · 저장값 |
| AC2 | ✅(잠금은 D3·G2) | bootstrap `sessions: 2`·close 0 · 렌더러 store 제목·`claudeCloseBody(2)`·라벨. HEAD 리소스 ko·en에 `{{count}}` 존재(`ko.ts:625·627`) |
| AC3 | ✅(host 잠금은 G2) | 렌더러 store `close()` 뒤 호출 1·행 유지 |
| AC4 | ✅ | 렌더러 3번째 호출 `confirmed: true` · bootstrap child abort·close `[1,1,1,0,0]`·`message.cancelled ['m-A']` |
| AC5 | ✅ | 신호 11행 단독 busy 1 · M10a~h·M11·M12 잡음 |
| AC6 | ✅ | supervisor discard 뒤 factory 1회 · 전역 flag는 Query 생성마다 읽음(`adapter.ts:444`, VP-R2 좌표) · CI windows run `40082529703` cold resume 통과 |
| AC7 | ✅ | bootstrap OpenCode MCP 토글 close 0 |
| AC8 | ✅ | bootstrap 저장 throw → reject·close 0·child 미중단 |
| AC9 | ⚠️ | 사람 실기 대기(Windows) |

- 합계 재측정: ✅ 8 · ⚠️ 1 · ❌ 0 = 총 9. 자기보고 ✅7·⚠️2 — 차이는 AC6(CI windows가 r1 커밋 뒤 green).
- 합계 사본 대조: 본문 ✅7 ↔ trailer `Criteria-Met: 7/9` ↔ INDEX `✅7·⚠️2` 일치.

### pair별 plan §10 강제 지점 분모

| 자리 | 확인 · oracle 좌표 | 결과 |
|---|---|---|
| P1 `protocol.ts:767` | S1 잡음(운반) · X18 못 잡음(`literal(true)` 거절) | 열림 — D2 |
| P2 `native-resources.ts:63-70` | 타입 전용. 런타임 값은 preload `'carries explicit…'`·bootstrap `toEqual(confirm)` | 닫힘 |
| P3 `preload/index.ts:294-297` · P4 `ipc.ts:223-225` | preload `'carries explicit…'`(confirm·applied 두 형상, `confirmed` 운반) | 닫힘 |
| P5 `useNativeMcpCatalog.ts:82-99` | 렌더러 3건 · M5a·b·X10~X12 | 닫힘 |
| P6 `extension-catalog.ts:19` | M1 | 닫힘 |
| P7 `extension-catalog.ts:53-64` | M3·M4·M6·M9·M13 잡음 · X25 못 잡음 | 열림 — D1 |
| P8 `bootstrap.ts:1236-1257` | M8·X2·X3·X4 잡음 · X1 못 잡음 | 열림 — D4 |
| P9 `supervisor.ts:291-307` | X15·X16·X17 | 닫힘 |
| P10 `chat-turn/index.ts:174-178` · `discard.ts` | M7·X14 잡음 · X27 못 잡음 | 열림 — D5 |
| P11·P12 `IPC_CONTRACT.md:193·197` · P13 `adapters.md:69` | oracle 없음. 현재 문구는 `rg`로 일치(옛 문구 0) | G1 |
| P14 `claude-processes.ts` | `claude-processes.test.ts` · bootstrap | 닫힘 |
| P15 `session-activity-busy.ts` · `native-history.ts:7-9` | M10a~h · X21 | 닫힘 |
| P16 i18n `claudeClose*` | 키 집합·플레이스홀더 일치 테스트만. X19·X20 못 잡음 | 열림 — D3 |

- 재계수: 닫힘 8(P2~P6·P9·P14·P15) · 열림 5(P1·P7·P8·P10·P16) · 문서 3(G1) = 16. 구현 보고 13/16과 다른 5자리는 운반 항 일부가 잠기지 않은 자리다.
- 목록 밖 자리: `ConfirmDialogHost.tsx:16·28` — X29·X30 못 잡음 → G2.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| lint | PASS | 0 error · 2 warning(`react-hooks/incompatible-library`). 실행 후 `git status` 변경 0 |
| typecheck | PASS | 3구성 exit 0 · `error TS` 0 |
| 관련 vitest | PASS | §19 집합 140파일 1,616케이스 전부 통과 |
| 전체 vitest(linux) | 환경 한계 | 830파일 7,995케이스 중 17 red. 기준선 `d69b4c54` 828파일 7,972케이스 중 17 red와 집합 동일(Windows 전용·`C:/` 경로) |
| CI `gate`(windows) | PASS | run `40082529703` @`09bbff48` — 828 passed·2 skipped(830) · 7,993 passed·2 skipped(7,995) · failed 0 |
| doc-inventory | PASS | generated·prose·links ok |
| EP-10′ 음성 | PASS | 0건 · 엄격(테스트 포함) 0건 |
| trailer | PASS | `09bbff48` 6키 + attribution 2 파싱 · `d69b4c54` 3키 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| `orca:extensions:setEnabled` | preload 왕복 두 형상 | bootstrap 4건 | 충족. 문서 행(P11)은 G1 |

## 7. 숫자 / 음성 기준 / 상한 재측정

- EP-01 검색: 기준선 25줄 = 자리 15 + 제외 10, HEAD 28줄 = 구현자 분류(P3 3·P7 2·P10 3).
- 동작 중 신호: `session-activity-busy.ts` 8 + lease + responding = 10종, 테스트 11행(foreground 2값).
- 상한: 대상 = lease + 유휴 풀. IPC ≤ 2.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증 범위 | 남은 사람 실기 |
|---|---|---|
| AC9 | 판정·열거·순서·문구 키·N 전달 | Windows에서 `/context` superpowers 부재, 대화상자 white/dark |
| host 배선 | 없음(G2) | G2 정정 뒤 기계 검증 대상 — 사람 몫이 아니다 |

## 9. 게이트 재실행

- 명령: `npm run typecheck` · `npm run lint` · `./node_modules/.bin/vitest run`(기준선 worktree·HEAD) · §19 집합 · `node scripts/check-doc-inventory.mjs --check`.
- `npm test` 미사용. better-sqlite3가 Node ABI로 이미 로드돼 DB 스위트까지 실행됐다.
- 게이트의 트리 변경: 없음(lint `--fix` 후 `git status` 공백).
- 잔여물: 검증용 worktree 2개(scratchpad) — 커밋 전 제거.

## 10. 검증 책임 분리

| 항목 | 결과 |
|---|---|
| lint/typecheck/자동 테스트 | 에이전트 — PASS(linux 17 red 기준선 동일, CI green) |
| AC ↔ production path | 에이전트 — 8/9, AC9 사람 |
| 제품 결정 | 사람 — N1 토스트 제목, N2 확정 버튼 `danger` 여부 |

## 11. Repository operation checks

- AGENTS.md 변경: 없음.
- INDEX: 상태 `impl/IMPL_DONE`·다음 주체 Claude(검증) 일치. 대상 커밋 자리표시자 2개 → `d69b4c54`·`09bbff48`(`git cat-file -t` commit). 비고 4줄.
- trailer: `Agent: claude` 허용값. 파싱 확인(§5 gate).
- `[구현자 기입]` 7필드: 설계 리뷰·강제 지점 전수·잠금·Product/UX·잠재 문제·구현 보고·Review Signals 7/7. 강제 지점 표는 P1~P16 전부와 `남긴 곳`을 담는다.
- 인용 해시: `28d25d35`·`c1481dad` commit.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 판단 |
|---|---|
| 설계 대비 차이 1 테스트 분할 | 타당 — 신호 단독 11행 + 복합 1 |
| 차이 2 closing lease 세션의 runtime 제외 | 타당 — 구현 세부 보완, X6·X7 잡음으로 잠김 |
| 차이 3 en `_one`/`_other` 분리 | 타당. 다만 두 슬롯 맞바꿈이 잠기지 않음(D3) |
| 설계 리뷰 "동기 구간 성립" | 코드상 참. 근거가 코드 읽기라 좌표가 아니다(D1) |
| 파생 ①토스트 제목 ②`danger` | 사람 결정 — N1·N2 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| G1 | EP-01 문서 자리 P11~P13에 oracle이 없고 VP-01 §10 열이 P13을 담는다 | §10 EP-01 · VP-01 | PLAN_GAP | 설계자: 문서 oracle 등록(예: drift-check DA 행·`gate:` 검색) 또는 pair 분모에서 분리 |
| G2 | VP-05·AC3 path의 `ConfirmDialogHost.tsx:16·28`이 EP-01 목록 밖(술어에 host 없음). X29·X30 못 잡음 | §10 EP-01 · VP-05 · AC3 | PLAN_GAP | 설계자: 자리·oracle 추가. 구현: X29·X30을 잡는 좌표 |
| D1 | D-007 동기 구간 미잠금 — `plan()` 뒤 await 삽입이 전체 green(X25) | D-007 · VP-02 · P7 | BLOCKING(PAIR_FAIL) | 구현: 판정~종료 사이 끼어든 작업을 관측하는 좌표 |
| D2 | `confirmed` `false` 거절 미잠금(X18) | §10 주석 · VP-02 · P1 | BLOCKING(PAIR_FAIL) | 구현: 스키마 거절 좌표 |
| D3 | 대화상자 본문 리소스 미잠금 — N 제거·단복수 맞바꿈 green(X19·X20) | AC2 · VP-05 · P16 | BLOCKING(PAIR_FAIL) | 구현: 실제 리소스로 count 보간·복수형 관측 |
| D4 | 종료 일부 실패 보고 배선 미잠금(X1) | §13 · VP-04 · P8 | BLOCKING(PAIR_FAIL) | 구현: bootstrap에서 close 실패 → reportError 관측 |
| D5 | Composer [세션 전체 중단]의 요청 창 `message.cancelled` 미잠금(X27). AS-IS에도 같은 공백 | VP-R5 · P10 | BLOCKING(PAIR_FAIL) | 구현: handler 경유 residual 복원 emit 관측 |
| N1 | 일부 종료 실패 토스트 제목이 `saveFailed`(`bootstrap.ts:1252`) — 저장은 성공 | Product/UX 파생 | NON_BLOCKING | 사람 결정 |
| N2 | 확정 버튼이 `danger`가 아니다. store 주석은 파괴적 액션에 `danger: true`(`confirmDialogStore.ts:6`) | D-003 | NON_BLOCKING | 사람 결정 |
| N3 | `confirm` 응답은 `mounted`·version을 보지 않아 unmount 뒤·더 새 토글 뒤에도 대화상자를 연다(`useNativeMcpCatalog.ts:92`) | 비귀속 | NON_BLOCKING | 기록 |
| N4 | DB 행 없는 유휴 runtime은 backend를 몰라 닫지 않는다(구현자 보고) | 비귀속 | NON_BLOCKING | 기록 |

## 14. Review Signals — 사실만

- 이전 라운드: 없음(첫 verify).
- plan 지침: §10 주석이 동기 구간을 "유일한 장치", `false`를 "스키마 거절"로 적었으나 pair 등록 변이에 없다. 문서 자리를 목록에 넣고 oracle을 두지 않았다. AC3 path가 `ConfirmDialogHost`를 이름으로 가리키지만 검색 술어에 없다.
- 구현자 보고: 동기 구간 "성립"의 근거가 코드 읽기였다. 강제 지점 13/16을 자리 단위로 셌고 운반 항 단위 잠금은 세지 않았다.
- X27의 공백은 0151 AS-IS handler에도 있었다(기존 discard 케이스에 residual 없음).
- 반복 환경 한계: linux에서 Windows 전용·`C:/` 경로 스위트 17 red. AC6 cold resume은 CI windows로만 닫힌다.
- 사용자 결정 변경 근거: 없음.

## 15. 결론

- 상태: **RETURN_TO_PLAN** — PLAN_GAP G1·G2와 PAIR_FAIL D1~D5가 함께 있다.
- verify 횟수: 1회째.
- pair 결과: PASS 8(VP-03·06·07·08·R1~R4) · PAIR_FAIL 4(VP-02·04·05·R5) · BLOCKED_BY 1(VP-01 → G1) = 13.
- Product/UX·ACTIVE Decision: 동작은 전부 충족. D-007·D-003의 잠금이 비었다.
- AC: ✅ 8 · ⚠️ 1(AC9) · ❌ 0.
- 운영 gate: PASS(linux 17 red는 기준선과 같은 집합, CI windows green).
- NON_BLOCKING: N1~N4.
- 남은 사람 확인: AC9 · N1·N2 결정.
- 다음 단계: 설계자가 G1·G2를 Delta V revision으로 정정해 `plan/READY` → 구현자가 D1~D5와 X29·X30을 잡는 좌표를 만든다.

---

# r2 — 2026-10-25

r1 판정과 근거는 위 본문에 그대로 둔다. 이 절은 r2만 판정한다.

## r2 메타

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `7fdc497a..95ffc5f5` (r2 `95ffc5f5`) |
| 구현 전 plan 기준 | `7fdc497a` (ΔV2) |
| V mode / 유효 V | `Delta V` / `0282@28d25d35 + 0283 ΔV1@d69b4c54 + ΔV2@7fdc497a` |
| 검증 기준 plan revision | `7fdc497a:ΔV2` |
| 라운드 | 2 |
| 상태 | **RETURN_TO_PLAN** — PLAN_GAP 1(G3)과 PAIR_FAIL 1(VP-05′, 근 D6)이 함께 있다. 둘 다 D-011 렌더 운반 자리다 |
| 자기 검증 여부 | 구현자 = Codex(trailer `Agent: codex`). ΔV2 설계자 = 검증자(Claude)라 plan validity는 자기 설계 감사다 → 보고에 없던 축 17건(§r2-4 Y·K) |

## r2-0. 기준선 / plan validity

- 기준선이 diff로 성립한다: 설계 `7fdc497a`와 구현 `95ffc5f5`가 분리돼 있다.
- 구현 커밋의 `plan.md` 변경은 메타 상태 1줄(`:11`)과 `[구현자 기입]` r2 추가(`:732` 이후)뿐이다 — `git diff 7fdc497a..95ffc5f5 -- plan.md` hunk 2개.
- Decision Ledger · Product/UX · AC · V node/pair · §10 변경 0건. 채점 기준은 `7fdc497a` 시점 plan 원문이다.

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V 적용 순서·상속 기준 | 유효 | 세 커밋 `git cat-file -t` = commit. ΔV2가 VP-01·02·04·05·R5를 ′로 대체 |
| CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R-01′·R-02′·AR-01′·AR-02′ → VP-01′·02′·04′·05′. VP-R5′ REGRESSION |
| `SUPERSEDED` 이관 | 유효 | M1~M9·M5 승계, D1~D5 → M14~M19, G2 → M20·M21, P13 → G-DOC(`plan.md:476-482`) |
| §10 EP-01′ 자리 목록 — 검색 재실행 차집합 | 유효 | ① 62줄 = 자리 46 + 제외 16 · ② 43줄 = 자리 21 + 제외 22 · 미분류 0 · 안 쓰인 제외 0(`7fdc497a`·`95ffc5f5` 동일, ko/en 줄 +1 이동뿐) |
| §10 EP-01′ — 술어·범위가 path를 덮는가 | **PLAN_GAP G3** | ② 술어에 `danger`가 없어 D-011 운반 `ConfirmDialogHost.tsx:32` `danger={request.danger}`가 S9(`:9-31`) 밖이다. AC2′ oracle은 store `danger`에서 멈춘다. Y1·Y2 못 잡음 |
| G-DOC ④ | 유효 | `[0,1,1,1,1]` · MD1 → `[1,1,1,1,0]` · MD2 → `[0,0,1,1,1]` |
| EP-10′ | 유효 | 음성 술어 0줄 · 테스트 포함 0줄 · `nativeFileMutations` 0줄 |
| 운영 gate·범위 | 유효 | lint·typecheck·관련 vitest·doc-inventory·CI·trailer·G-DOC |

- r1 PLAN_GAP: **G1 닫힘**(G-DOC gate, MD1·MD2 잡음) · **G2 닫힘**(host `:16·28`이 S9, M20·M21 잡음).
- 새 root PLAN_GAP: **G3** → 영향 VP-05′·VP-02′(AC2′).

## r2-1. Product & UX / ACTIVE Decision

| Decision | 판정 | 실제 production path |
|---|---|---|
| D-001·D-002·D-004~D-009 | 충족 — r1과 같은 경로. r2 production diff는 제목 1개뿐 | `git diff --stat 7fdc497a..95ffc5f5 -- app/src` production 4파일 |
| D-003 공용 대화상자·N·[변경]/[취소] | 충족 | hook `:93-99` → store `:24` → host `:20-37` → Modal·ModalActions. N-host가 실제로 렌더 |
| D-007 동기 구간 | 충족 · **잠김**(M14a·M14b) | `extension-catalog.ts:56-61` |
| D-010 종료 실패 전용 제목 | 충족 · 잠김(M18·M18b) | `bootstrap.ts:1249-1255` → `reportError` → `errorReportHub.publish` → `ErrorToastHost.tsx:40` `errors.toast.${title}` |
| D-011 [변경] 기본 버튼 | 충족(동작) · **렌더 잠금 없음(G3·D6)** | store `danger` 미지정 → host `:32` → `Modal.tsx:115` `variant={danger ? 'danger' : 'primary'}` |

## r2-2. 구현 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 실패 방식·false success | ✅ | 대상별 실패를 전용 제목으로 1회씩 보고(Y7·Y8 잡음) |
| 부분 실패 잔여 | ✅ | 저장 → 종료 순서 불변(M9 잡음) |
| 테스트 환경 대체 | 허용 | `zustand` React binding만 fake `useSyncExternalStore`로 연결. `createStore`·action·host·Modal은 실제 코드 — 실행 환경 대체로 판정 |
| P0 동치 주장(구현 보고) | 타당 | `messageCountForAttempts`(`pending-message-queue.ts:430-437`)는 `deliveryPendingCount`(`:424-426`)의 open 배치 부분집합이다 |

## r2-3. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh 7fdc497a..95ffc5f5` — 대상 4파일.

| 후보 | 판정 | 근거 |
|---|---|---|
| `APP_ERROR_DETAIL_MAX` 미사용 export | 무관 | 같은 파일 `:34-35`가 사용. 이번 diff가 만든 것이 아님 |
| `APP_ERROR_TITLES` 테스트 전용 | 정상 | `AppErrorTitle` 타입 파생(`app-error.ts:27`)이 production 소비 |
| 형제 정책 비대칭 | 없음 | 스크립트 0건 |
| ② 6파일 밖 path 운반 자리 | G3 정정 범위 | `CatalogToggle.tsx:31` `await onToggle?.()`(스위치 → hook) · `Modal.tsx:57·70·75·77`(배경 클릭·제목·본문·footer) · host `:36`(본문). 모두 잡음(Y6·Y12~Y15·Y17) |

## r2-4. 고장 이력 (r2)

- 하네스: 파일 문자열 1곳 치환 → 집중 스위트 F(26파일 287케이스, 원본 전부 green) → 원복. 미검출은 전체 스위트(830파일 8,002케이스)로 재실행해 실패 집합을 기준선 17건과 이름으로 비교. 매 변이 뒤 `git status` 0.
- 시도 77 = 잡음 75 · 못 잡음 2 · 동치 0.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 직전 결과 | 이번 결과 | 잡은 테스트 / 근거 | 귀속 |
|---|---|---|---|---|---|---|---|
| M1 | `extension-catalog.ts:61` | 제거 | 종료 호출 | 잡음 | 잡음(5) | `closes every idle Claude process…` 외 | VP-01′ 승계 |
| M2a·M2b | `claude-processes.ts:44·53` | 맞바꿈 | `'claude'`→`'opencode'` | 잡음 | 잡음(4·15) | `asks before…` · `counts lease alone…` | VP-01′ 승계 |
| M3 | `extension-catalog.ts:57` | 제거 | `&& !request.confirmed` | 잡음 | 잡음(3) | `asks before…` · `rejects confirmed: false…` | VP-02′ 승계 |
| M4 | `:57` | 다른 값 | `busy >= 0` | 잡음 | 잡음(7) | 0282 bootstrap 3 외 | VP-02′ 승계 |
| M5a·M5b | `useNativeMcpCatalog.ts:88·98` | 제거 | `confirmed` spread · onConfirm `true` | 잡음 | 잡음(2·2) | `confirms before…` · N-host | VP-05′ 승계 |
| M6 | `extension-catalog.ts:58` | 다른 값 | `sessions: targets.length` | 잡음 | 잡음(1) | `asks before…` | VP-02′ 승계 |
| M7 | `discard.ts:37` | 제거 | 복원 emit | 잡음 | 잡음(3) | T-discard · N-discard | VP-03 |
| M8 | `bootstrap.ts:1241` | 고정값 | activity 유휴 | 잡음 | 잡음(1) | `asks before…` | VP-04′ 승계 |
| M9 | `extension-catalog.ts:60-61` | 뒤집기 | 종료 → 저장 | 잡음 | 잡음(2) | `keeps every…` · N-sync | VP-04′ 승계 |
| M10a~h | `session-activity-busy.ts:7-14` | 제거 | 8신호 각각 `false` | 잡음 8/8 | 잡음 8/8(각 2~4) | `counts <신호> alone…` · `does not close or replace…` | VP-06 |
| M11a·M11b | `claude-processes.ts:48·49` | 다른 값 | lease `busy: false` | 잡음 | 잡음(3·2) | `counts lease alone…` · 복합 · dispatch | VP-06 |
| M12 | `:57` | 제거 | `responding` | 잡음 | 잡음(2) | `counts responding alone…` | VP-06 |
| M13 | `extension-catalog.ts:53` | 고정값 | Claude 분기 `true` | 잡음 | 잡음(1) | T-boot-oc | VP-R1 |
| S1 | `protocol.ts:767` | 빈 값 | `confirmed` → undefined | 잡음 | 잡음(3) | `asks before…` · N-false | r1 새 oracle |
| M14a·M14b (X25) | `extension-catalog.ts:56·60` 뒤 | 뒤집기 | `await Promise.resolve()` | 못 잡음(X25) | 잡음(1·1) | N-sync | VP-02′ 등록 |
| M15 (X18) | `protocol.ts:767` | 다른 값 | `z.boolean()` | 못 잡음 | 잡음(1) | N-false | VP-02′ 등록 |
| M16 ko1·ko2·en1·en2 | `ko.ts:625·627` · `en.ts:621·623` | 제거 | `{{count}}` 자리별 | 신규 | 잡음(1·2·2·2) | T-res 플레이스홀더 · N-host(ko2) · N-host-en(en) | VP-05′ 등록 |
| X20 | 같은 4곳 동시 | 제거 | `{{count}}` 4곳 | 못 잡음 | 잡음(2) | N-host · N-host-en | 직전 이력 |
| M17 (X19) | `en.ts:621·623` | 맞바꿈 | `_one`↔`_other` | 못 잡음 | 잡음(1) | N-host-en | VP-05′ 등록 |
| M18 (X1) | `bootstrap.ts:1249` | 빈 값 | `failed` no-op | 못 잡음 | 잡음(1) | N-fail | VP-04′ 등록 |
| M18b | `bootstrap.ts:1253` | 다른 값 | 제목 `saveFailed` | 신규 | 잡음(1) | N-fail | VP-04′ 등록 |
| M19 (X27) | `chat-turn/index.ts:177` | 빈 값 | 요청 창 emit → `void e` | 못 잡음 | 잡음(1) | N-discard | VP-R5′ 등록 |
| M20 (X29) | `ConfirmDialogHost.tsx:16` | 제거 | `request.onConfirm()` | 못 잡음 | 잡음(1) | N-host | VP-05′ 등록 |
| M21 (X30) | `:28` | 맞바꿈 | `onCancel={handleConfirm}` | 못 잡음 | 잡음(2) | N-host · N-host-en | VP-05′ 등록 |
| M22 | `:24` | 맞바꿈 | `onClose={handleConfirm}` | 신규 | 잡음(1) | N-host | VP-05′ 등록 |
| M23 | `ExtensionsCatalogView.tsx:164` | 호출 대체 | `toggle(b, r, true)` | 신규 | 잡음(2) | N-host | VP-05′ 등록 |
| M24 | `CustomizeList.tsx:116` | 다른 값 | 세 번째 인자 `true` | 신규 | 잡음(3) | T-list | VP-01′ 등록 |
| MD1 | `adapters.md:69` | 다른 값 | `d69b4c54` 옛 문장 복원 | 신규 | 잡음 | `gate:` ④ `[1,1,1,1,0]` | G-DOC 등록 |
| MD2 | `IPC_CONTRACT.md:193` | 제거 | `SetGlobalNativeResourceResult` | 신규 | 잡음 | `gate:` ④ `[0,0,1,1,1]` | G-DOC 등록 |
| G01 | `opencode/v1/global-plugins.ts:1` | 제거의 역 | `nativeFileMutations` import | 잡음 | 잡음(0→1→0) | `gate:` EP-10′ | VP-R4 |
| X2 | `bootstrap.ts:1240` | 고정값 | `backendOf: () => 'claude'` | 잡음 | 잡음(2) | T-boot-idle·ask | 직전 이력 |
| X3 | `:1247` | 빈 값 | 방송 → `() => {}` | 잡음 | 잡음(1) | T-boot-ask | 직전 이력 |
| X4 | `:1243-1248` | 호출 대체 | discardSession → `discardRuntime` | 잡음 | 잡음(1) | T-boot-ask | 직전 이력 |
| X5 | `claude-processes.ts:91-92` | 뒤집기 | dispatch 조건 | 잡음 | 잡음(4) | T-boot · dispatch | 직전 이력 |
| X6·X7·X8 | `:41` · `:39` · `:60` | 제거·제거·다른 값 | closing 제외 · `seen` 선등록 · `busy: targets.length` | 잡음 | 잡음(1·3·5) | 복합 · `counts lease alone…` · T-boot | 직전 이력 |
| X9 | `:94` | 호출 대체 | `failed` → `throw` | 잡음 | 잡음(2) | N-fail · dispatch | 직전 이력 |
| X10·X11·X12 | `useNativeMcpCatalog.ts:94-97` | 맞바꿈·맞바꿈·고정값 | title↔message · 라벨 · `count: 1` | 잡음 | 잡음(3·3·3) | `confirms before…` · N-host · N-host-en | 직전 이력 |
| X14 | `discard.ts:31-32` | 뒤집기 | abort ↔ discardRuntime | 잡음 | 잡음(1) | T-discard | 직전 이력 |
| X15·X16·X17 | `supervisor.ts:305·303·293` | 제거 | emitLease · child abort · lease 분기 | 잡음 | 잡음(1·2·2) | T-sup · T-boot-ask | 직전 이력 |
| X21 | `native-history.ts:7` | 고정값 | 재수출 판정 `false` | 잡음 | 잡음(9) | T-nh | 직전 이력 |
| K1 | `ConfirmDialogHost.tsx:23` | 맞바꿈 | title 슬롯 ← message | 구현자 | 잡음(2) | N-host · N-host-en | 형제 슬롯 |
| **Y1** | `ConfirmDialogHost.tsx:32` | 고정값 | `danger={request.danger}` → `danger` | 신규 | **못 잡음** | F green · 전체 red 17 = 기준선 17(차 0) | 재량 → **G3** |
| **Y2** | `Modal.tsx:115` | 고정값 | `variant={'danger'}` | 신규 | **못 잡음** | F green · 전체 red 17 = 기준선 17(차 0) | 재량 → **D6** |
| Y3 | `ConfirmDialogHost.tsx:30-31` | 맞바꿈 | 확정↔취소 라벨 | 신규 | 잡음(2) | N-host · N-host-en | 형제 슬롯 |
| Y4·Y5 | `Modal.tsx:111·117` | 맞바꿈 | 취소 버튼 → onConfirm · 확정 버튼 → onCancel | 신규 | 잡음(2·1) | N-host | 재량 |
| Y6 | `Modal.tsx:57` | 빈 값 | 배경 `onClick={undefined}` | 신규 | 잡음(1) | N-host | 재량 — 목록 밖 |
| Y7 | `claude-processes.ts:94` | 제거 | 실패 뒤 `return`(계속 닫기 제거) | 신규 | 잡음(2) | N-fail · dispatch | 재량 |
| Y8 | `:94` | 다른 값 | `failed` 2회 | 신규 | 잡음(2) | N-fail · dispatch | 재량 |
| Y9 | `chat-turn/index.ts:177` | 다른 값 | 다른 sender로 emit | 신규 | 잡음(1) | N-discard | 재량 |
| Y10 | `useNativeMcpCatalog.ts:98` | 다른 값 | 재요청 `enabled` 반전 | 신규 | 잡음(2) | `confirms before…` · N-host | 재량 |
| Y11 | `ko.ts:629` | 다른 값 | `claudeCloseConfirm` '확인' | 신규 | 잡음(1) | N-host | 재량 |
| Y12 | `ConfirmDialogHost.tsx:36` | 맞바꿈 | 본문 ← title | 신규 | 잡음(2) | N-host | 재량 — S9 범위 밖 |
| Y13·Y14·Y15 | `Modal.tsx:70·75·77` | 빈 값 | 제목 · children · footer | 신규 | 잡음(2·2·2) | N-host · N-host-en | 재량 — 목록 밖 |
| Y17 | `CatalogToggle.tsx:31` | 제거 | `await onToggle?.()` | 신규 | 잡음(4) | T-list · N-host | 재량 — 목록 밖 파일 |

- 검산: 직전 잡음 41 재실행(M 23 · G01 · S1 · X 16) → 잡음 41 · **덮개 회귀 0**. 직전 못 잡음 8 → 잡음 8. ΔV2 등록 18(M14a~M24 16 · MD1·MD2) → 잡음 18. 재량 17(K1 · Y1~Y15 · Y17) → 잡음 15 · 못 잡음 2. 합 41 + X20 1 + 18 + 17 = 77(X1·X18·X19·X25·X27·X29·X30은 등록 행과 같은 변이라 한 번 센다).
- 자기검증 분모: 보고에 없던 축 Y·K 17건 — 다른 지점(Y1·Y2 host·Modal의 D-011 운반, Y7·Y8 실패 격리 횟수, Y9 요청 창 대상), 형제 지점(Y3·Y4·Y5·Y12), 분모 재열거(② 6파일 밖 path 자리 → Y6·Y13~Y15·Y17).
- 형제 슬롯 맞바꿈: 6쌍(M17·M21·M22·K1·Y3·Y12) → 잡음 6.
- `N회` 관측 주체: 실패 보고는 `errorReportHub.publish` spy, close는 `managed().closed`·`close` spy.
- 순서 관측: N-sync의 `order` 배열(`queueMicrotask` 탐침).

## r2-5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 |
|---|---|---|---|---|---|
| VP-06 | MD-01 ↔ UT-01 | REQUIRED | PASS | T-cp 13케이스 · T-nh · M2·M10·M11·M12·X5~X9·X21 잡음 | S17·S18·S19 |
| VP-07 | MD-02 ↔ UT-02 | REQUIRED | PASS | T-sup 2건 · X15~X17 잡음 | S20 |
| VP-08 | MD-03 ↔ UT-03 | REQUIRED | PASS | T-discard · post-turn discard 케이스 · M7·X14 잡음 | S21·S22 |
| VP-04′ | AR-01′ ↔ IT-01′ | REQUIRED | PASS | T-boot-* 4 · N-fail · M8·M9·M18·M18b·X2~X4 잡음 | S12·S16·S18·S23 4/4 |
| VP-05′ | AR-02′ ↔ IT-02′ | REQUIRED | **PAIR_FAIL** | N-host·N-host-en·T-hook-*·T-list · M5·M16·M17·M20~M24·K1·X10~X12·Y3~Y6·Y10~Y15·Y17 잡음. **S10 `Modal.tsx:115` variant(Y2) 못 잡음** | S5~S9·S11 닫힘 · **S10 열림(D6)** |
| VP-03 | SD-01 ↔ ST-01 | REQUIRED | PASS | T-discard · T-boot-ask · `creates a new runtime after an idle runtime is discarded` · `adapter.fork` resume. cold resume 좌표는 linux 기준선 red, CI windows `95ffc5f5` gate success | S17·S18·S20~S22 |
| VP-R5′ | 0151 ↔ ST | REGRESSION | PASS | N-discard · T-discard · `discardSubmitted (OQ1…)` 6케이스 · M19·Y9 잡음 | S21·S22 2/2 |
| VP-01′ | R-01′ ↔ AT-01′ | REQUIRED | PASS | T-list · T-hook-idle · T-pre · T-boot-idle · N-fail · VP-03 · M1·M2·M24·Y7·Y8·Y17 잡음 | S1~S5·S7·S12~S18·S23 14/14 |
| VP-02′ | R-02′ ↔ AT-02′ | REQUIRED | **BLOCKED_BY:VP-05′** | T-boot-ask · N-host · N-host-en · N-sync · N-false · T-pre · M3~M6·M14·M15·M23 잡음. AC2′ "[변경](기본 버튼)"은 VP-05′ S10과 같은 렌더 경로라 독립 관측 불가 | S1~S9·S11·S14 닫힘 · S10은 VP-05′ 근 |
| VP-R1 | R-03 ↔ AT-03 | REGRESSION | PASS | T-boot-oc · 0282 `restores global choices…` · M13 잡음 | S14·S15 |
| VP-R2 | 0282 R-03 | REGRESSION | PASS | 0282 3좌표 green · M4가 0282 bootstrap 3건 red | 0282 EP-02 |
| VP-R3 | 0282 AR-08 | REGRESSION | PASS | 0282 `restores global choices through production Bootstrap…` green | 0282 EP-11 |
| VP-R4 | 0282 R-06 | REGRESSION | PASS | EP-10′ 0 · view 고정 행 green · G01 잡음 | EP-10′ 29 |

- root `PAIR_FAIL`: VP-05′(D6). 종속: VP-02′ → VP-05′. root PLAN_GAP: G3(같은 D-011 운반, S9 범위 밖 `:32`).
- 이번 라운드 실행 범위: 재검증 — 대체 pair 5(VP-01′·02′·04′·05′·R5′) + 영향 pair VP-03 + 이전 PASS 7은 좌표 실재·green을 이번 실행 JSON에서 확인(26좌표, win32 1건 제외 전부 passed).
- 좌표의 실행 구간: N-host·N-host-en은 `ExtensionsCatalogView`+`ConfirmDialogHost`를 실제 렌더하고 `sessionApi`(IPC)만 mock한다 — S4(ipc.ts)는 T-pre가 닫는다. 실제 i18n으로 ko N=2·en N=1/2를 구별 입력한다. D-011 운반 값(`danger`)은 store에서만 관측해 host `:32`·Modal `:115`는 관측 구간 밖이다.

### AT / AC 세부와 합계

| AC | 결과 | 검증 증거 |
|---|---|---|
| AC1 | ✅ | T-boot-idle close `[1,1,0]` · `applied` · 저장값 |
| AC2′ | ✅(동작) · D-011 렌더 잠금 없음(G3·D6) | T-boot-ask `sessions: 2` · N-host 제목·"2개"·[변경]/[취소] · N-host-en 단수/복수 · store `danger` undefined |
| AC3′ | ✅ | N-host [취소] write 1 · 배경 write 2 · 스위치 on 유지 |
| AC4′ | ✅ | N-host 4번째 write `confirmed: true` · 스위치 off · N-false reject · N-sync `[plan,save,close,intruder]` · T-boot-ask abort·복원 |
| AC5 | ✅ | T-cp 신호 단독 11행 · M10a~h·M11·M12 잡음 |
| AC6 | ✅ | supervisor 새 factory · CI windows run `40099424951` @`95ffc5f5` success(cold resume 좌표는 win32 전용) |
| AC7 | ✅ | T-boot-oc close 0 |
| AC8 | ✅ | T-boot-save reject · close 0 |
| AC9 | ⚠️ | 사람 실기(Windows) 대기 |
| AC10 | ✅ | N-fail 첫 close throw · 둘째 closed 1 · publish 1회 `claudeSessionsCloseFailed` · Y7·Y8 잡음 |

- 합계 재측정: ✅ 9 · ⚠️ 1 · ❌ 0 = 총 10. 자기보고 ✅9·⚠️1 일치.
- 합계 사본 대조: 본문 ✅9 ↔ trailer `Criteria-Met: 9/10` ↔ INDEX `AC 9/10` 일치.

### pair별 plan §10 강제 지점 분모 (EP-01′ 23)

| 자리 | 확인 · oracle 좌표 | 결과 |
|---|---|---|
| S1 `protocol.ts:765-768` | T-boot-ask(S1 잡음) · N-false(M15) | 닫힘 |
| S2~S4 | T-pre · T-boot-ask `toEqual(confirm)` | 닫힘 |
| S5 `useNativeMcpCatalog.ts:82-104` | T-hook-* · N-host(M5a·M5b·X10~X12·Y10) | 닫힘 |
| S6 · S7 | N-host(M23) · T-list(M24) | 닫힘 |
| S8 `confirmDialogStore.ts:22-31` | N-host(store request 관측) | 닫힘 |
| S9 `ConfirmDialogHost.tsx:9-31` | N-host(M20·M21·M22·K1·Y3) | 닫힘. 범위 밖 `:32`(Y1)은 G3 |
| S10 `Modal.tsx:107-121` | N-host(Y4·Y5) | **열림 — `:115` variant(Y2) 못 잡음(D6)** |
| S11 ko·en | T-res · N-host · N-host-en(M16·M17·X20·Y11) | 닫힘 |
| S12~S15 | T-ec·T-boot-* · N-false · N-sync(M14a·M14b) · T-boot-oc | 닫힘 |
| S16~S18 | T-boot-* · N-fail(M18·M18b·X2~X4) · T-cp(X5~X9·Y7·Y8) | 닫힘 |
| S19~S22 | T-cp · T-nh · T-sup · T-discard · N-discard(M19·Y9) | 닫힘 |
| S23 | N-fail · N-titles | 닫힘 |

- 재계수: 닫힘 22 · 열림 1(S10) = 23. 구현 보고 23/23과 다른 1자리는 운반 항 `variant`가 S10 항 목록에 없던 자리다.
- 목록 밖 발견: host `:32`(Y1 못 잡음 → G3). host `:36`·`Modal.tsx:57·70·75·77`·`CatalogToggle.tsx:31`은 잡음 — 목록 정정 대상(G3).

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| lint | PASS | 0 error · 2 warning(`react-hooks/incompatible-library`, 변경 밖) · 실행 후 `git status` 0 |
| typecheck | PASS | 3구성 · `error TS` 0 |
| 관련 vitest | PASS | §19 목록 + `pending-message-queue.test.ts` = 134파일 1,516케이스: 1,505 pass · 3 skip · 8 fail(전부 `adapters/claude` win32 전용, r1 기준선 동일). 신규 7건 전부 passed |
| 전체 vitest(linux) | 환경 한계 | `95ffc5f5` 830파일 8,002케이스 중 17 red. `7fdc497a` 830파일 7,995케이스 중 18 red ⊇ head 17(차 head−base 0, base−head 1 = `loopback-callback.test.ts` 타이밍, 변경 무관) |
| CI `gate`(windows) | PASS | run `40099424951` job `120888322692` @`95ffc5f5` conclusion success · scripts 142/142. vitest 요약 줄은 로그 tail 밖이라 수치 미수집 |
| doc-inventory | PASS | generated·prose·links ok |
| G-DOC · EP-10′ | PASS | `[0,1,1,1,1]` · 0줄 |
| trailer | PASS | `95ffc5f5` 6키 파싱 · `7fdc497a` 3키 + attribution 2 |

## r2-8. 사람 실기

| 항목 | 기계 검증 범위 | 남은 사람 실기 |
|---|---|---|
| AC9 | 판정·열거·순서·문구·N·버튼 배선·실패 보고 | Windows 실제 CLI `/context` superpowers 부재, 대화상자 white/dark |
| D-011 렌더 | 없음(G3·D6) | 사람 몫이 아니다 — 렌더 버튼 variant는 fake DOM에서 `className`(`bg-ink`/`bg-rust`, `Button.tsx:69-73·122`)으로 관측 가능 |

## r2-9. 게이트 재실행 메모

- 명령: `npm run typecheck` · `npm run lint` · `./node_modules/.bin/vitest run <§19 목록>` · 전체 `vitest run`(검증용 worktree 2개) · `node scripts/check-doc-inventory.mjs --check` · ④ · EP-10′.
- `npm test` 미사용. better-sqlite3가 Node ABI로 로드돼 DB 스위트까지 실행됐다.
- 게이트의 트리 변경: 없음. 잔여물: 검증용 worktree 2개와 `node_modules` 심링크 — 제거 완료(`git worktree list` 1행).

## r2-11. Repository operation checks

- AGENTS.md 변경: 없음.
- INDEX: `impl/IMPL_DONE`·다음 주체 Claude 일치. 자리표시자 2개 → ΔV2 `7fdc497a` · r2 `95ffc5f5`(`git cat-file -t` commit). 구현자 비고 4줄.
- trailer: `Agent: codex` 허용값 · 6키 파싱.
- `[구현자 기입]` r2 7필드 7/7. 강제 지점 표는 S1~S23 전부 · EP-10′ · G-DOC와 `남긴 곳` 열을 담는다.
- 인용 해시: `28d25d35`·`d69b4c54`·`09bbff48`·`7fdc497a`·`95ffc5f5` commit.

## r2-12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 판단 |
|---|---|
| Zustand binding 대체 | 타당 — 실행 환경 대체. store·host·Modal은 production 코드 |
| host 슬롯 구별 단언(K1) | 타당 — 제목 span·본문 p를 따로 본다 |
| P0 residual-only 동치 | 타당 — r2-2 근거 |
| 로컬 doc gate의 임시 외부 저장소 링크 | 이 환경에서는 재현 없음 — inventory ok |
| 강제 지점 23/23 | S10 `variant` 항 미관측으로 22/23 |

## r2-13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| G3 | D-011 렌더 운반이 EP-01′ 목록·oracle 밖 — ② 술어에 `danger`가 없어 host `:32`가 S9(`:9-31`) 밖이고, AC2′ oracle은 store `danger`에서 멈춘다. 같은 술어가 host `:36`·`Modal.tsx:57·70·75·77`·`CatalogToggle.tsx:31`도 놓쳤다(이들은 잡음) | §10 EP-01′ · AC2′ · VP-05′·VP-02′ | PLAN_GAP | 설계자: ② 술어·범위에 D-011 운반과 위 path 자리를 넣어 목록을 다시 고정하고, AC2′ oracle을 렌더 확정 버튼 variant로 내린다. Y1·Y2 등록 |
| D6 | S10 `Modal.tsx:115` `variant={'danger'}`(Y2)가 전체 스위트 green | VP-05′ · S10 · D-011 | BLOCKING(PAIR_FAIL) | 구현: 렌더된 확정 버튼 variant를 관측하는 좌표. G3과 같은 단언 하나가 Y1도 잡는다 |
| N3 | `confirm` 응답이 `mounted`·version을 보지 않는다(`useNativeMcpCatalog.ts:92`) | 비귀속 | NON_BLOCKING | r1 그대로 |
| N4 | DB 행 없는 유휴 runtime은 닫지 않는다 | 비귀속 | NON_BLOCKING | r1 그대로 |

- r1 이슈 상태: G1·G2·D1~D5 닫힘(위 고장 이력의 인용 변이 전부 잡음). N1·N2는 D-010·D-011로 닫힘.

## r2-14. Review Signals — 사실만

- 이전 라운드와 유사 증상: r1 G2(host `:16·28` 목록 밖)와 같은 파일군에서 술어가 다시 운반 자리를 놓쳤다(host `:32`·`Modal.tsx:115`).
- 관련 plan 지침: D-011은 ΔV2에서 추가됐고 AC2′ 검증 수단이 "store request `danger` 미지정"으로 적혔다. ② 술어는 `confirmLabel|cancelLabel` 슬롯은 담고 형제 prop `danger`는 담지 않았다.
- 사용자 결정 변경 근거: 없음(D-010·D-011은 ΔV2 사용자 답변).
- 반복 환경 한계: linux에서 Windows 전용·`C:/` 경로 스위트 17 red. AC6 cold resume은 CI windows로만 닫힌다.

## r2-15. 결론

- 상태: **RETURN_TO_PLAN** — PLAN_GAP G3과 PAIR_FAIL D6(VP-05′)이 함께 있다.
- verify 횟수: 2회째.
- pair 결과: PASS 11 · PAIR_FAIL 1(VP-05′) · BLOCKED_BY 1(VP-02′ → VP-05′) = 13.
- Product/UX·ACTIVE Decision: 동작은 전부 충족. D-011 렌더의 잠금이 비었다.
- AC: ✅ 9 · ⚠️ 1(AC9) · ❌ 0.
- 운영 gate: PASS(linux 17 red 기준선 동일, CI windows success).
- 고장 이력: 77 = 잡음 75 · 못 잡음 2(Y1·Y2) · 동치 0. 덮개 회귀 0.
- NON_BLOCKING: N3·N4.
- 남은 사람 확인: AC9.
- 다음 단계: 설계자가 G3을 ΔV3으로 정정해 `plan/READY` → 구현자가 Y1·Y2를 잡는 렌더 variant 좌표를 만든다.

# r3 — 2026-10-25

r1·r2 판정과 근거는 위 본문에 그대로 둔다. 이 절은 r3만 판정한다.

## r3 메타

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `9762306c..bfee5bf6` (r3 `bfee5bf6`) |
| 구현 전 plan 기준 | `9762306c` (ΔV3) |
| V mode / 유효 V | `Delta V` / `0282@28d25d35 + 0283 ΔV1@d69b4c54 + ΔV2@7fdc497a + ΔV3@9762306c` |
| 검증 기준 plan revision | `9762306c:ΔV3` |
| 라운드 | 3 |
| 상태 | **PASS (기계 범위)** — pair 14 PASS · PLAN_GAP 0 · 고장 91건 전부 잡음. AC9 사람 실기만 남는다 |
| 자기 검증 여부 | 구현자 = Codex(trailer `Agent: codex`). ΔV3 설계자 = 검증자(Claude)라 plan validity는 자기 설계 감사다 → 보고에 없던 축 8건(§r3-4 Z1~Z8) |

## r3-0. 기준선 / plan validity

- 기준선이 diff로 성립한다: 설계 `9762306c`와 구현 `bfee5bf6`이 분리돼 있다.
- 구현 커밋의 `plan.md` 변경은 메타 상태 1줄(`:11`)과 `[구현자 기입]` r3 추가(`:1070` 이후)뿐이다 — `git diff 9762306c..bfee5bf6 -- plan.md` hunk 2개.
- Decision Ledger · Product/UX · AC · V node/pair · §10 변경 0건. 채점 기준은 `9762306c` 시점 plan 원문이다.
- production 변경 0: `git diff --stat 07caaeda..bfee5bf6 -- app/` = 테스트 2파일(+42줄)뿐이다.

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V 적용 순서·상속 기준 | 유효 | 인용 커밋 9개 `git cat-file -t` = commit. ΔV3가 VP-02′·05′를 ″로 대체, VP-R6 추가 |
| CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R-02″ → VP-02″ · AR-02″ → VP-05″. INHERITED R-ET → VP-R6 REGRESSION |
| `SUPERSEDED` 이관 | 유효 | VP-02′ 변이 M3~M6·M14·M15·M23 → VP-02″, VP-05′ 변이 M5·M16·M17·M20~M24 → VP-05″(`plan.md:648-651`) |
| §10 EP-01″ — 검색 재실행 차집합 | 유효 | ① 62줄 = 자리 46 + 제외 16 · ②″ 86줄 = 자리 39 + 제외 47 · ③ 6줄. 미분류 0 · 안 쓰인 제외 0(분류 스크립트, `bfee5bf6`) |
| §10 EP-01″ — 술어·범위가 path를 덮는가 | 유효 | ②″ 범위 = VP-05″ path 9파일 전체. 술어에 `danger`·`squishClass`·`ConfirmDialogHost` 포함. 술어 밖 path 줄 Button `:113` `disabled`는 Z8로 잡음 |
| G-DOC ④ | 유효 | `[0,1,1,1,1]` · MD1 → `[1,1,1,1,0]` · MD2 → `[0,0,1,1,1]` |
| EP-10′ | 유효 | 음성 술어 0줄 · `nativeFileMutations` 0줄 · G01 → 1 |
| 운영 gate·범위 | 유효 | lint·typecheck·관련 vitest(ΔV3-6 + VP-R6)·doc-inventory·G-DOC·EP-10′·CI·trailer |

- r2 PLAN_GAP: **G3 닫힘** — host `:32`가 U6, Modal `:115`가 U8, 렌더 변이 M25·M26 등록, 좌표 N-variant가 둘 다 잡음.
- path 시작점: VP-05″ path는 `OverlayLayer`에서 시작한다. 그 위 셸 사슬(`RootGate` → `AppLayout.tsx:59` → `OverlayLayer`)은 모든 오버레이가 공유하는 조립이라 이번 V 밖으로 보고 변이를 심지 않았다.
- 새 root PLAN_GAP: 없음.

## r3-1. Product & UX / ACTIVE Decision

| Decision | 판정 | 실제 production path |
|---|---|---|
| D-001~D-010 | 충족 — r2와 같은 경로. r3 production diff 0 | 위 r2-1 표 그대로 |
| D-011 [변경] 기본 버튼 | 충족 · **렌더 잠김** | hook `:93-99`(`danger` 없음) → store `:24` → host `:32` → `Modal.tsx:115` `'primary'` → `Button.tsx:71` `bg-ink`. N-variant가 관측(M25·M26·M27·M35·M36·Z5~Z7 잡음) |
| AC2″ 셸 1회 마운트 | 충족 · 잠김 | `OverlayLayer.tsx:69` → N-mount(M28·Z1·Z2 잡음) |

## r3-2. 구현 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 새 좌표가 production 경로에 진입하는가 | ✅ | N-variant는 실제 view·host·Modal·Button을 렌더하고 `sessionApi`만 mock한다. N-mount는 production `OverlayLayer` 반환 트리를 본다(features 하위 컴포넌트만 mock, host 타입은 실물) |
| 로컬 재구현 여부 | 없음 | 두 helper는 DOM·요소 트리 탐색만 한다. 판정 대상은 production 컴포넌트 출력이다 |
| 구별 값 | ✅ | [변경] `bg-ink` ↔ [취소] `bg-fill-contained`(형제 대조) · `searchOpen` false/true. `danger` 부재 입력이 곧 기본값 폴백의 구별 값이다 |
| 토큰 비교 | ✅ | className을 공백으로 나눠 비교해 `bg-ink`가 다른 토큰의 접두로 오탐되지 않는다 |
| 게이트의 트리 변경 | 없음 | lint(`--fix`) 뒤 `git status` 0 |

## r3-3. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh 9762306c..bfee5bf6` → "변경된 소스 파일이 없습니다"(테스트만 변경).

| 후보 | 판정 | 근거 |
|---|---|---|
| 테스트 전용 신규 심볼 | 정상 | `countConfirmationHosts`·`dialogButtonBackground`는 테스트 helper. production export 변경 0 |
| ②″ 술어 밖 path 줄 | 잡음 | Button `:113` `disabled={isDisabled}`(Z8) → N-host red |
| path 상류 셸 사슬 | 범위 밖 | r3-0 path 시작점 참조 |

## r3-4. 고장 이력 (r3)

- 하네스: 파일 줄 단위 치환(대상 줄에 원문 1회 확인) → 관련 vitest 집합(136파일 1,521케이스, 기준선 실패 8건과 테스트 ID로 차집합) → 원본 바이트 복원(sha256 일치) → `git status` 0 확인. gate 변이 3건은 해당 검색 명령으로 판정.
- 매 실행 136파일·1,521케이스 전부 실행됨(91회 중 vitest 88회 동일 값).
- 시도 91 = 잡음 91 · 못 잡음 0 · 동치 0.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 직전 결과 | 이번 결과(새 실패 수) | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|---|
| **Y1 = M25** | `ConfirmDialogHost.tsx:32` | 고정값 | `danger={request.danger}` → `danger` | **못 잡음** | **잡음(1)** | N-variant | G3·VP-05″ 등록 |
| **Y2 = M26** | `Modal.tsx:115` | 고정값 | `variant={'danger'}` | **못 잡음** | **잡음(1)** | N-variant | D6·VP-05″ 등록 |
| M27 | `Button.tsx:71·73` | 맞바꿈 | primary↔danger 배경 class | 신규 | 잡음(1) | N-variant | VP-05″ 등록 |
| M28 | `OverlayLayer.tsx:69` | 제거 | `<ConfirmDialogHost />` | 신규 | 잡음(1) | N-mount | VP-05″ 등록 |
| Y17 = M29 | `CatalogToggle.tsx:31` | 제거 | `await onToggle?.()` | 잡음 | 잡음(5) | N-host · N-variant · N-host-en · T-list 외 | VP-05″ 등록 |
| Y6 = M30 | `Modal.tsx:57` | 빈 값 | 배경 `onClick={undefined}` | 잡음 | 잡음(1) | N-host | VP-05″ 등록 |
| Y13·Y14·Y15 = M31a~c | `Modal.tsx:70·75·77` | 빈 값 | 제목 · children · footer → `null` | 잡음 | 잡음(2·2·3) | N-host · N-host-en · N-variant(footer) | VP-05″ 등록 |
| Y12 = M32 | `ConfirmDialogHost.tsx:36` | 맞바꿈 | 본문 ← title | 잡음 | 잡음(2) | N-host · N-host-en | VP-05″ 등록 |
| M33 | `Button.tsx:118` | 제거 | `{...rest}` | 신규 | 잡음(3) | N-host · ProviderDetail 2 | VP-05″ 등록 |
| M34 | `Button.tsx:128` | 빈 값 | `{children}` → `null` | 신규 | 잡음(5) | N-host · N-variant · N-host-en 외 | VP-05″ 등록 |
| M35 | `useNativeMcpCatalog.ts:97` | 다른 값 | 요청에 `danger: true` | 신규 | 잡음(3) | N-host(store) · N-variant · N-host-en | VP-05″ 등록 |
| M36 | `confirmDialogStore.ts:24` | 다른 값 | `{ ...req, danger: true }` 저장 | 신규 | 잡음(3) | N-host(store) · N-variant · N-host-en | VP-05″ 등록 |
| M1 | `extension-catalog.ts:61` | 제거 | 종료 호출 | 잡음 | 잡음(5) | T-boot-ask · T-boot-idle 외 | VP-01′ |
| M2a·M2b | `claude-processes.ts:44·53` | 맞바꿈 | `'claude'`→`'opencode'` | 잡음 | 잡음(4·15) | T-boot-ask · dispatch · T-boot-idle | VP-01′ |
| M3 | `extension-catalog.ts:57` | 제거 | `&& !request.confirmed` | 잡음 | 잡음(3) | T-boot-ask · T-boot-save | VP-02″ |
| M4 | `:57` | 다른 값 | `busy >= 0` | 잡음 | 잡음(7) | T-boot-idle · N-fail · 0282 bootstrap | VP-02″ |
| M5a·M5b | `useNativeMcpCatalog.ts:88·98` | 제거 | `confirmed` spread · onConfirm `true` | 잡음 | 잡음(2·2) | N-host · T-hook-confirm | VP-05″ |
| M6 | `extension-catalog.ts:58` | 다른 값 | `sessions: plan.targets.length` | 잡음 | 잡음(1) | T-boot-ask | VP-02″ |
| M7 | `discard.ts:37` | 제거 | 복원 emit | 잡음 | 잡음(3) | T-boot-ask · T-discard | VP-03 |
| M8 | `bootstrap.ts:1241` | 고정값 | activity 유휴 snapshot | 잡음 | 잡음(1) | T-boot-ask | VP-04′ |
| M9 | `extension-catalog.ts:60·61` | 뒤집기 | 종료 → 저장 | 잡음 | 잡음(2) | T-boot-save · N-sync | VP-04′ |
| M10a~h | `session-activity-busy.ts:7-14` | 제거 | 8신호 각각 `false` | 잡음 8/8 | 잡음 8/8(4·2·2·2·2·2·2·2) | `counts <신호> alone…` · T-nh | VP-06 |
| M11a·M11b | `claude-processes.ts:48·49` | 다른 값 | lease `busy: false` | 잡음 | 잡음(3·2) | T-boot-ask · 복합 · dispatch | VP-06 |
| M12 | `:57` | 제거 | `responding` | 잡음 | 잡음(2) | `counts responding alone…` · dispatch | VP-06 |
| M13 | `extension-catalog.ts:53` | 고정값 | Claude 분기 `true` | 잡음 | 잡음(1) | T-boot-oc | VP-R1 |
| S1 | `protocol.ts:767` | 빈 값 | `.transform(() => undefined)` | 잡음 | 잡음(3) | T-boot-ask · T-boot-save | VP-02″ |
| M14a·M14b | `extension-catalog.ts:56·60` 뒤 | 뒤집기 | `await Promise.resolve()` | 잡음 | 잡음(1·1) | N-sync | VP-02″ |
| M15 | `protocol.ts:767` | 다른 값 | `z.boolean()` | 잡음 | 잡음(1) | N-false | VP-02″ |
| M16 ko1·ko2·en1·en2 | `ko.ts:626·628` · `en.ts:622·624` | 제거 | `{{count}}` 자리별 | 잡음 | 잡음(1·2·2·2) | T-res · N-host · N-host-en | VP-05″ |
| X20 | 같은 4곳 동시 | 제거 | `{{count}}` 4곳 | 잡음 | 잡음(2) | N-host · N-host-en | VP-05″ |
| M17 | `en.ts:622·624` | 맞바꿈 | `_one`↔`_other` 문장 | 잡음 | 잡음(1) | N-host-en | VP-05″ |
| M18·M18b | `bootstrap.ts:1249·1253` | 빈 값·다른 값 | `failed` no-op · 제목 `saveFailed` | 잡음 | 잡음(1·1) | N-fail | VP-04′ |
| M19 | `chat-turn/index.ts:177` | 빈 값 | 요청 창 emit → `void e` | 잡음 | 잡음(1) | N-discard | VP-R5′ |
| M20·M21·M22 | `ConfirmDialogHost.tsx:16·28·24` | 제거·맞바꿈·맞바꿈 | onConfirm · 취소→확정 · 배경→확정 | 잡음 | 잡음(1·2·1) | N-host · N-host-en | VP-05″ |
| M23·M24 | `ExtensionsCatalogView.tsx:164` · `CustomizeList.tsx:116` | 호출 대체·다른 값 | `confirmed: true` 선전달 | 잡음 | 잡음(2·3) | N-host · T-list · OpenCode 고정 행 | VP-05″·VP-01′ |
| MD1·MD2 | `adapters.md:69` · `IPC_CONTRACT.md:193` | 다른 값·제거 | 옛 문장 복원 · 결과 타입 이름 | 잡음 | 잡음(`[1,1,1,1,0]` · `[0,0,1,1,1]`) | `gate:` ④ | G-DOC |
| G01 | `opencode/v1/global-plugins.ts:1` | 제거의 역 | `nativeFileMutations` import | 잡음 | 잡음(0→1→0) | `gate:` EP-10′ | VP-R4 |
| X2·X3·X4 | `bootstrap.ts:1240·1247·1243` | 고정값·빈 값·호출 대체 | backendOf `'claude'` · 방송 no-op · `discardRuntime` | 잡음 | 잡음(2·1·1) | T-boot-ask · T-boot-idle | VP-04′ |
| X5~X9 | `claude-processes.ts:91·41·39·60·94` | 뒤집기·제거·제거·다른 값·호출 대체 | dispatch · closing · `seen` · `busy: targets.length` · `throw` | 잡음 | 잡음(4·1·3·5·2) | T-boot-* · 복합 · dispatch · N-fail | VP-06·VP-04′ |
| X10·X11·X12 | `useNativeMcpCatalog.ts:94-97` | 맞바꿈·맞바꿈·고정값 | title↔message · 라벨 · `count: 1` | 잡음 | 잡음(3·4·3) | N-host · N-host-en · N-variant(X11) · T-hook-confirm | VP-05″ |
| X14 | `discard.ts:31·32` | 뒤집기 | abort ↔ discardRuntime | 잡음 | 잡음(1) | T-discard | VP-08 |
| X15·X16·X17 | `supervisor.ts:305·303·293` | 제거 | emitLease · child abort · lease 분기 | 잡음 | 잡음(1·2·2) | T-sup · T-boot-ask | VP-07 |
| X21 | `native-history.ts:7` | 고정값 | 재수출 판정 `false` | 잡음 | 잡음(9) | T-nh 9 | VP-06 |
| K1 | `ConfirmDialogHost.tsx:23` | 맞바꿈 | title ← message | 잡음 | 잡음(2) | N-host · N-host-en | VP-05″ |
| Y3 | `ConfirmDialogHost.tsx:30·31` | 맞바꿈 | 확정↔취소 라벨 | 잡음 | 잡음(3) | N-host · N-host-en · N-variant | VP-05″ |
| Y4·Y5 | `Modal.tsx:111·117` | 맞바꿈 | 취소→onConfirm · 확정→onCancel | 잡음 | 잡음(2·1) | N-host | VP-05″ |
| Y7·Y8 | `claude-processes.ts:94` | 제거·다른 값 | 실패 뒤 `return` · `failed` 2회 | 잡음 | 잡음(2·2) | N-fail · dispatch | VP-04′·VP-06 |
| Y9 | `chat-turn/index.ts:177` | 다른 값 | 다른 sender | 잡음 | 잡음(1) | N-discard | VP-R5′ |
| Y10 | `useNativeMcpCatalog.ts:98` | 다른 값 | 재요청 `enabled` 반전 | 잡음 | 잡음(2) | N-host · T-hook-confirm | VP-05″ |
| Y11 | `ko.ts:629` | 다른 값 | `claudeCloseConfirm` '확인' | 잡음 | 잡음(2) | N-host · N-variant | VP-05″ |
| Z1 | `OverlayLayer.tsx:69` | 다른 값 | host 2회 마운트 | 신규 | 잡음(1) | N-mount | 독립 — U10 |
| Z2 | `OverlayLayer.tsx:69` | 다른 값 | `{modalActive && <ConfirmDialogHost />}` | 신규 | 잡음(1) | N-mount | 독립 — U10 |
| Z3 | `Modal.tsx:118` | 고정값 | 확정 `disabled` | 신규 | 잡음(1) | N-host | 독립 — U8 |
| Z4 | `Modal.tsx:111` | 고정값 | 취소 `disabled` | 신규 | 잡음(1) | N-host | 독립 — U8 |
| Z5 | `Button.tsx:122` | 고정값 | `squishClass('primary', …)` | 신규 | 잡음(1) | N-variant([취소] 대조) | 독립 — U9 형제 |
| Z6 | `Modal.tsx:115` | 뒤집기 | `danger ? 'primary' : 'danger'` | 신규 | 잡음(1) | N-variant | 독립 — U8 |
| Z7 | `ConfirmDialogHost.tsx:32` | 뒤집기 | `danger={!request.danger}` | 신규 | 잡음(1) | N-variant | 독립 — U6 |
| Z8 | `Button.tsx:113` | 고정값 | `disabled` 항상 true | 신규 | 잡음(1) | N-host | 독립 — 목록 밖 |

- 검산: r2 이력 77(잡음 75 · 못 잡음 2) 재실행 → 잡음 77. **덮개 회귀 0**(r2 잡음 75 전부 잡음). ΔV3 등록 14자리 중 새 변이 6(M27·M28·M33~M36) → 잡음 6, 나머지 8(M25·M26·M29~M32)은 r2 Y행과 같은 변이라 한 번 센다. 독립 8 → 잡음 8. 합 77 + 6 + 8 = 91.
- 구현 보고 83행과 대조: 보고 ID 집합 = 이번 표의 Z 제외 83 ID. 결과 83/83 일치(전부 잡음).
- 자기검증 분모: 보고에 없던 축 Z 8건 — 다른 지점(Z3·Z4 버튼 비활성, Z6·Z7 운반 뒤집기), 형제 지점(Z5 [취소] 배경), N-mount 민감도(Z1 중복·Z2 조건부), 분모 재열거(Z8 ②″ 술어 밖 path 줄).
- 형제 슬롯 맞바꿈: 8쌍(M17·M21·M22·K1·Y3·Y12·M27·Z5) → 잡음 8.

## r3-5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 |
|---|---|---|---|---|---|
| VP-06 | MD-01 ↔ UT-01 | REQUIRED | PASS | T-cp 13 · T-nh 9 · M2·M10·M11·M12·X5~X9·X21·Y8 잡음 | S17·S18·S19 |
| VP-07 | MD-02 ↔ UT-02 | REQUIRED | PASS | T-sup 3 · X15~X17 잡음 | S20 |
| VP-08 | MD-03 ↔ UT-03 | REQUIRED | PASS | T-discard · post-turn `discard closes the active response exactly once` · M7·X14 잡음 | S21·S22 |
| VP-04′ | AR-01′ ↔ IT-01′ | REQUIRED | PASS | T-boot-* 4 · N-fail · M8·M9·M18·M18b·X2~X4·Y7 잡음 | S12·S16·S18·S23 4/4 |
| VP-05″ | AR-02″ ↔ IT-02″ | REQUIRED | PASS | N-host · N-host-en · N-variant · N-mount · T-hook-confirm/oc · T-list · 위 표 VP-05″ 귀속 변이 전부 잡음 | U1~U10·S11 11/11 |
| VP-03 | SD-01 ↔ ST-01 | REQUIRED | PASS | T-discard · T-boot-ask · `creates a new runtime after an idle runtime is discarded` · `adapter.fork` resume. cold resume 좌표는 linux 기준선 red(win32 전용), CI windows `bfee5bf6` gate success | S17·S18·S20~S22 |
| VP-R5′ | 0151 ↔ ST | REGRESSION | PASS | N-discard · T-discard · `discardSubmitted (OQ1…)` 6케이스 · M19·Y9 잡음 | S21·S22 2/2 |
| VP-R6 | R-ET ↔ AT-ET | REGRESSION | PASS | N-fail(publish 제목) · N-titles · `ErrorToastHost.render` main 출처 `loadFailed` → "정보를 불러오지 못했습니다" 관측 · M18b 잡음 | 0 — 제목 무관 템플릿 |
| VP-01′ | R-01′ ↔ AT-01′ | REQUIRED | PASS | T-list · T-hook-idle · T-pre · T-boot-idle · N-fail · VP-03 · M1·M2·M24·Y7·Y17 잡음 | S1~S4·U2~U4·S12~S18·S23 15/15 |
| VP-02″ | R-02″ ↔ AT-02″ | REQUIRED | PASS | T-boot-ask · N-host · N-host-en · N-variant · N-mount · N-sync · N-false · T-pre · M3~M6·M14·M15·M23·M25·M26·M28 잡음 | S1~S4·U1~U10·S11·S14 16/16 |
| VP-R1 | R-03 ↔ AT-03 | REGRESSION | PASS | T-boot-oc · 0282 `restores global choices…` · M13 잡음 | S14·S15 |
| VP-R2 | 0282 R-03 | REGRESSION | PASS | 0282 3좌표 green(`applies current global plugin choices…` 포함) · M4가 0282 bootstrap red | 0282 EP-02 |
| VP-R3 | 0282 AR-08 | REGRESSION | PASS | 0282 `restores global choices through production Bootstrap…` green | 0282 EP-11 |
| VP-R4 | 0282 R-06 | REGRESSION | PASS | EP-10′ 0 · view 고정 행 green · G01 잡음 | EP-10′ 29 |

- root `PAIR_FAIL`: 없음. r2 root VP-05′(D6) → VP-05″ PASS, 종속 VP-02′ → VP-02″ PASS.
- 이번 라운드 실행 범위: 대체 pair 2(VP-02″·05″) + 신규 VP-R6 + 나머지 11 pair는 좌표 실재·green을 이번 실행 JSON에서 재확인(34좌표, win32 cold resume 1건 제외 전부 passed)하고 등록 변이를 전부 재실행했다.
- 좌표의 실행 구간: N-variant는 `ExtensionsCatalogView`+`ConfirmDialogHost`를 실제 렌더해 U1~U9를 지나고 `sessionApi`만 mock한다. U10은 N-mount가 production `OverlayLayer` 반환 트리로 닫는다. 두 좌표의 이음매(`<ConfirmDialogHost />` props 없음)에는 운반 값이 없다.

### AT / AC 세부와 합계

| AC | 결과 | 검증 증거 |
|---|---|---|
| AC1 | ✅ | T-boot-idle close `[1,1,0]` · `applied` · 저장값 |
| AC2″ | ✅ | T-boot-ask `sessions: 2` · N-host 제목·"2개"·[변경]/[취소] · N-host-en 단수/복수 · N-variant [변경] `bg-ink`·`bg-rust` 없음·[취소] `bg-fill-contained` · N-mount 1 |
| AC3′ | ✅ | N-host [취소] write 1·대화상자 닫힘 · 배경 write 2 · 스위치 on 유지(Z4 잡음) |
| AC4′ | ✅ | N-host 4번째 write `confirmed: true` · 스위치 off · N-false reject · N-sync `[plan,save,close,intruder]` · T-boot-ask abort·복원 |
| AC5 | ✅ | T-cp 신호 단독 11행 · M10a~h·M11·M12 잡음 |
| AC6 | ✅ | supervisor 새 factory · CI windows run `40150923750` @`bfee5bf6` success(cold resume 좌표는 win32 전용) |
| AC7 | ✅ | T-boot-oc close 0 |
| AC8 | ✅ | T-boot-save reject · close 0 |
| AC9 | ⚠️ | 사람 실기(Windows) 대기 |
| AC10 | ✅ | N-fail 첫 close throw · 둘째 closed 1 · publish 1회 `claudeSessionsCloseFailed` · Y7·Y8 잡음 |

- 합계 재측정: ✅ 9 · ⚠️ 1 · ❌ 0 = 총 10. 자기보고 ✅9·⚠️1 일치.
- 합계 사본 대조: 본문 ✅9 ↔ trailer `Criteria-Met: 9/10` ↔ INDEX `AC 9/10` 일치.

### pair별 plan §10 강제 지점 분모 (EP-01″ 27)

| 자리 | 확인 · oracle 좌표(변이) | 결과 |
|---|---|---|
| S1 | T-boot-ask(S1) · N-false(M15) | 닫힘 |
| S2~S4 | T-pre · T-boot-ask `toEqual(confirm)` | 닫힘 |
| U1 · U2 · U3 | N-host(M23) · T-list(M24) · T-list·N-host(M29) | 닫힘 |
| U4 `useNativeMcpCatalog.ts:82-104` | T-hook-* · N-host · N-variant(M5a·M5b·X10~X12·Y10·M35) | 닫힘 |
| U5 `confirmDialogStore.ts:22-31` | N-host · N-variant(M36) | 닫힘 |
| U6 `ConfirmDialogHost.tsx:8-39` | N-host · N-host-en · N-variant(M20~M22·K1·Y3·M32·M25·Z7) | 닫힘 |
| U7 `Modal.tsx:54-78` | N-host · N-host-en(M30·M31a~c) | 닫힘 |
| U8 `Modal.tsx:107-121` | N-host · N-variant(Y4·Y5·M26·Z3·Z4·Z6) | 닫힘 — r2 열림(D6) |
| U9 `Button.tsx:64-82·100·118·122·128` | N-host · N-variant(M27·M33·M34·Z5) | 닫힘 |
| U10 `OverlayLayer.tsx:69` | N-mount(M28·Z1·Z2) | 닫힘 |
| S11 ko·en | T-res · N-host · N-host-en(M16×4·M17·X20·Y11) | 닫힘 |
| S12~S15 | T-ec · T-boot-* · N-false · N-sync(M1·M3·M4·M6·M9·M13·M14a·M14b·S1) · T-boot-oc | 닫힘 |
| S16~S18 | T-boot-* · N-fail(M8·M18·M18b·X2~X4) · T-cp(M2·M11·M12·X5~X9·Y7·Y8) | 닫힘 |
| S19~S22 | T-cp · T-nh · T-sup · T-discard · N-discard(M10×8·X21·X15~X17·M7·X14·M19·Y9) | 닫힘 |
| S23 | N-fail · N-titles | 닫힘 |

- 재계수: 닫힘 27 · 열림 0 = 27. 구현 보고 27/27 일치. G-DOC 3/3 · EP-10′ 29/29.
- 목록 밖 발견: Button `:113`(Z8) 잡음 — 처분 없음.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| lint | PASS | 0 error · 2 warning(`react-hooks/incompatible-library`, 변경 밖) · 실행 후 `git status` 0 |
| typecheck | PASS | 3구성(`tsc` 3회) · `error TS` 0 |
| 관련 vitest | PASS | ΔV3-6 목록 + `ErrorToastHost.render.test.ts` = 136파일 1,521케이스: 1,510 pass · 3 skip · 8 fail(전부 `adapters/claude` win32 전용 — "프로젝트별 제어를 지원하지 않습니다"·`restart-required`, r2 기준선 동일). 신규 2건 passed |
| 전체 vitest(linux) | 환경 한계 | `bfee5bf6` 830파일 8,004케이스 중 17 red = win32 전용 3파일 8 · `C:/` 경로 3파일 9(`composer-catalog` "Composer directory must be absolute" · opencode `adapter`·`adapter.instances`). r2 head 17과 같은 수, r3가 바꾼 테스트 2파일 밖 |
| CI `gate`(windows) | PASS | PR #512 check run `121042127504`(run `40150923750`) @`bfee5bf6` conclusion success |
| doc-inventory | PASS | generated·prose·links ok, exit 0 |
| test-budgets · migrations | PASS | 두 스크립트 exit 0 |
| G-DOC · EP-10′ | PASS | `[0,1,1,1,1]` · 0줄 |
| trailer | PASS | `bfee5bf6` 6키 파싱 · `9762306c` 3키 + attribution 2 |

## r3-8. 사람 실기

| 항목 | 기계 검증 범위 | 남은 사람 실기 |
|---|---|---|
| AC9 | 판정·열거·순서·문구·N·버튼 배선·[변경] 기본 배경·셸 마운트·실패 보고 | Windows 실제 CLI `/context` superpowers 부재, 대화상자 white/dark 시각 |

## r3-9. 게이트 재실행 메모

- 명령: `npm run typecheck` · `npm run lint` · `./node_modules/.bin/vitest run <ΔV3-6 목록 + ErrorToastHost.render>` · 전체 `vitest run` · `node scripts/check-doc-inventory.mjs --check` · `check-test-budgets.mjs` · `check-migrations-appendonly.mjs` · ④ · EP-10′.
- `npm test` 미사용. better-sqlite3가 Node ABI로 로드돼 DB 스위트까지 실행됐다.
- 게이트·하네스의 트리 변경: 없음(매 변이 뒤 `git status` 0, 91회 sha256 복원 일치). 잔여물: scratchpad 밖 없음.

## r3-11. Repository operation checks

- AGENTS.md 변경: 없음.
- INDEX: `impl/IMPL_DONE`·다음 주체 Claude 일치. 자리표시자 2개 → ΔV3 `9762306c` · r3 `bfee5bf6`(`git cat-file -t` commit). 구현자 비고 3줄.
- trailer: `Agent: codex` 허용값 · 6키 파싱 · `Criteria-Pending` 값 있음.
- `[구현자 기입]` r3 7필드 7/7. 강제 지점 표는 S1~S4·U1~U10·S11~S23 전부 · EP-10′ · G-DOC와 `남긴 곳` 열을 담는다.
- 인용 해시: `28d25d35`·`d69b4c54`·`09bbff48`·`7fdc497a`·`95ffc5f5`·`aff17235`·`07caaeda`·`9762306c`·`bfee5bf6` commit.

## r3-12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 판단 |
|---|---|
| production 변경 0 · 테스트 2건 | 타당 — diff 2파일 |
| 고장 83/83 검출 · 덮개 회귀 0 | 재현 — 같은 83 ID 전부 잡음(r3-4) |
| 강제 지점 27/27 | 재현 — r3-5 분모 표 |
| className 토큰 비교 | 타당 — r3-2 |
| DB 7파일 Electron Node 모드 분리 | 이 환경은 Node ABI라 한 번에 실행됐다. 결과 차이 없음 |

## r3-13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| G3 | r2 PLAN_GAP — D-011 렌더 운반 목록·oracle 밖 | §10 EP-01″ · AC2″ | closed | ΔV3 U6·U8·M25·M26 · N-variant 잡음 |
| D6 | r2 PAIR_FAIL — `Modal.tsx:115` variant(Y2) 미검출 | VP-05″ · U8 | closed | Y2=M26 잡음(N-variant) |
| N3 | `confirm` 응답이 `mounted`·version을 보지 않는다(`useNativeMcpCatalog.ts:92`) | 비귀속 | NON_BLOCKING | r1 그대로 |
| N4 | DB 행 없는 유휴 runtime은 닫지 않는다 | 비귀속 | NON_BLOCKING | r1 그대로 |

- 새 finding: 없음.

## r3-14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 없음. r1 G2·r2 G3로 두 번 열렸던 대화상자 경로 목록이 ΔV3 9파일 전체 범위에서 미분류 0이었다.
- 관련 plan 지침: ΔV3-5가 ②″ 범위를 path 파일 전체로, 술어를 운반 값(`danger`)까지 넓혔다.
- 사용자 결정 변경 근거: 없음.
- 반복 환경 한계: linux에서 win32 전용 스위트 red(관련 8 · 전체 17). AC6 cold resume은 CI windows로만 닫힌다.

## r3-15. 결론

- 상태: **PASS (기계 범위)**.
- verify 횟수: 3회째.
- pair 결과: PASS 14 (REQUIRED 8 · REGRESSION 6) · PAIR_FAIL 0 · BLOCKED_BY 0.
- Product/UX·ACTIVE Decision: 전부 충족. D-011 렌더와 셸 마운트까지 잠겼다.
- AC: ✅ 9 · ⚠️ 1(AC9) · ❌ 0.
- 운영 gate: PASS(linux win32 기준선 red 분리, CI windows success).
- 고장 이력: 91 = 잡음 91 · 못 잡음 0 · 동치 0. r2 못 잡음 2건 잡음 · 덮개 회귀 0.
- NON_BLOCKING: N3·N4.
- 남은 사람 확인: AC9. archive 이동은 AC9 실기 뒤.

## 후행 재확인 (2026-10-29, 0275~0289 일괄 검증)

- **PASS 유지 — 후행 해결 없음.** AC9(실제 CLI `/context`·대화상자 white/dark)를 대신 닫은 후행 handoff는 없다. 0284 r1.2의 사용자 실기는 연속 토글 증상이었고 `/context`는 보지 않았다. Claude 플러그인 테스트 4파일은 win32 강제 사본에서 22/22 green.
- HEAD `81153e2`에서 전체 vitest를 다시 돌렸다(865파일). Linux 전용 실패 21건은 `C:/` fixture와 `process.platform === 'win32'` 게이트뿐이며, POSIX 경로·win32 강제 미커밋 사본에서 green이고 Windows CI [run 40834862690](https://github.com/muzaby/orca-skin/actions/runs/40834862690)이 success다 — 근거는 [0289 verify §6](../0289-opencode-runtime-retention/verify.md).
