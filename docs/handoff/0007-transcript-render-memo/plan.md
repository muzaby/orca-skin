# Plan — 0007-transcript-render-memo

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능(성능 버그) 작업 — **Claude 가 직접 구현**한다 (root AGENTS.md 구현 주체 분담 규칙).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0007-transcript-render-memo` |
| 작성자 | Claude Code |
| 일자 | 2026-06-11 |
| 매핑 | PHASES "현재 작업 중" |
| 상태 | READY |

## Context (왜)

mock 시나리오(`text_streaming`)로 스트리밍하는 동안 CDP rAF 샘플링으로 renderer 메인 스레드가
**한 번에 수백 ms(~780ms 관측) 블로킹**되는 것이 확인됐다. 원인은 델타 프레임마다 transcript
전체가 재렌더되는 것:

- `message.delta` 는 `state.pendingDelta` 만 바꾸지만(`state.messages` 참조 불변), `ChatTile` 이
  재렌더되면서 `groupTurns(state.messages)` 를 매 렌더 호출 → **매번 새 `Turn` 객체** 생성.
- `UserTurn`/`AssistantTurn`/`AssistantMessage`/`Markdown` 어디에도 메모이제이션이 없어 과거 턴
  전부가 react-markdown(unified) 재파싱을 포함해 통째로 재렌더된다.
- 이 블로킹이 `element.scrollTo({behavior:'smooth'})` 애니메이션 프레임을 굶겨 새 user 메시지
  앵커 스크롤이 점프로 보인다 (rendering.md §1.8 앵커 경로).

이벤트 코얼레서(`lib/eventCoalescer.ts`)가 델타를 프레임당 1렌더로 이미 묶고 있으므로, 남은
작업은 **그 1렌더의 범위를 "변한 것만" 으로 좁히는 것**이다.

## 인수 기준 (Acceptance Criteria)

1. `ChatTile` 이 `groupTurns(state.messages)` 를 `useMemo`(`[state.messages]` 키)로 계산해, 델타
   프레임(messages 참조 불변)에서 `Turn` 객체 identity 가 유지된다.
2. `lib/turns.ts` 에 순수 비교자 `turnEquals(a, b)` 추가 — role · startIndex · messages 길이 ·
   각 `Message` 객체 identity 를 비교한다. 단위 테스트 동반 (같은 내용/다른 identity 케이스 포함).
3. `UserTurn` 이 `React.memo` + `turnEquals` 비교자로 감싸져, turn 내용이 변하지 않으면
   재렌더되지 않는다.
4. `AssistantTurn` 이 `React.memo` + (`turnEquals` ∧ `pending` 동등) 비교자로 감싸져, 스트리밍 중
   변하지 않는 과거 턴이 재렌더되지 않는다.
5. `AssistantMessage` 가 `React.memo` 로 감싸져, 같은 턴 안에서도 변하지 않은 `Message` 는
   재렌더되지 않는다 (reducer `appendAssistantPart` 가 마지막 메시지만 새 객체로 교체하므로
   shallow 비교로 충분).
6. `Markdown` 이 `React.memo` 로 감싸져 동일 `source` 문자열 재파싱이 일어나지 않는다
   (string prop 이라 기본 shallow 비교로 충분).
7. 동작 불변 — 스트리밍 라이브 영역(`PendingAssistant`)·마지막 턴 메타 노출(`pending` 전환)·
   세션 전환·툴카드 페어링 외형이 기존과 동일하다 (기존 테스트 전부 green 으로 갈음 + CDP 재현).
8. 게이트 통과: `cd app && npm run lint && npm run typecheck && npm test`.
9. CDP rAF 샘플링(memory: orca-cdp-verification 경로)으로 **동일 트랜스크립트**에서 전/후 측정 —
   스트리밍 중 최대 rAF 간격이 유의미하게 감소함을 verify.md 에 수치로 기록한다.

## 범위 / 비범위

- **범위**: renderer transcript 렌더 경로의 메모이제이션 (`ChatTile`·턴/메시지/마크다운 컴포넌트,
  `lib/turns.ts` 비교자). 델타 적용 경로 프로파일링(전/후 수치).
- **비범위**: 가상화(`data-behavior="virtualizable"` 의 실제 구현 — Phase 4), `PendingAssistant`
  의 증분 마크다운 파싱(소스가 매 프레임 자라는 본질 비용), reducer/coalescer 변경, Composer
  리렌더 최적화, 스크롤 앵커 로직(작업 트리의 별도 미커밋 변경 — 본 작업에서 건드리지 않음).

## 설계

- **불변식 활용**: reducer 는 `message.delta` 에서 `pendingDelta` 만 바꾸고, parts 추가
  (`appendAssistantPart`)에서도 마지막 assistant 메시지 객체만 교체한다 — 과거 `Message` 객체
  참조는 항상 보존된다. 따라서 identity 기반 memo 비교가 정확하다.
- `groupTurns` 는 렌더마다 새 `Turn` 객체를 만들므로 (a) `useMemo` 로 델타 프레임 identity 를
  고정하고, (b) messages 가 실제로 바뀐 프레임(툴콜 추가 등)을 위해 `React.memo` 비교자는
  내용(`turnEquals`) 기반으로 둔다 — 두 겹이 각각 다른 프레임 종류를 커버한다.
- `Markdown` 의 `source` 는 string(값 비교)이라 기본 shallow memo 로 충분 — `messageSegments`
  가 세그먼트 객체를 재생성해도 동일 텍스트면 파싱을 건너뛴다.
- 레이어 경계: 전부 `features/chat` 내부 변경 — 경계 이동 없음.

## 영향 받는 파일

- `app/src/renderer/src/features/chat/lib/turns.ts` (+ `turns.test.ts`)
- `app/src/renderer/src/features/chat/components/ChatTile.tsx`
- `app/src/renderer/src/features/chat/components/transcript/UserTurn.tsx`
- `app/src/renderer/src/features/chat/components/transcript/AssistantTurn.tsx`
- `app/src/renderer/src/features/chat/components/transcript/AssistantMessage.tsx`
- `app/src/renderer/src/features/chat/components/markdown/Markdown.tsx`

## 참고 문서

- `docs/arch/frontend/rendering.md` §1.2 (델타 스로틀) · §1.8 (앵커/예약공간)
- `docs/handoff/0003-debug-panel-mock-adapter` (mock 어댑터 — 재현 경로)
- memory `orca-cdp-verification` (CDP 무인 검증 경로)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: `turnEquals` 순수 비교자 단위 테스트 (`lib/turns.test.ts`).

---

## [Claude 기입] 구현 체크리스트

- [x] BEFORE 측정 (코드 수정 전, mock 트랜스크립트 35턴 누적 후 rAF 샘플링)
- [x] `turnEquals` + 테스트 4건
- [x] `useMemo(groupTurns)` + 턴/메시지/마크다운 memo
- [x] (추가 발견) `useSessionHandlers` deps 안정화 + `Header` memo — 프로파일에서 Sidebar
      `SessionRow` 가 델타마다 재렌더되는 것을 확인, slot 안정화 무효화 원인 제거
- [x] 게이트 3종 (test 는 better-sqlite3 ABI 환경 이슈 7건 — 본 변경 무관, 아래 보고)
- [x] AFTER 측정 (동일 세션) + 프로파일 수치 기록

## [Claude 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `lib/turns.ts`(+test) · `ChatTile.tsx` · `transcript/{UserTurn,AssistantTurn,AssistantMessage}.tsx` · `markdown/Markdown.tsx` · `app/hooks/useSessionHandlers.ts` · `app/Header.tsx` |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` + CDP rAF 샘플링·CPU 프로파일 (memory: orca-cdp-verification 경로) |
| 게이트 결과 | lint ✅ / typecheck ✅ / test 283 passed·7 failed — 실패 7건 전부 `src/main/db/queries.test.ts` 의 better-sqlite3 네이티브 ABI(Electron 140 vs Node 127) 환경 이슈로 본 변경(renderer 순수)과 무관. PHASES "AppMessagePart persistence" 행의 동일 선례(“DB 단위 테스트는 ABI 미로드”) 있음. 신규 `turnEquals` 4건 포함 renderer 테스트 전부 green. |
| 측정 (BEFORE) | 동일 35턴 mock 트랜스크립트, `text_streaming` 1턴 스트리밍 중 rAF 최대 간격 **549 / 614ms** (50ms 초과 프레임 366~614ms ×4). CPU 프로파일: `beginWork` self 546ms — transcript 전체 재조정 + react-markdown 재파싱. |
| 측정 (AFTER, transcript memo) | 최대 **216~333ms**. 프로파일에서 markdown/shiki 소멸. 잔여 원인 추적 → Sidebar `SessionRow` 검출 (`useSessionHandlers` 가 매 렌더 새 `chat` 객체에 의존 → slot 안정화 무효). |
| 측정 (AFTER, +Sidebar/Header) | 최대 **133~166ms**. `beginWork` 상위권 소멸 — 잔여는 dev 전용 오버헤드(jsxDEV·StrictMode·createTask)와 네이티브 레이아웃/페인트로 프로덕션 빌드에서 추가 축소 예상. |
| 블로커 / 역질문 | 없음. 잔여 구조 개선(컨텍스트 셀렉터 분리)은 Phase 4 Zustand 전환과 중복이라 비범위 유지. |
| 대상 커밋 | `a68e465` (동반 스타일 커밋 `70419a6`, 어댑터 폴백 `0ec1c39`) |
