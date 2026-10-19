# Plan — 0267-harness-entry-menu

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex (설계 역할) / 2026-10-19 |
| 상태 / 라운드 | IMPL_DONE / r1 |
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
