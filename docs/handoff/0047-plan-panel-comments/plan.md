# Plan — 0047-plan-panel-comments

## 메타

| 항목 | 값 |
|---|---|
| slug | `0047-plan-panel-comments` |
| 작성자 | Claude Code |
| 일자 | 2026-06-25 |
| 매핑 | PHASES (PASS 후 승격) / PR (요청 시) |
| 상태 | DRAFT → READY → IMPL_DONE |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | Claude Code(웹) 우측 계획 패널처럼 **계획 본문 텍스트 드래그→코멘트 작성**, 작성 후 **밑줄 하이라이트 + composer 영역 칩 표시**, 패널 클릭 시 **직전 메시지 출력·편집·삭제 메뉴** | 라이브 세션 요청(첨부 2장 + 요구 2항) |
| 명시 결정 | ① 수명=휘발성(메모리) ② 전송=계획 revise 흐름에 묶음 ③ 활성=계획 검토 중에만 ④ 전송 포맷=`attachment.ts` 컨벤션의 **구조화 태그**(main 직렬화) | 라이브 세션 AskUserQuestion 4건 답변 |

## Context (왜)

`PlanTileContent.tsx` 에 `"텍스트를 선택해 Claude에게 의견을 남기세요"` 힌트만 있고 동작이 없다. ExitPlanMode 로 제안된 계획에 사용자가 인라인 의견을 남기고 그 의견을 모아 수정 요청으로 보내는 Claude Code 웹 기능을 동일 구현한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 계획 본문 렌더 = `PlanTileContent` + `<Markdown>`, 힌트 텍스트 존재 | `app/src/renderer/src/features/chat/components/rightpanel/PlanTileContent.tsx:25` |
| 계획 상태(`planContent`·`pendingPlanReview`)·게이트는 reducer 세션 상태. `RESOLVE_PLAN` 은 게이트만 닫고 planContent 유지 | `app/src/renderer/src/features/chat/reducer/chatReducer.ts:96,110,493` |
| 계획 게이트 UI = `PlanApprovalBody`(composer 입력 대체) + revise textarea → `revisePlan(rid, feedback)` | `app/src/renderer/src/features/chat/components/ApprovalCard.tsx:119` |
| `revisePlan` → `permissionApi.respond({behavior:'deny', message})` | `app/src/renderer/src/features/chat/store/chatStore.ts:591` |
| 어댑터가 deny message 를 `'사용자 수정 요청: ' + message` 로 재작성해 SDK 에 반환 | `app/src/main/adapters/claude.ts:148` |
| 첨부 프롬프트 직렬화 컨벤션(sentinel·attribute escaping·content 태그·neutralize·영문 instruction) | `app/src/main/prompts/attachment.ts` |
| `ApprovalResolution` 2분기 + zod 스키마(여기 `planFeedback` 확장) | `app/src/shared/ipc.ts:223` · `app/src/shared/protocol.ts:258` |
| Popover 는 anchorRef 기반(선택 rect 는 가상 앵커로 재사용) | `app/src/renderer/src/shared/ui/Popover.tsx` |
| 선례: 패널↔UI 조정용 reducer 선택 필드 `selectedSubagentTaskId` | `chatReducer.ts:107,535` |

## 인수 기준 (Acceptance Criteria)

1. `pendingPlanReview` 가 있을 때 계획 패널 본문 텍스트를 드래그하면 코멘트 작성 팝오버가 선택 위치 근처에 뜬다.
2. 코멘트 저장 시 해당 텍스트 구간에 **밑줄 하이라이트**가 그려지고, composer(계획 카드) 영역에 **코멘트 칩**이 나타난다.
3. 패널 하이라이트 또는 composer 칩을 클릭하면 직전 코멘트가 출력되고 **편집** 가능하며 **삭제** 메뉴가 있다.
4. "수정 요청 보내기" 시 코멘트가 **구조화 태그(`ORCA_PLAN_FEEDBACK`)** 로 직렬화돼 ExitPlanMode deny message 로 전달된다(main 직렬화).
5. 전송/승인/거부(`RESOLVE_PLAN`) 후 코멘트가 비워지고, 새 대화/세션 전환 시에도 초기화된다.
6. 코멘트가 없을 때 기존 승인/수정/거부 흐름은 불변.
7. 게이트(lint/typecheck/test) 통과 — `planComments`·`plan-feedback`·`protocol.permission` 단위 테스트 포함.

## 범위 / 비범위

- **범위**: 렌더러 UI(선택·하이라이트·팝오버·칩) + reducer/store 휘발 상태 + IPC `planFeedback` 계약 + main 구조화 직렬화 + 어댑터 분기.
- **비범위**: DB 영속, 승인 후 읽기전용 계획 코멘트, 멀티 계획 타일 동시 코멘트.

## 의존 기술 / 전제

- 기존: `Popover`, `Markdown`, `react-markdown`, zustand chat store, zod. **신규 의존성 0.**
- 전제: 계획 본문은 단일 스크롤 컨테이너. 오프셋은 컨테이너 `textContent` 기준.

## 설계

상세 설계는 승인된 plan 파일(`/root/.claude/plans/…`)과 동일. 핵심:
- reducer: `PlanComment[]` + `activePlanCommentId` + 액션 4종, `RESOLVE_PLAN`/초기상태에서 클리어.
- 순수 헬퍼 `lib/planComments.ts`(`segmentByComments`·`toPlanFeedback`) + DOM 헬퍼 `lib/planCommentDom.ts` + 훅 `usePlanCommentSelection`.
- 패널: `PlanCommentOverlay`(밑줄·클릭) + `PlanCommentPopover`(생성/편집/삭제, 가상 앵커 Popover).
- composer: `PlanApprovalBody` 에 코멘트 칩 + `revisePlan(rid, comments, note)`.
- main: `shared/ipc.ts`/`protocol.ts` 에 `planFeedback`, `main/prompts/plan-feedback.ts`(`formatPlanFeedbackPrompt`), `claude.ts` ExitPlanMode deny 분기.

## 파생 UX / 엣지케이스

- 빈 선택/collapsed 선택 무시. 선택이 컨테이너 밖이면 무시.
- 코멘트 0 + note 0 이면 전송 no-op. note 만 있어도 전송 허용.
- 겹치는 코멘트 구간 클램프(`segmentByComments`).
- 테마 3종 토큰 사용. a11y: 팝오버 textarea aria-label, 칩 버튼.

## 리스크 / 트레이드오프

| 리스크 | 완화책 |
|---|---|
| markdown DOM 위에 오프셋→Range 매핑 깨질 수 있음 | overlay 방식(React DOM 비침습) + `quote` 스냅샷 보존, 매핑 실패 시 해당 하이라이트만 스킵 |
| IPC 계약 확장(deny.planFeedback) | optional 필드 — 기존 `message` 경로 하위호환 유지 |

## 영향 받는 파일

플랜 파일 "변경/신규 파일 요약" 표와 동일(렌더러 8 + shared 2 + main 2 + 테스트).

## 참고 문서

- `docs/IPC_CONTRACT.md`(permission 채널 — planFeedback 은 페이로드 확장, 채널 수 불변)
- `docs/arch/backend/provider-runtime.md`(ApprovalResolution)

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: `planComments.test.ts`, `plan-feedback.test.ts`, `protocol.permission.test.ts`(보강), 리듀서 테스트.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션 요청·4건 결정 인용.
- [x] 자료조사 — 모든 발견 `파일:라인` 레퍼런스.
- [x] 인수 기준 — 번호·검증 가능.
- [x] 의존 기술 — 신규 의존성 0 명시.
- [x] 파생 UX — 빈/겹침/테마/a11y.
- [x] 리스크 — DOM 매핑·IPC 하위호환.

---

> **[구현자 기입]** (Claude=비기능/UX 직접 구현)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | shared: `ipc.ts`·`protocol.ts`(+`protocol.permission.test.ts`) / main: `prompts/plan-feedback.ts`(+test)·`adapters/claude.ts` / renderer: `reducer/chatReducer.ts`(+`chatReducer.plan.test.ts`)·`store/chatStore.ts`·`lib/planComments.ts`(+test)·`lib/planCommentDom.ts`·`hooks/usePlanCommentSelection.ts`·`components/rightpanel/{PlanTileContent,PlanCommentOverlay,PlanCommentPopover}.tsx`·`components/ApprovalCard.tsx` / docs: `IPC_CONTRACT.md` |
| 실행 명령 | `npm run typecheck` / `npm run lint` / `npm test` |
| 게이트 결과 | typecheck ✅ / lint ✅ / test ✅ **528 passed**(2 파일 `persist`·`send.runtime-resilience` 은 electron 바이너리 미설치로 import 차단=환경 제한, 변경 무관·0 test 실패). 신규 39 테스트 green. |
| 블로커 | 없음 |
| 설계 편차 | `segmentByComments`(plan 명시) 대신 DOM 오버레이(getClientRects) 채택 — 마크다운 DOM 위 밑줄을 React 비침습으로 그리고 클릭 가능하게. plain-text 세그먼트는 마크다운 구조를 보존 못해 부적합(dead code 회피로 미작성). |
| 대상 커밋 | (push 후) |
