# Plan — 0149-simplify-132-148-cleanup

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0149-simplify-132-148-cleanup` |
| 작성자 | Claude Code |
| 일자 | 2026-07-26 |
| 매핑 | PHASES Phase 4 행 (0132~0148 계열 /simplify 정리) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | `/simplify 핸드오프 132~148` — 0132~0148 이 도입한 코드 변경을 4관점(재사용·단순화·효율·altitude)으로 리뷰하고 발견을 적용 | 라이브 세션 요청 (2026-07-26) |
| 명시 요구 | "핸드오프 0149 생성" — /simplify 결과를 핸드오프 문서로 남긴다 (질의 응답) | 라이브 세션 요청 (2026-07-26) |
| 명시 요구 | **"구조 일반화까지 적용"** — altitude 관점의 특수분기 수렴 리팩토링을 이번 범위에 포함 (0131 의 "기록만" 보수 기준을 명시적으로 넘어섬) | 라이브 세션 질의 응답 (2026-07-26) |
| 명시 요구 | **"불필요한 코드, 사용하지 않는 코드, 레거시 코드는 과감하게 삭제할 것"** | 라이브 세션 요청 (2026-07-26) |
| 명시 요구 | 브랜치 푸시 + draft PR 까지 진행 | 라이브 세션 질의 응답 (2026-07-26) |
| 추론 의도 | /simplify 는 동작 보존 품질 정리 — IPC 계약·타입 표면·렌더 DOM·a11y 속성은 불변이어야 한다. 단 이번엔 "구조 일반화" 를 사용자가 명시 승인했으므로, **일반화의 결과로 기존 설계 의도가 처음 실효되는 경우**(F1b)는 허용하되 verify 에 별도 기재한다 (추론) | `/simplify` 스킬 정의 + 0106/0120/0131 선례 |

## Context (왜)

0132~0148 범위(`d18e628..HEAD`, `app/src` 기준 **80 파일 · +3,649/−836`)를 4관점 리뷰했다.
`d18e628` 은 직전 /simplify 핸드오프 **0131**(121~130 정리)의 검증 커밋이라, 그 이후 전체가
미리뷰 구간이다. 0131 직후의 `Handoff: none` 2건(`5dee1af` lockfile 재생성, `c69f24d` SDK
0.3.215 타입 적응)도 0131 리뷰를 받지 않았으므로 포함한다. `0147`·`0148` 은 `docs/etc/study/`
문서 전용(`app/src` 무변경)이라 코드 리뷰 대상이 아니다(0147 동반 SDK `0.3.220` 핀만 해당).

**이 묶음의 성격은 앞선 정리 묶음들과 다르다.** 0131 범위는 그 자체가 디자인 통일성·확장점
정비라 대부분 이미 정돈돼 있었지만, 0132~0148 에는 **같은 규칙을 여러 번 고쳐 쓴 두 갈래**가
있다 — ① 백그라운드 서브에이전트·listen 턴(0135·0136·0138·0143, 방향이 한 번 반전됨)과
② 컨텍스트 도넛 귀속(0134·0139·0141·0142, 네 번 연속 수정). 두 갈래 모두 **특수분기가 누적**된
상태로 남았다. 여기에 0145/0146 composer 입력 아키텍처 재편(최대 변경)이 신규 모듈 5개를
들여오며 소수의 잔재(삭제된 `HighlightedTextarea` 의 핸들 멤버 등)를 남겼다.

**깨끗함이 확인된 것**(재발견 아님, 조사 결과):

- 0143 이 0135/0138 코드를 **실제로 전량 제거** — `backgroundSubagents`·`ORCA_SUBAGENT_BACKGROUND`
  가 `TurnRequest`·`CanUseToolOptions`·`ClaudeAdapter`·`TurnCoordinatorDeps`·`chat-turn`·`settle`
  어디에도 없다. 0138 의 배제 게이트는 `decidePostTurnStep` 으로 **대체**됐지 옆에 남지 않았다.
- composer 분해(`HighlightedTextarea` → `ComposerDecorationLayer`/`composerDecoration`)는 순수
  이동 — `tokenize` 가 복사가 아니라 이전됐다. `Composer.tsx` 에 중복 잔존 없음.
- `post-turn.ts`·`background-tasks.ts`·`updater-feed.ts` 는 올바른 레이어의 순수·테스트 가능 모듈.
- union 타입 reflow(`shared/ipc.ts`·`permission-mode.ts`·`queries.ts`·`boot/steps.ts` 등)는
  `e96d3ad` lint --fix 툴체인 노이즈 — 코드 변경 아님.

## 자료조사 (Research)

> 4관점 리뷰 에이전트 4기 병렬 실행 → 재사용 11 · 단순화 14(+데드코드 1) · 효율 4 · altitude 9.
> dedup 후 **29건**. 아래는 적용 근거가 되는 핵심 확인 사실만 — 전건은 "설계" 절의 표.

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `receive()` 의 delta 분기는 **도달 불가** — `createEventCoalescer(sink={emit:receive, emitDeltaBatch:receiveDeltaBatch})` 가 `receive` 의 유일 호출자이고 `isDeltaEvent` 가 두 delta 타입을 전량 batch 경로로 보낸다 | `chatStore.ts:511-512` · `eventCoalescer.ts:17,59` · `chatStore.ts:382-388` |
| 같은 이유로 0143 이 `receive` 에만 넣은 `parentToolRunId === undefined` 가드가 **라이브 delta 경로에 미적용** — `receiveDeltaBatch` 는 어떤 delta 에도 `BEGIN_TURN` 을 건다 | `chatStore.ts:370-377`(가드) ↔ `chatStore.ts:245`(가드 없음) |
| `primaryModelKey`(live)와 `primaryModel`(restore)의 점수식이 **다름** — 전자 `input+cacheRead+cacheCreation`, 후자 `input_tokens` only. 그런데 전자 주석은 "복원 경로 usage-map:41 primaryModel 과 동형" 이라 주장 | `claude-map.ts:506` ↔ `usage-map.ts:41` |
| `inflight ‖ listening` 이 4곳에 인라인 복제되고 **3곳이 누락** — `startHandoff`(`src.inflight` only), `useChatSessionsSync`, `ProjectLandingPage` | `chatStore.ts:613,878` · `Composer.tsx:85` · `ChatTile.tsx:55` · `useCompletionNotifier.ts:17` |
| main 은 listen 턴을 activeTurns 에 **세지 않는데**(`request.listen !== true` 가드) renderer 의 동시성 표기는 `listening` 포함 `inflight` 로 뺄셈 — 같은 규칙이 한 핸드오프 안에서 반대로 이동 | `turn-coordinator.ts:243,387` ↔ `Composer.tsx:122` |
| `settings.general.density{Compact,Normal,Comfortable}` 3키가 `debug.density*` 와 **값 바이트 동일**, 둘 다 같은 `t.density` Tweak 을 구동 | `ko.ts:342-345` ↔ `ko.ts:711-713` · `GeneralTab.tsx:27-29` · `DebugPanel.tsx:85-87` |
| `ComposerInputSurfaceHandle.element` getter 는 삭제된 `HighlightedTextareaHandle` 잔재 — 신규 컨트롤러는 `focus()`/`setSelectionRange()` 만 호출, `.element` 접근 grep 0건(테스트 포함) | `ComposerInputSurface.tsx:34,65-67` ↔ `ComposerInputController.tsx:130-131` |
| `useAttachments.reset()` 은 composer 가 `resetIfUnchanged()` 로 전환하며 **유일 호출자 소멸** | `useAttachments.ts:19,158-161,184` ↔ `ComposerInputController.tsx:246` |
| `TurnRequest.listen` 이 `adapters/` 에 있으면서 주석이 "어댑터는 이 필드를 결코 보지 않는다" 라고 명시 — 소비자는 전부 상위 계층이고, 생성부는 spread 후 4개 필드를 `delete` | `adapters/turn.ts:156` · `chat-turn.ts:843-853` · `session-runtime.ts:201` · `turn-coordinator.ts:214,235,243,387` |
| `stripMessageContent` 가 `wire-log.ts` 에서 export 되지만 **그 모듈 안에서 호출되지 않음** — prod 분기 호출부가 기억해서 감싼다. 같은 모듈 주석은 "필터의 단일 지점이 여기다" 라고 주장 | `wire-log.ts:37` · `handlers/misc.ts:322,340` |
| SDK 실측 `contextWindow` 가 `turn_model_usage` 에 영속되지 않아(`infra/db/types.ts` 는 `subagent_notice` 만 추가) 재로드 경로가 렌더러 하드코딩 마커 목록에 의존 — 목록에 **미출시 모델명**(`opus-4-6`·`opus-4-7`·`opus-4-8`·`fable`·`mythos`)이 들어 있다 | `contextWindow.ts:11` · `usage-map.ts` · `infra/db/types.ts` |
| `BackgroundTaskTracker.bySession` 은 `clear()` 도달 조건이 "같은 세션 재전송" 뿐 — 채널이 죽고 사용자가 그 세션에 다시 안 보내면 프로세스 수명 내내 잔존 | `background-tasks.ts:29,71-73` · `chat-turn.ts:601,826,865` |
| ABI/게이트 제약: `lint`·`typecheck` 는 ABI 중립, `npm test` 는 Node ABI 로 뒤집음. egress 403 환경에선 DB 로드 스위트만 실패하며 이는 **알려진 베이스라인** | `app/AGENTS.md` §better-sqlite3 ABI · 제약 환경 게이트 가이드 |

## 인수 기준 (Acceptance Criteria)

> 전부 동작 보존(관찰 가능 동작·렌더 DOM·클래스·a11y 속성·IPC 채널/스키마 무변경) 전제.
> 예외 2건(**AC10**, **AC12**)은 해당 항목에 명시.

### 삭제 (사용자 지시 — 미사용·레거시)

1. **AC1** — `chatStore.receive()` 의 `case 'message.delta'`/`case 'message.reasoning.delta'` 본문과
   BEGIN_TURN 술어의 delta 타입 2종 disjunct 가 삭제된다. `patchLive` 는 잔여 호출부로 생존.
2. **AC2** — 다음이 전량 삭제된다: `useAttachments.reset()`(impl+인터페이스 멤버+반환 엔트리) ·
   `ComposerInputSurfaceHandle.element`(+`useImperativeHandle` getter) · `attachmentState.ts`
   와 그 테스트(호출부 인라인) · `LogManager.debugEnabled` 필드 · `ComposerDecorationLayer.EMPTY_SET`
   기본값 · `composerScrollProjection` 의 `-0` 가드 · `turn-coordinator.stallTimerFor` export.
   각각 삭제 후 잔존 참조 grep 0건.
3. **AC3** — `settings.general.density{Compact,Normal,Comfortable}` 중복 3키가 제거되고 두 picker 가
   단일 키 집합을 쓴다(`densityDesc` 는 고유하므로 유지). 두 화면의 표시 문자열 불변.

### 수렴 (중복 제거)

4. **AC4** — `settleDeadBackgroundTasks`/`stopAndSettleAbortedTasks` 가 `features/chat/settle.ts` 의
   단일 `settleTasksAs(...)` 로 통합되고, `chat-turn.ts` 는 옵션 리터럴만 넘긴다. 합성 settled
   이벤트 shape·emit 순서(`settleSubagentTask` → `emitTurn`)는 양 경로 동일.
5. **AC5** — `pickPrimaryModel()` 이 `shared/usage/` 에 신설되어 `claude-map`·`usage-map` 양쪽이
   호출한다. 라이브/재로드 `telemetry.model` 이 **같은 점수식**을 쓴다(주석의 "동형" 주장이 사실이 됨).
6. **AC6** — `async_launched` 리터럴 판별이 어댑터 1곳으로 수렴한다 — `claude-map` 이
   `tool.call.completed.asyncLaunched` 사실을 방출하고, main tracker·renderer 는 boolean 을 읽는다.
   `parts.ts` 의 인라인 사본은 같은 파일 `isAsyncLaunchedResult` 재사용으로 소멸.
7. **AC7** — `useChatBusy()` 셀렉터가 `chatStore.ts` 에 신설되어 기존 4곳이 이를 쓰고,
   **누락 3곳**(`startHandoff`·`useChatSessionsSync`·`ProjectLandingPage`)도 동일 판정으로 정렬된다.
8. **AC8** — 다음 중복이 각각 단일 소유로 수렴한다: `SubagentNoticeRow`↔`AgentTaskRow` 행 셸 ·
   `subagent_notice` 파트 조립(`chatReducer`↔`history/writer`) · `isRecord` 손수 가드 3곳 ·
   `chatStore.listen.test.ts` 하네스 · `ComposerInputController.composingRef`(스냅샷 미러) ·
   `updater-feed` provider 3분기 · `SubagentNoticeRow` 평행 Record 2개.
9. **AC9** — `BackgroundTaskPort` 가 `TurnCoordinatorDeps` 에서 **필수**가 되고 이벤트 루프의
   `?.` 6곳(+`?? false`·`=== true` 평탄화)이 사라진다.

### 효율

10. **AC10** — `BackgroundTaskTracker` 가 세션 teardown 경로에서 정리되고 `hasAny(sessionId)` 가
    `.size>0` 체크용 `new Set` 할당을 대체한다. listen 요청이 원 턴 `request` 스프레드 대신
    최소 리터럴로 조립되어 base64 첨부를 listen phase 내내 붙들지 않는다(4개 `delete` 동반 소멸).
    `settleStaleAsyncLaunchParts` 는 대상 `tool_call` 부재 시 조기 반환하고,
    `SubagentNoticeRow` 는 세션 전체 스캔 대신 대상 `toolRunId` 만 조회한다.

### 구조 일반화 (사용자 명시 승인)

11. **AC11** — `receive`/`receiveDeltaBatch` 가 공용 `resolveSessionKey`·`beginTurnIfIdle` 를 쓴다.
    ⚠️ **동작 변화(의도적)**: 0143 의 `parentToolRunId` 가드가 라이브 delta 경로에 처음 실효되어,
    listen 대기 중 백그라운드 child 스트림이 메인 inflight 를 점멸시키지 않는다 — **0143 이 문서로
    선언했으나 코드에 닿지 않았던 의도의 복원**. verify 에 별도 증거 항목으로 기재한다.
12. **AC12** — redaction 이 sink 내부로 이동한다(`setWireSink(sink, {redact})` → `wireLog` 가
    dispatch 전 적용). 두 분기의 레코드 키도 통일된다. prod 로그에 대화 텍스트 미기록이 **호출부
    기억이 아니라 모듈 불변식**이 된다.
13. **AC13** — IME 가드가 `draftSnapshot` 순수 변이 함수로 내려가(`snapshot.composing` 이면 원본
    반환, 기존 revision 가드와 동형) 컨트롤러에는 DOM 부수효과 가드만 남는다(9곳 → ~2곳).
14. **AC14** — `TurnRequest.listen` 이 `adapters/` 에서 제거되고, 턴 종류가
    `TurnKind = 'user'|'continuation'|'listen'` 로 코디네이터 옵션에 올라가 `turnPolicyFor(kind)`
    단일 지점이 stall 무장·activeTurns 계수를 결정한다.
15. **AC15** — `turn_model_usage.context_window` 컬럼이 신규 마이그레이션으로 추가되고, usage
    tracker 가 기록·`usage-map` 이 재생한다. `WINDOW_1M_MARKERS` 의 **미출시 모델명 추측 목록**이
    제거되고 `contextWindowFor` 는 mock/무-telemetry 폴백으로 축소된다.
    ⚠️ **스키마 변경** — 마이그레이션 파일은 append-only(머지 후 수정 금지).

### 게이트

16. **AC16** — `npm run lint` 0 error(레이어 경계 위반 0) · `npm run typecheck` 3분할 0 ·
    순수 vitest green. DB 로드 스위트 실패는 better-sqlite3 ABI egress-403 **베이스라인으로 분리
    보고**. 신규 의존성 0 · IPC 채널/스키마 무변경(AC15 의 DB 컬럼은 IPC 아님).

## 범위 / 비범위

- **범위**: 위 인수 1~16 (삭제 9건 · 수렴 13건 · 효율 4건 · 구조 5건).
- **비범위 (기록만)**:
  - **post-turn 루프 전체 이관** — `chat-turn.ts` 의 ~160줄 턴 정책(루프 본체·`listenRelease` Map)이
    컴포지션 루트에 산다(`src/main/AGENTS.md`: app/=배선만). 이관하려면 `makeContinuationTurn`·
    `supervisor.startResume/release`·provider 신선도 재해석이 함께 움직여야 해 **별도 핸드오프**로
    미룬다. 단 settle 헬퍼 2개는 이번에 `settle.ts` 로 옮긴다(AC4).
  - **DebugPanel 밀도 라디오 제거 여부** — 0132 가 설정에 같은 컨트롤을 추가해 디버그 쪽이
    레거시가 됐는지는 **제품 판단**(UI 제거는 단독 결정 금지). 사용자에게 보고만 한다.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- **신규 의존성: 없음.** 전부 기존 모듈 재배치·삭제·수렴.
- 재사용 대상 기존 자산: `shared/obj.ts isRecord` · `features/chat/settle.ts`(`settleOpenToolRuns`·
  `settleSubagentTask`) · `chatStore` 셀렉터 훅 관례(`usePendingSteer`·`useNewChatPending`·
  `useProjectConcurrencyCount`) · `shared/usage/` 순수 파생 모듈군 · `draftSnapshot` 의 revision 가드 패턴.
- 레이어 전제: `adapters/` 는 `features/` 를 import 할 수 없다 → `pickPrimaryModel` 은 `shared/usage/`
  에 두어야 한다(AC5). `shared/` 는 런타임 의존 0 이어야 한다.
- AC15 전제: 마이그레이션은 `NNNN_<name>.sql` append-only, `check-migrations-appendonly.mjs` 가 기계 강제.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **AC11 동작 변화의 가시 효과**: listen 대기 중 백그라운드 서브에이전트가 텍스트를 스트리밍해도
  메인 도넛/중단 버튼/스크롤 앵커가 점멸하지 않는다. 대기 표시는 `listening` 레벨 상태가 담당(0143 설계대로).
- **AC7 이 고치는 기존 불일치**: `startHandoff` 가 listen 대기 중에도 핸드오프를 허용하던 것이
  차단된다(main 의 턴-후 루프가 살아 있는 동안). 동시성 알림 숫자도 listen 중 오계수가 사라진다.
- **AC15 마이그레이션**: 기존 행은 `context_window` 가 NULL → `usage-map` 이 NULL 이면 기존
  폴백(`contextWindowFor`)으로 자연 강등. 과거 세션 재로드가 회귀하지 않는다.
- **AC13 IME**: 조합 중 자동완성/스킬 삽입/submit clear 가 모두 순수 함수 레벨에서 거부되므로,
  새 변이 경로가 추가돼도 가드를 잊을 수 없다. 한글/일본어 조합 중 Enter 는 기존과 동일하게 무동작.
- 테마 3종·접근성: 삭제/수렴 대상 중 시각 변경은 AC3(i18n 키) 뿐이고 문자열 값이 동일하므로 무영향.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| **AC11 은 동작 변화** — /simplify 의 동작 보존 원칙에서 벗어난다 | 사용자가 "구조 일반화까지 적용" 을 명시 승인. 변화 방향이 0143 의 **문서화된 의도** 와 일치(가드가 원래 delta 에도 걸릴 예정이었음). verify 에 단독 항목으로 증거 기재하고, 라이브 실기를 사람 확인 항목으로 남긴다 |
| **AC15 마이그레이션은 되돌리기 어려움** (append-only) | 컬럼 추가만(파괴적 변경 0), NULL 허용이라 기존 행 무영향. 계획 승인 시 마이그레이션 승인으로 간주함을 사용자에게 명시하고 진행 |
| **AC14(TurnKind)가 어댑터 계약을 건드림** — `TurnRequest` 는 포트 타입 | `listen` 은 이미 "어댑터가 보지 않는" 필드라 제거가 계약 축소(확장 아님). mock 어댑터 포함 전 구현체가 무영향인지 typecheck 로 확인 |
| 29건 일괄 적용 → 회귀 원인 추적이 어려워짐 | **Tier 별로 커밋 분리**(삭제 / 수렴 / 효율 / 구조 / 마이그레이션)해 이등분 추적 가능하게 한다 |
| egress 403 환경이라 DB 로드 스위트·electron 실기 검증 불가 | 베이스라인 분리 보고 + AC15 의 실제 마이그레이션 적용은 CI(windows-latest, egress 열림)/사람 실기로 위임 |

- **단독 결정 금지 항목** → 사용자에게: DebugPanel 밀도 라디오 제거 여부(비범위, 보고만).

## 영향 받는 파일

- renderer: `features/chat/store/chatStore.ts` · `features/chat/reducer/chatReducer.ts` ·
  `features/chat/lib/{parts,contextWindow}.ts` · `features/chat/components/transcript/{SubagentNoticeRow,AgentTaskRow}.tsx` ·
  `features/chat/components/composer/{ComposerInputController,ComposerInputSurface,ComposerDecorationLayer,composerScrollProjection,draftSnapshot}.ts(x)` ·
  `features/chat/hooks/{useAttachments,attachmentState}.ts`(후자 삭제) · `features/chat/components/{Composer,ChatTile}.tsx` ·
  `app/hooks/{useCompletionNotifier,useChatSessionsSync}.ts` · `pages/ProjectLandingPage.tsx` ·
  `shared/i18n/resources/{ko,en}.ts`
- main: `app/chat-turn.ts` · `app/handlers/misc.ts` · `features/chat/{settle,background-tasks,turn-coordinator,post-turn}.ts` ·
  `features/sessions/session-runtime.ts` · `features/usage/usage-map.ts` · `adapters/{claude-map,turn}.ts` ·
  `infra/ipc/wire-log.ts` · `infra/log/log-manager.ts` · `infra/config/orca-file.ts` · `app/updater-feed.ts` ·
  `infra/db/{types.ts,migrations/*}`
- shared: `shared/{obj,ipc}.ts` · `shared/usage/`

## 참고 문서

- `docs/handoff/0131-simplify-121-130-cleanup/plan.md` (선례 구조)
- `docs/handoff/0143-background-subagent-default/plan.md` (0135/0138 폐기 근거 · AC11 의 원 의도)
- `app/src/main/AGENTS.md` (main 레이어 DAG — AC5·AC14 배치 근거)
- `app/AGENTS.md` §빌드/실행 (ABI 중립 게이트 · egress 제약 베이스라인)
- `docs/arch/backend/persistence.md` (AC15 스키마)
- `docs/git-template.md` (커밋 trailer)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck` + `./node_modules/.bin/vitest run`(순수 스위트).
- 신규 테스트 요구: `pickPrimaryModel`(양 경로 동일 점수식) · `settleTasksAs`(두 옵션 리터럴) ·
  `turnPolicyFor`(3 kind) · `usage-map` 의 `context_window` NULL 폴백 · `draftSnapshot` 의 composing 거부.
- 기존 스위트 무수정 green 이 순수 dedup·삭제분의 회귀 가드.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 5건을 라이브 세션 출처로 인용했고, 추론은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 `파일:라인` 레퍼런스를 붙였다.
- [x] 인수 기준 — 16개 번호, 자료조사 근거, 검증 가능. 동작 변화 2건(AC11·AC15)은 ⚠️ 표기.
- [x] 의존 기술 — 신규 의존성 0 을 명시하고 재사용 자산·레이어 전제를 적었다.
- [x] 파생 UX — AC11/AC7 의 가시 효과, AC15 의 NULL 폴백, IME 엣지케이스를 펼쳤다.
- [x] 리스크 — 동작 변화·마이그레이션 비가역성·일괄 적용 추적성을 적고, Open Question(DebugPanel
      밀도)은 사용자로 분리했다.
