# Plan — 0083-ui-polish-header-nav-transcript

> 앱 헤더·사이드바 nav·transcript·composer·프로젝트 랜딩 UI 피드백 묶음. 기존 기능을 새로 도입하기보다 **미구현/퓨처스코프 항목 숨김, 토큰 불일치 교정, 텍스트 오버플로 방어, 메뉴 기능 위치 정리**가 핵심이다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0083-ui-polish-header-nav-transcript` |
| 작성자 | Claude Code |
| 일자 | 2026-07-08 |
| 구현 주체 | Codex |
| 매핑 | PHASES (완료 시 승격) / PR (요청 시) |
| 상태 | DRAFT → **READY** |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 앱 헤더: 좌측 햄버거 버튼에 버전 항목 추가. 클릭 시 브랜드 로고와 앱 버전만 표시. | 라이브 세션 요청 |
| 명시 요구 | 앱 헤더/사이드바: 사이드바 접힘 버튼 활성 상태와 접힌 nav 항목 클릭 상태가 빨갛게 보이는 문제를 앱 디자인 토큰(nav 클릭 토큰 기준)과 맞춘다. | 라이브 세션 요청 |
| 명시 요구 | nav: 자동화 항목 버튼 제거(숨김, Future Scope). | 라이브 세션 요청 |
| 명시 요구 | transcript: 타이틀 포맷을 `<프로젝트> / <title>` 로 수정하되 기존 버튼/이모지는 유지. | 라이브 세션 요청 |
| 명시 요구 | transcript: 메시지 버블에서 1개 단어가 길어 width 를 넘으면 truncate 되어 `...` 으로 표시. | 라이브 세션 요청 |
| 명시 요구 | transcript: 타이틀 우측 돋보기 버튼 제거(숨김, Future Scope). 케밥 버튼의 이름변경/삭제 배선은 nav 최근대화 항목 케밥 기능으로 제공하는 기능으로 정리. | 라이브 세션 요청 |
| 명시 요구 | transcript: 타이틀 우측 케밥 버튼에서 `예약 1`, `예약 2` 버튼 제거(숨김, Future Scope). | 라이브 세션 요청 |
| 명시 요구 | transcript: yellowdot 렌더링 및 코드 제거. | 라이브 세션 요청 |
| 명시 요구 | composer: agent 모드 설명이 불명확하며, `묻지 않음` 설명이 `권한 우회`와 차이가 없으므로 명확히 수정. | 라이브 세션 요청 |
| 명시 요구 | composer: textarea placeholder 를 수정. 단, 요청 문장이 값 없이 끊겼으므로 구현자는 코드 변경 전 사용자에게 정확한 문구를 확인해야 한다. | 라이브 세션 요청 |
| 명시 요구 | 프로젝트 페이지: 프로젝트 항목 클릭 시 우측 파일 첨부 영역을 전체 빗금 표시(bg)로 표시. | 라이브 세션 요청 |
| 추론 의도 | 사용자는 미구현/Future Scope 항목이 클릭 가능한 것처럼 보이거나 빨간 강조로 보이는 것을 줄이고, 현재 제공 가능한 핵심 동작만 남기려 한다. (*추론*) | 위 명시 요구 전반(숨김·토큰 불일치·퓨처스코프 반복) |

## Context (왜)

현재 UI에는 구현 상태와 시각 언어가 어긋나는 지점이 남아 있다. 사이드바 접힘/접힌 nav active 상태는 일부 경로에서 `text-rust` 등 빨간 계열을 사용하고, 자동화 nav/타이틀 검색/예약 타일 같은 Future Scope 또는 준비 중 항목이 노출된다. transcript 제목/메뉴는 이미 최근 대화 `SessionRow` 쪽에서 세션 이름변경·삭제를 제공하므로 중복 메뉴를 줄여야 한다. 메시지 버블은 긴 단일 토큰(예: 한글 URL 인코딩 문자열)이 width 를 뚫는 사용자 피드백이 있다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 헤더 햄버거 메뉴는 현재 `Header` 의 `Popover` 안에 `종료` 하나만 렌더한다. 앱 버전은 `app/package.json` 의 `version: 1.0.0` 에 존재한다. | `app/src/renderer/src/app/Header.tsx:49-116`, `app/package.json:121-123` |
| 헤더의 사이드바 접힘 버튼은 shared `Button` 에 `pressed={t.sidebarCollapsed}` 를 넘긴다. 빨간 active 원인은 `Button` pressed variant 또는 관련 토큰일 가능성이 크므로 nav active 토큰(`bg-fill-uncontained-active text-t9`) 기준으로 맞춰야 한다. | `app/src/renderer/src/app/Header.tsx:59-66`, `app/src/renderer/src/app/Sidebar.tsx:153-158` |
| 접힌 사이드바 nav active 는 `bg-fill-selected text-rust` 를 사용해 빨간 계열로 보인다. 펼친 nav active 는 `bg-fill-uncontained-active font-medium text-t9` 이며 사용자가 말한 nav 클릭 디자인 토큰으로 볼 수 있다. | `app/src/renderer/src/app/Sidebar.tsx:96-112`, `app/src/renderer/src/app/Sidebar.tsx:153-158` |
| 사이드바 `NAV` 에 `자동화` 항목이 disabled 상태로 남아 있다. 도메인 문서는 routines 가 placeholder/Future Scope 라고 설명한다. | `app/src/renderer/src/app/Sidebar.tsx:19-30`, `docs/arch/frontend/ux-domains.md:137-149` |
| 최근 대화 행(`SessionRow`)은 이미 `<projectName> / <baseLabel>` 라벨 포맷과 케밥 메뉴의 이름 변경/삭제를 제공한다. | `app/src/renderer/src/features/sessions/components/SessionRow.tsx:37-42`, `app/src/renderer/src/features/sessions/components/SessionRow.tsx:111-141` |
| transcript titlebar 는 현재 `CwdButton / title` 포맷, 우측 검색 disabled 버튼, 전체 대화 복사 버튼, 우측 패널 타일 케밥 메뉴(타일 표시 + 이름 변경/삭제)를 렌더한다. | `app/src/renderer/src/features/chat/components/ChatTitleBar.tsx:87-158` |
| 사용자 메시지 버블은 `max-w-[80%] whitespace-pre-wrap` 만 있어 긴 단일 토큰이 줄바꿈/ellipsis 없이 버블 밖으로 넘칠 수 있다. | `app/src/renderer/src/features/chat/components/transcript/UserMessage.tsx:190-193` |
| pending 사용자 버블과 AskExchange/SubAgent user bubble 도 유사한 긴 텍스트 오버플로 위험이 있다. 구현자는 “메시지 버블” 범위를 사용자 버블 계열로 넓혀 점검해야 한다. | `app/src/renderer/src/features/chat/components/transcript/PendingSteerTurn.tsx:9-33`, `app/src/renderer/src/features/chat/components/transcript/AskExchange.tsx:22`, `app/src/renderer/src/features/chat/components/rightpanel/SubAgentTileContent.tsx:105` |
| yellow dot 은 `AssistantTurn` 이 tool_call 포함 턴에 `YellowDot` 를 렌더하고, 별도 파일 `YellowDot.tsx` 가 존재한다. | `app/src/renderer/src/features/chat/components/transcript/AssistantTurn.tsx:198-229`, `app/src/renderer/src/features/chat/components/transcript/YellowDot.tsx:1-11` |
| composer 권한 모드 설명에서 `묻지 않음`은 “모든 도구를 확인 없이 실행(승인 게이트 해제)”, `권한 우회`는 “모든 권한 검사 건너뜀”으로 서로 구분이 흐리다. | `app/src/renderer/src/features/chat/components/composer/modes.ts:38-50` |
| composer textarea placeholder 는 현재 inflight/idle 로 나뉘어 `피드백 보내기…`, `Orca에게 메시지 보내기…` 를 표시한다. 사용자 요청에는 새 문구가 비어 있어 Open Question 이다. | `app/src/renderer/src/features/chat/components/Composer.tsx:533-537` |
| 프로젝트 랜딩 우측 파일 카드가 점선 드롭존만 표시한다. 사용자는 프로젝트 항목 클릭 후 우측 파일 첨부 영역 전체 bg 를 빗금 표시하기 원한다. | `app/src/renderer/src/features/projects/components/ProjectFilesCard.tsx:4-15`, `app/src/renderer/src/features/projects/components/SidebarCard.tsx:38-54` |
| 프로젝트 목록의 카드 클릭은 `/projects/:id` 로 이동한다. | `app/src/renderer/src/features/projects/components/ProjectsScreen.tsx:63`, `app/src/renderer/src/features/projects/components/ProjectsView.tsx:11-14` |
| DOM/UX 문서는 사이드바 nav 에 자동화를 노출한다고 되어 있어, 자동화 숨김 구현 시 문서도 함께 동기화해야 한다. | `docs/arch/frontend/dom-architecture.md:44-45`, `docs/arch/frontend/ux-domains.md:137-149` |

## 인수 기준 (Acceptance Criteria)

1. 헤더 햄버거 메뉴에 `버전` 항목이 추가되고, 클릭하면 햄버거 팝오버 내용이 **브랜드 로고 + 앱 버전 문자열만** 보이는 상태로 전환된다. 버전 문자열은 빌드 타임 상수(예: `import.meta.env.PACKAGE_VERSION`) 또는 package metadata 주입으로 앱 버전과 동기화한다. 새 IPC 채널은 만들지 않는다.
2. 헤더 사이드바 접힘 버튼의 pressed/active 상태가 빨간 계열(`rust`, `bad`)을 쓰지 않고 nav 클릭 디자인 토큰(`bg-fill-uncontained-active`/`text-t9` 계열 또는 동등한 semantic token)과 일치한다. 라이트/다크/쿨 테마에서 의미 토큰만 사용한다.
3. 접힌 사이드바 nav active 상태가 펼친 nav active 와 같은 semantic token 계열을 사용하며 `text-rust`/`bg-fill-selected` 빨간 active 표현을 제거한다.
4. 사이드바 `자동화` nav 항목은 렌더되지 않는다(숨김). `/routines` 라우트 신규 구현은 하지 않는다. 관련 frontend 문서의 nav 항목 수/표기도 동기화한다.
5. transcript titlebar 의 제목은 프로젝트 세션이면 `<프로젝트> / <title>`, 프로젝트가 없으면 `<title>` 로 표시한다. 기존 제목 관련 버튼/이모지(예: cwd 버튼, 복사 버튼 등 사용자가 유지하라고 한 요소)는 AC6/AC7 에서 제거 대상이 아닌 한 유지한다.
6. transcript titlebar 우측 검색 버튼은 숨긴다/렌더하지 않는다. 검색 기능 자체(`SearchModal`, 전역 헤더 검색)는 제거하지 않는다.
7. transcript titlebar 우측 케밥 메뉴에서는 Future Scope/예약성 항목(`예약 1`, `예약 2` 또는 타일 placeholder 성격 항목)을 제거하고, 세션 이름변경/삭제는 **titlebar 에서 새로 배선하지 않는다**. 세션 이름변경/삭제는 최근 대화 `SessionRow` 케밥 메뉴가 제공한다는 구조가 유지된다.
8. 긴 단일 단어/URL/인코딩 문자열이 사용자 메시지 버블(일반, pending, AskExchange/SubAgent user bubble 등 사용자 발화 버블 계열)의 max width 를 넘지 않는다. 요구대로 넘치는 단일 라인은 `truncate`/ellipsis 처리하고, 일반 공백 포함 다중 라인 메시지는 기존 가독성을 최대한 유지한다.
9. `YellowDot` 렌더링과 코드가 제거된다: `AssistantTurn` 의 agentic dot 분기 및 `YellowDot.tsx` import/파일이 삭제되고, 더 이상 `YellowDot` 참조가 없다.
10. composer 권한 모드 설명 중 `묻지 않음`과 `권한 우회` 설명이 명확히 구분된다. 예: `묻지 않음`은 “Orca 승인 질문을 만들지 않고 기본 거부/자동 진행 정책에 따른다”처럼 권한 우회와 다르게 설명하고, `권한 우회`는 “격리/권한 검사를 최대한 건너뛰는 위험 모드”로 위험성을 유지한다. 최종 문구는 실제 런타임 semantics(`NormalizedPermissionMode`)와 맞아야 한다.
11. composer textarea placeholder 는 사용자에게 새 문구를 확인한 뒤 반영한다. 확인 전에는 이 AC 를 `blocked` 로 보고하거나, 구현자 코멘트에 미확정으로 남기고 placeholder 변경을 하지 않는다.
12. 프로젝트 상세/랜딩 우측 파일 첨부 영역은 카드 내부의 드롭존 일부가 아니라 **파일 첨부 영역 전체 배경**이 빗금 표시로 보인다. 기능 동작은 여전히 placeholder/Future Scope 로 유지한다.
13. 신규 의존성/IPC/DB/migration 없이 구현한다. 게이트 `cd app && npm run lint && npm run typecheck && npm test` 를 실행하고, 가능하면 UI 변경이므로 `npm run dev` 또는 빌드 후 스크린샷/시각 확인을 수행한다(환경 제한 시 보고).

## 범위 / 비범위

- **범위**: renderer UI/문구/토큰 정리, Future Scope 항목 숨김, docs frontend nav 표기 동기화, 필요 시 Vite 빌드 상수 설정.
- **비범위**: `/routines` 페이지 구현, transcript titlebar 에 세션 rename/delete 신규 기능 구현, 검색 모달 기능 삭제, 파일 첨부 실제 동작 구현, DB/IPC/권한 런타임 정책 변경.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈: `Header`, `Sidebar`, `ChatTitleBar`, `SessionRow`, transcript user bubble 컴포넌트들, `modes.ts`, `ProjectFilesCard`/`SidebarCard`.
- 앱 버전: `app/package.json` 버전이 SSOT. renderer 에 노출하려면 electron-vite/Vite define 또는 기존 import 방식 중 repo 관례에 맞는 최소 변경을 사용한다.
- 신규 의존성: 없음.
- **Open Question**: textarea placeholder 의 최종 문구가 요청에 포함되지 않았다. 구현 착수 시 사용자 확인 필요.

## 설계

1. **Header 버전 뷰**
   - 햄버거 팝오버에 `버전` 메뉴를 추가한다.
   - 클릭 시 `menuView: 'main' | 'version'` 같은 로컬 상태로 팝오버 본문을 브랜드 로고(`OrcaLogo`) + `v${APP_VERSION}` 만 표시한다.
   - 닫힐 때 `main` 으로 리셋해 다음 열림에서 기본 메뉴를 보이게 한다.
   - `종료`는 기본 메뉴에 유지한다.

2. **토큰 교정**
   - 접힌 nav active class 를 펼친 nav active 와 동일 계열로 바꾼다.
   - shared `Button` pressed 스타일이 빨간 계열이면 variant/pressed class 를 semantic token 으로 고치되, 다른 pressed 버튼 회귀를 점검한다. 범위가 넓으면 Header 버튼 전용 className override 로 제한한다.

3. **nav 자동화 숨김 + 문서 sync**
   - `NAV` 에서 `자동화` 항목을 제거하거나 `hidden` 처리한다. Future Scope 주석은 문서에 남기되 “nav 미노출” 로 바꾼다.
   - `docs/arch/frontend/ux-domains.md`, `docs/arch/frontend/dom-architecture.md` 의 nav 항목 수/자동화 설명을 업데이트한다.

4. **Transcript titlebar 정리**
   - project name 은 이미 `SessionRow` 에서 `projectNameById` 를 합성하므로, ChatTitleBar 도 page/app 에서 projectName prop 을 받거나 chat store 의 `projectId` + 프로젝트 store 조회를 app/page 계층에서 주입하는 방식으로 cross-feature import 를 피한다. `features/chat` 가 `features/projects` 를 직접 import 하지 않는다.
   - titlebar 검색 disabled 버튼은 제거한다.
   - 케밥은 우측 패널 타일 표시 기능만 남길지, 완전히 숨길지 구현자가 현재 tile 기능과 사용자 의도를 대조해 최소 변경한다. 단 이름변경/삭제는 최근 대화 menu 에 맡기고 titlebar 에서는 제거한다.

5. **메시지 버블 overflow**
   - 일반 사용자 메시지 버블에 `min-w-0 max-w-[80%] overflow-hidden text-ellipsis` 계열을 적용한다.
   - 단, `whitespace-pre-wrap` 과 `truncate` 는 동시에 기대대로 동작하지 않을 수 있으므로 긴 단일 토큰만 ellipsis 하는 래퍼를 둔다(예: 각 줄/토큰 분리 렌더 또는 CSS `overflow-hidden` + `text-ellipsis` + `whitespace-nowrap` 를 단일 텍스트 버블 정책으로 채택). 구현자는 다중 라인 가독성 손실 여부를 보고한다.
   - pending/AskExchange/SubAgent user bubble 도 동일 정책 또는 공용 `UserBubble` 컴포넌트로 정리한다.

6. **YellowDot 제거**
   - `AssistantTurn` 에서 agentic 계산/absolute marker 렌더 제거.
   - `YellowDot.tsx` 삭제, 참조 grep 0.

7. **Composer copy**
   - `modes.ts` 설명만 수정한다. 런타임 모드 값/IPC 스키마는 변경하지 않는다.
   - placeholder 는 Open Question 응답 후 `Composer.tsx` 의 두 상태 문구를 업데이트한다.

8. **Project files hatch bg**
   - `ProjectFilesCard` 또는 `SidebarCard` 에서 파일 카드 전용 body class 를 받아 카드 내부 전체가 반복 linear-gradient 빗금 bg 를 갖게 한다.
   - 기존 disabled nav hatch 와 같은 `var(--color-border)` 기반 토큰을 재사용한다.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 버전 팝오버에서 뒤로가기/닫기: 사용자가 다시 기본 메뉴로 돌아갈 필요가 있으면 작은 뒤로 버튼을 둘 수 있으나, “브랜드로고와 앱 버전만 표시” 요구가 우선이므로 닫았다 다시 열면 기본 메뉴로 돌아가게 한다.
- 접힌 nav active a11y: `aria-current` 유지, disabled 자동화 제거로 tab stop 도 사라진다.
- project name 부재/삭제된 프로젝트: titlebar 는 `<title>` 만 표시한다.
- 긴 단일 토큰 ellipsis: hover/title 로 전체 텍스트를 볼 수 있게 하면 손실을 완화할 수 있다.
- placeholder 미확정: 구현자는 사용자 확인 없이 임의 문구를 넣지 않는다.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| `Button` pressed 스타일을 전역 수정하면 다른 pressed 버튼 시각이 바뀔 수 있음 | 우선 shared Button 의 의도된 semantic token 불일치인지 확인. 위험하면 Header 접힘 버튼 전용 override 로 제한 |
| `truncate` 는 다중 라인 메시지를 한 줄로 만들 수 있음 | 긴 단일 토큰만 ellipsis 하도록 구현하거나, 변경 범위를 사용자 버블에 한정하고 시각 확인 결과를 보고 |
| ChatTitleBar 가 project store 를 직접 import 하면 feature 교차 import 위반 가능 | app/page 계층 prop 주입 또는 chat store 내 이미 존재하는 session meta 활용. boundaries lint 로 검증 |
| textarea placeholder 값 미정 | Open Question 으로 분리. 미응답 시 변경하지 않거나 blocked 보고 |

- 되돌리기 어려운 결정: 없음(UI 문구/노출 변경).
- **단독 결정 금지 항목(Open Question)**: composer textarea placeholder 최종 문구.

## 영향 받는 파일

- `app/src/renderer/src/app/Header.tsx`
- `app/src/renderer/src/app/Sidebar.tsx`
- `app/src/renderer/src/shared/ui/Button.tsx` (필요 시)
- `app/src/renderer/src/features/chat/components/ChatTitleBar.tsx`
- `app/src/renderer/src/features/chat/components/transcript/UserMessage.tsx`
- `app/src/renderer/src/features/chat/components/transcript/PendingSteerTurn.tsx` (필요 시)
- `app/src/renderer/src/features/chat/components/transcript/AskExchange.tsx` (필요 시)
- `app/src/renderer/src/features/chat/components/rightpanel/SubAgentTileContent.tsx` (필요 시)
- `app/src/renderer/src/features/chat/components/transcript/AssistantTurn.tsx`
- `app/src/renderer/src/features/chat/components/transcript/YellowDot.tsx` (삭제)
- `app/src/renderer/src/features/chat/components/composer/modes.ts`
- `app/src/renderer/src/features/chat/components/Composer.tsx` (placeholder 확정 시)
- `app/src/renderer/src/features/projects/components/ProjectFilesCard.tsx`
- `app/src/renderer/src/features/projects/components/SidebarCard.tsx` (필요 시)
- `docs/arch/frontend/ux-domains.md`
- `docs/arch/frontend/dom-architecture.md`

## 참고 문서

- `docs/arch/frontend/layers.md` — app/pages/features/shared 레이어 경계.
- `docs/arch/frontend/ux-domains.md` — Sidebar nav 도메인 카탈로그.
- `docs/arch/frontend/dom-architecture.md` — Sidebar/Header DOM marker.
- `docs/handoff/AGENTS.md` — plan→impl→verify 상태 머신.

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- UI 변경 확인: 가능하면 `cd app && npm run dev` 로 헤더 팝오버, nav active, transcript titlebar, 긴 URL 버블, 프로젝트 파일 카드 시각 확인 및 스크린샷. 환경 제한 시 구현 보고에 명시.
- 신규 테스트 요구: 순수 로직은 거의 없으나, 버전 상수 주입이나 title 포맷 헬퍼를 분리하면 단위 테스트를 추가한다.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 분리했고, 추론은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 레퍼런스(`파일:라인`·문서)를 붙였다.
- [x] 인수 기준 — 번호가 매겨졌고, 자료조사에 근거하며, 검증 가능하다.
- [x] 의존 기술 — 의존·전제를 식별했고, 신규 의존성은 없음으로 표기했다.
- [x] 파생 UX — 빈/부재/테마/a11y/오버플로/placeholder 미확정 엣지케이스를 펼쳤다.
- [x] 리스크 — 트레이드오프와 Open Question(placeholder)을 사용자 결정으로 분리했다.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: (구현 턴에서 기입)
- 이견 / 우려: (구현 턴에서 기입)

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | (구현 턴에서 기입) |  |  |

## [구현자 기입] 구현 체크리스트

- [ ] 헤더 버전 뷰 및 버전 상수 주입
- [ ] 접힘 버튼/접힌 nav active 토큰 교정
- [ ] 자동화 nav 숨김 + 문서 sync
- [ ] transcript titlebar 포맷/검색/케밥 정리
- [ ] 긴 단일 토큰 메시지 버블 ellipsis
- [ ] YellowDot 제거
- [ ] composer 모드 설명 수정 및 placeholder Open Question 처리
- [ ] 프로젝트 파일 카드 전체 빗금 bg
- [ ] 게이트 실행 및 보고

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | (구현 턴에서 기입) |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` |
| 게이트 결과 | (구현 턴에서 기입) |
| 블로커 / 역질문 | composer textarea placeholder 문구 확인 필요 |
| 대상 커밋 | `<hash>` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 |  |  |  |  |
