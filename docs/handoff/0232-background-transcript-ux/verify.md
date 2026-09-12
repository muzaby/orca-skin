# Verify — 0232-background-transcript-ux

## 메타

| 항목 | 값 |
|---|---|
| slug | `0232-background-transcript-ux` |
| 검증자 | Claude Code |
| 일자 | 2026-09-13 |
| 대상 커밋/range | `d5a056a..aa55dbc` (구현 `4ae1cfa` r1 · `aa55dbc` r2) |
| 구현 전 plan 기준 | r1 = `d5a056a`(V1+ΔV1) · r2 = `b99e6a9`(ΔV2) |
| V mode / 유효 V | Baseline V: V1 + ΔV1 + ΔV2 |
| 검증 기준 plan revision | `d5a056a:V1+ΔV1` · `b99e6a9:ΔV2` |
| 라운드 | 2 (공식 verify는 이번이 처음) |
| 상태 | **PASS** |
| 자기 검증 여부 | 아니다 — 설계·구현 Codex, 검증 Claude Code. |

> r1과 r2 사이에 verify 턴은 없었다. 라운드 2는 사용자 미리보기 피드백(D-12~D-19)에 따른 재설계·재구현이며,
> 이번 검증은 **두 구현 커밋 전체**를 최초 검증 범위로 실행했다(유효 V의 REQUIRED·REGRESSION 전건).

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예. `4ae1cfa` = 메타 상태 1줄 + `[구현자 기입]` 111줄, `aa55dbc` = 메타 2줄 + `[구현자 기입] — r2` 84줄.
- **기준선이 diff로 성립하는가**: 예. D-01~D-19·AC1~AC19·VP·EP는 전부 설계 커밋 7개(`39d2439`·`1fdc7cb`·`aaa0bee`·`73a181b`·`d5a056a`·`ada0984`·`104e65e`·`b99e6a9`)가 소유하고 구현 커밋에 규범 행 변경이 없다.
- Decision Ledger 변경: 없음. D-00은 D-01로 `SUPERSEDED`이며 근거는 사용자 첨부 이미지(§2).
- Product/UX Contract 변경: ΔV2가 R-03·R-06을 `CHANGED`로 재선언 — 사용자 첨부 2건이 출처.
- AC 변경: 없음. AC1~AC10은 `d5a056a`, AC11~AC19는 `b99e6a9`가 소유.
- V node/pair·requiredness·§10·oracle 변경: 없음. REQUIRED 11(V1+ΔV1) + 10(ΔV2), §10 12 + 25.
- 채점에 사용할 원 기준: 위 두 설계 커밋의 §3·§7·§7-A·§10·ΔV1·ΔV2.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | ΔV1 기준 `39d2439f`, ΔV2 기준 `4ae1cfaa` — 두 기준 커밋이 실재하고 적용 순서가 명시 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | ΔV2의 R-03·R-06 CHANGED ↔ VP-Δ2-01·02, R-07·R-08·MD-03·MD-04·SD-02·SD-03·AR-02 NEW ↔ VP-Δ2-03~10 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | "기존 VP-03·06·07·Δ01~04는 REGRESSION으로 재실행" 명시 |
| pair별 path·§10 전수·직접 oracle | 유효 | ΔV2 §10이 EP-Δ2-01~06의 하위 분모(4/4/8/2/2/5)를 각각 적었다 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | 전 pair `not selected` + 이유(실제 DOM·IPC·SDK 결과 직접 관측) |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | §19 + ΔV2 운영 gate가 renderer·shared·main·preload 범위를 열거 |

- root PLAN_GAP과 영향 pair: 없음.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-01 | 도구 사이 텍스트를 노트로 그룹 안에 | `workActivity.ts` `trailingText` 버퍼 → 다음 tools 확인 시 `activity.push(...trailingText, item)` |
| D-02 | 자동 수신 user 메시지는 버블 없음, 원본 보존 | `turns.ts:groupExchanges`의 `part.origin` 있는 user 메시지 `continue` — 필터 배열을 만들지 않아 원본 index 유지 |
| D-12 | 실제 실행 모델만 표시, 미관측은 추정 금지 | `BackgroundModelLabel` — canonical call.model → live → persisted `subagentMeta.model` 순, 없으면 라벨 |
| D-13 | 완료/실패/중단 카드에 결과 본문 없음 | `CanonicalBackgroundContent` 카드가 상태·시간·도구 수만 렌더 |
| D-15/D-16 | foreground 셸 단건 전환 버튼 · foreground 셸은 패널 제외 | `ForegroundShellActions.tsx:78` `promoteBackgroundTask` · `canonicalBackground.ts:56` `isBackgroundPanelItemVisible` |
| D-17 | Work 출처에서 내부 claude 임시 경로 제외 | `taskContext.ts:isInternalClaudeSource` — Read 분기·첨부 분기 두 곳 |
| D-18/D-19 | 실행 중/완료 두 접기 그룹 · 완료만 지우기 | `CanonicalBackgroundContent.tsx:93` 그룹 투영 · `backgroundStore.dismissCompletedBackgroundItems` |

### end-to-end 흐름

```text
실행 중 foreground 셸 ToolCard → 파란 전환 버튼(ForegroundShellActions)
  → chatApi.promoteBackgroundTask({sessionId,generation,toolUseId})
  → preload → chat-turn/background.ts:62 handler → BackgroundController.promote
  → canPromoteBackgroundCall 검증 → runtime.backgroundTask(toolUseId) → true만 확인으로 기록
  → background.call patch{mode:'background'} → 패널 표시 대상으로 승격
  ↘ 패널: 실행 중/완료 두 그룹 → 완료 휴지통 → 세션 UI 표시 상태(원본 journal 불변)
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 안전 | 전환은 15초 race 후 실패로 떨어지고(`background-controller.ts:203`), 응답 뒤 runtime identity·세대·연결을 재확인한다 |
| false success 가능성 | 막았다 | `if (!backgrounded) throw` — SDK false를 성공으로 쓰지 않는다. M-17이 이 줄을 지우면 red |
| partial failure/rollback | 해당 없음 | 표시 상태는 renderer store만 바꾸고 원본 canonical/journal은 건드리지 않는다 |
| Product/UX의 A가 아닌 B | 아니다 | D-15는 "같은 실행을 단건 전환"이며 구현도 같은 `toolUseId`를 SDK에 넘긴다(재실행 없음) |
| 증상만 제거했는가 | 아니다 | 숨김은 표시 필터이고 실행·출력·중단 능력은 그대로다 |
| 최적화가 잃은 관측 | 없음 | 새 캐시·폴링 없음. elapsed는 첫 terminal evidence 시각으로 고정 |
| 출력/요청 worst-case 상한 | 불변 | 자동 읽기 신설 없음 |
| **신규 관측** | NON_BLOCKING | `isInternalClaudeSource`는 `/appdata/local/temp/<slug>/claude/` 부분 문자열만 본다. Windows 외 개발 빌드에서는 같은 내부 파일이 출처에 남는다 → D3 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 4f4c5c8..aa55dbc
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `isBackgroundPanelItemVisible` 미사용 | 정상 | 정의 파일 내부 2회 소비(`canonicalBackground.ts:91`·`:98`). 스크립트가 정의 파일을 분모에서 제외한 오탐 |
| `BackgroundTaskCard`·`SubAgentTaskList` 테스트 전용 | 정상 | 각각 `CanonicalBackgroundContent.tsx:110`·`SubAgentTileContent` 내부에서 렌더 |
| `groupTurns`·`IDLE_HINT_MS` 테스트 전용 | 기존 | 이번 변경이 만든 표면이 아니다 |
| 형제 정책 비대칭 | 0건 | 스크립트 출력 "(없음)" |
| 신규 등록값의 기존 소비처 | 확인 | `promoteBackgroundTask` 채널 = shared 상수 → preload → renderer API → 컴포넌트, 전 구간 실재 |
| producer ↔ consumer 파생 불일치 | **2건** | 이번 라운드가 소비처를 없앤 산출: `backgroundPresentation.ts` 4함수·`parts.ts settlementMessage` → D1 |
| 동일 규칙 중복 구현 | 없음 | 목록·선택 상세·헤더가 `projectBackgroundPanel` 하나를 공유(`uses the same group controls and dismissal projection for legacy list, selection, and header`) |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 케이스 실제 존재: 예. r1이 인용한 `opens notes and their surrounding tools together in one ordered timeline`·`sends the actual stop button to canonical IPC without opening the card` 전건 실재·통과.
- structural proxy만으로 통과시킨 AC: 없음 — 전 pair가 DOM·store·IPC 결과를 직접 관측한다.
- **선택된 적대 증거 재측정**: 등록 변이 **0건**(양 라운드 모두 `잠금 행 0` 선언). 검증자 신설 축 **7건** 중 검출 **6** · 미검출 **1**(D2). 일반 hunk 자동 확장 0.
- **이전 라운드 대조**: r1이 red로 기록한 변이는 없다(r1도 등록 변이 0). r1이 RED→GREEN으로 확인했다고 적은 기존 테스트 16건(노트 3·자동 수신 10·부모 카드 3)은 이번 트리에서 전건 green이며, r2가 교체한 3 oracle은 §12에서 따로 판정했다. **덮개 회귀 0.**
- **자기검증 분모**: 해당 없음(구현자 ≠ 검증자).

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M-21 — `workActivity.ts`의 노트 버퍼를 그룹 밖 flush로 되돌림 | lib + transcript 13파일 | 미등록 | **red** (5케이스) | 검증자 신설 · VP-01/VP-05 |
| M-20 — `turns.ts`의 `origin` user 메시지 skip 삭제 | turns.received + TranscriptView.received | 미등록 | **red** (10케이스 전건) | 검증자 신설 · VP-02/VP-07 |
| M-13 — `isBackgroundPanelItemVisible`을 항상 true로 | rightpanel 40파일 | 미등록 | **red** (5케이스) | 검증자 신설 · VP-Δ2-03/06 (AC15) |
| M-16 — 실행 중/완료 **형제 슬롯 맞바꿈** | rightpanel 39파일 | 미등록 | **red** (3케이스) | 검증자 신설 · VP-Δ2-09 (AC18) |
| M-14 — 휴지통이 실행 중 항목도 지우도록 | backgroundStore.panel | 미등록 | **red** (`preserves pending work, new completions…`) | 검증자 신설 · VP-Δ2-09/10 (AC19) |
| M-15 — `isInternalClaudeSource`를 항상 false로 | taskContext 2파일 | 미등록 | **red** (8케이스) | 검증자 신설 · VP-Δ2-07/08 (AC17) |
| M-17 — SDK `false` 응답을 성공으로 처리 | controller.promotion + chat-turn promotion | 미등록 | **red** (`rejects SDK false and permits a fresh retry without fabricated state`) | 검증자 신설 · VP-Δ2-05 (AC16) |
| M-18 — `canPromoteBackgroundCall`에서 `phase==='returned'`·terminal 가드 제거 | promotion 3스위트 + ForegroundShellActions | 미등록 | **green → 오라클 공백** | 프로덕션은 정상(probe: tool_result 도착 후 task가 running이어도 `false`; 같은 probe가 M-18에서 red) → D2 |

- 동작 보존 추출 라운드인가: 아니오. helper의 `lib/canonicalBackground.ts` 이설이 있었으나 신규 동작이 함께 들어와 hunk 되돌림 문제는 없다.
- 소거 변이의 잔여물 수렴: 해당 없음 — 7건 모두 동작 단언에서 판정됐고 타입/lint 부산물에 기대지 않았다.
- 형제 슬롯 맞바꿈 변이: M-16 — 두 그룹 산출을 맞바꿔 3케이스 red. 존재만 보는 단언이 아니다.
- `N회` 기준의 실제 관측 주체: `promotes each exact running shell once…`가 실제 API 호출 인자와 횟수를 센다.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 |
|---|---|---|---|---|
| VP-05 | MD-01 ↔ UT-01 / UT | REGRESSION | **PASS** | `workActivity.test.ts` 응답 경계·노트 identity; M-21 red |
| VP-Δ03 | MD-02 ↔ UT-02 / UT | REGRESSION | **PASS** | ToolCard 기본 row 회귀 + Inline 기본 프레임 보존 |
| VP-Δ2-04 | MD-03 ↔ UT-03 / UT | REQUIRED | **PASS** | `background-task.test.ts` + `canPromoteBackgroundCall` 판별; M-13 red |
| VP-Δ2-08 | MD-04 ↔ UT-04 / UT | REQUIRED | **PASS** | `taskContext.internalSources.test.ts` 대소문자·점 세그먼트·형제 8케이스; M-15 red |
| VP-06 | AR-01 ↔ IT-01 / IT | REGRESSION | **PASS** | `opens the clicked task and returns through the real header back callback` |
| VP-Δ04 | AR-01 ↔ IT-01 / IT | REGRESSION | **PASS** | `keeps an Explorer detail limited to its transcript after a task is associated` |
| VP-Δ2-05 | AR-02 ↔ IT-02 / IT | REQUIRED | **PASS** | `background-controller.promotion.test.ts`(등록 handler→controller→live port); M-17 red |
| VP-07 | SD-01 ↔ ST-01 / ST | REGRESSION | **PASS** | `TranscriptView.received.test.ts` live/LOAD_SESSION; M-20 red |
| VP-Δ2-06 | SD-02 ↔ ST-02 / ST | REQUIRED | **PASS** | `chat-turn/background.promotion.test.ts` + 구현자 실제 SDK 실기(Bash PID 3351→3351, PowerShell 11796→11796) |
| VP-Δ2-10 | SD-03 ↔ ST-03 / ST | REQUIRED | **PASS** | `preserves dismissal and collapsed groups through remount and session round trips…` · `follows a dismissed task when its invocation arrives late`; M-14 red |
| VP-01·02·03·04 | R ↔ AT / AT | REQUIRED·REGRESSION | **PASS** | AC1~AC8 표 |
| VP-Δ01·Δ02 | R-05·R-06 ↔ AT-09·10 / AT | REGRESSION | **PASS** | AC9·AC10 표 |
| VP-Δ2-01·02·03·07·09 | R ↔ AT / AT | REQUIRED | **PASS** | AC11~AC19 표 |

- root `PAIR_FAIL`: 없음.
- 종속 `BLOCKED_BY`: 없음.
- 하나의 증거가 함께 닫은 pair: `CanonicalBackgroundContent.wiring.test.ts`가 VP-06(IT 배선)·VP-Δ2-09(그룹 AT)·VP-Δ2-10(표시 상태 ST)을 함께 닫는다 — 각각 callback 경계·DOM 그룹·remount 수명으로 판정 범위가 다르다.
- 이번 라운드 실행 범위: 최초 verify — REQUIRED 10(ΔV2) + REGRESSION 11(V1·ΔV1) = 21 pair 전건 + 운영 gate.

### AT / AC 세부와 합계

| AT / AC | 제품/동작 기준 | 결과 | 검증 증거 |
|---|---|---|---|
| AC1 | Work 노트가 같은 그룹의 순서 있는 타임라인 | ✅ | `counts intermediate notes inside one closed tool group while retaining the final answer`; M-21 red |
| AC2 | 접힘에도 도입·최종 답변·질문·오류 보존 | ✅ | `workActivity.test.ts` 보호 구간·late result identity |
| AC3 | 자동 수신 live/reload가 버블·빈 교환을 만들지 않음 | ✅ | `keeps automatic data in live/reloaded state while excluding its bubble and metadata`(Work·Code 두 모드); M-20 red |
| AC4 | 직접 입력한 태그·정상 결과·원본 origin 유지 | ✅ | 같은 스위트의 양성 짝 4케이스 |
| AC5 | 카드 선택이 도구 호출 상세로 열림 | ✅ | `opens the clicked task and returns through the real header back callback` |
| AC6 | 경과 시간·중단이 실제 식별자로 동작 | ✅ | `sends the actual stop button to canonical IPC without opening the card` |
| AC7 | 상태 줄 순서·파랑·hover/focus 버튼 | ✅ | `statusLine.background.test.ts` 순서·0개·overflow |
| AC8 | 작업 수 클릭이 현재 모드 패널을 연다 | ✅ | 같은 스위트의 Code=subagent·Work=task 전이 |
| AC9 | 패널에 새로고침·일괄 중단·대기 UI 없음, 개별 중단은 있음 | ✅ | `independently collapses the two groups and clears only terminal cards through the real controls`의 제어 집합 + 개별 stop 양성 |
| AC10 | 상세에 반복 제목 없음, Explorer는 대화록만·외곽 테두리 없음 | ✅ | `keeps an Explorer detail limited to its transcript after a task is associated` · `keeps an opened shell call body-only after it gains a task` |
| AC11 | 실제 child 모델만 표시, 미관측은 추정 금지 | ✅ | `prefers canonical actual model, then live actual model, then persisted actual model` · `legacy cards use persisted execution model and never treat requested model or Explore as observed` |
| AC12 | 완료/실패/중단 카드에 결과 본문 없음 | ✅ | `taskSurface0212.render.test.ts`가 원본 `cause` 보존을 양성으로, 카드 본문 부재를 음성으로 함께 단언 |
| AC13 | 비Explorer 상세는 ToolCard 본문만 | ✅ | `keeps an opened shell call body-only after it gains a task` |
| AC14 | 파란 전환 버튼이 같은 toolUseId만 SDK 전환 | ✅ | `promotes each exact running shell once and opens the Code background panel after success` + 구현자 실제 SDK PID 동일 기록 |
| AC15 | foreground 셸은 상태 불문 패널 제외 | ✅ | `hides foreground shells with running/completed/failed/stopped state…` 4케이스 + 무호출 케이스; M-13 red |
| AC16 | 완료·이미 background·Work에 버튼 없음, false·예외·지연은 짧은 오류 | ✅ | `disables unregistered foreground shells and hides terminal, background, and Work actions` · `shows a short retryable local error when the backend rejects` · `does not open a different session panel when the successful response arrives late`; M-17 red. 단 `phase==='returned'` 분기는 D2 |
| AC17 | Work 출처에서 내부 claude 경로 제외, 일반 출처 유지 | ✅ | `excludes the internal subtree from completed Read sources`(경로 변형 6종) · `applies the same filter to attachments without hiding pathless history or web sources`; M-15 red |
| AC18 | 실행 중/완료 두 그룹, 독립 접기, 빈 그룹 숨김 | ✅ | `independently collapses the two groups…`; M-16(형제 맞바꿈) red |
| AC19 | 완료 휴지통만 현재 완료 항목을 지움 | ✅ | `preserves pending work, new completions, the same IDs in a new generation, and another session`; M-14 red |

- **합계 재측정**: `✅ 19 · ⚠️ 0 · ❌ 0 = 총 19`(분모는 V1 AC1~8 + ΔV1 AC9~10 + ΔV2 AC11~19를 직접 셈). 자기보고 `19/19` — 일치.
- **합계 사본 대조**: 본문 19 ↔ trailer `Criteria-Met: 19/19` ↔ INDEX 비고 "AC19/19" — 일치.

### pair별 plan §10 강제 지점 분모

| EP | plan 분모 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| EP-01 | 2 | 2/2 — `workActivity.ts` projector · `WorkActivity.tsx` disclosure | PASS |
| EP-02 | 2 | 2/2 — `turns.ts` 공통 투영 · live/reload 원본 유지 경계 | PASS |
| EP-03 | 2 | 2/2 — canonical 카드·상세 · stop IPC callback | PASS |
| EP-04 | 2 | 2/2 — `StatusLine` · `PendingAssistantStatus` callback | PASS |
| EP-Δ01 | 1 | 1/1 — canonical 목록 toolbar 제어 집합 | PASS |
| EP-Δ02 | 3 | 3/3 — canonical 상세 · `ToolCard` · `InlineSubagentDetail` | PASS |
| EP-Δ2-01 | 4 | 4/4 — 공유 `call.model` 계약 · mapper child model · canonical 소비 · legacy 소비 | PASS |
| EP-Δ2-02 | 4 | 4/4 — canonical 카드 · 상세 · 공통 패널 선택 투영 · `SubAgentTileHeader` 동일 필터 | PASS |
| EP-Δ2-03 | 8 | 8/8 — 요청 타입·스키마·preload·renderer API(3) / main 등록·controller 검증(2) / runtime 단건 포트(1) / ToolCard·전환 액션(2) | PASS |
| EP-Δ2-04 | 2 | 2/2 — 단조 `backgroundObserved` · 공통 셸/표시/전환 후보 predicate | PASS |
| EP-Δ2-05 | 2 | 2/2 — `taskContext.ts` 경로 판별 selector · `TaskContextContent` 소비 | PASS |
| EP-Δ2-06 | 5 | 5/5 — canonical·legacy·header 투영(3) · 세션 표시 상태·그룹/지우기 액션(2) | PASS |

- 전수 합계 독립 재측정: 기존 `2+2+2+2+1+3 = 12`, ΔV2 `4+4+8+2+2+5 = 25`. 자기보고 12/12·25/25 — 일치. 두 집합을 합산하지 않는다는 plan의 판단도 타당하다(중복 책임).
- 표에 없는데 같은 불변식이 필요한 지점: 없음.
- `실패 의미`가 "다른 게이트가 막는다"고 적은 행: 없음.

### 현재 변경의 운영 gate

| Gate | 이유 | 결과 | 증거 |
|---|---|---|---|
| renderer 정적 | renderer·shared·main·preload 변경 | **PASS** | typecheck 3구성 error 0 · eslint error 0 / warning 1(기존) |
| 동작 | 투영·카드/상세·상태 줄·전환 | **PASS** | `vitest run --maxWorkers=4` 510파일·4745케이스 통과, 실패 0 |
| build | Electron 산출 | **범위 한정 PASS** | 이 환경에서는 `typecheck` 전건 통과로 갈음. 구현자가 `npm run build` exit0(main/preload/renderer)을 기록했다 |
| repository/message bus | 새 문서·INDEX·trailer | **PASS** | inventory 9 items·98 channels · 상대 링크 전건 · `git diff --check` 통과 · trailer 5키 파싱 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `promoteBackgroundTask({sessionId,generation,toolUseId})` | zod 스키마 + preload + typecheck | 정확한 ID 1건만 SDK로, 세대·연결·중복·지연을 각각 거부 | PASS |
| `Query.backgroundTasks(toolUseId)` | 설치 SDK `sdk.d.ts` 확인(설계 §Research) | 구현자 loopback 실기에서 ACK true + 동일 taskId/PID | PASS |
| `docs/arch/frontend/rendering.md`·`background-tasks.md`·`IPC_CONTRACT.md` | inventory gate | 채널 수 98이 코드와 일치, 내부 경로 제외 규칙 서술 추가 | PASS |
| `app/tsconfig.test.json` files 추가 | typecheck:test 통과 | preload `index.d.ts`를 명시해 테스트 전역 Window 계약을 고정 | PASS |

## 7. 숫자 / 음성 기준 / 상한 재측정

- §10 분모 12·25 재측정 일치.
- AC 분모 19 직접 재측정 일치.
- 0건 게이트: "패널 제어 부재"(AC9)·"결과 본문 부재"(AC12)·"내부 출처 부재"(AC17)는 모두 **음성 단언 + 같은 스위트의 양성 짝**을 함께 갖는다 — 전부 지워도 통과하는 형태가 아니다.
- 총량 임계: 상태 줄 fact 상한은 기존 값 유지, 배경 항목이 접힌 합계에 묻히지 않도록 개별 렌더.
- 출력/요청 상한: 신규 자동 읽기·폴링 0.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| 노트·자동 수신·그룹·전환 로직 | 전부 — 실제 DOM·store·IPC | 없음 | — |
| 시각 품질(파랑 토큰·hover·light/dark) | 클래스·토큰 존재와 DOM 구조 | **1건** | Windows 설치본에서 Code 패널을 열어 전환 버튼 위치·그룹 접기·휴지통의 두 테마 시각 확인 |
| 실제 SDK 단건 전환 | 구현자 loopback 실기 기록 확인 | 없음(추가 불요) | 증거: [`promotion-sdk-evidence.json`](promotion-sdk-evidence.json) |

## 9. 게이트 재실행

- 실제 실행 명령: `npm run typecheck` · `eslint --no-cache ./src ./scripts` · `vitest run --maxWorkers=4` · `node --test scripts/*.test.mjs` · `check-doc-inventory --check` · `check-migrations-appendonly` · `check-test-budgets`.
- **관측한 실행 산출**: typecheck 3구성 error 0 · eslint error 0/warning 1 · vitest 510파일 4745케이스 통과(1 skip 파일·3 skip 케이스) · scripts 116케이스 · inventory 9 items·98 channels · migrations 27 · budgets 11 suites.
- `npm test`를 썼는가: 아니다(`pretest` 우회).
- 환경 기인 실패 분리: 최초 red 7파일 = electron 바이너리 미설치. 설치 후 7파일 28케이스 전건 통과.
- **게이트가 작업 트리를 바꿨는가**: 없음(`--fix` 없는 eslint).
- **검증 중 남긴 잔여물**: 없음. 변이 8건 복원, probe 삭제, `git status --short` 공백.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/테스트 | 실행·산출 관측 | — | 완료 |
| AC ↔ production path | 19행 대조 + 변이 8건 | — | 완료 |
| 레이어/토큰/그룹 스코프 | boundaries lint + 클래스 확인 | — | 완료 |
| UI 시각 품질 | 로직·DOM 검증 | **시각 확인 1건** | 대기(§8) |
| 제품 의도 | — | 결정 | D-07~D-19 전부 사용자 확정 |

## 11. Repository operation checks

### AGENTS.md 위생

- `AGENTS.md` 변경 없음 — 해당 없음.

### INDEX 보드 정합성

- 상태 / 다음 주체 / 대상 커밋: 이번 턴에 `verify` / `PASS` / 설계 8커밋 · `4ae1cfa`(r1) · `aa55dbc`(r2)로 갱신, 다음 주체 `사람`.
- 「다음 주체」 칸: 하나(`사람`).
- 대상 커밋 좌표 기입: `git cat-file -t`로 `39d2439`·`1fdc7cb`·`aaa0bee`·`73a181b`·`d5a056a`·`ada0984`·`104e65e`·`b99e6a9`·`4ae1cfa`·`aa55dbc` 전건 `commit` 확인.
- 비고 5줄 이내: 예.
- PASS 시 archive 이동: **보류** — 시각 실기 1건이 남아 0225·0226·0229 선례를 따른다.

### Commit / reference 정합성

- trailer 허용값: r1 `Criteria-Met: 10/10`, r2 `19/19`, 둘 다 `Agent: codex`·`Status: implemented`·`Verified-By: pending`.
- trailer 파싱: 두 커밋 모두 `%(trailers:only=true)`가 5키 반환.
- 인용 커밋 해시 실재: ΔV1이 적은 `39d2439f`, ΔV2가 적은 `4ae1cfaa` 모두 실재(약식 해시 8자리).
- reference/script: `promotion-sdk-evidence.json` 신설, plan에서 참조 — 링크 gate 통과.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| "broad 회귀에서 이전 모델 접두/결과 본문 기대 3건 실패 → D-12/D-13에 맞춰 갱신" | **타당** | 3 oracle 모두 확인했다. 교체본이 **원본 데이터 양성 단언을 새로 추가**했다 — `taskSurface0212`는 `cause`가 파생 call result에 남는 것을 단언하고 카드 본문 부재를 음성으로 본다. 커버리지를 지운 교체가 아니다 |
| "helper를 `lib/canonicalBackground.ts`로 이동(Fast Refresh)" | 구현 세부 | 레이어 경계 유지(lint boundaries 통과) |
| "후속 UI 리뷰 P2 2건 직접 재현·수정" | 타당 | `dismisses terminal call selection and follows its late task association across refresh`가 그 동작을 관측 |
| r1·r2 모두 `잠금 행 0` | **부분적으로 불충분** | 직접 oracle 선택은 plan과 일치하지만, 그 결과 이번 라운드가 심은 결함은 0건이었다. 검증자가 8건을 신설해 7 red·1 green을 얻었다(D2) |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| D1 | `backgroundPresentation.ts`의 4함수와 `parts.ts:316 settlementMessage`가 프로덕션 소비처 0이 됐다. D-13·D-14가 카드 결과 본문과 출력 viewer를 제거한 결과 | D-13·D-14 의도의 잔여 | NON_BLOCKING | — | 기록. 제거 또는 보존 사유 명시를 후속 라운드에서 |
| D2 | `canPromoteBackgroundCall`의 `phase==='returned'`·terminal 가드를 제거해도 promotion 3스위트·ForegroundShellActions가 green. 프로덕션 동작은 정상(검증자 probe로 확인, 같은 probe는 변이에서 red) | AC16 / VP-Δ2-04 | NON_BLOCKING | — | 구현 — tool_result가 먼저 온 실행 중 셸 케이스를 추가하면 닫힌다 |
| D3 | `isInternalClaudeSource`가 `appdata/local/temp/<slug>/claude/` 부분 문자열만 본다. Windows 외 개발 빌드에서는 같은 내부 파일이 Work 출처에 남는다 | D-17이 Windows로 범위를 명시 | NON_BLOCKING | — | 기록. 범위 확대는 새 결정 |
| D4 | `chatStopAllBackgroundTasks`·`chatReadBackgroundOutput`이 renderer 소비처 0이 됐다(D-07·D-14) | D-07·D-14 의도 | NON_BLOCKING | — | 기록. `docs/arch/backend/background-tasks.md`에 현재 진입점 상태 반영 후보 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 없음. r1→r2는 새 사용자 결정(D-12~D-19)이 원인이고 같은 결함의 재발이 아니다.
- 관련 plan 지침/AC의 존재 여부: 있었다. 두 라운드 모두 설계 커밋이 구현 커밋보다 앞서고 규범 행이 분리돼 §0 기준선 잠금이 작동했다.
- 사용자 결정 변경 근거: D-00→D-01, D-07·D-08·D-09·D-10·D-11·D-14의 대체 관계가 각각 사용자 피드백·첨부 파일명과 함께 §3에 남아 있다.
- 반복된 검증 환경 한계: 시각 품질 1건(설치본 UI). 기계 검증 가능한 축은 이번 턴에 전부 실행했다.
- 라운드 수: 2. verify 턴 0회였던 상태가 이번에 해소됐다(`docs/handoff/AGENTS.md` §외부 리뷰는 verify를 대체하지 않는다).

## 15. 결론

- 상태: **PASS**
- pair 결과: REQUIRED **10 PASS** · REGRESSION **11 PASS** · root PAIR_FAIL 0 · BLOCKED_BY 0
- PLAN_GAP: 없음
- Product/UX 및 ACTIVE Decision 충족: D-01~D-19(ACTIVE 18, SUPERSEDED 1) 전건 production path에서 확인
- AC 충족: ✅19 · ⚠️0 · ❌0 = 19/19 (자기보고와 일치)
- §10 강제 지점: 독립 재열거 **12/12 · 25/25** 일치
- 현재 변경 운영 gate: 4종 PASS(build는 typecheck로 갈음 + 구현자 기록)
- NON_BLOCKING: 4건(D1~D4) · NEXT_HANDOFF: 없음
- repository operation checks: trailer 2커밋 5키 파싱, 좌표 10건 실재, INDEX 갱신 완료
- 남은 사람 확인: 설치본 시각 실기 1건(§8)
- 다음 단계: 시각 실기 후 INDEX 행을 archive history로 이동
