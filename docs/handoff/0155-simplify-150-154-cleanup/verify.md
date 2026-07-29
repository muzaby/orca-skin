# Verify — 0155-simplify-150-154-cleanup

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0155-simplify-150-154-cleanup` |
| 검증자 | Claude Code |
| 일자 | 2026-07-29 |
| 대상 커밋 | `a64c4d3` (설계 `259d2bc`) |
| 라운드 | 1 |
| 상태 | **PASS** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰 — "AC5 의 *관찰적으로 동일* 주장은 `beginListenPhase` 구현 하나에 걸려 있다" | **타당했고 해소 확인** | 발신부(`chat-turn.ts:865-869`)를 직접 재확인 — payload 는 `{type:'chat.listen', sessionId, phase}` 3필드뿐이고 큐를 읽지 않는다. 강등이 뒤로 밀려도 이벤트 내용 불변. AC5 ✅ |
| 설계 리뷰 — "`chat.residual` 자동 해제는 제품 결정이라 보고만이 맞다" | **타당** | 비범위 유지. 아래 "사람 확인 대기" + Open Question 으로 승계 |
| 놓친 문제 #1 — `remove` 위임 시 술어 2회 평가 | **기각 대상 아님(비용 동일)** | 구 `drainConfirmed` 본문도 `state === 'confirmed'` 를 `filter` 두 번 돌았다(`git show a64c4d3~1:…:281,283`). 위임 후에도 2-pass — **비용 변화 0**. 추가 조치 불요 |
| 놓친 문제 #2 — `hasSubmitted` 를 post-turn 순수 함수로 올릴 수도 있었다 | **큐 메서드 유지가 옳다** | `TrackedBatch.state` 는 큐 내부 표현이고, feature 밖으로 노출하면 `main/AGENTS.md` 수직 슬라이스 캡슐화가 깨진다. 판단 승인 |
| 놓친 문제 #3 — `sendOwnership` 얇은 클로저를 남길지 | **유지가 옳다** | 3 호출부(구 `:829`·`:836`·`:985` → 현행 `:842`·`:849`·`:998`)가 전부 같은 `wc` 스코프다. 없애면 호출부마다 `wc` 반복 — 순손해 |
| 놓친 문제 #4 ⚠️ — `chat.residual` 잔존 (결정 필요) | **사용자 결정 대기** | 파생 이슈 아님(FAIL 아님) — 본 핸드오프 비범위 표에 이미 기록됐고, 코드는 주석을 사실에 맞추는 데 그쳤다. 후속 핸드오프 후보로 결론에 승계 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `drainConfirmed` 가 private `remove()` 에 위임, 반환·잔여·키 삭제 조건 동일 | ✅ | `pending-message-queue.ts:278-280` (3줄로 축약, 구 9줄). 계약 동일성: `remove` 는 `hit.length===0` 조기반환(`:354`)·`remaining.length===0` 시 `delete`(`:356`)로 구 본문과 분기 일치. 회귀 감지 = `pending-message-queue.test.ts` 전 케이스 green |
| 2 | `disposeAll()` 이 `Set` 순회로 세션당 `dispose` 1회 | ✅ | `pending-message-queue.ts:370-374` — `new Set([...held.keys(), ...tracked.keys()])` |
| 3 | 미확정 예약 존재 판정이 배열을 만들지 않음, `submittedUuids` 존치 | ✅ | 신규 `hasSubmitted`(`pending-message-queue.ts:316-318`, `.some()`) ↔ 호출부 `chat-turn.ts:892`. `submittedUuids`(`:322-326`)는 `reconcileInterrupt`(`chat-turn.ts:806`)가 계속 사용 — `grep -c submittedUuids` = 2(정의 1·호출 1) |
| 4 | `message.submitted` 발신이 단일 함수를 지남, 빈 `ids` 무발신 유지 | ✅ | 모듈 스코프 `sendSubmitted`(`chat-turn.ts:187-198`, `if (ids.length === 0) return` 보존). 호출부 2계열 — 턴 핸들러는 `sendOwnership` 위임(`:778-780`), steerCancel 은 직접(`:1083`). `grep "type: 'message.submitted'"` = **1건**(구 2건) |
| 5 | 턴-후 루프의 `step === 'listen'` 분기 통합, 실행 순서 관찰적 동일 | ✅ | 강등이 `if (step === 'listen') { … }` 선두로 이동(`chat-turn.ts:928-932`), 구 선행 분기(구 `:891`) 삭제. 순서 안전성 근거: `beginListenPhase`(`:865-869`)는 `sendChatEvent(wc, {type:'chat.listen', sessionId, phase})` + 로컬 플래그뿐 — 큐 미참조. `git diff` 상 `step ===` 발생 3→2 |
| 6 | `residualBySession`·`closeEntry` 주석이 실제 호출 경로와 일치 | ✅ | `chat-turn.ts:232-235` — "해제 지점은 둘 — ① 영수증 clear ② chatDiscardSession"; 전 `delete` 호출부는 `:800`·`:1099` 정확히 2곳(`grep -n "residualBySession.delete"`). `runtime-pool.ts:74` — 4번째 경로("사용자 의도 폐기 close") 추가, 실제 `closeEntry` 호출부는 `:34`·`:42`·`:58`·`:66` 4곳 |
| 7 | `chatStore.send` 가 store 스냅샷 1회 | ✅ | `chatStore.ts:659-662`(`const snapshot = getState()`, `:661`) → `:674` `pendingCount: snapshot.sessions[sendKey]…`. 함수 내 `getState()` 호출 2→1 |
| 8 | `useChatResidualSteer` 가 `useChatBusy` doc 주석 블록 밖으로 이동 | ✅ | `chatStore.ts:1278-1292` — 0143/0149 busy 정의 주석 바로 아래에 `useChatBusy`/`sessionBusy` 가 복귀하고, residual 훅은 `:1294-1297` 로 자기 주석과 함께 이동 |
| 9 | 게이트 lint 0 error·typecheck 3분할 0·vitest green, 경계 0, 신규 의존성 0 | ✅ | 아래 "게이트 재실행 결과" — lint 0 error(warning 1 = 0102 TanStack Virtual 베이스라인), typecheck 3/3 통과, **vitest 149 파일 1238 테스트 전부 pass** + scripts 28/28. boundaries 위반은 lint error 로 나오며 0건. `package.json`·lock diff 0 |
| 10 | IPC 채널 수·`NormalizedEvent` variant·zod 스키마·i18n 키 불변 | ✅ | `git diff -- app/src/shared app/src/preload` = **0 라인**. 채널 리터럴 74·`NormalizedEvent` variant 16 (변경 전후 동일). i18n 리소스 파일 무변경 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 0 error(warning 1 베이스라인) · typecheck 3/3 · vitest 1238/1238 · scripts 28/28 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 10/10 충족 (증거 `파일:라인` 첨부) |
| 레이어 경계 위반 0 | ✅ | — | boundaries error 0 (신규 파일 0·import 방향 변경 0) |
| 문서 형식/링크/한국어 | ✅ | — | plan/verify 한국어·표 위주·상대 링크 해석 확인 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | **AGENTS.md 무변경** — 스캔 대상 없음 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 동작 보존 정리라 제품 의도 변경 없음 |
| Open Questions | ✖ | ✅ | `chat.residual` 해제 시점 1건 — **사람 결정 대기** |
| UI/UX 시각 검증 | ✖ | ✅ | 렌더 DOM/클래스/a11y 무변경이나 **실기 확인 대기** |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 — 승인 불요 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint
✖ 1 problem (0 errors, 1 warning)
  src/renderer/src/features/chat/hooks/useTranscriptVirtualizer.ts:22:10
  react-hooks/incompatible-library — TanStack Virtual useVirtualizer()   ← 0102 베이스라인, 본 변경 무관

$ npm run typecheck
> typecheck:node   → tsc --noEmit -p tsconfig.node.json   (0 error)
> typecheck:web    → tsc --noEmit -p tsconfig.web.json    (0 error)
> typecheck:test   → tsc --noEmit -p tsconfig.test.json   (0 error)

$ npm test
 Test Files  149 passed (149)
      Tests  1238 passed (1238)
# node --test scripts/*.test.mjs
# tests 28 / pass 28 / fail 0
```

**환경 메모.** 세션 시작 시 `app/node_modules` 가 비어 있어 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`
로 설치했고, 그 때문에 1차 실행에서 `chat-turn.continuity.test.ts` 1파일이 electron 바이너리
부재로 **로드 실패**(`app/AGENTS.md` 의 알려진 제약 서명과 동일)했다. 이 환경은 egress 가 열려
있어 `node node_modules/electron/install.js` 로 바이너리를 받은 뒤 재실행해 **149/149 파일 전부
green** 을 얻었다 — 0154 verify 의 기준선(149 파일·1238 테스트)과 **파일 수·테스트 수가 정확히
일치**하므로 본 변경으로 인한 스위트 증감이 없음이 확인된다.

## 위생 검토 (AGENTS.md 변경 시)

- **해당 없음** — 본 핸드오프는 `AGENTS.md` 를 변경하지 않았다(`git diff --name-only` 에 없음).
- 신규 문서 2건(`plan.md`·`verify.md`) 키/토큰/이메일/IP 패턴 스캔: 0건. 세션 ID 등 일회성
  운영정보 혼입 없음(핸드오프 문서는 작업 단위 기록이 정상 스코프).

## PHASES.md 정합성

- `docs/PHASES.md` Phase 4 표에 `0155-simplify-150-154-cleanup` 행 승격 (범위·커밋 `a64c4d3` 기재).
- `docs/handoff/INDEX.md` 행 `verify/PASS`·다음 주체 `—` 로 갱신.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: 자료조사가 `pending-message-queue.ts`·`chat-turn.ts` 두 파일에 편중됐다.
  0150 계열(`ApprovalCard`·`claude.ts` `updatedPermissions`)은 "이미 dedup 됨" 으로 빠르게
  판정하고 넘어갔는데, 그 판정 자체의 증거(=`PLAN_APPROVED_MODE` 3 소비처 grep)를 조사표에
  넣었어야 했다. 결과는 맞지만 근거가 Context 절에 흩어졌다.
- **구현 단계**: AC5 의 안전성 근거를 설계 시점에 확정하지 못하고 구현 턴에서 발신부를 읽어
  해소했다. 순서를 바꾸는 리팩토링은 **설계 단계에서 이동 대상의 부작용 표면을 먼저 읽는
  것**이 옳다 — 다음 정리 묶음의 개선점.
- **검증 단계**: 이번 verify 는 **동작 동등성을 기존 스위트에 위임**했다. AC1(위임)·AC5(순서)는
  기존 테스트가 실제로 그 경로를 덮는지 커버리지로 확인하지 않았고, "1238/1238 green +
  테스트 수 불변" 이라는 간접 증거에 의존한다. 구조가 아니라 *동작*을 바꿨다면 부족한 근거다
  (본 건은 동작 보존이라 허용 범위로 판단).
- **검증이 못 본 것**: `disposeAll` 의 `Set` 도입(AC2)은 종료 경로 전용이라 단위 테스트가
  직접 덮지 않는다 — 타입·lint 로만 보증된다.

## 결론 / 다음 단계

- **상태: PASS (r1)** — 인수 10/10 기계 충족. `docs/PHASES.md` 승격.
- **사람 확인 대기**:
  1. **Open Question** — `chat.residual` Notice 의 자동 해제 시점(현재는 discard 실행 또는 다음
     중단 영수증 clear 에서만 내려간다). 새 턴 시작 시 자동 해제할지, 사용자가 닫게 할지,
     현행 유지할지는 제품 결정이라 단독으로 정하지 않았다 → 결정 시 후속 핸드오프.
  2. 실기 회귀 무변경 시각 확인 — 계획 카드 '뒤로', pending 버블 "전달됨" 표기, Stop 잔여 Notice.
  3. PR 머지 승인.
- **후속 없음** — 파생 이슈(Derived Issues) 신설 대상 0건.
