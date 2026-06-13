# Plan — 0013-renderer-multisession-store

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능(리팩토링·구조 전환) 작업 — Claude 직접 구현. 사용자 결정(2026-06-11): 멀티세션 외피까지 포함.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0013-renderer-multisession-store` |
| 작성자 | Claude Code |
| 일자 | 2026-06-11 |
| 매핑 | 단계적 아키텍처 리팩토링 스테이지 3/3 (프론트엔드) |
| 상태 | READY |

## Context (왜)

- chat 만 Zustand(0008), **Backend/Sessions/Projects/Cost 는 Context 4단 중첩** — 어느 한 값이 바뀌면 하위 서브트리 전체가 재렌더 후보가 된다. state.md §1.4 의 확정 결정("단일 root + sessions Record, 전역 슬라이스 흡수")이 Phase 4 와 묶여 미뤄져 있었다.
- chatStore 가 단일 `{session, live}` 외피라 **비활성 세션의 백그라운드 스트리밍이 구조적으로 불가** — 스테이지 1(0011)에서 main 의 턴 레지스트리는 이미 sessionId 키잉으로 전환됐고, 와이어(`NormalizedEvent`)는 전 variant 가 sessionId 를 보유한다. renderer 외피만 남았다.
- `useChat` 시절의 `sessionCache`(snapshot Map)는 sessions Record 가 자연 흡수 가능한 중복 캐시 계층.

## 인수 기준 (Acceptance Criteria)

1. `chatStore` 외피 전환: `{ sessions: Record<key, { session: ChatState; live: LiveTurnState }>; activeKey }`. 새-채팅 키 `__new__` → `session.updated` 시 sessionId 키로 승격(main TurnRegistry 와 대칭). `chatReducer` 는 **무변경 시그니처의 세션-단위 순수 함수로 유지** — store 가 키 라우팅을 담당(state.md §1.4 의 "액션에 sessionId 인자" 대안, 문서 개정 포함).
2. `receive(ev)` 가 `ev.sessionId` 로 해당 엔트리에 라우팅 — **비활성 세션 이벤트(델타 포함)가 백그라운드 누적**되고 활성 UI 재렌더를 깨우지 않는다. sessionId 없는 이벤트는 활성 엔트리 폴백, 미지 sessionId(엔트리 삭제 후 도착)는 폐기.
3. `sessionCache`(snapshot/restore) + `LOAD_SESSION_FROM_CACHE` 액션 + `CachedSession` 타입 폐기 — sessions Record 가 캐시 역할 흡수(재진입 IPC 생략 동작 보존). 세션 전환 시 coalescer dispose 제거(전역 FIFO — 키 라우팅이 스테일 오염을 방지).
4. selector 훅(`useChatSession`/`useLiveText`/`useLiveReasoning`)과 `chatActions` 시그니처 보존 — transcript/Composer 등 소비 컴포넌트 무변경. `useChatRouteSync` 의 imperative read 는 활성 엔트리 헬퍼로 교체.
5. Backend/Sessions/Projects/Cost 4개 Context 제거 → 각 feature `store/*Store.ts`(Zustand) + bootstrap-only Provider(chat 의 0008 선례). 소비처는 selector 훅으로 전환. App.tsx Provider 체인 형태 유지(컨텍스트 값 0). TweakProvider 는 잔존(theme DOM effect — 후속 검토 명시).
6. main 보강 1건: `chat/send.ts` catch 의 error 이벤트에 `turn.dbSessionId` 부착(라우팅 정확도 — 와이어 호환 optional 필드).
7. 동작 보존: 단일 활성 세션 UX 동일(전송·전환·재진입·rename·삭제·승인 카드·plan 타일·도넛). **추가 동작**: 비활성 세션 턴이 끊기지 않고 백그라운드 누적. 동시 스트리밍 UX(배지 등)는 비범위(후속 기능 — Codex).
8. 테스트: chatStore 라우팅(델타 격리·승격·백그라운드 누적·미지 세션 폐기) + 기존 reducer/parts/coalescer 테스트 그린. `LOAD_SESSION_FROM_CACHE` 테스트는 액션 폐기와 함께 제거.
9. 게이트: lint(boundaries 0) · typecheck · test · build.
10. 문서: `arch/frontend/state.md` §1.2/§1.4(외피 완료·키 라우팅 방식 개정), `app/AGENTS.md` 메모리 캐시 서술 갱신, PHASES 행.

## 범위 / 비범위

- **범위**: renderer `features/{chat,backend,sessions,projects,cost}` + `app/hooks` + `pages` 소비처 + main 1줄 보강 + 문서.
- **비범위**: 동시 스트리밍 UI(사이드바 배지·탭), Tweaks/Skills/Agents 훅의 store 흡수(소규모·국소 — 후속), 죽은 화면 정리(사용자 결정: 유지), LRU cap.

## 설계 요점

- 키 모델: 확정 세션 = sessionId, 새 채팅 = `'__new__'` 상수. 승격은 `session.updated` 수신 시 엔트리 re-key(+활성이면 activeKey 추종) — main 의 pending 슬롯 승격과 거울상.
- 재사용: `chatReducer`(무변경 핵심), `eventCoalescer`(무변경 — 단일 FIFO 가 세션 간 순서도 보존), 기존 selector 훅 시그니처.
- 레이어: store 는 각 feature `store/` 슬롯, 셸 wiring 은 `app/hooks` 유지 — boundaries 위반 0.

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test` + `npm run build`.

---

## [Claude 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `chatStore.ts`(멀티세션 외피 재작성 — sessions Record + activeKey + 키 라우팅 + NEW_CHAT_KEY 승격 + sessionCache 폐기) · `chatReducer.ts`(LOAD_SESSION_FROM_CACHE/CachedSession/LOAD_SESSION_ERROR 폐기) · 신규 store 4종 `features/{backend,sessions,projects,cost}/store/*Store.ts` + Provider 4종 bootstrap-only 전환 + 구 훅 3종·costContext 삭제 · 소비처 12파일(selector 전환) · main `ipc/chat/send.ts`(error 이벤트 sessionId 부착) · 문서(state.md·app/AGENTS.md) |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` / `npm run build` |
| 게이트 결과 | lint ✅ / typecheck ✅ / test ✅ (354/354 — chatStore 멀티세션 라우팅 4 신규) / build ✅ |
| 비고 | reducer 는 세션-단위 순수 함수로 무변경 유지(키 라우팅은 store) — state.md §1.4 의 "액션 sessionId 인자" 안을 대체(문서 개정 포함). 코얼레서 무변경(단일 FIFO·dispose 는 언마운트만). |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `bce274f` |
