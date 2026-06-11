# Verify — 0008-chat-anchor-reserve

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능 = Claude 직접 구현 → 검증도 Claude (0005·0007 전례).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0008-chat-anchor-reserve` |
| 검증자 | Claude Code |
| 일자 | 2026-06-11 |
| 대상 커밋 | `e113eb4` |
| 라운드 | 1 |
| 상태 | **PASS** |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 델타 경로 reducer 우회 — 델타 프레임에 session identity 불변 | ✅ | `store/chatStore.ts:84-92`(receive 델타 분기), `reducer/chatReducer.ts:185-187`(델타 케이스 제거 주석); 테스트 `chatStore.test.ts` "session 슬라이스 identity 는 불변"(toBe), `chatReducer.parts.test.ts` "스트리밍 델타 2종은 reducer 무변경" |
| 2 | 라이브 리프 한정 재렌더(두 스트림 격리) | ✅ | `transcript/PendingAssistant.tsx` — `LiveReasoning`(`useLiveReasoning`)·`LiveText`(`useLiveText`)·`LiveStatus` 개별 구독; 테스트 "reasoning 델타는 live.reasoning 만 갱신 — live.text 와 격리" |
| 3 | 꼬리 블록 한정 재파스 + 보수적 경계 | ✅ | `markdown/StreamingMarkdown.tsx`, `lib/markdownBlocks.ts`; 테스트 7건(`markdownBlocks.test.ts` — 펜스/loose list/들여쓰기/미확정 경계/append-stable) |
| 4 | 커밋 경로 카드 격리(reconcile + memo) | ✅ | `lib/parts.ts reconcileSegments`, `AssistantMessage.tsx:30-33`(prevRef reconcile), `ToolGroup/ToolCard/ReasoningBlock/AskExchange` memo; 테스트 `parts.reconcile.test.ts` "t1 만 새 객체, t2 는 identity 재사용" |
| 5 | 턴 폴백 보존(COMMIT_PENDING_TEXT / error 폐기) | ✅ | `chatStore.ts:97-110`(telemetry 폴백)·`:112-116`(error 폐기), `chatReducer.ts` COMMIT_PENDING_TEXT 케이스; 테스트 chatStore 2건 + reducer 1건 |
| 6 | CSS 예약공간(Exchange + 50cqh) + 구 spacer 일체 삭제 | ✅ | `lib/turns.ts groupExchanges/exchangeEquals`(+테스트 5건), `transcript/Exchange.tsx`(`min-h-[50cqh]`), `TranscriptView.tsx`(`[container-type:size] [overflow-anchor:none]`); `git grep data-app-user-turn\|spacerRef\|lastUserTop app/src` = 0건 |
| 7 | 앵커/세션 판정 정확성(sendCount / sessionId∧messages) | ✅ | `chatReducer.ts` sendCount(+테스트), `hooks/useScrollAnchor.ts:120-127`(sessionSwapped = sessionId 변화 ∧ messages 교체 — session.updated null→id 예약 유지 주석 포함) |
| 8 | pin-follow(RO, pinned∧inflight 게이트) + scrollend 억제 | ✅ | `useScrollAnchor.ts:96-109`(ResizeObserver)·`:80-88`(scrollend)·`:60`(programmatic showJump 가드) |
| 9 | selector 구독 전환(UseChat/useChatContext 폐기, RouteSync imperative read) | ✅ | `grep useChatContext\|UseChat\b src` = 0건; `useChatRouteSync.ts:39`(getState() imperative), Composer/PlanTile/ApprovalCard/ChatTitleBar/페이지/셸 훅 전환, `providers/ChatProvider.tsx` 부트스트랩 전용 |
| 10 | 순수 reducer 보존 + 기존 테스트 green | ✅ | `chatStore.ts dispatch` 래퍼(`session: chatReducer(...)`); reducer 테스트 5파일 포함 전체 315 통과 |
| 11 | 게이트 + boundaries 0 + 신규 의존성 zustand 1개 | ✅ | 아래 "게이트 재실행". `package.json` diff = `zustand@^5` 단일 추가(사용자 지시로 승인) |
| 12 | 문서 정합 | ✅ | `rendering.md` §1.2·§1.8 재서술, `state.md` §1 헤더/§1.1/§1.2/§1.4(개정 명기)/§4.4.5(✅ 표기), `TRD.md` §4 상태관리 행 + 정책 문구 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 통과(아래) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 12/12 |
| 레이어 경계 위반 0 | ✅ | — | eslint(boundaries) 통과 — 신규 파일 전부 `features/chat` 내부 + `shared/ui` 1건 |
| 문서 형식/링크/한국어 | ✅ | — | 통과 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 변경 없음 |
| 제품 의도 부합(앵커 위치·여백 정책) | ✖ 보조 | ✅ 결정 | 사용자 결정 반영(미드라인·다음 메시지까지 유지) — 시각 확인 대기 |
| Open Questions | ✖ | ✅ | 해당 없음(§15 미접촉) |
| UI/UX 시각 검증(앵커 smooth·fill 정지·무점프 전환·세션 전환·pin 해제 버튼) | ✖ | ✅ | **사람 확인 대기** |
| 재렌더 계측(DevTools profiler / CDP rAF — plan 검증 §3) | △ 단위테스트로 identity 경계만 확인 | ✅ 실측 | **사람(또는 후속 CDP 세션) 확인 대기** — 본 환경은 headless 라 0007 식 CDP 측정 불가 |
| 신규 의존성 승인(zustand) | ✖ 제안 | ✅ | 사용자 지시("zustand 도입을 고려하여 아키텍처를 확장하라")로 승인 처리 |
| PR 머지 승인 | ✖ | ✅ | draft PR 로 제출 |

## 게이트 재실행 결과

```
$ cd app && npm run lint && npm run typecheck && npm test
lint: eslint --cache --fix ./src        → 통과(에러 0)
typecheck: tsc node + web               → 통과
test: vitest run                        → Tests 315 passed (315)
$ npx electron-vite build               → ✓ built (renderer/main/preload)
```

(0007 비고의 better-sqlite3 ABI 실패 7건은 본 환경에서 미재현 — 전체 green.)

## 위생 검토

- AGENTS.md 변경 없음. 신규 문서/코드에 키/토큰/이메일/IP 패턴 없음(grep).

## PHASES.md 정합성

- "현재 작업 중" = 보드 링크만(형식 유지). 본 verify 커밋에서 0008 행을 페이즈 표로 승격.

## 결론 / 다음 단계

- **PASS** — INDEX `verify/PASS`, PHASES 승격, draft PR 제출.
- 사람 확인 대기 항목: ① 스트리밍 앵커/예약공간 시각 검증(전송 앵커 smooth, fill 중 정지, 짧은 답변 후 무움직임, 다음 전송 무점프, 세션 전환 여백 0) ② 델타 프레임 재렌더 실측(DevTools profiler — 목표: LiveText/LiveReasoning 만) ③ `container-type:size`+cqh 실기 동작(문제 시 plan 의 `--transcript-h` 변수 폴백).
