# Verify — 0013-renderer-multisession-store (PASS r1)

> 검증자: Claude Code · 일자: 2026-06-11 · 대상 커밋: `bce274f`

## 요구사항 충족 매트릭스

| # | 인수 기준 | 판정 | 증거 |
|---|---|---|---|
| 1 | sessions Record 외피 + NEW_CHAT_KEY 승격 + reducer 무변경 키 라우팅 | ✅ | `chatStore.ts` — `ChatStoreState{sessions, activeKey}` · `promoteNewChat` · `dispatchTo`. `chatReducer` 시그니처 diff 0 (액션 3종 폐기만) |
| 2 | ev.sessionId 라우팅 — 백그라운드 누적·활성 격리·미지 폐기·무ID 폴백 | ✅ | `receive()` + 테스트 4종 (`chatStore.test.ts` "멀티세션 키 라우팅") — 활성 엔트리 identity 불변 단언 포함 |
| 3 | sessionCache·LOAD_SESSION_FROM_CACHE·CachedSession 폐기 + dispose 제거 | ✅ | grep 잔존 0. `loadSession` 이 엔트리 존재 시 activeKey 전환만(IPC 생략 보존) |
| 4 | selector/chatActions 시그니처 보존, imperative read 헬퍼 | ✅ | transcript·Composer·composer/* diff 0. `getActiveChatSession()` + `useChatRouteSync` 교체 |
| 5 | Context 4종 → store + bootstrap-only Provider | ✅ | `features/{backend,sessions,projects,cost}/store/*Store.ts` 신규, Provider 4종 ChatProvider 동형, `useBackendContext` 등 grep 0, App.tsx 무변경 |
| 6 | main error 이벤트 sessionId 부착 | ✅ | `ipc/chat/send.ts` catch — `...(turn.dbSessionId ? { sessionId } : {})` |
| 7 | 동작 보존 + 백그라운드 누적 | ✅(기계 판정 가능분) | 액션 의미 1:1 이식(주석 명시), 테스트로 라우팅 보장. UX 동일성은 사람 시각 검증 |
| 8 | 테스트 | ✅ | chatStore 10(신규 4) + 기존 reducer/parts/coalescer 그린, LOAD_SESSION_FROM_CACHE 케이스 제거 주석 |
| 9 | 게이트 | ✅ | lint(boundaries 0) ✅ / typecheck ✅ / test **354/354 (48 files)** / build ✅ |
| 10 | 문서 | ✅ | state.md §1/§1.1/§1.2/§1.4/§2 개정, app/AGENTS.md 캐시 서술, PHASES 행(검증 커밋에서 승격) |

## 검증 책임 분리

| 항목 | 에이전트 | 사람 |
|---|---|---|
| 게이트 + 인수 1:1 대조 + 레이어 경계 | ✅ 위 표 | 이견 시 중재 |
| GUI 시각 회귀 (전송·세션 전환·재진입·rename·삭제·승인 카드·plan 타일·도넛·검색) | ✖ 헤드리스 | ✅ 수동 (mock `full` 시나리오 권장) |
| 멀티세션 실기 (세션 A 스트리밍 중 세션 B 전환 → A 백그라운드 누적 확인) | ✖ | ✅ 수동 |

## 위생

- 신규 의존성 0 (zustand 기존). 비밀/개인정보 0. boundaries 위반 0.
- 알려진 한계(설계 수용): 새-채팅 턴 스트리밍 중 `/new` 재진입 시 해당 턴 뷰가 wipe 되는 기존 동작 동형(DB 영속은 보존), 동시 스트리밍 UX 는 후속 기능.
