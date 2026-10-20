# Plan — 0267-harness-entry-menu

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex (설계 역할) / 2026-10-19 |
| 상태 / 라운드 | READY / r1.10 |
| V mode / 기준 V / 유효 V | Delta V / r1.9 (`64beff7e`) / V1+ΔV1+ΔV2+ΔV3+ΔV4+ΔV5+ΔV6+ΔV7+ΔV8+ΔV9+ΔV10+ΔV11+ΔV12 |
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

## [구현자 기입] r1.4 설계 리뷰

유지/변경 구분 완료. D-19~22의 배치·폴더 액션·수동 갱신 제거를 구현했고 D-16 실제 명령 원천과 D-18 관측 유지/자동 갱신을 보존했다. D-20이 이전 플러그인 토글 표시 계약을 대체하는 범위를 별도 설계 커밋으로 명시했다.

## [구현자 기입] r1.4 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01~04 | 진입·선택·좌표 | EP1~3 / 9 | 9/9 | Sidebar.interaction, popoverPosition 회귀·M1 red | 두 backend·nav 상태·클릭/키보드 | 없음 |
| VP-05 | hero 브랜드 | EP4 / 1 | 1/1 | AgentModeToggle 테스트 | Work/Code 로고 앞 순서 | 없음 |
| VP-06~09 | DTO/제어/전달 | EP5~8 / 16 | 16/16 | adapter.live-control/persistent, session-runtime, session-resources, preload, useNativeResources, ChatTitleBar/nativeResourcesMenu 회귀 | 서로 다른 MCP/plugin, generation-B·session-B, false/true. D-20 표시 변경 포함 | 없음 |
| VP-10~11 | 명시 선택 | EP9 / 7 | 7/7 | chatStore.harness/Composer.selection/modelSelection/NewChatLandingPage.harness | 빈/늦은 모델에도 OpenCode 유지 | 없음 |
| VP-12 | 그룹 요약 제거 | EP10 / 1 | 1/1 | ChatTitleBar.native-resources | 그룹 연결 요약 없음 | 없음 |
| VP-13~14 | 구성 관측 | EP11 / 6 | 6/6 | configured-resources scope, bootstrap.native-history stored backend/cwd, session-resources merge/offline, nativeResourcesMenu | project-B·wrong-default 구분, native/plugin ID 일치 | 없음 |
| VP-15 | 프로젝트 브랜드 | EP12 / 2 | 2/2 | agentModeLanding.render | backend 왕복·초안 유지 | 없음 |
| VP-16 | 자동 갱신·관측 유지 | EP13 / 3 + EP16 / 4 | 7/7 | useNativeResources 실제 메뉴 재열기/실패 read, Composer.native-menu 재진입/재열기 | 이전 snapshot 표시, late 응답 폐기, refresh 버튼 부재 | 없음 |
| VP-17 | 스킬·MCP 분리 | EP14 / 6 | 6/6 | 양 adapter native-resources, 실제 Composer.native-menu, attachMenuModel, composerAttachMenu | session-B::review 표시→원래 /session-B:review 삽입, MCP는 별도 목록 | 없음 |
| VP-18 | OpenCode 명령 | EP15 / 1 | 1/1 | adapter.persistent command/event/approval 회귀 | 명령·첨부·모델·문맥, HTTP 대기 중 승인 | 없음 |
| VP-19 | 설치 정보 | EP17 ①②③ / 3 | 3/3 | configured-resources scoped directory/description + live.list, OpenCode plugin-installation 파일/npm 실제 fixture | project-B 설치와 무관 scope, 로컬/Npm 설명, 재정렬 ID | 없음 |
| VP-19 | main 포트·경계 | EP17 ④⑤⑥⑦⑧ / 5 | 5/5 | 양 adapter live port; session-runtime retirement; bootstrap.native-history resolver; session-resources open/install/error; preload native transport | /native vs injected, plugin-B, cwd-B, 파일/경로 주입/OS 오류/지각 runtime 거부 | 없음 |
| VP-19 | 화면 액션 | EP17 ⑨⑩ / 2 | 2/2 | useNativeResources `opens a plugin directory…`, nativeResourcesMenu 실제 CascadeBody | 설명 title, checked/disabled 없음, open 호출·toggle 0, 실패 read→성공 오류 제거 | 없음 |

계산: 이전 56 + EP17 10 = 66/66. EP1~16과 EP17 ①~⑩의 자리별 근거는 위 표에 대응했다. 실행 집합과 수치는 [validation r1.4](evidence/validation.md)에 기록했다.

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01~15,18 | REGRESSION | SELF_PASS | 위 상속 자리의 이번 회귀 실행 | M1/M2 red·복원 green |
| VP-16 | REQUIRED | SELF_PASS | useNativeResources·Composer.native-menu 재열기/제어 실패/관측 보존 | 직접 행동 oracle |
| VP-17 | REQUIRED | SELF_PASS | attachMenuModel 및 실제 Composer.native-menu의 명령 선택 | M3 red·복원 green |
| VP-19 | REQUIRED | SELF_PASS | 위 EP17 자리별 파일·케이스 | 직접 파일/IPC/UI 행동 oracle |

## [구현자 기입] r1.4 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| NewChatHarnessMenu 선택 backend 반전 | M1 / VP-02 | red 2 | Sidebar.interaction / 2 | 잠김 |
| nativeResourcesMenu MCP/plugin 목록 맞바꿈 | M2 / VP-06·09 | red 3 | nativeResourcesMenu / 3 | 잠김 |
| attachMenuModel 스킬/MCP 목적지 맞바꿈 | M3 / VP-17 | 최초 | attachMenuModel / 1 | 잠김 |

원본 bytes 복원 후 3파일 15케이스 통과. 인용된 미검출 변이 없음, 추가 직접 oracle은 임의 변이를 의무화하지 않았다.

## [구현자 기입] r1.4 Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 문구·상태의 소비자 | openError/openFolder를 NativeResourcesMenu title/status에서 관측 | 완료 |
| production 재배치와 정리 범위 | reader를 metadata+directory로 감쌌으며 프로세스 실행/설치·새 수명 자원 없음 | 해당 없음 |
| 실패 경로의 제품 행 | D-22의 없는 설치/조회 실패, D-18 자동 재조회 | hook·IPC 실패 테스트 |
| 실패가 무반응으로 보이는가 | 오류 표시→자동 read, 후속 열기 성공 시 오류 제거 | 실제 메뉴 테스트 |
| 지각 응답이 화면을 되돌리는가 | 기존 hook epoch와 runtime/DB scope fence 유지 | 기존 회귀 + 새 directory retirement |

## [구현자 기입] r1.4 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | OpenCode 배열 index ID는 설정 재정렬 뒤 다른 폴더를 가리킬 수 있음 | ✅ 명세 hash로 교체 | 실제 파일/npm fixture 재정렬 후 동일 경로 |
| 2 | live 합성이 구성 description을 덮어 없앨 수 있음 | ✅ live 상태 우선 + 구성 description 유지 | session-resources merge 단언 |
| 3 | 폴더 열기 실패 뒤 재시도 성공에도 오류가 남음 | ✅ 같은 epoch 성공에서 open 오류만 제거 | hook 실제 메뉴 3회 클릭 |
| 4 | OpenCode 미해석 명세/설치 없음 | 안전한 오류와 자동 갱신. 패키지 설치·임의 경로 추측 없음 | plugin-installation 미존재/URL 거부 |
| 5 | 실제 Explorer와 인증 CLI | ⚠️ 실제 사용자 환경 실행 미확인 | OS 경계 stub·브라우저 fixture로 범위를 명시 |

설계 메커니즘 대체 없음. 만료·공유·재진입·다른 무효화 축은 기존 창 snapshot과 조회 fence를 유지하며 useNativeResources의 scope/remount/late/read-failure 회귀로 확인했다.

## [구현자 기입] r1.4 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | native DTO/adapter metadata와 directory 포트, runtime/bootstrap/IPC/preload, hook/두 메뉴/i18n, fixture·계약/카탈로그/inventory |
| 실행 명령 | validation r1.4의 vitest, Electron DB, typecheck, eslint, build, boundary, inventory, catalog, 변이 |
| 관측한 게이트 산출 | 고유 283파일 2,286케이스 확인(DB 5건 별도 Electron), 마지막 변경 4파일 107 + metadata 2파일 13 재실행. lint 0 error/기존 4 warning, 타입 3종·build 성공 |
| V-pair 자기확인 | SELF_PASS 19 / SELF_BLOCKED 0, 독립 verify 아님 |
| 강제 지점 전수 | 66/66, 위 자리별 관측 |
| AC 자기보고 | 아래 표 19/19, 실제 외부 실행 한계는 별도 기록 |
| 합계 검산 | ✅19 · ⚠️0 · ❌0 = 총19(기계 자기검증). ΔV6에서 AC18/19가 추가됨 |
| 블로커 / 역질문 | 없음. 실제 Explorer·인증 CLI 및 독립 verify 미실행 |
| 대상 커밋 | (r1.4 구현 — 좌표는 INDEX) |

| AC | 이번 턴 관측 |
|---|---|
| AC1~4 | ✅ Sidebar 두 nav/두 backend 선택·위치·키보드·취소, M1 red |
| AC5 | ✅ AgentModeToggle 모드별 로고/문구 |
| AC6~10 | ✅ titlebar 두 그룹, native DTO/주입 제외, MCP true/false·권한/세대, 로딩/빈/오류/지각 응답 |
| AC11 | ✅ 명시 선택 보존(store/Composer/model/page 회귀) |
| AC12~14 | ✅ 연결 요약 부재, scoped 구성 목록, project 헤더 전환 |
| AC15 | ✅ 관측 유지·재진입/재열기·제어 실패 자동 조회 |
| AC16 | ✅ 스킬 표시와 tooltip, 원래 명령 삽입·초안/전송 보존, M3 red |
| AC17 | ✅ OpenCode SDK command와 승인 비차단 경로 |
| AC18 | ✅ 정상 밝기·플러그 SVG·토글 없음·설치 resolver→shell 경계. 실제 Explorer 창은 미확인 |
| AC19 | ✅ 두 메뉴 refresh 버튼 없음·자동 조회 유지 |

## [구현자 기입] r1.4 Review Signals

- 같은 라운드의 사용자 정정에 따른 구현이며 독립 verify 실패 라운드는 아니다.
- 기존 D-15의 메뉴 분류와 D-08의 플러그인 표시를 사용자 요청으로 대체했다.
- Node/Electron DB ABI 차이는 140/127 오류를 확인하고 Electron에서 동일 5케이스를 재실행했다.
- 문서 링크 gate는 ignored 외부 clone의 기존 5건이 남으며 실제 저장소 링크 차집합은 비었다.

## ΔV7 — 활성 네이티브 플러그인 로딩과 설치 스킬 발견 (r1.5)

READY. 사용자 원문: “frontend-design 포함해서 활성화된 하네스 플러그인의 스킬이 노출되고 실제로 사용되도록 수정해줘.” 실제 사용자 설치 registry·활성 설정·SKILL.md는 존재하지만, Claude query에는 Orca 주입 roots만 전달되고 adaptSkills는 기존 확장만 허용한다.

### Decision / Product & UX Contract

| 결정 | 상태 | 계약 / 대체 관계 |
|---|---|---|
| D-23 | ACTIVE | Claude 세션 생성·재개 spawn에서 해당 cwd/native root의 활성 설치 플러그인을 SDK local plugins로 로드한다. user→project→local→provider 플러그인 활성 설정을 적용하고 비활성/타 프로젝트/미설치는 제외한다. D-18의 자동 로딩 정책 불변 문장과 ΔV3의 자동 실행 비범위를 이 범위에서 대체한다. |
| D-24 | ACTIVE | 실행 전에는 활성 설치 플러그인의 실제 skill/command 파일에서 이름·설명·힌트를 읽어 +→스킬에 제공한다. 실행 중에는 SDK 명령 관측이 우선한다. D-16의 SDK 전용 원천을 대체하되 설치명만으로 명령을 추측하지 않는 계약은 유지한다. |
| D-25 | ACTIVE | 기존 활성 Orca/사용자/작업폴더 스킬과 활성 네이티브 스킬을 함께 허용한다. 비활성 Orca 스킬은 계속 제외한다. 사용자 env·인증·model·hooks 설정을 통째로 상속하지 않는다. |

D-19~22의 표시 형식·툴팁·초안 보존·폴더 열기·수동 재조회 제거를 유지한다. 목록 조회는 파일 읽기만 하며 CLI 실행은 명시 전송에서만 수행한다. OpenCode는 기존 native command.list→session.command 경로를 유지한다.

| AC | 관측 계약 | 직접 oracle / production 경로 |
|---|---|---|
| AC20 | 활성 frontend-design 및 다른 네이티브 플러그인이 신규/재개 Claude query의 plugins에 포함되고, disabled/무관 scope는 제외된다. | adapter.native-plugins.test: 실제 registry/settings 임시파일→sendMessage→SDK options, 두 spawn 사이 설정 갱신 |
| AC21 | 기존 스킬이 있어도 native 스킬이 모델 허용 목록에 포함된다. 이름과 명령은 파일 metadata로 확인하며 사용자 호출 금지 스킬은 메뉴에서 제외한다. | plugin-catalog.test: 기본·사용자 지정 skills/commands·frontmatter·scope; adapt.test와 adapter.native-plugins.test SDK skills 관측 |
| AC22 | runtime이 없어도 활성 plugin 스킬을 +→스킬에 표시하고 설명 tooltip·원래 slash 삽입·초안 보존을 수행한다. live 성공 목록이 설치 예상 목록보다 우선한다. | bootstrap.native-history.test 저장 scope→configured commands; session-resources.test offline/live/failure 합성; Composer.native-menu + attachMenuModel + composerAttachMenu |
| AC23 | 선택된 slash가 실제 CLI에서 plugin skill로 해석된다. plugin 원본/설정은 쓰지 않고 provider 격리·Orca disabled·OpenCode 명령 경로를 보존한다. | 실제 bundled SDK/CLI + loopback mock API smoke에서 skill 본문이 모델 요청에 확장되는지 관측; adapter options 및 기존 OpenCode persistent 회귀 |

### Technical Design / 조사

- SDK 0.3.296 `Options.plugins`는 local path를 받으며 `Options.skills` 배열은 나머지 스킬을 숨기고 Skill 도구 호출을 거절한다. [공식 plugin 문서](https://code.claude.com/docs/en/agent-sdk/plugins)는 CLI 설치 경로의 명시 전달과 `/plugin:skill` 사용을 설명한다.
- Claude adapter 내부 plugin catalog가 설치 scope·enabledPlugins 우선순위의 정본이 된다. registry→manifest→기본/manifest 지정 skills와 commands를 읽고 runtime roots·skills와 공개 명령 metadata를 분리한다. 추가 의존성·DB/원본 설정 쓰기 없음.
- sendMessage의 동기 spawn 계약을 유지하며 catalog는 메타데이터만 읽는다. plugin 파일의 내용 전체를 renderer/로그로 전달하지 않는다. startup read 실패는 안전한 오류로 전송 실패, 메뉴 조회 실패는 기존 partial/error로 표시한다.
- configured commands는 선택적 main harness 포트와 저장 session cwd의 callback으로 기존 native-resource 응답에 합친다. 현재 live.commands가 있으면 그것을 사용하고, live 조회 실패/부재 시 파일 metadata를 사용한다. 조회와 spawn은 각각 최신 파일을 읽는다.
- native roots는 query plugins에 추가하되 `claudeNativeResources`의 Orca injected 제외 목록에는 넣지 않는다. custom native root는 실행 env의 CLAUDE_CONFIG_DIR를 따른다. 공통 프론트매터 변환은 하위 순수 helper로 분리해 기존 스킬 스캐너와 공유한다.

### V / §10 고정 자리

| Pair | 노드 / requiredness | start → edges → end / 직접 oracle | 자리 |
|---|---|---|---|
| VP-20 | R-20~23↔AT-20~23 NEW REQUIRED | 설치/활성 설정→spawn→native 명령→메뉴→slash→CLI skill 확장; AC20~23의 직접 oracle 조합 | EP18~20 |
| VP-21 | SD-05↔ST-05 NEW REQUIRED | 최초/재개 spawn→설정 재조회→SDK plugins/skills, offline→live 목록 교체; adapter.native-plugins + session-resources | EP18~20 |
| VP-22 | AR-06↔IT-06 NEW REQUIRED | catalog→adapter 옵션 및 module→bootstrap→handler→기존 renderer; adapter.native-plugins·bootstrap.native-history·session-resources·Composer.native-menu | EP18~20 |
| VP-23 | MD-07↔UT-07 NEW REQUIRED | 설치 scope/flag→manifest/skill metadata→roots·skillNames·commands; plugin-catalog.test·adapt.test | EP18 |
| VP-13~14,16~19 | INHERITED REGRESSION | 기존 구성 목록/폴더 resolver·재진입 snapshot·스킬/MCP 배치·OpenCode dispatch를 관련 테스트로 재확인. M2/M3 유지 | 기존 EP11,13~17 |
| VP-01~12,15 | INHERITED NOT_REQUIRED | r1.4 기존 oracle 증거 유지. nav·브랜드·모델 선택·케밥 그룹 배치 코드에 이번 변경이 닿지 않음 | r1.4 보고 좌표 |

| 지점 | 고정 자리 목록 / 검색 | 실패 의미 / 자리별 oracle |
|---|---|---|
| EP18 (4자리) | ①설치 scope/활성 선택 ②skill/command metadata ③query plugin roots ④query skills 허용 목록. `rg -n 'enabledPlugins|pluginRoots|adaptPlugins|adaptSkills|skills|commands' app/src/main/adapters/claude app/src/main/features/extensions/common/skills` | ①②plugin-catalog 실제 파일 입력 ③④adapter.native-plugins 실제 sendMessage options; 미활성 실행/활성 누락/기존 스킬 차단 |
| EP19 (3자리) | ①harness configured commands 등록 ②bootstrap 저장 session scope 전달 ③handler offline/live 명령 선택. `rg -n 'configuredResources|configuredCommands|registerSessionResourceHandlers' app/src/main` | ①②bootstrap.native-history 실제 module 파일 reader ③session-resources IPC 결과; 다른 cwd·runtime 미실행 메뉴 누락·가짜 live 명령 |
| EP20 (3자리) | ①native observer의 injected 제외 ②기존 + 스킬 트리→draft ③CLI slash skill 확장. `rg -n 'claudeNativeResources|nativeAttachItems|nativeCommand|prompt: input.stream' app/src/main/adapters/claude app/src/renderer/src/features/chat` | ①adapter.native-plugins/live-control ②Composer.native-menu/composerAttachMenu ③loopback smoke API request 본문; 로드했지만 숨김/명령 오타/일반 텍스트 전송 |

신규 분모 10자리. 기존 회귀 EP11(6)+EP13(3)+EP14(6)+EP15(1)+EP16(4)+EP17(10)=30자리, 이번 실행 분모 40자리이며 비영향 자리를 재검증했다고 주장하지 않는다. 직접 결과 oracle이므로 신규 변이 not selected; 변경 전후 M2/M3만 재실행한다.

운영 gate: lint·typecheck 3종·수정 adapter/IPC/renderer/확장 스캐너 회귀·build·boundary·문서 inventory. 실제 CLI 검증은 loopback 응답으로 수행하며 외부 유료 모델은 호출하지 않는다. AC20~23과 D-23~25 대조 충돌 0; D-16/D-18의 대체 문장 및 나머지 D-19~22 승계 확인. 독립 verify는 이후 별도 수행한다.

### ΔV7 보완 — 첫 전송 전 새 대화

READY. ComposerInputController→useNativeResources는 sessionId=null이면 IPC를 호출하지 않아, 설치 목록을 추가해도 새 대화 첫 전송 전에는 스킬이 보이지 않는다. AC22의 runtime 부재는 저장 세션뿐 아니라 새 대화 초안도 포함한다.

조회 IPC는 기존 `{sessionId}`와 읽기 전용 초안 `{backend,cwd,projectId}`의 strict union으로 받는다. 초안은 main이 cwd(명시 절대 경로 또는 기존 프로젝트 기본 경로)를 해석해 configuredCommands만 조회하며 items=[]·disconnected다. 토글/폴더 열기는 기존 sessionId 필수 계약을 유지한다. 초안 scope가 바뀌면 이전 응답을 폐기하고 마지막 세션 관측 캐시와 섞지 않는다.

EP21 (4자리)를 VP20~22 REQUIRED에 추가한다: ①Composer backend/cwd/projectId→hook 요청 ②preload/sessionApi→query IPC ③handler 초안 분기 ④bootstrap 하네스/cwd→파일 reader. 검색은 `rg -n 'nativeResources|useNativeResources|configuredCommands' app/src/main/app app/src/preload app/src/renderer/src/features/chat app/src/renderer/src/shared/api`다. 직접 oracle은 ①Composer.native-menu의 새 초안 선택/초안 보존·useNativeResources의 cwd 변경 지각 응답 ②preload/index.test ③session-resources.test strict union/읽기 전용 ④bootstrap.native-history.test 초안 실제 스킬 파일이다.

이번 실행 분모는 신규 14 + 상속 회귀 30 = 44자리로 정정한다. 새 IPC 요청은 정보 조회만 수행하며 native 설정 쓰기·세션 생성은 하지 않는다. D-24 및 AC22의 누락된 production 진입점을 닫는 구현 전 계약 보완이며 신규 사용자 결정은 없다.

## [구현자 기입] r1.5 설계 리뷰

SELF_PASS. 설치된 frontend-design의 활성 flag·manifest·SKILL.md는 존재하지만 기존 query에는 native root가 없었고, Orca의 skills 허용 목록이 native 스킬을 제외했다. 메뉴 또한 실행 중인 SDK 명령만 읽었다. D-23~25를 별도 설계 커밋으로 확정하고 세 경로를 함께 연결했다.

새 대화는 sessionId가 없어 기존 hook이 조회를 생략했다. EP21/strict draft 조회를 구현 전에 별도 설계 커밋으로 보완했다. 이 경로는 세션을 만들거나 CLI를 실행하지 않는다. D-19~22의 UI 계약은 유지했다.

## [구현자 기입] r1.5 강제 지점 전수와 V-pair 자기확인

| V-pair | 대상 불변식 | §10이 적은 지점 | 닫은 수 | 직접 oracle 좌표 | 이번 턴 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP20~23 | 활성 설치·메타데이터 | EP18 ①② / 2 | 2/2 | plugin-catalog.test: selects active installations… / discovers declared skill paths… | user/project/local/provider flag·scope, custom 경로·legacy command·설명·힌트·hidden | 없음 |
| VP20~23 | SDK root·허용 목록 | EP18 ③④ / 2 | 2/2 | adapter.native-plugins.test: loads enabled native skills for session %s…; adapt.test | 신규/재개 옵션에 native+Orca enabled, disabled 제외, 다음 spawn의 설정 변경 반영 | 없음 |
| VP20~22 | 오프라인 조회 배선 | EP19 ①②③ / 3 | 3/3 | bootstrap.native-history: reads native configuration through the registered module…; session-resources: offers installed skills offline… | 실제 module reader의 project-B 파일→commands, live=[] 우선, 성공한 configured=[]로 제거 반영 | 없음 |
| VP20~22 | 관측·선택·실행 | EP20 ①②③ / 3 | 3/3 | adapter.native-plugins 실제 init; Composer.native-menu saved/draft; gate: node app/scripts/smoke-native-plugin-skills.mjs | native 노출·injected 제외, exact slash+초안, 실제 CLI 모델 요청에 skill 본문·인자 포함 | 없음 |
| VP20~22 | 새 초안 범위 조회 | EP21 ①②③④ / 4 | 4/4 | Composer.native-menu saved/draft; useNativeResources: discovers draft skills by cwd…; preload/index.test; session-resources: accepts only a read-only draft scope…; bootstrap.native-history | pendingProjectId/cwd 전달, 다른 cwd 지각 응답 폐기, strict union·write 거부, 명시 cwd/프로젝트 기본 경로 | 없음 |
| VP13~14 | 구성 목록 합성 | EP11 / 6 | 6/6 | Claude configured-resources/native-resources; bootstrap.native-history; session-resources; nativeResourcesMenu | 설치 scope·비밀 제외·동일 ID·저장 cwd·live 우선·구성 상태. r1.4 자리별 oracle 재실행 | 없음 |
| VP16 | 재진입 관측·자동 갱신 | EP13 / 3 + EP16 / 4 | 7/7 | session-resources pending/failed; useNativeResources remount/refresh/failure/late; Composer.native-menu closed menu; NativeResourcesMenu 실제 렌더 | 이전 목록 유지, 실패 read 재시도, 세션/하네스 지각 응답 차단, 수동 버튼 없음 | 없음 |
| VP17 | 스킬/MCP 분리·운반 | EP14 / 6 | 6/6 | 양 native-resources, Claude adapter.live-control, OpenCode persistent, Composer.native-menu, composerAttachMenu | SDK 이름·설명·힌트, session-B 고유 명령, 스킬에만 노출·초안 삽입·IME 보호 | 없음 |
| VP18 | OpenCode 명령 실행 | EP15 / 1 | 1/1 | adapter.persistent: dispatches a real native slash command… / rejected command / unknown slash | command 인자·첨부·승인 비차단·지각 실패 회귀 | 없음 |
| VP19 | 폴더 메타데이터 | EP17 ①②③ / 3 | 3/3 | Claude configured-resources/native-resources; OpenCode plugin-installation/native-resources | scoped/라이브 설치 경로, file/npm 실제 fixture·설명·재정렬 ID | 없음 |
| VP19 | 폴더 main·IPC | EP17 ④⑤⑥⑦⑧ / 5 | 5/5 | 양 adapter live 포트; session-runtime; bootstrap.native-history; session-resources; preload/index.test | 교체 fence·저장 scope·파일/경로 주입 거부·shell 오류·ID 전송 | 없음 |
| VP19 | 폴더 화면 액션 | EP17 ⑨⑩ / 2 | 2/2 | useNativeResources: opens a plugin directory…; nativeResourcesMenu 실제 CascadeBody | toggle 0·open 호출, 실패 자동 read·설명 title·일반 밝기·플러그 아이콘 | 없음 |

계산: 신규 14 + 회귀 30 = 44/44. §10 검색을 `.tmp/0267-r15-ep18.txt`~`ep21.txt`로 다시 실행했다. 생산 경로를 읽어 등록/저장 scope/초안 scope/query/observer/메뉴/입력 경계를 위 자리에 대조했고, import·타입·테스트·기존 포트의 중복 운반을 제외한 목록 차집합은 없다. EP18의 공통 metadata helper는 기존 scan.test 회귀에도 포함했다.

| pair | requiredness | 자기 상태 | 근거 |
|---|---|---|---|
| VP20~23 | REQUIRED | SELF_PASS | 위 신규 14자리 직접 oracle, 실제 SDK/CLI loopback smoke |
| VP13~14,16~19 | REGRESSION | SELF_PASS | 위 회귀 30자리, M2/M3 red 후 원본 복원 green |
| VP01~12,15 | NOT_REQUIRED | r1.4 결과 승계 | 이번 수정이 닿지 않은 nav·브랜딩·모델 선택은 이번 실행 분모에서 제외 |

## [구현자 기입] r1.5 이번 라운드 수정의 잠금

| 증거 | 변경 자리 / 결함 | 관측 | 복원 |
|---|---|---|---|
| M2 | nativeResourcesMenu MCP/plugin contents 맞바꿈 | 3 failed / 3 | 원본 bytes 복원 |
| M3 | attachMenuModel 스킬/MCP 목적지 맞바꿈 | 1 failed / 8 | 원본 bytes 복원 |

선택 증거 2 · 인용 변이 0 · 새 구조/proxy oracle 0 = 표 2행. 복원 후 2파일 11/11, 최종 메뉴 4파일 22/22. 신규 14자리는 실제 파일·함수·컴포넌트·CLI 요청의 직접 행동 oracle이라 변이 not selected다.

## [구현자 기입] r1.5 Product/UX 파생 검토

| 상황 | 사용자 관측 | 확인 |
|---|---|---|
| 첫 메시지 전 | +→스킬에 활성 설치 스킬, 설명·힌트 tooltip | Composer saved/draft 두 경로에서 frontend-design::frontend-design 선택 |
| 선택 | /frontend-design:frontend-design 앞 삽입, 기존 초안 유지, 자동 전송 없음 | 실제 Controller→AttachMenu→CascadeBody→draft, onSend 0 |
| 재개/설정 변경 | 저장 범위의 최신 목록, live 성공 목록 우선 | catalog 재조회·새/재개 spawn, live empty·configured empty 구별 |
| 초안 작업 폴더 변경 | 이전 폴더 결과가 새 메뉴를 덮지 않음 | A 지연→B 완료→A 도착, B 명령 유지 |
| 조회 실패/미지원 | 기존 partial/error·읽기 전용 처리 유지 | handler/hook 회귀; OpenCode는 미지원 offline 원천을 undefined로 구별해 관측 보존 |

기존 +→플러그인에는 native 스킬을 넣지 않는다. 케밥 플러그인 토글·수동 재조회 버튼을 복원하지 않았다.

## [구현자 기입] r1.5 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 새 초안에 세션 ID가 없어 조회가 생략됨 | ✅ EP21 설계 보완 후 읽기 전용 draft 요청 구현 | saved/draft 선택·bootstrap 실제 reader·strict union |
| 2 | 활성 스킬을 제거해도 이전 commands가 남을 수 있음 | ✅ 성공한 빈 배열과 지원하지 않는 원천 undefined를 구분 | session-resources empty replacement·OpenCode 관측 회귀 |
| 3 | native roots를 injected 제외 목록에 넣으면 다시 숨겨짐 | ✅ 제외 목록은 기존 Orca roots만 유지 | 실제 init native만 노출·CLI nativeResources 관측 |
| 4 | 사용자 전역 설정 전체 상속 시 provider 구성 변경 | ✅ enabledPlugins와 설치 파일만 읽고 기존 settingSources 유지 | 옵션에 unwanted-model/secret 없음, 선택 model 유지 |
| 5 | provider 전용 native root/flag와 실행 전 기본 구성 reader 차이 | 기존 offline reader 범위 유지. 실행 후 SDK 목록이 우선하며 provider 전용 offline 해석 확대는 후속 검토 | runtime catalog는 실행 env/root/override 사용, draft는 현재 process native root와 cwd 사용 |
| 6 | 대규모 plugin tree 또는 비표준 YAML | 동기 spawn 계약·scalar metadata 범위 유지. 디렉터리 symlink 재귀 제외, 실제 CLI 명령 우선 | 기본/선언 경로·block description·hidden·metadata alias 테스트 |
| 7 | 인증된 외부 모델·실제 앱 창 확인 | 이번에는 외부 모델을 호출하지 않음. 실제 CLI와 설치 skill을 loopback으로 검증 | 모델 요청 body/인자·원본 파일 불변 확인, 새 UI 시각 변경 없음 |

## [구현자 기입] r1.5 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | Claude catalog/query/adapt·공통 metadata parser, module/bootstrap/IPC/preload, Composer/hook draft 조회, 테스트·CLI smoke·현재 계약 문서 |
| 실행 명령 | [validation r1.5](evidence/validation.md)의 vitest, CLI smoke, typecheck, lint, build, boundary, catalog, inventory, M2/M3 |
| 관측한 게이트 산출 | 회귀 70파일 918케이스 확인(환경 제한 재실행 포함). 최종 집중 6파일61·메뉴4파일22·포트7파일117·handler1파일11 통과. 타입3종·build 성공, lint 오류0·기존 경고4 |
| V-pair 자기확인 | REQUIRED 4·REGRESSION 6 SELF_PASS, SELF_BLOCKED 0. 독립 verify 아님 |
| 강제 지점 전수 | 이번 대상 44/44, 이전 비영향 36자리는 실행 분모에서 제외 |
| AC 자기보고 | 누적 23/23 기계 자기검증. 이전 19에 AC20~23 추가; 비영향 AC는 r1.4 관측 승계 |
| 합계 검산 | ✅23 · ⚠️0 · ❌0 = 총23. 실제 외부 모델·실제 앱 창 및 독립 verify는 별도 |
| 블로커 / 역질문 | 없음. 위 잠재 문제 5~7은 범위와 검증 한계로 기록 |
| 대상 커밋 | (r1.5 구현 — 좌표는 INDEX) |

| AC | 관측 |
|---|---|
| AC1~5,11~12,14 | ✅ r1.4의 nav/brand/model/titlebar oracle 승계, 이번 변경 비영향 |
| AC6~10,13 | ✅ native DTO·주입 제외·scope·read/control/늦은 응답 회귀 및 titlebar 메뉴 |
| AC15~19 | ✅ hook 재진입/실패 자동 갱신·두 메뉴·exact slash·OpenCode command·폴더 open·refresh 부재 |
| AC20 | ✅ 신규/재개 실제 sendMessage 옵션에 활성 native root, scope/비활성 제외와 다음 spawn 갱신 |
| AC21 | ✅ catalog metadata/hidden/allowlist + 실제 CLI metadata-name 관측, 기존 disabled Orca 제외 |
| AC22 | ✅ saved/draft 실제 +→스킬 선택, tooltip·초안 유지·live 우선·초안 cwd fence |
| AC23 | ✅ 실제 설치 frontend-design을 CLI로 읽어 모델 요청에 확장·인자 유지·원본 불변; 외부 모델은 loopback 대역 |

## [구현자 기입] r1.5 Review Signals

- r1의 추가 구현 턴 r1.5이며 독립 verify 전이다. 기존 SDK 관측만으로는 설치된 plugin skill의 실제 로딩을 보장하지 못했다.
- 사용자 요청으로 D-18의 자동 로딩 제한을 대체했다. 이전 표시-only 계약으로 실제 실행까지 완료했다고 주장하지 않는다.
- 새 초안의 sessionId=null 경로가 별도 진입점이므로 구현 전 EP21을 추가했다.
- Windows 임시 폴더 조상 stat 제한은 동일 실패 파일을 일반 권한으로 재실행해 분리했다. 기존 ignored 외부 clone 링크 오류 5건은 이번 변경과 무관하게 유지된다.

## ΔV8 — 안내 제거·오류 토스트·설치 범위 정정 (r1.6)

READY. 2026-10-20 사용자 요청으로 케밥 하네스 그룹의 모든 안내 문구를 제거하고 클릭 실패를 기존 오류 토스트로 전달한다. Claude 플러그인 목록의 정본은 native root의 `plugins/installed_plugins.json`이며 기본 경로는 `~/.claude/plugins/installed_plugins.json`이다.

| 결정 | 상태 | 계약 / 대체 관계 |
|---|---|---|
| D-26 | ACTIVE | 케밥 하네스 그룹과 그 하위 목록에서 로딩·갱신·이전 목록·부분 조회·빈 목록·오류 안내를 표시하지 않는다. 리소스 행 상태와 설명 툴팁은 유지한다. D-11·14·18의 케밥 안내 부분과 AC10·15의 표시 부분을 대체한다. Composer 안내는 기존 계약을 유지한다. |
| D-27 | ACTIVE | 조회·폴더 열기·MCP 제어 실패는 reportError 토스트로 전달한다. 자동 재조회 실패는 같은 클릭의 오류를 중복 보고하지 않으며 세션/메뉴가 바뀐 뒤 도착한 실패는 폐기한다. |
| D-28 | ACTIVE | user 설치는 항상 표시, project 설치는 cwd가 projectPath 자신 또는 하위일 때 표시, local 설치는 cwd와 projectPath가 일치할 때만 표시한다. 활성 설정과 무관하게 해당 설치를 표시하고 클릭은 그 항목의 installPath를 연다. 같은 플러그인의 다른 설치 경로도 누락하지 않는다. D-12·22의 범위 판정을 구체화한다. |
| D-29 | ACTIVE | 설치 목록과 user→project settings.json→settings.local.json의 enabledPlugins를 매번 재조회한다. 삭제된 설치는 성공한 최신 조회 후 제거하고 live/이전 관측이 복원하지 않는다. 활성 스킬·spawn은 활성 설정을 따르며 폴더 메뉴는 비활성 설치도 유지한다. 기존 폴더 액션을 유지하며 설치/설정 쓰기는 추가하지 않는다. |

| AC | 관측 기준 | 직접 oracle |
|---|---|---|
| AC24 | 케밥에 모든 목록 안내가 없으며 실제 항목·그룹·툴팁은 유지된다. | nativeResourcesMenu.test 모든 view의 실제 CascadeBody; useNativeResources.test 실제 메뉴의 갱신·실패 DOM |
| AC25 | 읽기/열기/제어 실패는 올바른 제목·상세의 토스트 1건, 자동 read 실패 중복 0, 타 세션 지각 실패 0이다. | useNativeResources.test 실제 hook→errorToastStore, 메뉴 클릭→API 실패→토스트·재조회 |
| AC26 | user/project/local의 정확한 경로 범위와 각각의 installPath가 유지된다. | configured-resources.test 실제 registry·하위/형제/중첩 git cwd·같은 key 다중 설치; plugin-catalog.test 활성 선택·scope |
| AC27 | registry 삭제 및 project/local enabledPlugins 변경을 새 조회/spawn에 반영하며 성공한 빈 설치 목록은 이전 목록을 지운다. | configured-resources/plugin-catalog/adapter.native-plugins 파일 변경; session-resources live 합성/폴더 권한; useNativeResources disconnected 최신 inventory 교체 |

### V / §10

| Pair | 노드 / requiredness | production 경로 | 자리별 oracle |
|---|---|---|---|
| VP-24 | R24~27↔AT24~27 NEW REQUIRED | registry/settings→reader→handler→hook→메뉴/토스트 | AC24~27의 실제 파일·IPC·DOM·store 결과 |
| VP-25 | SD06↔ST06 NEW REQUIRED | refresh/click→실패 토스트→자동 read→scope 교체 | hook read/open/toggle·재조회 및 지각 실패 테스트 |
| VP-26 | AR07↔IT07 NEW REQUIRED | configured 포트→bootstrap→handler authority DTO→hook snapshot | bootstrap.native-history·session-resources·useNativeResources |
| VP-27 | MD08↔UT08 NEW REQUIRED | 설치 scope/경로→메뉴 전체 설치·runtime 우선 설치 | configured-resources·plugin-catalog 실제 파일 oracle |
| VP13~14,16~17,19~23 | REGRESSION | 기존 reader/명령/spawn/재진입/폴더 경로 | 해당 기존 테스트. M2/M3 유지 |
| VP01~12,15,18 | NOT_REQUIRED | 이번 변경이 닿지 않은 진입/브랜드/OpenCode 명령 dispatch | r1.5 이전 관측 승계 |

EP22 고정 8자리: ①registry scope와 설치 경로 선택 ②configured reader 설치/상태/폴더 projection ③bootstrap 지원/미지원 inventory 구별 ④handler inventory/live 합성과 폴더 resolver ⑤authority DTO→hook 이전 plugin 제거 ⑥hook read/open/toggle 오류 보고 및 재조회 ⑦케밥 component 안내 제거 ⑧케밥 submenu의 loading/error/empty 안내 제거. 검색: `rg -n 'selectClaudePlugins|installedClaudePlugins|configuredResources|nativeResources|openNativePlugin|setNativeResource' app/src`의 선언·재수출·테스트를 제외한 위 경로를 대조한다.

①②는 configured-resources/plugin-catalog의 실제 설치 파일과 반환 ID/path, ③은 bootstrap.native-history의 등록 callback 결과, ④는 session-resources의 실제 IPC·shell 인자, ⑤⑥은 useNativeResources의 실제 hook·store 결과, ⑦⑧은 실제 메뉴 렌더가 oracle이다. 메뉴는 빈 하위 목록에 빈 안내 행을 만들지 않는다. 내부 stale/refreshing 제어 잠금과 재조회는 유지한다.

기술: 설치 후보 전체와 실행용 우선 설치 선택을 같은 scope helper로 분리한다. 구성 조회 미지원은 undefined로 보존하고 성공한 inventory에 pluginsAuthoritative를 부여해 live 및 renderer cache의 삭제된 plugin 복원을 막는다. 지원되는 inventory의 폴더는 최신 registry resolver를 사용한다. 기존 DTO에 선택 필드만 더하며 경로는 계속 main 내부에 둔다.

운영 gate는 lint·typecheck 3종·관련 비DB Vitest·build·harness boundary·inventory·카탈로그다. 신규 적대 증거 not selected: 직접 행동 oracle. 상속 M2/M3는 다시 실행한다. D26~29↔AC24~27 및 상속 활성 설정/폴더 액션 대조: 충돌 0. 사용자 마지막 예시는 외부 CLI/settings 변경의 반영으로 해석하며 추가 메뉴 동작 여부는 비동기 확인 중이다.

### ΔV8 사용자 답변 — 세션 플러그인 활성 제어

사용자: “native plugin을 켜고 끄는 (설치/삭제) 방법을 설명한 것이다. 실제 어떻게 구현할지는 너의 재량이며, settings.json을 파일시스템이 아닌 런타임에서 관리할 수 있다면(claude-agent-sdk가 이를 지원한다면) 그렇게 하도록 하라”. SDK의 applyFlagSettings/reloadPlugins와 실제 CLI를 확인했다. local plugin root는 `name@inline` 키로 껐다 켤 수 있고, 원래 marketplace key로는 local root가 꺼지지 않았다.

D-30 ACTIVE: 플러그인 이름 클릭은 installPath 폴더를 연다. 실행 중 Claude에서 지원되는 설치에는 별도 세션 활성 제어를 제공하며 applyFlagSettings→reloadPlugins로만 바꾼다. 실제 설치/삭제·설정 파일 쓰기는 하지 않는다. D-20의 토글 금지를 이 제어에 한해 대체한다. D-23·AC20·EP18의 비활성 root 제외는 초기 inline 플래그로 CLI의 플러그인 로드·명령을 제외하는 계약으로 대체한다. 비활성 설치 경로와 스킬 허용 이름은 세션에서 나중에 켜기 위한 후보로 SDK에 전달하지만 초기 실제 로드/명령에서는 제외한다. 실행 채널 부재/미지원일 때 폴더 열기는 유지하고 활성 제어는 제공하지 않는다.

AC28: 최초 spawn에 범위 내 설치 roots와 초기 비활성 inline flag를 함께 전달해 비활성 plugin의 실행을 막는다. 독립된 제어 클릭은 folder를 열지 않고 해당 plugin만 껐다 켜며 SDK reload 반환의 실제 plugin/commands를 사용한다. sibling flag·Orca 주입 스킬·generation fence와 실패 토스트/재조회는 유지한다. 실제 CLI probe 및 adapter.native-plugins/native-resources/menu/hook 테스트가 직접 oracle이다.

EP23 고정 5자리 추가: ①catalog 전체 설치 roots/skills·초기 inline flag ②adapter spawn 옵션·native 제어 전달 ③native resources의 applyFlagSettings/reloadPlugins·상태 관측 ④메뉴의 폴더/별도 제어 액션 분리 ⑤공유 CascadeBody의 두 독립 클릭 및 키보드 활성 경로. 검색: `rg -n 'readClaudePluginCatalog|claudeNativeResources|applyFlagSettings|reloadPlugins|secondary|nativeResourcesMenu' app/src`의 생산 경로를 대조한다. ①②adapter.native-plugins 옵션 ③native-resources 실제 Query 제어 인자·반환과 CLI probe ④⑤실제 NativeResourcesMenu/CascadeBody 클릭 및 Enter/Space·폴더 호출 구별이 oracle이다.

VP24~27 REQUIRED는 EP22 8자리+EP23 5자리로 검증한다. 실패는 SDK 상태를 재조회하며 낙관적으로 성공 표시하지 않는다. 이 제어의 범위는 현재 실행 채널이며 새 spawn은 최신 native 활성 설정을 따른다. 설정 파일에서 native 상태를 바꾸는 예시는 그대로 지원한다. 사용자 답변으로 미결 해소, ACTIVE D30↔AC28 대조 충돌 0, READY.

## [구현자 기입] r1.6 설계 리뷰

사용자 요청과 답변을 ΔV8로 확정했다. 폴더 액션은 유지하고 별도 SDK 세션 제어를 추가했으며, 비활성 후보 root와 실제 CLI 로드의 구분도 설계에 명시했다. 미해결 PLAN_GAP 없음, 독립 verify는 수행하지 않았다.

## [구현자 기입] r1.6 강제 지점 전수와 V-pair 자기확인

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 자리별 oracle 좌표 | 운반 항·이번 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP24·27 | scope/설치 projection | EP22 ①② | 2/2 | configured-resources.test: lists every applicable install…; plugin-catalog.test: excludes local installs… | user/project/local 3개 경로, child/nested git/형제 경계, 비활성·삭제·installPath 각각 관측 | 없음 |
| VP24·26 | 지원/합성/폴더 경계 | EP22 ③④ | 2/2 | bootstrap.native-history.test: reads native configuration…; session-resources.test: treats a fresh registry… / opens only a resolved… | OpenCode 미지원 undefined, Claude 성공한 빈 배열, live 삭제 항목 제거·삭제 후 제어/폴더 거부·shell 인자 | 없음 |
| VP24~26 | cache/실패/안내 | EP22 ⑤⑥⑦⑧ | 4/4 | useNativeResources.test: reports load errors once… / separates plugin folder clicks… / opens a plugin directory…; nativeResourcesMenu.test: distinguishes loading… | offline 최신 빈 inventory로 plugin 제거, 지각 실패 toast 0, 자동 read 실패 중복 0, read/open/control 토스트·안내 DOM 부재 | 없음 |
| VP24~27 | SDK 후보/초기 flag/위임 | EP23 ①② | 2/2 | adapter.native-plugins.test: loads enabled native skills… / carries plugin controls…; smoke-native-plugin-skills.mjs 초기 비활성 CLI | 신규/재개 roots·허용 이름, 초기 false가 실제 명령 제외, provider sibling flag·generation 보존 | 없음 |
| VP24~27 | SDK runtime 제어 | EP23 ③ | 1/1 | native-resources.test: applies session-only inline flags…; smoke-native-plugin-skills.mjs | native off/on·sibling 유지·실패 rollback, 실제 CLI 명령 제거/복원·설정 파일 불변 | 없음 |
| VP24~26 | 독립 클릭·키보드 | EP23 ④⑤ | 2/2 | useNativeResources.test: separates plugin folder clicks…; 실제 Chromium Space/클릭 | folder 호출 1, plugin write distinct, Enter 실패 toast 1. 브라우저 Space off·두 테마 sibling 버튼/폭 확인 | 없음 |

이번 신규 자리 검산: EP22 8 + EP23 5 = 13/13. `rg -n 'selectClaudePlugins|installedClaudePlugins|configuredResources|nativeResources|openNativePlugin|setNativeResource|readClaudePluginCatalog|claudeNativeResources|applyFlagSettings|reloadPlugins|secondary|nativeResourcesMenu' app/src`를 production 선언/재수출/테스트와 분리해 위 registry·bootstrap·handler·hook·menu·SDK 경로에 매핑했다. 새 운반 경로와 고정 목록의 차집합은 []이며 전칭 민감도는 상속 M2/M3와 실제 파일/IPC/브라우저 입력으로 확인했다.

| Pair | requiredness | 자기 결과 / 근거 |
|---|---|---|
| VP24~27 | REQUIRED | SELF_PASS — 위 13자리 직접 결과 |
| VP13~14,16~17,19~23 | REGRESSION | SELF_PASS — reader·adapter·bootstrap·handler·runtime·preload·Composer·메뉴 관련 회귀, CLI skill 확장 및 M2/M3 재실행 |
| VP01~12,15,18 | NOT_REQUIRED | 기존 보고 관측 승계. 이번 변경에서 nav/브랜드/모델 선택/OpenCode command dispatch를 다시 검증했다고 주장하지 않음 |

## [구현자 기입] r1.6 이번 라운드 수정의 잠금

| 증거 | 출처 | 이번 관측 | 복원 |
|---|---|---|---|
| M2 | 상속 MCP/plugin 목적지 반전 | nativeResourcesMenu 3 failed/3 | 원본 bytes 복원 후 3/3 |
| M3 | 상속 스킬/MCP 목적지 반전 | attachMenuModel 1 failed/8 | 원본 bytes 복원 후 8/8 |

분모 검산: 선택 증거 2 · 인용 변이 0 · 새 구조/배선 proxy 0 = 표 2행. 나머지는 실제 함수·파일·IPC·컴포넌트·CLI·브라우저 결과의 직접 oracle이다.

## [구현자 기입] r1.6 Product/UX 파생 검토

| 상황 | 사용자 결과 / 확인 |
|---|---|
| 목록 안내 제거 | 케밥은 제목·실제 행·행 상태만 표시. 실패/부분 조회는 전역 오류 토스트, Composer 안내 계약은 유지 |
| 플러그인 켜기/끄기 | 현재 실행 채널에만 적용. 파일/설치 삭제 없이 runtime 변경하며 다음 spawn은 최신 native 설정 사용 |
| 재진입·삭제 | 조회 중 목록 유지/제어 잠금. 성공한 registry가 삭제를 확정하면 live/이전 snapshot이 복원하지 않음 |
| 폴더와 제어 | 이름 클릭은 폴더 열기, 별도 버튼은 session write. 실제 브라우저/DOM 테스트에서 호출을 구별 |
| 긴 라벨·좁은 폭 | MenuItem truncation과 secondary 폭을 유지. 두 테마·640px에서 가로 overflow 없음 |

## [구현자 기입] r1.6 놓친 잠재 문제 + 대응

| 문제 | 대응 / 관측 |
|---|---|
| marketplace flag로 SDK local root를 끄지 못함 | 실제 CLI probe에서 name@inline 적용/명령 제거를 확인. 초기 상태와 runtime 모두 동일 키 사용 |
| applyFlagSettings가 enabledPlugins 전체 객체를 교체 | 초기 provider/native sibling flags를 보존해 전달. adapter/native-resources 직접 테스트 |
| SDK 적용 뒤 reload 실패 | 이전 flag 재적용·reload를 시도하고 실패를 반환. UI가 성공 선반영하지 않고 재조회. rollback 테스트 |
| 설치 제거 뒤 이전 live 경로/권한 사용 | 최신 지원 inventory에 없는 플러그인의 합성·폴더·제어를 거부. handler 직접 테스트 |
| secondary의 w-full로 라벨이 가려짐 | 브라우저에서 발견, w-auto! 수정 후 라벨/제어·overflow 재관측 |
| 일부 원천 실패가 안내 제거 뒤 숨겨짐 | 초기 read의 partial도 loadFailed 토스트. 실패 후 자동 read는 원래 클릭 토스트와 중복 보고하지 않음 |

상태 저장은 기존 창 수명 snapshot을 유지한다. 만료 축은 매 재열기 재조회, 공유 축은 session/backend key, 재진입 축은 epoch, 다른 무효화 축은 pluginsAuthoritative 및 generation으로 확인했다. 실제 설치/삭제나 native 설정 파일 쓰기는 추가하지 않았다.

## [구현자 기입] r1.6 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 | 안내 제거·오류 토스트, scoped 설치 전체/실행 후보 분리, 최신 inventory 합성·폴더 검증, SDK 초기/session flags·reload, 독립 제어 및 관련 테스트/계약/fixture |
| 실행 명령 / 관측 | [validation r1.6](evidence/validation.md). 관련 회귀와 실패 기대값 정정 재실행, 최종 집중 테스트·타입3종·lint 오류0/기존경고4·build·CLI·문서/경계 통과 |
| V-pair / 강제 지점 | REQUIRED VP24~27 SELF_PASS, 신규 EP22/23 13/13. 위 상속 회귀 SELF_PASS |
| 한계 | 브라우저 IPC는 fixture, OS 열기는 shell mock. 실제 CLI는 loopback API이며 외부 모델/Windows OS 실기는 수행하지 않음 |
| 대상 커밋 | (r1.6 구현 — INDEX 정본, 검증자 기입) |

| AC | 자기보고 / 관측 |
|---|---|
| AC1~19 | ✅ 이전 비영향 기록 승계 + 위 메뉴/범위/재조회/폴더 변경 회귀. 안내·플러그인 제어는 D26·30의 대체 계약 적용 |
| AC20~23 | ✅ adapter 옵션·초기 비활성 CLI·native 명령/스킬·실제 CLI 본문/인자 확장 |
| AC24 | ✅ 모든 케밥 목록 안내 제거, 실제 행·툴팁 유지 |
| AC25 | ✅ read/partial/open/control 토스트·자동 read 중복 방지·타 세션 지각 실패 폐기 |
| AC26 | ✅ scope 경계·모든 해당 설치·각 installPath resolver |
| AC27 | ✅ 최신 registry/settings와 삭제 반영·stale/live 복원 방지 |
| AC28 | ✅ 초기 비활성/실제 runtime off/on·독립 클릭/키보드·설정 파일 불변 |

검산: ✅28 · ⚠️0 · ❌0 = 현재 AC28. 이번 신규 AC24~28은 5/5이며 이전 비영향 AC는 출처가 있는 기록을 승계한다. 독립 verify PASS를 선점하지 않는다.

## [구현자 기입] r1.6 Review Signals

- r1.6은 사용자 요구 변경 턴이며 독립 verify 전이다.
- 이전 runtime-only 또는 이전 snapshot 유지 계약만으로는 최신 설치 삭제/정확한 local scope를 보장하지 못해 inventory authority를 추가했다.
- 메뉴 오류를 내부 issue로만 저장하던 경로는 실제 전역 toast store와 브라우저 host까지 연결했다.
- SDK 지원 여부는 문서 타입과 실제 bundled CLI를 함께 확인했다. 환경 기인 테스트 실패는 없었다.


### ΔV8 보완 — 첫 전송 전에도 항상 노출

READY. 사용자 AC26의 “항상 노출”은 sessionId가 없는 초안도 포함한다. 기존 ΔV7의 초안 items=[]/폴더 열기 sessionId 필수 부분을 대체한다. 케밥이 backend/cwd/projectId로 구성 목록을 읽고, 초안 폴더 열기는 같은 strict scope+pluginId로 main에서 installPath를 해석한다. 경로를 renderer에 보내거나 세션 생성/설정 쓰기를 하지 않는다. 초안의 활성 제어는 runtime이 없으므로 제공하지 않는다.

EP24 고정 7자리 추가: ①ChatTitleBar cwd/project→NativeResourcesMenu ②메뉴 draft→hook 조회/열기 ③공유 strict read/open union→preload/sessionApi ④handler draft 구성 합성 ⑤handler draft 폴더 검증 ⑥bootstrap draft inventory scope→module ⑦bootstrap draft directory scope→module. 검색: `rg -n 'NativeResourcesMenu|NativeResourcesRequestSchema|OpenNativePlugin|draftResources|draftPluginDirectory|registerSessionResourceHandlers' app/src`의 생산 경로를 대조한다.

①②는 ChatTitleBar.native-resources/useNativeResources 실제 초안 cwd 변경·클릭, ③은 preload/index 및 handler strict union, ④⑤는 session-resources 실제 metadata/OS path 인자, ⑥⑦은 bootstrap.native-history의 실제 module reader/cwd/설치 fixture가 직접 oracle이다. VP24·26 REQUIRED에 추가하며 이번 신규 분모는 13+7=20이다. AC26·27의 초안 범위를 닫는 계약 보완이며 새 사용자 결정·신규 의존성은 없다.

## [구현자 기입] r1.6 초안 보완 — 설계 리뷰

“항상 노출”의 새 대화 진입점을 EP24로 먼저 확정하고 구현했다. sessionId가 없는 초안도 범위에 맞는 설치 목록과 폴더 열기를 제공하며, runtime 쓰기는 저장 세션의 기존 generation 계약만 허용한다. 미해결 PLAN_GAP 없음.

## [구현자 기입] r1.6 초안 보완 — 강제 지점 전수와 V-pair 자기확인

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 자리별 oracle 좌표 | 운반 항·관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP24·26 | 제목줄 scope | EP24 ① | 1/1 | ChatTitleBar.native-resources.test: discovers installed resources from the draft cwd… | null session, /draft-work→/draft-work/child, draft-project가 IPC에 도착 | 없음 |
| VP24·26 | 메뉴/hook 읽기·열기 | EP24 ② | 1/1 | useNativeResources.test: opens an installed plugin in a draft…; 실제 Chromium 첫 전송 전 메뉴 | backend/cwd/projectId+id 전송, 실패 자동 read·토스트 1, write 0 | 없음 |
| VP24·26 | strict transport | EP24 ③ | 1/1 | preload/index.test: native resource transport; session-resources.test: lists draft installations… | saved/draft의 서로 다른 ID/scope 보존, 혼합 sessionId/path reject | 없음 |
| VP24·26 | 초안 합성·폴더 검증 | EP24 ④⑤ | 2/2 | session-resources.test: lists draft installations… | plugin canToggle=false, pluginsAuthoritative=true, realpath→shell 인자, lookup 0 | 없음 |
| VP24·26 | main scope 해석 | EP24 ⑥⑦ | 2/2 | bootstrap.native-history.test: reads native configuration… 실제 등록 callback | 명시 cwd/프로젝트 기본 cwd→실제 module reader/설치 폴더. 상대 경로 거부 | 없음 |
| VP24~27 | 기존 ΔV8 | EP22/23 | 13/13 | 위 r1.6 자리별 oracle + saved/draft 경로 8파일79케이스 | saved 목록·제어·폴더/오류 경로 회귀. adapter/CLI의 비영향 증거 승계 | 없음 |

최종 신규 자리 검산: 13+7=20/20. EP24 검색 결과를 titlebar→메뉴→hook→API/schema→handler→bootstrap module에 대조한 운반 자리 차집합은 []다. VP24~27 REQUIRED 및 상속 회귀는 SELF_PASS, 비영향 VP의 이전 관측 승계를 유지한다.

## [구현자 기입] r1.6 초안 보완 — 이번 라운드 수정의 잠금

M2/M3는 위 원본 복원 뒤의 관측을 유지한다. 새 초안 7자리는 실제 파일/등록 callback/IPC/렌더/브라우저 결과를 직접 관측하므로 선택 변이 없음. 이번 보완의 추가 선택 증거0·인용 변이0·구조 proxy0=잠금 추가0행.

## [구현자 기입] r1.6 초안 보완 — Product/UX 파생 검토

첫 전송 전에도 user/해당 project/local 설치를 표시한다. 초안에는 활성 제어가 없고 폴더 열기는 유지한다. cwd/projectId 변경 시 hook epoch가 이전 응답을 폐기하며 목록 조회가 세션 생성이나 CLI 실행을 유발하지 않는다.

## [구현자 기입] r1.6 초안 보완 — 놓친 잠재 문제 + 대응

| 문제 | 대응 / 관측 |
|---|---|
| null session으로 읽기/열기 생략 | draft scope를 titlebar→hook→main에 운반. 실제 초안 클릭/경로 변경 테스트 |
| renderer가 폴더 경로를 지정할 위험 | strict scope+id, main의 registered installPath만 사용. path/session 혼합 요청 reject |
| runtime 없는 초안에 활성 제어가 보임 | main의 draft 항목 canToggle=false, hook write guard 유지. 실제 브라우저에서 초안 switch 부재·폴더 요청 확인 |

## [구현자 기입] r1.6 초안 보완 — 구현 보고

[최종 관측](evidence/validation.md)에 8파일79케이스와 브라우저 draftInventory/draftFolder=true를 추가했다. 신규 자리는 최종20/20, AC24~28은5/5이며 누적28건의 이전 비영향 관측을 승계한다. 새 IPC 요청은 읽기/폴더 열기 범위만 확장하며 인증·설정·DB에 쓰지 않는다.

검산: ✅28 · ⚠️0 · ❌0 = 현재 AC28. 이전 보고의 13/13 신규 분모는 EP24 추가로20/20이 되었으며 독립 verify는 대기다.

## [구현자 기입] r1.6 초안 보완 — Review Signals

같은 사용자 요구 턴 r1.6이다. 저장 세션만 보던 호출부의 null guard가 “항상 노출”을 막았으므로 조회/폴더 양쪽에 초안 경로를 추가했다. 테스트 자체가 실제 production 진입점을 포함하도록 titlebar와 bootstrap callback까지 확장했다.


## ΔV9 — 빈 메뉴 차단·프로세스 상태 유지·비동기 상태 공 (r1.7)

READY. 사용자 추가 요구는 빈 MCP/플러그인의 회색 비활성 표시와 확장 차단, nav 이동 중 실제 하네스 exit 전 상태 유지, MCP 공식 로고, 공 내부 spinner와 메뉴 전체 잠금 제거, 제목 아래 상태 문구 대신 제목 왼쪽 상태 공이다.

| 결정 | 상태 | 계약 / 대체 |
|---|---|---|
| D-31 | ACTIVE | 목록이 없는 MCP/플러그인 그룹은 회색·disabled이며 hover/클릭/키보드로 하위 패널을 열지 않는다. 로딩/오류에서 실제 목록이 없을 때도 동일하다. D-26의 빈 확장 패널을 대체한다. |
| D-32 | ACTIVE | 상태와 진행 작업은 창의 session/backend 및 실제 provider generation에 귀속한다. nav/메뉴 언마운트·재열기·재조회 시작은 연결 상태/활성 상태를 초기화하지 않는다. 프로세스 종료/교체는 현재 generation을 폐기하고 구성 상태로 다시 확인한다. 기존 갱신 중 강제 readOnly 및 unmount 결과 폐기 정책을 이 범위에서 대체한다. |
| D-33 | SUPERSEDED | 제목 왼쪽 공은 연결/활성 초록, 인증/대기 노랑, 비연결/설정/설치/비활성 회색, 실패 빨강으로 표시한다. 제어 가능 공은 독립된 비동기 버튼이며 처리 중 공 안에서 spinner를 표시한다. 해당 항목만 중복 입력을 막고 다른 메뉴/항목은 계속 사용한다. 제목 아래 상태 문구와 native 우측 스위치는 제거하며 폴더 이름 클릭은 유지한다. |
| D-34 | ACTIVE | MCP 그룹 아이콘은 modelcontextprotocol 공식 repo의 SVG 마크를 currentColor로 재사용한다. 플러그인 그룹은 기존 플러그 아이콘을 유지한다. D-20의 동일 아이콘 문장을 대체한다. |

| AC | 관측 기준 / 직접 oracle |
|---|---|
| AC29 | 빈 두 그룹은 회색 disabled, 모든 입력에서 확장 0. 실제 목록 도착 후 사용 가능. cascadeMenuState/CascadeMenu/nativeResourcesMenu 및 실제 titlebar 테스트 |
| AC30 | A→B→A·재열기·진행 중 nav 이탈에서도 같은 generation의 상태·작업 결과를 보존. terminated/새 generation 뒤 이전 결과 미적용. native store/hook·main generation fallback·실제 SessionRuntime 종료 테스트 |
| AC31 | MCP 공식 SVG 마크와 플러그인 기존 마크 구별. Icon/nativeResourcesMenu 실제 SVG oracle 및 두 테마 브라우저 |
| AC32 | 공 클릭→해당 공 spinner, API pending 중 다른 항목 사용 가능, 중복 동일 항목 0, 성공/실패 토스트·자동 재조회 보존. native hook/Cascade 실제 클릭과 handler SDK mutation 직렬화 oracle |
| AC33 | 제목 아래 상태 텍스트/우측 native 스위치 없음. 모든 status의 왼쪽 공 색·accessible label·tooltip, Enter/Space와 축소 모션 확인. nativeResourcesMenu/Cascade/브라우저 직접 결과 |

VP28(R29~33↔AT29~33), VP29(SD07↔ST07), VP30(AR08↔IT08), VP31(MD09↔UT09)는 NEW REQUIRED다. 경로는 native metadata→main generation/cache→window store→hook→native projection→Cascade 상태 공/disabled submenu다. 상속 VP13~14·16~17·19~27은 관련 경로 REGRESSION, 비영향 nav/브랜드/모델 선택/OpenCode command dispatch는 기존 증거 승계다.

EP25 고정 8자리: ①submenu disabled의 렌더·마우스·키보드 ②Cascade 공/비동기 클릭/spinner ③native 상태/빈 목록/로고 projection ④창 수명 session/backend store 구독·갱신 ⑤작업의 항목별 pending/세대/캐시 결과 ⑥terminated 이벤트로 프로세스 수명 폐기 ⑦main runtime generation별 관측 유지·쓰기 직렬화 ⑧NativeResourcesMenu hook→목록/Promise callback 운반. 검색: `rg -n 'nativeResources|NativeResourcesMenu|nativeResourcesMenu|reduceCascade|onSecondary|onSelect|background.connection' app/src/{main,renderer,shared}`의 해당 production 경로를 대조한다.

①cascadeMenuState/flow 실제 입력, ②③native menu DOM/상태별 projection, ④⑤⑥useNativeResources의 실제 두 소비자/remount/동시 작업/terminated 테스트, ⑦session-resources 실제 handler + SessionRuntime 세대/종료, ⑧titlebar/hook 실제 메뉴와 Chromium이 oracle이다. 새 구조 proxy/변이는 선택하지 않으며 상속 M2/M3는 재실행한다.

기술: 창 수명 external store가 조회/작업 결과를 소유해 언마운트가 Promise를 폐기하지 않는다. pending은 항목별로 관리한다. main은 살아 있는 동일 provider generation의 마지막 관측만 fallback으로 유지하고 SDK 쓰기는 runtime별 직렬화한다. 기존 terminated background 이벤트를 수명 경계로 사용한다. native 설정/DB/새 의존성/하네스 시작·종료 정책은 변경하지 않는다.

운영 gate는 lint·typecheck3종·관련 main/renderer/preload 테스트·build·실제 CLI/브라우저·boundary/inventory/catalog다. D31~34↔AC29~33 정합, READY.

## [구현자 기입] r1.7 설계 리뷰

SELF_PASS. ΔV9의 D31~34와 AC29~33을 기준으로 구현했다. 상태의 소유자를 hook mount에서 창의 session/backend store로 옮기고, 실제 provider generation만 수명 경계로 삼았다. 새로운 프로세스가 관측되거나 terminated가 도착하면 이전 작업·응답을 폐기한다. nav 이동과 재조회 시작은 상태를 초기화하지 않는다. 미해결 PLAN_GAP 없음.

REQUIRED는 VP28~31, 관련 REGRESSION은 VP13~14·16~17·19~27이다. 비영향 nav/모델/프로젝트 헤더/OpenCode command dispatch는 이전 관측 승계다. 운영 gate와 실제 CLI/브라우저 결과는 [r1.7 관측](evidence/validation.md)에 기록했다.

## [구현자 기입] r1.7 강제 지점 전수와 V-pair 자기확인

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 자리별 oracle 좌표 | 운반 항·관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP28·31 | disabled submenu | EP25 ① | 1/1 | cascadeMenuState.test: disabled native submenus; CascadeMenu.flow: collapses a newly empty disabled group… | mouse/hover/key 확장 0, 열린 패널 제거, 새 목록 도착 후 재사용 | 없음 |
| VP28·31 | 공·비동기 입력 | EP25 ② | 1/1 | nativeResourcesMenu.test: represents…; hook: starts different item controls…; Chromium | 왼쪽 공·색·label·spinner. 해당 공만 잠금, 다른 그룹/행 사용 가능 | 없음 |
| VP28·31 | projection·로고 | EP25 ③ | 1/1 | nativeResourcesMenu.test: maps distinct MCP and plugin lists…; empty views; Chromium 두 테마 | MCP 공식 path·plugin 플러그 마크, 빈 그룹 disabled, 상태 부제목 없음 | 없음 |
| VP29·30 | store 구독·재조회 | EP25 ④ | 1/1 | hook: shares observations…; retains pending work…; keeps observations across remount… | Composer/menu 같은 snapshot. A→B→A·재조회에서도 canToggle와 상태 유지 | 없음 |
| VP29·30 | 항목별 작업·결과 | EP25 ⑤ | 1/1 | hook: retains pending work…; starts different item controls…; keeps a new process operation… | nav 이탈 중 완료도 저장, 같은 key 중복 0, 이전 token이 새 작업을 지우지 않음 | 없음 |
| VP29·30 | 프로세스 종료 | EP25 ⑥ | 1/1 | hook: retires an inactive process…; rejects an exited generation…; SessionRuntime native generation | inactive/initial-read 종료 처리, 이전 generation 응답 거부, 새 프로세스 보존 | 없음 |
| VP29·30 | main 관측·SDK 쓰기 | EP25 ⑦ | 1/1 | session-resources.test: retains live observations…; serializes per-runtime SDK writes… | 같은 살아 있는 generation만 fallback, 변경/exit 뒤 제거. write 순서·실패 뒤 다음 실행 | 없음 |
| VP28·30 | 메뉴 callback 운반 | EP25 ⑧ | 1/1 | NativeResourcesMenu 실제 hook 렌더; ChatTitleBar.native-resources; Chromium | pending Set→메뉴 공, onSelect Promise→store. 초안/저장 목록·폴더·토스트 유지 | 없음 |

EP25 검색을 main/renderer/shared 전체에 실행해 native 생산 경로를 검토했다. nativeResources는 adapters/common·Claude·OpenCode→SessionRuntime→handler→sessionApi→store→hook→NativeResourcesMenu/Composer→native projection으로 이어진다. reducer/Cascade의 generic onSelect 형제 소비자는 같은 disabled 규칙을 쓰며 도메인 분류를 추가하지 않았다. skills/sessions/rightpanel의 일반 onSelect, i18n 사전, shared background reducer는 새 native 제어의 운반 자리가 아니며 변경하지 않았다. Icon/Status는 ②③의 실제 렌더 의존으로 별도 확인했다.

ΔV9의 고정 자리 ID와 위 source→자리표에서 읽은 ID를 각각 추출해 대조했다: plan-minus-observed=[], observed-minus-plan=[]. 신규 분모는 8/8이다. 기존 native reader/adapter/strict transport/폴더/Composer 경로는 최종 관련 회귀에 포함했고 비영향 자리는 기존 증거를 승계한다. VP28~31 및 위 관련 REGRESSION은 SELF_PASS이며 독립 verify 결과가 아니다.

## [구현자 기입] r1.7 이번 라운드 수정의 잠금

| 선택 증거 | 실제 변경 | 관측 | 복원 |
|---|---|---|---|
| M2 | nativeResourcesMenu의 MCP/plugin content 맞바꿈 | 메뉴 테스트 10 failed/11. 각 status의 종류·빈 그룹·spinner 단언이 red | 원본 바이트 복원 뒤 11/11 |
| M3 | attachMenuModel의 native 스킬/MCP 목적지 맞바꿈 | attachMenuModel 1 failed/8. 실제 배치 단언이 red | 원본 바이트 복원 뒤 8/8 |

검산: 이번 영향 경로의 선택 증거2 · 인용 변이0 · 새 구조/배선 proxy oracle0 = 잠금2행. 새 수명·동시 작업·disabled·색·키보드 검사는 실제 production API/컴포넌트 결과를 보는 직접 oracle이며 추가 선택 변이 없음. 비영향 M1의 nav backend 선택은 이전 기록을 승계한다.

## [구현자 기입] r1.7 Product/UX 파생 검토

SELF_PASS. 빈 그룹에는 회색 disabled와 확장 화살표 제거를 함께 적용했다. 공은 accessible label·tooltip으로 색 의미를 전달한다. 키보드 Enter/Space는 공 제어만 실행하고 plugin 이름 클릭은 폴더를 연다. 진행 중 공은 같은 자리에서 회전하고 reduced-motion에서는 회전을 멈춘다. 다른 그룹/항목/폴더 행은 계속 사용한다. 조회 안내나 상태 부제목을 메뉴에 추가하지 않는다.

## [구현자 기입] r1.7 놓친 잠재 문제 + 대응

| 문제 | 대응 / 관측 |
|---|---|
| 처음 조회가 끝나기 전에 프로세스 exit | 관측값이 아직 없어도 retired generation을 기록하고 재조회. hook initial-read 종료 테스트 |
| 이전 프로세스 완료가 새 프로세스 spinner를 지움 | epoch와 항목별 token을 별도로 검증. hook 새 generation 작업 유지 테스트 |
| 동시에 두 SDK 설정 변경이 enabledPlugins map을 덮음 | main에서 runtime별 검증·쓰기·재조회를 직렬화. 첫 실패 뒤에도 다음 요청 실행 테스트 |
| 빈 그룹이 되기 전 열린 패널/포커스가 남음 | render 경로와 panelItems 모두 disabled parent에서 멈춤. flow의 목록 제거·재채움 입력 테스트 |
| 여러 소비자의 중복 조회가 상태를 초기화 | 같은 window store와 stable snapshot 구독. refresh는 기존 관측을 유지. 두 소비자/재진입 테스트 |

## [구현자 기입] r1.7 구현 보고

[검증 관측](evidence/validation.md)의 gate·CLI·브라우저 결과로 자기확인했다. 최종 관련 회귀는76파일·1,207 pass·3 skipped, 타입3종 진단0, lint 오류0/기존 경고4, production build 성공이다. 공식 MCP 마크·StatusBall·Cascade의 disabled/async 동작을 컴포넌트 카탈로그에 갱신했다. IPC 문서는 같은 generation fallback·runtime 쓰기 직렬화와 초안 설치 목록의 현재 계약을 반영했다.

| AC | 자기보고 / 관측 |
|---|---|
| AC1 | ✅ 비영향 승계: r1.6 이전 Sidebar 펼침/접힘 브랜드 메뉴 관측 |
| AC2 | ✅ 비영향 승계: nav 경계/버튼 정렬·viewport 관측 |
| AC3 | ✅ 비영향 승계: backend별 새 초안·기존 세션 보존 |
| AC4 | ✅ 비영향 승계: nav key/outside 취소와 초점 복귀 |
| AC5 | ✅ 비영향 승계: 모드별 로고/문구 순서·중앙 배치 |
| AC6 | ✅ titlebar/native menu 회귀·Chromium. 우측 스위치는 D33의 왼쪽 공으로 대체 |
| AC7 | ✅ 양 adapter native DTO/비밀 projection 회귀 |
| AC8 | ✅ Claude native 제어·SessionRuntime 세대·handler 회귀 |
| AC9 | ✅ 미지원 canToggle=false UI·직접 IPC 거부 회귀 |
| AC10 | ✅ hook session-scoped late 응답·오류/offline 회귀. 결과 보관은 D32 적용 |
| AC11 | ✅ 비영향 승계: 명시 하네스/늦은 모델/새 초안 초기화 |
| AC12 | ✅ 실제 titlebar 두 backend·메뉴 연결 요약 부재 회귀 |
| AC13 | ✅ registry scoped reader·bootstrap·handler 합성 회귀 |
| AC14 | ✅ 비영향 승계: 프로젝트 헤더 backend 전환·초안 보존 |
| AC15 | ✅ hook 재진입/재열기/실패 자동 조회. 안내 제거·상태 보존은 D26·32 적용 |
| AC16 | ✅ attachMenuModel·Composer.native-menu·composerAttachMenu 실제 삽입 회귀 |
| AC17 | ✅ 비영향 command dispatch 승계. native OpenCode 목록 회귀 수행 |
| AC18 | ✅ plugin 일반 폴더 행·tooltip·strict installPath→shell 회귀. 공 제어는 D30·33 적용 |
| AC19 | ✅ 양 메뉴 수동 갱신 버튼 부재·자동 조회 회귀 |
| AC20 | ✅ Claude 초기/재개 native 후보·inline 비활성 flag 회귀, CLI 비활성 명령 숨김 |
| AC21 | ✅ catalog metadata/hidden·SDK skills allowlist 회귀 |
| AC22 | ✅ saved/draft Composer 스킬·tooltip·slash·초안 보존 회귀 |
| AC23 | ✅ 실제 CLI fixture 본문/인자 확장·runtimeToggle=true·설정 불변. 실 설치 읽기의 비영향 기록 승계 |
| AC24 | ✅ 케밥 안내 문구 부재 projection/Chromium |
| AC25 | ✅ read/partial/open/control 토스트·registry 검사와 Chromium 전역 host |
| AC26 | ✅ scoped installed_plugins reader·saved/draft strict 폴더 열기 회귀 |
| AC27 | ✅ 최신 설치 authority·삭제 반영·기존 live 복원 방지 회귀 |
| AC28 | ✅ 실제 CLI off/on, 폴더/공 독립 클릭·Space, 설정 파일 불변 |
| AC29 | ✅ disabled reducer/flow/projection, Chromium opacity=0.5·확장0 |
| AC30 | ✅ hook 21케이스의 nav/공유/terminated/new generation, main fallback·SessionRuntime 종료 |
| AC31 | ✅ 공식 SVG path·기존 plugin 마크 구별, 두 테마 Chromium |
| AC32 | ✅ 독립 pending/중복 차단·spinner·오류 회복·SDK 직렬화, Chromium requests=2 |
| AC33 | ✅ 모든 status의 색/label/tooltip·제목만 표시, Space·reduced-motion=none |

검산: ✅33 · ⚠️0 · ❌0 = 현재 AC33. 이번 신규 AC29~33은5/5이며 이전28건 중 비영향 관측을 출처와 함께 승계했다. 분모는 r1.6의28에서33으로 증가했다. plan 메타는 IMPL_DONE/r1.7, INDEX는 impl/IMPL_DONE·Claude·r1.7 검증자 기입을 재확인한다. 독립 verify는 대기다.

## [구현자 기입] r1.7 Review Signals

- r1.7은 사용자 요구 추가 턴이며 첫 구현이다. 이전 r1.6의 기능 불변식은 관련 회귀로 유지했다.
- 기존 mount 수명의 readOnly/작업 취소 정책은 이번 프로세스 수명 요구를 만족하지 않아 D32로 명시 대체했다.
- source에 동시 작업이 도입되며 SDK shallow enabledPlugins 변경의 경쟁을 발견해 runtime 쓰기 직렬화로 닫았다.
- Windows OS 프로세스 exit 실기 대신 실제 SessionRuntime 종료와 같은 renderer 이벤트를 각각 검증했다. 실행 환경에 의한 gate 차단은 없었다.

## ΔV10 — 기존 enable/disable 스위치 손잡이 내부 spinner (r1.8)

READY. 사용자 정정: “트리거 버튼은 기존의 enable/disable 버튼이다. 버튼 안에 스위치(공모양) 내부에서 spinner 효과를 주라는 의도였다.” r1.7이 왼쪽 연결 상태 공을 제어 버튼으로 바꾼 해석을 정정한다.

| 결정 | 상태 | 계약 / 대체 |
|---|---|---|
| D-35 | ACTIVE | 기존 enable/disable 스위치를 오른쪽에 복원한다. 제목 왼쪽 공은 연결 상태의 수동 표시로 유지하며 제어·spinner를 넣지 않는다. 기존 상태 색상·accessible label·tooltip은 승계한다. 비동기 요청 중 spinner는 스위치의 원형 손잡이 안에 표시하고 그 항목의 중복 제어만 막는다. 다른 메뉴·항목·플러그인 이름의 폴더 열기를 유지한다. D-33의 공 제어·우측 스위치 제거·왼쪽 spinner 부분을 대체한다. |

AC32의 spinner 위치 oracle은 “오른쪽 enable/disable 스위치 손잡이 안”으로 정정한다. AC33의 “우측 native 스위치 없음”은 폐기하고 “왼쪽 연결 상태 공과 오른쪽 활성 스위치를 구분하며 상태 부제목은 없음”으로 대체한다. AC29~31·기존 세션 수명·토스트·설치 scope·폴더 열기는 유지한다. 누적 AC는33이다.

VP28·31 REQUIRED, VP29·30 및 VP16~17·19~27 관련 UI 경로는 REGRESSION이다. EP25 고정8자리 중 ②Cascade 표시/스위치 손잡이·입력, ③native projection의 상태/제어 분리, ⑧메뉴 pending→스위치 운반이 변경된다. ①④⑤⑥⑦은 동일 계약 회귀/기존 관측을 승계한다. 새 강제 자리나 선택 변이는 추가하지 않는다. M2는 변경된 projection에서 재실행하고 M3의 비영향 기록은 승계한다.

직접 oracle은 nativeResourcesMenu 실제 DOM에서 status 표시와 스위치 위치·원형 손잡이 안 spinner·타 항목 활성, useNativeResources 실제 메뉴 클릭/Enter/Space와 독립 folder API·pending 상태, Chromium 두 테마·좁은 화면·축소 모션이다. Status의 Dot을 연결 표시로 재사용하고 Cascade의 기존 secondary 스위치 표면에 busy spinner를 합친다. 상태 store·IPC·SDK·파일 설정은 변경하지 않는다.

운영 gate는 관련 renderer 테스트·lint·web/test 타입·production build·boundary·문서 inventory/catalog 및 실제 브라우저다. main/CLI의 비영향 증거는 r1.7을 승계한다. D35↔AC32/33 정합, READY.

## [구현자 기입] r1.8 설계 리뷰

SELF_PASS. 사용자 정정 D35에 따라 오른쪽 enable/disable 스위치를 복원하고, 왼쪽 공은 수동 연결 상태 표시로 분리했다. spinner는 스위치 원형 손잡이 안에서만 렌더한다. AC32/33의 기존 해석을 ΔV10으로 먼저 정정했으며 새 AC나 PLAN_GAP은 없다.

## [구현자 기입] r1.8 강제 지점 전수와 V-pair 자기확인

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 자리별 oracle 좌표 | 운반 항·관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP28·31 | 상태·제어·spinner 표시 | EP25 ②③ | 2/2 | nativeResourcesMenu.test: shows progress inside only…; Chromium placement | 왼쪽 role=img·오른쪽 checkbox 분리, thumb>spinner 1, 상태 공 spinner0, 다른 항목 enabled | 없음 |
| VP28·31 | 메뉴 비동기 입력 운반 | EP25 ⑧ | 1/1 | useNativeResources.test 실제 NativeResourcesMenu·titlebar·Chromium | pending→secondary.busy→thumb spinner. 클릭/Enter/Space·folder·toast 회귀 | 없음 |
| VP29·30 | 수명/항목 작업 | EP25 ④⑤⑥ | 3/3 | hook21케이스 전부 재실행 | 두 소비자·A/B/A·종료·이전 세대 지각 응답 회귀 | 없음 |
| VP28~31 | empty·main generation | EP25 ①⑦ | 2/2 | reducer/flow 및 Chromium 빈 그룹; r1.7 handler·SessionRuntime 관측 승계 | 빈 그룹 확장0. main/SDK는 변경 없음 | 없음 |

검색 `rg -n 'status|secondary|ToggleIndicator|data-toggle-thumb|data-toggle-spinner' app/src/renderer/src/{shared/ui,features/chat/lib/nativeResourcesMenu.ts}`에서 native projection→Cascade→ToggleIndicator의 실제 렌더 경로를 대조했다. generic checked 표면도 같은 indicator를 쓰며 disabled/checked 키보드 경로는 기존 Cascade 검사를 통과했다. 변경 자리는 ②③⑧이며 미변경 ①④⑤⑥⑦을 포함한 EP25 분모8을 유지한다. VP28·31 REQUIRED 및 관련 UI REGRESSION은 SELF_PASS, 비영향 main/CLI·M3는 r1.7 증거 승계다.

## [구현자 기입] r1.8 이번 라운드 수정의 잠금

| 선택 증거 | 실제 변경 | 관측 | 복원 |
|---|---|---|---|
| M2 | MCP/plugin content 맞바꿈 | nativeResourcesMenu 10failed/11 | 원본 바이트 복원 뒤11/11 |

검산: 변경 경로의 선택 증거1 · 인용 변이0 · 새 구조/배선 proxy oracle0 = 잠금1행. spinner 위치·상태와 제어의 분리·동시 요청은 실제 DOM/입력 결과를 보는 직접 oracle이며 추가 변이 없음. 비영향 M1/M3는 기존 기록 승계다.

## [구현자 기입] r1.8 Product/UX 파생 검토

SELF_PASS. 기존 파란 스위치/회색 off track과 흰색 손잡이를 유지했다. 요청 중 손잡이 안 spinner만 표시하고 왼쪽 상태 공·다른 항목을 비활성화하지 않는다. 상태 부제목·목록 안내 제거, plugin 이름의 폴더 액션, 접근성 label·checked/busy와 축소 모션을 유지했다. 두 테마·640px에서 겹침/가로 overflow 없음.

## [구현자 기입] r1.8 놓친 잠재 문제 + 대응

| 문제 | 대응 / 관측 |
|---|---|
| 기존 status 분기가 secondary보다 먼저 반환해 스위치 누락 | 한 행에서 status·주 액션·secondary를 함께 렌더. DOM 형제 순서·Chromium 위치 단언 |
| spinner가 손잡이 밖으로 그려짐 | ToggleIndicator가 track/손잡이/spinner를 소유. thumb>spinner와 실제 bounding rect 포함 확인 |
| pending 중 제어 회색 처리로 spinner 흐려짐 | busy 제어만 중복 입력 차단하고 opacity 유지. 다른 항목 enabled·독립 requests=2 관측 |

## [구현자 기입] r1.8 구현 보고

[검증 관측](evidence/validation.md)의 r1.8 결과로 자기확인했다. 관련9파일90/90, 타입3종 진단0, lint 오류0/기존 경고4, production build·boundary8/8·문서 검사가 통과했다. 공 표시에는 기존 Dot, 스위치에는 Toggle 파일의 ToggleIndicator를 사용하고 컴포넌트 카탈로그·fixture 안내를 갱신했다.

| AC | 자기보고 / 관측 |
|---|---|
| AC1~31 | ✅ 위 r1.7 AC별 관측을 승계. 관련 titlebar/Composer/empty/native hook 경로는 이번9파일90케이스와 브라우저로 재확인 |
| AC32 | ✅ 오른쪽 활성 스위치 손잡이 안 spinner. 다른 항목 시작·같은 항목 중복 차단·오류 토스트/자동 조회 회귀 |
| AC33 | ✅ 왼쪽 role=img 상태 공·오른쪽 활성 스위치·부제목 없음. DOM 순서/색/label/tooltip·Space·축소 모션 확인 |

검산: ✅33 · ⚠️0 · ❌0 = 현재 AC33. AC32/33은 D35의 정정 계약이며 분모 변화는 없다. plan 메타 IMPL_DONE/r1.8, INDEX impl/IMPL_DONE·Claude·r1.8 검증자 기입을 재확인한다. 독립 verify는 대기다.

## [구현자 기입] r1.8 Review Signals

r1.8은 사용자 의도 정정 턴이다. 기존 버튼/손잡이와 새 연결 상태 공을 하나의 제어로 합친 해석이 원인이었으며 두 역할을 분리했다. 기존 수명·SDK 정책은 유지했고 환경으로 인한 gate 차단은 없었다.

## ΔV11 — 재진입 런타임 보존과 출처별 단일 목록 (r1.9)

READY. 2026-10-20 사용자 직접 수정 요청을 먼저 반영한다. 기준은 원격 `472935d7`이며 독립 verify는 이후 별도로 수행한다.

### Decision / Product & UX Contract

| 결정 | 상태 | 계약 / 대체 |
|---|---|---|
| D-36 | ACTIVE | “세션재개 후 살아있는 동안(claude.exe, opencode.exe)” 상태와 명령을 유지한다. 세션 화면 재진입의 이력 조회가 살아 있는 runtime을 폐기해서는 안 된다. D32를 강화하며 native 이력 조회 전 idle 폐기 정책을 대체한다. 실제 종료·명시 중단·삭제·capacity 정책은 유지한다. |
| D-37 | ACTIVE | 케밥의 Claude/OpenCode 제목, Composer 모델 provider 그룹, Composer 스킬/플러그인의 출처 제목 왼쪽에 기존 브랜드 로고를 배치한다. nav 플러그인은 electricalServices, 파일 추가는 Google Material Attach File SVG를 사용한다. 한국어 파일 추가 라벨은 유지한다. |
| D-38 | ACTIVE | 케밥 MCP 이름 클릭은 설정 파일을 탐색기에서 선택한다. 별도 활성 스위치는 기존 동작을 유지한다. 경로는 main이 실제 설정 선언에서 해석하며 renderer의 임의 경로는 받지 않는다. 파일 없는 runtime-only 항목은 클릭 실패 토스트로 알린다. |
| D-39 | ACTIVE | 스킬 팝업에 기존 스킬과 native plugin skill을 출처 제목으로 구분해 직접 나열한다. 출처 submenu를 폐기하고 “실행 중인 세션에서 사용할 수 있는 명령이 없습니다.” 행을 제거한다. D19의 native 배치와 exact slash·초안 보존을 유지하되 기존 0259 출처 2단 접근을 대체한다. |
| D-40 | ACTIVE | Composer 플러그인에 native MCP와 Orca MCP 및 Orca 플러그인을 출처별로 함께 나열한다. 로고는 그룹 제목 왼쪽이다. 현재 하네스가 지원하지 않는 Orca 실행 항목도 목록에는 표시하되 disabled로 구분한다. 목록 표시 때문에 새 CLI 실행·설정 쓰기·자동 전송은 하지 않는다. |

| AC | 관측 결과 / 직접 oracle |
|---|---|
| AC34 | 실제 idle SessionRuntime을 가진 세션의 반복 load는 프로세스/세대/리소스를 유지하고 cold 세션은 native 이력을 읽는다. `native-history.test` 실제 supervisor/runtime + `bootstrap.native-history.test` 실제 등록 포트, 기존 hook A→B→A/종료 테스트. |
| AC35 | 케밥·모델·출처 제목에 올바른 로고, nav 플러그 아이콘, 파일 추가 paperclip이 표시된다. 실제 메뉴/Composer/Sidebar 렌더와 브라우저 두 테마. |
| AC36 | MCP 본문 클릭은 해당 설정 파일 위치 열기, 스위치는 제어만 한다. Claude 파일 precedence·plugin manifest/file과 OpenCode JSON/JSONC 실제 선언 resolver, handler strict union→shell.showItemInFolder, hook 메뉴 클릭 테스트. |
| AC37 | 스킬의 출처는 비선택 제목이고 모든 항목이 같은 패널에 있다. native 명령 이름/tooltip/초안 보존, 빈 native 명령 문구 부재. `attachMenuModel`·`Composer.native-menu`·`CascadeMenu.flow` 실제 입력. |
| AC38 | native/Orca MCP와 Orca plugin이 출처별 한 패널에 표시되고 disabled MCP도 누락되지 않는다. `Composer.native-menu` IPC 응답→실제 메뉴, attachMenuModel 포함/클릭 payload·disabled 테스트. |

### Technical Design / 조사

| 축 | AS-IS | TO-BE |
|---|---|---|
| 재진입 | `native-history.ts`가 refreshNativeHistory.releaseIdleRuntime→discardRuntime 호출 | bootstrap의 peekRuntime를 read guard에 전달. 살아 있으면 기존 보관/실시간 화면 유지, native 교체는 프로세스 부재 때 수행 |
| 스킬/플러그인 | 출처 submenu와 native MCP submenu, Orca MCP 누락 | CascadeItem에 비선택 heading+ReactNode leading 슬롯. source별 flatMap, native와 Orca 별도 heading. read-only Orca catalog hook |
| MCP 위치 | 본문 toggle, plugin open IPC만 존재 | 기존 open 요청의 optional kind=mcp 확장. configured reader가 ID→선언 파일을 main 내부 보관/해석, strict scope→realpath/stat→OS reveal |
| 로고 | 기존 HarnessLogo/OrcaLogo 보유, 제목에는 텍스트만 | feature에서 로고를 조립해 shared heading leading에 주입. shared→feature 의존 없음 |

외부 근거: [OpenCode config](https://opencode.ai/docs/config/)의 JSONC·global/custom/project/.opencode 우선순위와 [Material icons](https://github.com/google/material-design-icons)의 attach_file SVG. 파일 resolver는 선언이 확인된 경로만 반환한다. 새로운 의존성·DB migration 없음.

### V / §10 고정 자리

| Pair | 노드 / requiredness | 경로 / oracle |
|---|---|---|
| VP32 | R34~38↔AT34~38 NEW REQUIRED | load→runtime 유지 및 목록→그룹→실제 클릭; AC34~38 좌표 |
| VP33 | SD08↔ST08 NEW REQUIRED | 세션 load→bootstrap guard→supervisor→native read→hook→두 메뉴; native-history·bootstrap·hook 실제 상태 |
| VP34 | AR09↔IT09 NEW REQUIRED | main resolver→strict IPC→hook→메뉴→shell, catalog→Composer→Cascade; 파일/handler/preload/Composer 실제 결과 |
| VP35 | MD10↔UT10 NEW REQUIRED | scope/file precedence·flat source grouping·키보드 heading skip; configured resources/attachMenuModel/cascadeMenuState |
| VP13~14,16~17,19~31 | REGRESSION | 기존 scope·native SDK 제어·generation·명령·snapshot·독립 스위치 oracle. M2/M3 유지 |
| VP01~12,15,18 | NOT_REQUIRED | entry 선택/배치와 command dispatch 정책은 무변경. 이전 증거 승계; 브랜드 표시만 AC35로 재관측 |

EP26 고정 목록(16자리): ①session load→refreshHistory ②bootstrap runtime 존재 포트 ③native-history busy guard ④native read의 runtime 폐기 제거 ⑤Claude MCP 선언 파일 reader ⑥OpenCode MCP 선언 파일 reader ⑦harness module→bootstrap resolver ⑧open schema/preload/API kind 운반 ⑨handler realpath/stat/reveal ⑩hook open kind/실패 재조회 ⑪케밥 본문 open/secondary toggle ⑫Composer Orca catalog 조회/재열기 ⑬Composer 기존/native 스킬·MCP·plugin 합성 ⑭Cascade heading/키보드 skip ⑮케밥/모델/출처 로고 ⑯nav/attach 아이콘.

검색: `rg -n 'refreshHistory|releaseIdleRuntime|discardRuntime|nativeResources|openNativePlugin|configuredResources|configuredPluginDirectory|nativeAttachItems|buildAttachMenu|useSkills|pluginMentionCandidates|MenuTitle|SIDEBAR_NAV' app/src -g '!*.test.*'`. 선언·타입·재수출을 제외하고 위 생산 경로에 대응한다. ①는 session.native-history 기존 load 테스트, ②③④는 bootstrap.native-history/native-history의 실제 등록 및 런타임 보존 테스트, ⑤⑥은 실제 임시 설정 파일 resolver 테스트, ⑦은 bootstrap 실제 callback, ⑧⑨는 preload/session-resources 테스트, ⑩⑪은 useNativeResources 실제 메뉴 클릭, ⑫⑬은 Composer.native-menu IPC 입력→최종 행/선택, ⑭은 Cascade flow 실제 키 입력, ⑮⑯은 Composer/ChatTitleBar/Sidebar 렌더·브라우저가 직접 oracle이다.

신규 변이는 선택하지 않는다(직접 행동 oracle). 상속 M2는 MCP/plugin 목적지 맞바꿈, M3는 스킬/MCP 목적지 맞바꿈을 새 flat 목록에도 적용한다. 운영 gate는 lint·typecheck3종·관련 비DB 테스트·build·boundary·inventory·카탈로그/문서 검사이며 실제 GUI와 mock 경계를 분리 보고한다. ACTIVE D36~40↔AC34~38 및 D35 스위치 계약 대조 충돌 0; READY.

## [구현자 기입] r1.9 설계 리뷰

SELF_PASS. 상태 초기화의 생산 경로는 화면 재진입→session load→native 이력 갱신→idle runtime 폐기였다. renderer 캐시 보존만으로는 CLI의 세션별 상태를 유지할 수 없었다. 해당 폐기 포트를 제거하고 실제 provider generation이 살아 있을 때만 이력 교체를 보류한다. 종료된 채널 객체가 풀에 남은 경우에는 원본 이력을 읽는다.

스킬/플러그인은 출처 제목 아래 단일 목록으로 조립한다. 브랜드 슬롯은 composer registry가 공통 메뉴에 전달하고 OpenCode 파일 해석은 버전 중립 진입점을 지난다. D36~40의 결과를 바꾸는 PLAN_GAP은 없다. §10의 `session.native-history` 테스트명은 실제 파일 `app/handlers/session.load.test.ts`로 정정해 실행했다.

## [구현자 기입] r1.9 강제 지점 전수와 V-pair 자기확인

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 자리별 oracle 좌표 | 운반 항·관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP32·33 | 세션 load | EP26 ① | 1/1 | session.load.test: session load IPC refreshes native history… | 실제 DB+IPC에서 refresh 뒤 보관 화면 조립, 10/10 | 없음 |
| VP33·35 | 살아 있는 런타임 보존 | EP26 ②③④ | 3/3 | bootstrap.native-history: callback 등록; native-history: preserves the real idle %s runtime…; native-sync | 양 backend 반복 재진입 3회, generation·MCP false·plugin true·명령 유지, spawn 1회·close 0회. 종료 뒤 cold read | 없음 |
| VP34·35 | 설정 파일의 실제 출처 | EP26 ⑤⑥ | 2/2 | claude/configured-resources.test: MCP declaring file; opencode/v1/configured-resources.test: JSONC scopes | 사용자/프로젝트/local/plugin 선언 파일과 JSONC 우선순위, 미선언·손상 파일 처리 | 없음 |
| VP34 | 모듈·IPC·OS 호출 | EP26 ⑦⑧⑨ | 3/3 | bootstrap.native-history: reads native configuration…; preload/index; session-resources: reveals only the resolved MCP configuration… | Claude/OpenCode 모듈 callback, saved/draft kind 전달, 임의 path·directory 거부, realpath 파일만 shell 호출 | 실제 Windows 탐색기 창은 미실기; shell 호출까지 자기확인 |
| VP32·34 | MCP 이름/스위치 분리 | EP26 ⑩⑪ | 2/2 | useNativeResources: reveals an MCP configuration from the name… | 이름은 open kind=mcp, 별도 스위치는 write. 실패 토스트·자동 조회 회귀 | 없음 |
| VP32·34 | 전체 catalog와 단일 목록 | EP26 ⑫⑬ | 2/2 | Composer.native-menu: shows all source groups directly…; attachMenu.flow/render/select; attachMenuModel | IPC→Orca/native 스킬·MCP·plugin 최종 행. 미지원·disabled 항목 유지, native exact command+초안 보존 | 없음 |
| VP32·35 | 제목의 비선택성 | EP26 ⑭ | 1/1 | CascadeMenu.flow: skips source headings…; attachMenu.flow 키보드 선택 | heading을 건너뛰어 action 실행, source submenu 없음 | 없음 |
| VP32 | 브랜드와 아이콘 | EP26 ⑮⑯ | 2/2 | Composer.harness·Composer.native-menu 로고 단언; navItems·attachMenu.render; Chromium fixture | Claude/OpenCode/Orca 로고, nav plug·Attach File. white/dark·640px 재열기 | 없음 |

EP26 합계 16/16. shell 행의 닫힘은 계획한 호출 oracle 범위이며 실제 OS 창 인수는 포함하지 않는다. 위 파일명은 `app/src/` 이하의 동명 테스트 좌표다. `rg`로 생산 소스에서 109개 참조를 다시 찾고 타입/재수출·동명 일반 MenuTitle·무변경 command dispatch를 분리했다. 실제 이력 폐기 호출의 차집합은 명시 stop(`chat-turn/index.ts`)·삭제(`bootstrap.ts`)뿐이며 화면 재진입에는 없다. 목록 밖 구현은 새 계약이 아니라 ⑦의 OpenCode facade, ⑮의 registry→sourceIcon 전달이다.

VP32~35 REQUIRED와 VP13~14·16~17·19~31 REGRESSION은 SELF_PASS. 상속 pair의 직접 좌표는 r1.7/r1.8 전수표를 유지하며 해당 native handler·hook·runtime·adapter·Composer·Cascade 테스트를 재실행했다. entry 선택과 command dispatch 등 NOT_REQUIRED 경로는 이전 관측을 승계했다.

## [구현자 기입] r1.9 이번 라운드 수정의 잠금

| 선택 증거 | 실제 변경 | 관측 | 복원 |
|---|---|---|---|
| M2 | nativeResourcesMenu의 MCP/plugin content 목적지 맞바꿈 | 11케이스 중10 failed | 원본 bytes 복원, 최종 집중 실행에서11/11 |
| M3 | AttachMenu의 nativeItems skills/mcp 목적지 맞바꿈 | 실제 Composer 6/6 failed | 원본 bytes 복원, 최종 집중 실행에서6/6 |

검산: 선택 증거2 · 인용 변이0 · 새 구조 proxy0 = 잠금2행. 변경된 Composer 정적 배선 검사는 기존 검사를 유지한 것이며, 실제 registry→controller→menu의 서로 다른 브랜드/스킬/MCP 값은 새 DOM 행동 단언으로 관측했다. 신규 runtime/file/heading 테스트는 직접 oracle이며 추가 변이는 선택하지 않았다.

## [구현자 기입] r1.9 Product/UX 파생 검토

SELF_PASS. 기존 Popover·CascadeMenu·MenuTitle·HarnessLogo·OrcaLogo를 재사용했다. 제목은 키보드 탐색 대상이 아니며 명령 선택은 기존 초안을 보존한다. 모든 Orca 항목은 OpenCode에서도 보이지만 현재 실행 미지원 상태는 disabled로 나타난다. MCP 이름과 활성 스위치를 독립 액션으로 유지하고 연결 상태 공·손잡이 spinner를 바꾸지 않았다. white/dark·640px 재열기에서 목록이 viewport 안에 있고 source 추가 submenu와 native 빈 명령 문구가 없다.

## [구현자 기입] r1.9 놓친 잠재 문제 + 대응

| 문제 | 대응 / 관측 |
|---|---|
| 프로세스가 종료돼도 풀의 객체는 남을 수 있음 | 객체 존재 대신 providerGeneration을 검사. bootstrap의 generation 없는 객체=false와 runtime 종료 뒤 cold read 단언 |
| 공통 메뉴가 하네스 registry를 직접 import | sourceIcon을 registry에서 주입. OpenCode reader도 version-neutral facade 경유. lint 경계 오류0 |
| 로컬 Claude 플러그인이 테스트 fixture에 섞임 | executable/live-control 테스트의 프로세스/명시 env를 고유 빈 설정 경로로 격리. 기존 필드 단언 유지, 두 파일24/24 |
| OS reveal API는 성공 여부를 반환하지 않음 | realpath·파일 유형·scope 검증과 호출까지 확인. 탐색기 실제 표시 성공은 보고하지 않음 |
| 파일이 없는 runtime-only MCP | 파일 경로를 추측하지 않고 안전한 오류 토스트. 설정 쓰기 없음 |
| 문서 검사에 기존 `.tmp/opencode-dev` 외부 사본 포함 | 원본 검사 실패5건을 별도 기록. 외부 사본 제외 저장소 상대 링크 차집합[] |

## [구현자 기입] r1.9 구현 보고

[검증 관측](evidence/validation.md)의 r1.9에 실행 집합·초기 실패와 정정·GUI/CLI 경계를 기록했다. production build와 타입3종 통과, 최종 lint 오류0/기존 경고4, boundary8/8, DB load10/10, 실제 Claude CLI skill 확장/토글/설정 불변을 확인했다. 관련 회귀80파일 집합과 Composer/nav38파일 집합의 실패 케이스는 수정 후 집중 실행에서 모두 green이다. 두 집합은 중복하므로 합산하지 않는다.

| AC | 자기보고 / 관측 |
|---|---|
| AC1~33 | ✅ r1.8의 AC별 관측을 승계. 관련 scope·제어·generation·source·메뉴·키보드 경로는 이번 회귀와 CLI로 재확인 |
| AC34 | ✅ 실제 SessionRuntime+supervisor의 양 backend 반복 재진입, 같은 채널·리소스·명령 보존과 종료 뒤 cold read |
| AC35 | ✅ 실제 DOM 브랜드/아이콘 단언, white/dark·640px 브라우저 |
| AC36 | ✅ 실제 설정 파일 resolver·strict IPC·main shell 호출·메뉴 이름/스위치 분리 |
| AC37 | ✅ 단일 스킬 패널·source heading 건너뛰기·정확한 native 명령·초안 보존·빈 명령 문구 부재 |
| AC38 | ✅ native/Orca MCP+Orca plugin 최종 행, disabled 항목 포함·출처 로고 |

검산: ✅38 · ⚠️0 · ❌0 = 현재 AC38. 신규5/5, 이전33은 위 관측 범위로 승계했다. 실제 Windows 탐색기 창과 설치 앱에서의 두 CLI 세션 왕복 실기는 이 자기보고의 범위가 아니다. plan 메타와 INDEX는 r1.9 impl/IMPL_DONE·Claude 검증 대기로 맞춘다.

## [구현자 기입] r1.9 Review Signals

- r1.9는 사용자 요구 추가와 GUI 재보고를 받은 턴이다. r1.7의 renderer 상태 보존 축과 같지만 main의 이력 조회가 CLI를 종료하는 경로가 기존 증거에서 빠졌다.
- D32는 프로세스 수명을 약속했지만 이전 테스트는 renderer 이벤트와 runtime 종료를 별도로 검증했다. 이번에는 실제 runtime/supervisor를 native-history에 연결하고 열린 채널의 generation·목록·재사용까지 단언했다.
- 초기 테스트 채널은 terminal 뒤 스트림까지 끝나 실제 idle CLI를 표현하지 못했다. 지속 스트림+pushTurn fixture로 교체하고 spawn1/close0을 확인했다.
- Windows 인코딩은 `python -X utf8`, DB ABI는 Electron의 Node 모드로 해결했다. 실제 설치 앱의 GUI 자동 조작은 사용하지 않았으며 독립 verify는 대기다.

## r1.10 — ΔV12: 스킬 출처 제한과 간결한 확장 목록

사용자 2026-10-20 추가 지시. 기준 r1.9 `64beff7e`. 런타임 수명·세대·설정 위치 열기·토글·브랜드 계약을 유지한다. 동일 메뉴의 후속 요구이므로 별도 handoff로 분리하지 않는다.

### Decision Ledger / Product & UX

| ID | 결정 / 출처 | 상태 |
|---|---|---|
| D41 | Composer 스킬은 현재 하네스, 해당 native plugin, Orcinus orca, lock에 등록된 ~/.agents/skills만 표시한다. 다른 하네스·알 수 없는 출처를 제외하고 동일 스킬을 중복 표시하지 않는다. 사용자 명시. | ACTIVE; D39의 전체 catalog 범위를 대체 |
| D42 | 그룹은 Claude 스킬/Claude 플러그인, OpenCode 스킬/OpenCode 플러그인, Orcinus orca 스킬, ~/.agents/skills. nav 플러그인 스킬/MCP도 같은 출처로 구분한다. nav는 세션에 종속되지 않아 양 하네스의 설정 목록을 관리한다. | ACTIVE |
| D43 | 목록 갱신 중 안내 및 partial 목록 실패 토스트를 제거한다. 기존 목록 보존·재조회·generation fence는 유지한다. 명시 제어/파일 열기 실패 피드백은 유지한다. | ACTIVE |
| D44 | Composer 플러그인은 Claude MCP/OpenCode MCP/Orcinus orca 플러그인 그룹 아래 현재 연결되어 바로 쓸 수 있는 항목 이름만 표시한다. 사용자 추가 답변: connected native MCP와 valid 인증 Orca plugin만 표시한다. 설정 등록·enabled만으로 연결을 추정하지 않는다. 연결 관측이 없는 Orca MCP도 제외한다. 설명·상태 텍스트·비활성 행 및 현재 하네스의 실행 미지원 항목을 제거한다. | ACTIVE; D40·AC38의 disabled 포함 표시를 대체 |

lock은 공식 [vercel-labs/skills](https://github.com/vercel-labs/skills/blob/main/src/skill-lock.ts)의 `~/.agents/.skill-lock.json`(XDG_STATE_HOME override 지원)의 `skills` 맵을 읽는다. lock의 source 경로를 로컬 경로로 실행/해석하지 않는다. 등록 이름과 실제 SKILL.md의 교집합만 읽고 missing/malformed lock은 빈 목록이다. 로컬 ~/.agents는 부재하여 임시 fixture로 검증한다. 원본 설정·lock 쓰기는 없다.

| AC | 관측 결과 / 직접 oracle |
|---|---|
| AC39 | 양 backend 메뉴에서 허용 출처만 표시된다. lock 등록/미등록/유실/중복을 구분한다. 실제 파일 scanner·catalog와 Composer IPC→메뉴 oracle. |
| AC40 | Composer/nav canonical 그룹명과 로고, native plugin 스킬의 plugin 그룹을 관측한다. catalog→skillsList, CustomizeList 실제 렌더, Composer exact command 선택. |
| AC41 | 갱신/partial 중 기존 목록을 보존하며 안내와 partial toast가 없다. refresh reject와 control/open 실패 회귀는 유지한다. useNativeResources·Composer 상태 전이. |
| AC42 | connected native MCP/valid Orca plugin만 실행 지원에 따라 표시한다. configured·enabled 설정만으로 연결을 추정하지 않는다. 본문은 이름만 보인다. disabled/failed/auth/configured/상대 하네스/빈 입력을 섞은 attachMenuModel·Composer·브라우저 oracle. |

### Technical Design

- main 공통 scanner에 lock 허용 목록과 명시 파일 metadata seam을 둔다. app 조립에서 Claude user/native plugin 파일, OpenCode native root, agents lock, Orca root를 합친다. deployment는 기존 root만 사용하여 catalog 조회가 실행 설정을 바꾸지 않는다.
- source identity/라벨/허용 출처를 shared 순수 계약으로 모은다. native command 이름은 보존하고 source 확인된 스킬과 MCP를 각각의 메뉴에 연결한다. OpenCode SDK skill location으로 다른 도구의 발견 경로를 제외한다.
- nav MCP는 기존 read-only native discovery IPC로 양 하네스 설정을 읽고 기존 설정 위치 열기를 재사용한다. Orca CRUD와 native read-only 행을 구분한다.
- refresh/partial는 내부 상태로 유지하되 notice 및 partial reportError를 제거한다. 실제 control/open 오류는 유지한다. feature 교차 import 없이 로고를 조립한다.
- 새 dependency, DB migration, 원본 설정 쓰기 없음.

### V / §10 강제 지점

| Pair | 노드 / requiredness | start → edges → end / oracle |
|---|---|---|
| VP36 | R39~42↔AT39~42 NEW REQUIRED | 파일/SDK→IPC→Composer/nav→선택; AC39~42 실제 메뉴/브라우저 |
| VP37 | SD09↔ST09 NEW REQUIRED | 읽기→refresh/partial→재진입→기존 목록; useNativeResources·Composer.native-menu |
| VP38 | AR10↔IT10 NEW REQUIRED | app catalog→skill IPC→양 소비처, native discovery→nav MCP; catalog·handler·CustomizeList/Composer |
| VP39 | MD11↔UT11 NEW REQUIRED | lock/출처→허용·중복 제거→그룹/유효성; scanner·native normalization·attachMenuModel |
| VP32~35 | REGRESSION | live runtime·설정 reveal·heading skip·브랜드. AC37/38 표시 범위는 AC39/42가 대체 |
| VP13~14,16~17,19~31 | REGRESSION | 변경에 닿는 native hook·adapter·IPC 회귀. M2/M3 유지 |

EP27 고정 자리(10): ①agents lock→실제 파일 ②Claude/OpenCode metadata→catalog ③bootstrap/skills IPC→양 소비처 ④OpenCode SDK 출처 분류 ⑤Composer 출처 필터·중복 제거 ⑥native skill/plugin 그룹 ⑦native/Orca MCP·plugin 유효성 ⑧nav 스킬/MCP 그룹·native reveal ⑨refresh notice/partial toast 제거 ⑩브랜드 슬롯→heading.

검색: `rg -n 'scanSkills|skillRoots|skillsList|openCodeNativeCommands|nativeAttachItems|buildAttachMenu|nativeResourcesNotice|chat.native-resources.partial|CustomizeList|nativeResources|sourceIcon' app/src -g '!*.test.*'`.
①②=임시 파일·lock/native catalog fixture; ③=app catalog/handler와 Composer IPC fixture; ④=SDK의 서로 다른 location/source fixture; ⑤⑥⑦=실제 Composer/메뉴 모델; ⑧=CustomizeList/native hook의 그룹/열기 payload; ⑨=refresh/partial/A→B→A와 toast store; ⑩=양 소비처 렌더/브라우저. 신규 직접 행동 oracle에 추가 mutation 없음; M2/M3 목적지 교환 재실행.

운영 gate는 lint·타입3종·관련 비DB tests·build·boundary·문서 inventory·UI 카탈로그다. GUI fixture와 실제 설치앱을 분리 보고한다. READY.
