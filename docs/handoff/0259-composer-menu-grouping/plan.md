# Plan — 0259-composer-menu-grouping

## 메타

| 항목 | 값 |
|---|---|
| slug | `0259-composer-menu-grouping` |
| 작성자 | Claude Code |
| 일자 | 2026-10-12 |
| 매핑 | 사용자 라이브 세션 (`/handoff-plan`) — 9개 요청 중 `*` 항목. 나머지는 0256·0257·0258 |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 컴포저 '+' 메뉴는 '첨부'와 'Skill' 두 줄뿐이고, 'Skill' 은 입력창에 `/` 만 넣는다(`AttachMenu.tsx:9-20` · `ComposerInputController.tsx:190-200`). 스킬·플러그인을 고르려면 이름을 알고 타이핑해야 하며 `/` 자동완성은 출처 구분 없는 평면 목록이다.
- 완료 후 달라지는 것: '+' 메뉴가 첨부 10처럼 '파일 또는 사진 추가 / 스킬 ▸ / 플러그인 ▸' 계층으로 바뀌고, 스킬은 출처별로, 플러그인은 목록과 '플러그인 관리'로 정돈된다. `/`·`@` 자동완성은 섹션 헤더로 묶인다.
- 성공을 사용자 관점에서 한 문장으로: '+' 를 눌러 스킬 ▸ 출처 ▸ 스킬을 고르면 입력창에 `/스킬이름 ` 이 들어가고, 항목에 마우스를 올리면 설명이 툴팁으로 보인다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "스킬, 플러그인 등 컴포저에서 팝업되는 메뉴에 대해서 첨부 이미지처럼 그룹화 및 정돈되는 형태로 변경하라. 10번째 첨부이미지 참고." | 사용자 턴 1 |
| 명시 요구 | 범위 = "+메뉴 계층화+자동완성 정돈" — "'+' 메뉴를 '파일 추가 / ─ / 스킬 ▸(출처별 ▸ 스킬) / 플러그인 ▸(플러그인 목록 · 플러그인 관리)'로 계층화하고, '/'·'@' 자동완성 목록은 출처·종류별 섹션 헤더로 정돈한다. 항목 hover 시 설명을 검은 툴팁으로 보인다." | 사용자 턴 2 (질의 응답) |
| 추론 의도 | 첨부 10의 '커넥터·디자인 시스템·기기·연구' 는 Orca에 대응 기능이 없다 — 승인된 구조에도 없다 | 승인 문장 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | '+' 메뉴 최상위 = '파일 또는 사진 추가' · 구분선 · '스킬 ▸' · '플러그인 ▸' | 승인 구조 + 첨부 10 첫 항목 문구 | 사용자 턴 2 | ACTIVE | — |
| D-002 | '스킬 ▸' 하위 = 출처 라벨별 그룹 ▸ 스킬 이름. 스킬을 고르면 커서 자리에 `/이름 ` 을 넣고 메뉴를 닫는다 | "스킬 ▸(출처별 ▸ 스킬)" · 결과는 기존 `/` 자동완성 선택과 같은 토큰 | 사용자 턴 2 | ACTIVE | — |
| D-003 | '플러그인 ▸' 하위 = 플러그인 목록 · 구분선 · '플러그인 관리'. 플러그인을 고르면 `@id ` 를 넣고, '플러그인 관리' 는 플러그인 페이지(`/plugins`, 첫 탭 = 플러그인)로 간다 | "플러그인 ▸(플러그인 목록 · 플러그인 관리)" · `INITIAL_CATALOG_SELECTION.tab = 'providers'` | 사용자 턴 2 / 코드 | ACTIVE | — |
| D-004 | `/` 자동완성은 출처 라벨 섹션 헤더로, `@` 자동완성은 기존 종류 헤더로 묶고, 두 헤더는 한 컴포넌트를 쓴다. 서브메뉴로 바꾸지 않는다 | "'/'·'@' 자동완성 목록은 출처·종류별 섹션 헤더로 정돈" | 사용자 턴 2 | ACTIVE | — |
| D-005 | 메뉴의 스킬·플러그인 항목은 `title` 로 설명을 준다 — 스킬 = `설명⏎출처 라벨`(설명 없으면 출처만), 플러그인 = 라벨. 검은 표면은 0257 `TooltipHost` 가 그린다 | "항목 hover 시 설명을 검은 툴팁으로" · 첨부 10 툴팁(설명 + 'Design 플러그인') | 사용자 턴 2 / 0257 D-005 | ACTIVE | — |
| D-006 | 메뉴 데이터는 기존 출처를 쓴다: 스킬 = `useSkills()`(현 `/` 자동완성과 같은 집합), 플러그인 = `pluginMentionCandidates`(현 `@` 후보와 같은 집합) | 메뉴와 자동완성이 다른 목록을 보이면 안 된다 | 설계자 | ACTIVE | — |
| D-007 | 하위 메뉴는 hover 150ms 또는 클릭·→·Enter로 열리고 ←·Esc로 닫힌다. 최상위 Esc는 메뉴를 닫고 '+' 버튼으로 포커스를 돌린다. 바깥 클릭은 전부 닫는다 | 데스크톱 계단식 메뉴 관례 | 설계자 | ACTIVE | — |
| D-008 | 하위 패널은 부모 항목 오른쪽 4px, 오른쪽 공간이 없으면 왼쪽, 아래가 모자라면 위로 밀고, 화면 높이를 넘으면 스크롤 | 첨부 10 배치 | 실측 / 설계자 | ACTIVE | — |
| D-009 | 빈 그룹은 비활성 한 줄('사용 가능한 스킬 없음'·'사용 가능한 플러그인 없음')로 보인다. '플러그인 관리' 는 항상 있다 | 하위 메뉴가 비어 열리면 고장처럼 보인다 | 설계자 | ACTIVE | — |
| D-010 | '플러그인 관리' 이동은 페이지가 콜백(`onManagePlugins`)으로 주입한다 | `onOpenUsageSettings` 선례 — Composer를 Router 없이 다루는 테스트가 9파일이다 | 설계자 | ACTIVE | — |
| D-011 | 메뉴 틀은 도메인 무관 `shared/ui/CascadeMenu` 로 만들고, 항목 트리는 `features/chat/lib/attachMenuModel.ts` 순수 함수가 만든다 | 키보드·배치 규칙을 단위 테스트하려면 렌더와 분리해야 한다 | 설계자 | ACTIVE | — |
| D-012 | 비범위: 커넥터(MCP)·디자인 시스템·기기·연구 그룹 · 비활성 스킬 필터 변경 · 단축키(Ctrl+U) · 메뉴 안 검색 | 승인 구조 밖 / 현행 집합 유지(D-006) | 설계자 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-012 (신규 handoff).
- 변경된 결정: 없음.
- 기존 ACTIVE 중 언급되지 않았지만 유지되는 결정: 0257 D-005(툴팁 호스트)를 D-005가 소비한다.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-001 ↔ AC1 · D-002 ↔ AC2 · D-003 ↔ AC3 · D-004 ↔ AC9·AC10 · D-005 ↔ AC5 · D-006 ↔ AC2·AC3 · D-007 ↔ AC6·AC7 · D-008 ↔ AC8 · D-009 ↔ AC4 · D-010 ↔ AC3 · D-011 ↔ AC6·AC8 · D-012 ↔ AC1(최상위 항목 4개 고정)·§6.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 — 고를 수단이 타이핑뿐이다 | `AttachMenu.tsx:16-18` 'Skill' = `/` 삽입 |
| 이미 기존 코드가 충족하는가 | `@` 자동완성은 종류 헤더가 이미 있다(`MentionAutocomplete.tsx:46-48`). `/` 는 없다 | 열람 |
| 더 작은 해법이 있는가 | 기존 `Popover` 는 한 단계 패널뿐이다(`placement` top·bottom). 계단식은 새 틀이 필요하다 | `Popover.tsx:9-17` |
| 선행 자료의 주장을 코드와 대조했는가 | 스킬 출처는 2개 root(`Orcinus orca 스킬` · `CLAUDE 스킬`)이고 목록은 출처·이름 순 정렬로 온다 | `bootstrap.ts:200-215` · `scan.ts:107-109` |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 없음 — `/` 자동완성 선택 결과·`@` 삽입 규칙을 그대로 쓴다 | `ComposerInputController.tsx:202-249` |

- 사용자에게 올릴 결정: 없음(범위 질의 완료 — D-001~D-005).
- 코드 조사로 닫은 사실: `Composer`·컨트롤러를 Router 없이 다루는 테스트 9파일(§8 전수 표) — 컴포저 안에서 `useNavigate` 를 부르면 그 테스트가 깨진다(D-010 근거).

## 5. 동작 / 사용자 흐름

```text
[+ 클릭] → 최상위: 파일 또는 사진 추가 / ─ / 스킬 ▸ / 플러그인 ▸
  ├ 파일 또는 사진 추가 → OS 파일 선택(현행)
  ├ 스킬 ▸ (hover 150ms·클릭·→) → [Orcinus orca 스킬 ▸, CLAUDE 스킬 ▸] → 스킬 목록
  │     └ 스킬 클릭/Enter → 입력창 커서 자리에 "/이름 " → 메뉴 닫힘 → 입력창 포커스
  └ 플러그인 ▸ → [Confluence, Jira, …] / ─ / 플러그인 관리
        ├ 플러그인 클릭 → "@id " 삽입 → 닫힘
        └ 플러그인 관리 → /plugins 이동 → 닫힘
[입력창 '/'] → 출처 헤더별로 묶인 후보 · [입력창 '@'] → 플러그인 / ./경로 헤더(같은 헤더 모양)
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| '+' 클릭 | 최상위 패널 열림, 첫 항목 포커스 없음(마우스) | 4행 메뉴 |
| 하위 항목 hover 150ms | 그 하위 열림, 형제 하위 닫힘 | 오른쪽에 패널 |
| 하위 항목 hover 150ms 전에 이탈 | 열지 않음 | 변화 없음 |
| ↓/↑ | 같은 패널 안 이동(구분선·비활성 건너뜀, 끝에서 순환) | 포커스 링 이동 |
| → 또는 Enter(하위 항목) | 하위 열고 첫 항목 포커스 | 하위 패널 |
| ← 또는 Esc(하위 안) | 하위 닫고 부모 항목 포커스 | 한 단계 위 |
| Esc(최상위) · 바깥 클릭 | 전부 닫힘, '+' 버튼 포커스(키보드일 때) | 메뉴 사라짐 |
| 스킬·플러그인 선택 | 토큰 삽입, 닫힘, 입력창 포커스·커서 = 토큰 뒤 | 입력창에 `/이름 `·`@id ` |
| 스킬 0개 / 플러그인 0개 | 비활성 안내 행 | '사용 가능한 … 없음' |
| 조합(IME) 중 | 삽입 거부(현행 `compositionActive` 규칙) | 변화 없음 |
| 창 크기 변경(메뉴 열림) | 최상위 재배치(Popover 현행) · 하위는 다시 열 때 재계산 | 화면 안 |

### 파생 UX / 엣지케이스

- 스킬 설명 툴팁: 0257 이전에는 OS 기본 툴팁으로 보인다 — 0257 → 0259 순서로 구현한다(INDEX 비고).
- 긴 스킬 목록(수십 개): 하위 패널 최대 높이 = 화면 높이 − 16px, 내부 스크롤.
- 같은 이름의 스킬이 두 출처에 있으면 각 출처 그룹에 따로 보인다 — 삽입 토큰은 이름이라 같다(현행 자동완성과 같은 한계).
- a11y: `role="menu"`·`menuitem`·`aria-haspopup="menu"`·`aria-expanded`, 구분선 `role="separator"`.

## 6. 범위 / 비범위

- **범위**: `CascadeMenu`(shared/ui) · 메뉴 트리 순수 함수 · '+' 메뉴 교체 · 토큰 삽입 helper · `onManagePlugins` 배선 · `/` 출처 헤더 · 자동완성 헤더 공용화 · 문구·테스트.
- **비범위**: D-012.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| MCP 서버 그룹(첨부 10 '커넥터') | 아니오 — 트리 함수에 그룹 추가 | 요청 시 |
| 메뉴 안 검색 | 아니오 | 요청 시 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | '+' 메뉴 최상위는 순서대로 '파일 또는 사진 추가' · 구분선 · '스킬'(하위 표시) · '플러그인'(하위 표시) 4행이다 | `attachMenuModel` UT(트리 모양·순서·kind) · `CascadeMenu` render UT(`role`·`aria-haspopup`) | `ComposerInputController` → `AttachMenu` → `CascadeMenu` |
| R-01 | AT-02 / AC2 | '스킬' 하위는 입력 스킬 목록의 출처 라벨별 그룹(입력 순서 유지)이고, 각 그룹 하위는 그 출처의 스킬 이름이다. 스킬을 고르면 커서 자리에 `/이름 ` 이 들어간다: 빈 입력 → `/이름 ` · 공백으로 끝남 → 그대로 이어 붙임 · 글자 뒤 → 앞에 공백 1개 · 커서 뒤가 공백이면 뒤 공백을 더하지 않는다. 메뉴가 닫히고 커서는 토큰 뒤다 | 트리 UT(2출처 3스킬 픽스처) · `insertComposerToken` 순수 UT(4경우) · 컨트롤러 배선 UT(선택 → 스냅샷 텍스트) | 메뉴 선택 → `updateSnapshot` → `focus` |
| R-01 | AT-03 / AC3 | '플러그인' 하위는 `@` 후보와 같은 플러그인 목록 · 구분선 · '플러그인 관리' 다. 플러그인을 고르면 `@id ` 가 같은 공백 규칙으로 들어간다. '플러그인 관리' 는 주입 콜백을 1회 부르고 메뉴를 닫으며, 프로덕션 페이지 5자리가 `navigate('/plugins')` 콜백을 넘긴다 | 트리 UT · 삽입 UT · 원문 UT: 페이지 5자리·중계 4자리 prop 전달 | 메뉴 → `onManagePlugins` → `navigate('/plugins')` |
| R-01 | AT-04 / AC4 | 스킬 0개면 '스킬' 하위에 비활성 '사용 가능한 스킬 없음' 1행, 플러그인 0개면 비활성 '사용 가능한 플러그인 없음' + 구분선 + '플러그인 관리' | 트리 UT | 같음 |
| R-01 | AT-05 / AC5 | 스킬 항목 `title` = `설명\n출처 라벨`(설명이 비면 출처 라벨만), 플러그인 항목 `title` = 라벨 | 트리 UT + render UT(`title` 속성) | `CascadeMenu` 항목 → (0257) `TooltipHost` |
| R-02 | AT-06 / AC6 | 키보드: ↓/↑ 같은 패널 이동(구분선·비활성 건너뜀, 순환) · →/Enter/Space 하위 열고 첫 활성 항목 · ←/Esc 하위 닫고 부모 항목 · 최상위 Esc 전체 닫힘 + '+' 버튼 포커스 · Enter/Space 동작 항목 실행 | `cascadeMenuState` 순수 reducer UT(키 표 구동) | `CascadeMenu` `onKeyDown` |
| R-02 | AT-07 / AC7 | 마우스: 하위 항목 hover 150ms 후 열림·이전 이탈 시 안 열림·형제 하위 닫힘 · 하위 패널 안 mousedown은 메뉴를 닫지 않음 · 바깥 mousedown은 전부 닫음 | reducer UT(hover 타이머) · `CascadeMenu` UT(stub document mousedown: 하위 패널 안 대상 → 열림 유지, 밖 → 닫힘) | `CascadeMenu` |
| R-02 | AT-08 / AC8 | 하위 패널 좌표: 기본 `left = 항목.right + 4` · 넘치면 `left = 항목.left − 4 − 폭` · `top = 항목.top − 4`, 아래가 넘치면 `top = max(8, 화면높이 − 8 − 높이)` · 최대 높이 `화면높이 − 16` | `submenuPosition` 순수 UT(오른쪽·왼쪽 뒤집기·아래 밀기·최대 높이 4경우) | `CascadeMenu` 배치 |
| R-03 | AT-09 / AC9 | `/` 자동완성 후보는 출처 라벨 헤더 아래 묶이고, 화면 위→아래 순서와 키보드 활성 인덱스 순서가 같다 | `groupSkillSuggestions` UT(인덱스 연속) · render UT(헤더 텍스트·`aria-selected` 위치) | `SkillAutocomplete` |
| R-03 | AT-10 / AC10 | `/` 와 `@` 자동완성 헤더가 같은 `AutocompleteSectionHeader` 를 쓴다 | 원문 UT(두 파일 import) + render 클래스 동일 | 두 자동완성 |
| R-03 | AT-11 / AC11 | 기존 자동완성 동작(`/` 필터·Enter/Tab 선택·Esc 해제·`@` 경로 탐색)은 그대로다 | 기존 `autocompleteKeys.test.ts` · `MentionAutocomplete.render.test.ts` · `ComposerInputController.test.ts` green | 컴포저 |
| R-01~R-03 | AT-12 / AC12 | 실제 앱에서 첨부 10과 비교: 계단식 메뉴 · 하위 패널 위치 · hover 툴팁(0257 이후 검은색) · 키보드 탐색 · 삽입 결과 | 사람 실기 — `npm run dev` | 앱 실행 |
| 전체 | AT-13 / AC13 | lint·typecheck 0 오류, 관련 vitest green | §19 | 전체 |

### AC 검증 주의사항

- 기존 테스트 재사용: `autocompleteKeys.test.ts` · `MentionAutocomplete.render.test.ts` · `ComposerInputController.test.ts` · `composerWiring.test.ts` 존재 확인 — 회귀로 쓴다. 'Skill' 메뉴 항목을 단언하는 테스트는 없다(`rg -n "'Skill'" app/src/renderer --glob '*.test.*'` → 0).
- 사람 실기 항목: AC12만 — 픽셀 배치·체감. 트리·키보드·좌표·삽입은 순수 UT로 잠근다.
- N회 기준(AC3): `onManagePlugins` 를 만드는 프로덕션 자리 = 페이지 5(ChatPage 1 · NewChatLandingPage 2 · ProjectLandingPage 2), 중계 = 4(ChatView · ChatTile · Composer · ComposerInputController) — `onOpenUsageSettings` 배선(`rg -n onOpenUsageSettings app/src/renderer/src --glob '!*.test.*'`)과 같은 자리.

## 7-A. V / Trace Matrix

- V mode 판정: 상속할 V 없음 → Baseline V.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED` 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §5 '+' 메뉴 계층과 선택 결과(D-001~D-003·D-005·D-006·D-009) | NEW | — |
| R-02 | R | §5 계단식 상호작용(D-007·D-008) | NEW | — |
| R-03 | R | §5 자동완성 정돈(D-004) | NEW | — |
| AT-01..AT-13 | AT | §7 | NEW | — |
| SD-01 | SD | §5 '+' → 하위 → 선택 → 삽입 → 포커스 | NEW | — |
| ST-01 | ST | 컨트롤러 배선 UT(메뉴 선택 → 스냅샷) | NEW | — |
| AR-01 | AR | §10 EP-05 `onManagePlugins` 배선(페이지 → 컴포저) | NEW | — |
| AR-02 | AR | §10 EP-04 `useMentionAutocomplete` → 메뉴 플러그인 목록 공유 | NEW | — |
| IT-01·IT-02 | IT | §11 | NEW | — |
| MD-01 | MD | `attachMenuModel` 트리 | NEW | — |
| MD-02 | MD | `cascadeMenuState` reducer · `submenuPosition` | NEW | — |
| MD-03 | MD | `insertComposerToken` | NEW | — |
| MD-04 | MD | `groupSkillSuggestions` · 헤더 공용 | NEW | — |
| UT-01..UT-04 | UT | §11 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01..AT-05 | REQUIRED | '+' → `AttachMenu`(`buildAttachMenu`) → `CascadeMenu` → 선택 → `insertComposerToken` / `onManagePlugins` | AC1~AC5 UT | **required** — 형제 슬롯. S1 '스킬'·'플러그인' 하위 내용 맞바꿈 · S2 삽입 토큰 접두 `/`↔`@` 맞바꿈 | EP-01 (4) · EP-02 (1) · EP-05 (9) |
| VP-02 | R-02 ↔ AT-06..AT-08 | REQUIRED | `keydown`/`pointerenter` → reducer → 열림 경로 → `submenuPosition` | AC6~AC8 UT | **required** — K1 ←가 하위를 닫지 않음 · K2 오른쪽 넘침 시 뒤집기 생략 | EP-03 (3) |
| VP-03 | R-03 ↔ AT-09..AT-11 | REQUIRED | `useSkillAutocomplete` → `groupSkillSuggestions` → `SkillAutocomplete` 헤더 · `MentionAutocomplete` 헤더 | AC9~AC11 UT | **required** — G1 그룹 안 정렬로 인덱스 순서 깨기 | EP-06 (3) |
| VP-04 | R-01~R-03 ↔ AT-12 | REQUIRED | 앱 실행 | 사람 실기 | not selected | 0 — 기계 경로는 VP-01~VP-03 |
| VP-05 | SD-01 ↔ ST-01 | REQUIRED | 메뉴 선택 → 컨트롤러 콜백 → `updateSnapshot(insert…)` → `focus(caret)` | 컨트롤러 UT(스냅샷 텍스트·커서) | **required** — S2 | EP-02 (1) |
| VP-06 | AR-01 ↔ IT-01 | REQUIRED | 페이지 `navigate` → ChatView → ChatTile → Composer → Controller → AttachMenu | 원문 UT(9자리 전달) + AttachMenu 콜백 UT | **required** — W1 `ProjectLandingPage` 의 Composer 자리에서 prop 누락 | EP-05 (9) |
| VP-07 | AR-02 ↔ IT-02 | REQUIRED | `useMentionAutocomplete` → `plugins` → `buildAttachMenu` | 훅 반환·트리 UT | not selected — 같은 함수(`pluginMentionCandidates`) 재사용을 직접 관측 | EP-04 (1) |
| VP-08 | MD-01 ↔ UT-01 | REQUIRED | `buildAttachMenu` | 트리 UT | **required** — S1 | EP-01 (4) |
| VP-09 | MD-02 ↔ UT-02 | REQUIRED | reducer · 좌표 | 표 UT | **required** — K1·K2 | EP-03 (3) |
| VP-10 | MD-03 ↔ UT-03 | REQUIRED | `insertComposerToken` | 4경우 UT | **required** — S2 · S3 앞 공백 규칙 제거 | EP-02 (1) |
| VP-11 | MD-04 ↔ UT-04 | REQUIRED | 그룹·헤더 | UT | **required** — G1 | EP-06 (3) |

`§10 강제 지점 전수`의 N은 자리 수다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint · typecheck | `app/src/renderer/**` 수정 · boundaries(shared/ui는 도메인 무관) | `cd app && npm run lint && npm run typecheck` | 이번 변경이 유발한 오류만 blocking |
| 관련 vitest | 컴포저·자동완성·shared/ui | `cd app && ./node_modules/.bin/vitest run src/renderer/src/features/chat src/renderer/src/shared/ui src/renderer/src/pages` | 이번 변경 범위 실패만 blocking |
| trailer 파싱 | 커밋 메시지 버스 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| '+' 메뉴 = `Popover` + `AttachMenu`(첨부·Skill) | `ComposerInputController.tsx:403-428` · `AttachMenu.tsx` |
| 'Skill' = 입력 끝에 `/` 추가 후 자동완성에 맡김 | `ComposerInputController.tsx:190-200` |
| `/` 선택 = `/이름 ` 치환, `@` 선택 = `applyMentionSuggestion`(플러그인 `@id` + 뒤 공백 규칙) | `ComposerInputController.tsx:202-249` · `mentionAutocomplete.ts:88-100` |
| 스킬 목록 = `useSkills()`(전체, 활성 필터 없음) · 정렬 = 출처 라벨 → 이름 | `ComposerInputController.tsx:126` · `scan.ts:107-109` |
| 출처 root 2개: `orca`('Orcinus orca 스킬') · `adapter:claude`('CLAUDE 스킬') | `bootstrap.ts:200-215` |
| 플러그인 후보 = `tools` 가 있는 `ProviderInfo` 의 `{id,label}` — `useMentionAutocomplete` 안에서 providers를 읽는다 | `pluginMention.ts:15-24` · `useMentionAutocomplete.ts:120-140` |
| `/` 자동완성 = 평면 목록, 접두 필터 후 8개 | `useSkillAutocomplete.ts:35-39` · `SkillAutocomplete.tsx:33-65` |
| `@` 자동완성 헤더 클래스(종류별) | `MentionAutocomplete.tsx:46-48` |
| `Popover` = 한 단계, 바깥 mousedown·Esc로 닫힘, 패널 `contains` 로 안쪽 판정 | `Popover.tsx:98-110` |
| 플러그인 페이지 = `/plugins`, 첫 탭 `providers`(플러그인) | `router.tsx:36` · `catalogSelection.ts:19-22` |
| 페이지 → Composer 콜백 선례 `onOpenUsageSettings`(페이지 5자리·중계 4자리) | `rg -n onOpenUsageSettings` 결과(§7 주의) |
| 메뉴 항목 표준 `MenuItem`·`MenuTitle` | `shared/ui/MenuItem.tsx` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `AttachMenu` 소비 | `rg -n "<AttachMenu" app/src/renderer/src` | 1 | 컨트롤러 |
| Router 밖 Composer 테스트 | `rg -l "ComposerInputController\|createElement(Composer\|<Composer" app/src/renderer/src --glob '*.test.ts'` | 9 | D-010 — 9파일 모두 MemoryRouter 미사용 |
| `pluginMentionCandidates` 호출 | `rg -n "pluginMentionCandidates\(" app/src/renderer/src --glob '!*.test.*'` | 2 | 훅 안 필터용·전체용 — 메뉴는 전체용을 쓴다 |
| 자동완성 헤더 | `rg -n "uppercase tracking-\[0.05em\]" app/src/renderer/src/features/chat` | 1 | `MentionAutocomplete` — 공용화 대상 |

### 수치 / 전칭 표현 검산

- "스킬 출처는 2개" — 반례 검색: `rg -n "'workspace'" app/src/main --glob '!*.test.*'` → 타입 유니온 1(`scan.ts:12`)·무관 부팅 스텝 1, 프로덕션 root 2개. 트리 함수는 출처 수를 가정하지 않는다(입력에서 묶는다).
- 기존 테스트 케이스 존재: 위 4파일 열람 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `AR-01`, `AR-02`

```text
[+] → Popover → AttachMenu{첨부, Skill}
         Skill → text += "/" → SkillAutocomplete(평면)
'@' → MentionAutocomplete(헤더: 플러그인 / ./경로)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: 위 + `MD-01`~`MD-04`

```text
pages ─onManagePlugins─→ ChatView → ChatTile → Composer → ComposerInputController
Controller: skills(useSkills) · plugins(useMentionAutocomplete) ─→ AttachMenu
AttachMenu = CascadeMenu(items = buildAttachMenu({skills, plugins, labels}))
  root: 파일 또는 사진 추가 / ─ / 스킬 ▸ / 플러그인 ▸
  스킬 ▸ [출처 ▸ [스킬…]] · 플러그인 ▸ [플러그인… / ─ / 플러그인 관리]
  선택 → action{attach | skill(name) | plugin(id) | managePlugins}
       → Controller: insertComposerToken(snapshot, '/name' | '@id') → focus
CascadeMenu: Popover(root) + fixed 하위 패널(루트 패널 DOM 안) · cascadeMenuState · submenuPosition
SkillAutocomplete: groupSkillSuggestions → AutocompleteSectionHeader(출처)
MentionAutocomplete: AutocompleteSectionHeader(종류)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | `AttachMenu` 2행 | 트리 = `attachMenuModel`, 틀 = `CascadeMenu` | D-011 | MD-01·MD-02 / VP-08·VP-09 |
| data/control flow | Skill → `/` 만 | 항목 선택 → 토큰 삽입 · 관리 → 페이지 이동 | D-002·D-003 | SD-01 / VP-05 |
| state/contract | — | `CascadeItem` 타입 · `AttachMenuAction` union · `onManagePlugins` prop | D-010·D-011 | AR-01 / VP-06 |
| 공유 데이터 | 훅 내부 providers | 훅이 `plugins` 반환 | D-006 | AR-02 / VP-07 |
| 자동완성 | `/` 평면 | 출처 헤더 · 헤더 공용 | D-004 | MD-04 / VP-11 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `shared/ui/CascadeMenu.tsx`(신규) | 계단식 패널 렌더·hover·키보드·바깥 클릭 | `CascadeItem[]` → DOM | `AttachMenu` |
| `shared/ui/cascadeMenuState.ts`(신규, 순수) | 열린 경로·포커스 reducer · `submenuPosition` | 상태+이벤트 → 상태 / rect → 좌표 | `CascadeMenu` |
| `features/chat/lib/attachMenuModel.ts`(신규, 순수) | 메뉴 트리 · `AttachMenuAction` | skills·plugins·labels → 트리 | `AttachMenu` |
| `features/chat/lib/composerToken.ts`(신규, 순수) | `insertComposerToken(text, caret, token)` | → `{text, caret}` | 컨트롤러 |
| `features/chat/lib/skillGroups.ts`(신규, 순수) | `groupSkillSuggestions` | 후보 → 그룹(+평면 인덱스) | `SkillAutocomplete` |
| `composer/AutocompleteSectionHeader.tsx`(신규) | 헤더 모양 SSOT | label → DOM | 두 자동완성 |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| MD-01 / VP-01·VP-08 · EP-01 | 메뉴 트리 (4자리) | `attachMenuModel.ts` | ① 최상위 4행 ② 스킬 출처 그룹 ③ 플러그인 목록+관리 ④ 빈 상태 행 | 메뉴 열 때 | 순서·내용 불일치 |
| MD-03 / VP-05·VP-10 · EP-02 | 토큰 삽입 (1자리) | `composerToken.ts` | 컨트롤러 action 처리(skill·plugin 공용) | 선택 시 | 공백 규칙 깨짐 = 자동완성·장식 미인식 |
| MD-02 / VP-02·VP-09 · EP-03 | 상호작용 (3자리) | `cascadeMenuState.ts` | ① 키 reducer ② hover 지연 150ms ③ `submenuPosition` | 이벤트·열림 시 | 탐색 불능·화면 밖 패널 |
| AR-02 / VP-07 · EP-04 | 플러그인 목록 공유 (1자리) | `useMentionAutocomplete` | 반환 `plugins`(전체 후보) | 렌더 | 메뉴와 `@` 후보 불일치 |
| AR-01 / VP-06 · EP-05 | `onManagePlugins` (9자리) | 페이지 | 생성 5: `ChatPage.tsx`(ChatView에) · `NewChatLandingPage.tsx` ChatTile·Composer · `ProjectLandingPage.tsx` ChatTile·Composer / 중계 4: `ChatView` · `ChatTile` · `Composer` · `ComposerInputController` | 렌더 | 한 자리 누락 = 그 화면에서 '플러그인 관리' 미표시 |
| MD-04 / VP-03·VP-11 · EP-06 | 자동완성 정돈 (3자리) | `skillGroups.ts`·헤더 | ① `/` 그룹 렌더 ② `/` 헤더 ③ `@` 헤더 교체 | 렌더 | 헤더 모양 갈라짐·인덱스 어긋남 |

### 등록 변이 (선택 적대 증거 정본)

| ID | 심을 자리 | 결함 | red여야 할 oracle |
|---|---|---|---|
| S1 | `attachMenuModel.ts` | 스킬·플러그인 하위 내용 맞바꿈 | AC1·AC2·AC3 트리 UT |
| S2 | 컨트롤러 action 처리 | skill → `@이름`, plugin → `/id` | AC2·AC3 배선 UT |
| S3 | `composerToken.ts` | 글자 뒤 앞 공백 생략 | AC2 삽입 UT |
| K1 | reducer | ← 무시 | AC6 표 UT |
| K2 | `submenuPosition` | 왼쪽 뒤집기 생략 | AC8 UT |
| G1 | `groupSkillSuggestions` | 그룹 안 이름 역순 정렬 | AC9 인덱스 UT |
| W1 | `ProjectLandingPage.tsx` Composer 자리 | `onManagePlugins` 누락 | AC3 원문 UT |

- 같은 규칙이 여러 레이어에 있다면 SSOT와 공유 방법: 토큰 삽입은 `composerToken.ts` 하나를 메뉴 경로가 쓴다(자동완성 치환 경로는 토큰 범위 치환이라 별개로 둔다 — 결과 토큰 모양은 같다). 플러그인 후보는 `pluginMentionCandidates` 하나.
- `실패 의미`에 "다른 게이트가 막는다": 해당 없음.
- 선택적 필드: `onManagePlugins?` 미지정 = '플러그인 관리' 행 없음(테스트 렌더). 프로덕션 5자리는 모두 지정(EP-05).
- 외부 SDK 경계: 해당 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `shared/ui/cascadeMenuState.ts`(신규) | 순수 | `CascadeItem` 타입(`action`·`submenu`·`separator`·`empty`) · `reduceCascade(state, event)` · `HOVER_OPEN_DELAY_MS=150` · `submenuPosition({itemRect, size, viewport})` | 표 UT |
| `shared/ui/CascadeMenu.tsx`(신규) | 렌더 | 루트 = `Popover`(placement·align은 호출자) · 하위 = 루트 패널 DOM 안 `position:fixed` 패널(바깥 판정을 Popover `contains` 에 맡김) · 하위가 열린 채 Esc면 `stopPropagation` 후 한 단계만 닫음 · 항목 = `MenuItem`(+ `chevR` 아이콘, `title`) | stub UT |
| `features/chat/lib/attachMenuModel.ts`(신규) | 트리 | `buildAttachMenu({skills, plugins, labels, canManagePlugins})` → `CascadeItem<AttachMenuAction>[]` · `AttachMenuAction = {type:'attach'} \| {type:'skill',name} \| {type:'plugin',id} \| {type:'managePlugins'}` | UT |
| `features/chat/lib/composerToken.ts`(신규) | 삽입 | `insertComposerToken(text, caret, token)` → `{text, caret}`(앞: 비었거나 공백 끝이면 그대로, 아니면 공백 1 · 뒤: 커서 뒤가 공백이면 추가 없음, 아니면 공백 1) | UT |
| `features/chat/lib/skillGroups.ts`(신규) | 그룹 | `groupSkillSuggestions(skills)` → `[{key, label, items:[{skill, index}]}]`(연속 출처 묶기, 인덱스 보존) | UT |
| `composer/AttachMenu.tsx` | 메뉴 | `CascadeMenu` 사용 · props `{open, anchorRef, onClose, skills, plugins, onAction, onManagePlugins?}` | render UT |
| `composer/ComposerInputController.tsx` | 배선 | `Popover`+구 `AttachMenu` 교체 · action 처리(attach=현행 `pickAttachments` · skill/plugin=`insertComposerToken` + `updateSnapshot` + `focus` · managePlugins=콜백) · `openSkillPicker` 삭제 | 배선 UT |
| `hooks/useMentionAutocomplete.ts` | 공유 | 반환에 `plugins`(필터 없는 전체 후보) 추가 | 훅 UT |
| `composer/SkillAutocomplete.tsx` | 정돈 | `groupSkillSuggestions` + 헤더 · 항목 `title`=설명 | render UT |
| `composer/MentionAutocomplete.tsx` | 정돈 | 헤더를 `AutocompleteSectionHeader` 로 | render UT |
| `composer/AutocompleteSectionHeader.tsx`(신규) | 헤더 | 기존 `@` 헤더 클래스 그대로 | render |
| `Composer.tsx` · `ChatTile.tsx` · `ChatView.tsx` · `pages/{ChatPage,NewChatLandingPage,ProjectLandingPage}.tsx` | 배선 | `onManagePlugins?: () => void` 중계·생성(`navigate('/plugins')`) | 원문 UT |
| `i18n/resources/{ko,en}.ts` | 문구 | `chat.composer.attachMenu.{addFiles:'파일 또는 사진 추가', skills:'스킬', plugins:'플러그인', managePlugins:'플러그인 관리', noSkills:'사용 가능한 스킬 없음', noPlugins:'사용 가능한 플러그인 없음'}`(en: Add files or photos · Skills · Plugins · Manage plugins · No skills available · No plugins available) · 미사용이 된 `chat.composer.attach` 삭제 | typecheck |
| 신규 테스트 | — | `shared/ui/{cascadeMenuState,CascadeMenu}.test.ts` · `features/chat/lib/{attachMenuModel,composerToken,skillGroups}.test.ts` · `features/chat/components/composer/attachMenu.render.test.ts` · `features/chat/components/composer/attachMenuWiring.test.ts`(원문: 9자리) | — |

### 테스트 가능성

- 별도 순수 파일: `cascadeMenuState.ts` · `attachMenuModel.ts` · `composerToken.ts` · `skillGroups.ts`.
- 기존 메커니즘 재사용 시 형상/시점 적합성: `Popover` 의 바깥 판정은 패널 `contains` — 하위 패널을 루트 패널 DOM 안에 두면 별도 판정이 필요 없다. `position:fixed` 는 조상에 transform이 없을 때 뷰포트 기준이다(Popover 패널은 transform 없음 — `Popover.tsx:125-136`).
- 순서를 관측할 훅: reducer가 이벤트 순서를 받는다 — 키 표 UT가 순서를 구동한다.

## 12. End-to-end 영향

### producer → consumer

```text
useSkills · useMentionAutocomplete.plugins → buildAttachMenu → CascadeMenu → AttachMenuAction
  → Controller → insertComposerToken → snapshot → ComposerInputSurface(장식: knownSkillNames·validPluginIds)
```

- producer 기준: 토큰 모양 = 자동완성과 같음(`/이름 `·`@id `) → 입력 장식·전송 해석이 그대로 인식.
- consumer 파생 규칙: 장식은 `knownSkillNames`·`validPluginIds` 로 토큰을 칠한다(현행).
- 파생 가능한 합성값이 정본을 우회하지 않는가: 메뉴는 목록을 새로 만들지 않고 두 출처를 그대로 쓴다(D-006).

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `useMentionAutocomplete` 소비자(컨트롤러) | 반환 필드 1개 추가 | AC11 |
| `@` 자동완성 헤더 | 컴포넌트 교체, 모양 동일 | AC10·AC11 |
| 'Skill' 항목으로 `/` 열던 흐름 | 사라짐 — 스킬 하위가 대체 | AC2 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: '+' 클릭에서 트리 생성(메모). 스킬·플러그인 목록은 이미 로드된 상태를 쓴다.
- 취소/중단: Esc·바깥 클릭·선택 시 닫힘 · hover 타이머는 닫힘·이탈 시 취소.
- 종료/quit/crash/renderer-gone: 해당 없음.
- retry/timeout/partial failure: 목록 로드 실패는 현행 토스트(`skills.list.load-failed`) — 메뉴는 빈 상태 행(D-009).
- cleanup/rollback: 해당 없음.
- **다중 저장소 쓰기**: 해당 없음 — 문서 산출 사본은 이 plan과 `INDEX.md`.

## 14. 성능 / 상한 / 최적화

- 트리 크기 = 스킬 수 + 플러그인 수 + 상수 — 수십 개 상한, 열 때 1회 생성.
- 하위 패널은 열린 경로만 렌더(형제 하위는 닫힘).

## 15. 외부 구현 포트 / 문서 계약 (해당 시)

- 해당 없음.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 메뉴 항목 표준 `MenuItem`(0121) | `MenuItem.tsx:4-10` | `CascadeMenu` 항목 | 유지 — 같은 컴포넌트 사용 |
| `shared/` 에 도메인 로직 금지 | `src/renderer/AGENTS.md` | `CascadeMenu`·`cascadeMenuState` | 유지 — 스킬·플러그인을 모른다(트리는 feature가 만든다) |
| cross-feature 데이터는 pages/app에서 props | 같은 문서 | D-010 | 유지 — `/plugins` 이동을 페이지가 만든다 |
| 0257 `TooltipHost` | 0257 D-005 | D-005 | 소비 — `title` 만 단다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 0257 미구현 상태에서 스킬 설명이 OS 흰 툴팁 | 구현 순서 0257 → 0259(INDEX 비고). 기능은 독립 동작 |
| hover 지연 중 대각선 이동으로 형제 하위가 바뀜 | 150ms 지연으로 완화 — 실기(AC12)에서 체감 확인 |
| 'Skill' 항목 제거로 `/` 를 넣던 습관 | `/` 타이핑 자동완성은 그대로(AC11) |

- 되돌리기 어려운 결정: 없음.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- §11 표의 파일 전부.
- 문서: `docs/arch/frontend/ux-domains.md` 컴포저 절에 '+' 메뉴 계층 한 줄(현재 상태 서술).

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/renderer/AGENTS.md`.
- ABI/네트워크 등 환경 제약: DB 미사용.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: §7-A gate 표.
- 사람 실기: AC12.

## READY self-review

- [x] Decision Ledger가 턴 2 범위 승인을 원문으로 보존한다.
- [x] Part I만 읽어도 완료 상태가 이해된다.
- [x] 승인 문장의 구조(최상위 4행·하위 내용)를 그대로 옮겼다.
- [x] 각 핵심 동작이 AC와 Technical Design에 연결된다.
- [x] AS-IS와 TO-BE가 같은 축으로 있다.
- [x] Delta 각 행이 파일·AC로 이어진다.
- [x] 사라지는 책임('Skill' → `/` 삽입)은 삭제이며 스킬 하위가 대체한다고 적었다.
- [x] 수치·전칭·테스트 인용을 실측했다.
- [x] 각 AC가 행동 단언·검증·도달 경로를 가진다.
- [x] Baseline V · NEW node마다 REQUIRED pair.
- [x] 적대 증거는 형제 슬롯·표·배선 pair만 선택했다.
- [x] 운영 gate 열거.
- [x] 사람 실기는 픽셀·체감(AC12)만.
- [x] "배선이 쓰인다"(9자리)는 한 자리를 지우면(W1) red.
- [x] 신규 계약의 SSOT·강제 지점·seam이 있다.
- [x] 기존 소비처(훅 반환·헤더)를 확인했다.
- [x] 게이트 명령이 하위 AGENTS와 충돌하지 않는다.
- [x] `ACTIVE 결정 ↔ AC` 대조를 §3에 적었다.
- [x] 산출물 문장 규칙을 지켰다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드를 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: `CascadeMenu`(shared/ui) + 순수 `cascadeMenuState` · 트리 `attachMenuModel` · 토큰 `composerToken` · `/` 섹션 · 헤더 공용 · `onManagePlugins` 9자리 배선 모두 Part II 그대로.
- 이견 / 현실성 문제: 서버 렌더 테스트가 열린 하위 패널을 그리려면 상태를 주입할 seam이 필요해 `CascadeBody` 를 export하고 `initialState` prop을 두었다(§6 #1).
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-01·VP-08 | EP-01 메뉴 트리 | 4 | 4/4 | `attachMenuModel.test.ts` 최상위·출처 그룹·플러그인+관리·빈 상태 4케이스 green | — |
| VP-05·VP-10 | EP-02 토큰 삽입 | 1 | 1/1 | 컨트롤러 `onAttachMenuAction` → `attachMenuToken` → `insertComposerToken` → `replaceDraftRange` | — |
| VP-02·VP-09 | EP-03 상호작용 | 3 | 3/3 | reducer 키 · `HOVER_OPEN_DELAY_MS=150` · `submenuPosition` (cascadeMenuState UT 11) | — |
| VP-07 | EP-04 플러그인 목록 공유 | 1 | 1/1 | `useMentionAutocomplete` 반환 `plugins: allPlugins`(같은 `pluginMentionCandidates`) | — |
| VP-06 | EP-05 `onManagePlugins` | 9 | 9/9 | `rg -n "onManagePlugins=" pages features/chat/components` → 생성 5(ChatPage 1·NewChatLanding 2·ProjectLanding 2) + 중계 4(ChatView·ChatTile·Composer·Controller) · 배선 원문 UT | — |
| VP-03·VP-11 | EP-06 자동완성 정돈 | 3 | 3/3 | `SkillAutocomplete` 섹션 · `AutocompleteSectionHeader` 2파일 import | — |

- §10에 없는데 같은 불변식이 필요했던 지점: i18n ko↔en **키 순서** 단언(`resources.test.ts`) — en에 `attachMenu` 블록을 다른 자리에 넣어 red, ko와 같은 자리로 옮겨 green.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | 트리·render UT | S1·S2 red |
| VP-02 | REQUIRED | SELF_PASS | reducer·좌표 UT | K1·K2 red |
| VP-03 | REQUIRED | SELF_PASS | 섹션·헤더 UT | G1 red |
| VP-04 | REQUIRED | SELF_BLOCKED | 사람 실기 대기(AC12) | not selected |
| VP-05 | REQUIRED | SELF_PASS | 토큰 매핑·삽입 UT | S2 red |
| VP-06 | REQUIRED | SELF_PASS | 배선 원문 UT | W1 red |
| VP-07 | REQUIRED | SELF_PASS | 훅 반환 필드(typecheck)·트리 입력 | not selected |
| VP-08 | REQUIRED | SELF_PASS | 트리 UT | S1 red |
| VP-09 | REQUIRED | SELF_PASS | 표 UT | K1·K2 red |
| VP-10 | REQUIRED | SELF_PASS | 4경우 UT | S2·S3 red |
| VP-11 | REQUIRED | SELF_PASS | 인덱스 UT | G1 red |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 스킬·플러그인 하위 내용 맞바꿈 | S1 | 최초 | attachMenuModel·render 4 failed | 잠김 |
| 토큰 접두 `/`↔`@` 맞바꿈 | S2 | 최초 | attachMenuToken 1 failed | 잠김 |
| 글자 뒤 앞 공백 생략 | S3 | 최초 | composerToken 2 failed | 잠김 |
| ← 무시 | K1 | 최초 | cascadeMenuState 1 failed | 잠김 |
| 왼쪽 뒤집기 생략 | K2 | 최초 | cascadeMenuState 1 failed | 잠김 |
| 섹션 안 역순 | G1 | 최초 | skillGroups·render 2 failed | 잠김 |
| `ProjectLandingPage` Composer 자리 prop 누락 | W1 | 최초 | 배선 UT 1 failed | 잠김 |

- **분모 검산**: `선택 증거 7 · 인용 변이 0 · 새 oracle 0(배선 원문 UT는 W1로 셈) = 표 행 7`.
- **덮개 회귀**: 해당 없음 — 최초 라운드.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 있음 — `attachMenu.*` 6키 모두 `AttachMenu` 가 쓴다. 미사용이 된 `chat.composer.attach`('첨부')는 삭제 | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 'Skill' 항목·`openSkillPicker` 삭제, 메뉴 닫기는 `setAttachMenuOpen(false)` 한 곳 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 목록 로드 실패 → 빈 상태 행(§5 '스킬 0개' 행) · 조합 중 → 삽입 거부 행 | — |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | 빈 하위는 비활성 안내 행 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 삽입은 `replaceDraftRange` 의 revision 비교로 늦은 적용을 거부 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 열린 하위 패널을 서버 렌더로 보려면 상태 주입 seam이 필요 | ✅ 선조치 — `CascadeBody` export + `initialState` prop(기본값 = 초기 상태) | `attachMenu.render.test.ts` "하위 패널은 최상위 메뉴 DOM 안" |
| 2 | 토큰 매핑을 컨트롤러 안 삼항 대신 순수 `attachMenuToken` 으로 | ✅ 선조치 — S2 변이를 단위로 잠그기 위함 | attachMenuModel UT |
| 3 | 하위 패널 Esc 가 Popover 문서 keydown 으로 메뉴 전체를 닫을 수 있다 | ✅ 선조치 — 메뉴 루트 `onKeyDown` 에서 `stopPropagation` | 실기 AC12에서 확인 필요(React 포털 이벤트 전파) |
| 4 | hover 대각선 이동 중 형제 하위 전환 | ⚠️ 보고만 — 150ms 지연으로 완화(D-007) | 실기 AC12 |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: `CascadeBody` export·`initialState` seam(§6 #1) · `attachMenuToken` 추가(§6 #2).

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 | — |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 해당 없음 — seam prop은 테스트만 쓴다(프로덕션 호출부 `CascadeMenu` 는 넘기지 않음) | `rg -n "initialState" app/src/renderer/src --glob '!*.test.*'` → CascadeMenu.tsx 3줄(기본값·타입·useState) — 호출부 0 |
| 재진입 | 메뉴를 다시 열면 Popover 가 내용을 다시 마운트해 상태가 초기화된다 | AC1 render(하위 닫힌 채 시작) |
| 다른 무효화 축 | 해당 없음 | — |

## [구현자 기입] 구현 보고 (r1)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 `shared/ui/{CascadeMenu.tsx,cascadeMenuState.ts}` · `features/chat/lib/{attachMenuModel,composerToken,skillGroups}.ts` · `composer/AutocompleteSectionHeader.tsx` · 수정 `AttachMenu`·`ComposerInputController`·`SkillAutocomplete`·`MentionAutocomplete`·`useMentionAutocomplete`·`Composer`·`ChatTile`·`ChatView`·pages 3·i18n ko/en · 테스트 신규 5 · 문서 `ux-domains.md` |
| 실행 명령 | `npm run typecheck` · `npm run lint` · `npm run pretest && vitest run` · 변이 7 |
| **관측한 게이트 산출** | typecheck exit 0 · lint 0 error/1 warning(기존) · vitest 654파일: 653 pass·1 skip / 6644: 6643 pass·1 skip · 실패 0 |
| V-pair 자기확인 | `SELF_PASS 10 / SELF_BLOCKED 1(VP-04 실기)` |
| 강제 지점 전수 | 6행 모두 N/N |
| **AC 자기보고**(`Criteria-Met`) | AC1 트리·render · AC2 트리·토큰·삽입 · AC3 트리·배선 원문 · AC4 빈 상태 · AC5 title · AC6 reducer 키 표 · AC7 reducer hover + 하위 패널 DOM 포함 render · AC8 좌표 4 · AC9 섹션·인덱스 · AC10 헤더 공용 · AC11 기존 자동완성 스위트 green · AC13 gate ✅ / AC12 실기 ⚠️ |
| **합계 검산** | `✅ 12 · ⚠️ 1 · ❌ 0 = 총 13` |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 없음(최초).
- 그것을 막았어야 할 plan 지침·AC가 있었는가: i18n 키 **순서** 테스트를 plan이 gate로 언급하지 않음(typecheck 패리티만 언급).
- 반복해서 부딪히는 환경 한계: better-sqlite3 ABI.
- 현재 라운드·impl 턴: `r1`

## [구현자 기입] 설계 리뷰 (r2)

- 동의 / 그대로 진행: r1 verify D1(VP-05)·D2(VP-06)만 닫는다. 유효 V는 V1 그대로 — 사용자가 같은 날 요청했다가 취소한 스킬 평면 나열(ΔV1)은 로컬 설계 커밋째 되돌려 공유 브랜치에 남지 않았다.
- 이견 / 현실성 문제: 컨트롤러는 React 훅 덩어리라 node 환경에서 직접 렌더할 수 없다 — `composerSubmit` 선례대로 동작 순서를 순수 모듈 `composerAttachMenu.ts` 로 떼고, 컨트롤러는 자기 상태 접근만 넘긴다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조, r2)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-05·VP-10 | EP-02 토큰 삽입 | 1 | 1/1 | `grep -n "runAttachMenuAction(action, {" ComposerInputController.tsx` → 1 · `composerAttachMenu.ts` 가 `insertComposerToken`→`replaceDraftRange`→`focus(caret)` | — |
| VP-06 | EP-05 `onManagePlugins` | 9 | 9/9 + 호출 edge 1 | r1 원문 UT(W1) 그대로 · `AttachMenu` `onSelect` 분기를 `attachMenuSelect.test.ts` 가 실제 렌더로 구동 | — |
| 그 밖 EP-01·03·04·06 | — | r1 그대로 | 코드 무변경 | `git diff --stat` = 컨트롤러 1파일 + 신규 3파일 | — |

- §10에 없는데 같은 불변식이 필요했던 지점: 컨트롤러가 함수에 넘기는 의존성(스냅샷·갱신·포커스)과 `AttachMenu` 의 `onAction` 배선 — 원문 단언으로 함께 잠갔다(Z1-ctrl·Z2-ctrl·Z5·Z7).

**V-pair 자기확인 (r2)**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-05 | REQUIRED | SELF_PASS | `composerAttachMenu.test.ts` 4경우(텍스트·caret·focus 1회·메뉴 닫힘) + 파일 추가·IME 거부 + 컨트롤러 배선 원문 | Z1·Z2·Z3 red · Z1-ctrl·Z2-ctrl·Z5·Z7 red |
| VP-06 | REQUIRED | SELF_PASS | `attachMenuSelect.test.ts` — managePlugins 1회·onAction 미호출 / 나머지 3종 onAction 그대로 | W1(r1) · Z4·Z6 red |
| VP-01 | REQUIRED | SELF_PASS | VP-05·06 해소로 AC2·AC3 증거 충족 | r1 S1~S3 결과 유지(해당 코드 무변경) |
| 나머지 8 pair | REQUIRED | r1 SELF 상태 유지 | 코드 무변경 | — |

## [구현자 기입] 이번 라운드 수정의 잠금 (r2)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 커서 대신 `text.length` 에 삽입 (`composerAttachMenu.ts`) | D1 인용 Z1 | green(r1 verify) | composerAttachMenu 2 failed | 잠김 |
| `focus(0)` | D1 인용 Z2 | green | 4 failed | 잠김 |
| `replacement.trim()` | D1 인용 Z3 | green | 4 failed | 잠김 |
| `managePlugins` 콜백 미호출 (`AttachMenu.tsx`) | D2 인용 Z4 | green | attachMenuSelect 1 failed | 잠김 |
| 컨트롤러가 빈 스냅샷을 넘김 | 새 oracle(배선 원문) — Z1을 컨트롤러 자리에 | — | 1 failed | 잠김 |
| 컨트롤러가 `focus: () => focus(0)` 를 넘김 | 새 oracle — Z2를 컨트롤러 자리에 | — | 1 failed | 잠김 |
| 컨트롤러가 함수를 부르지 않음 | 새 oracle — 배선 삭제 | — | 1 failed | 잠김 |
| `onAction={() => {}}` | 새 oracle — 배선 삭제 | — | 1 failed | 잠김 |
| 나머지 동작을 관리 콜백으로 보냄 | 새 oracle — 형제 분기 맞바꿈 | — | attachMenuSelect 3 failed | 잠김 |

- **분모 검산**: `선택 증거 0(r1 등록 변이 대상 코드 무변경) · 인용 변이 4(Z1~Z4) · 새 oracle 5 = 표 행 9`.
- **덮개 회귀**: 없음 — 구 장치(`attachMenu.render.test.ts` 원문 9자리)는 그대로 두었고 W1은 여전히 그 단언이 잡는다.
- 컨트롤러 자리의 잠금은 원문 단언(구조)이다 — 훅 렌더 없이 그 의존성 전달을 행동으로 볼 방법이 없다.

## [구현자 기입] Product/UX 파생 검토 (r2)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 해당 없음 — 문구 변경 없음 | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 재배치는 동작 순서(닫기 → 분기 → 삽입 → 포커스)를 그대로 옮겼다 · 정리 코드 없음 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 새 실패 경로 없음 · IME 중 거부 = '조합(IME) 중' 행(UT) | — |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | 해당 없음 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | `replaceDraftRange` revision 비교 유지 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r2)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 같은 날 사용자가 스킬 평면 나열을 요청했다가 취소 | ✅ 로컬 ΔV1 설계 커밋·코드를 `git reset --hard 80d373bf` 로 되돌림(공유 브랜치 미푸시) | `git log origin/…` 최신 = `80d373bf` |
| 2 | 검증 중 쓴 변이 도구가 `git checkout` 으로 원복해 미커밋 작업을 지웠다 | ✅ 파일별 백업 원복으로 교체 · 이번 r2 작업은 전부 재작성 | 최종 `git status` = 의도한 4파일 |

### 설계 대비 명시적 차이

- plan §11의 신규 테스트 `attachMenuWiring.test.ts` 대신 `composerAttachMenu.test.ts`(D1)·`attachMenuSelect.test.ts`(D2)를 더했다 — 배선 원문 9자리는 r1의 `attachMenu.render.test.ts` 가 계속 맡는다. 컨트롤러 동작을 순수 모듈로 옮긴 것은 동작 보존 추출이다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 상태 없는 함수 | — |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 해당 없음 — 호출부는 컨트롤러 1곳(`grep` 1) | — |
| 재진입 | 스냅샷을 함수 시작에 한 번 읽고 갱신은 revision 비교로 거부 — 기존과 같음 | AC2 4경우 UT |
| 다른 무효화 축 | 컨트롤러가 다른 의존성을 넘기면 함수 테스트가 못 본다 | 원문 단언 + Z1-ctrl·Z2-ctrl·Z5·Z7 red |

## [구현자 기입] 구현 보고 (r2)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 `composer/composerAttachMenu.ts` · `composerAttachMenu.test.ts` · `attachMenuSelect.test.ts` · 수정 `ComposerInputController.tsx` |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `vitest run …/composer …/lib shared/ui pages` · 전체 `vitest run` · 변이 11건(Z1~Z7·Z1-ctrl·Z2-ctrl) |
| **관측한 게이트 산출** | lint 0 error · 1 warning(기존 `useTranscriptVirtualizer.ts`) · typecheck exit 0·`error TS` 0 · composer 44파일 269케이스 pass · 관련 111파일 815케이스 pass · 전체 655파일(+1 skip) 6654케이스 pass·실패 0 |
| V-pair 자기확인 | `SELF_PASS 10 / SELF_BLOCKED 1(VP-04 실기)` |
| 강제 지점 전수 | EP-02 1/1 · EP-05 9/9(+호출 edge) |
| **AC 자기보고**(`Criteria-Met`) | r1 ✅ 10 + AC2(삽입 4경우·컨트롤러 배선)·AC3(관리 콜백 1회·삽입) ✅ / AC12 실기 ⚠️ |
| **합계 검산** | `✅ 12 · ⚠️ 1 · ❌ 0 = 총 13` |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r2 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r2)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 예 — r1 verify D1·D2(plan 지정 oracle 부재)를 그대로 닫았다.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: 있었다 — VP-05·VP-06이 oracle을 이름으로 지정했고 r1 구현 보고가 대체를 적지 않았다.
- 반복해서 부딪히는 환경 한계: 훅 컨트롤러를 node 환경에서 렌더할 수 없어 배선 자리는 원문 단언으로 잠근다.
- 현재 라운드·impl 턴: `r2`

## [구현자 기입] 설계 리뷰 (r3)

- 동의 / 그대로 진행: r2 verify D4(BLOCKING)·D5(NON_BLOCKING)만 닫는다. 유효 V는 V1 그대로, production 코드 무변경 — 테스트 2파일만 고친다.
- 이견 / 현실성 문제: 없음.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조, r3)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-06 | EP-05 `onManagePlugins` — 화면 표시 | 9(prop) | 9/9 + 호출 edge 1 + 행 표시 edge 1 | `attachMenuSelect.test.ts` '플러그인 관리' 행 2케이스 — 콜백 있음 `['empty','separator','action:managePlugins']` · 없음 → 관리 행 없음 | — |
| VP-05 | EP-02 컨트롤러 의존성 전달 | 1 | 1/1 · 의존성 6/6 원문 | `grep -c "runAttachMenuAction(action, {" ComposerInputController.tsx` → 1 · 원문 블록 8줄 `toContain` | — |
| 그 밖 | — | r1 그대로 | 코드 무변경 | `git diff --stat` = 테스트 2파일 | — |

- §10에 없는데 같은 불변식이 필요했던 지점: 없음 — VP-06 path `… → AttachMenu` 의 마지막 edge(`!!onManagePlugins` → 트리)가 r2 verify가 지적한 그 자리다.

**V-pair 자기확인 (r3)**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-06 | REQUIRED | SELF_PASS | 콜백 1회·onAction 미호출(r2) + 관리 행 유무 2케이스(r3) | W1(r1) · Z4 · X5 · X6 · Y1 · Y2 red |
| VP-01 | REQUIRED | SELF_PASS | VP-06 해소로 AC3 '플러그인 관리' 행 증거 충족 | S1~S3 결과 유지 · Y3 red |
| VP-05 | REQUIRED | SELF_PASS(r2 유지) | 원문 블록이 의존성 6개 전부 | Z1~Z3·S2c·X7 red · X1~X3·Y4 red |
| 나머지 8 pair | REQUIRED | r1 SELF 상태 유지 | 코드 무변경 | — |

## [구현자 기입] 이번 라운드 수정의 잠금 (r3)

실행: 변이마다 백업 → `node node_modules/vitest/vitest.mjs run composer/ features/chat/lib pages`(96파일 739케이스) → 원복.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| X5 `canManagePlugins: false` | D4 인용 | green(r2 verify) | attachMenuSelect 1 | 잠김 |
| X6 `canManagePlugins: true` | D4 인용 | green | attachMenuSelect 1 | 잠김 |
| X3 `pickAttachments: () => undefined` | D5 인용 | green | composerAttachMenu 1 | 잠김 |
| X1 `compositionActive: () => false` | 새 oracle(원문 블록) 민감도 | green · 등가 | composerAttachMenu 1 | 잠김 |
| X2 `closeMenu: () => undefined` | 새 oracle 민감도 | green · 등가 | composerAttachMenu 1 | 잠김 |
| Y1 `canManagePlugins: !onManagePlugins` | 새 oracle — 같은 edge 반전(독립 축) | — | attachMenuSelect 2 | 잠김 |
| Y2 관리 선택 시 콜백 + `onAction` 둘 다 | 새 oracle — 형제 분기 누수(독립 축) | — | attachMenuSelect 1 | 잠김 |
| Y3 플러그인 하위 구분선 삭제 | 새 oracle — 행 순서 단언(독립 축) | — | attachMenuSelect·attachMenuModel 3 | 잠김 |
| Y4 컨트롤러 `onAction={(action) => void action}` | 새 oracle — 배선 삭제(독립 축) | — | composerAttachMenu 1 | 잠김 |

- **분모 검산**: `선택 증거 0(대상 코드 무변경) · 인용 변이 3(X3·X5·X6) · 새 oracle 6(X1·X2·Y1~Y4) = 표 행 9`.
- **덮개 회귀**: 없음 — r2 red 변이 Z1~Z4·S2c·X7 재실행 전부 red(2·4·4·1·4·6케이스). X4(`value.revision`)는 r2와 같이 green·등가(읽기·갱신이 같은 동기 호출).

## [구현자 기입] Product/UX 파생 검토 (r3)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 해당 없음 — production 무변경 | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 해당 없음 — 재배치 없음 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 해당 없음 | — |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | X3(파일 추가 무동작)·X5(관리 행 소실)가 이제 red | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r3)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 원문 블록 단언은 줄바꿈 바이트에 기대 Windows CRLF 체크아웃에서 깨질 수 있다 | ✅ 해당 없음 확인 — 루트 `.gitattributes` `* text=auto eol=lf` | `file ComposerInputController.tsx` CRLF 표기 없음 |
| 2 | r2 verify의 변이 도구가 Windows에서 `.bin/vitest` 를 shell로 못 불러 산출 0이었다 | ✅ `node node_modules/vitest/vitest.mjs` 직접 호출 · 행마다 실패 파일명 관측 | 위 표 |

### 설계 대비 명시적 차이

- 없음 — D4는 `AttachMenu` 콜백 UT(VP-06 oracle) 안에서, D5는 r2의 컨트롤러 배선 원문 단언을 넓혀 닫았다.

## [구현자 기입] 구현 보고 (r3)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `composer/attachMenuSelect.test.ts` · `composer/composerAttachMenu.test.ts` (production 0) |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `vitest run features/chat shared/ui pages` · 변이 16건 |
| **관측한 게이트 산출** | lint 0 error · 1 warning(기존 `useTranscriptVirtualizer.ts`) · lint 후 트리 = 의도한 2파일 · typecheck exit 0·`error TS` 0 · 관련 vitest 235파일 1853케이스 pass·실패 0 |
| V-pair 자기확인 | `SELF_PASS 10 / SELF_BLOCKED 1(VP-04 실기)` |
| 강제 지점 전수 | EP-05 9/9 + 호출 edge + 행 표시 edge · EP-02 1/1(의존성 6/6) |
| **AC 자기보고**(`Criteria-Met`) | r2 verify ✅11 + AC3(관리 행 유무 X5·X6 red) ✅ / AC12 실기 ⚠️ |
| **합계 검산** | `✅ 12 · ⚠️ 1 · ❌ 0 = 총 13` |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r3 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r3)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 예 — VP-06 pair 세 번째 edge(r1 prop 전달 → r2 콜백 호출 → r3 행 표시).
- 그것을 막았어야 할 plan 지침·AC가 있었는가: 있었다 — VP-06 path가 `AttachMenu` 까지, §10 EP-05 실패 의미가 "미표시". r2 구현 보고의 무효화 축은 컨트롤러 의존성만 셌다.
- 반복해서 부딪히는 환경 한계: Windows에서 `.bin/vitest` shell 호출 실패·cp949 출력.
- 현재 라운드·impl 턴: `r3`

## [구현자 기입] 설계 리뷰 (r4)

- 동의 / 그대로 진행: r3 verify D6(BLOCKING)·D7(NON_BLOCKING)을 닫는다. 유효 V는 V1 그대로, production 코드 무변경 — 테스트 3파일만 고친다.
- 이견 / 현실성 문제: 없음. 진입 전 `handoff-review` round 30(P54) 완료 — INDEX 비고.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조, r4)

불변식: **메뉴가 그리는 목록은 자동완성이 쓰는 전체 집합 그대로다**(D-006). 자리 = 그 목록을 운반하는 edge.
검색: `grep -n "plugins" hooks/useMentionAutocomplete.ts components/composer/{ComposerInputController,AttachMenu}.tsx lib/attachMenuModel.ts` · 같은 명령 `skills`.

| Pair | 자리 | 직접 oracle 좌표 | 관측 | 남긴 곳 |
|---|---|---|---|---|
| VP-07 ① | `useMentionAutocomplete.ts:156` `plugins: allPlugins` | `hooks/useMentionAutocomplete.test.ts:'returns every Plugin candidate as plugins while an @ prefix narrows the suggestions'` | V4 red 1 | — |
| VP-07 ② | `ComposerInputController.tsx:424` `plugins={mentionAutocomplete.plugins}` | `composer/composerAttachMenu.test.ts:'컨트롤러는 메뉴 동작을 이 함수에 자기 스냅샷·갱신·포커스와 함께 넘긴다'` | V2 red 1 | — |
| VP-07 ③ | `AttachMenu.tsx:34` `plugins` → `buildAttachMenu` | `composer/attachMenuSelect.test.ts:'받은 플러그인·스킬 목록을 그대로 하위 메뉴에 그린다'` | A1 red 1 | — |
| VP-07 ④ | `attachMenuModel.ts:70` 플러그인 행 | `lib/attachMenuModel.test.ts:'플러그인 ▸ 목록 · 구분선 · 플러그인 관리 (AC3)'` | S1 red(r1) | — |
| D7 ① | `ComposerInputController.tsx:130·423` `useSkills()` → `skills={skills}` | 위 ② 와 같은 테스트(`const skills = useSkills()` 1회 + 3줄 원문) | V3·V5 red 1 | — |
| D7 ② | `AttachMenu.tsx:33` `skills` → `buildAttachMenu` | 위 ③ 와 같은 테스트 | A2 red 1 | — |

- VP-07 `4/4` · D7 `2/2`(트리 내부 스킬 행은 `attachMenuModel.test.ts:'스킬 ▸ 출처 ▸ 스킬 이름 (AC2)'`, r1).
- §10에 없는데 같은 불변식이 필요했던 지점: 없음 — ③은 VP-07 path `plugins → buildAttachMenu` edge 자체다.

**V-pair 자기확인 (r4)**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-07 | REQUIRED | SELF_PASS | 위 4자리 좌표 | not selected — 인용 변이 V2·V4 red |
| VP-01 | REQUIRED | SELF_PASS | VP-07 해소로 AC3 "`@` 후보와 같은 플러그인 목록" 충족 | S1~S3 r1 결과 유지 |
| 나머지 9 pair | REQUIRED | r3 상태 유지 | production 무변경 | — |

## [구현자 기입] 이번 라운드 수정의 잠금 (r4)

실행: 변이마다 백업 → `node node_modules/vitest/vitest.mjs run composer lib hooks pages`(105파일 790케이스) → 원복. 최종 `git status` = 테스트 3파일.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| V4 훅 `plugins: allPlugins` → 필터 `plugins` | D6 인용 | green(r3 verify) | useMentionAutocomplete 1 | 잠김 |
| V2 컨트롤러 `plugins={[]}` | D6 인용 | green | composerAttachMenu 1 | 잠김 |
| V3 컨트롤러 `skills={[]}` | D7 인용 | green | composerAttachMenu 1 | 잠김 |
| V5 컨트롤러 `skills={autocomplete.suggestions}` | D7 인용 | green | composerAttachMenu 1 | 잠김 |
| A1 `AttachMenu` `plugins: []` | 새 oracle — 자리 ③ | — | attachMenuSelect 1 | 잠김 |
| A2 `AttachMenu` `skills: []` | 새 oracle — 자리 D7 ② | — | attachMenuSelect 1 | 잠김 |

- **분모 검산**: `선택 증거 0(VP-07 not selected) · 인용 변이 4(V2·V3·V4·V5) · 새 oracle 2(A1·A2) = 표 행 6`.
- **덮개 회귀**: 없음 — 수정한 두 파일의 r3 red 변이 재실행 전부 red: X5 2 · X6 1 · Y1 3 · Z4 1(attachMenuSelect) · X3 1(composerAttachMenu). X5·Y1 수 증가는 신규 데이터 전달 케이스가 관리 행까지 단언하기 때문.

## [구현자 기입] Product/UX 파생 검토 (r4)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 해당 없음 — production 무변경 | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 해당 없음 — 재배치 없음 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 해당 없음 | — |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | V2(5화면 '플러그인 없음')·V4(`@ji` 뒤 '+' 시 일부만)가 이제 red | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r4)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | ②·D7 ① 은 원문 단언(구조적 proxy)이다 — 컨트롤러를 node 환경에서 렌더할 수 없다 | ✅ 인용 변이 V2·V3·V5 red로 민감도 확인 · 데이터 내용은 ①·③ 행동 UT가 본다 | 위 잠금 표 |
| 2 | 훅이 비활성(`active=false`)이면 `plugins` = `[]` — 메뉴도 비지만 그때 메뉴는 열리지 않는다(`open={active && …}`) | 해당 없음 | `ComposerInputController.tsx:420` |

### 설계 대비 명시적 차이

- 없음 — D6 대응 방향(훅 UT + 컨트롤러 원문 단언)에 자리 ③(`AttachMenu` 전달) 행동 UT를 더했다.

## [구현자 기입] 구현 보고 (r4)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `hooks/useMentionAutocomplete.test.ts` · `composer/attachMenuSelect.test.ts` · `composer/composerAttachMenu.test.ts` (production 0) |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `vitest run features/chat shared/ui pages` · 변이 11건 |
| **관측한 게이트 산출** | lint 0 error · 1 warning(기존 `useTranscriptVirtualizer.ts`) · lint 후 트리 = 의도한 3파일 · typecheck exit 0·`error TS` 0 · 관련 vitest 235파일 1855케이스 pass·실패 0(r3 1853 + 신규 2) |
| V-pair 자기확인 | `SELF_PASS 10 / SELF_BLOCKED 1(VP-04 실기)` |
| 강제 지점 전수 | VP-07 4/4 · D7 2/2 — 자리별 좌표는 위 표 |
| **AC 자기보고**(`Criteria-Met`) | r3 verify ✅11 + AC3(플러그인 목록 출처 V2·V4 red) ✅ / AC12 실기 ⚠️ |
| **합계 검산** | `✅ 12 · ⚠️ 1 · ❌ 0 = 총 13` |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r4 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r4)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 예 — pair path edge 중 테스트가 닿지 않은 자리(r1 D1·D2 → r2 D4 → r3 D6).
- 그것을 막았어야 할 plan 지침·AC가 있었는가: 있었다 — VP-07 oracle "훅 반환·트리 UT". r1 자기확인은 typecheck를 좌표로 적었다(round 30 P54가 이 자리를 막는다).
- 반복해서 부딪히는 환경 한계: 컨트롤러를 node 환경에서 렌더할 수 없어 배선이 원문 단언에 기댄다 · Windows `.bin/vitest` shell 호출 실패.
- 현재 라운드·impl 턴: `r4`

## [구현자 기입] 설계 리뷰 (r5)

- 동의 / 그대로 진행: r4 verify D8(BLOCKING)·D3(NON_BLOCKING)을 닫는다. 유효 V는 V1 그대로, production 코드 무변경 — 테스트 1파일(`shared/ui/CascadeMenu.test.ts`, plan §11이 이름 댄 파일) 신설.
- 이견 / 현실성 문제: verify가 제안한 "순수 seam 추출" 대신 react 훅만 mock하고 production `CascadeBody`·`CascadePanel`·`Popover` 함수를 그대로 부르는 하네스를 썼다(`useMentionAutocomplete.test.ts` 선례) — 재배치 없이 컴포넌트 edge 자체를 지난다. 진입 전 `handoff-review` round 31 완료(`276b2098`).
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조, r5)

불변식: **reducer·hover 지연·배치 함수는 메뉴의 실제 이벤트·열림 경로에서 불린다**(D-007·D-008). 자리 = VP-02 path `keydown`/`pointerenter → reducer → 열림 경로 → submenuPosition`의 edge + §10 EP-03 3자리.
검색: `grep -n "dispatch\|scheduleHover\|cancelHover\|onHover\|onLeave\|submenuPosition\|HOVER_OPEN_DELAY_MS" shared/ui/CascadeMenu.tsx` · `grep -n "contains" shared/ui/Popover.tsx`.

| Pair | 자리 | 직접 oracle 좌표 | 관측 | 남긴 곳 |
|---|---|---|---|---|
| VP-09 ① | `reduceCascade` 키 | `shared/ui/cascadeMenuState.test.ts` '키보드 (AC6)' 5케이스 | K1 red(r4 verify) | — |
| VP-09 ② | `HOVER_OPEN_DELAY_MS = 150` · `scheduleHover` 타이머 | `shared/ui/CascadeMenu.test.ts:'하위 항목 hover 는 150ms 뒤에 연다 — 149ms 에는 닫혀 있다'` | H1·H3 red 2 | — |
| VP-09 ③ | `submenuPosition` | `cascadeMenuState.test.ts` 'submenuPosition (AC8)' 4케이스 | K2 red(r4 verify) | — |
| VP-02 a | 루트 `onKeyDown → dispatch` | `CascadeMenu.test.ts:'메뉴 keydown 이 reducer 로 가 포커스를 옮기고, 처리한 키는 문서로 새지 않는다'` · `'최상위 Esc 는 메뉴를 닫고 …'` | K3 red 2 · J3 red 1 | — |
| VP-02 b | 패널 prop `onHover={scheduleHover}`·`onLeave={cancelHover}` | `CascadeMenu.test.ts:'150ms 전에 항목을 떠나면 열지 않는다'` + ② 좌표 | H2b red 1 | — |
| VP-02 c | 항목 `onPointerEnter → onHover(level, index)`·`onPointerLeave → onLeave` | `CascadeMenu.test.ts:'패널 항목의 pointerenter·pointerleave 가 …'` | J1·J2 red 1 | — |
| VP-02 d | 하위 패널 layout effect → `submenuPosition`(부모 rect·패널 크기·viewport) → `style` | `CascadeMenu.test.ts:'열린 하위 패널은 부모 항목 좌표로 submenuPosition 을 적용한다 …'` | P1b·J4 red 1 | — |
| D3 | `Popover` 바깥 mousedown — 패널 `contains`면 유지 | `CascadeMenu.test.ts:'패널 안(하위 패널 포함) mousedown 은 닫지 않고 …'` | Q1 red 1 | — |

- VP-09 `3/3` · VP-02 path edge `4/4` · D3 `1/1`.
- §10에 없는데 같은 불변식이 필요했던 지점: 없음 — b·c는 VP-02 path `pointerenter → reducer` edge를 운반하는 두 자리다.

**V-pair 자기확인 (r5)** — 유지 행은 r4 verify §5 좌표를 인용한다(round 31).

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-09 | REQUIRED | SELF_PASS | 위 ①②③ | K1·K2(r4 verify) red · H1·H3 red |
| VP-02 | REQUIRED | SELF_PASS | 위 a~d + VP-09 좌표 | K1·K2 red · H2b·K3·P1b red |
| VP-01·03·05·06·07·08·10·11 | REQUIRED | SELF_PASS(유지) | r4 verify §5 표 좌표(`attachMenuModel.test.ts` 4 · `composerToken.test.ts` · `composerAttachMenu.test.ts` · `attachMenu.render.test.ts` · `attachMenuSelect.test.ts` · `useMentionAutocomplete.test.ts` · `skillGroups.test.ts`) — 이번 턴 관련 vitest 1862케이스 안에서 green | r4 verify 재측정 red 유지(production 무변경) |
| VP-04 | REQUIRED | SELF_BLOCKED | 사람 실기(AC12) — 좌표 아님 | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금 (r5)

실행: 변이마다 백업 → `node node_modules/vitest/vitest.mjs run features/chat/{components/composer,lib,hooks} shared/ui pages`(118파일 864케이스) → 원복. 최종 `git status` = 신규 테스트 1파일.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| H1 `HOVER_OPEN_DELAY_MS = 0` | D8 인용 | green(r4 verify) | CascadeMenu 2 | 잠김 |
| H3 타이머 없이 즉시 dispatch | D8 인용 | green | CascadeMenu 2 | 잠김 |
| H2b `onLeave={() => undefined}` | D8 인용 | green | CascadeMenu 1 | 잠김 |
| K3 `onKeyDown`이 dispatch 안 함 | D8 인용 | green | CascadeMenu 2 | 잠김 |
| P1b `submenuPosition` 우회 고정 배치 | D8 인용 | green | CascadeMenu 1 | 잠김 |
| J1 `onPointerEnter → onHover(level, 0)` | 새 oracle — 항목 edge 형제 인덱스(독립 축) | — | CascadeMenu 1 | 잠김 |
| J2 `onPointerLeave` 무동작 | 새 oracle — 항목 이탈 edge(독립 축) | — | CascadeMenu 1 | 잠김 |
| J3 루트 `stopPropagation` 삭제 | 새 oracle — Esc 한 단계(독립 축) | — | CascadeMenu 1 | 잠김 |
| J4 패널 폭 `0` 전달 | 새 oracle — 배치 입력(독립 축) | — | CascadeMenu 1 | 잠김 |
| Q1 Popover 패널 `contains` 판정 삭제 | D3 대응 | — | CascadeMenu 1 | 잠김 |

- **분모 검산**: `선택 증거 0(K1·K2 r4 verify 재측정 유지, 코드 무변경) · 인용 변이 5(H1·H2b·H3·K3·P1b) · 새 oracle 5(J1~J4·Q1) = 표 행 10`.
- **덮개 회귀**: 해당 없음 — 기존 테스트·장치 무변경, 신규 파일만 추가.

## [구현자 기입] Product/UX 파생 검토 (r5)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 해당 없음 — production 무변경 | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 해당 없음 — 재배치 없음(훅 mock 하네스) | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 해당 없음 | — |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | K3(키 무반응)·H2b(떠난 뒤 열림)·P1b(화면 밖 패널)가 이제 red | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r5)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 하네스가 react 훅을 대체하므로 실제 React의 재렌더·effect 순서는 보지 않는다 | ⚠️ 보고만 — 관측 대상은 이벤트 → dispatch/타이머/배치 호출 edge이고 그 순서는 컴포넌트 함수 안 동기 코드다. 시각·체감은 AC12 실기 | `CascadeMenu.test.ts` 머리 주석 |
| 2 | `vi.stubGlobal('window'·'document')`가 다른 테스트로 새지 않는가 | ✅ `afterEach` `unstubAllGlobals` · 관련 vitest 236파일 green | 위 gate |

### 설계 대비 명시적 차이

- verify D8 대응 방향(순수 seam 추출)이 아니라 훅 mock 하네스로 production 컴포넌트를 직접 구동했다 — 대체물에만 있는 실패 모드:

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 상태 없는 테스트 하네스 | — |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 전역 `window`·`document` stub 공유 | `afterEach` 해제 · 236파일 green |
| 재진입 | 하네스 재호출이 실제 재렌더와 훅 순서를 다르게 매길 수 있다 | 훅 호출 순서는 컴포넌트가 고정 — refs[1]=rootRef 가정이 틀리면 배치 테스트가 먼저 깨진다(P1b red로 경로 진입 확인) |
| 다른 무효화 축 | 해당 없음 | — |

## [구현자 기입] 구현 보고 (r5)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 `shared/ui/CascadeMenu.test.ts` (production 0) |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `vitest run features/chat shared/ui pages` · 변이 10건 |
| **관측한 게이트 산출** | lint 0 error · 1 warning(기존 `useTranscriptVirtualizer.ts`) · lint 후 트리 = 신규 1파일(자기 파일 포맷만) · typecheck `error TS` 0 · 관련 vitest 236파일 1862케이스 pass·실패 0(r4 1855 + 신규 7) |
| V-pair 자기확인 | `SELF_PASS 10 / SELF_BLOCKED 1(VP-04 실기)` |
| 강제 지점 전수 | VP-09 3/3 · VP-02 edge 4/4 · D3 1/1 — 자리별 좌표는 위 표 |
| **AC 자기보고**(`Criteria-Met`) | r4 verify ✅9 + AC6(K3·J3 red)·AC7(H1·H2b·H3·J1·J2·Q1 red)·AC8(P1b·J4 red) ✅ / AC12 실기 ⚠️ |
| **합계 검산** | `✅ 12 · ⚠️ 1 · ❌ 0 = 총 13` |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r5 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r5)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 예 — pair path edge 중 테스트가 닿지 않은 자리(r1 D1·D2 → r2 D4 → r3 D6 → r4 D8). 이번엔 VP-02·09.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: 있었다 — VP-02 path·AC7·§10 EP-03 ②. r1~r4 자기확인이 이 pair를 좌표 없이 유지로 옮겼다(round 31이 이 자리를 막는다).
- 반복해서 부딪히는 환경 한계: 컴포넌트를 node 환경에서 렌더할 수 없다 — 이번엔 훅 mock 하네스로 넘었다.
- 현재 라운드·impl 턴: `r5`

## [구현자 기입] 설계 리뷰 (r6)

- 동의 / 그대로 진행: r5 verify D9(BLOCKING)를 닫는다. 유효 V는 V1 그대로. 진입 전 `handoff-review` round 32 완료(INDEX 비고).
- 이견 / 현실성 문제: D9 대응 방향("r5 하네스를 래퍼까지 넓혀")만으로는 닫히지 않는다 — r5 하네스는 react 훅만 바꿔 effect deps·커밋 순서·ref 부착·숨은 요소 포커스 거부가 없고, 그 사각에 production 결함이 있었다(Electron 실측, 놓친 #1). 그래서 React 런타임·브라우저 규칙을 흉내 내는 실행 하네스(`shared/ui/renderHarness.testfixture.ts`)로 '+' 칩·`AttachMenu`·래퍼부터 production 컴포넌트를 실행했다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음 — D-007(키보드 탐색)을 못 지키던 구현 결함을 고쳤다.

## [구현자 기입] 강제 지점 전수 (§10 대조, r6)

불변식: **사용자 입력에서 컨트롤러가 받는 결과(선택 동작·닫기·DOM 포커스·패널 배치)까지, 메뉴 path의 자리는 실제 컴포넌트와 실제 런타임 규칙(effect deps·커밋 순서·ref 부착·숨은 요소 포커스 거부)으로 실행되는 테스트 구간 안에서 관측된다.**
자리 = VP-01 path(`'+' → AttachMenu → CascadeMenu → 선택 → 삽입/관리`)와 VP-02 path(`keydown/pointerenter → reducer → 열림 경로 → submenuPosition`)가 지나는 컴포넌트의 JSX 속성·호출·대입·조건·return·deps 배열·`HANDLED_KEYS` 원소·JSX 자식 식.
검색: TypeScript AST 전수 열거(`ts.createSourceFile` → JsxAttribute·CallExpression·`=`·if·deps·JSX 식) — `CascadeMenu.tsx` 137 · `Popover.tsx` 49 · `ComposerInputController.tsx`(134-135·195-205·404-434) 26 · `ComposerChip.tsx` 18 · `AttachMenu.tsx` 13 = **243**.
차집합: 243 − (변이 red로 닫음 160 · 훅 선언(쓰임 자리 변이로 닫힘) 15 · 남긴 곳 68) = **0줄**. 변이 156건: red 145 · green 11 — green 11은 전부 열거 때 미리 `남긴 곳`(등가·NON_BLOCKING)으로 분류한 자리다.

| Pair · edge | 자리 | 직접 oracle 좌표 | 변이 → 실패 테스트 수 | 남긴 곳 |
|---|---|---|---|---|
| VP-01 ① '+' 칩 → 열림 | 컨트롤러 `:134·407-411` · `ComposerChip.tsx:22·39·41·44·45` | `composerAttachMenu.test.ts:"'+' 칩이 메뉴를 열고 닫으며 …"`(원문) · `attachMenu.flow.test.ts:'받은 onClick·ref 를 버튼에 …'` | C1·C2·C3·C3h·CC1~CC4 각 1 | 칩 disabled·title·ariaPressed·label(넘기지 않음) · 아이콘(시각) |
| VP-01 ② 컨트롤러 → AttachMenu | `:420-430` open·anchorRef·onClose·skills·plugins·onAction·관리 래퍼 · `:196-199` | 같은 원문 2케이스 · `composerAttachMenu.test.ts:'%s → 커서 자리 삽입 …'` 4 | C4·C5·C6·C10·X1c·X2c·X3c 1 · C10b·V2·V3·V5·Y4·Z1 2 · Z2·Z3 4 | — |
| VP-01 ③ AttachMenu → 트리 | `AttachMenu.tsx:30-45` 입력·라벨 6·canManage·memo deps | `attachMenu.flow.test.ts` '최상위 4행 …'·'빈 목록이면 …'·'열린 채 … 새 목록' | A1 3·A2 4·A3f 5·A3t 2·Y1 6·L1 1·L2 1·L3 5·M1~M4 각 1 | i18n 훅(하네스가 키 그대로 내는 tr) |
| VP-01 ④ AttachMenu → CascadeMenu | `:49-56` open·anchorRef·onClose·items·ariaLabel·onSelect 분기 | 같은 파일 선택 4케이스·'최상위 Esc …'·'닫힌 채 마운트돼도 …' | A6 1·A7 3·A8 5·A9 12·A10 2·A11 2·A12 6·Y2 2 | — |
| VP-01 ⑤ 래퍼 → Popover·CascadeBody | `CascadeMenu.tsx:39-46` | `CascadeMenu.flow.test.ts` '열면 …'·'최상위 Esc …'·'바깥 mousedown …'·'Enter·Space 로 …' | W1m 3·W2m 12·W3m 2·W4m 1·X3 19·X1b 6·X2 7·W8m 2·W9m 6 | — |
| VP-01 ⑥ 행 → 선택 | `:84-92`·`:159-161`·`:236` | '클릭으로 하위를 열고 깊은 동작 항목을 …'·'Enter·Space 로 동작 항목을 …' | X13b 6·B6m 5·X14b 9·X15 7·B38m 5·B2m 11·B3m 18·B4m 17 | `:160` 클릭 전 cancelHover(등가, r5 X7) |
| VP-02 ⑦ 열림 → 키가 메뉴에 닿음 | `:78`·`:108-121`·`:136-139` | '열면 … 배치 뒤 프레임에 루트가 포커스를 받는다 …' | X10 9·R1 9·R2 9·B1m 12·B22m 11·B23m 3·B24m 6·B25m 9 | `:112·118·121` 프레임 취소·deps(등가 R3·B16m·B15m) · `:119` hover 정리(NON_BLOCKING r5 X6) |
| VP-02 ⑧ keydown → reducer | `:53-59` 키 7 · `:141-146` | '↓/↑ …'·'→·Enter·Space …'·'최상위 Esc …' | KAD 6·KAU 1·KAL 1·KAR 4·KEN 3·KSP 2·KES 4·B26g 2·B27m 3·J3 5·K3 9 | — |
| VP-02 ⑨ reducer → DOM 포커스 | `:123-131` · `:231-232` | 같은 키보드 케이스 | X4b 5·B20m 5·B19m 3·B19b 4·P19m 14·P20m 15 | `:125` null 가드(tsc가 막음) |
| VP-02 ⑩ 최상위 Esc → onClose·앵커 | `:90-92` | '최상위 Esc …'(두 파일) | B7m 3·B8m 3 | — |
| VP-02 ⑪ 포인터 → 타이머 → reducer | `:97-104`·`:157-158`·`:234-235` | '하위 항목 hover 는 150ms 뒤에 …(레벨 1)'·'150ms 전에 …' | H1 4·H3 4·H2b 2·B9m 2·B9b 2·X9b 1·B12m 3·B36m 3·J1 3·J2 2·P22b 1 | `:98·101·103` 타이머 id 정리(등가 B10m·B11m) |
| VP-02 ⑫ 열린 경로 렌더 | `:133`·`:149-156`·`:218-219`·`:229-230`·`:246` | 키보드·hover·접근성 케이스 | B21m 16·B31m 16·B32m 14·B33m 4·B35m 6·P11m 4·P17m 3·P18m 5·P27m 7 | `:151` 재조정 key |
| VP-02 ⑬ → submenuPosition → style | `:188-205`·`:249-252` | '열린 하위 패널은 부모 행 좌표 …'·'화면 높이를 넘는 …' | P1b 3·J4 3·P4m 2·X5 3·P3m 3·P2m 4·X8 6·P7m 6·P8m 1·P28m 5·P30b 6 | `:192` 레벨 0 조기 반환(등가 P1m) · `:197` null 가드(tsc) · 숨김 대체 style(등가 P30m) |
| VP-02 ⑭ 안/밖 mousedown · Popover | `Popover.tsx:43-134` 중 path 자리 | '클릭으로 … 하위 패널 안 mousedown …'·'바깥 mousedown …'·'닫힌 채 마운트돼도 …' | Q1 4·X11 1·PO4m 3·PO8m 3·PO1m 3·PO2d 1·PO6d 1·PO5m 11·PO3t 2·PO7m 3·PO9h 11·PO10m 3 | Popover 현행 배치 분기·창 크기 재배치·문서 Esc(r5 X12)·DOM 마커 — 0259 무변경 |
| AC1·AC5 표시 | `:137-138`·`:210-215`·`:223`·`:227`·`:238-239`·`:250` | '루트 role=menu·aria-label …' | P9m 3·P10m 2·P10b 2·P12m 1·P15m 2·P25m 10·P26m 1·P29m 3 | className·아이콘 크기(시각 AC12) · 행 tabIndex(Tab 순서, AC 밖) · 비활성 속성(등가 P16m) |

- 줄 번호는 `CascadeMenu.tsx` = 이번 턴 수정본, 나머지 = HEAD. 실패 수는 선별 집합(메뉴 path 관측 10파일 74케이스) 기준이고, green 11건은 관련 vitest 120파일로 다시 돌렸다(잠금 표 아래).
- §10 EP-01~06의 다른 자리(트리·토큰·reducer·좌표 함수·자동완성 정돈): 코드 무변경 — 아래 V-pair 표의 r4/r5 verify 좌표 + 등록 변이 재실행.
- §10에 없는데 같은 불변식이 필요했던 지점: 포커스 시점(열 때 루트·하위를 열 때 첫 항목, 2자리). VP-02 path(`keydown`이 메뉴에 닿아야 reducer로 간다)·AC6("첫 활성 항목")·D-007에 귀속되므로 PLAN_GAP이 아니라 구현 결함 → 고쳤다(놓친 #1).

**V-pair 자기확인 (r6)** — 유지 행은 r4·r5 verify §5 좌표를 인용한다.

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | 위 ①~⑥ + VP-05·06·07·08·10 좌표 | S1 12·S2 5 red |
| VP-02 | REQUIRED | SELF_PASS | 위 ⑦~⑭ + VP-09 좌표 | K1 2·K2 4 red |
| VP-03·11 | REQUIRED | SELF_PASS(유지) | `attachMenu.render.test.ts:'/ 후보가 출처 헤더 아래 …'`·`'/ 와 @ 헤더가 같은 컴포넌트를 쓴다'` · `skillGroups.test.ts` 2 | G1 2 red |
| VP-05·10 | REQUIRED | SELF_PASS(유지) | `composerAttachMenu.test.ts:'%s → 커서 자리 삽입 …'` 4·`'컨트롤러는 메뉴 동작을 …'` · `composerToken.test.ts` 5 | S2 5·S3 3 red · Z1~Z3·X1c~X3c red |
| VP-06 | REQUIRED | SELF_PASS(유지) | `attachMenu.render.test.ts:"페이지 5자리가 navigate('/plugins') …"` · `attachMenuSelect.test.ts` 3 · `attachMenu.flow.test.ts:"'플러그인 관리'는 …"` | W1 1 red · A3f·A3t·Y1·A11·C10b red |
| VP-07 | REQUIRED | SELF_PASS(유지) | r4 구현 표 4좌표 + `attachMenu.flow.test.ts:'열린 채 … 새 목록'`(memo deps) | not selected — V2·M1~M4 red |
| VP-08 | REQUIRED | SELF_PASS(유지) | `attachMenuModel.test.ts` 4 | S1 12 red |
| VP-09 | REQUIRED | SELF_PASS(유지) | `cascadeMenuState.test.ts` '키보드 (AC6)' 5·'submenuPosition (AC8)' 4 · `CascadeMenu.test.ts:'하위 항목 hover 는 150ms 뒤에 연다 …'` | K1·K2·H1·H3 red |
| VP-04 | REQUIRED | SELF_BLOCKED | 사람 실기(AC12) — 좌표 아님 | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금 (r6)

실행: 변이마다 백업 → 선별 집합 `vitest run`(10파일 74케이스) → 원복. green이면 관련 vitest(`features/chat/{components/composer,lib,hooks}`·`shared/ui`·`pages` 120파일 888케이스)로 재확인. 최종 `git status` = 의도한 5파일.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| S1 스킬·플러그인 하위 맞바꿈 `attachMenuModel.ts` | VP-01·08 선택 증거 | red(r4 verify) | `attachMenuModel` 4 · `attachMenu.flow` 5 · `attachMenuSelect` 2 · `attachMenu.render` 1 = 12 | 잠김 |
| S2 토큰 접두 `/`↔`@` | VP-01·05·10 선택 증거 | red | `attachMenuToken` 1 · `runAttachMenuAction` 4 | 잠김 |
| S3 앞 공백 생략 `composerToken.ts` | VP-10 선택 증거 | red | 3 | 잠김 |
| K1 ← 무시 `cascadeMenuState.ts` | VP-02·09 선택 증거 | red | 키보드 표 1 · 흐름 '→·Enter·Space …' 1 | 잠김 |
| K2 왼쪽 뒤집기 생략 | VP-02·09 선택 증거 | red | 좌표 표 1 · 흐름 배치 2 · r5 배치 1 | 잠김 |
| G1 섹션 안 역순 `skillGroups.ts` | VP-03·11 선택 증거 | red | 2 | 잠김 |
| W1 `ProjectLandingPage` Composer 자리 누락 | VP-06 선택 증거 | red | 배선 원문 1 | 잠김 |
| X1b 래퍼가 onSelect 안 넘김 `CascadeMenu.tsx:43` | D9 인용 | green(r5 verify) | 'Enter·Space 로 …'·'클릭으로 …' · AttachMenu 선택 4 = 6 | 잠김 |
| X13b activate 가 onSelect 미호출 `:88` | D9 인용 | green | 같은 6 | 잠김 |
| X14b 패널 클릭 미dispatch `:161` | D9 인용 | green | 클릭·배치·접근성·목록 갱신 9 | 잠김 |
| X15 항목 클릭 인덱스 0 `:236` | D9 인용 | green | 7 | 잠김 |
| X2 래퍼 onClose 무동작 `:44` | D9 인용 | green | '최상위 Esc …'(두 파일) 포함 7 | 잠김 |
| X10 열 때 루트 포커스 삭제 `:116` | D9 인용 | green | '열면 …' 포함 9 | 잠김 |
| X4b 포커스 이동 effect 삭제 `:123-131` | D9 인용 | green | 키보드 5 | 잠김 |
| X9b hover 타이머 레벨 0 `:104` | D9 인용 | green | 'hover 는 150ms … (레벨 1)' 1 | 잠김 |
| `CascadeMenu.flow.test.ts` — 래퍼 → Popover·CascadeBody·패널·행 | 새 oracle(배선) | — | path 자리 변이 95건 red(⑤~⑭·표시 행) | 잠김 |
| `attachMenu.flow.test.ts` — '+' 칩·AttachMenu → CascadeMenu | 새 oracle(배선) | — | 85건 red(①·③·④ + 아래로 이어지는 자리) | 잠김 |
| 컨트롤러 원문 단언 확장 — '+' 칩·AttachMenu 블록 | 새 oracle(구조 proxy) | — | C1~C6·C3h·C10·C10b·V2·V3·V5·Y4 13건 red | 잠김 |
| `renderHarness.testfixture.ts` — 숨은 패널 포커스 거부·deps·ref 부착 | 새 oracle(실행 환경 규칙) | — | R1(포커스를 프레임 없이 즉시 = 수정 전 코드) 9 · B20m 5·P8m 1·PO2d 1·PO6d 1·M1~M4 1 · B22m 11·P28m 5·PO1m 3 | 잠김 |

- **분모 검산**: `선택 증거 7 · 인용 변이 8 · 새 oracle 4 = 표 행 19`.
- **덮개 회귀**: 0건 — r5 red 변이 재실행 전부 red(H1 4·H3 4·H2b 2·K3 9·P1b 3·J1 3·J2 2·J3 5·J4 3·Q1 4·X3 19·X5 3·X8 6). r5 하네스(`CascadeMenu.test.ts`)는 그대로 두었다. r5 verify의 NON_BLOCKING X11은 이번에 red 1(앵커 mousedown 단언).
- **green 11건**(전부 `남긴 곳` 분류) — 관련 vitest 120파일 888케이스 재실행 11/11 green(X6·X7·X12·B10m·B11m·B16m·P1m·P16m·P30m·R3·B15m), 마지막 단언 추가 뒤 선별 재실행도 green.

## [구현자 기입] Product/UX 파생 검토 (r6)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 해당 없음 — 문구 무변경 | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 재배치 없음 — production 변경은 포커스 시점 2자리(`focusNextFrame`), 정리는 같은 effect 반환에 모았다(`cancelFocus`·`cancelHover`) | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 새 실패 경로 없음. 고친 결함은 '+' 클릭 → ↓/↑·→·Enter 행이 전부 무반응이던 것 — 표는 맞고 구현이 못 지켰다 | — |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | **그렇게 보였다** — 수정 전 '+'로 연 메뉴에서 ↓·→·Enter가 '+' 버튼으로 가 무반응, 마우스로 열고 → 로 하위를 열면 포커스가 부모 행에 남았다(Electron 실측) | 수정 — 놓친 #1 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 늦은 포커스 프레임: 메뉴가 닫혔으면 대상이 떨어진 노드라 무동작, 다음 키가 먼저 왔으면 마지막 프레임이 최신 행을 포커스 — 정리에서 취소도 한다(R3 등가) | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r6)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 열 때 루트 포커스·→/Enter/Space로 연 하위 첫 항목 포커스가 배치 측정 중 `visibility:hidden` 패널에서 거부돼 키보드가 '+' 버튼에 갇혔다 — passive effect가 레이아웃 effect의 배치 재렌더보다 먼저 돈다 | ✅ 선조치 — 포커스를 배치 재렌더 다음 프레임으로(`requestAnimationFrame`, 정리에서 취소). `ArtifactCatalogRow`·`ProjectCatalogRow`·`GitIdentityMenus` 선례와 같은 처리 | Electron 39 일회성 실측: 수정 전 '+' 클릭 → `#anchor`, ↓↓→ 모두 `#anchor`(`focus(menu) visibility=hidden`) · 수정 후 루트 → row(0,0) → row(0,2) → row(1,0) → … → 선택 1회. 좌표는 R1 9 red |
| 2 | r5 하네스(훅만 대체)는 deps·커밋 순서·ref 부착·포커스 규칙이 없어 #1과 deps·ref 변이를 볼 수 없었다 | ✅ 선조치 — `shared/ui/renderHarness.testfixture.ts`(최소 렌더러 + 가짜 DOM) 신설, 실패 메시지는 `toJSON` 요약 | 잠금 표 마지막 행 |
| 3 | 하네스 한계: 재렌더가 늘 루트부터라 React bailout이 없다 · 포털을 제자리에 그린다 · 레이아웃은 테스트가 정한 상자다 | ⚠️ 보고만 — path 컴포넌트에 deps 없는 effect 0(AST 열거 deps 행) · 이벤트는 React 트리를 따라가 포털 위치와 무관 · 픽셀은 AC12 실기 | fixture 머리 주석 |
| 4 | `Popover`의 측정 단계(`visibility:hidden`)는 공용이라 열 때 안으로 포커스를 옮기는 소비자마다 미뤄야 한다 | ⚠️ 보고만 — 그런 소비자 중 미루지 않는 곳 0: `ArtifactCatalogRow`·`ProjectCatalogRow`·`GitIdentityMenus` rAF · `EngineFormModal` 포커스 대상은 Popover 밖 · `CascadeMenu` 이번 수정 | `grep -rln "<Popover" --include=*.tsx src/renderer/src \| xargs grep -n "autoFocus\|\.focus("` → 5파일 |

### 설계 대비 명시적 차이

- r5 verify D9 대응 방향(r5 하네스 확장) 대신 실행 하네스를 새로 만들었고, production 포커스 시점을 고쳤다(plan §11은 포커스 시점을 정하지 않았다). r5 하네스·테스트는 그대로 둔다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 프레임 콜백은 창이 숨으면 멈춘다 — 숨은 창에는 키 입력도 없다 | 해당 없음 — 사람 실기 AC12 |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 하네스의 전역 `document`·`window` stub과 렌더 중 인스턴스 포인터 | `afterEach` `unstubAllGlobals` · 포인터는 렌더 중에만 두고 `finally` 복원 · 관련 vitest 238파일 green |
| 재진입 | 닫았다 다시 열면 새 인스턴스·새 프레임 · StrictMode 이중 마운트는 첫 프레임 취소 후 재예약 | `CascadeMenu.flow.test.ts:'닫았다 다시 열면 …'` · `attachMenu.flow.test.ts:'닫힌 채 마운트돼도 …'` |
| 다른 무효화 축 | 프레임 전에 다음 키가 오면 keydown은 이전 포커스 행에서 루트로 올라가 `stateRef`로 처리된다 | `CascadeMenu.flow.test.ts:'↓/↑ …'`(한 프레임 안 두 키) · B2m 11 red |

## [구현자 기입] 구현 보고 (r6)

| 항목 | 내용 |
|---|---|
| 변경 파일 | production `shared/ui/CascadeMenu.tsx`(포커스 시점) · 신규 `shared/ui/renderHarness.testfixture.ts` · `shared/ui/CascadeMenu.flow.test.ts` · `composer/attachMenu.flow.test.ts` · 수정 `composer/composerAttachMenu.test.ts` |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `vitest run features/chat shared/ui pages` · 변이 156건(선별 10파일 → green은 120파일) · Electron 실측 1회 |
| **관측한 게이트 산출** | lint 0 error · 1 warning(기존 `useTranscriptVirtualizer.ts`) · lint 후 트리 = 의도한 5파일 · typecheck(node·web·test) exit 0·`error TS` 0 · 관련 vitest 238파일 1886케이스 pass·실패 0(r5 1862 + 신규 24) |
| V-pair 자기확인 | `SELF_PASS 10 / SELF_BLOCKED 1(VP-04 실기)` |
| 강제 지점 전수 | AST 243자리 · 차집합 0 · 변이 닫힘 160 · 선언 15 · 남긴 곳 68(사유별) |
| **AC 자기보고**(`Criteria-Met`) | AC1 최상위 4행·라벨 키(L1~L3 red) · AC2 스킬 선택 → onAction(X1b·X13b·X15 red) · AC3 플러그인·관리(A11·C10 red) · AC4 빈 행(L2·P10m red) · AC5 title(P15m red) · AC6 키·DOM 포커스·Esc(X10·X4b·X2·R1 red) · AC7 레벨 1 hover·이탈·안/밖 mousedown(X9b·H2b·Q1·PO8m red) · AC8 배치(P1b·P8m red) · AC9~AC11 G1 red·기존 스위트 green · AC13 gate ✅ / AC12 실기 ⚠️ |
| **합계 검산** | `✅ 12 · ⚠️ 1 · ❌ 0 = 총 13` |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r6 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r6)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 예 — pair path 자리가 테스트 실행 구간 밖(r1 D1·D2 → r2 D4 → r3 D6 → r4 D8 → r5 D9). 이번엔 하네스가 브라우저 포커스 규칙을 몰라 production 결함까지 green이었다.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: AC12(사람 실기: 키보드 탐색)가 r1부터 대기였다 — 실기 전엔 이 결함을 볼 자리가 없었다. AC6 oracle이 reducer 표 UT라 DOM 포커스를 요구하지 않았다.
- 반복해서 부딪히는 환경 한계: node 환경에 DOM이 없다 — React 런타임·브라우저 규칙을 흉내 내는 하네스 + Electron 일회성 실측(좌표 아님)으로 넘었다.
- 현재 라운드·impl 턴: `r6`

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | '+' 메뉴 선택 → 컨트롤러 삽입 경로를 잠그는 UT가 없다. 인용 변이 Z1(커서 대신 `text.length`)·Z2(`focus(0)`)·Z3(`replacement.trim()`) 전부 green | VP-05 oracle "컨트롤러 UT(스냅샷 텍스트·커서)" · AC2·AC3 | 컨트롤러가 쓰는 동작을 관측하는 UT 추가 — Z1~Z3 red로 닫힘 | BLOCKING | closed(r2 — Z1~Z3 red) |
| D2 | `AttachMenu`의 '플러그인 관리' 콜백 호출을 잠그는 UT가 없다. 인용 변이 Z4(`managePlugins`에서 콜백 미호출) green | VP-06 oracle "AttachMenu 콜백 UT" · AC3 | `onSelect` 분기 콜백 UT — Z4 red, `onAction`으로 새지 않음 | BLOCKING | closed(r2 — Z4 red) |
| D3 | AC7 하위 패널 안/밖 mousedown은 plan의 stub document UT 대신 DOM 포함 구조 증거로 잠김 | AC7 | 재구현 시 보강 권장 | NON_BLOCKING | closed(r5 — Q1 red) |
| D4 | `AttachMenu`가 `onManagePlugins` 유무로 '플러그인 관리' 행을 그리는지(`canManagePlugins: !!onManagePlugins`) 잠기지 않았다. X5(항상 false)·X6(항상 true) green | VP-06 path 마지막 edge · AC3 · §10 EP-05 | 콜백 있음/없음 렌더로 관리 행 유무 단언 — X5·X6 red로 닫힘 | BLOCKING | closed(r3 — X5·X6 red) |
| D5 | 컨트롤러의 `pickAttachments` 전달 자리 미잠금 — X3 green(파일 추가 무동작) | 기존 파일 추가 동작 | 원문 단언에 추가 권장 | NON_BLOCKING | closed(r3 — X3 red) |
| D6 | 메뉴 플러그인 목록이 훅의 **전체** 후보라는 계약 미잠금. 인용 변이 V4(훅 `plugins: allPlugins` → 필터 `plugins`)·V2(컨트롤러 `plugins={[]}`) green · eslint·tsc 0 | VP-07 oracle "훅 반환·트리 UT" · §10 EP-04 · D-006 · AC3 | 훅 하네스로 `@` 접두 토큰 중에도 `plugins` = 전체 후보 단언 + 컨트롤러 `plugins=` 전달 원문 단언 — V2·V4 red로 닫힘 | BLOCKING | closed(r4 — V2·V4 red, 독립 I1~I3 red) |
| D7 | 컨트롤러의 `skills={skills}` 전달 미잠금 — V3(`[]`)·V5(`autocomplete.suggestions`) green | D-006 스킬 절반(현재 코드 충족) | D6 원문 단언에 함께 추가 권장 | NON_BLOCKING | closed(r4 — V3·V5 red) |
| D8 | `CascadeMenu`가 reducer·`submenuPosition`을 production에 잇는 자리와 hover 지연 150ms에 직접 oracle 없음. 변이 H1(`HOVER_OPEN_DELAY_MS = 0`)·H3(타이머 없이 즉시 dispatch)·H2b(`onLeave` 무동작)·K3(`onKeyDown` 미dispatch)·P1b(`submenuPosition` 우회) 전부 vitest·tsc·eslint green | VP-09 §10 EP-03 ② · VP-02 path · AC6·AC7·AC8 · D-007·D-008 | 타이머·키·배치 연결을 주입 가능한 순수 seam으로 떼어 fake timer로 149ms 미열림·150ms 열림·이탈 시 미열림 단언 + `onKeyDown`·`submenuPosition` 호출 edge 잠금 — 5변이 red로 닫힘 | BLOCKING | closed(r5 — H1·H2b·H3·K3·P1b red) |
| D9 | `CascadeMenu`의 선택·닫기·포커스·hover 레벨 edge에 직접 oracle 없음. 잔여 진단 0까지 민 변이 X1b(래퍼가 `onSelect`를 CascadeBody에 안 넘김)·X13b(activate 효과가 `onSelect` 미호출)·X14b(패널 클릭이 dispatch 안 함)·X15(항목 클릭 인덱스 0 고정) · X2(래퍼 `onClose` 무동작 — 최상위 Esc가 메뉴를 못 닫음)·X10(열릴 때 루트 포커스 생략 — keydown이 메뉴에 안 닿음)·X4b(포커스 이동 effect 삭제)·X9b(hover 타이머가 레벨 0으로 dispatch) 전부 관련 vitest 864·tsc·eslint error 0 green | VP-01 path `CascadeMenu → 선택` · VP-02 path `keydown`/`pointerenter → reducer` · AC1~AC3(선택 삽입)·AC6·AC7 · D-007 | r5 하네스를 래퍼 `CascadeMenu`(Popover 경유)까지 넓혀 클릭·Enter → 받은 `onSelect(action)`·`onClose` 호출, 최상위 Esc → 래퍼 `onClose`, 마운트 시 루트 focus, 키 이동 후 그 행 `focus`, 하위 패널(level 1) hover → `open` 단언 — 8변이 red로 닫힘 | BLOCKING | closed(r6 — 인용 8/8 red) |
