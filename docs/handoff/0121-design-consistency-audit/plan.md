# Plan — 0121-design-consistency-audit

> 흐름: **의도 → 조사 → 설계 → 리스크**. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0121-design-consistency-audit` |
| 작성자 | Claude Code |
| 일자 | 2026-07-17 |
| 매핑 | 브랜치 `claude/orca-design-consistency-1dv5i6` / PR (push 후) |
| 상태 | READY (비기능 = Claude 직접 plan→impl→verify) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "orca의 디자인 통일성 및 재사용성을 검토한다 — 버튼 / 모달(배경 블러 포함) / 언어(i18n) / 그 외 기타 검토사항 있으면 제안할 것. 핸드오프 문서 작성 및 해결" | 라이브 세션 요청 (2026-07-17) |
| 명시 요구 (추가) | "폰트도 orca 디자인을 준수하고 있는지 검토 대상에 추가하라" | 라이브 세션 요청 (동일 세션 중간 지시) |
| 명시 결정 5건 | ① 전 모달 blur 통일 ② 공용 Modal 승격 + 문서 개정 ③ 버튼 그룹 A~E 전량 치환 ④ 닫기 UX 통일(busy 가드 유지) ⑤ 폰트 보수적 정합(전면 리맵은 후속) | 라이브 세션 질의응답 (AskUserQuestion, 아래 "사용자 결정" 절) |
| 추론 의도 | "검토 및 해결" = 조사 보고에 그치지 않고 불일치를 실제 코드로 정합한다 (추론 — "핸드오프 문서 작성 **및 해결**" 문구에 근거) | 라이브 세션 요청 |

## Context (왜)

렌더러에는 토큰 체계(`styles/tokens.css` `@theme`)와 공용 프리미티브(`shared/ui/Button.tsx`·`Modal.tsx`·`Popover.tsx`)가 이미 갖춰져 있으나, features 전반이 이를 우회해 같은 시각 패턴을 인라인으로 복제하고 있다. 그 결과 (1) 같은 역할 버튼의 cursor/focus/disabled 정책이 파일마다 다르고, (2) 모달 backdrop 이 3계통으로 갈라져 blur 유무가 모달마다 다르며(이중 backdrop 버그 포함), (3) i18n 카탈로그를 우회한 하드코딩 라벨이 산재하고, (4) 타이포가 토큰 램프 밖 arbitrary px 로 제각각이다. 본 핸드오프는 이 4축을 정합해 신규 화면이 복붙이 아니라 공용 프리미티브를 집도록 만든다.

## 자료조사 (Research)

### A. 버튼

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 공용 `Button` 프리미티브 존재 — variant `uncontained/contained/primary` × size `small/base/large`, `iconOnly/dropdown/expanded/pressed/busy/leadingIcon/trailingIcon/kbd`. 전부 시맨틱 토큰, btn-squish 배경 분리(`-z-[1]`+`relative isolate`) | `app/src/renderer/src/shared/ui/Button.tsx:14-36,106` |
| primary = 중립 잉크 채움(`bg-ink`/hover `bg-t8`/`text-bg`), warm rust 폐기 주석 명시 | `Button.tsx:53-64` |
| 채택률 ~25%: raw `<button` **57파일/115곳** vs `<Button>` 13파일/35곳(chat feature 집중) | 탐색 집계 (grep `<button` / `<Button`) |
| 반복 그룹 A — primary 잉크채움 인라인 재현(`bg-ink…text-bg hover:bg-t8`): GeneralTab:84, UsageLimitViews:116, AuthExpiredModal:43, InstallerDialog:98, PlanCommentPopover:151 | `features/settings/components/GeneralTab.tsx:84` 외 |
| 반복 그룹 B — outline(`border-border bg-panel|bg-transparent`): GeneralTab:77, UsageLimitViews:108, ProviderUsageTab:76, UpdateDialog:125, InstallerDialog:91, AuthExpiredModal:37 | `features/settings/components/GeneralTab.tsx:77` 외 |
| 반복 그룹 C — icon ghost(`h-7 w-7 …hover:bg-fill-uncontained-hover`): SettingsModal:113, UpdateDialog:67, Notice:32, BackendStatus:42, ProjectInfoHero `ACTION_BTN`, ChatTitleBar `ICON_BTN_*` | `features/settings/components/SettingsModal.tsx:113` 외 |
| 반복 그룹 D — 메뉴 항목: 로컬 상수 `MENU_ITEM` 이 ChatTitleBar:24 와 ProjectInfoHero:14 에 **자구 다르게 중복**, 유사 인라인이 SettingsModal:72, Header:137/149, SidebarUserButton:76/93/117, SessionRow:130/144 | `features/chat/components/ChatTitleBar.tsx:24` 외 |
| 반복 그룹 E — danger: `DANGER_MENU_ITEM`(`text-rust hover:bg-rust-soft`) ChatTitleBar:26, 솔리드 `bg-rust text-white` CameraView:151 | `features/chat/components/ChatTitleBar.tsx:26`, `features/camera/components/CameraView.tsx:151` |
| 정책 불일치: cursor `pointer`↔`default`(Button 은 default), focus 링 3~4체계(`hide-focus-ring ring-focus` / `ring-rust` / `ring-accent` / 없음 — InstallerDialog·AuthExpiredModal·BackendStatus 는 focus 스타일 부재), disabled opacity 40/50/60 혼재 | `Button.tsx:106`, `ProjectLandingHeader.tsx:22`, `Composer.tsx:648`, `CwdButton.tsx:52`, `UsageLimitViews.tsx:116` |
| 색 토큰 체계는 견고 — raw 팔레트 색 위반 극소(`WinControls.tsx:49` hex, `PlanCommentPopover.tsx:119` `bg-white`) | `styles/tokens.css:5-201` |

### B. 모달

| 발견 / 제약 | 레퍼런스 |
|---|---|
| backdrop 3계통: ① overlay 슬롯 `bg-black/40 backdrop-blur-sm`(z 부호 반전) — Installer/Auth/Search/Update ② 공용 `Modal.tsx` 자체 backdrop `bg-black/40`(blur 는 `blurBackdrop` prop, **켜는 곳 0 = dead**) — Settings·프로젝트 2종·스킬 4종·ConfirmDialogHost ③ 손수 `fixed inset-0` — UpdateDialog·EngineFormModal | `app/OverlayLayer.tsx:31`, `shared/ui/Modal.tsx:58`, `features/update/components/UpdateDialog.tsx:38`, `features/engine/components/EngineFormModal.tsx:112` |
| **UpdateDialog 이중 backdrop 버그**: `#app-frame-modal` 슬롯 안(슬롯 backdrop 활성)이면서 자체 `fixed inset-0 bg-black/40 backdrop-blur-sm` 을 또 그림 → dim/blur 2겹. 정본 §1.5 유일 정면 위반 | `UpdateDialog.tsx:38`, `docs/arch/frontend/dom-architecture.md` §1.5 |
| 정본 §1.5 "modal 컴포넌트는 자체 `fixed inset-0 bg-black/40` backdrop 을 갖지 않는다" ↔ 공용 Modal 계열 8종이 body 포털+자체 backdrop — **문서·코드 광범위 모순** | `dom-architecture.md` §1.5, `Modal.tsx:56-58,90` |
| 컨테이너 불일치: rounded `r6`(Modal/Settings/Update) vs `xl`(Search/Installer/Auth) vs `2xl`(Engine), shadow `xl` vs `2xl`(Engine), max-w `92vw` vs `90vw` vs 없음, 타이틀 `font-serif text-[18px]`(Modal/Update) vs `font-serif text-[16px]`(Installer/Auth) vs non-serif `text-[16px]`(Engine) | `Modal.tsx:6-7,72`, `SearchModal.tsx:101`, `InstallerDialog.tsx:63-64`, `AuthExpiredModal.tsx:20-21`, `EngineFormModal.tsx:117,124` |
| 닫기 UX: 공용 Modal 계열·Search·Engine 은 ESC+바깥클릭 ✅ / **Installer·Auth·Update 는 둘 다 ❌**(버튼만, Update 는 busy 중 X 도 숨김) | `Modal.tsx:45-52,59`, `SearchModal.tsx:54-69`, `EngineFormModal.tsx:59-65,113` |
| ConfirmDialogHost 는 슬롯 children 이지만 내부 Modal 이 body 재포털 + `modalActive` 계산에 confirm 미포함 → 슬롯 backdrop 불활성(사실상 슬롯 무관) | `OverlayLayer.tsx:25,58`, `shared/ui/ConfirmDialogHost.tsx` |
| EngineFormModal 은 포털 없이 `AgentEnvironmentView` 안 인라인 `fixed inset-0` — 조상 transform/overflow 시 clip 위험 유일 케이스 | `EngineFormModal.tsx:112`, `AgentEnvironmentView.tsx:90,101` |
| focus-trap 은 `data-behavior` 마커뿐 실제 JS 트랩 구현 없음(초기 포커스만) — 현상 유지(비범위) | `OverlayLayer.tsx:40`, `SearchModal.tsx:103` |
| 팝오버는 공용 `Popover` 로 잘 통일(Composer 6종 포함 12+ 채택처). 이탈치: `PlanCommentPopover` — 포털 없는 absolute + **`bg-white` 하드코딩**(테마 토큰 아님) + 반경/그림자 상이 | `shared/ui/Popover.tsx:117`, `features/chat/components/rightpanel/PlanCommentPopover.tsx:119` |

### C. i18n

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 인프라 성숙: react-i18next 동기 init(`lng:'ko'`), 카탈로그 `resources/ko.ts`(~458 리프 키)+`en.ts`(`typeof ko` 로 키 구조 컴파일 강제), `useI18n()→tr`, `MessageKey`, `UiMessage {key}|{raw}` 판별 유니온. ko↔en 패리티·빈문자열·보간 일치를 런타임 테스트로 강제 | `shared/i18n/index.ts:41-57`, `resources/{ko,en}.ts`, `resources/resources.test.ts` |
| `tr()` 435호출/93파일 — 대부분 카탈로그 경유. `[가-힣]` grep 상위(chatStore 181 등)는 거의 전부 **주석**(허용) | 탐색 집계 |
| **우회 하드코딩 UI 문자열 ~12곳**: EngineCard:27,39,47(`미지원 adapter`/`편집`/`삭제`), CapturesView:10-14, ReasoningBlock:33(`사고 과정`), StructuredOutputCard:17, AssistantMessage:67, PendingSteerTurn:30(`취소` — `common.cancel` 있는데 미사용), ProjectSessionsPanel:52, ProjectFilesCard:19, ProjectInstructionsCard:28, SkillAuthorModal:55, AddMcpServerModal:225, parts.ts:124(`중단되었습니다`) | 각 `features/**` 파일:라인 |
| 영어 aria-label 우회: WinControls:21,32,51(`Minimize/Maximize/Close`), FloatingPanel:71(`Close tweaks`), SkillDetail:179(`plain text`). 브랜드명(OrcaLogo/LoginView `Orca`)은 비번역 무방 | `app/WinControls.tsx:21`, `shared/ui/FloatingPanel.tsx:71` |
| 취약 커플링: `parts.ts:294` `message.includes('중단')` — 로직이 한국어 부분문자열에 결합 | `features/chat/lib/parts.ts:294` |
| 의도적 비대상: chatStore `분기`/`핸드오프` 는 영속 데이터 계약(0097 D3 주석 명시), 언어 자기명칭(endonym) | `features/chat/store/chatStore.ts:750-751`, `app/SidebarUserButton.tsx:14` |
| main 프로세스 사용자 노출 한국어 대량(`makeClassifiedError`·핸들러 throw·updater) — `{raw}` 통과 설계라 en 전환 시 미번역 사각지대. **대규모라 후속 핸드오프 소관** | `app/src/main/app/chat-turn.ts:306,319`, `app/handlers/misc.ts`, `app/updater.ts:14,154` |

### D. 폰트 (사용자 추가 요청)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 타이포 토큰 램프 정의됨: `--text-caption`(0.808rem≈12.9px)/`footnote`(≈14.8)/`code`(14.4)/`body`(16)/`heading`(≈20.9, w600) + `--font-sans/serif/mono` + `--font-app` | `styles/tokens.css:152-170` |
| 실사용은 arbitrary px 압도: **305곳/18종**(12.5px×72, 12px×52, 13px×48, 11px×30, 11.5px×27, 10~10.5px×26 …) vs 토큰 사이즈 유틸 72곳(caption 25·footnote 29·code 10·body 8) | 렌더러 전체 grep 집계 |
| 실질 UI 스케일(11~13px)이 토큰 램프(12.9/14.8/16) **밖** — 근사-이탈(12.5 vs caption 12.9, 13/13.5 vs footnote 14.8)은 ad-hoc 산정의 증거. 전면 리맵은 화면 전체 글자 크기가 변하는 시각 변경 | 위 집계 |
| 모달 타이틀 타이포 혼재: serif 18px(Modal/Update) vs serif 16px(Installer/Auth) vs non-serif 16px(Engine) | §B 표 참조 |

## 사용자 결정 (라이브 세션 확정 — Open Question 해소)

| # | 질문 | 결정 |
|---|---|---|
| 1 | 모달 blur 정책 | **전 모달 `bg-black/40 backdrop-blur-sm` 통일** + 단일 소스화 |
| 2 | dom-architecture §1.5 ↔ 코드 모순 | **코드 승격 + 문서 갱신** — 공용 Modal(body 포털+자체 backdrop)을 표준 셸로, 손수 구현(Update/Engine)만 공용 Modal 로 흡수, §1.2/§1.5 를 2원 마운트 구조로 개정 |
| 3 | 버튼 범위 | **그룹 A~E 전량 치환** + cursor/focus/disabled 정책 단일화(특수 레이아웃 버튼 제외) |
| 4 | Installer/Auth/Update 닫기 UX | **ESC·바깥클릭 부여 + busy 가드**(설치/다운로드 중 차단). Auth 의 ESC 허용 여부는 구현 판단 후 보고 |
| 5 | 폰트 범위 | **보수적 정합** — 같은 역할 요소 불일치만(버튼=Button 흡수 자동, 모달 타이틀=serif 18px, 메뉴=MenuItem). 전면 px→토큰 리맵은 본 plan §후속 제안에 문서화만 |

## 인수 기준 (Acceptance Criteria)

1. **backdrop 단일 소스**: 모달 backdrop 시각(`bg-black/40 backdrop-blur-sm`)이 shared 단일 정의로 수렴하고, `OverlayLayer` 슬롯·공용 `Modal` 이 이를 공유한다. 렌더러에 자체 backdrop 을 손수 그리는 모달이 남지 않는다(grep 근거).
2. **blur 통일**: 모든 모달이 blur 포함 backdrop 을 갖는다. dead `blurBackdrop` prop 은 제거된다.
3. **UpdateDialog 정합**: 이중 backdrop 이 제거되고 공용 `Modal` 기반으로 재작성되며, `OverlayLayer` 슬롯 children/`modalActive` 에서 빠진다. busy(다운로드/설치) 중 ESC·바깥클릭·X 닫기가 차단된다.
4. **EngineFormModal 정합**: 공용 `Modal` 기반으로 재작성되어 rounded-r6/shadow-xl/serif 18px 타이틀/ESC·바깥클릭이 표준화된다. 내부 Popover 열림 중 ESC 로 모달이 닫히지 않는다(기존 가드 보존).
5. **Installer/Auth 닫기 UX**: ESC·바깥클릭 닫기가 동작하되 Installer 설치 진행 중에는 차단된다. 컨테이너 반경·타이틀 타이포가 표준(r6/serif 18px)에 정합된다.
6. **버튼 치환**: 그룹 A/B/C 인라인 버튼이 `<Button>`(primary/contained/uncontained·iconOnly)으로, 그룹 D/E 가 신규 `shared/ui/MenuItem.tsx`(danger 지원)로 치환된다. 로컬 `MENU_ITEM`/`ICON_BTN_*`/`ACTION_BTN`/`DANGER_MENU_ITEM` 상수가 제거된다.
7. **정책 단일화**: 치환된 버튼에서 cursor-default·`hide-focus-ring ring-focus`·`disabled:opacity-50` 이 공용 컴포넌트를 통해 일관 적용된다. 잔존 raw `<button`(특수 레이아웃)은 구현 보고에 목록·정당화가 기재된다.
8. **i18n 치환**: §C 의 우회 하드코딩 한국어 ~12곳과 영어 aria-label 3곳이 카탈로그 키(`ko.ts`+`en.ts` 동시)로 이관되고, i18n 패리티 테스트가 green 이다. 기존 키(`common.cancel` 등) 재사용을 우선한다.
9. **문서 동기화**: `dom-architecture.md` §1.2/§1.5 가 2원 마운트 구조(슬롯 계열 vs 공용 Modal body 포털 계열)·blur 정책·UpdateDialog 이관을 반영한다.
10. **후속 제안 문서화**: 전면 px→토큰 타이포 리맵과 main `{raw}`→`{key}` i18n 전환이 본 plan §후속 제안에 실태 근거와 함께 기재된다(코드 변경 없음).
11. **게이트**: `npm run lint`(error 0) + `npm run typecheck`(3분할) + vitest 순수 스위트 green(DB 로드 스위트 실패는 better-sqlite3 ABI egress 베이스라인으로 분리 보고 — app/AGENTS.md 게이트 가이드). 레이어 경계(eslint-boundaries) 위반 0, 신규 npm 의존성 0, IPC/main 로직 무변경.

## 범위 / 비범위

- **범위**: 렌더러 시각 정합(버튼·모달·메뉴·모달 타이포)·i18n 렌더러 카탈로그 이관·dom-architecture 문서 개정. 전부 비기능(동작 의미 보존).
- **비범위**: ① 전면 px→토큰 타이포 리맵(후속 제안) ② main `{raw}`→`{key}` i18n(후속 제안) ③ focus-trap 실구현 ④ chatStore 영속 라벨(0097 D3) ⑤ WinControls/Composer 전송 버튼 등 특수 레이아웃 버튼의 컴포넌트 치환(정책 클래스 정합만 검토) ⑥ camera stage 전용 색 체계.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈만 사용: `shared/ui/Button|Modal|Popover|Icon`, `shared/i18n`, `styles/tokens.css`. **신규 npm 의존성 0.**
- 전제: 공용 `Modal` 의 body 포털 + 자체 backdrop 이 표준(사용자 결정 2). z-index 는 Modal `z-50` 기준(슬롯 z=20 과 공존 — Update 이관 후 슬롯 활성 모달과 공용 Modal 이 동시에 뜨는 조합은 현재 없음).
- 전제: 게이트는 이 환경에서 lint/typecheck/순수 vitest 로 판정, electron 실기는 사람 몫(0019/0102 선례).

## 설계

1. **backdrop 단일 소스** — `shared/ui/Modal.tsx` 에 `MODAL_BACKDROP_CLASS`(= `bg-black/40 backdrop-blur-sm`) export. `Modal` 자체와 `app/OverlayLayer.tsx` 슬롯이 공유(app→shared 는 허용 방향). `blurBackdrop` prop 삭제.
2. **UpdateDialog** — 공용 `Modal`(width 560, busy 시 `onClose` 무시 가드) 기반 재작성. `OverlayLayer` children·`modalActive` 에서 제외하고 `updateStore` 구독으로 자체 조건 렌더(다른 공용 Modal 계열과 동일 패턴). 기존 버튼들은 `<Button>`/`ModalActions` 로.
3. **EngineFormModal** — 공용 `Modal` 로 흡수. 내부 provider `Popover` ESC 가드는 Popover 가 이벤트를 소비하는지 확인 후, 필요 시 `Modal` 에 "ESC 무시 조건" 대신 기존 로컬 keydown 가드 유지 방식으로 충돌 회피(구현 시 검증).
4. **Installer/Auth** — 슬롯 잔류(정상 경로). panel 클래스만 표준화(r6/serif 18px)하고 ESC/바깥클릭 핸들러 추가(Installer 는 `installing` 중 차단).
5. **ConfirmDialogHost** — 슬롯 children 에서 형제 위치로 이동(내부 Modal 이 body 포털이므로 슬롯 무의미). 마커/문서 정합.
6. **MenuItem 신설** — `shared/ui/MenuItem.tsx`: `danger?: boolean`, `icon?`, Popover 내부 항목 표준(`flex w-full px-2.5 py-1.5 text-left rounded-r3 text-footnote…`). 그룹 D/E 소비처 치환.
7. **버튼 치환** — 그룹 A→`variant="primary"`, B→`contained`, C→`iconOnly variant="uncontained"`(size 는 문맥별 small/base). 시각 근사 유지가 원칙(픽셀 동일이 아니라 표준으로의 수렴이 목적 — 사용자 결정 3).
8. **i18n** — `ko.ts`/`en.ts` 에 네임스페이스 관례(`engine.*`, `captures.*`, `chat.*`, `projects.*`, `common.*`)대로 키 추가, 컴포넌트는 `useI18n().tr` 소비. `parts.ts` 는 우선 문자열 상수화 후 `includes('중단')` 의 main 계약(`chatCancel` 경로 원문) 확인 — 위험하면 보고만.
9. **레이어 경계** — 신규 파일은 `shared/ui/` 에만. features 간 교차 import 없음. main 무변경.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- Update busy(다운로드/설치) 중 닫기 차단 — 진행률 유실 방지. 설치 직전(퀴트 임박)도 동일.
- AuthExpired 는 조치 필수 성격 — ESC 닫기를 부여하되 재로그인 버튼 유지(닫아도 backendStore 상태로 재진입 가능함을 확인, 아니면 보고).
- EngineFormModal: 내부 Popover 열림 → ESC 1회는 Popover 만 닫혀야 함(이벤트 전파 순서 검증).
- 테마 2종(white/dark): 치환은 전부 토큰 경유라 자동 — 시각 확인은 사람 실기.
- 키보드/a11y: MenuItem 은 `role="menuitem"` 유지 여부를 기존 소비처와 동일하게(기존에 role 없으면 추가하지 않음 — 시각 정합이 목적).
- 멀티세션/동시성: 해당 없음(N/A — 렌더러 표현 계층만).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 광범위 시각 변경(버튼 115곳·모달 13종)을 electron 실기 없이 수행 | 토큰·공용 컴포넌트로의 수렴만 수행(임의 신규 스타일 금지) + verify 책임 분리표에 "사람 시각 실기 대기" 명시(0019/0102 선례) |
| UpdateDialog 슬롯 이탈로 `modalActive` 의미 변화 | Update 는 공용 Modal 자체 backdrop 으로 대체되므로 슬롯 backdrop 불필요 — 잔여 3종(Installer/Auth/Search)으로 재정의하고 문서 동기화 |
| Button 치환 시 미세 픽셀 차이(높이/패딩) | 표준으로의 수렴이 목적(사용자 결정 3) — 의도적 차이만 `className` 보강, 차이 목록은 구현 보고에 기재 |
| `parts.ts` '중단' 결합은 main 원문과의 런타임 계약 | main 원문 생산 지점 확인 후에만 변경, 불확실하면 ⚠️ 보고만(보수적 기본값) |
| blur 상시화로 저사양 렌더 비용 증가 | 모달은 동시 1개·일시적 — 수용(사용자 결정 1) |

- 되돌리기 어려운 결정: 없음(전부 렌더러 표현 계층, git revert 가능).
- 단독 결정 금지 항목: 본 작업의 Open Question 5건은 라이브 세션에서 사용자 확정(위 표). 신규 발생 시 ⚠️ 보고.

## 영향 받는 파일

- `app/src/renderer/src/shared/ui/` — `Modal.tsx`(backdrop 소스·blur)·`MenuItem.tsx`(신설)·`FloatingPanel.tsx`(aria)
- `app/src/renderer/src/app/` — `OverlayLayer.tsx`·`Header.tsx`·`SidebarUserButton.tsx`·`SearchModal.tsx`·`WinControls.tsx`(aria)
- `app/src/renderer/src/features/` — update/`UpdateDialog`, engine/`EngineFormModal`·`EngineCard`, backend/`InstallerDialog`·`AuthExpiredModal`·`BackendStatus`, settings/`SettingsModal`·`GeneralTab`·`UsageLimitViews`·`ProviderUsageTab`, projects/`ProjectInfoHero`·`ProjectFilesCard`·`ProjectInstructionsCard`·`CreateProjectModal` 등, sessions/`SessionRow`·`ProjectSessionsPanel`, chat/`ChatTitleBar`·`Notice`·`PlanCommentPopover`·transcript 4종·`parts.ts`, skills/`SkillAuthorModal`·`AddMcpServerModal`·`SkillDetail`, captures/`CapturesView`, camera/`CameraView`(판단 후)
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `docs/arch/frontend/dom-architecture.md`

## 참고 문서

- `docs/arch/frontend/dom-architecture.md` §1.2/§1.5 (모달 슬롯 정본 — 본 작업으로 개정)
- `docs/arch/frontend/layers.md` (4-layer 경계)
- `app/AGENTS.md` §스타일링·§게이트 가이드
- IPC 변경: 없음

## 게이트

- `cd app && npm run lint && npm run typecheck` + vitest(순수 스위트 — DB 로드 스위트 실패는 ABI egress 베이스라인 분리 보고).
- 신규 테스트: i18n 키 추가는 기존 `resources.test.ts` 패리티 테스트가 자동 검증. `parts.ts` 변경 시 기존 스위트로 회귀 가드. UI 치환은 시각 검증(사람)으로 갈음(app/AGENTS.md 원칙 4).

## 후속 제안 (본 핸드오프 비범위 — 사용자 검토용)

1. **타이포 전면 토큰화** (후속 핸드오프 후보): arbitrary `text-[Npx]` 305곳/18종을 토큰 램프로 리맵. 실질 스케일(11~13px)이 현 램프(12.9/14.8/16) 밖이므로 **토큰 단계 신설**(예: `--text-micro`≈11px, caption 실측 보정) 여부부터 사용자 결정 필요. 화면 전체 글자 크기가 변하는 시각 변경이라 사람 실기 검증 전제.
2. **main 사용자 노출 문자열 i18n** (후속 핸드오프 후보): `makeClassifiedError`·핸들러 throw·updater 의 한국어 원문을 `{raw}`→`{key}` 로 전환해 en 로케일 사각지대 해소. IPC 페이로드/에러 계약에 닿는 범위라 별도 설계 필요. 부수: main 로그 한국어("로그는 영어" 규칙 상충) 정리.
3. **focus-trap 실구현**: `data-behavior="focus-trap"` 마커의 실체(Tab 순환 격리) 구현.
4. **`AnchoredDropdown`→`Popover` 수렴 검토**: dismiss 로직 내장 여부만 다름 — 소비처 2곳이라 우선순위 낮음.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용했고, 추론("해결"의 해석)은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 레퍼런스(파일:라인·정본 문서 §)를 붙였다.
- [x] 인수 기준 — 번호 11건, 자료조사 근거, 검증 가능(grep/게이트/문서 대조).
- [x] 의존 기술 — 기존 모듈만, 신규 의존성 0 명시.
- [x] 파생 UX — busy 가드·ESC 전파·테마·a11y 를 펼쳤다.
- [x] 리스크 — 시각 실기 불가·계약 결합을 적고, Open Question 은 사용자 확정 5건으로 해소했다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (본 건 비기능 = Claude 직접).

## [구현자 기입] 설계 리뷰 (비판적)

- (구현 턴에서 기입)

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| — | (구현 턴에서 기입) | | |

## [구현자 기입] 구현 체크리스트

- [ ] backdrop 단일 소스 + blur 통일
- [ ] UpdateDialog·EngineFormModal 공용 Modal 흡수
- [ ] Installer/Auth 닫기 UX + 컨테이너 정합
- [ ] MenuItem 신설 + 그룹 D/E 치환
- [ ] 그룹 A/B/C Button 치환
- [ ] i18n 키 이관 + aria
- [ ] dom-architecture 개정
- [ ] 게이트

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | (기입) |
| 실행 명령 | `npm run lint` / `typecheck` / vitest |
| 게이트 결과 | (기입) |
| 블로커 / 역질문 | (기입) |
| 대상 커밋 | (기입) |
