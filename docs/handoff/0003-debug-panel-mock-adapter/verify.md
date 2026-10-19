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

---

# V1-F 검증 — 공통 시스템 피드 디버그 확장 (2026-10-16)

> 위 r1 판정(AC1~18 PASS)은 보존하고 재서술하지 않는다. 이 절은 plan `## 공통 시스템 피드 디버그 확장`의 Baseline V1-F만 판정한다.
> 문장은 [`§산출물 문장 규칙`](../AGENTS.md)을 따른다.

## F-메타

| 항목 | 값 |
|---|---|
| 검증자 | Claude Code |
| 대상 커밋/range | `fe935835..7c1b8bac` (구현 `6ab1bd19` 코드 · `7c1b8bac` 기록) + CI 보완 `db2ff28e`(0232 r2.2) |
| 구현 전 plan 기준 | `fe935835`(사용자 정정 반영 READY). 최초 READY `f7c94554` |
| V mode / 유효 V | Baseline V: V1-F (과거 AC1~18은 회귀 기준, 합산 안 함) |
| 검증 HEAD | `655fa0e0` (공유 브랜치 `origin/codex-opencode-harness`) |
| 라운드 | 1 |
| 상태 | **PASS** |
| 자기 검증 여부 | 설계 Claude · 구현 Codex · 검증 Claude — 구현자 ≠ 검증자 |

## F-0. 기준선 / plan validity

- 기준선 성립: 예 — `git diff fe935835 7c1b8bac -- …/0003…/plan.md`의 삭제 줄은 메타 `상태` 1행뿐이다. Decision·AC·§10 변경 없음.
- V mode: Baseline V1-F 유효. 4 pair 모두 REQUIRED, 기존 debug 동작 REGRESSION. §10 분모 2+1+1+1=5자리.
- 등록 적대 증거: "번들 잔존 검사에만 의존하면 DEV 가드 제거 변이"(EP-F4) — 선택 이유 있음. 나머지는 직접 oracle.
- 현재 변경 gate(관련 Vitest·readonly lint·typecheck·production build·문서·trailer)가 열거됐다. PLAN_GAP 없음.

## F-1. 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| production 활성화 경로 | 없음 | getter가 `import.meta.env.DEV && visible`(`store/automaticFeedDebug.ts:8`) — 메모리 값이 남아도 false |
| 전송·영속 부작용 | 없음 | 토글은 모듈 메모리만 바꾼다. 통합 테스트에서 `chatSend`·`settingsSet` 호출 0 |
| 소비 경로 누락 | 없음 | `rg 'groupTurns\|groupExchanges\|projectTimeline\('` — 표시 소비자는 TranscriptView→두 Timeline 1경로 |
| feature 교차 import | 없음 | app `OverlayLayer`가 chat의 section을 `DebugPanel` 슬롯에 주입. readonly ESLint 오류 0 |
| 이중 가드 | 의도 | setter 가드 제거(M0003-04)는 green — getter가 정책을 소유하는 방어적 중복이며 번들에서는 DCE |

## F-2. 등록 적대 증거·독립 변이 재측정

변이 실행기: scratchpad `mut.mjs`(1변이씩 적용 → vitest JSON → 원본 bytes 복원·SHA256 대조). 실행 후 `git status` 깨끗함.

| 변이 | 범위 | 결과 | 귀속 |
|---|---|---|---|
| M0003-01 section `if (!import.meta.env.DEV) return null` 제거 | section interaction + app integration | **red** 4/11 | EP-F4 등록(UI 가드) |
| M0003-02 OverlayLayer DEV mount 제거 | app integration | **red** 3/9 | EP-F4 등록(UI 가드) |
| M0003-03 getter DEV gate 제거 | state + integration | **red** 4/11 | EP-F1 등록(state 가드) |
| M0003-01+02 동시 적용 후 `electron-vite build` | production 번들 | `data-debug-control` 파일 **0 → 1** | EP-F4 등록(번들 감도) |
| M0003-04 setter DEV gate 제거 | state + integration | green | 독립 — 등가(getter가 정책 소유) |
| M0003-05 초기값 true | state·section·integration | **red** 1/13 | 독립 — EP-F1 기본 off |
| M0003-06 DebugPanel 슬롯 미렌더 | integration | **red** 3/9 | 독립 — EP-F3 |
| M0003-07 OverlayLayer 슬롯 미전달 | integration | **red** 3/9 | 독립 — EP-F3 |
| M0003-08 click handler가 같은 값 설정 | section + integration | **red** 4/11 | 독립 — EP-F2 |

- 등록 변이 4/4 검출. 이전 라운드 red 변이 없음(V1-F 첫 검증) → 덮개 회귀 해당 없음.

## F-3. V-pair closeout — `UT → IT → ST → AT`

| Pair | 결과 | 자리별 직접 oracle 좌표 (`app/src/renderer/src/` 기준) | path / §10 |
|---|---|---|---|
| VP-F2 MD↔UT | PASS | `features/chat/store/automaticFeedDebug.test.ts:starts disabled, toggles in memory, and a fresh module starts disabled again` · `…:production refuses activation even when memory was previously enabled` | 메모리 state·DEV policy / EP-F1 2/2 |
| VP-F3 AR↔IT | PASS | `features/chat/components/AutomaticFeedDebugSection.interaction.test.ts:updates the mounted native button through the actual memory subscription on each click` · `app/automaticFeedDebug.integration.test.ts:$backend/$agentKind toggles live and reloaded automatic bubbles without sending or changing history` | section click→구독 / EP-F2 1/1 · OverlayLayer→DebugPanel 슬롯→section / EP-F3 1/1 |
| VP-F4 SD↔ST | PASS | 위 통합 테스트(live `message.committed`·`LOAD_SESSION`·빈 세션 렌더 후 재진입) · `…:$backend/$agentKind cannot expose feeds or the button in production` · 번들 검사 | 클릭·세션 왕복·production / EP-F4 1/1 |
| VP-F1 R↔AT | PASS | 위 세 통합 케이스 ×3 하네스 경로(claude/code·claude/work·opencode/code) | AC-F1·AC-F2 |
| REGRESSION 기존 debug | PASS | `main/adapters/claude/mock-scenarios.test.ts`(13)·`mock.test.ts`(4) 통과 · 검증자 임시 probe(통합 harness로 DEV 패널 렌더, `Mock 모드`·`로그`·`자동 피드 표시`·`테마`·`컬러 팔레트`·`레이아웃` 존재와 순서) 3/3 통과 후 파일 삭제 | 기존 Mock·로그·tweak 섹션 |

- 좌표 실행 구간: 통합 테스트는 section을 **실제 구현을 호출하는 래퍼**로만 감싸 버튼 element를 포착한다(대체 아님). mock한 것은 backend·sessions·update·providers·ConfirmDialogHost·theme context·virtualizer로 이번 path 밖이다.
- 구현 보고의 좌표는 파일+서술 형식이라 위 테스트명은 검증자가 다시 지정했다.
- 분모 재측정: EP-F1 2 + F2 1 + F3 1 + F4 1 = **5/5**.

### AT / AC 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC-F1 | ✅ | 실제 버튼 handler → 두 Timeline에서 system-reminder(명시·구형)·tagged·plain 자동 피드 표시/숨김, 직접 XML 입력·assistant 보존, 전송 0 |
| AC-F2 | ✅ | 초기 false·모듈 재생성 false·세션 왕복 유지·production 버튼 0·메모리 true여도 getter false |

- 합계: `✅ 2 · ⚠️ 0 · ❌ 0 = 2`. 자기보고 `2/2`, 커밋 `7c1b8bac` trailer `Criteria-Met: 2/2` — 일치.

## F-4. 운영 gate (HEAD `655fa0e0`, 6개 handoff 공통 실행)

| Gate | 결과 | 관측 산출 |
|---|---|---|
| readonly ESLint `eslint ./src ./scripts -f json` | PASS | 1,731파일 · error 0 · warning 6(react-refresh 4 · incompatible-library 2) |
| `npm run typecheck` | PASS | node·web·test 3구성 exit 0 |
| production `electron-vite build` | PASS | main/preload/renderer 생성, renderer JS 274개 중 `data-debug-control`·`automatic-feed` 0. main의 `orca:debug` 2건은 `CHANNELS` 상수뿐. 기존 SubAgentTaskDetail 혼합 import 경고 1 |
| 관련 Vitest | PASS | 0003/0232 ΔV3 직접 13파일 221케이스 · 전체 753파일 7,390케이스 중 통과 7,383 · skip 7 · 실패 0(아래 0232 절 참조) |
| 문서 `check-doc-inventory --check` | PASS | generated ok · prose ok · links ok |
| `git diff --check` · trailer 파싱 | PASS | 범위 diff 0줄 · `7c1b8bac` 5키 파싱 |

- 작업 트리: readonly ESLint는 `--fix` 없이 실행했다. 변이·임시 probe·빌드 산출(`out/`·scratchpad)은 커밋 대상이 아니며 `git status` 깨끗함.

## F-5. Repository operation

- INDEX 0003 행: 상태·다음 주체 일치. 대상 커밋 자리표시자를 검증자가 위 좌표로 기입한다(`git cat-file -t` 전부 commit, 공유 브랜치 ancestor).
- `[구현자 기입]` 7필드 전수 존재(설계 리뷰~Review Signals).

## F-6. Finding disposition

| # | finding | disposition | 후속 |
|---|---|---|---|
| F1 | setter DEV 가드는 getter와 중복이라 제거 변이가 green | NON_BLOCKING | 기록 — 정책은 getter·번들 DCE가 보장 |

## F-7. Review Signals — 사실만

- 이전 라운드와 같은 증상 없음. 사용자 정정(reminder 포함)은 `fe935835` 설계 커밋에 근거가 있다.
- 반복된 환경 한계 없음.

## F-8. 결론

- 상태: **PASS** — REQUIRED 4 + REGRESSION 1 PASS · PAIR_FAIL 0 · PLAN_GAP 0 · AC ✅2/2 · 운영 gate PASS.
- 남은 사람 확인: `npm run dev`에서 버튼 시각·두 테마 확인(제품 시각 품질). 기능 판정은 위 기계 검증으로 닫았다.
- 다음 단계: INDEX 0003 행 archive 이동.
