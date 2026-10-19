# Plan — 0267-harness-entry-menu

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex (설계 역할) / 2026-10-19 |
| 상태 / 라운드 | READY / r1 |
| V mode / 기준 V / 유효 V | Baseline V / none / V1 |
| 기준 코드 | origin/main `5a99c1f5` |

# Part I — Product & UX Contract

## 1. 목표와 출처

새 대화 진입에서 하네스를 먼저 고른다. 사용자 원문: “nav 새 대화 클릭시, nav 우측 라인의 오른쪽에 붙어있는 정렬된 팝업을 띄운다. 팝업에는 claude, opencode 를 항목으로 표시하고 항목 좌측에는 각 제품의 브랜드로고를 정렬한다.”

같은 요청의 히어로 로고 위치와 네이티브 확장 제어는 별도 결정 대기다. 이 V1은 답변과 독립적인 새 대화 진입 경로만 확정하며, 나머지 요구를 완료로 보고하지 않는다.

## 2. Decision Ledger

| ID | 결정 | 출처 / 조건 | 상태 |
|---|---|---|---|
| D-01 | 새 대화 클릭은 하네스 팝업을 연다. 선택 전에는 현재 대화를 유지한다. | 사용자 요구, 진입 취소를 위한 해석 | ACTIVE |
| D-02 | 팝업 좌측을 nav 우측 경계에 붙이고 상단은 새 대화 버튼에 맞춘다. | 사용자 요구 | ACTIVE |
| D-03 | Claude·OpenCode 순서, 같은 아이콘 칸의 좌측 브랜드 마크를 표시한다. | 사용자 요구 | ACTIVE |
| D-04 | 선택한 하네스의 새 초안으로 /new에 진입한다. 기존 세션의 하네스와 메시지는 보존한다. | 사용자 요구, chatStore 기존 세션 격리 계약 | ACTIVE |

ACTIVE 결정 ↔ AC 대조: D-01→AC1·4, D-02→AC2, D-03→AC1, D-04→AC3, 충돌 0.

## 3. 흐름과 상태

| 시작 / 입력 | 결과 |
|---|---|
| 펼친/접힌 nav의 새 대화 클릭 | 현재 화면 위 하네스 메뉴, aria-expanded=true |
| Claude/OpenCode 선택 | 새 초안 생성, 하네스 지정, /new 이동, 메뉴 닫힘 |
| Escape / 바깥 클릭 | 현재 초안·세션 유지, 메뉴 닫힘 |
| 키보드 열기·방향키·Enter | 같은 선택 결과, Escape 초점 복귀 |
| nav resize / 창 축소 | 측정값 재계산, viewport 안으로 위치 보정 |

설치·모델 유무는 기존 컴포저의 표시/선택 경로를 유지한다. 목록 자체를 감춰 선택한 하네스를 바꾸지 않는다.

## 4. 범위와 인수 기준

| R / AT / AC | 행동 기준 | 검증 / production 경로 |
|---|---|---|
| R-01 / AT-01 / AC1 | 펼친/접힌 새 대화 클릭에 브랜드 마크를 가진 Claude·OpenCode 메뉴만 연다. | Sidebar.interaction.test.ts: 두 nav 상태에서 실제 클릭→메뉴·선택 전 상태 |
| R-02 / AT-02 / AC2 | nav 오른쪽 경계와 버튼 상단 정렬, 좁은 viewport 보정 | popoverPosition.test.ts 좌표 단언 + Sidebar.interaction.test.ts 경계 운반 + 두 테마 시각 확인 |
| R-03 / AT-03 / AC3 | 각 항목은 해당 하네스로 새 초안을 만들고 기존 세션 보존, /new 재진입도 동일 | Sidebar.interaction.test.ts 선택→실제 chatStore 결과와 navigation; chatStore.harness.test.ts |
| R-04 / AT-04 / AC4 | 취소는 대화 불변, 키보드 선택과 Escape 초점 복귀 | Sidebar.interaction.test.ts 실제 key·outside 이벤트 |

## 5. V / Trace Matrix

모든 노드는 NEW다. R-01~04↔AT-01~04는 위 AC를, SD-01↔ST-01은 선택→초안→라우트 전이를, AR-01↔IT-01은 Sidebar·팝업·store 경계를, MD-01↔UT-01은 배치 산술을 소유한다.

| Pair | left ↔ right / requiredness | production path | 직접 oracle | 강제 지점 |
|---|---|---|---|---|
| VP-01 | R-01~04 ↔ AT-01~04 / REQUIRED | Sidebar 버튼→메뉴→선택/취소→화면 | 위 AC 좌표; 시각은 실제 브라우저 관측 | EP1~3 |
| VP-02 | SD-01 ↔ ST-01 / REQUIRED | Sidebar 선택→newChat→setModel→navigate | Sidebar.interaction.test.ts: 하네스 선택이 실제 새 초안과 이동을 일치시킨다 | EP1, EP3 |
| VP-03 | AR-01 ↔ IT-01 / REQUIRED | Sidebar→NewChatHarnessMenu→Popover, 메뉴→store | Sidebar.interaction.test.ts: 두 nav·브랜드·좌표·키보드 | EP1~3 |
| VP-04 | MD-01 ↔ UT-01 / REQUIRED | anchor 측정→popoverPosition→style | popoverPosition.test.ts: 오른쪽 정렬·overflow·기존 top/bottom | EP2 |

직접 행동 oracle을 사용한다. 선택 적대 증거 M1: 하네스 두 항목의 선택값 맞바꿈, Sidebar 메뉴 정의 자리에서 심어 VP-02의 대상 구별을 확인한다.

# Part II — Technical Design

## 8. 조사

| 대상 / 검색 | 관측 | 의미 |
|---|---|---|
| Sidebar.tsx `SIDEBAR_NAV.map` | 펼침/접힘 2자리, 모두 navigate(it.path) | 두 진입점 모두 변경 |
| Popover.tsx `placement` | top/bottom, GAP=6 | right와 gap=0, nav 경계 anchor 추가 필요 |
| chatStore.ts newChat / setModel | 각각 새 초안 생성 / 미전송 초안의 하네스 선택·기억 | 재사용; 모델 미지정은 컴포저 기본 선택에 위임 |
| claude.ai/favicon.svg | 공식 Claude 마크 SVG 확인 | 문자열 별/대체 그림을 쓰지 않는다 |
| anomalyco/opencode v1.19.0 logo.tsx Mark | MIT, 16×20 공식 마크 | 기존 OPENCODE-LICENSE 보존 |

## 9. AS-IS → TO-BE

| 축 | AS-IS | TO-BE |
|---|---|---|
| 진입 | Sidebar 두 버튼→/new | 두 버튼→메뉴→newChat·setModel→/new |
| 배치 | Popover top/bottom | right 추가, 세로는 trigger·가로는 nav 경계 |
| 상태 | Sidebar에 메뉴 상태 없음 | 로컬 open, 취소는 store 미변경 |
| 로고 | 메뉴 없음 | 하네스별 Logo + 조립 registry |

## 10. 계약 / 강제 지점

| 지점 | SSOT / 언제 강제 (자리 목록) | 검색 | 실패 의미 / oracle |
|---|---|---|---|
| EP1 (3자리) | Sidebar 펼침 버튼·접힘 버튼·NewChatHarnessMenu 조립 | `rg -n 'SIDEBAR_NAV.map|NewChatHarnessMenu' app/src/renderer/src/app/Sidebar.tsx` | 한 nav에서 미노출 / Sidebar.interaction.test.ts |
| EP2 (3자리) | 메뉴의 경계/trigger 전달·Popover 측정 호출·position 결과 style 적용 | `rg -n 'boundaryRef|popoverPosition|style=\{style\}' app/src/renderer/src/{app,shared/ui}` | 버튼 우측에 붙거나 경계 overflow / Sidebar.interaction.test.ts, popoverPosition.test.ts |
| EP3 (3자리) | 메뉴 항목 backend·선택의 newChat/setModel·navigate('/new') | `rg -n 'backend|newChat|setModel|navigate' app/src/renderer/src/app/NewChatHarnessMenu.tsx` | 잘못된 하네스/기존 세션 훼손 / Sidebar.interaction.test.ts |

목록은 계약 값을 운반하는 자리를 센다. 선언·타입·중복 주석은 자리가 아니다.

## 11. 구현 / 수명 / 문서

- NewChatHarnessMenu는 app 조립, 하네스 마크는 chat/harnesses의 구체 구현과 registry를 통해 소비한다. 다른 feature끼리 import하지 않는다.
- Popover의 기존 top/bottom 기본값은 유지하며 right 배치만 추가한다. 새 위치 계산은 순수 파일로 분리한다.
- close·외부 클릭·Escape·선택에서 local open을 닫는다. 위치 observer/listener는 닫을 때 해제한다.
- DB/외부 원본 쓰기는 없다. 기존 settingsApi의 lastBackend 저장을 재사용하고 실패는 기존 reportError 경로다.
- 새 컴포넌트와 Popover API 변경은 design-components.md에 기록한다. 새 의존성은 없다.

## 19. 게이트 / READY 검토

`app/src/renderer/AGENTS.md`에 따라 lint·typecheck, 관련 비-DB vitest, 문서 inventory·catalog 검사를 실행한다. 실제 브라우저 시각 확인 가능 여부와 두 테마·폭·키보드 관측은 구현 보고에 구분한다.

READY: 코드/경로·기존 호출을 확인했다. Product/UX→AC→V→§10을 대조했으며 구현과 설계는 별도 커밋이다. 확장 제어/히어로 정렬 질의는 이 V1의 인수 기준에 포함하지 않았다.

## [구현자 기입]

구현 후 설계 리뷰·강제 지점·수정 잠금·Product/UX 검토·잠재 문제·구현 보고·Review Signals를 기입한다.
