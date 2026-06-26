# Plan — 0049-design-token-ui-fixes

> 비기능(UI 버그수정·디자인 토큰 정합) = Claude 직접 구현. plan → impl → verify 순차 수행.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0049-design-token-ui-fixes` |
| 작성자 | Claude Code |
| 일자 | 2026-06-26 |
| 매핑 | PHASES UI 정합 행 / PR (draft) |
| 상태 | DRAFT → READY → IMPL_DONE → verify |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | ① 앱 진입 시 InstallerDialog 출력 금지 ② nav 사이드바 footer BackendStatus 출력 금지 (둘 다 기능 구현 후 다시 노출 예정) ③ 채팅 title 영역 케밥 버튼: 클릭(press) 색이 직전 디자인 토큰 미반영 + 우측 패널 활성 시 push 색 적용; 좌측 복사 버튼은 전체 대화 클립보드 복사; 그 옆 돋보기(검색) 버튼은 비활성 표시 + bg 빗금 ④ 엔진&모델 페이지(+엔진추가 다이얼로그) 직전 디자인 토큰 미적용 검토 ⑤ 스킬&MCP 하위 페이지 직전 디자인 토큰 미적용 검토 | 라이브 세션 요청(2026-06-26) |
| 추론 의도 | "직전 디자인 토큰" = handoff 0048 의 뉴트럴 화이트 팔레트 전환 + 시맨틱 토큰 체계. 비테마 정적 `cream-*` 잔재가 화이트/다크 모두에서 어긋나므로 themed 토큰으로 치환하라는 의미(추론). 케밥 press 색 = press 표면 토큰 `t3`(추론 — 0041 의 "선택 톤 중립화" 방향과 일치). | 추론 |

## Context (왜)

설치 마법사·백엔드 상태 표시는 아직 기능이 미완성인데 앱 진입 시 모달/풋터로 노출돼 빈 기능을 보여준다(사용자 보류 요청). 채팅 타이틀바 3버튼은 디자인/동작이 불완전하다. 엔진·스킬 페이지는 0048 이전의 비테마 warm `cream-50` 표면을 남겨 다크 테마에서 깨지고 화이트 뉴트럴 팔레트와 톤이 어긋난다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 인스톨러 자동 오픈은 부팅 시 `bootstrapBackend` 가 미설치 감지로 `installerOpen:true` 셋 | `app/src/renderer/src/features/backend/store/backendStore.ts:36-53` |
| footer BackendStatus 는 `useSidebarSlots` 의 `footerSlot` 으로 주입, Sidebar `app-frame-sidebar-footer` 에 렌더 | `app/.../app/hooks/useSidebarSlots.tsx:15-22` · `app/.../app/Sidebar.tsx:174` |
| 케밥은 `Button pressed` → squish `bg-fill-selected`(=`rust-soft`, warm). 검색/복사는 raw `ICON_BTN`(neutral) — 불일치 | `app/.../features/chat/components/ChatTitleBar.tsx:12-13,60-76` · `shared/ui/Button.tsx:56-58` |
| press 표면 토큰 `--color-t3`("press (active) surface — themed") 존재, 화이트/다크 대응값 보유 | `app/.../styles/tokens.css:59,171` |
| 빗금(비활성) 관례: Sidebar `NAV_DISABLED_HATCH` = `--color-border` 기반 사선 arbitrary class | `app/.../app/Sidebar.tsx:34-35` |
| 전체 대화 직렬화: `partsText(parts)` 가 text 파트만 추출(서브에이전트 child 제외), `getActiveChatSession().messages` 로 활성 세션 접근 | `app/.../features/chat/lib/parts.ts:46-51` · `store/chatStore.ts:116-119` |
| 비테마 `cream-50` = "Static accent palette — not themed"(다크 override 없음). themed 대체는 `bg2`("Secondary surface — subtle inset/card fill on top of bg") | `app/.../styles/tokens.css:15,26-27,160` |
| 엔진/스킬 페이지의 유일한 비테마 색은 `cream-50` (paper/line/moss 등 미사용, raw hex 0) | `rg` 스캔(engine+skills) |

## 인수 기준 (Acceptance Criteria)

1. 앱 진입 시 InstallerDialog 가 자동으로 열리지 않는다(`setInstallerOpen` 액션은 유지 — 기능 완성 후 재활성 가능).
2. nav 사이드바 footer 에 BackendStatus 가 렌더되지 않으며, 빈 풋터 테두리/패딩도 남지 않는다.
3. 케밥 버튼의 press/active 색이 press 표면 토큰(`t3`) 기반으로, 우측 패널 활성(`activeTiles.length>0`) 또는 메뉴 열림 시 적용된다.
4. 케밥 좌측 복사 버튼 클릭 시 전체 대화가 마크다운으로 클립보드에 복사되고, 짧은 시각 피드백(check 아이콘)을 준다.
5. 그 옆 돋보기(검색) 버튼은 `disabled` + 빗금 배경으로 비활성 표시된다.
6. 엔진&모델 페이지·엔진추가 다이얼로그·스킬&MCP 하위 페이지의 비테마 `cream-50` 표면이 themed `bg2` 로 치환돼 화이트/다크 모두에서 정합한다.
7. 게이트 통과: lint / typecheck / test.

## 범위 / 비범위

- **범위**: 위 6개 영역의 렌더러 표현 계층(스타일/가시성/복사 동작).
- **비범위**: InstallerDialog·BackendStatus 의 기능 구현(설치 마법사·백엔드 상태) — 사용자가 기능 완성 후 재노출 예정. rust accent 토큰(themed) 은 유지(0048 가 코랄 강조 보존).

## 의존 기술 / 전제

- 재사용: `partsText`, `getActiveChatSession`, `navigator.clipboard.writeText`, 기존 시맨틱 토큰(`t3`/`t8`/`bg2`/`fill-uncontained-*`).
- 신규 의존성: 없음.

## 설계

- `backendStore.bootstrapBackend`: 자동 오픈 분기 제거(상태 조회만). 액션은 보존.
- `useSidebarSlots`: `footerSlot = null`. `Sidebar` 는 `footerSlot &&` 가드로 빈 풋터 컨테이너 미렌더.
- `ChatTitleBar`: 3버튼을 raw 버튼으로 통일. `ICON_BTN_BASE/IDLE/PRESSED/DISABLED` 상태 클래스. 케밥 press=`bg-t3 text-t8`. 복사=`copyConversation`(messages→`## 역할\n\n본문` 조인). 검색=`disabled`+빗금.
- 엔진/스킬: `cream-50`(및 `/70`·`hover:`) → `bg2`.
- 레이어 경계: 전부 동일 feature 내부 + shared 토큰. 위반 0.

## 파생 UX / 엣지케이스

- 복사: 빈 대화면 no-op(클립보드 미호출). 클립보드 거부 시 조용히 무시.
- 테마: `t3`/`bg2` 는 화이트/다크 대응값 보유 → 자동 리테마.
- a11y: 검색 `disabled`+`aria-label`, 케밥 `aria-pressed`, 복사 `aria-label`.

## 리스크 / 트레이드오프

| 리스크 | 완화 |
|---|---|
| 케밥을 Button→raw 로 바꿔 press 시맨틱 상실 | `aria-pressed` 유지, Popover anchorRef 보존 |
| BackendStatus/InstallerDialog 가 임포트 0(데드) | feature index 익스포트 유지 — 기능 완성 시 재배선 |

## 영향 받는 파일

- `app/.../features/backend/store/backendStore.ts`
- `app/.../app/hooks/useSidebarSlots.tsx` · `app/.../app/Sidebar.tsx`
- `app/.../features/chat/components/ChatTitleBar.tsx`
- `app/.../features/engine/components/{EngineModelList,EngineCard,EngineFormModal}.tsx`
- `app/.../features/skills/components/customize/{CustomizeList,McpDetail,CustomizeLanding,SkillDetail,SkillUploadModal}.tsx`

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test` (better-sqlite3 Node ABI 재빌드 후 전체 green).
- 신규 테스트: 순수 변환/표현 계층 위주라 UI 시각 검증으로 갈음(기존 테스트 무회귀).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션 요청 인용, 추론은 추론 표기.
- [x] 자료조사 — 발견마다 `파일:라인` 레퍼런스.
- [x] 인수 기준 — 번호·검증 가능.
- [x] 의존 기술 — 신규 의존성 0.
- [x] 파생 UX — 빈 대화/클립보드 거부/테마/a11y.
- [x] 리스크 — 데드 코드·press 시맨틱 트레이드오프.

---

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | backendStore.ts · useSidebarSlots.tsx · Sidebar.tsx · ChatTitleBar.tsx · engine 3 · skills 5 (총 11) |
| 실행 명령 | `npm run lint` / `typecheck` / `test` |
| 게이트 결과 | lint ✅ / typecheck ✅(node+web+test) / test ✅ 540/540 (better-sqlite3 Node ABI 재빌드 후; 1차 12-red 는 `db/queries.test.ts` ABI 환경=0019 계열, 렌더러 변경 무관) |
| 블로커 | 없음 |
| 대상 커밋 | (push 후 기재) |
