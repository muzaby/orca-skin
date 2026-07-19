# Plan — 0129-sidebar-pin-title-autosize

## 메타

| 항목 | 값 |
|---|---|
| slug | `0129-sidebar-pin-title-autosize` |
| 작성자 | Claude Code |
| 일자 | 2026-07-19 |
| 매핑 | PHASES Phase 3++ (사이드바 고정 섹션 + 제목 편집 자동 너비) / PR (draft) |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 1 | Transcript 제목 편집 활성 시, 편집 영역 너비가 **제목 길이만큼 가변**한다 | 라이브 세션 요청(2026-07-19, 첨부1 이미지 — "Title 수정 활성화 시 title 길이만큼 편집영역이 가변") |
| 명시 요구 2 | 좌측 nav "고정됨(pinned)" 에서 **프로젝트 고정 시 접기/펼치기**로 하위 대화 나열 | 라이브 세션 요청(첨부2·3 이미지) |
| 명시 요구 3 | 프로젝트/일반대화를 **항목 좌측 아이콘**으로 구분(Google Material) | 라이브 세션 요청(첨부1·2·3) |
| 명시 요구 4 | **모든 대화·프로젝트 페이지의 상단 컨트롤 아이콘 및 컨텍스트 메뉴**의 고정 항목을 배선 | 라이브 세션 요청 |
| 추론 의도 A | 고정 상태는 세션/프로젝트에 붙는 **지속 데이터** → DB 컬럼 저장 | 추론 — 사용자 질의로 확정(DB 컬럼 권장안 승인) |
| 추론 의도 B | 행 아이콘은 **고정됨 + 최근 항목 모두**에 적용 | 추론 — 사용자 질의로 확정(첨부1 최근 항목에도 아이콘) |
| 추론 의도 C | 고정 항목 정렬은 `pinned_at` 자동(수동 드래그 재정렬은 비범위) | 추론(첨부에 드래그 UI 없음) |

## Context (왜)

첨부된 Claude Desktop UI 두 지점을 Orca 에 재현한다. (1) 제목 인라인 편집 input 이
현재 `flex-1` 로 행 전체를 채워 짧은 제목에도 편집 영역이 넓게 남는다 — Claude Desktop 은
텍스트 길이에 맞춰 가변한다. (2) Orca 에는 고정(pin) 개념이 전혀 없다(DB/IPC/store/UI 부재,
프로젝트 상세 핀 버튼은 시각만·미배선). "고정됨" 섹션·접기펼치기·아이콘 구분·전 표면 배선을
새로 구현한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 제목 편집 input 은 공유 `RenameInput`(fixed/flex 폭, 자동 너비 아님). autofocus+전체선택·IME Enter 가드·Esc·blur·maxLength 보유 | `app/src/renderer/src/shared/ui/RenameInput.tsx:1-62` |
| ChatTitleBar 가 `flex-1` 로 input 을 행 전체로 늘림(display 는 truncate div) | `app/src/renderer/src/features/chat/components/ChatTitleBar.tsx:115-127` |
| 자동 크기 선례는 높이 전용(`AutoGrowTextarea`) — 폭 측정 유틸 없음 | `app/src/renderer/src/shared/ui/AutoGrowTextarea.tsx` |
| Google Material Symbols 이미 채택(inline SVG 단일 path). `chat`·`folder`·`pin`·`chevR`·`chevD` 존재 | `app/src/renderer/src/shared/ui/Icon.tsx:3-137` |
| 사이드바 "최근 대화" 헤더(`SECTION_HEAD`)+세션 슬롯. 고정 섹션은 이 위 형제로 삽입 | `app/src/renderer/src/app/Sidebar.tsx:40,168-171` |
| 사이드바 slot 은 app 레이어에서 안정 identity 로 합성(memo 보존) | `app/src/renderer/src/app/hooks/useSidebarSlots.tsx`, `.../useSessionHandlers.ts` |
| 세션 행(좌측 아이콘 없음, kebab rename/delete). `group/session` hover 격리 | `app/src/renderer/src/features/sessions/components/SessionRow.tsx:94-170` |
| 프로젝트 상세 핀 버튼 미배선(onClick 없음, "시각만") | `app/src/renderer/src/features/projects/components/ProjectInfoHero.tsx:37-56` |
| 프로젝트 카드(컨텍스트 메뉴 없음, folder 아이콘+이름) | `app/src/renderer/src/features/projects/components/ProjectsScreen.tsx:69-92` |
| 세션/프로젝트 store 는 `initX()` 후 mutation→refresh 패턴(zustand) | `.../features/sessions/store/sessionsStore.ts`, `.../features/projects/store/projectsStore.ts` |
| 프로젝트 하위 세션 조회 훅(고정 프로젝트 펼침에 재사용) | `app/src/renderer/src/features/sessions/hooks/useProjectSessions.ts` |
| IPC 계약: CHANNELS 상수·zod 스키마·핸들러·preload·DTO 5지점 | `app/src/shared/ipc.ts:39-49`, `shared/protocol.ts:202-224`, `src/main/app/handlers/{session,project}.ts`, `preload/index.ts:144-166`, `src/main/infra/ipc/dto.ts:11-30` |
| DB row·query: `listSessions`(`ORDER BY updated_at DESC`)·`listSessionsByProject`·`listProjects`·`getSessionById`. `SessionListRow`/`ProjectRow` | `src/main/infra/db/queries.ts:104-114,342-376,466-467`, `src/main/infra/db/types.ts:32-45,170` |
| 마이그레이션 = append-only, `ALTER TABLE ADD COLUMN` 선례 | `src/main/infra/db/migrations/0007_title_source.sql`, `0002_projects.sql` |
| main feature 교차 import 금지·renderer 4-layer boundaries(eslint 강제) | `app/src/main/AGENTS.md`, `app/AGENTS.md` |
| `field-sizing: content` = Electron 39(Chromium) 지원. Tailwind arbitrary `[field-sizing:content]` 로 표현(새 CSS 파일 금지 규약) | `app/AGENTS.md` §스타일링, Electron 39.x 스택 |

## 인수 기준 (Acceptance Criteria)

1. Transcript 제목 편집 진입 시 input 폭이 텍스트 길이에 맞춰 가변(타이핑 중 증감)하고,
   컨테이너 최대폭을 넘지 않으며 최소폭이 있어 빈 값에서 0폭 붕괴가 없다. 기존 동작
   (autofocus+전체선택, IME 조합중 Enter 가드, Esc 취소, blur 커밋, maxLength) 유지.
   사이드바 `SessionRow` 인라인 편집도 동일 자동 너비.
2. `sessions.pinned_at` / `projects.pinned_at`(INTEGER, NULL 허용) 컬럼이 마이그레이션
   `0015` 로 추가되고, `SessionListItem` / `Project` DTO 에 `pinnedAt: number | null` 이 노출된다.
3. 세션·프로젝트 고정/해제 IPC(`orca:session:setPinned`·`orca:project:setPinned`)가 추가되어
   store 액션으로 토글되고 목록이 갱신된다(zod 검증·검증 실패 정책 준수).
4. 좌측 nav 에 "고정됨" 섹션이 최근 대화 위에 렌더(고정 항목이 하나라도 있을 때만).
   고정 프로젝트는 폴더 아이콘 + chevron 으로 접기/펼치기되어 하위 대화를 나열하고,
   고정 대화는 말풍선 아이콘 행으로 나열된다.
5. 모든 대화 행(고정됨·최근 항목)에 말풍선 아이콘, 프로젝트 행에 폴더 아이콘이 좌측 표시.
6. 고정/해제가 (a) `ChatTitleBar`(컨트롤 아이콘 + kebab 메뉴), (b) 사이드바 `SessionRow`
   kebab 메뉴, (c) `ProjectInfoHero` 핀 버튼, (d) `ProjectCard` 에서 동작하고, 현재 고정
   상태가 각 컨트롤에 반영(pressed/라벨)된다.
7. 게이트: `cd app && npm run lint && npm run typecheck` 통과(양쪽 0 error). DB 로드 스위트
   red 는 egress 차단 베이스라인으로 분리 보고(`app/AGENTS.md`).
8. IPC 변경이 `docs/IPC_CONTRACT.md` 에 반영되고 `docs/PHASES.md`/`INDEX.md` 갱신.

## 범위 / 비범위

- **범위**: 인수 기준 1~8 — 제목 자동 너비 + 고정 데이터 계층(DB/IPC/store) + 고정됨
  사이드바 섹션(아이콘·접기펼치기) + 4개 표면 배선 + 행 아이콘.
- **비범위**: 고정 항목 수동 드래그 재정렬(정렬은 `pinned_at` 자동), 고정 프로젝트 펼침
  상태 영속(초기 세션 내 로컬 state), 접힌 사이드바(icon-only)에서의 고정 표시.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈 재사용: `Icon`(chat/folder/pin/chevR/chevD), `RenameInput`, `SessionRow`,
  `useProjectSessions`, `MenuItem`/`Popover`/`Button`, zustand store init→refresh 패턴,
  IPC `handle`/`handlePlain` + zod, better-sqlite3 prepared statements.
- CSS: `field-sizing: content`(Electron 39 Chromium 지원) — Tailwind arbitrary 유틸로 표현.
- **신규 의존성 없음**(0 packages). 새 CSS 파일 없음(arbitrary 유틸만).

## 설계

### A. 제목 편집 자동 너비 (`RenameInput`)
- `RenameInput` 에 `autoSize?: boolean` 추가. true 면 input 에 `[field-sizing:content]` +
  `min-w-[3ch]` + `max-w-full` + `size={1}` 적용(콘텐츠 폭, JS 측정·CSP 무관).
  keydown/blur/focus/select 로직 불변.
- `ChatTitleBar`: input className 에서 `flex-1` 제거 → `max-w-full` + `autoSize` 전달.
- `SessionRow`: 인라인 편집 시 `autoSize` 사용(행 폭 내 가변).

### B. 고정 데이터 계층
- 마이그레이션 `0015_pinned.sql`: `ALTER TABLE sessions ADD COLUMN pinned_at INTEGER;` +
  `ALTER TABLE projects ADD COLUMN pinned_at INTEGER;`.
- DB `types.ts`: `SessionListRow`·`SessionRow`(getById)·`ProjectRow` 에 `pinned_at: number | null`.
- DB `queries.ts`: 4개 SELECT(`listSessions`·`getSessionById`·`listSessionsByProject`·
  `listProjects`)에 `pinned_at` 추가 + `setSessionPinned(id, pinnedAt|null)`·
  `setProjectPinned(id, pinnedAt|null)` prepared stmt.
- DTO `infra/ipc/dto.ts`: `toSessionListItem`/`toProject` 에 `pinnedAt` 매핑.
- shared `ipc.ts`: `SessionListItem`·`Project` 에 `pinnedAt: number | null`; CHANNELS 에
  `sessionSetPinned`·`projectSetPinned`.
- `protocol.ts`: `SetSessionPinnedSchema{sessionId, pinned:boolean}`·`SetProjectPinnedSchema{id, pinned:boolean}`.
- 핸들러 `app/handlers/{session,project}.ts`: `pinned ? Date.now() : null` 로 DB 호출('reject' 정책).
- preload + renderer api: `session.setPinned(id, pinned)`·`project.setPinned(id, pinned)`.
- store: `sessionsActions.setPinned`·`projectsActions.setPinned` → api 후 refresh.

### C. 고정됨 사이드바 섹션
- 신규 `features/sessions/components/PinnedSection.tsx`(presentational). `Project` 타입만
  shared 에서 import(경계 위반 없음). props: `pinnedProjects: Project[]`(app 주입),
  `currentSessionId`, `projectNameById`, 핸들러(select/unpin session·project). 고정 세션은
  `sessionsStore.list` 에서 `pinnedAt != null` 자체 선택.
  - 고정 프로젝트 행: 폴더 아이콘 + `chevR/chevD` 토글(로컬 `expanded` Set). 펼치면
    `useProjectSessions(projectId)` 로 하위 세션을 들여쓰기 `SessionRow`.
  - 고정 대화 행: `SessionRow`(말풍선 아이콘, projectName prefix 없음).
- `Sidebar` 에 `pinnedSlot?: ReactNode` → 최근 대화 헤더 위 "고정됨" 헤더(`SECTION_HEAD`,
  i18n `sidebar.pinned`)와 함께 렌더(항목 존재 시).
- `useSidebarSlots` 가 `pinnedSlot` 합성(안정 identity), `useSessionHandlers` 가 고정
  데이터·핸들러 제공(app 이 cross-feature wiring — boundaries 준수).

### D. 행 아이콘 + 고정 배선 표면
- `SessionRow`: 라벨 span 앞 `leadingIcon?: IconName`(기본 `'chat'`); kebab 에 고정/해제
  `MenuItem`(icon `pin`) + `onTogglePin?`+`pinned?` prop. `SessionList` → 고정 토글 배선.
- `ChatTitleBar`: 복사 옆 고정 아이콘 버튼(`leadingIcon="pin"`, `pressed`) **및** kebab
  고정/해제 `MenuItem`. 현재 세션 `pinnedAt` sessionsStore selector 파생 → `onTogglePinSession`.
- `ProjectInfoHero`: 기존 핀 버튼 `onClick`(projectsStore.setPinned) + `pressed`(intra-feature).
- `ProjectsScreen` `ProjectCard`: hover 고정 토글 아이콘(카드 내부 stopPropagation);
  `ProjectsView` 가 `projectsActions.setPinned` 주입.
- i18n: `sidebar.pinned`, `common.pin`/`common.unpin` 을 `ko.ts`/`en.ts` 양쪽 추가.

### 레이어 경계 준수
- 고정 섹션이 프로젝트+세션(2 feature) → 데이터·핸들러는 app 레이어가 주입, 컴포넌트는
  features/sessions 에 두고 cross-feature 값은 props-only. main 은 슬라이스 교차 없이 각
  도메인 핸들러에서 자기 DB 메서드 호출.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 빈 상태: 고정 항목 0 → "고정됨" 섹션 자체 미렌더.
- 고정 프로젝트 펼침 중 하위 세션 로딩/빈 목록(`useProjectSessions.loading`) 처리.
- 프로젝트/세션 삭제 시 행 CASCADE/SET NULL → 다음 refresh 에 고정 목록 자연 정리.
- 접근성: 고정 토글 `aria-pressed`/`aria-label`, chevron `aria-expanded`.
- 테마: 시맨틱 토큰만(라이트/다크 자동). hover 격리 `group/session` 유지, 프로젝트 행은
  신규 `group/pinproj`.
- 자동 너비 input: `field-sizing` 극단 미지원 대비 `max-w-full`+min-width 로 붕괴 방지.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 마이그레이션 0015 append-only(되돌리기 불가) | 널러블 컬럼이라 하위호환 안전; 스키마 최소 변경 |
| `field-sizing: content` 신규 CSS | Electron 39 Chromium 지원; min/max 폭 폴백 |
| egress 차단 시 DB 로드 테스트 red | `app/AGENTS.md` 가이드대로 베이스라인 분리 보고; lint+typecheck 1차 게이트 |
| 고정 섹션 cross-feature 결합 | app 레이어 props-only 주입으로 boundaries 위반 회피 |

- 되돌리기 어려운 결정: 마이그레이션 0015 컬럼 스키마(사용자 승인 — DB 컬럼 채택).
- 단독 결정 금지 항목(Open Question): 없음(핵심 2건 사용자 질의로 확정).

## 영향 받는 파일

- 제목: `app/src/renderer/src/shared/ui/RenameInput.tsx`,
  `.../features/chat/components/ChatTitleBar.tsx`, `.../features/sessions/components/SessionRow.tsx`
- 데이터: `app/src/main/infra/db/migrations/0015_pinned.sql`,
  `app/src/main/infra/db/{types,queries}.ts`, `app/src/main/infra/ipc/dto.ts`,
  `app/src/shared/ipc.ts`, `app/src/shared/protocol.ts`,
  `app/src/main/app/handlers/{session,project}.ts`, `app/src/preload/index.ts`,
  `app/src/renderer/src/shared/api/ipc.ts`
- store: `.../features/sessions/store/sessionsStore.ts`, `.../features/projects/store/projectsStore.ts`
- 사이드바: `.../app/Sidebar.tsx`, `.../app/hooks/useSidebarSlots.tsx`,
  `.../app/hooks/useSessionHandlers.ts`, `.../features/sessions/components/PinnedSection.tsx`(신규),
  `.../features/sessions/components/SessionList.tsx`, `.../features/sessions/index.ts`(배럴)
- 표면: `.../features/projects/components/{ProjectInfoHero,ProjectsScreen,ProjectsView}.tsx`
- i18n: `.../shared/i18n/resources/{ko,en}.ts`
- 문서: `docs/IPC_CONTRACT.md`, `docs/PHASES.md`, `docs/handoff/INDEX.md`

## 참고 문서

- `docs/IPC_CONTRACT.md`(§ session·project 도메인 — setPinned 채널 2종 추가, §6 변경 절차)
- `docs/arch/frontend/`(4-layer·DOM 마커), `app/AGENTS.md`(스타일·마이그레이션 append-only)
- `app/src/main/AGENTS.md`(main 레이어 경계)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck`(ABI-중립). `npm test` 는 순수
  스위트 위주 확인, IPC 스키마/DTO 순수 변환 테스트 동반 가능. DB 로드 스위트 red 는
  egress 베이스라인 분리 보고.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용, 추론은 추론으로 표기(사용자 질의 확정 명시).
- [x] 자료조사 — 모든 발견에 `파일:라인` 레퍼런스.
- [x] 인수 기준 — 번호·검증가능·자료조사 근거.
- [x] 의존 기술 — 재사용 모듈 식별, 신규 의존성 0 명시.
- [x] 파생 UX — 로딩/빈상태/삭제 정리/접근성/테마/자동너비 폴백 전개.
- [x] 리스크 — append-only·field-sizing·egress·cross-feature 트레이드오프, Open Question 없음 확인.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다(본 핸드오프는 Claude 직접 구현).

## [구현자 기입] 설계 리뷰 (비판적)

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

## [구현자 기입] 구현 체크리스트

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` |
| 게이트 결과 | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `<hash>` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)
