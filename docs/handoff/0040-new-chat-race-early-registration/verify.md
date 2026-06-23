# Verify — 0040-new-chat-race-early-registration

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0040-new-chat-race-early-registration` |
| 검증자 | Claude Code |
| 일자 | 2026-06-23 |
| 대상 커밋 | `aef1d82` (코드 보유 커밋; 보고서 기재 `f6a65d7` 은 rebase 전 해시로 브랜치에 부재 — 위생 노트 ①) |
| 라운드 | 1 |
| 상태 | **PASS** |

## 요구사항 충족 매트릭스

> plan 의 12개 인수 기준을 코드·테스트로 1:1 대조. 라인은 rebase 후 현재 파일 기준.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 동시 새-채팅 비소멸(전송→새대화→전송) | ✅ | `chatStore.ts:326-355` send 가 `__new__`→`draft:uuid` 원자 re-key 로 두 엔트리 공존. 테스트 "A 미승격 상태에서 B 전송은 화면 draft 로 보존…" / "session.updated 는 pending draft 만 승격…FIFO dispatch" (chatStore.test.ts) |
| 2 | 첫 턴 사용자 버블 보존 | ✅ | send 트랜잭션이 `SEND_USER_MESSAGE` 를 re-key 와 같은 setState 로 적용(`chatStore.ts:331-336`). `newChat()` 은 `NEW_CHAT_KEY` 만 리셋해 draft 불변(`chatStore.ts:406-412`) — 소멸 경로 차단 |
| 3 | 직렬 단일 진입로(2번째는 대기) | ✅ | P 분기 `pendingNewChatKey==null` 점유 else 큐잉(`chatStore.ts:342-354`), 점유 시에만 `sendNewChatPayload`(`:356`). "연결 대기" Notice(`Composer.tsx:429-433` + `useNewChatPending` `chatStore.ts:651`) |
| 3-a | n 연속(n≥3) 순서 보존 | ✅ | 테스트 "n개 연속 새-채팅을 순서대로 하나씩 dispatch 하고 모두 승격한다" (chatStore.test.ts) |
| 4 | 불변식 ≤1 + IPC/pending 모델 무변경 | ✅ | 변경 파일에 `shared/{ipc,protocol}.ts`·preload·`IPC_CONTRACT.md` 없음(아래 위생). `turn-registry` 는 pending 모델 유지, `promote` 시그니처만 신원가드(`turn-registry.ts:88-94`) |
| 5 | 배경 승격 비간섭(activeKey/URL) | ✅ | `promotePendingNewChat` 의 `...(s.activeKey === pendingKey ? { activeKey: sessionId } : {})`(`chatStore.ts:184`) — 활성일 때만 추종 |
| 6 | init 등록(사이드바 즉시 등장) | ✅ | promote 분기 `recentsEpoch: s.recentsEpoch + 1`(`chatStore.ts:183`) → 셸 훅 `useChatSessionsSync.ts:15-17` 가 구독해 `sessionsActions.refresh()` |
| 7 | init 제목(스트리밍 병렬) | ✅ | `send.ts:361` `if (ev.type==='session.updated') titles.maybeStart(turn)` (persist 직후). `router.ts:198` `titles` 주입. 완료 시 기존 `broadcastSessionTitle`(title-generation.ts:64) |
| 8 | 멱등 + turn-end 안전망 | ✅ | `maybeStart` 가 `titleGenerationStarted`/`shouldGenerateTitle` 멱등(title-generation.ts:14-30). `persist` 의 `onTurnEnd→maybeStart` 콜백 유지(router.ts:195). resume 은 `isNewSession=false` 로 no-op |
| 9 | 데드락 0(init 전 종료 시 큐 해제) | ✅ | sessionId 없는 터미널 라우팅 `pendingNewChatKey ?? activeKey`(`chatStore.ts:220-224`) + `releaseNewChatGate`(`:257,264,271`). 테스트 "init 전 sessionId 없는 error 는 pending draft 에 라우팅하고 큐를 진행한다" |
| 10 | 회귀 0(단일/resume) | ✅ | resume 분기(`send.ts:245-261`) 무변경, 단일 새-채팅도 점유 1건 경로로 동일 동작. 게이트 471 tests green |
| 11 | 게이트 + 신규 테스트 | ✅ | lint/typecheck/test 전부 통과(아래). 신규 테스트 chatStore 7종 + turn-registry 2종 |
| 12 | resume 비간섭 승격 | ✅ | `promote(turn, sessionId)` 신원가드 `if (pendingByOwner.get(turn.owner) !== turn) return`(`turn-registry.ts:89-91`). 테스트 "resume session.updated 는 같은 owner 의 새-채팅 pending 턴을 오승격하지 않는다" |

추가 검증(설계 시 강조한 미묘점):
- **pending draft 로컬 cancel 시 게이트 미해제**(불변식 보존): `cancel()` 의 pending draft 경로는 `CANCEL_CHAT` 만 dispatch, `pendingNewChatKey` 불변(`chatStore.ts:401-403`). 테스트 "pending draft cancel 은 gate 를 해제하지 않고 실제 terminal 수신 때 큐를 진행한다" ✅
- **대기 draft cancel**: 큐+엔트리 제거, dispatch 증가 0(`chatStore.ts:387-398`). 테스트 "대기 draft cancel 은 큐와 엔트리만 제거하고 main dispatch 를 늘리지 않는다" ✅
- **기존 세션 session.updated 비승격**: `!sessions[ev.sessionId]` 가드(`chatStore.ts:214`). 테스트 "이미 존재하는 session.updated 는 pending draft 를 승격하지 않는다" ✅
- **release side effect 경계**(Issue 3): `releaseNewChatGate`/`promotePendingNewChat` 모두 `setState` 안에서 payload 캡처, `sendNewChatPayload` 는 콜백 밖(`chatStore.ts:142-153, 187-189`) ✅

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 통과(471) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 12/12 충족 |
| 레이어 경계 위반 0 | ✅ | — | lint clean(boundaries 포함); cross-feature refresh 는 셸 훅 호스트 |
| 문서 형식/링크/한국어 | ✅ | — | OK |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 변경 없음(코드+handoff 만) |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| UI/UX 시각 검증("연결 대기" Notice·n연속 전환 체감) | ✖ | ✅ | **사람 확인 대기** |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 요청 시 |

## 게이트 재실행 결과

```
$ cd app && npm run typecheck   # tsc node/web/test — 에러 0
$ npm run lint                  # eslint --cache --fix ./src — 에러 0
$ npm test                      # vitest run
  Test Files  68 passed (68)
       Tests  471 passed (471)
$ npx vitest run chatStore.test.ts turn-registry.test.ts
  Test Files  2 passed (2)
       Tests  24 passed (24)
```

> 환경: `npm ci` 후 `npm rebuild better-sqlite3`(Node ABI) 1회 — 이후 `db/queries.test.ts` 포함 전체 green(과거 0007/0009 계열의 ABI 제한 해소).

## 위생 검토

- 변경 파일: `app/src/main/ipc/chat/{send.ts,turn-registry.ts,turn-registry.test.ts}` · `app/src/main/ipc/router.ts` · `app/src/renderer/src/app/hooks/useChatSessionsSync.ts` · `app/src/renderer/src/features/chat/{store/chatStore.ts,store/chatStore.test.ts,components/Composer.tsx,index.ts}` + handoff 문서. **AGENTS.md 변경 없음** → 키/토큰/이메일/IP 스캔 N/A.
- **무변경 확인(설계 핵심)**: `shared/{ipc,protocol}.ts` · `preload/index.ts` · `shared/api/ipc.ts` · `docs/IPC_CONTRACT.md` · `turn-registry` pending 모델(슬롯 구조) — diff 부재로 확인. (`promote` 는 시그니처 신원가드만, 모델 불변.)
- **위생 노트 ①**: 구현 보고가 대상 커밋을 `f6a65d7` 로 기재했으나 rebase 후 브랜치에는 부재. 실제 코드 보유 커밋은 `aef1d82`. 또한 Codex 가 코드+문서를 단일 `docs(...)` 커밋에 번들(`AGENTS.md` 의 도메인 분리 권고와 어긋나나 기능 영향 없음). PHASES 승격 시 `aef1d82` 로 기록.

## PHASES.md 정합성

- 본 verify 후 `docs/PHASES.md` 에 0040 행 승격(대상 커밋 `aef1d82`)·`INDEX.md` `verify/PASS` 갱신.

## 결론 / 다음 단계

**PASS (r1).** 인수 기준 12/12 충족 + 설계 단계에서 강조한 미묘점(pending cancel 게이트 미해제·release side-effect 경계·기존 세션 비승격) 모두 코드+테스트로 확인. Codex 검토 7건도 전부 반영됨(특히 Issue 1 `promote` 신원가드 — resume 동시 오승격 latent 버그 차단). 게이트 4종 green(471 tests), 레이어 경계·IPC/pending 모델 무변경 확인.

- **사람 확인 대기**: 실제 GUI 에서 (a) 전송→새대화→전송 연속(n≥3) 시 화면 멀티턴 체감·소멸 0, (b) "연결 대기" Notice 노출/해제 타이밍, (c) 사이드바 init 즉시 등장·제목 in-place 갱신 시각 검증.
- 후속(비범위, plan 명시): 미승격 새-채팅 cancel→main abort, draft 구간 permission setMode 라이브 반영.
