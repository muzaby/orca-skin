# Verify — 0121-design-consistency-audit

## 메타

| 항목 | 값 |
|---|---|
| slug | `0121-design-consistency-audit` |
| 검증자 | Claude Code |
| 일자 | 2026-07-17 |
| 대상 커밋 | `f667ff0` |
| 라운드 | 1 |
| 상태 | **PASS** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

> 본 건은 비기능 = Claude 직접 구현이라 구현자 코멘트도 Claude 작성. 검증 턴에서 재검토했다.

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰 보완 1 — `Backdrop` 컴포넌트 대신 `MODAL_BACKDROP_CLASS` 상수 | 타당 — 소비처 2곳의 DOM 구조가 달라(슬롯 stable layer vs Modal fixed 컨테이너) 상수가 정확한 추상화 | 매트릭스 #1 증거로 확인 |
| 설계 리뷰 보완 1-b — Button `danger` variant 추가 | 타당 — ModalActions 기존 rust 톤과 동치 이관(`bg-rust`+`text-bg`), 신규 시각 발명 아님 | `Button.tsx:57-59,66-67` |
| 놓친 문제 #1 — EngineFormModal 백드롭 클릭도 `menuOpen` 가드 경유(동작 변화) | 타당(개선) — 드롭다운 열림 중 백드롭 클릭이 모달까지 닫던 기존이 오히려 이상 동작 | 사람 실기 항목에 포함 |
| 선조치 ⚠️ #4 — `parts.ts` '중단' 커플링·`'중단되었습니다'` 키화 보류 | 보수적 기본값 준수 확인 — main 리터럴 grep 0, 신규 데이터는 `reason:'aborted'` 판정, 기존 영속 데이터 하위호환 불확실 | **파생 이슈 아님(범위 내 미충족 없음)** — plan §후속 제안 2(main i18n) 와 함께 후속 핸드오프 권고 |
| 선조치 ⚠️ #5 — CameraView rust 솔리드 잔존 | 타당 — camera 스테이지 전용 + 전부 disabled Future Scope 플레이스홀더 | 잔존 목록 정당화로 수용 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | backdrop 단일 소스 | ✅ | `shared/ui/Modal.tsx:9`(`MODAL_BACKDROP_CLASS` export)·`:56`(Modal 소비), `app/OverlayLayer.tsx:7,34`(슬롯 소비). 렌더러 전체 grep: 모달 자체 `fixed inset-0` backdrop 잔존 0 (`Modal.tsx` 단일 + Installer 주석 1건뿐) |
| 2 | blur 통일 + dead prop 제거 | ✅ | `MODAL_BACKDROP_CLASS` = `bg-black/40 backdrop-blur-sm` 상시. `grep -rn blurBackdrop src/` → 0건 (Header About 사용처 1곳도 함께 정리 — 탐색이 놓쳤던 소비처) |
| 3 | UpdateDialog 정합 | ✅ | `features/update/components/UpdateDialog.tsx` 공용 `Modal` 기반 재작성(`busy` 가드로 Esc·백드롭·X 차단, `:29-47`), `OverlayLayer.tsx:29` `modalActive` 에서 update 제외 + 슬롯 밖 형제 마운트(`:63`) — 이중 backdrop 해소 |
| 4 | EngineFormModal 정합 | ✅ | `EngineFormModal.tsx` 공용 `Modal`(panelClassName, rounded-r6/shadow-xl)·serif 18px 타이틀(`h2 font-serif text-[18px]`)·`requestClose` 가 `menuOpen` 가드(Esc 로 Popover 만 닫힘) |
| 5 | Installer/Auth 닫기 UX + 컨테이너 정합 | ✅ | `InstallerDialog.tsx` `useEscToClose(open && !running)` + 래퍼 클릭 가드(`e.target===currentTarget && !running`), `AuthExpiredModal.tsx` 동일 패턴(가드 불요). 양쪽 rounded-r6·serif 18px·`max-w-[92vw]`. SearchModal 반경도 r6 정합 |
| 6 | 버튼 치환 + MenuItem | ✅ | 신규 `shared/ui/MenuItem.tsx`(danger/icon). 로컬 상수 제거: `grep MENU_ITEM\|ICON_BTN\|ACTION_BTN\|DANGER_MENU` → 잔존은 composer `menuItem.ts` 단일 모듈뿐(2줄 레이아웃 전용, 파일 헤더에 예외 문서화; AttachMenu 자체 상수는 MenuItem 로 치환). `<Button>` 13→29파일/35→67곳 + `<MenuItem>` 14곳, raw `<button` 115→71곳(47파일) |
| 7 | 정책 단일화 + 잔존 목록 | ✅ | 치환분은 Button/MenuItem 경유로 cursor-default·`hide-focus-ring ring-focus`·`disabled:opacity-50` 자동. 이탈 focus 링 2곳(`ring-rust`→`ProjectLandingHeader`, `ring-accent`→Composer telemetry) 표준화. 잔존 raw 버튼 정당화 목록 = plan §[구현자 기입] 놓친 문제 하단 |
| 8 | i18n 치환 (ko/en 동시) | ✅ | 우회 12곳 치환(EngineCard·CapturesView·ReasoningBlock·StructuredOutputCard·AssistantMessage·PendingSteerTurn→`common.cancel`·ProjectSessionsPanel·ProjectFiles/InstructionsCard·SkillAuthorModal→기존 `skills.addServer.nameFormatError` 재사용·AddMcpServerModal) + aria 5곳(WinControls 3·FloatingPanel·SkillDetail). 신규 키 ko/en 패리티는 `resources.test.ts` green 포함 vitest 934/934. 예외: `parts.ts`(⚠️ #4 보고)·PRD 절 참조 배지·endonym·'Skill' 고유명사 |
| 9 | 문서 동기화 | ✅ | `docs/arch/frontend/dom-architecture.md` §1.2 트리(슬롯 3종)·§1.5 2원 마운트 구조 + `MODAL_BACKDROP_CLASS` + blur 통일 + 이중 소속 금지 + 닫기 UX 표준 명기, 헤더 최종 업데이트 0121 |
| 10 | 후속 제안 문서화 | ✅ | plan §후속 제안 — ① 타이포 전면 토큰화(305곳/18종 실태 + 토큰 단계 신설 필요) ② main `{raw}`→`{key}` i18n ③ focus-trap 실구현 ④ AnchoredDropdown 수렴 |
| 11 | 게이트 | ✅ | lint 0 error(경고 1 = 0102 TanStack 기존)·typecheck 3분할 0·vitest **934/934**(122/123 파일 — `chat-turn.continuity` 1스위트 로드 실패 = electron egress 403 베이스라인, 0119/0120 동일)·scripts 25/25·레이어 경계(boundaries) 위반 0·신규 npm 의존성 0·IPC/main 로직 무변경(`src/main` diff 0) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 위 #11 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 11/11 |
| 레이어 경계 위반 0 | ✅ | — | lint 내 boundaries 0 error |
| 문서 형식/링크/한국어 | ✅ | — | plan/verify/dom-architecture 확인 |
| AGENTS.md 위생 스캔 | N/A | — | AGENTS.md 무변경 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사용자 결정 5건 라이브 확정 반영 |
| UI/UX 시각 검증 | ✖ | ✅ | **사람 실기 대기** — ① 전 모달 blur/backdrop 톤(라이트·다크) ② UpdateDialog 단일 backdrop ③ 치환 버튼(취소=contained 톤·아이콘 버튼 크기 미세 변화·EngineCard 삭제=danger 솔리드) ④ Installer/Auth ESC·바깥클릭(설치 중 차단) ⑤ EngineFormModal 드롭다운 열림 중 Esc/백드롭 ⑥ en 로케일 신규 라벨 |
| 신규 의존성 승인 | ✖ | ✅ | 해당 없음(0) |
| PR 머지 승인 | ✖ | ✅ | draft PR — 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint        # 0 error, 1 warning(0102 TanStack 기존 베이스라인)
$ npm run typecheck             # node·web·test 3분할 모두 0 error
$ npm test                      # vitest: Test Files 1 failed | 122 passed, Tests 934 passed (934)
                                #   실패 1 = chat-turn.continuity.test.ts 로드 실패
                                #   ("Electron failed to install correctly" — egress 403 환경 베이스라인, 변경 무관)
$ node --test scripts/*.test.mjs  # tests 25 / pass 25 / fail 0
```

## PHASES.md 정합성

- 0121 행 승격 완료 (아래 커밋), INDEX `verify/PASS` 동기화.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 탐색이 `blurBackdrop` 소비처(Header About)와 ProjectsScreen 그룹 A 2곳, composer AttachMenu 로컬 상수를 놓쳤다 — "대표 샘플" 조사의 한계로, 구현 턴 grep 재검증이 잡았다(향후 plan 은 대표 샘플 + 전수 grep 수치를 함께 요구할 것).
- 구현 단계: 시각 변화(버튼 높이/패딩 미세 차·취소 버튼 톤·아이콘 크기 13↔15)의 픽셀 대조를 이 환경에서 못 한다 — 표준 수렴 원칙(사용자 결정 3)으로 갈음했으나 사람 실기에서 어색한 곳은 개별 `className` 보정 여지.
- 검증 단계: focus-trap 실체 부재·`AnchoredDropdown` 이원화 등 구조 이슈는 후속 제안으로만 남겼다(본 범위 아님). en 번역 신규분(captures.body 등)은 기계 패리티만 검증 — 어감은 사람 몫.

## 결론 / 다음 단계

- 상태: **PASS** — 인수 11/11 충족. PHASES 승격 + draft PR 생성.
- 사람 확인 대기: 시각 실기 6항목(위 책임 분리표) · PR 머지.
- 후속 핸드오프 권고(사용자 결정 필요): ① 타이포 전면 토큰화 ② main 사용자 노출 문자열 i18n(+`parts.ts` '중단' 커플링 동반 해소).

---

## r2 부록 — 사용자 피드백 반영 검증 (2026-07-17)

- **피드백 F1**: 설정 모달 상단 중앙에 ×가 노출 + "일반적인 모달의 경우 × 아이콘은 필요없다".
- **대응 확인**: 모달 크롬 × 3곳 제거 — `Modal.tsx` 타이틀 크롬 / `SettingsModal.tsx`(중앙 노출 버그 지점 — Button 베이스 `relative` 와 `absolute` className 충돌이 원인) / `UpdateDialog.tsx`. `grep 'leadingIcon="x"'` 잔존 = 채팅 패널 4곳(AskUserQuestionCard·Notice·ApprovalCard·RightPanelTile — 모달 아님, 유지)뿐.
- **닫기 경로 보존**: Esc(`useEscToClose`)·백드롭 클릭·footer 버튼(취소/닫기/나중에) 전 모달 유지, busy 가드 불변. `common.close` 키는 footer 버튼들이 계속 사용.
- **문서**: dom-architecture §1.5 에 "모달 크롬에 X 닫기 아이콘은 두지 않는다" 명문화.
- **게이트(r2)**: typecheck:web 0 · lint 0 error(경고 1 = 기존) · renderer vitest 266/266.
- 상태: **PASS 유지** (라운드 2). 사람 확인 대기에 "설정/업데이트 모달 × 부재 + Esc/백드롭 닫기 실기" 추가.
