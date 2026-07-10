# Verify — 0093-frontend-simplify-cleanup

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능 = Claude 직접 plan → impl → verify (0092 동일 패턴).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0093-frontend-simplify-cleanup` |
| 검증자 | Claude Code |
| 일자 | 2026-07-10 |
| 대상 커밋 | `e85c7d4` |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 놓친 문제 #1 — busy 중 취소 차단이 기존 `ModalActions` 미지원 | 타당 — `cancelDisabled` optional 신설은 동작 보존에 필수였고 기존 5 소비자 무영향 | 매트릭스 #4 증거에 포함 |
| 놓친 문제 #2 — `SubAgentTileHeader` 의 레이지 파생 보존 | 타당 — 무조건 메모화였다면 목록 모드 퇴행 | 매트릭스 #10 증거에 포함 |
| 놓친 문제 #3 — 미사용 `panelRef` 미이식 | 타당 (데드코드 제거 겸) | 매트릭스 #6 |
| 놓친 문제 #4 — 신규 테스트 tsconfig 커버 확인 | 타당 | 게이트 재실행에 포함 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `MOCK_HATCH_BG` 삭제 | ✅ | `shared/ui/mock.ts` — `DISABLED_HATCH_CLASS` 만 잔존, `rg MOCK_HATCH_BG` 0건 |
| 2 | `MODE_LABELS` 파생 전환 | ✅ | `composer/modes.ts:54-58` `Object.fromEntries(MODE_OPTIONS.map(…))` — 수기 사본 삭제. `modes.test.ts` 완전성 테스트 |
| 3 | `MENU_ITEM` 단일화 | ✅ | 신설 `composer/menuItem.ts` + Effort/Mode/Model 3곳 import (`rg "const MENU_ITEM" composer/` → menuItem.ts·AttachMenu(변형 유지)만) |
| 4 | 모달 4종 `Modal` 이관 | ✅ | `CreateProjectModal`·`EditInstructionsModal`·`AddMcpServerModal` = `Modal`+`ModalActions`+`MODAL_LABEL/INPUT`(로컬 오버레이·`FIELD_*` 삭제), `SettingsModal` = `panelClassName`/`ariaLabel` 크롬리스(클래스 1:1). `Modal.tsx` `cancelDisabled` 신설 |
| 5 | `formatRelative` → shared 재사용 | ✅ | `ProjectsScreen.tsx:15-27` — 하루 미만 `relativeTimeLabel(updatedAt)` 위임, 어제/날짜 tail 로컬. floor 경계 동일 확인(plan §전제) |
| 6 | anchored dropdown 셸 추출 | ✅ | 신설 `composer/AnchoredDropdown.tsx` — Skill/File 자동완성은 항목 렌더만 보유, `panelRef` 제거 |
| 7 | 자동완성 훅 상태 머신 추출 | ✅ | 신설 `hooks/useTokenAutocompleteState.ts` — 두 훅이 합성, 반환 인터페이스 무변경 |
| 8 | `basename` → `basenameForDisplay` | ✅ | `toolMeta.ts:120` `basenameForDisplay(fp, fp)` — 로컬 함수 삭제, 기존 테스트(`toolMeta.test.ts:48-53` win/unix 경로) green |
| 9 | 라이브 reasoning `StreamingMarkdown` | ✅ | `ReasoningBlock.tsx` `streaming` prop 분기 + `PendingAssistant.tsx:26` `streaming` 전달 — 커밋 경로(단일 `Markdown`+memo bail) 무변경 |
| 10 | `subagentTasksFromMessages` 메모 | ✅ | `SubAgentTileContent.tsx` — 헤더 `useMemo([messages, selectedId])`(레이지 보존)·본문 `useMemo([messages])` |
| 11 | `tokenize` 메모 | ✅ | `HighlightedTextarea.tsx` `useMemo([value, knownSkillNames, validFilePaths])` |
| 12 | 도구 이름 집합/판별 단일화 | ✅ | `toolMeta.ts:9-12` `FILE_EDIT_TOOLS`+`FILE_TOOLS`(파생) export — `registry.ts`·`ToolCard.tsx` import, 로컬 정의 삭제. `isAgentTaskName` 을 `registry.agent_task`·`toolVerbCategory` 가 호출. `toolMeta.test.ts` 파생/delegated 테스트 |
| 13 | `StatusLine` chat feature 이동 | ✅ | git mv → `features/chat/components/StatusLine.tsx`(rename 89% 유사도), 소비자 2곳 상대 import 갱신, `elapsed.ts` shared 잔류 |
| 14 | 게이트 green·경계 0·의존성 0·신규 테스트 | ✅ | 아래 §게이트 — lint(boundaries 포함) 0 / typecheck 3종 0 / vitest 804 passed(+3 신규). `package.json` 무변경 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 전부 green (아래) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 14/14 |
| 레이어 경계 위반 0 | ✅ | — | eslint boundaries 통과 — 신규 import 전부 하향/동일 feature |
| 문서 형식/링크/한국어 | ✅ | — | plan/verify/INDEX 컨벤션 준수 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 모달 크롬 통일(시각 변경 수용) — 사람 확인 대기 |
| UI/UX 시각 검증 | ✖ | ✅ | 모달 4종·라이브 reasoning 스트리밍 — 사람 확인 대기 |
| 신규 의존성 승인 | ✖ | ✅ | 해당 없음 (0건) |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint          # ✅ 0 error (boundaries 포함)
$ npm run typecheck               # ✅ node/web 0
$ npm run typecheck:test          # ✅ 0
$ npm test                        # vitest: Test Files 2 failed | 106 passed (108)
                                  #         Tests  804 passed (804)
```

- 실패 2 suite(`chat-turn.continuity`·`history/writer`)는 **electron 바이너리 egress 403 환경 제한** — 0019/0092 와 동일 계열이며 0092 검증 시 무변경 베이스라인에서도 동일 실패 확인됨. 본 변경은 renderer/shared 한정이라 무관.
- 신규 테스트 3건: `modes.test.ts`(MODE_LABELS/OPTIONS 완전성) + `toolMeta.test.ts`(delegated 판별·FILE_* 파생).

## PHASES.md 정합성

- 비기능 리팩토링 단건 — 0092 선례에 따라 PHASES 승격은 PR 머지 시점 기준으로 생략(INDEX + handoff 문서가 추적). 필요 시 머지 후 승격.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 모달 이관의 "시각 동일성" 초기 가정이 실사에서 "크롬 통일=의도적 시각 변경"으로 정정됨 — plan 의 추론 의도 표기로 흡수했으나, 시각 자산 대조(스크린샷)는 헤드리스 환경이라 불가.
- 구현 단계: `EngineFormModal` 의 조건부 Esc 는 `Modal` 에 `closeOnEscape` prop 을 신설하면 이관 가능 — 이번엔 스킵(범위 관리), 후속 후보.
- 검증 단계: 라이브 reasoning 의 스트리밍 실기(extended thinking 턴)는 headless 라 미실행 — `StreamingMarkdown` 이 텍스트 경로에서 검증된 동일 메커니즘이라는 구조 근거로 대리.

## 결론 / 다음 단계

- 상태: **PASS** — 인수 14/14, 스킵 5건은 plan §범위/비범위에 사유 기록.
- 후속 후보(파생, 필요 시 신규 핸드오프): ① tool descriptor 확장(verbCategory/필드 접근자/diffPairs 를 `ToolRenderer` 로 — toolMeta/ToolCard/DiffBody 의 도구별 지식 잔여 분산 해소) ② `Modal.closeOnEscape` prop + `EngineFormModal` 이관 ③ 부트 스텝 병렬화(UX 결정 필요).
- 사람 확인 대기: 모달 4종 시각 회귀(크롬 통일 수용 여부 포함) · extended thinking 스트리밍 실기 · PR 머지.
