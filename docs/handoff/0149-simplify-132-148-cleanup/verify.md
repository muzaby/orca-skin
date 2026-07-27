# Verify — 0149-simplify-132-148-cleanup

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0149-simplify-132-148-cleanup` |
| 검증자 | Claude Code |
| 일자 | 2026-07-27 |
| 대상 커밋 | `de2a600` · `0f37705` · `e72c858` · `b1eee9f` · `b80a8ef` · `e54cf35` |
| 라운드 | 1 |
| 상태 | **PASS** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 1 (AC6) — 설계의 "`tool.call.completed.asyncLaunched` 이벤트 필드 방출" 은 `NormalizedEvent` **타입 표면 확장**이라 같은 plan 의 AC16(IPC 스키마 무변경)과 충돌하고, renderer 재로드 경로는 **영속된 result 모양**을 봐야 해 플래그만으로 불완전 | **타당 — 설계 오류를 구현자가 바로잡음.** 두 근거 모두 확인했다: ① `NormalizedEvent` 는 `shared/ipc.ts` 의 IPC 계약 타입이므로 필드 추가 = 스키마 변경 ② `parts.ts` 는 DB 에서 재조립한 `ToolCall['result']` 를 보므로 이벤트 플래그가 존재하지 않는다. `shared/subagent.ts isAsyncLaunchedPayload` 수렴이 **AC6 의 의도(3중 판별 → 1곳)를 더 정확히** 달성 | 매트릭스 AC6 을 "리터럴 단일 소유" 기준으로 판정(✅). AC16 도 유지 |
| 이견 2 (AC14) — `TurnRequest.listen` 제거만으로는 런타임이 listen 프레임 진입점을 잃음 | **타당.** AC14 의 요점은 "어댑터 계약에서 **모드 플래그** 제거" 이고, `CoordinatorRuntime.listen(req)` 신설이 그 요점을 충족한다 | AC14 ✅ |
| 선조치 #1 (wire-log 테스트 재작성) | **타당·개선.** 순수 함수 직접 호출 → sink 경유 관측으로 옮긴 것이 AC12 의 취지(규칙이 모듈 불변식)를 실제로 고정한다. dev 무회귀 케이스 추가도 적절 | AC12 증거로 채택 |
| 선조치 #2 (마이그레이션 픽스처 5곳) | **타당.** 부수로 드러난 "마이그레이션 추가 시 5곳 수정" 중복은 이번 범위(0132~0148 도입분) **밖**이라 미적용이 옳다 | 파생 이슈 **D2** 로 기록(후속 후보) |
| 선조치 #3 ⚠️ (F7 트래커 회수 부분 해소) | **타당한 보고만 판정.** 완전 해소는 `RouterContext` 확장 또는 세션 삭제 버스 이벤트 신설이 필요하고, 둘 다 컴포지션 루트 구조 변경이라 "동작 보존 정리" 경계를 넘는다 — `⚠️ 보고만` 이 보수적 기본값에 맞다 | 파생 이슈 **D1** 로 이관. AC10 은 "teardown 경로 정리" 를 부분 충족으로 판정(아래 주석) |
| 선조치 #4 (밀도 i18n 방향 결정) | **타당.** 0132 가 설정을 정식 노출 지점으로 만들었고 `densityDesc` 도 그쪽에만 있으므로 설정 정본이 옳다. 표시 문자열 불변 확인 | AC3 ✅ |
| 선조치 #5 (`replaceDraft` 미사용 파라미터 삭제) | **타당.** 호출부 3곳 모두 3번째 인자를 넘기지 않음을 재확인 | AC2 범위 내 추가 삭제로 인정 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| AC1 | `receive()` 도달 불가 delta 분기 삭제 | ✅ | `chatStore.ts:381-383` 주석만 남고 `case 'message.delta'` 본문 소멸. 도달 불가 근거 재확인: `chatStore.ts` 의 `createEventCoalescer({emit: receive, emitDeltaBatch: receiveDeltaBatch})` 가 `receive` **유일 호출자**(`rg 'receive\('` → sink 등록 1건) |
| AC2 | 삭제 8종 + 잔존 참조 0 | ✅ | 삭제 파일 2(`attachmentState.{ts,test.ts}`, `git diff --diff-filter=D`). 심볼 grep: `clearAttachmentsIfUnchanged` 0 · `composingRef` 0 · `stallTimerFor`/`isAsyncLaunchResult` = **주석 언급만**(`turn-coordinator.test.ts:711,713` · `subagent.test.ts:2`, 이력 서술) |
| AC3 | 밀도 i18n 중복 3키 제거, 표시 불변 | ✅ | `ko.ts`/`en.ts` 에서 `debug.density*` 4키 삭제. 값이 바이트 동일했으므로 표시 문자열 불변. **후속(D3 결정, `bfc29bb`)**: 디버그 패널 라디오 자체를 제거해 밀도 진입점이 설정 단독이 됐다 — 이제 `settings.general.density*` 소비처는 `GeneralTab` 1곳 |
| AC4 | `settleTrackedTasks` 단일 통합 | ✅ | `settle.ts` 의 `settleTrackedTasks(turn, emit, sessionId, tracker, {status, summary, stopLive})` + 구조적 포트 `BackgroundTaskSettleSource`. `chat-turn.ts:224,238` 두 호출부가 옵션 리터럴만 전달 |
| AC5 | `pickPrimaryModel` 단일 점수식 | ✅ | `shared/usage/primary-model.ts`. `claude-map.ts:560`·`usage-map.ts:30` 양쪽 호출. 회귀 테스트 `primary-model.test.ts` — "input only 로 비교하면 뒤집히는 케이스"가 구 복원 경로 버그를 고정 |
| AC6 | `async_launched` 리터럴 단일 소유 | ✅ (설계 수정 반영) | `shared/subagent.ts isAsyncLaunchedPayload` 1곳. 소비: `turn-coordinator.ts:375` · `parts.ts:146,304` · `claude-map.ts:160`. **구현자 이견 1 채택** — 이벤트 필드 대신 shared 술어(사유는 위 표) |
| AC7 | `useChatBusy` + 누락 3곳 정렬 | ✅ | `chatStore.ts` `useChatBusy`/`sessionBusy`. 소비 7곳: `Composer.tsx:83` · `ChatTile.tsx:53` · `useCompletionNotifier.ts:17` · `chatStore.ts:613` · **신규 정렬** `startHandoff`(`sessionBusy(src)`) · `useChatSessionsSync.ts:10` · `ProjectLandingPage.tsx:33` |
| AC8 | 중복 7종 단일 소유 | ✅ | `TranscriptActionRow.tsx`(행 셸, `AgentTaskRow`+`SubagentNoticeRow` 공용) · `shared/ipc.ts subagentNoticePart` · `isRecord` 3곳(`wire-log`·`claude-map`·구 background-tasks) · `chatStore.testHarness.ts` · `composingRef` 제거 · `updater-feed.ts FEED_FIELDS` · `SubagentNoticeRow NOTICE` 단일 표 |
| AC9 | `BackgroundTaskPort` 필수화 | ✅ | `turn-coordinator.ts:105` `backgroundTasks: BackgroundTaskPort`(옵셔널 아님). `?.` 6곳 소멸 — `rg 'backgroundTasks\?\.'` → 0. `?? false`/`=== true` 평탄화도 제거(`:260,344`) |
| AC10 | 효율 4건 | ✅ (D1 잔여 명시) | `hasAny`(`background-tasks.ts:65`, 호출부 `chat-turn.ts:804`) · listen 요청 최소 리터럴(`chat-turn.ts:846-856` — 첨부 미포함, `delete` 4개 소멸) · `settleStaleAsyncLaunchParts` 조기 반환(`parts.ts`) · `subagentTaskDescription` 타깃 조회 + **동치 테스트**(`parts.test.ts`). **트래커 회수는 `onOwnerGone`(`chat-turn.ts:636`)까지만 — 세션 삭제 경로는 D1** |
| AC11 | delta 경로 공용 술어 (⚠️ 동작 변화) | ✅ | `chatStore.ts` `resolveSessionKey`·`shouldBeginTurn` 을 `receive`·`receiveDeltaBatch` 양쪽이 사용. **회귀 테스트 2건 신규**(`chatStore.listen.test.ts`) — "parentToolRunId 실린 델타도 유휴 세션의 inflight 를 켜지 않는다" / "최상위 델타는 BEGIN_TURN 을 유발한다". 변경 전이면 전자가 실패했을 테스트 |
| AC12 | redaction 을 sink 내부로 | ✅ | `wire-log.ts` `setWireSink(sink, {redact})` + `wireLog` 가 dispatch 전 적용. `stripMessageContent` **비공개화**(export 제거 — `handlers/misc.ts` import 도 제거). 레코드 키 `payload` 로 통일(구 prod `data:`). 테스트 = sink 경유 관측 |
| AC13 | IME 가드 순수 모듈 강하 | ✅ | `draftSnapshot.ts` — `replaceDraft`/`replaceDraftRange`/`clearDraftAfterAcceptedSubmit` 이 `snapshot.composing` 시 원본 반환. 컨트롤러 가드 9곳 → **2곳**(`ComposerInputController.tsx:130` focus 부수효과 + `onKeyDown` 분기). 신규 테스트 2건("조합 중 텍스트 변이 전부 거부" / "조합 종료 후 정상 적용") |
| AC14 | `TurnKind`/`turnPolicyFor` + `listen` 제거 | ✅ | `features/chat/turn-policy.ts`(순수, 테스트 동반). `adapters/turn.ts` 에서 `listen?: boolean` 삭제 — `rg 'listen' adapters/turn.ts` → 0. `SessionRuntime.listen(req)` + `CoordinatorRuntime.listen`. `turnPolicyFor` 3 kind 테스트 + "listen 턴은 send 가 아니라 runtime.listen 으로 프레임을 연다" 배선 테스트 |
| AC15 | `context_window` 영속 + 마커 축소 (⚠️ 스키마) | ✅ | 마이그레이션 `0016_turn_model_context_window.sql`(ADD COLUMN, NULL 허용) + `migrate.ts` 등록 + `types.ts` 2곳 + `queries.ts` INSERT + `subscriber.ts` 기록 2경로 + `usage-map.ts` 재생. `WINDOW_1M_MARKERS` → `['1m']`(미출시 모델명 7개 제거). NULL 폴백 테스트 유지 |
| AC16 | 게이트 green · 의존성 0 · IPC 무변경 | ✅ | 아래 "게이트 재실행 결과". `git diff app/package.json` **빈 출력**(신규 의존성 0). IPC 채널 grep 빈 출력(`CHANNELS`/`orca:` 라인 무변경) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | typecheck 0 · lint 0 error · vitest 1174/1174 · scripts 28/28 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 16/16 충족 (증거 위 매트릭스) |
| 레이어 경계 위반 0 | ✅ | — | eslint-boundaries 0 (`npm run lint` boundaries 매치 0) |
| 문서 형식/링크/한국어 | ✅ | — | plan/verify 한국어, 상대 링크 해석 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 키/토큰/이메일/IP 패턴 **0건** |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| Open Questions | ✖ | ✅ | **해결** — DebugPanel 밀도 라디오 제거로 사용자 결정(2026-07-27) |
| UI/UX 시각 검증 | ✖ | ✅ | **대기** — composer IME(한글 조합 중 자동완성/전송) · listen 대기 표시 · 도넛 분모 |
| DB 마이그레이션 실적용 | ✖(로컬 in-memory 만) | ✅/CI | **대기** — 실 설치본 `0016` 적용·기존 세션 재로드 |
| 신규 의존성 승인 | ✖ | ✅ | 해당 없음(0건) |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run typecheck
  (tsc --noEmit 3분할: node / web / test) → 0 error

$ npm run lint
  ✖ 1 problem (0 errors, 1 warning)
  # warning = src/renderer/src/features/chat/hooks/useTranscriptVirtualizer.ts:22
  #   "Compilation Skipped: Use of incompatible library" (TanStack ↔ React Compiler)
  #   → 0102 이래 알려진 베이스라인. 본 변경과 무관(해당 파일 미수정).

$ ./node_modules/.bin/vitest run
  Test Files  1 failed | 146 passed (147)
  Tests       1174 passed (1174)
  # 실패 "파일" 1 = src/main/app/chat-turn.continuity.test.ts **로드 실패**
  #   Error: Electron failed to install correctly …
  #   → egress 403 으로 electron 바이너리 미설치(ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci).
  #   app/AGENTS.md §제약 환경 가이드의 알려진 서명. **테스트 0건 실패**.
  # DB 로드 스위트(queries/migrate/writer/fork/builder)는 npm rebuild better-sqlite3
  #   (Node ABI)로 전부 green 확보 — 마이그레이션 0016 포함 실 DB 왕복 검증됨.

$ node --test "scripts/*.test.mjs"
  # pass 28  # fail 0
  # check-migrations-appendonly 포함 — 0016 은 신규 파일이라 append-only 가드 통과.
```

## 위생 검토

- 키/토큰/이메일/IP 패턴 스캔(`docs/handoff/0149-*/`): **0건**.
- 변동성/일회성 정보 혼입: plan 의 커밋 hash·게이트 수치는 *이 작업의 산출 기록*이라 적절(핸드오프 문서 성격). `AGENTS.md` 계열 문서는 **미수정**.
- `docs/arch/backend/persistence.md` 동시 갱신 — 마이그레이션 표에 `0014`·`0015`(기존 누락분)·`0016` 행 보강, `turn_model_usage` 저장 내용에 `context_window` 추가.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: 두 건이 실무에서 틀렸다. ① AC6 이 자기 plan 의 AC16(IPC 무변경)과 **자가당착**이었다 — 인수 기준끼리의 상호 모순을 self-review 체크리스트가 잡지 못했다(체크리스트에 "AC 간 충돌 없음" 항목이 없다). ② AC14 가 `TurnRequest.listen` 제거만 적고 **대체 진입점**을 설계하지 않았다. 두 건 모두 구현 턴에서 교정됐지만, 설계가 코드를 한 번 더 따라갔어야 했다.
- **설계 단계 2**: AC10 의 "세션 teardown 경로에서 clear" 가 **도달 가능성을 확인하지 않은 채** 쓰였다. `backgroundTasks` 가 `registerChatHandlers` 클로저에 갇혀 있다는 사실은 조사 단계에서 알 수 있었고, 알았다면 AC 를 부분 목표로 좁히거나 D1 을 처음부터 범위 밖으로 명시했을 것이다.
- **구현 단계**: 마이그레이션이 테스트 픽스처 5곳을 깬다는 것을 **작업 후에** 발견했다(게이트 실패로). 스키마 변경 전에 `rg 'migrations/'` 한 번이면 미리 알 수 있었다.
- **검증 단계**: AC11 은 동작 변화라 **라이브 실기가 진짜 판정**인데 여기서는 단위 테스트까지만 가능하다. "child 델타가 inflight 를 안 켠다"는 테스트로 고정했지만, listen 대기 중 실제 백그라운드 서브에이전트가 스트리밍할 때의 UX(도넛·중단 버튼·스크롤 앵커)는 사람 실기 없이는 확언할 수 없다 — 책임 분리표에 명시했다.
- **범위 판단**: 29건 중 D1 만 부분 해소로 남겼다. "과감히 삭제" 지시에 기대어 더 밀어붙일 수도 있었으나, 트래커 회수는 삭제가 아니라 **구조 확장**(컨텍스트/버스)이 필요해 성격이 다르다고 판단했다.

## 결과

**PASS (r1)** — 인수 16/16 충족. 게이트 green(typecheck 0 · lint 0 error · vitest 1174/1174 · scripts 28/28),
레이어 경계 위반 0, 신규 의존성 0, IPC 채널/스키마 무변경. 설계 오류 2건(AC6·AC14)은 구현 턴이
선조치했고 검증에서 타당 판정했다. 동작 변화 2건(AC11 델타 가드 실효 · AC15 스키마 추가)은
의도된 것이며 각각 회귀 테스트/NULL 폴백으로 방어된다.

**사람 확인 대기**: UI/UX 시각 검증(IME·listen 표시·도넛) · 실 설치본 마이그레이션 적용 · PR 머지.

**후속(같은 PR)**: D3 사용자 결정 반영 — `DebugPanel` 밀도 라디오 제거(커밋 `bfc29bb`).

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | `BackgroundTaskTracker` 회수 경로 미완 — 창 소멸(`onOwnerGone`)은 닫았으나 **세션 삭제** 시 회수가 없다. 트래커가 `registerChatHandlers` 클로저에 있어 `handlers/session.ts` 에서 도달 불가 | 구현자 코멘트 #3 (⚠️ 보고만) | 트래커를 `RouterContext` 로 올리거나 세션 삭제 버스 이벤트를 신설. 누수 규모는 세션당 `Map` 1개 + id 문자열로 작으나 단조 증가 | open (후속 핸드오프) |
| D2 | 마이그레이션 추가 시 **테스트 픽스처 5곳**(`queries`·`builder`·`chat-turn.continuity`·`fork`·`migrate` test)이 각자 마이그레이션 목록을 손으로 나열 — 새 마이그레이션마다 5곳 수정 | 구현자 코멘트 #2 (부수 발견) | 공용 `testDb()` 헬퍼가 `migrate.ts` 의 `MIGRATIONS` 배열을 그대로 적용하도록 수렴 | open (이번 범위 밖 — 0132~0148 도입분 아님) |
| D3 | `DebugPanel` 밀도 라디오가 0132 의 설정 노출 이후 중복 UI 인가 | verify r1 (제품 판단) | **사용자 결정: "밀도를 설정에만 둘 것. 디버그패널에서는 제거"** → `DebugPanel` 의 밀도 `PanelRadio` 제거(같은 커밋). `t.density` Tweak 자체와 설정 화면(GeneralTab) 노출은 불변 — 디버그 패널의 중복 진입점만 소멸. `debug.layoutSection` 섹션은 `header.collapseSidebar` 토글이 남아 유지 | **해결** |
