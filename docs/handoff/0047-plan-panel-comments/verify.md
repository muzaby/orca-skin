# Verify — 0047-plan-panel-comments

## 메타

| 항목 | 값 |
|---|---|
| slug | `0047-plan-panel-comments` |
| 검증자 | Claude Code |
| 일자 | 2026-06-26 |
| 대상 커밋 | `ff5f3a3` (7차 구현; 기반 `5199b48`~`a85ad62` 누적) |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

> 구현 주체 = Claude(비기능/UX 직접 구현). plan 의 `[구현자 기입]` 본 보고 + 후속 6라운드(1·2·3·4·5·6차) + 7차를 검증자 판단으로 반영.

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 편차(plan.md:116) — `segmentByComments`(plain-text 세그먼트) 대신 DOM 오버레이(`getClientRects`) 채택 | **타당** — 마크다운 DOM 구조 위 밑줄/클릭을 React 비침습으로 구현하려면 오버레이가 맞고, plain-text 세그먼트는 마크다운 구조 보존 불가(dead code 회피). 인수 기준(AC1/2)의 *동작*은 동일 충족 | 매트릭스 AC1/AC2 를 오버레이 구현 기준으로 대조 |
| 1~5차 후속 — 팝오버 위치/좌표계/auto-grow/디자인 정합 반복 보정 | 시각 정합은 **사람 검증 영역**. 코드상 contentRef 상대좌표 전환·`resize-none` auto-grow 는 합리적 | 책임 분리표에서 UI 시각=사용자 확인 |
| 6차 후속 — 팝오버 내부 클릭 소멸 버그(`[data-context="floating"]` 제외)·플레이스홀더·테두리 복원 | **타당** — selection collapse 로 draft 비우던 실버그 수정 | AC3(편집/삭제) 동작 보존 확인 |
| 7차 후속 — 거부 deny 배선 복구 + 수정 펼침 버튼 제거 | **타당** — 본 라운드 핵심. 아래 AC6 매트릭스에서 증거 대조 | AC6 충족의 결정적 근거 |
| ⚠️ 보고만(결정 필요) 항목 | 없음 — Open Question/신규 의존성/제품 의도 변경 0 | 파생 이슈 없음 |

## 요구사항 충족 매트릭스

> plan.md "인수 기준" 7개를 1:1 대조. 증거 = `파일:라인` / 테스트.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `pendingPlanReview` 시 본문 드래그→코멘트 작성 팝오버 | ✅ | `features/chat/hooks/usePlanCommentSelection.ts`(선택 확정 document mouseup)·`components/rightpanel/PlanCommentPopover.tsx`(contentRef 상대 absolute, bottom 기본/top flip). 사용자 시각 확인 |
| 2 | 저장 시 밑줄 하이라이트 + composer 코멘트 칩 | ✅ | `PlanCommentOverlay.tsx`(텍스트 노드별 rect)·`ApprovalCard.tsx:123-161` `PlanCommentChips`. 사용자 시각 확인 |
| 3 | 하이라이트/칩 클릭 → 직전 코멘트 출력·편집·삭제 | ✅ | `PlanCommentChips` `onOpen`→`setActivePlanComment`·`onRemove`→`removePlanComment`(`ApprovalCard.tsx:139-156`)·`PlanCommentPopover`(edit/delete). 6차 클릭 소멸 버그 수정 |
| 4 | "수정 요청 보내기" → 구조화 태그(`ORCA_PLAN_FEEDBACK`) 직렬화로 deny message 전달 | ✅ | `store/chatStore.ts:606` `revisePlanWithComments`→`{deny, planFeedback}`; `main/adapters/claude.ts:150-151` `formatPlanFeedbackPrompt`; `main/prompts/plan-feedback.ts`(+`plan-feedback.test.ts`) |
| 5 | 전송/승인/거부(`RESOLVE_PLAN`) 후 코멘트 클리어 + 새 대화/세션 전환 시 초기화 | ✅ | `reducer/chatReducer.ts:518-526`(RESOLVE_PLAN → `planComments:[]`·`activePlanCommentId:null`)·`:123-125`(NEW_CHAT/세션 전환 클리어 주석) |
| 6 | 코멘트 0 시 기존 승인/수정/**거부** 흐름 불변 | ✅ | **7차에서 거부 deny 배선 복구로 비로소 실제 충족.** `store/chatStore.ts` `rejectPlan`=clean deny(`{behavior:'deny'}`)+`RESOLVE_PLAN`; 회귀 테스트 `store/chatStore.test.ts`(deny 응답·inflight 유지 2건) |
| 7 | 게이트(lint/typecheck/test) 통과 — `planComments`·`plan-feedback`·`protocol.permission` 단위 테스트 포함 | ✅ | 아래 게이트 재실행. 신규 테스트(plan-feedback·planComments·protocol.permission·reducer·rejectPlan) green |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | typecheck ✅ / lint ✅ / test **531 passed** |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 7/7 ✅ (증거 위 매트릭스) |
| 레이어 경계 위반 0 | ✅ | — | `npm run lint`(boundaries) error 0 |
| 문서 형식/링크/한국어 | ✅ | — | plan/INDEX/PHASES 인접 행 톤 정합 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 이번 라운드 AGENTS.md 변경 0 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | **사용자 "정상동작 확인"** |
| Open Questions | ✖ | ✅ | 해당 없음 |
| UI/UX 시각 검증 | ✖ | ✅ | **사용자 확인 완료**(거부 deny 전달·수정 버튼 레이아웃·팝오버) |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 미요청(PR 생성 안 함) |

## 게이트 재실행 결과

```
$ cd app && npm run typecheck            # node + web + test 3구성 ✅
$ npm run lint                           # eslint(boundaries 포함) ✅ error 0
$ npm rebuild better-sqlite3 && npm test
 Test Files  2 failed | 70 passed (72)
      Tests  531 passed (531)
```

- **531/531 통과.** 실패 2 suite `persist.test.ts`·`send.runtime-resilience.test.ts` 는
  electron 바이너리 미설치(원격 환경 네트워크 차단으로 download skip)로 **import 단계 차단**
  (`Electron failed to install correctly`, 0 test 실행) — 0033/0046 계열 환경 제한이며 본 변경과 무관.
- 신규/변경 단위 테스트: `store/chatStore.test.ts` `rejectPlan` 2건(clean deny 응답·inflight 유지) green.

## 위생 검토 (AGENTS.md 변경 시)

- 이번 라운드 **AGENTS.md 변경 0**. 변경 docs = `plan.md`·`INDEX.md`·`PHASES.md`·`verify.md`(본 파일).
- 키/토큰/이메일/IP 패턴 혼입: 변경 문서 grep 0.
- 변동성/일회성/장문 코드설명서 혼입: 없음(상태·이력은 INDEX/PHASES 로 분리, 규약 준수).

## PHASES.md 정합성

- "페이즈 표" 0046 행 다음에 0047 완료 행 신규 추가(제목·요약·"완료 (커밋 `ff5f3a3`)").
- 형식/커밋 기재: 인접 0043/0046 행과 동일 톤·열 구조.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: 거부 deny 배선의 abort 레이스(`broker.resolve`=마이크로태스크 vs `controller.abort()`=동기)를 초기 plan 에서 못 짚고 6라운드 시각 보정 누적 후 7차에 노출. 인수 기준 AC6("거부 흐름 불변")이 *기존 거부 자체가 결함*이라 "불변"으로 통과처럼 보였던 맹점 — 기준에 "거부 시 deny 가 모델에 도달" 같은 양성 단언이 있었다면 더 일찍 드러났을 것.
- **구현 단계**: 7차 수정은 최소·정확(렌더러 1줄 의미변경 + 주석 + 회귀 테스트). main `approvals.ts` 의 `deny+interrupt` abort 분기는 protocol 능력으로 보존(렌더러 미사용) — 보수적 선택.
- **검증 단계**: 헤드리스 환경이라 거부 후 *모델 실제 응답·턴 자연 종료*와 팝오버 픽셀 정합은 직접 관측 불가 → 사용자 "정상동작 확인"에 의존. 게이트의 2 suite 는 electron 미설치로 상시 차단(구조적 환경 제한, 0019/0033/0046 계열).

## 결론 / 다음 단계

- **상태: PASS (r1)** → `INDEX.md` `verify/PASS`, `docs/PHASES.md` 표 승격.
- 다음 주체: `—` (종료). 후속 작업 없음.
- 사람 잔여(차단 아님): 실환경 거부 후 모델 응답·턴 자연 종료 체감, 팝오버/카드 픽셀 정합 최종 시각 확인.
