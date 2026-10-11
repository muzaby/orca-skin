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

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-… | … | … | … | … | … |

- §10에 없는데 같은 불변식이 필요했던 지점: …

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | REQUIRED | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| … | … | 최초 | … | … |

- **분모 검산**: …
- **덮개 회귀**: …

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … | … |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | … | … |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: …

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … | … |
| 재진입 | … | … |
| 다른 무효화 축 | … | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출** | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| **AC 자기보고**(`Criteria-Met`) | … |
| **합계 검산** | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: …
- 그것을 막았어야 할 plan 지침·AC가 있었는가: …
- 반복해서 부딪히는 환경 한계: …
- 현재 라운드·impl 턴: `r1`

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
