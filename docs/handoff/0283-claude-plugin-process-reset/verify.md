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
