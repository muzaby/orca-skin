# Verify — 0049-design-token-ui-fixes

## 메타

| 항목 | 값 |
|---|---|
| slug | `0049-design-token-ui-fixes` |
| 검증자 | Claude Code |
| 일자 | 2026-06-26 |
| 대상 커밋 | (push 후 기재) |
| 라운드 | 1 |
| 상태 | PASS (코드 범위) |

## 구현자 코멘트 확인

비기능 = Claude 직접 구현(설계=구현=검증 동일 주체). 구현 보고는 plan `[구현자 기입]` 참조. 이견/⚠️ 보고만 항목 없음.

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 진입 시 InstallerDialog 자동 오픈 금지 | ✅ | `backendStore.ts:36-47` 자동 오픈 분기 제거(상태 조회만), `setInstallerOpen` 액션 보존(`:30-33`) |
| 2 | footer BackendStatus 미렌더 + 빈 풋터 없음 | ✅ | `useSidebarSlots.tsx` `footerSlot = null`, `Sidebar.tsx:174` `{footerSlot && (...)}` 가드 |
| 3 | 케밥 press 색 = `t3`, 우측 패널 활성/메뉴 열림 시 적용 | ✅ | `ChatTitleBar.tsx` `ICON_BTN_PRESSED='bg-t3 text-t8'`, `open || panelActive ? PRESSED : IDLE` + `aria-pressed` |
| 4 | 복사 버튼 = 전체 대화 클립보드 + 시각 피드백 | ✅ | `copyConversation` (`getActiveChatSession().messages`→`partsText`→`navigator.clipboard.writeText`), `copied` state→check 아이콘 |
| 5 | 검색 버튼 = disabled + 빗금 | ✅ | `ICON_BTN_DISABLED`(border 토큰 사선) + `disabled` 속성 |
| 6 | 엔진/스킬 비테마 cream-50 → themed bg2 | ✅ | engine 3 + skills 5 파일 `cream-50`→`bg2`; `rg "cream-50" features/engine features/skills` = 0 |
| 7 | 게이트 통과 | ✅ | 아래 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint ✅ / typecheck ✅ / test 540/540 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 7/7 |
| 레이어 경계 위반 0 | ✅ | — | eslint boundaries 통과(동일 feature 내부) |
| UI/UX 시각 검증 | ✖ | ✅ | **사람 확인 대기** |
| 제품 의도(기능 완성 후 재노출) | ✖ 보조 | ✅ | 사람 결정 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ npm run lint           → ✅ (eslint --fix, boundaries 0)
$ npm run typecheck      → ✅ node + web + test
$ npm test               → 1차 528/540 (db/queries.test.ts 12-red = better-sqlite3 Node ABI, 0019 계열)
$ npm rebuild better-sqlite3 && npx vitest run src/main/db/queries.test.ts → 12/12 ✅ (전체 540/540)
```

## 검증 자기 리뷰

- 케밥의 "직전 디자인 토큰" 해석을 press 표면 `t3` 로 확정(추론) — 시각 톤은 사람 검증 필요.
- InstallerDialog/BackendStatus 는 데드(임포트 0) 가 됐으나 feature index 익스포트로 보존 — 기능 완성 시 재배선 전제.

## 사람 확인 대기 (r1)

- 3 테마(화이트/다크) 시각 검증: 케밥 press 톤·검색 빗금·엔진/스킬 카드 표면.
- 전체 대화 복사 실기(클립보드 내용·빈 대화 no-op).
- PR 머지.

---

## 라운드 2 검증 (강조 상태 중립화 + Composer 아이콘)

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 8 | 케밥 패널 활성만으로 강조 안 됨 | ✅ | `ChatTitleBar.tsx` `open ? ICON_BTN_PRESSED : ICON_BTN_IDLE`·`aria-pressed={open}`, `panelActive` 제거 |
| 9 | Composer 전송=enter(↵)·중단=stop(투명 라운드) | ✅ | `Icon.tsx` 신규 `enter` 글리프, `Composer.tsx` `leadingIcon="enter"`(primary)·`"stop"`(uncontained), 둘 다 `rounded-full` |
| 10 | 엔진 default 배지·다이얼로그 중립화·오류 bad·CTA rust | ✅ | `EngineModelList` 배지 `bg-t3 text-t8`; `EngineFormModal` CARD_SEL `border-border-strong bg-t3`·스텝퍼 `bg-ink/bg-t3`·선택됨 `text-t8`·focus `border-border-strong`·오류 `text-bad`/`bg-bad/10`·제출 `bg-rust`; `AgentEnvironmentView` 오류 `bg-bad/10 text-bad` |
| 11 | 스킬 1depth·3depth 토글 중립화 | ✅ | `CustomizeRail` 활성 `bg-t3 text-t8`; `SkillDetail` 본문 토글 `text-t9`; `Toggle` on `bg-ink` |
| 12 | 프로젝트 CTA 아이콘 raw #fff 제거 | ✅ | `ProjectsScreen` `<Icon name="plus" size={13} />`(color 제거, currentColor 상속) |
| — | 게이트 | ✅ | lint/typecheck(node+web+test)/test **540/540**(Node ABI 재빌드 후 green), 레이어 경계 0, 신규 의존성 0, IPC/DB 무변경 |

**검증 자기 리뷰(r2)**: '강조 상태 전반 중립화'는 사용자 결정으로 확정(Q2). rust 잔존 위치(주요 CTA·danger·drag-over)는 의도적 — 시각 톤 적합성은 사람 검증 영역. 토글 on=`bg-ink`(중립 트랙)의 명도 대비는 두 테마에서 사람 확인 필요.

## 사람 확인 대기 (r2)

- 3 테마 시각 검증: 케밥 무강조 / Composer 전송 ↵·중단 ⏹ / 엔진 default·다이얼로그·스텝퍼 / 스킬 1depth·토글 / 프로젝트 CTA.
- 토글 on `bg-ink` 트랙 명도 대비 적정성.

---

## 라운드 3 검증 (Primary 잉크화 + 전송 투명 + 도넛)

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 13 | Button primary 잉크화 | ✅ | `Button.tsx` `TEXT.primary='text-bg'`·squish primary `bg-ink group-hover/btn:bg-t8` → AskUserQuestion/ApprovalCard 5 usage 일괄 |
| 14 | 전송 버튼 투명 | ✅ | `Composer.tsx` 전송 `variant="uncontained"`(enter·rounded-full 유지) |
| 15 | 라디오 checked 잉크 + #fff 제거 | ✅ | `AskUserQuestionCard.tsx` `border-ink bg-ink text-bg`·`<Icon name="check" />`(color 제거) |
| 16 | raw CTA 잉크화·세그먼트 t3 | ✅ | projects 3·`EngineFormModal`·`AddMcpServerModal`(confirm `bg-ink`/transport `bg-t3 text-t8`)·`McpDetail`·backend 2·`Modal.ModalActions` 모두 `bg-ink text-bg` |
| 17 | 도구카드 잔여 + 에러 토큰 | ✅ | `ApprovalCard` '플랜 열기' `text-t8`·textarea `bg-bg`; 스킬 모달 4 에러 `text-bad`; danger 삭제 `text-rust` 유지 |
| 18 | 도넛 green/yellow/red | ✅ | `UsageCircle.tsx` `progressStroke`(0.6/0.85 임계, warn=강제 bad) |
| — | 게이트 | ✅ | lint/typecheck(node+web+test)/test **540/540**(Node ABI 재빌드 후), 레이어 경계 0, 신규 의존성 0, IPC/DB 무변경 |

**검증 자기 리뷰(r3)**: r2 의 "rust=주요 CTA 유지"를 사용자가 뒤집어 모노크롬 잉크 primary 로 전환(Q 확정). `CameraView`(Future)·`AttachmentThumb`(빨강 위 흰글자=정상) 는 의도적 비범위. 잉크 primary 의 두 테마 대비(특히 dark=밝은 ink 위 어두운 text-bg)는 사람 시각 확인 권장.

## 사람 확인 대기 (r3)

- 3 테마: 전송 투명 ↵ / 제출·허용·수락·만들기·추가·새스킬 = 잉크 채움 / 라디오 checked 잉크 / 도넛 초록→노랑→빨강.
