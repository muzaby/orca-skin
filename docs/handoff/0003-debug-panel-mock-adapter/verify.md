# Verify — 0003-debug-panel-mock-adapter

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0003-debug-panel-mock-adapter` |
| 검증자 | Claude Code |
| 일자 | 2026-06-10 |
| 대상 커밋 | `5ef793c` (INDEX 기재 `78f1601` 은 plan 베이스 — 실 구현+보고 단일 커밋은 `5ef793c`, 0002 위생 노트 ① 와 동일 패턴) |
| 라운드 | 1 |
| 상태 | **PASS** |

## 요구사항 충족 매트릭스

> plan 의 인수 기준 1–18 을 1:1 대조. 증거는 `파일:라인` · 테스트 출력 · 명령 결과.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `CHANNELS.debugGetMock`/`debugSetMock` + `MOCK_SCENARIO_IDS`(8종) + `MockScenarioId` + `DebugMockState` | ✅ | `shared/ipc.ts:48-49`(채널) · `:54-65`(8종 + 타입) · `:67-71`(DebugMockState) |
| 2 | `DebugMockPatchSchema`(세 필드 optional, ratio 0~1) | ✅ | `shared/protocol.ts:41-47` (`.partial()` + `z.number().min(0).max(1)`) |
| 3 | `mock-scenarios.ts` — electron 비의존 순수 모듈 · 4종 MockStep · `runScenario` 인터프리터(provider/sessionId 주입·signal.aborted 체크·sleep 주입·approval allow/deny 분기·requestApproval 부재 시 자동 allow) | ✅ | import 는 shared 타입뿐(`mock-scenarios.ts:1-8`) · MockStep 4종 `:10-19` · 주입 `withEnvelope:296-307` · abort `:208` · sleep `:213-214` · 자동 allow `:222-224` |
| 4 | telemetry usage 합 == `round(ratio×200_000)` · `costUsd:0` · `model:'mock-sonnet'` | ✅ | `usageForRatio:309-332` (total=round(ratio×200000), input+cacheRead+cacheCreation=total) · 테스트 `mock-scenarios.test.ts:64-83` (0→0, 0.95→190000) |
| 5 | 8 시나리오 `Record` · `full` 이 11종 전수 일치(권한 2종은 approval 스텝 갈음) | ✅ | `SCENARIOS:39-201` · 가드 테스트 `mock-scenarios.test.ts:156-178` PASS |
| 6 | `ask_question` 이 `AskUserQuestion` tool.call.started 를 approval 보다 선행 | ✅ | `mock-scenarios.ts:108-156` · 순서 테스트 `mock-scenarios.test.ts:106-124` PASS |
| 7 | `plan_review` allow/deny+message(재approval)/deny+interrupt(종료) 3분기 | ✅ | `planApproval:240-286` · 테스트 `mock-scenarios.test.ts:126-145` PASS |
| 8 | `error` 시나리오 delta 후 error(retryable:true) 종료 · telemetry 미발행 | ✅ | `mock-scenarios.ts:162-168` · 테스트 `:147-154` PASS |
| 9 | `MockAdapter implements SessionAdapter`·`id='claude-code'`·LiveTurn(interrupt 종료·no-op control)·sessionId 발급/보존·`getState` 매 턴 read | ✅ | `mock.ts:8-43` · `getState()` 매 sendMessage 호출 `:26` · 테스트 `mock.test.ts:13-73` PASS |
| 10 | 라우터 `debugMock` 비영속 상태·`import.meta.env.DEV` 게이트(인스턴스화+핸들러 2개)·어댑터 선택 1줄·기타 경로 무변경 | ✅ | `router.ts` diff: 상태 `:120-126` · DEV 핸들러 `:201-208` · 어댑터 선택 `:243-244` (persist/flushAskAnswers/cancel/setMode 무변경) |
| 11 | `requestApproval` 클로저가 broker 해소 직후 `permission.resolved` send (mock/실 공통) | ✅ | `router.ts` diff: broker `register` 직후 `sendChatEvent(..., type:'permission.resolved', approvalId, resolution)` |
| 12 | preload `window.orca.debug.{getMock,setMock}` + renderer `debugApi` | ✅ | `preload/index.ts:133-137` · `renderer/.../api/ipc.ts:100-104` |
| 13 | `TweaksPanel.tsx`→`FloatingPanel.tsx` git mv·`FloatingPanel`(title 필수)+Section/Toggle/Radio + 신규 `PanelSelect`/`PanelSlider` · TweaksPanel 잔존 0 | ✅ | `git show --stat` rename 확인 · exports `FloatingPanel.tsx:8,20,85,93,126,172,203` · `rg TweaksPanel src` → NONE |
| 14 | `features/debug/`(DebugPanel + useDebugMock + barrel) — Mock 섹션 + tweaks 이식 · useDebugMock 마운트 동기화 + 낙관적 갱신 | ✅ | `DebugPanel.tsx:26-79` · `useDebugMock.ts:17-36` (mount getMock + optimistic setMock) · `index.ts` barrel |
| 15 | `OverlayLayer` `#app-frame-debug` 슬롯 유지 + 내부 `{import.meta.env.DEV && <DebugPanel/>}` | ✅ | `OverlayLayer.tsx:52-54` |
| 16 | `mock-scenarios.test.ts` + `mock.test.ts` 신규 · 기존 스위트 무변경 통과 | ✅ | 273 tests / 40 files PASS (아래 게이트) |
| 17 | 게이트 `lint`(boundaries 0)·`typecheck`·`test` 통과 | ✅ | 아래 게이트 재실행 결과 — 전부 exit 0 |
| 18 | prod: `out/main` debug 등록 코드 부재 · `out/renderer` DebugPanel 미포함 | ✅ | `rg` 결과 둘 다 NONE (아래) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행 | — | PASS (273/273, boundaries 0) |
| 인수 기준 ↔ 코드 대조 | ✅ 증거 | 이견 시 중재 | 18/18 충족 |
| 레이어 경계 위반 0 | ✅ | — | lint PASS (`features/debug`→`shared` only) |
| 문서 형식/링크/한국어 | ✅ | — | IPC_CONTRACT/layers 갱신 완료 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 무변경 — 해당 없음 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| Open Questions | ✖ | ✅ | 해당 없음 |
| UI/UX 시각 검증 | ✖ | ✅ | **사람 확인 대기** (아래 수동 항목) |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint        → exit 0 (eslint --cache --fix, boundaries 위반 0)
$ npm run typecheck             → exit 0 (typecheck:node + typecheck:web)
$ npm test                      → exit 0
   Test Files  40 passed (40)
        Tests  273 passed (273)
$ npm run build                 → exit 0 (tsc + electron-vite build)
$ rg 'debugGetMock|debugSetMock|MockAdapter|runScenario|SCENARIOS' out/main      → NONE
$ rg 'DebugPanel|Mock 모드|텍스트 스트리밍|useDebugMock|debugApi' out/renderer    → NONE
```

(최초 실행 전 `npm rebuild better-sqlite3` 로 Node ABI 정합 — Codex 보고와 동일.)

## 위생 검토 (AGENTS.md 변경 시)

- 본 작업은 `AGENTS.md` 를 변경하지 않음 — 키/토큰/이메일/IP 스캔 대상 없음.
- 갱신 문서(`IPC_CONTRACT.md` §2.13 신설 + §3 행 · `arch/frontend/layers.md` features/debug + FloatingPanel)는 결정·구조 서술만 — 변동성/일회성/비밀 혼입 없음.

## PHASES.md 정합성

- "현재 작업 중" 보드 링크 행 → 완료 표로 승격. PR#/커밋(`5ef793c`) 기재. 형식 기존 행과 일치.

## 비범위(Claude verify 단계 수행) 처리 결과

- `docs/IPC_CONTRACT.md`: §1 도메인 14→15(`debug`) · §2 총 35→37 · §2.13 Debug 도메인 신설(dev 전용 게이트 명시) · §3 `permission.resolved` 발행 주체(라우터 requestApproval 클로저) 명기 · §2.14 로 예약 절 번호 이동. ✅
- `docs/arch/frontend/layers.md`: §1-1 features/`debug` 추가 · shared/ui `TweaksPanel`→`FloatingPanel`(+atom) · `api/ipc.ts` debugApi · OverlayLayer 주석. ✅

## 결론 / 다음 단계

- **상태: PASS** — 인수 기준 18/18 기계 검증 충족, 게이트 4종(lint/typecheck/test/build) 통과, prod dead-code 제거 확인, 레이어 경계 위반 0.
- INDEX `verify/PASS`, 다음 주체 `—`. `docs/PHASES.md` 표로 승격.
- **사람 잔여(에이전트 판정 불가)**: `npm run dev` 시각 검증 — 시나리오별 카드 렌더 · plan reject 턴 중단 · "세션 동안 허용" 재전송 시 카드 미표시 · 슬라이더 90%+ → 컨텍스트 도넛/`nearCompaction` 경고. 제품 의도 부합 및 PR 머지 승인.
