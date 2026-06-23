# Plan — 0043-plan-comment-annotations

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 커밋 trailer 는 [`../git-template.md`](../git-template.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0043-plan-comment-annotations` |
| 작성자 | Claude Code |
| 일자 | 2026-06-23 |
| 매핑 | PHASES "현재 작업 중" / PR (구현 후) |
| 상태 | DRAFT → READY |
| 구현 주체 | **Codex** (신규 기능) |

> **번호 주의**: 로컬 최신 핸드오프는 `0040`. `0041`/`0042` 는 병행 웹 세션이 선점(in-flight). 사용자가 명시적으로 **0043** 지정.

## Context (왜)

우측 계획 패널(`PlanTileContent`)에는 이미 **"텍스트를 선택해 Claude에게 의견을 남기세요"** 안내가 박혀 있으나 실제 코멘트 기능은 없는 **스텁** 상태다. 사용자 요청(첨부 2장 = Claude Code 웹의 plan 코멘트 UX 재현):

1. 우측 계획 패널 본문에서 **드래그 선택 → 의견 작성 장치(미니 컴포저)** 가 선택 영역 근처에 뜬다.
2. 의견 작성 후 **선택 텍스트에 밑줄 하이라이트** + **컴포저 영역에 카드로 표시**.
3. 하이라이트/카드 **클릭 → 직전 작성 메시지 출력 + 편집 가능 + 삭제 메뉴**.

**사용자 확정 2건** (AskUserQuestion, 2026-06-23):

- **전송까지 포함** — 메시지 전송 시 의견들을 인용 블록(선택 텍스트 + 의견)으로 묶어 함께 전송하고, 전송 후 의견·하이라이트를 비운다. (기능이 dead-end 가 되지 않도록.)
- **세션 메모리(transient)** — 의견은 `planContent` 와 동일 수명(렌더러 메모리). **DB/IPC 변경 없음.** Claude Code 웹의 staging 동작과 동일.

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조한다.

1. 우측 계획 패널 본문에서 텍스트를 드래그 선택하면 선택 영역 근처에 **의견 작성 장치**(입력 + "댓글" 제출 버튼)가 뜬다. 빈/접힌 선택에서는 뜨지 않는다.
2. 의견을 작성·제출하면 선택한 텍스트 범위에 **밑줄 하이라이트**가 적용되고, 계획 본문 스크롤·재렌더 후에도 유지된다.
3. 작성한 의견이 **컴포저 영역(패널 스택)에 카드**로 표시된다 — 인용 텍스트 + 의견 본문.
4. **하이라이트 또는 컴포저 카드를 클릭**하면 직전에 작성한 의견이 출력되고 **편집 가능**하며, **삭제 메뉴**를 제공한다. 삭제 시 하이라이트와 카드가 함께 제거된다.
5. **메시지 전송 시** 작성된 의견들이 인용 블록(선택 텍스트 + 의견)으로 본문에 묶여 함께 전송되고, **전송 후 의견·하이라이트가 비워진다**. 의견이 하나라도 있으면 입력란이 비어 있어도 전송 가능하다.
6. 의견은 **세션 메모리(`ChatState.planComments`)** 에 보관되며 **새 계획 도착·세션 전환·새 대화 시 비워진다**. DB·IPC 채널 변경이 없다.
7. 신규 reducer 액션(add/update/delete/clear) + 순수 헬퍼(`buildPlanFeedback`)에 **단위 테스트** 동반. 게이트 4종(lint/typecheck/typecheck:test/test) green, **레이어 경계 위반 0**, **신규 의존성 0**.

## 범위 / 비범위

- **범위**: `features/chat` 렌더러 내부 한정 — 선택 캡처·밑줄 하이라이트·의견 작성 미니 컴포저·컴포저 영역 카드·편집/삭제·전송 시 인용 묶음·세션 메모리 상태(리듀서/스토어). `shared/ui`(`Popover` 등) 재사용.
- **비범위**: DB 영속·신규 IPC 채널·transcript 영속 표시·여러 계획 타일 동시 코멘트(활성 계획 1개 기준)·겹치는 선택 영역 코멘트·코멘트 스레드/답글·키보드 기반 선택 접근성(마우스 드래그 우선, a11y 보강은 후속). 백엔드 어댑터/`send.ts` 변경 없음(전송 본문 합성은 렌더러에서).

## 설계

### 상태 — `features/chat/reducer/chatReducer.ts` + `store/chatStore.ts`

- `ChatState` 에 `planComments: PlanComment[]` 추가, `initialChatState` 에 `[]`.
- 타입:
  ```ts
  export interface PlanComment {
    id: string        // crypto.randomUUID()
    start: number      // 렌더된 계획 컨테이너 flat textContent 기준 시작 오프셋
    end: number        // 끝 오프셋 (exclusive)
    quote: string      // 선택된 렌더 텍스트 (카드 표시 + 전송 인용용)
    body: string       // 사용자 의견
    createdAt: number
  }
  ```
  > `start`/`end` 는 **렌더 DOM 기준 문자 오프셋**이다 — 선택·하이라이트·전송 인용 모두 렌더 텍스트를 쓰므로 마크다운 source 역매핑이 불필요하다.
- 액션: `ADD_PLAN_COMMENT(comment)` / `UPDATE_PLAN_COMMENT(id, body)` / `DELETE_PLAN_COMMENT(id)` / `CLEAR_PLAN_COMMENTS`.
- **수명**: `planContent` 를 비우거나 교체하는 모든 지점에서 `planComments` 도 함께 비운다 — 새 `plan_review` 도착(새 계획), 세션 전환, 새 대화. 전송 성공 후 `CLEAR_PLAN_COMMENTS`.
- `chatActions` 에 `addPlanComment`/`updatePlanComment`/`deletePlanComment`/`clearPlanComments` dispatch 래퍼.

### 하이라이트 + 클릭 — `PlanTileContent.tsx` + 신규 `hooks/usePlanCommentHighlights.ts`

- **채택: 렌더 후 span 데코레이션.** 밑줄과 클릭(hit-test)이 둘 다 실제 DOM 요소를 요구하므로, paint-only 인 CSS Custom Highlight API 는 비채택.
- `Markdown` 은 `memo(source)` 라 동일 `planContent` 에 대해 마크다운 서브트리를 재조정하지 않는다 → 수동 데코레이션이 React 에 클로버되지 않는다(전제).
- 신규 hook `usePlanCommentHighlights(containerRef, planContent, comments, handlers)`:
  - `useLayoutEffect([planContent, comments])` 에서:
    1. 기존 하이라이트 span 언랩(`span.replaceWith(...span.childNodes)`) 후 `container.normalize()` 로 텍스트노드 병합.
    2. `document.createTreeWalker(container, NodeFilter.SHOW_TEXT)` 로 flat 오프셋 인덱싱.
    3. 각 코멘트 `[start, end)` 구간의 경계 텍스트노드를 `splitText` 로 분할하고 해당 텍스트노드들을 `<span data-comment-id={id} class="…밑줄…">` 로 래핑.
  - **선택 캡처**: 컨테이너 `mouseup` → `window.getSelection()` 이 컨테이너 내부 단일 range 면 flat `start`/`end` + `selection.toString()`(quote) 산출 → 의견 작성 장치를 선택 rect(`range.getBoundingClientRect()`) 앵커로 표시. 빈/접힌 선택은 무시.
  - **클릭**: 컨테이너 클릭 위임 → `closest('[data-comment-id]')` 으로 코멘트 식별 → 해당 코멘트로 작성 장치를 편집 모드로 오픈.
- 그룹 스코프 격리: 하이라이트 hover 가 필요하면 `group/plan-comment` 사용(`app/AGENTS.md` 규칙).
- 밑줄·hover 색은 시맨틱 토큰 사용(필요 시 `styles/tokens.css @theme` 에 토큰 추가 + 3테마 스코프 모두 채움).

### 의견 작성 장치 — 신규 `rightpanel/PlanCommentPopover.tsx`

- `shared/ui/Popover`(또는 floating) 로 선택 rect/span 앵커. 입력 + **"댓글"** 제출 버튼.
- 편집 모드: 기존 `body` 프리필 + **"삭제"** 메뉴. 제출 시 `addPlanComment`/`updatePlanComment`, 삭제 시 `deletePlanComment`.

### 컴포저 영역 표시 — 신규 `composer/PlanCommentCard.tsx` (+ 트레이)

- `Composer.tsx` 의 패널 스택(`flex flex-col gap-2`, line ~410) 안 — Notice 뒤, 입력/승인 분기 앞 — 에 코멘트 카드 리스트를 렌더.
- 카드 = 인용 텍스트 + 의견 본문. 클릭 시 편집 affordance(작성 장치 재오픈 또는 인라인) + 케밥/**삭제** 메뉴.
- `useChatSession((s) => s.planComments)` 로 구독.

### 전송 묶음 — `Composer.submit()` + 신규 `lib/planComments.ts`

- 순수 헬퍼 `buildPlanFeedback(comments: PlanComment[]): string` — 각 의견을 인용 블록으로:
  ```
  > {quote}
  사용자 의견: {body}
  ```
  여러 건은 빈 줄로 구분. 단위 테스트 대상.
- `submit()`: `planComments.length > 0` 이면 `buildPlanFeedback(comments)` + 사용자 draft 를 합성해 `chatActions.send(text, items, views)` 호출 → 성공 시 `chatActions.clearPlanComments()`.
- 전송 활성 조건 보강: `draft.trim() !== '' || planComments.length > 0`.
- **`send.ts`/IPC/어댑터 무변경** — 본문 합성은 렌더러에서만.

### 재사용할 기존 함수·유틸·파일 경로

- `useChatSession` / `chatActions` (`features/chat/store/chatStore.ts`) — 구독·디스패치.
- `Markdown`(`shared/ui/markdown/Markdown.tsx`, memo 안정), `Popover`(`shared/ui/Popover.tsx`), `Button`/`Icon`(`shared/ui`).
- 컴포저 패널 스택 + Notice/AskUserQuestionCard 카드 패턴(`Composer.tsx`).
- 그룹 스코프 격리 규칙(`app/AGENTS.md`).

### 레이어 경계 준수

- 전부 `features/chat` 내부 + `shared/ui` 하향 의존만. cross-feature import 없음. IPC/DB/신규 의존성 0.

## 영향 받는 파일

- 수정: `app/src/renderer/src/features/chat/reducer/chatReducer.ts`
- 수정: `app/src/renderer/src/features/chat/store/chatStore.ts`
- 수정: `app/src/renderer/src/features/chat/components/rightpanel/PlanTileContent.tsx`
- 수정: `app/src/renderer/src/features/chat/components/Composer.tsx`
- 신규: `app/src/renderer/src/features/chat/hooks/usePlanCommentHighlights.ts`
- 신규: `app/src/renderer/src/features/chat/components/rightpanel/PlanCommentPopover.tsx`
- 신규: `app/src/renderer/src/features/chat/components/composer/PlanCommentCard.tsx`
- 신규: `app/src/renderer/src/features/chat/lib/planComments.ts` (+ `planComments.test.ts`)
- 신규: `app/src/renderer/src/features/chat/reducer/chatReducer.planComments.test.ts`
- (필요 시) `app/src/renderer/src/styles/tokens.css` — 하이라이트 토큰(3테마 스코프)

## 참고 문서

- `docs/arch/frontend/state.md` — chatStore/리듀서 상태 관리.
- `docs/arch/frontend/dom-architecture.md` — DOM 마커·`app-frame-*` 컨벤션.
- `docs/arch/frontend/layers.md` — 4-layer 경계.
- `app/AGENTS.md` — 그룹 스코프 격리·스타일링·단일 파일 분해 가이드.
- 선행 핸드오프: `0022`(컴포저 패널 스택), `0034`/`0035`(우측 패널 타일).
- **IPC 변경 없음** → `docs/IPC_CONTRACT.md` 갱신 불필요.

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm run typecheck:test && npm test`.
- 신규 테스트:
  - `chatReducer.planComments.test.ts` — ADD/UPDATE/DELETE/CLEAR + 새 계획 도착·세션 전환 시 `planComments` 비움.
  - `planComments.test.ts` — `buildPlanFeedback` 단건/복수건/빈 배열 포맷.
  - UI(선택 캡처·하이라이트 DOM·미니 컴포저·전송 묶음)는 시각 검증으로 갈음(`app/AGENTS.md` §4).

---

## [Codex 기입] 구현 체크리스트

- [ ] `ChatState.planComments` + `PlanComment` 타입 + 4 액션 + 수명 비움(새 계획/세션 전환/새 대화)
- [ ] `chatActions` add/update/delete/clear 래퍼
- [ ] `usePlanCommentHighlights` — 선택 캡처 + span 데코레이션 + 클릭 위임
- [ ] `PlanCommentPopover` — 작성/편집/삭제 미니 컴포저
- [ ] `PlanTileContent` 와이어링(컨테이너 ref + hook + 팝오버)
- [ ] `PlanCommentCard` + 컴포저 패널 스택 렌더
- [ ] `buildPlanFeedback` + `Composer.submit()` 전송 묶음 + 전송 후 clear + 활성 조건 보강
- [ ] 단위 테스트(reducer + `buildPlanFeedback`)
- [ ] 게이트 4종 green · 레이어 경계 0 · 신규 의존성 0

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `typecheck:test` / `test` |
| 게이트 결과 | lint ✅ / typecheck ✅ / typecheck:test ✅ / test ✅ (N passed) |
| 블로커 / 역질문 | (없으면 "없음") |
| 대상 커밋 | `<hash>` |
</content>
</invoke>
