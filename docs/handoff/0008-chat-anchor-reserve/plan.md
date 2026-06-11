# Plan — 0008-chat-anchor-reserve

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능(성능·리팩토링) 작업 = Claude 직접 구현 (0005·0007 전례).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0008-chat-anchor-reserve` |
| 작성자 | Claude Code |
| 일자 | 2026-06-11 |
| 매핑 | PHASES "현재 작업 중" → verify PASS 시 승격 |
| 상태 | READY (Claude 직접 구현) |

## Context (왜)

직전 구현(구 `ChatTile.tsx` spacer)은 매 델타 프레임마다 JS 가 `querySelectorAll`+`getBoundingClientRect` 측정으로 예약공간 높이를 DOM 직접 제어하는 임시방편이었고, 델타 경로(reducer `pendingDelta`/`pendingReasoning` → Context 전파)와 커밋 경로(마지막 message identity 교체 → 턴 전체 재렌더: 메시지 내 모든 세그먼트·ToolCard·Markdown)는 레거시였다. 특히 ① reasoning 델타가 본문 `Markdown(pendingDelta)` 전체 재파스를 유발하고 ② 본문 델타가 누적 전문을 매 프레임 재파스(O(n²) 누적)하며 ③ `tool.call.*` 1건이 형제 카드 전부를 재렌더했다.

사용자 확정 결정: **앵커 = 50% 미드라인 유지** · **여백 회수 = 다음 메시지까지 유지** · **Zustand 도입 고려 아키텍처 확장** (state.md §1.4 시점 결정 개정 — chat 스코프 선행, 2026-06-11).

## 인수 기준 (Acceptance Criteria)

1. **델타 경로 reducer 우회**: `message.delta`/`message.reasoning.delta` 는 reducer 에 도달하지 않고 Zustand `live` 슬라이스만 갱신 — 델타 프레임에 `session` 슬라이스 identity 불변(단위 테스트).
2. **라이브 리프 한정 재렌더**: text 델타 → `LiveText`(+`LiveStatus`)만, reasoning 델타 → `LiveReasoning`만 구독·재렌더 — 두 스트림은 슬라이스 selector 로 격리(본문 Markdown 이 reasoning 델타에 깨어나지 않음).
3. **꼬리 블록 한정 재파스**: `StreamingMarkdown` + `splitStableBlocks` — 확정 블록은 memo 적중(append-stable: 한 번 확정된 블록 문자열 불변), 펜스/loose list/들여쓰기 코드 경계 비분할(단위 테스트).
4. **커밋 경로 카드 격리**: `reconcileSegments` 가 내용 미변경 세그먼트/ToolCall identity 를 재사용해, `tool.call.completed` 1건에 결과 도착 카드 1개만 새 identity(단위 테스트) — `ToolGroup`/`ToolCard`/`ReasoningBlock`/`AskExchange` memo 와 짝.
5. **턴 폴백 보존**: `message.completed` 없이 끝난 턴의 잔여 live.text 는 telemetry 시점 `COMMIT_PENDING_TEXT` 로 커밋, error/cancel 은 폐기(기존 동작 동형, 단위 테스트).
6. **CSS 예약공간**: transcript 를 Exchange 단위(`groupExchanges`, 경계 영원 안정 — 재부모화 없음)로 렌더, 스크롤 컨테이너 `[container-type:size]` + 라이브 전송의 마지막 교환에만 `min-h-[50cqh]`(스크롤 바닥 = 버블 미드라인). 구 spacer/`lastUserTop` 측정/`data-app-user-turn` 마커/2단 rAF 삭제.
7. **앵커/세션 판정 정확성**: 앵커 트리거 = reducer `sendCount`(SEND 단조 증가, 단위 테스트), 세션 전환 = sessionId 변화 ∧ messages 교체(session.updated 의 null→id 는 예약 유지), 로드/NEW_CHAT 시 예약 해제 + 바닥 점프.
8. **pin-follow**: fill 단계(scrollHeight 불변)엔 스크롤 JS 0, 초과 시 ReadingColumn ResizeObserver(`pinned ∧ inflight` 게이트)가 바닥 추적. `[overflow-anchor:none]`. smooth 앵커 중 "맨 아래로" 깜빡임 억제(`scrollend`).
9. **selector 구독 전환**: `UseChat` 객체/`useChatContext` 폐기 — Composer·PlanTile·ApprovalCard·ChatTitleBar·TranscriptView·페이지·셸 훅이 `useChatSession`/`chatActions` 로 좁게 구독. `ChatProvider` 는 부트스트랩 effect 전용. `useChatRouteSync` 방향 1 은 imperative `getState()` 읽기(상태 변화로 wipe 재발 금지).
10. **순수 reducer 보존**: 커밋 변경은 전부 `chatReducer`(순수) 경유 — store 는 dispatch 래퍼. 기존 reducer 테스트 5 파일 green 유지(갱신 포함).
11. **게이트**: `cd app && npm run lint && npm run typecheck && npm test` 통과, eslint-boundaries 위반 0, 신규 의존성은 `zustand` 1개(사용자 승인 — 본 지시).
12. **문서 정합**: `rendering.md` §1.2·§1.8 재서술, `state.md` §1 헤더·§1.1·§1.2·§1.4(개정)·§4.4.5, `TRD.md` §4 스택 표 갱신.

## 범위 / 비범위

- **범위**: renderer chat feature 의 상태/렌더 파이프라인 + transcript 스크롤 앵커링 + 관련 문서.
- **비범위**: 멀티세션 외피(`sessions: Record`)·전역 슬라이스(Tweaks/Backend/Skills) Zustand 흡수(Phase 4), transcript 가상화, IPC/main 변경(채널 무변경 — IPC_CONTRACT 영향 없음), PendingAssistant 외 마크다운 점진 파싱.

## 설계

상세 근거·동작 서술의 정본은 `docs/arch/frontend/rendering.md` §1.2·§1.8(본 작업으로 갱신)과 `state.md` §1.4 — 여기엔 구조 요약만 둔다.

- **chatStore** (`features/chat/store/chatStore.ts`): `session`(커밋, 순수 `chatReducer` 래핑) + `live`(`{text, reasoning}` transient). 코얼레서(기존 `eventCoalescer` 재사용)가 store 모듈 소유, `receive` 가 델타→live / 비-델타→dispatch 라우팅 + 완성/telemetry/error 의 live 클리어·커밋 폴백 오케스트레이션. 액션은 모듈 상수 `chatActions`(안정). `bootstrapChat()` 이 IPC 구독·cwd 1회를 연결(ChatProvider effect).
- **라이브 리프**: `PendingAssistant` = 정적 셸 + `LiveReasoning`/`LiveText`(`StreamingMarkdown`)/`LiveStatus` 의 개별 구독.
- **커밋 격리**: `reconcileSegments`(lib/parts.ts) + 리프 memo. parts identity 보존(`appendAssistantPart`)이 전제.
- **예약공간**: `groupExchanges`/`exchangeEquals`(lib/turns.ts) + `Exchange`(memo, `min-h-[50cqh]`) + `TranscriptView`(memo) + `useScrollAnchor`(전송 앵커·pin·RO·세션 판정).
- 레이어 경계: 전부 `features/chat` 내부 + `shared/ui/ReadingColumn`(ref prop 추가, React 19 ref-as-prop). app/pages 는 feature export(`useChatSession`/`chatActions`)만 소비.
- 폴백 (검증 중 cqh 문제 시): 컨테이너 ResizeObserver 로 `--transcript-h` 변수 기록 + `min-h-[calc(var(--transcript-h)*0.5)]`.

## 영향 받는 파일

- 신규: `app/src/renderer/src/features/chat/store/chatStore.ts`(+test) · `hooks/useScrollAnchor.ts` · `lib/markdownBlocks.ts`(+test) · `lib/parts.reconcile.test.ts` · `components/ChatTitleBar.tsx` · `components/markdown/StreamingMarkdown.tsx` · `components/transcript/{Exchange,TranscriptView}.tsx`
- 재작성: `components/ChatTile.tsx`(셸) · `components/transcript/PendingAssistant.tsx`(라이브 리프) · `providers/ChatProvider.tsx`(부트스트랩) · `components/ChatView.tsx`
- 수정: `reducer/chatReducer.ts`(+tests) · `lib/{parts,turns}.ts`(+tests) · `components/{Composer,PlanTile,ApprovalCard}.tsx` · `transcript/{AssistantMessage,AssistantTurn 무변경,UserTurn,ToolGroup,ToolCard,ReasoningBlock,AskExchange}.tsx` · `shared/ui/ReadingColumn.tsx` · `pages/{NewChatLandingPage,ProjectLandingPage}.tsx` · `app/{OverlayLayer,hooks/useChatRouteSync,hooks/useChatSessionsSync,hooks/useSessionHandlers}.tsx|ts` · `features/chat/index.ts` · `package.json`(zustand)
- 삭제: `hooks/useChat.ts`
- 문서: `docs/arch/frontend/{rendering,state}.md` · `docs/TRD.md` §4

## 참고 문서

- `docs/arch/frontend/state.md` §1.4 (Zustand 채택 — 본 작업으로 시점 개정)
- `docs/arch/frontend/rendering.md` §1.2·§1.8 (본 작업으로 재서술)
- `docs/handoff/0007-transcript-render-memo/` (선행 memo 최적화 — 본 작업이 계승)

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test`
- 신규 테스트: chatStore 라우팅 6 · markdownBlocks 8 · reconcileSegments 4 · groupExchanges/exchangeEquals 5 · reducer 갱신(델타 no-op identity / COMMIT_PENDING_TEXT / sendCount)

---

## [Claude 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 위 "영향 받는 파일" 전수 (커밋 diff 참조) |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` / `npx electron-vite build` |
| 게이트 결과 | lint ✅ / typecheck ✅ / test ✅ 315/315 / 번들 빌드 ✅ |
| 비고 | 단계 분리 커밋 계획(① store ② reconcile ③ CSS)은 컴파일 결합(ChatTile 이 reducer pending 필드를 직접 참조) 때문에 단일 구현 커밋으로 합침 — 게이트 green 상태 유지 우선. 테스트 환경에서 better-sqlite3 ABI 실패(0007 비고) 재현 안 됨(전체 green). |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `e113eb4` |
