# Plan — 0267-harness-entry-menu

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex (설계 역할) / 2026-10-19 |
| 상태 / 라운드 | READY / r1.4 |
| V mode / 기준 V / 유효 V | Delta V / r1.3 (`148f91c5`) / V1+ΔV1+ΔV2+ΔV3+ΔV4+ΔV5+ΔV6 |
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

## ΔV1 — 히어로와 세션 네이티브 확장 (사용자 응답 확정)

2026-10-19 사용자 답변: 히어로는 “예시대로 로고 왼쪽, 문구 오른쪽”, 플러그인 원천은 “각 하네스의 네이티브 플러그인”, 미지원 제어는 “활성화 표시하되 끌수 없도록”. 유효 V는 V1 + ΔV1이며 기존 VP-01~04는 REQUIRED로 함께 구현한다.

### Decision / 제품 계약

| ID | 결정 | 상태 / 출처 |
|---|---|---|
| D-05 | Claude Work/Code 히어로는 공식 로고+기존 문구를 한 줄 중앙 배치한다. | ACTIVE / 사용자 답변 |
| D-06 | transcript 케밥은 타일 표시와 활성 하네스 이름을 그룹 제목으로 갖는다. 하네스 아래 MCP·플러그인 하위 메뉴를 둔다. | ACTIVE / 원문 요구 |
| D-07 | 목록은 해당 실행 하네스가 보고하는 네이티브 리소스만 사용한다. Orca 카탈로그를 대신 보여주지 않는다. | ACTIVE / 사용자 답변 |
| D-08 | Claude MCP만 SDK의 세션 전용 toggleMcpServer로 제어한다. OpenCode MCP와 네이티브 플러그인은 상태를 표시하고 제어를 비활성화한다. | ACTIVE / 미지원 제어에 대한 사용자 답변; 설치 SDK 표면 조사 |
| D-09 | 연결 오류·인증 필요·비활성은 실제 상태로 표시한다. 실행 채널이 없으면 미연결 안내, 빈 목록과 조회 실패는 구분한다. | ACTIVE / 거짓 활성 표시 방지, 구현 해석 |

### 흐름 / 추가 AC

메뉴 열기→현재 세션 runtime 조회→MCP/플러그인 목록 표시. Claude MCP 클릭→중복 요청 차단→SDK 토글→새 상태 조회이며, 실패는 상태를 성공으로 덮지 않고 오류 안내를 남긴다.
세션 전환·메뉴 닫기 이후 지각 응답은 폐기한다. 조회를 위해 세션을 새로 실행하거나 native 설정 파일을 쓰지 않는다.

| R / AT / AC | 동작 기준 | 직접 oracle / production 경로 |
|---|---|---|
| R-05 / AT-05 / AC5 | Claude 두 모드에서 로고가 문구 앞, 묶음 중앙; OpenCode 랜딩 보존 | AgentModeToggle.test.ts 모드별 render + 시각 확인 |
| R-06 / AT-06 / AC6 | 케밥에 타일 표시·현재 하네스 그룹, MCP·플러그인 하위 메뉴와 우측 토글 | ChatTitleBar.render.test.ts + nativeResourcesMenu.test.ts, 실제 CascadeBody 렌더 |
| R-07 / AT-07 / AC7 | native 리소스 상태만 표시, 비밀/서버 설정·플러그인 경로는 renderer로 보내지 않는다 | 하네스별 native-resources.test.ts → DTO 직접 단언 |
| R-08 / AT-08 / AC8 | Claude MCP enable/disable이 같은 live channel에 적용되고 실패를 전파한다 | claude native-resources.test.ts, session-runtime.test.ts, session-resources.test.ts |
| R-09 / AT-09 / AC9 | 미지원 항목은 상태와 비활성 제어, 서버에도 쓰기 요청 거부 | nativeResourcesMenu.test.ts, session-resources.test.ts |
| R-10 / AT-10 / AC10 | 채널 없음·조회 실패·빈 목록 구분, 지각 응답이 다른 세션에 표시되지 않는다 | useNativeResources.test.ts + session-runtime.test.ts |

### ΔV nodes / pairs

추가 노드는 NEW이며 기존 상위 행은 교체하지 않는다. AR-02는 LiveTurn→SessionRuntime→IPC→preload→renderer, SD-02는 읽기/토글 수명, MD-02는 하네스별 DTO와 메뉴 파생이다.

| Pair | left ↔ right / requiredness | 경로 / 직접 oracle | 강제 지점 |
|---|---|---|---|
| VP-05 | R-05 ↔ AT-05 / REQUIRED | AgentModeToggle→ClaudeLogo→h1; AgentModeToggle.test.ts | EP4 |
| VP-06 | R-06~10 ↔ AT-06~10 / REQUIRED | 케밥→조회/선택→SDK→표시; AC6~10 좌표 | EP5~8 |
| VP-07 | SD-02 ↔ ST-02 / REQUIRED | 열기/전환/토글→결과 수용; useNativeResources.test.ts, session-runtime.test.ts | EP6~8 |
| VP-08 | AR-02 ↔ IT-02 / REQUIRED | LiveTurn→runtime→bootstrap/handler→preload→sessionApi→hook→케밥; session-resources.test.ts·preload/index.test.ts·ChatTitleBar.render.test.ts | EP5~8 |
| VP-09 | MD-02 ↔ UT-02 / REQUIRED | native 상태→공개 DTO→메뉴 행; native-resources.test.ts·nativeResourcesMenu.test.ts | EP5, EP8 |

### §10 추가 자리 / 설계

| 지점 | 고정 자리 목록 / 검색 | 실패 의미 / oracle |
|---|---|---|
| EP4 (1자리) | AgentModeToggle h1의 로고·문구 순서. `rg -n 'data-agent-mode-hero|ClaudeLogo' app/src/renderer/src/features/chat` | 역순/다른 모드 문구 / AgentModeToggle.test.ts |
| EP5 (4자리) | Claude adapter의 native 제어 주입·system init plugin 수집, OpenCode channel의 client/cwd 주입·config/status DTO 생성 | 다른 세션/가짜 원천 / 각 adapter 테스트 + native-resources.test.ts |
| EP6 (4자리) | SessionRuntime 읽기/쓰기의 live 세대 확인, bootstrap lookup 주입, handler의 sessionId/지원 검사 | 지각 쓰기·다른 세션·미지원 제어 / session-runtime.test.ts·session-resources.test.ts |
| EP7 (4자리) | IPC 채널/schema 등록, preload 두 메서드, sessionApi 전달, hook sessionId/종류/id/enabled 운반 | 잘못된 요청/응답 / session-resources.test.ts·preload/index.test.ts·useNativeResources.test.ts |
| EP8 (4자리) | ChatTitleBar의 backend/sessionId/open 전달, hook 지각 응답 폐기, 메뉴 두 하위 목록 매핑, Cascade checked/disabled 렌더 | 다른 하네스 표시·잘못된 toggle / ChatTitleBar.render.test.ts·useNativeResources.test.ts·nativeResourcesMenu.test.ts |

검색은 `rg -n 'nativeResources|setNativeResource|NativeResources|NativeResource' app/src`로 프로덕션 경로 전수를 대조한다. 선언·타입·재수출을 제외하고 위 자리와 연결한다.
추가 적대 증거 M2: 메뉴 파생의 MCP/플러그인 자리를 맞바꿔 AC6·9가 실패하는지 확인한다.

AS-IS는 LiveTurn에 native 확장 조회/제어가 없고 케밥이 타일과 세션 동작만 표시한다. TO-BE는 선택적 LiveTurn 메서드를 runtime이 세대 확인 후 전달하고, bootstrap에서 현재 runtime을 찾아 새 IPC에 주입한다.
공통 계약은 `shared/native-resources.ts`, 하네스 구현은 각 adapter 하위, UI/상태는 chat feature가 소유한다. SDK `source=sdk` MCP와 Orca가 주입한 pluginRoots는 native 목록에서 제외한다.
OpenCode plugin 목록은 `config.get`의 유효 plugin 목록이며 연결 상태라고 주장하지 않고 활성 구성으로 표시한다. Claude plugin 목록은 system/init의 실제 로드 목록을 보존한다.
공개 DTO는 id·name·kind·status·enabled·canToggle만 갖는다. MCP 원문 config·env·headers·plugin filesystem path는 반환하지 않는다.
설정/DB 쓰기와 신규 의존성은 없다. 세션 종료·재시작 시 native 하네스 기본 상태를 따르며 이번 토글은 현재 실행 채널에만 적용한다.

### 문서 / 운영 gate / 정합성

IPC_CONTRACT.md와 design-components.md, 생성 inventory를 갱신한다. lint·typecheck, 해당 main/renderer/preload 비-DB vitest, 문서 검사, build가 추가 게이트다.
ACTIVE D-05~09 ↔ AC5~10 대조: 충돌 0. UI 두 하위 목록과 두 하네스의 서로 다른 제어 지원을 분리하고, 기본값이 다른 fixture로 매핑을 검증한다.

## Delta V2 — 명시 선택과 모델 기본값 복원 충돌 보완

기준은 ΔV1 설계 커밋 `adbfed2d`. Composer의 기본 모델 복원은 기억된 하네스의 모델이 없을 때 다른 하네스로 전환한다. 새 메뉴의 명시 선택까지 이 경로에 들어가 AC3를 위반할 수 있으므로, 구현 중 발견한 PLAN_GAP을 이번 설계 정정으로 닫는다.

| 결정 | 상태 | 내용 / 출처 |
|---|---|---|
| D-10 | ACTIVE | 새 대화에서 직접 선택한 하네스는 모델 목록이 비거나 늦게 도착해도 유지한다. 기존 D-02·AC3의 선택값 보존을 구체화한다. 직접 다른 모델/하네스를 선택하는 동작과 기억된 기본값의 기존 폴백은 유지한다. |

| AC | 행동 기준 | 검증 수단 / production 경로 |
|---|---|---|
| AC11 | OpenCode를 직접 선택하고 Claude 모델만 있을 때 랜딩과 모델 표시가 Claude로 바뀌지 않는다. 뒤늦게 OpenCode 모델이 도착하면 그것을 기본 선택한다. 지각 부트 설정도 직접 선택을 덮지 않는다. 새 초안은 표시를 초기화하고 기억된 값의 기존 폴백을 허용한다. | 실제 Sidebar 선택→store/reducer→Composer 렌더/effect; store seed/reset 테스트 |

상태 전이: 명시 선택 + 모델 없음 → 선택한 하네스/모델 미선택 유지; 해당 모델 도착 → 동일 하네스 모델 채움; 새 초안 생성 → 명시 선택 표시 초기화. 사용자 모델 메뉴는 기존처럼 변경 가능하다.

| 노드 | delta | 내용 / 연결 |
|---|---|---|
| R-11 / AT-11 | NEW | 명시 하네스 보존 / AC11 |
| SD-01 / ST-01 | CHANGED | 선택 후 모델 목록 도착·부트 설정·새 초안 수명 추가; 기존 취소/route 보존 |
| AR-01 / IT-01 | CHANGED | nav→store→reducer의 선택 출처 전달, Composer 두 소비처와 seed guard 추가 |
| MD-03 / UT-03 | NEW | 메모리 전용 명시 선택 상태와 자동 폴백 제약 |

| Pair | 수준 / requiredness | 경로 / 직접 oracle | §10 |
|---|---|---|---|
| VP-10 | R-11 ↔ AT-11 / REQUIRED | Sidebar.interaction.test.ts 선택→실제 store의 explicit 표식; Composer.selection.test.ts 실제 Composer의 모델 표시와 effect 후 backend·providerKey 관측 | EP9 |
| VP-11 | MD-03 ↔ UT-03 / REQUIRED | chatStore.harness.test.ts 실제 action→reducer→seed/reset: true/false, OpenCode/Claude 구별; Composer.selection.test.ts 명시 선택/기억값 모델 없음·늦은 모델 | EP9 |
| VP-02·03 | SD-01↔ST-01·AR-01↔IT-01 / REQUIRED | 기존 증거 유지 + 위 선택 수명·전달 테스트 | EP3·9 |

### §10 추가 자리

| 지점 | 언제 강제 / 자리 검색 | 실패 의미 / 직접 oracle |
|---|---|---|
| EP9 (7자리) | ①nav의 명시 선택 인자 ②store dispatch ③reducer SET_MODEL 보존 ④initialChatState→freshEntry 초기화 ⑤seedLandingBackend 보호 ⑥Composer selectedModel 파생 ⑦Composer effect 기본 모델 복원. nav·store·reducer·Composer의 하네스/모델 선택 production 결과 전수 대조(아래 검색) | 다른 하네스로 자동 전환. ① Sidebar.interaction 선택 상태; ②③④⑤ chatStore.harness explicit/reset/late seed; ⑥⑦ Composer.selection 실제 렌더 chip와 effect 후 state. |

자리 검색: `rg -n 'setModel|SET_MODEL|seedLandingBackend|draftSelection|initialChatState' app/src/renderer/src/app app/src/renderer/src/features/chat`. 테스트·주석·재수출과 기존 saved-session 복원 경로를 구분해 위 7자리에 매핑한다.

기술 설계: ChatState에 메모리 전용 `harnessExplicitlySelected`를 둔다. setModel의 선택적 options가 true일 때 설정하고 이후 자동 모델 채움에도 보존한다. 초기 state는 false이며 새 초안에서 초기화한다. seedLandingBackend는 명시 선택 초안을 건너뛴다. Composer의 자동 폴백 두 자리만 saved/turn lock 또는 명시 선택 여부로 제약하고 수동 모델 메뉴의 필터는 변경하지 않는다. DB·설정 포맷·IPC 변경 없음.

적대 증거: not selected — 실제 reducer·effect·표시 결과를 보는 직접 oracle. 기존 M1/M2 유지. gate는 기존과 동일하며 Composer/store/reducer 관련 비-DB 회귀를 추가한다. ACTIVE D-01~10 ↔ AC1~11 정합, 새 사용자 결정 없음; READY.

## Delta V3 — 실제 네이티브 목록과 프로젝트 하네스 표시

사용자는 실제 Orca에서도 Claude MCP·플러그인이 안 보인다고 확인했다. 하네스 그룹의 연결 요약 제거와 프로젝트 OpenCode 헤더도 명시 요청했다. 기존 r1 보고는 당시 런타임 전용 계약의 관측으로 보존하며, 아래 변경이 우선한다.

### 결정 / 관측 계약

| ID | 상태 | 내용 / 근거 |
|---|---|---|
| D-11 | ACTIVE | 하네스 그룹 제목 아래 연결 요약을 제거한다. 개별 MCP 상태와 하위 메뉴의 로딩·오류 안내는 유지한다. 사용자 요청. |
| D-12 | ACTIVE | Claude 설치·설정 메타데이터를 읽어 세션이 실행 중이 아니어도 네이티브 목록을 노출한다. 활성 설정은 `설정에서 활성화`, 명시 비활성은 `비활성화`, 설치만 확인되면 `설치됨`으로 구별한다. 실제 실행 상태가 있으면 그 상태가 우선한다. 사용자의 누락 수정 요구를 위한 읽기 전용 보완이며 D-07·09의 런타임 전용/연결 없으면 빈 목록 부분을 대체한다. |
| D-13 | ACTIVE | 프로젝트 빈 화면도 현재 backend의 기존 랜딩 헤더를 사용한다. Claude는 기존 로고+Work/Code 문구, OpenCode는 기존 브랜드 로고. Composer·프로젝트 정보·대화 목록을 유지한다. 사용자 요청. |

D-08의 세션 한정 제어는 유지한다. 구성에서만 발견한 항목은 모두 읽기 전용이며 전역 파일 쓰기·설치·MCP 자동 실행·user settingSources 확대는 하지 않는다. 이는 표시 요청에 실행 정책 변경을 섞지 않기 위한 구현 경계다.

| AC | 행동 기준 | 검증 수단 / production 경로 |
|---|---|---|
| AC12 | Claude/OpenCode 그룹은 제목과 MCP·플러그인만 표시하고 `연결됨` 요약을 표시하지 않는다. 하위 행 상태는 유지한다. | ChatTitleBar.native-resources.test.ts 실제 팝업·두 backend·늦은 응답과 submenu 행 |
| AC13 | 저장 세션의 backend/cwd로 Claude 사용자·프로젝트·로컬 MCP와 설치 플러그인을 읽는다. 무관한 프로젝트 설치는 제외하고 비활성·설정 활성·실제 연결 상태를 구별한다. 실 실행과 동일 항목은 중복하지 않는다. live가 없어도 표시하고 조회 실패는 오류로 보인다. | configured-resources.test.ts 실제 임시 파일, bootstrap.native-history.test.ts DB→등록 callback, session-resources.test.ts IPC 합성, nativeResourcesMenu.test.ts offline 항목 |
| AC14 | 프로젝트 Composer의 backend 변경에 맞춰 헤더가 바뀌며 Claude 복귀도 된다. 기존 프로젝트 정보·Composer props·목록과 loading 보호는 유지한다. | agentModeLanding.render.test.ts 실제 페이지+헤더 registry, 두 backend 렌더 |

### 조사 / 기술 설계

현재 session-resources handler는 supervisor의 live만 읽으며, ProjectLandingPage는 AgentModeToggle을 고정 배치한다. Claude는 기존 provider 격리 정책으로 settingSources=user를 제외한다. 설치된 네이티브 플러그인을 로딩했다고 거짓 표시하는 대신 구성 관측을 별도로 합친다.

Claude reader는 native root의 settings.json, plugins/installed_plugins.json(v2), 사용자 `.claude.json`(CLAUDE_CONFIG_DIR 지정 시 그 root 아래), cwd의 프로젝트 root `.mcp.json`·`.claude/settings{,.local}.json`과 global config의 해당 project 항목만 읽는다. project/local 설치는 projectPath가 해당 root/cwd인 항목만 포함한다. plugin manifest의 inline/file MCP 및 기본 `.mcp.json`도 읽되 상대 경로를 plugin root 안으로 제한한다. 설정 우선순위는 user→project→local, MCP 동명은 user→project→local이며 live가 최종 우선한다. 파일 없음은 빈 구성, 읽기/JSON 오류는 경로·원문을 노출하지 않는 조회 오류다. 네이티브 자격증명·env·경로는 DTO에서 제거한다.

새 `configured`·`installed` status를 공유 DTO와 i18n에 추가한다. plugin ID는 정규화된 설치 경로의 hash로 live/init과 inventory가 같은 키를 쓰며 경로를 renderer에 보내지 않는다. main harness module에 선택적 구성 조회 포트를 두고 bootstrap이 DB session의 backend/cwd를 해석해 주입한다. handler는 조회 및 toggle 후 새 runtime 상태에 read-only inventory를 합치며 쓰기 검증은 live 목록만 사용한다. renderer는 disconnected여도 items를 표시하고 실제 빈 경우에만 연결 없음 안내를 쓴다.

LandingHeader는 chat feature 내부 registry를 재사용하는 얇은 공개 컴포넌트다. 새 대화와 프로젝트가 함께 소비하며 Composer를 key로 재생성하지 않는다.

근거: [MCP scope](https://code.claude.com/docs/en/mcp), [plugin manifest](https://code.claude.com/docs/en/plugins-reference), 설치된 SDK 0.3.296 타입·runtime, 로컬 native 파일의 키/상태만 관측. 실제 로컬 설치에는 활성 2개·비활성 1개 플러그인이 있었고 검사한 해당 프로젝트·사용자 MCP 정의는 비어 있었다. 전체 비밀 설정은 출력하지 않았다.

### V nodes / pairs / §10

| 노드 | delta | 계약 |
|---|---|---|
| R-12~14 / AT-12~14 | NEW | AC12~14 |
| SD-02 / ST-02 | CHANGED | offline 구성 조회→live 합성→toggle 재조회, 기존 stale 차단 유지 |
| AR-03 / IT-03 | NEW | native file→harness module→DB scope/handler→DTO→메뉴 |
| MD-04 / UT-04 | NEW | 범위·상태·메타데이터 projection·live 중복 제거 |

| Pair | requiredness | start → edges → end / oracle | 지점 |
|---|---|---|---|
| VP-12 | R-12↔AT-12 / REQUIRED | titlebar→native group→두 submenu; ChatTitleBar.native-resources.test.ts: no group connection summary | EP10 |
| VP-13 | R-13↔AT-13, SD-02↔ST-02, AR-03↔IT-03 / REQUIRED | native config→module→bootstrap scope→IPC merge→menu; 아래 자리별 테스트 | EP11 |
| VP-14 | MD-04↔UT-04 / REQUIRED | 임시 native 파일→projection/merge; configured-resources.test.ts 및 session-resources.test.ts | EP11 |
| VP-15 | R-14↔AT-14 / REQUIRED | ProjectLandingPage backend→LandingHeader registry→브랜드; agentModeLanding.render.test.ts | EP12 |
| VP-01~11 | REGRESSION | 기존 직접 oracle·M1/M2 유지; D-07·09와 AC7·10의 runtime-only 부분은 AC13/VP13~14로 대체 | EP1~9 |

| 지점 | 고정 자리 / 검색 | 직접 oracle / 실패 의미 |
|---|---|---|
| EP10 (1자리) | NativeResourcesMenu 그룹 제목/요약; `rg -n 'MenuTitle|nativeResources.connected' app/src/renderer/src/features/chat` | ChatTitleBar.native-resources: no group connection summary; 중복 연결 표시 |
| EP11 (6자리) | ①native reader 범위·상태 projection ②live plugin identity ③harness module reader 선택 ④bootstrap DB backend/cwd 주입 ⑤handler read/toggle 후 합성과 live-only 쓰기 ⑥menu disconnected items 수용. `rg -n 'configuredResources|nativePluginId|registerSessionResourceHandlers|nativeResourcesMenu' app/src` | ① configured-resources: scopes/status/errors/secret projection ②native-resources + reader 같은 경로 ID ③④ bootstrap.native-history: stored scope callback 실제 module reader ⑤session-resources: offline/merge/toggle/replaced ⑥nativeResourcesMenu + useNativeResources: offline locked rows. 잘못된 범위·가짜 연결·중복·전역 제어·목록 누락 |
| EP12 (2자리) | 프로젝트 backend 구독/헤더 전달, LandingHeader registry 선택. `rg -n 'LandingHeader|harnessLanding|AgentModeToggle' app/src/renderer/src/pages app/src/renderer/src/features/chat/components` | agentModeLanding.render: switch project header Claude→OpenCode→Claude, Composer/프로젝트/목록 관측; 잘못된 브랜드·초안 UI 누락 |

추가 자리 합 9, 기존 33을 포함한 분모 42. 새 적대 증거는 선택하지 않는다(파일/실제 조립/최종 렌더 직접 oracle). 기존 M1/M2 회귀 수행. gate: lint·3종 typecheck·관련 main/renderer/preload tests·build, IPC 문서·카탈로그·inventory/문서 검사. 로컬 실제 reader smoke는 names/status만 출력하고 인증된 외부 MCP 실행 여부는 별도 한계로 보고한다. 신규 의존성·DB migration 없음. D-11~13↔AC12~14 일치, READY.

## [구현자 기입] 설계 리뷰

- 유효 계약은 V1+ΔV1+ΔV2이다. 사용자 답변 세 가지를 그대로 적용했다.
- 명시 선택을 모델 폴백이 덮는 PLAN_GAP을 ΔV2 설계 커밋 `9bdd2245`로 정정했다. 미해결 제품 계약 이견·PLAN_GAP 없음. 독립 verify는 수행하지 않았다.
- OpenCode 설정의 plugin 목록은 활성 구성으로 표시하며 실제 연결 성공을 주장하지 않는다. Claude는 init의 로드 목록이다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

아래 테스트 경로는 `app/src/` 기준이다. [실행 집합·관측](evidence/validation.md)을 참조한다.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 / 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01~03 | 새 대화 진입 | EP1: 펼침·접힘 버튼, 메뉴 조립 | 3/3 | renderer/src/app/Sidebar.interaction.test.ts: opens the branded menu… (false/true) | 두 nav에서 실제 클릭, store 참조 불변, 두 로고/라벨 | 없음 |
| VP-01·03·04 | 경계 정렬 | EP2: 경계 전달·측정 호출·style | 3/3 | Sidebar.interaction: opens… 최종 style; shared/ui/popoverPosition.test.ts: attaches/clamps/retains | trigger right와 다른 nav right 256/64, top 60; overflow 168/40 | 없음 |
| VP-01~03 | 선택값/초안/라우트 | EP3: backend·newChat/setModel·navigate | 3/3 | Sidebar.interaction: selects %s… 두 backend | 실제 store에 backend, sessionId null; 이전 entry 동일; /new 재진입 | 없음 |
| VP-05 | 히어로 | EP4: h1 로고·문구 | 1/1 | features/chat/components/AgentModeToggle.test.ts: places the %s hero… | work/code 서로 다른 문구, SVG가 첫 자식, justify-center | 없음 |
| VP-06·08·09 | native 원천 | EP5: Claude 주입/init, OpenCode client/cwd·DTO | 4/4 | main/adapters/claude/adapter.live-control.test.ts: wires native…; opencode/v1/adapter.persistent.test.ts: exposes native…; 두 native-resources.test.ts | 주입 plugin/runtime 서버 제외, gen 전달; C:/native-B GET; 비밀·경로 없는 DTO | 없음 |
| VP-06~08 | 세대/지원 검사 | EP6: runtime 읽기·쓰기, bootstrap lookup, handler | 4/4 | session-runtime.test.ts: native resource generation; bootstrap.native-history.test.ts: wires native resource…; handlers/session-resources.test.ts | gen-B/old, teardown 후 거부, session-B lookup, read-only 거부 | 없음 |
| VP-06~08 | IPC 운반 | EP7: 채널/schema·preload·sessionApi·hook | 4/4 | handlers/session-resources.test.ts: validates input…; preload/index.test.ts: preserves native…; useNativeResources.test.ts: carries session… | session-B/gen-B/native-B/mcp와 false/true를 서로 다르게 운반 | 없음 |
| VP-06~09 | UI 수명/목록 | EP8: titlebar scope/open·hook 폐기·종류 매핑·checked/disabled | 4/4 | ChatTitleBar.native-resources.test.ts: loads… / replaces…; useNativeResources.test.ts; nativeResourcesMenu.test.ts | 닫힘 read 0, 열림 A→B, 늦은 A 폐기; MCP off mutable / plugin on locked | 없음 |
| VP-10·11 | 명시 하네스 수명 | EP9: nav·store dispatch·reducer·초기화·seed·모델 표시·effect | 7/7 | Sidebar.interaction: selects %s…; chatStore.harness: preserves an explicit…; Composer.selection: keeps the explicitly… / still falls back… | explicit true→자동 model 보존→late seed 보호→newChat false; Claude만 있는 catalog에서 OpenCode 유지, 늦은 OpenCode 채움 | 없음 |

분모는 §10의 자리 합 33, 닫은 자리 33이다. 선언·타입·재수출을 뺀 검색 결과를 위 운반 자리와 대조했다. nav 버튼 두 곳, 메뉴 조립 한 곳, 신규 native 조회/쓰기 경로는 위 표에 귀속되며 별도 우회 호출은 발견하지 않았다. 직전 verify의 못 잡음 행은 최초 구현이라 없다.

| Pair | requiredness | 자기 상태 | 직접 oracle | 선택된 적대 증거 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | Sidebar.interaction + 브라우저 관측 | M1 red |
| VP-02 | REQUIRED | SELF_PASS | Sidebar.interaction의 실제 store/route | M1 red |
| VP-03 | REQUIRED | SELF_PASS | Sidebar→Menu→Popover 실행 | not selected — 직접 oracle |
| VP-04 | REQUIRED | SELF_PASS | popoverPosition + Sidebar style | not selected — 직접 oracle |
| VP-05 | REQUIRED | SELF_PASS | AgentModeToggle 두 모드 + 브라우저 | not selected — 직접 oracle |
| VP-06 | REQUIRED | SELF_PASS | native 경계·runtime·IPC·UI 테스트 | M2 red |
| VP-07 | REQUIRED | SELF_PASS | runtime/hook/titlebar의 세대 교체 | not selected — 직접 oracle |
| VP-08 | REQUIRED | SELF_PASS | adapter·bootstrap·handler·preload·UI 운반 | not selected — 직접 oracle |
| VP-09 | REQUIRED | SELF_PASS | native DTO·menu 렌더 | M2 red |
| VP-10 | REQUIRED | SELF_PASS | Sidebar 선택 + Composer 실제 표시/복원 | not selected — 직접 oracle |
| VP-11 | REQUIRED | SELF_PASS | store/reducer/seed/reset + Composer 효과 | not selected — 직접 oracle |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 선택 backend 반전 | M1 / VP-02 | 최초 | Sidebar.interaction의 두 backend 선택 / 2 | 잠김, 복원 후 통과 |
| MCP/plugin 하위 목록 맞바꿈 | M2 / VP-06·09 | 최초 | nativeResourcesMenu의 종류·상태 매핑 / 2 | 잠김, 복원 후 통과 |

분모 검산: 선택 증거 2 · 인용 변이 0 · 새 구조/배선 proxy oracle 0 = 표 행 2. 나머지는 직접 행동 oracle이다. 기존 Cascade/Popover 회귀 테스트도 통과했다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 / 관측 | 후속 |
|---|---|---|
| 새 문자열 소비자 | ko/en nativeResources 키를 그룹·하위 행이 소비 | 로딩/미연결/빈 목록/오류 구분 테스트 |
| 실패 상태가 무반응인가 | toggle 실패 시 오류+다시 열기 안내, 성공 선반영 없음 | hook failure/reopen 테스트 |
| 지각 응답 | epoch·메뉴 key·runtime 세대로 이전 결과 폐기 | A→B read/write 및 teardown 테스트 |
| 취소/재진입 | 선택 전 store 불변, Escape 초점 복귀, /new에서도 새 초안 | Sidebar 테스트·브라우저 |
| 미지원 제어 | 실제 활성 상태를 보존하고 disabled, 이유 title 제공 | plugin on/locked 렌더 + 서버 쓰기 거부 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 관측 |
|---|---|---|---|
| 1 | Orca 주입 리소스가 native 목록에 섞일 수 있음 | source=sdk·pluginRoots·runtime Map keys 제외 | adapter 테스트에 비기본 주입 root/server, DTO에서 제외 |
| 2 | 세션 교체 뒤 조회/변경 결과가 성공으로 반환될 수 있음 | raw live/세대와 supervisor runtime 정체성 재확인 | teardown/lookup 교체 테스트 |
| 3 | toggle 후 메뉴가 닫히면 결과 확인이 어려움 | CascadeBody closeOnSelect=false, 중복 입력 잠금 | 실제 NativeResourcesMenu 클릭 후 checked 갱신·onClose 0 |
| 4 | 테스트 DOM이 자식 상태 변경에도 부모를 다시 실행 | native 메뉴 items를 useMemo로 안정화 | 실제 UI 경로 테스트 통과; 브라우저에서도 메뉴 유지 |
| 5 | 문서 검사가 ignored 외부 clone까지 검사 | 기존 .tmp를 보존하고 실패를 환경 항목으로 분리 | 저장소 문서 링크만 같은 함수로 재검사 broken=[] |

명시 선택의 폴백 충돌을 ΔV2로 닫았다. 설계 대비 제품 계약 차이 없음. open은 Popover가 자식을 mount/unmount하는 기존 수명으로 전달한다. 별도 캐시를 추가하지 않았다.

| 축 | 대체물에만 있는 실패 모드 | 재확인 |
|---|---|---|
| 만료 | 해당 없음 — 캐시 없음 | 열 때마다 조회 |
| 공유 | OpenCode는 cwd 단위 상태 공유 | 쓰기 포트 미노출, UI/handler read-only |
| 재진입 | unmount 뒤 지각 결과 | hook epoch·titlebar key 테스트 |
| 다른 무효화 | raw live 교체 | runtime generation 테스트 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | nav 메뉴·로고·Claude 히어로, native DTO/adapter/runtime/IPC/preload/hook/menu, i18n, 테스트/시각 fixture, IPC/카탈로그/inventory 문서 |
| 실행 명령 / 관측 | [validation](evidence/validation.md). 135파일 1,515 Vitest, 경계 8케이스 통과. lint 0 error·기존 warning 2, typecheck/build 성공. 문서 링크의 기존 .tmp 외부 clone 오류는 별도 기록. |
| V-pair | SELF_PASS 11 / SELF_BLOCKED 0 |
| 강제 지점 | EP1 3/3, EP2 3/3, EP3 3/3, EP4 1/1, EP5 4/4, EP6 4/4, EP7 4/4, EP8 4/4, EP9 7/7 |
| 실제 검증 한계 | 브라우저는 실제 컴포넌트+메모리 IPC. 인증된 CLI/MCP와의 실사용 smoke는 미수행. |
| 블로커 / 역질문 | 없음. 다음 단계는 독립 verify. |
| 대상 커밋 | (r1 구현 — 좌표는 INDEX) |

| AC | 자기보고 / 관측 |
|---|---|
| AC1 | ✅ 펼침/접힘 branded menu 테스트 |
| AC2 | ✅ 실제 브라우저 nav.right=popup.left, trigger.top=popup.top; overflow 단위 테스트 |
| AC3 | ✅ 두 backend·두 route에서 실제 초안/기존 세션 보존 |
| AC4 | ✅ key/outside 취소, 초점 복귀, 실제 Down→Enter 선택 |
| AC5 | ✅ 두 모드 로고/문구 순서·중앙 배치 |
| AC6 | ✅ titlebar 두 그룹·두 하위 목록·우측 checked 제어 |
| AC7 | ✅ native DTO와 주입 제외/비밀 필드 부재 |
| AC8 | ✅ Query true/false 운반·오류 전파·동일 live 세대 |
| AC9 | ✅ read-only UI와 handler 거부 |
| AC10 | ✅ 상태 구분·열림 수명·A→B 지각 결과 폐기 |
| AC11 | ✅ 명시 선택 유지·늦은 모델·지각 seed·새 초안 초기화·기억값 폴백 |

합계 검산: ✅ 11 · ⚠️ 0 · ❌ 0 = 총 11. 이는 위 테스트/fixture 범위의 자기보고이며 독립 검증 또는 실 CLI smoke를 선점하지 않는다.

## [구현자 기입] Review Signals

- r1 최초 구현, 이전 라운드 반복 지적 없음.
- 원격 main으로 전환·rebase 후 시작했으며 사용자 응답 확정 설계와 구현을 분리했다.
- native 기능의 지원 차이를 미리 확정해 전역 설정 변경으로 세션 토글을 흉내내지 않았다.
- 환경 차이: Python 기본 cp949는 UTF-8 flag로 해결. ignored 외부 clone 링크 오류는 제품 변경과 분리. Electron ABI는 그대로 유지했다.

## [구현자 기입] r1.2 설계 리뷰

사용자 확인에 따라 ΔV3의 native 구성 관측과 표시 변경을 구현했다. D-08의 쓰기 제한은 유지하며 user settingSources를 넓히지 않았다. 미해결 PLAN_GAP 없음. r1의 runtime-only 보고는 ΔV3 범위에서 대체된다.

## [구현자 기입] r1.2 강제 지점 전수와 V-pair 자기확인

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 / 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01~04 | 진입·정렬·선택 | EP1~3 각 3 | 9/9 | Sidebar.interaction·popoverPosition·Popover 회귀 | 두 backend·두 nav·두 route와 store 보존 | 없음 |
| VP-05 | Claude 히어로 | EP4 1 | 1/1 | AgentModeToggle.test 두 모드 | SVG 좌측·각 문구·중앙 | 없음 |
| VP-06~09 | 원천·세대·IPC·메뉴 | EP5~8 각 4 | 16/16 | r1 표의 adapter/runtime/bootstrap/handler/preload/hook/titlebar/menu 실제 oracle 재실행 | 기존 주입 제외·세대 차단·read-only 유지. 구성 수용은 EP11 증거로 대체 | 없음 |
| VP-10~11 | 명시 선택 | EP9 7 | 7/7 | store/reducer/Composer/Sidebar 회귀 | 명시 OpenCode + Claude-only 모델, 늦은 모델·seed·초안 초기화 | 없음 |
| VP-12 | 그룹 제목 | EP10 1 | 1/1 | ChatTitleBar.native-resources: loads native resources… / replaces the native menu… | Claude/OpenCode 그룹에서 connected 요약 부재, 두 submenu 존재 | 없음 |
| VP-13~14 | 구성 범위·합성 | EP11 6 | 6/6 | ① configured-resources: reads scoped… / applies plugin scope… / reads bundled… / distinguishes absent… ② 동일 파일 init ID + native-resources/adapter.live-control ③④ bootstrap.native-history: reads native configuration… ⑤session-resources: shows offline… / rejects failed discovery… ⑥nativeResourcesMenu: renders configured… | project-B vs wrong-default/OpenCode, 동일 plugin hash, offline on/locked와 live 우선·중복 제거, 오류 redaction, 구성-only 쓰기 거부 | 없음 |
| VP-15 | 프로젝트 브랜드 | EP12 2 | 2/2 | agentModeLanding.render: switches the project header…; 실제 브라우저 모델 선택 | Claude→OpenCode→Claude, 실제 초안 보존·프로젝트/목록 유지 | 없음 |

분모 검산: 9+1+16+7+1+6+2=42, 닫은 자리 42. ΔV3 자리 검색 결과의 생산 호출을 EP10~12에 대조했다. 선언/재수출을 제외한 차집합은 []이다. Landing의 기존 registry 사용은 EP12 헤더 선택의 새 대화 회귀로 분류했으며 native configured 포트 추가와 ID helper 호출도 EP11에 포함했다. 기존 EP1~9는 r1 표의 동일 자리와 oracle을 재실행했다.

| Pair | requiredness | 자기 상태 | 직접 oracle | 선택된 적대 증거 |
|---|---|---|---|---|
| VP-01~04 | REGRESSION | SELF_PASS | Sidebar·position·Popover | M1 재실행 red |
| VP-05 | REGRESSION | SELF_PASS | AgentModeToggle | 해당 없음 — 직접 oracle |
| VP-06~09 | REGRESSION | SELF_PASS | adapter/runtime/IPC/preload/hook/menu | M2 재실행 red |
| VP-10~11 | REGRESSION | SELF_PASS | 선택 source/store/reducer/Composer | 해당 없음 — 직접 oracle |
| VP-12 | REQUIRED | SELF_PASS | 실제 titlebar 양 하네스 그룹 | 해당 없음 — 직접 oracle |
| VP-13~14 | REQUIRED | SELF_PASS | 파일 fixture→module/DB scope→IPC 합성→메뉴 | 해당 없음 — 직접 oracle |
| VP-15 | REQUIRED | SELF_PASS | 실제 page/Header + 브라우저 모델 전환 | 해당 없음 — 직접 oracle |

## [구현자 기입] r1.2 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 선택 backend 반전 | M1 / VP-02 | r1 red | Sidebar.interaction / 2 | red, 복원 후 통과 |
| MCP/plugin 하위 목록 맞바꿈 | M2 / VP-06·09 | r1 red | nativeResourcesMenu / 3 | red, 복원 후 통과 |

선택 증거 2 · 인용 변이 0 · 새 구조/배선 proxy oracle 0 = 잠금 2행. 원본 복원 후 2파일 7케이스 통과. 추가 검증은 입력부터 실제 결과를 보는 직접 oracle이다.

## [구현자 기입] r1.2 Product/UX 파생 검토

| 질문 | 판정 / 관측 | 후속 |
|---|---|---|
| 설정 활성은 실제 로드인가 | 별개 상태. configured와 installed를 i18n 메뉴 설명에서 소비 | live가 같은 ID를 보고할 때 실제 상태 우선 |
| offline 항목이 숨겨지는가 | disconnected + items 테스트에서 두 종류 표시 | 빈 목록일 때만 기존 안내 |
| 실제 입력이 사라지는가 | 브라우저 모델 전환 후 입력 문자열 유지 | Composer 무재생성 |
| 오류·재진입 | malformed 설정은 비밀 없는 오류, 새 메뉴 열기마다 재조회 | 기존 hook 지각 응답 폐기 유지 |

## [구현자 기입] r1.2 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 관측 |
|---|---|---|---|
| 1 | 같은 플러그인이 설치 목록과 init에 중복 | 경로 hash SSOT로 합성 | 실제 reader와 init의 ID 동일 테스트 |
| 2 | 다른 프로젝트 plugin이 섞임 | project/local scope의 projectPath 제한 | unrelated fixture 제외 |
| 3 | 메타데이터를 실행 권한으로 오해 | 구성은 canToggle=false, 쓰기 검사는 live 목록만 | 구성-only MCP write reject |
| 4 | 조회 중 세션 삭제/변경 | bootstrap 저장 scope와 runtime identity 재확인 | IPC runtime 교체 테스트·DB backend/cwd 전달 테스트 |
| 5 | JSON 오류가 비밀/경로 노출 | 고정 오류 문장 | malformed 비밀 문자열 fixture 테스트 |

원본 설정·설치 path는 main에만 남고 DTO로 반환하지 않는다. 캐시·설정 쓰기·추가 의존성·DB 변경 없음. 관리 정책의 완전한 native 유효 구성 해석은 이번 reader의 계약(사용자·프로젝트·로컬 구성)을 넘어서는 범위이며 실제 live 관측은 계속 최종 권위다.

## [구현자 기입] r1.2 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | Claude 구성 reader/ID, harness module/bootstrap/IPC 합성, 메뉴 상태, LandingHeader/ProjectLandingPage, 테스트/fixture 및 IPC/카탈로그/보고 |
| 실행 명령 / 관측 | [validation r1.2](evidence/validation.md). 138파일 1,535케이스를 환경 실패 재실행 포함 확인, typecheck 3종·production build·경계 8케이스 통과. lint 오류 0·기존 경고 4. 마지막 lint 수정 후 관련 3파일 10케이스 재통과. |
| V-pair | SELF_PASS 15 / SELF_BLOCKED 0 |
| 강제 지점 | EP1~9 33/33 + EP10 1/1 + EP11 6/6 + EP12 2/2 = 42/42 |
| 실제 검증 한계 | 실제 로컬 설정 읽기까지 수행. 인증된 CLI/MCP 실행 smoke·독립 verify는 미수행. 브라우저 IPC는 fixture. |
| 블로커 / 역질문 | 없음. 독립 verify 대기. |
| 대상 커밋 | (r1.2 구현 — 검증자 기입, INDEX 정본) |

| AC | 자기보고 / 관측 |
|---|---|
| AC1 | ✅ Sidebar 펼침/접힘 메뉴 |
| AC2 | ✅ Sidebar position·Popover 회귀 |
| AC3 | ✅ 두 backend 선택과 실제 store 보존 |
| AC4 | ✅ Sidebar key/outside/Escape 회귀 |
| AC5 | ✅ AgentModeToggle work/code 로고 순서 |
| AC6 | ✅ titlebar 그룹·두 하위 목록 |
| AC7 | ✅ native DTO/주입 제외 + 구성 reader의 비밀 projection |
| AC8 | ✅ live Query true/false·세대 차단 |
| AC9 | ✅ read-only UI와 직접 IPC 쓰기 거부 |
| AC10 | ✅ hook 지각 응답 폐기·오류 및 offline 구성 표시 |
| AC11 | ✅ 명시 선택·늦은 모델·seed·초안 초기화 회귀 |
| AC12 | ✅ 두 하네스 그룹 연결 요약 제거 테스트·브라우저 |
| AC13 | ✅ scoped 파일/상태/합성 테스트 및 실제 로컬 3개 플러그인 읽기 |
| AC14 | ✅ 실제 프로젝트 헤더 전환 테스트·브라우저 초안 보존 |

검산: ✅14 · ⚠️0 · ❌0 = 현재 AC14건. 이전 분모 11에서 ΔV3 AC12~14를 추가했다. 독립 verify의 PASS가 아니다.

## [구현자 기입] r1.2 Review Signals

- 같은 라운드 두 번째 impl 턴. 사용자 요구 변경과 실제 앱의 runtime-only 목록 누락을 ΔV3로 명시했다.
- 기존 AC7은 실행 중 원천만 보게 했으므로 installed/configured 누락을 잡지 못했다. 새 reader와 offline 합성 oracle로 관측 범위를 보완했다.
- 샌드박스의 plan-file 조상 접근 실패는 일반 권한 동일 테스트로 재확인했다. ignored 외부 clone 링크 오류는 기존 한계로 보존했다.
- 컴퓨터 UI의 좁은 기본 pane과 브라우저 재연결 지연은 fixture/뷰포트 검사로 분리했다. 제품 설정·인증은 변경하지 않았다.

## ΔV4 — 재진입 조회와 Composer 네이티브 명령 (r1.3)

기준은 공유 브랜치 `79e6ae6b`의 ΔV3다. 사용자 추가 요구: "세션을 나갔다가 들어왔을때" 목록이 로딩되지 않음, "composer의 + 버튼 -> 플러그인 팝업 메뉴"에서 MCP·네이티브 플러그인 사용을 안내할 것.

### 결정 / 제품 계약

| ID | 상태 | 결정 |
|---|---|---|
| D-14 | ACTIVE | 재진입/메뉴 재열기는 해당 세션을 새로 조회한다. 한 원천의 실패·무응답이 다른 원천의 목록을 지우지 않는다. 부분 조회 안내와 재시도를 제공하며 오래된 응답은 수용하지 않는다. |
| D-15 | SUPERSEDED | 배치는 ΔV6 D-19로 대체한다. 명령 선택의 초안 보존·자동 전송 금지와 기존 Orca 커넥터 정책은 유지한다. |
| D-16 | ACTIVE | 명령 이름을 설치명으로 추측하지 않는다. Claude supportedCommands/init, OpenCode command.list가 보고한 명령만 슬래시 명령으로 제시한다. 프롬프트 없는 MCP는 실행 중일 때 도구 사용 요청 문구로 안내한다. 로드되지 않은 확장은 상태와 명령 없음 안내를 표시한다. |
| D-17 | SUPERSEDED | 자동 로딩 여부 질문은 사용자의 재개·갱신 요구를 반영한 ΔV5 D-18로 대체한다. 사용자 설정 자동 로딩을 허가한 것으로 해석하지 않는다. |

| AC | 행동 기준 | 직접 검증 / production 경로 |
|---|---|---|
| AC15 | A→B→A 재진입 및 재열기에서 새 목록을 읽는다. live 무응답/실패에도 구성 목록을 표시하고 부분 조회와 다시 시도를 안내한다. 늦은 A 응답이 B를 덮지 않는다. | session-resources.test: unresolved/rejected live + configured result; useNativeResources.test: A/B/A·close/reopen·retry |
| AC16 | Composer +의 플러그인 메뉴에서 현재 하네스 네이티브 MCP·플러그인과 실제 slash 이름/설명을 보고 선택하면 명령을 입력 앞에 넣고 기존 초안을 보존한다. 전송하지 않는다. | native-resources 양 adapter tests; Composer 실제 render/AttachMenu + composerAttachMenu tests |
| AC17 | Claude는 실제 slash prompt 경로를 그대로 사용한다. OpenCode의 알려진 slash는 session.command로 보내며 이벤트·승인 처리를 막지 않는다. 알 수 없는 slash는 기존 일반 prompt 경로, 첨부·모델·agent·variant·시스템/복구 문맥은 보존한다. | OpenCode persistent channel tests: recognized/unrecognized commands, pending command while approval/event consumed, rejected command |

### 조사 / 기술 설계

`session-resources`의 Promise.all은 live 조회가 정착하지 않으면 구성 목록도 반환하지 않는다. hook은 메뉴 재마운트 시 재조회하지만 timeout/수동 재시도가 없다. `AttachMenu`는 Orca provider tools 후보만 받고 OpenCode includeExtensions=false면 플러그인 진입 자체가 사라진다.

공유 DTO에는 선택적 commands(name/description/argumentHint/source), partial을 추가한다. native resource projection은 경로·설정·인증값을 계속 제외한다. main 읽기는 live/구성을 독립적으로 3초 안에 정착시키고, 부분 성공이면 성공한 목록+partial, 양쪽 실패면 안전한 오류를 반환한다. runtime 교체 검사는 유지하고 쓰기 사전검사도 대기를 제한한다. renderer hook은 세션·backend 범위와 reload revision으로 응답을 fence하고 부분 실패/오류의 재시도를 제공한다.

Claude supportedCommands는 별도 기한 안에 조회하고 init의 명령 이름을 초기 관측으로 사용한다. Orca 주입 prefix와 builtin을 제외한다. OpenCode command.list의 name/description/hints/source만 투영한다. 메뉴는 실제 명령과 리소스를 함께 표시하며 빈/미실행/부분/오류 상태를 안내한다. native slash 삽입은 줄 맨 앞(기존 본문 보존), MCP 도구 요청은 기존 커서 삽입 규칙이다. OpenCode command HTTP 완료를 event pump가 기다리지 않으며 지각 오류는 해당 channel만 종료한다.

근거: 설치된 SDK Query.supportedCommands/SlashCommand, OpenCode Command/Session.command 타입; [Claude 명령](https://code.claude.com/docs/en/agent-sdk/slash-commands), [OpenCode SDK](https://opencode.ai/docs/sdk/). 새 의존성·DB 저장 없음. 조회를 위한 agent 실행·설정 쓰기는 하지 않는다.

### V / §10

| Pair | 노드 / requiredness | 경로·직접 oracle | 지점 |
|---|---|---|---|
| VP-16 | R-15↔AT-15, SD-02↔ST-02 CHANGED / REQUIRED | 두 원천→handler deadline/merge→hook 재진입→메뉴 재시도; session-resources.test, useNativeResources.test | EP13 |
| VP-17 | R-16↔AT-16, AR-04↔IT-04, MD-05↔UT-05 NEW / REQUIRED | SDK→DTO→기존 IPC→hook→AttachMenu→draft; adapter native-resources, 실제 Composer render, attachMenuModel/composerAttachMenu tests | EP14 |
| VP-18 | R-17↔AT-17, SD-03↔ST-03 NEW / REQUIRED | draft slash→channel submit→SDK command/event loop; adapter.persistent.test | EP15 |
| VP-01~15 | INHERITED / REGRESSION | 기존 좌표 중 변경 subtree 회귀. M1/M2 재실행. | EP1~12 |

| 지점 | 고정 자리 / 검색 | 직접 oracle / 실패 의미 |
|---|---|---|
| EP13 (3자리) | ①handler 두 원천 정착/세대 ②hook session/open/retry fence ③메뉴 재시도. `rg -n 'nativeResources|useNativeResources' app/src/main/app app/src/renderer/src/features/chat` | ①session-resources unresolved source/partial ②useNativeResources A→B→A/late/retry ③NativeResourcesMenu retry click. 무한 로딩·타 세션 오염·복구 불가 |
| EP14 (6자리) | ①Claude 명령 관측/projection ②OpenCode command.list projection ③adapter→NativeResources 운반 ④Composer session/backend→hook ⑤AttachMenu native 트리 운반 ⑥native action→draft. `rg -n 'supportedCommands|slash_commands|command.list|nativeResources|buildAttachMenu|runAttachMenuAction' app/src/main/adapters app/src/renderer/src/features/chat` | ①②native-resources tests 실제 DTO ③adapter.live-control/persistent 목록 ④⑤Composer 실제 UI에 session-B 고유 명령 ⑥composerAttachMenu 앞 삽입/IME/초안. 다른 하네스·가짜 명령·전송 발생 |
| EP15 (1자리) | OpenCode channel submit command dispatch. `rg -n 'session.promptAsync|session.command' app/src/main/adapters/opencode` | persistent channel SDK args·event/approval while pending·error. slash가 일반 메시지로 전송되거나 승인 교착 |

추가 10자리 + 기존42 = 52. 신규 적대 증거는 선택하지 않음(행동 직접 oracle), 상속 M1/M2 유지. gate: 수정 subtree lint/cache, typecheck 3종, 관련 비DB 테스트, build, boundary·문서 inventory·카탈로그. D-14~16↔AC15~17 충돌 없음. D-17은 ΔV5에서 해소했다.

## ΔV5 — 세션 관측 유지와 제어 실패 후 갱신 (r1.3)

사용자 답변: “세션 재개시 로드된 정보를 계속해서 노출해야 한다. 재개할때마다 갱신이 되는 형태로 지속. 컨트롤 시도 시 실패할 때 재로드”. 기준은 ΔV4 설계 `d5214d7a`이며 AC15와 VP-16을 아래 계약으로 강화한다. AC16~17 및 VP-17~18은 REQUIRED 유지, VP-01~15는 REGRESSION 유지한다.

| 결정 | 상태 | 제품 계약 |
|---|---|---|
| D-18 | ACTIVE | 같은 앱 창에서 세션별 마지막 관측 목록·명령을 유지한다. 재진입 및 메뉴 재열기마다 새 조회를 시작하고 갱신 중에도 기존 목록을 표시한다. 제어가 실패하면 성공으로 표시하지 않고 자동 재조회한다. 재조회 실패에도 기존 목록과 오류 안내를 유지한다. 자동 플러그인 로딩 정책은 변경하지 않는다. |

AC15 강화: A→B→A와 컴포넌트 재마운트에서도 A 관측 목록을 즉시 표시하면서 갱신한다. 갱신 중/실패 후의 이전 정보로 제어하지 않는다. live 부재·부분 실패에는 마지막 관측 중 누락분을 읽기 전용으로 유지하고 이전 목록 안내를 표시하며, 완전한 live 재조회 성공은 삭제된 항목·명령까지 새 결과로 교체한다. 제어 실패 후 read를 자동 호출하고 결과와 오류 안내를 함께 표시한다. 세션/하네스 경계를 넘어 결과를 쓰지 않는다.

기술: renderer 창 수명의 세션 ID+backend 메모리 관측 캐시를 사용한다. DB·설정 저장은 추가하지 않는다. hook은 refresh/error 동안 snapshot을 보존하고 refresh 중 제어를 잠근다. live 부재/partial 합성 시 현재 결과가 우선하고 과거 항목은 canToggle=false, connected→configured로 내려 현재 연결처럼 표시하지 않는다. 이전 명령은 이름 관측을 유지하되 마지막 관측임을 알린다. 전체 live 성공은 캐시를 교체한다. Composer가 활성 세션 진입 시 조회하며 + 메뉴 재열기는 추가 갱신한다. 캐시가 조회를 생략하지 않으므로 재개별 재검증 부수 효과를 유지한다. IPC의 runtime/generation 검사는 계속 최종 쓰기 권한이다.

| Pair / node | 경로·자리 | 직접 oracle |
|---|---|---|
| VP-16 / R-15·SD-02 CHANGED REQUIRED | EP13 기존 3자리 중 hook의 관측 유지·실패 재조회 강화. 추가 EP16 ①Composer active/session→조회 ②hook 창/세션/backend snapshot 읽기·갱신 ③NativeResourcesMenu 갱신/오류 표시 ④AttachMenu 갱신/이전 정보 표시 | useNativeResources.test의 remount/pending refresh/failure/scope/complete replacement; Composer.native-menu.test의 closed-menu 세션 진입·재열기; 실제 두 메뉴의 feedback 렌더 |

§10 EP16의 검색 범위: `rg -n 'useNativeResources|nativeAttachItems|nativeResourcesMenu|native\.refresh' app/src/renderer/src/features/chat`. 기존 EP13/14의 운반 자리는 유지하고 새 관측 저장·진입·feedback 의무 4자리를 더해 분모 56. 직접 행동 oracle을 사용하여 신규 변이는 선택하지 않는다. 기존 M1/M2와 운영 gate는 승계한다. D-18↔강화 AC15 및 AC16/17 충돌 0, D-17 자동 로딩 미결에 기대는 구현 없음. 앱 재시작 후 메모리 캐시 유지·실행 중이지 않은 하네스를 목록 조회만을 위해 실행하는 동작은 범위 밖이다.

## [구현자 기입] r1.3 설계 리뷰

ΔV4 `d5214d7a`와 사용자 답변을 반영한 ΔV5 `158a4e43`를 구현과 별도 커밋으로 확정했다. 목록을 보는 동작과 확장을 새로 로딩하는 동작을 구분했다. D-17은 D-18로 해소했고 설정 쓰기나 사용자 settingSources 확대는 없다. 활성 세션 진입과 메뉴 재열기 모두 갱신하며 관측 캐시는 재조회를 생략하지 않는다. 미해결 PLAN_GAP 없음.

## [구현자 기입] r1.3 강제 지점 전수와 V-pair 자기확인

| Pair | requiredness / 자기 상태 | §10 지점 / 닫은 수 | 자리별 직접 oracle 및 구별 값 |
|---|---|---|---|
| VP-01~04 | REGRESSION / SELF_PASS | EP1~3 / 9/9 | Sidebar.interaction의 실제 양 nav·양 backend 선택·key/outside, popoverPosition 좌표. M1 red·복원 green |
| VP-05 | REGRESSION / SELF_PASS | EP4 / 1/1 | AgentModeToggle의 두 모드 브랜드·문구 순서 |
| VP-06~09 | REGRESSION / SELF_PASS | EP5~8 / 16/16 | r1.2 표의 adapter.live-control·OpenCode persistent·session-runtime·bootstrap.native-history·session-resources·preload·useNativeResources·ChatTitleBar.native-resources·nativeResourcesMenu 좌표 재실행. 주입 제외/세대 운반/쓰기 제한. M2 red |
| VP-10~11 | REGRESSION / SELF_PASS | EP9 / 7/7 | chatStore.harness·Composer.selection·components/composer/modelSelection·NewChatLandingPage.harness의 명시 OpenCode, 늦은 모델, seed/초안 보존 |
| VP-12 | REGRESSION / SELF_PASS | EP10 / 1/1 | ChatTitleBar.native-resources의 양 backend 그룹 제목과 연결 요약 부재 |
| VP-13~14 | REGRESSION / SELF_PASS | EP11 / 6/6 | configured-resources 파일 scope/비밀 projection, native-resources ID, bootstrap.native-history 저장 scope, session-resources 합성/읽기 전용, nativeResourcesMenu 구성 상태. r1.2 자리별 좌표를 같은 파일 테스트로 재실행 |
| VP-15 | REGRESSION / SELF_PASS | EP12 / 2/2 | agentModeLanding.render의 project 브랜드 전환·초안 유지, NewChatLandingPage.harness |
| VP-16 | REQUIRED / SELF_PASS | EP13 / 3/3 | ①session-resources `returns configured resources when live metadata is %s and reads freshly on reentry`·`keeps live resources when configuration fails…` ②useNativeResources `reloads A after A → B → A…`·late read/write ③같은 파일 `renders the live session menu…`의 실패/refresh 클릭 |
| VP-17 | REQUIRED / SELF_PASS | EP14 / 6/6 | ①Claude native-resources `projects exact supported slash commands…` ②OpenCode native-resources `projects exact command names, hints and descriptions without templates or provider configuration` ③adapter.live-control의 native-plugin:review + persistent `dispatches a real native slash command…`의 docs:search DTO ④⑤Composer.native-menu 양 backend의 session-B:review, +/트리/초안 실제 렌더 ⑥composerAttachMenu의 nativeCommand 앞 삽입·IME 거부 |
| VP-18 | REQUIRED / SELF_PASS | EP15 / 1/1 | persistent `dispatches a real native slash command while its HTTP response is pending…`, `sends an unknown slash…`, `surfaces a rejected command and ignores a previous command error after a later submission`: model-B/reviewer/deep·파일·문맥·승인 reply, 지각 HTTP 실패와 현재 실패 구별 |
| VP-16 | REQUIRED / SELF_PASS | EP16 / 4/4 | ①Composer.native-menu: +가 닫힌 B→C→B에서 read 관측 ②useNativeResources `keeps observations across remount and refresh failure…`·`reloads after failed control…` 성공/실패 두 분기 ③실제 NativeResourcesMenu 오류/재시도 클릭 ④실제 Composer 메뉴 refresh 중 명령 유지와 빈 최신 결과 교체 |

분모 검산: 기존42 + EP13~15 10 + EP16 4 = 56/56. 신규 자리 검색은 `.tmp/0267-r13-ep13.txt`, `ep14.txt`, `ep15-16.txt`에서 생산 호출과 운반 경로를 대조했다. import/type/i18n 문구 및 기존 EP5~8 호출은 중복 자리로 세지 않았다. EP16의 Composer 갱신 호출은 `refreshNative` 별칭까지 확인했다. 규범 목록과 생산 경로의 차집합 []·남긴 자리 없음. 보고의 SELF_PASS는 독립 verify를 대신하지 않는다.

## [구현자 기입] r1.3 이번 라운드 수정의 잠금

| 선택 결함 | 이전 결과 | 이번 관측 | 복원 |
|---|---|---|---|
| M1 backend 선택 반전 | r1.2 red 2 | Sidebar.interaction 2 failed/4 | 원본 바이트 복원 |
| M2 MCP/plugin 목록 맞바꿈 | r1.2 red 3 | nativeResourcesMenu 3 failed/3 | 원본 바이트 복원 |

복원 후 두 파일 7/7. 선택 증거 2·인용 변이 0·신규 구조 proxy 0 = 2행. 신규 동작은 실제 hook·Controller·메뉴·SDK transport 진입에서 직접 관측하므로 새 변이를 추가하지 않았다.

## [구현자 기입] r1.3 Product/UX 파생 검토

| 관측 | 대응 / 결과 |
|---|---|
| 갱신 상태를 목록 맨 앞에 넣으면 열린 submenu의 숫자 경로가 변함 | 안내를 고정 submenu/refresh 뒤에 배치했다. 실제 Composer 테스트가 갱신 중 열린 플러그인 목록과 완료 후 빈 명령 교체까지 단언한다. |
| 예전 연결 표시가 현재 쓰기 권한으로 보일 수 있음 | 갱신 중 이전 snapshot은 generation 제거·canToggle=false, 이전 connected는 configured로 표시한다. 최신 IPC 검사는 별도로 유지한다. |
| 명령 없는 native plugin 이름을 slash로 추측할 위험 | SDK가 보고한 이름만 제공한다. 리소스 행은 상태를 표시하고, 연결된 MCP는 자연어 도구 사용 문구를 제시한다. |
| OpenCode command HTTP는 모델 완료까지 대기 | HTTP 응답을 event pump가 기다리지 않는다. 실제 SDK transport 테스트에서 HTTP 미완료 중 permission reply와 turn.ended를 관측했다. |
| OpenCode command에는 system 필드가 없음 | 기존 시스템/복구/프리루드 문맥은 noReply synthetic 입력으로 전달한 뒤 command를 실행한다. 네이티브 이력에는 자동 입력으로 남을 수 있으며 시스템 메시지 역할과 동일하다는 주장은 하지 않는다. |

## [구현자 기입] r1.3 놓친 잠재 문제 + 대응

| 문제 | 대응 / 확인 |
|---|---|
| live metadata의 무응답이 구성 목록까지 가림 | 양 원천을 독립 3초 deadline으로 정착. fake clock 및 다음 read의 새 데이터 확인 |
| 재마운트가 마지막 목록을 소거 | 창 수명 WeakMap에 session+backend 관측 저장. 재진입 조회는 유지, 타 범위에 유출하지 않음 |
| 제어 실패 뒤 실제로는 상태가 바뀌었을 수 있음 | 낙관적 상태 변경 없이 read를 다시 호출. read까지 실패하면 이전 목록·오류·잠금 유지 |
| 명령 조회 성공의 빈 배열과 실패를 혼동 | 성공은 commands:[], 실패는 undefined+partial. 완전 성공은 삭제된 명령을 제거 |
| 이전 OpenCode 명령의 늦은 HTTP 오류가 다음 입력을 종료 | submission epoch로 이전 오류 폐기. 현재 실패는 채널 오류로 관측 |
| SSR 테스트에서 window 없는 캐시 접근 | 초기 view를 loading으로 반환하고 effect에서만 browser 조회. 기존 Composer SSR 통과 |

캐시는 앱 창 재시작까지 영속하지 않는다. 조회 때문에 실행 채널을 새로 만들거나 네이티브 설치·인증·전역 설정을 변경하지 않는다. 기본 좁은 브라우저 pane에서는 계단 메뉴가 방향을 바꾸어 표시되며, 열린 채 viewport 크기를 변경하면 일부 기존 하위 패널 위치가 재열기 전까지 남는다. 이 기존 CascadePanel resize 갱신 한계는 NON_BLOCKING 후속 관측으로 남긴다.

## [구현자 기입] r1.3 구현 보고

구현은 native commands/partial DTO, 원천별 조회 기한, renderer 세션 관측 유지/실패 재조회, 실제 Composer 플러그인 트리·draft 삽입, OpenCode command dispatch와 문서/fixture에 걸친다. 검증 상세와 명령은 [validation r1.3](evidence/validation.md)에 있다. 관련 회귀 집합은 실패 수정 후 해당 파일 재실행 및 Electron DB 실행을 합쳐 확인했으며 lint 오류 0·기존 경고 4, 타입 검사 3종·production build·boundary·카탈로그를 통과했다. 기존 ignored 외부 clone 링크 오류는 제품 변경과 분리했다.

| AC | 자기 결과 |
|---|---|
| AC1~14 | ✅ 기존 진입·브랜드·메뉴·구성 관측·세대/읽기 전용·명시 선택 계약 회귀 |
| AC15 | ✅ 매 재진입/재열기 갱신, snapshot 유지, 부분 실패/재시도, 제어 실패 자동 read, stale 폐기 |
| AC16 | ✅ 양 하네스 + 메뉴 실제 명령·MCP 안내, 초안 보존/전송 없음 |
| AC17 | ✅ 실제 SDK command 경로·일반 slash 폴백·문맥/첨부/모델 운반·승인 비차단 |

✅17 · ⚠️0 · ❌0 = 총17(자기보고). 실 인증 CLI/MCP 실행 smoke와 독립 verify는 수행하지 않았다. 브라우저 증거는 production 컴포넌트와 fixture IPC로 확인했다.

## [구현자 기입] r1.3 Review Signals

- 같은 라운드의 사용자 추가 요구에 따른 구현. 외부 verify/FAIL 라운드 증가 없음.
- 기존 메뉴 재마운트 조회만으로는 무응답·관측 유지·명령 진입 문제가 해결되지 않았다. 각각 deadline, snapshot, 실제 Controller oracle로 닫았다.
- 테스트 중 발견한 submenu index 변화의 렌더 반복과 SSR 캐시 접근을 수정하고 실패했던 전체 파일을 재실행했다.
- DB ABI는 바꾸지 않고 Electron Node 모드로 12케이스를 실행했다. UI·native 설정·인증을 통한 실제 외부 실행은 하지 않았다.

## ΔV6 — 네이티브 스킬 배치와 플러그인 폴더 열기 (r1.4)

사용자 정정: “하네스 플러그인은 스킬묶음이다. + -> 스킬에서 노출하라. e.g., 'superpowers::using-superpowers'. 설명은 툴팁으로 노출. + -> 플러그인에서는 노출하지 않는다”. 추가로 케밥 플러그인의 흐린 효과·토글을 없애고 설치 폴더 열기/설명 툴팁, MCP와 같은 플러그 SVG, “다시 불러오기 버튼 제거”를 요청했다.

| 결정 | 상태 | 계약 |
|---|---|---|
| D-19 | ACTIVE | Composer의 네이티브 비MCP 명령을 `+ → 스킬`에 표시한다. `plugin:skill`은 `plugin::skill`로 표시하고 실제 삽입 토큰은 원래 SDK 이름을 보존한다. 설명은 title 툴팁이며 inline 설명은 없다. MCP와 Orca 커넥터는 기존 플러그인 메뉴에 유지한다. |
| D-20 | ACTIVE | 케밥 플러그인은 일반 밝기의 폴더 열기 액션이다. 체크/토글은 없고 설명과 폴더 열기 안내를 툴팁에 둔다. 플러그인 그룹 아이콘은 MCP와 같은 electricalServices SVG다. D-08·AC6/9의 플러그인 표시 제어만 대체하며 활성 상태 변경 금지는 유지한다. |
| D-21 | ACTIVE | 양 메뉴의 수동 다시 불러오기 버튼을 제거한다. 재진입·메뉴 재열기·실패 후 자동 재조회와 관측 유지(D-18)는 계속 수행한다. D-14/AC15의 재시도는 자동 갱신 또는 재열기로 해석한다. |
| D-22 | ACTIVE | 폴더 열기는 sessionId+pluginId만 받고 main이 해당 세션의 실제 설치/라이브 관측으로 경로를 해석한다. 경로를 renderer에 노출하거나 플러그인을 실행/설치하지 않는다. 사라진 설치·알 수 없는 ID·조회 실패는 안전한 오류와 자동 재조회로 끝난다. |

AC16은 D-19의 배치·표시 형식·툴팁으로 대체하며 기존 초안 보존/전송 금지 oracle은 승계한다. AC18: 케밥 플러그인은 흐림/토글 없이 설명 툴팁과 플러그 SVG를 갖고 클릭하면 해당 설치 디렉터리를 OS 탐색기로 연다. AC19: 수동 재조회 버튼은 양 메뉴에 없고 기존 세션 재진입·메뉴 재열기·실패 시 새 조회를 관측한다.

기술: NativeResource에 optional description만 추가한다. LiveTurn/SessionRuntime의 nativePluginDirectory(id)와 MainHarnessModule의 configuredPluginDirectory(cwd,id)는 main 내부 포트다. 새 sessionOpenNativePlugin IPC는 strict sessionId/id schema, lookup 세션 검증, directory stat 후 shell.openPath와 오류 문자열 검사를 수행한다. plugin ID는 위치/명세의 hash로 안정화하며 OpenCode 배열 순서에 의존하지 않는다.

Claude는 기존 scoped installed_plugins.json과 SDK init 경로에서 plugin.json.description을 읽는다. live 우선 합성에서도 구성 description을 유지한다. OpenCode는 config plugin의 file/path 또는 npm 설치 캐시의 package.json.description과 디렉터리를 읽으며, 프로세스와 같은 환경/cwd를 적용한다. SDK 1.18.27 대응 [native loader](https://raw.githubusercontent.com/anomalyco/opencode/v1.18.27/packages/opencode/src/plugin/shared.ts)·[Npm cache](https://raw.githubusercontent.com/anomalyco/opencode/v1.18.27/packages/core/src/npm.ts)를 근거로 사용하며 미설치/미해석 경로를 추측해 열지 않는다.

| Pair | 노드 / requiredness | production 경로 / oracle |
|---|---|---|
| VP-17 | R-16·AR-04·MD-05 CHANGED REQUIRED | SDK commands→hook→AttachMenu 스킬/플러그인 분리→draft. attachMenuModel/Composer.native-menu/composerAttachMenu의 서로 다른 plugin/MCP 입력과 원래 slash 관측. 기존 EP14 6자리 승계. |
| VP-19 | R-18↔AT-18, SD-04↔ST-04, AR-05↔IT-05, MD-06↔UT-06 NEW REQUIRED | native metadata→main lookup→DTO→메뉴→IPC→trusted directory→shell.openPath. 아래 EP17 자리별 좌표. |
| VP-16 | R-15·SD-02 CHANGED REQUIRED | EP13/16의 수동 retry 자리를 메뉴 재열기·실패 후 자동 조회로 대체한다. useNativeResources/Composer.native-menu 실제 렌더에 버튼 부재·재조회·관측 유지 단언. |
| VP-01~15,18 | INHERITED REGRESSION | 이전 좌표의 변경 subtree 재실행. EP1~12/15 유지. M1/M2 회귀 유지. |

§10 EP17 고정 10자리: ①Claude configured metadata/ID→directory ②Claude live metadata→directory ③OpenCode live metadata→directory ④양 adapter LiveTurn 반환 ⑤SessionRuntime 위임/교체 fence ⑥bootstrap 저장 session scope→configured resolver ⑦IPC schema/handler stat·shell result ⑧preload/sessionApi transport ⑨hook action 실패 재조회 ⑩kebab model/component 액션·title·icon. 검색: `rg -n 'nativeResources|configuredResources|setNativeResource|nativeResourcesMenu' app/src/{main,shared,preload,renderer}`의 기존 운반 경로에 동일 포트를 추가한다.

직접 oracle: ①configured-resources.test scope/id/path/description ②Claude native-resources.test injected 제외·init hash ③OpenCode native-resources.test file/npm fixture·ID 재정렬 ④adapter.live-control/persistent 포트 값 ⑤session-runtime.test 지각 resolver 거부 ⑥bootstrap.native-history.test 다른 cwd/backend ⑦session-resources.test 정상/없는 ID/경로주입/파일/OS오류 ⑧preload index.test·hook 실제 sessionApi ⑨useNativeResources.test 열기 실패 read ⑩nativeResourcesMenu.test·실제 NativeResourcesMenu render. 총 자리 56+10=66, 수동 재시도는 대체되어 분모를 늘리지 않는다.

선택 변이 M3: attachMenuModel의 native 스킬/MCP 목적지를 맞바꿔 올바른 배치 단언이 red인지 확인한다. M1/M2 기존 선택 변이를 유지한다. 새 의존성/DB/설정 쓰기 없음. 운영 gate는 이전 lint/typecheck/관련 테스트/build/boundary/inventory/catalog를 승계한다. ACTIVE D-19~22↔AC16/18/19 대조 충돌 0; D-16 실제 명령 원천·D-18 관측 유지도 보존한다.
