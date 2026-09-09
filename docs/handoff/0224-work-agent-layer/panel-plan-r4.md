# Plan r4 — Work Composer 정책과 패널 탐색

작성: **Codex**, 2026-09-09. 상태: **plan/READY — 최종 시각 피드백 반영**. 기존 [V1](plan.md) + [ΔV2](panel-plan.md) + [ΔV3](panel-plan-r3.md)에 적용하는 **ΔV4**다. 조사 기준은 원격에 게시된 r3 구현 `20d9489d`이며 사용자 피드백 보완으로 진행한다.

# Part I — Product & UX Contract

## 1. 목표와 사용자 출처

사용자는 Work일 때 “composer에서 git 패널스택을 출력하지 않는다”, 권한을 “수동 승인, 자동 승인, 모든 승인 건너뛰기” 순으로 제공하고 “클로드 4.5 이하 및 커스텀 모델은 모두 자동 권한을 지원하지 않는다”고 요청했다. 랜딩은 `< <Task SVG> / <Terminal SVG> >` 형태와 Orca의 파란 활성색을 사용하고, 아래에 “어떤 작업을 시작할까요?”, “개발, 디버깅을 시작하세요.”를 각각 표시한다. 컨텍스트는 클릭 가능하며 Work 진행 항목 클릭은 패널 전체의 상세 단계로 전환한다.

권한 메뉴 범위는 질의 후 답변 전 기본 해석을 알렸다: Work는 세 항목, Coding은 기존 메뉴를 유지하고 자동 승인 모델 조건만 공통 적용한다. 컨텍스트는 현재 폴더만 있으므로 기존 작업 폴더와 같은 탐색기 열기로 해석한다. 사용자의 후속 지시에 따라 handoff-review는 사용하지 않고 사용자 결정 추적과 일반 plan/impl 절차만 수행한다.

## 2. Decision Ledger

| ID | ACTIVE 결정 | 출처·대체 관계 |
|---|---|---|
| D-024 | Work Composer에서 Git 스택을 mount하지 않는다. 다른 입력/승인/폴더 UI와 보유 Git 상태는 유지한다. | 사용자 1. V1 공유 Composer 중 Git 표현만 대체 |
| D-025 | Work 메뉴는 수동 승인→자동 승인→모든 승인 건너뛰기, 칩은 수동/자동/모든 승인 건너뛰기. 수동 실제값은 default, 자동은 auto_classified, 건너뛰기는 bypass다. 기존 bypass 확인을 유지한다. | 사용자 1. Coding 기존 메뉴 유지는 명시한 기본 해석 |
| D-026 | 자동 승인은 구체적 Claude 버전 >4.5에만 허용한다. <=4.5·커스텀 이름·버전 불명·선택 전은 불가. Work는 수동, Coding은 기존 편집 수락으로 강등한다. | 사용자 1. 기존 0215 Haiku 제외 정책을 대체. provider와 모델 종류는 구분 |
| D-027 | Work의 기존 plan/accept_edits/dont_ask 선택 상태는 수동으로 정착한다. 계획 요청/본문/승인 흐름은 유지하고 승인 후 Work=default, Coding=accept_edits다. | 세 Work 권한의 실제 의미를 유지하기 위한 파생. SDK 정규화 enum 축소 없음 |
| D-028 | 랜딩 토글은 장식 좌/우 꺾쇠·Todo/슬래시/Terminal로 구성하고 활성은 기존 selected 계열 파랑을 쓴다. 토글 아래 정확한 Hero 문구를 한 번 표시한다. | 사용자 2. V1 토글 외형/인사말 배치·설명 문구 대체 |
| D-032 | 꺾쇠·슬래시·SVG를 확대하고 Hero의 크기·두께를 키우며 토글의 회색 배경과 외곽선을 제거한다. 선택된 모드의 파란 강조는 유지한다. 구체 적용값은 꺾쇠 28px, SVG 36px, 슬래시/Hero 32px·bold이며 실제 화면에서 대조한다. | 최종 사용자 피드백. D-028의 형태·색·순서는 유지하고 크기/배경만 대체 |
| D-029 | 컨텍스트 폴더 클릭은 해당 세션에 저장된 폴더를 탐색기로 연다. 실패는 칩을 남기고 오류 표시·재시도를 제공한다. | 사용자 3 + 기존 CwdButton 열기 UX 재사용 |
| D-030 | Work 작업 선택은 같은 타일 전체를 상세 단계로 바꾸며 뒤로가기로 목록에 돌아간다. 진행/출력/컨텍스트의 상태와 구독은 보존하고 화면/키보드에서는 숨긴다. | 사용자 4. ΔV3 inline 상세만 대체 |
| D-031 | 세션 캐시 선택·케밥 재열기 수명은 유지한다. 선택 작업 삭제 시 목록으로 돌아가며 DB reload는 선택을 초기화한다. 질문 버튼은 상세 전환과 분리한다. | ΔV3 유지. 사용자가 요청하지 않은 닫힘 정책 변경 없음 |

ΔV3 D-018/019/021/022/023 중 위에서 대체하지 않은 동작, Work 전용 타일·출력·명시 폴더 저장, 모드 잠금·기존 입력 보존은 ACTIVE다. 일반 생성물 감지·실제 참조 추적·뷰어·SRT·OpenCode 구현은 후속이다.

## 3. 사용자 흐름

| 시작 | 표시/결과 |
|---|---|
| 새 대화/프로젝트에서 Work 선택 | 파란 Todo·Hero가 토글 아래 표시. 동일 Composer 유지, Git stack/조회는 없음 |
| Coding 선택 | 파란 Terminal·Coding Hero. 기존 Git 표시와 권한 메뉴 유지 |
| Work 권한 선택 | 수동/자동/건너뛰기 실제 모드 반영. 지원하지 않는 자동 항목은 제공하지 않음 |
| 모델 변경·구형 세션 복원 | 선택 모델과 종류에 맞게 권한 정착. 적용되지 않은 auto를 칩에 계속 표시하지 않음 |
| live 권한 변경 | 실제 live 모델을 Main에서 확인, 적용한 모드를 응답해 대상/요청 세대가 유효한 UI만 반영 |
| idle 권한 선택 | live SDK 적용 없이 선택 저장. 다음 send에서 실제 해소된 모델로 다시 강제 |
| 컨텍스트 클릭 | 저장 세션의 허용 폴더를 탐색기로 열기. 오류/없는 폴더는 메시지와 원래 항목 보존 |
| Work 작업 클릭 | 타일 전체 상세. 뒤로가기와 작업명·기존 상세 동작. 목록 섹션은 숨김 |
| 상세에서 복귀/작업 삭제 | 보존된 목록으로 복귀. 접힘·출력 더보기·폴더 상태 유지 |

## 4. Acceptance Criteria

| AC | 관측 기준 | 직접 oracle |
|---|---|---|
| AC-R4-1 | Work에서 Git UI/조회가 mount되지 않고 Coding의 기존 Git·나머지 Composer는 유지 | 실제 Composer 조립·Git 호출 대조·입력/첨부 회귀 |
| AC-R4-2 | Work 메뉴 순서/라벨·수동 실제값·위험 모드 확인, Coding 메뉴 유지 | 실제 메뉴 DOM·클릭·store 결과 |
| AC-R4-3 | Claude 4.5 경계·4.6+·날짜/1m·custom/unknown에서 동일 auto 정책 | 순수 경계 행렬 + 메뉴/reducer/Main의 적용값 |
| AC-R4-4 | 종류/모델/권한/load/send/live/계획 승인에서 UI와 적용값 일치 | renderer/store·Main/SDK 옵션·응답 순서/세션 경계 |
| AC-R4-5 | 두 랜딩의 확대된 꺾쇠·슬래시·SVG·굵은 Hero, 회색 배경 제거·파랑·정확 Hero 위치, 같은 Composer와 잠금 유지 | 실제 DOM/Chromium·슬롯 순서 단언 |
| AC-R4-6 | 저장된 Context 폴더 클릭/키보드→허용 경로 열기, 실패/재시도·경계 유지 | 실제 handler/임시 DB/디렉터리 + OS open 포트 관측, UI 오류 |
| AC-R4-7 | Work 전체 상세 전환·뒤로가기·동일 overview 상태·삭제/캐시 수명 | 실제 패널 클릭/가시성·DOM 보존·선택 상태 |
| AC-R4-8 | r3 계획/출력/질문·입력·폴더/범위 회귀, 새 패키지/일반 플랫폼 없음 | 영향 UT/IT/native 및 타입/린트/빌드 |

# Part II — Technical Design

## 5. 현재 구조와 최소 변경

| 조사 대상 | 관측과 변경 |
|---|---|
| Composer gitRow 슬롯 1곳 | GitRow가 useGitSnapshot의 유일 소비자다. agentKind 경계에서 GitRow 생성만 생략한다. sessionStarted에 대한 Coding 정책은 내부에 유지 |
| shared permission-mode/model-identity | 기존 판별은 Haiku 여부뿐이다. 구체적 Claude 버전 판별과 종류별 권한 정착·승인 목표를 순수 함수로 공유. 날짜를 minor로 해석하지 않고 [1m]은 분리 |
| 메뉴·reducer·store | 메뉴는 동일 정책으로 후보를 필터링하고 Work 전용 label/순서를 조립한다. 모델/권한/종류/load 전이 및 live 응답의 최신 대상/요청만 적용 |
| Main send/coordinator/adapter | payload 여부와 무관하게 실제 모델·종류에서 실행 권한을 정착. live는 기존 runtime의 spawnedModel 읽기만 노출하고 idle runtime 목록 API를 신설하지 않음 |
| 계획 승인 | renderer·Main은 공통 승인 목표, Main→TurnRequest는 계산된 승인 목표 값만 전달. adapter는 불투명 agentProfileKey를 파싱하지 않음 |
| AgentModeToggle + 랜딩 두 곳 | Toggle이 Hero를 함께 소유하여 두 페이지가 같은 순서를 사용. 별도 프로젝트 정보 Hero는 유지 |
| TaskContextContent→openPath | 현재 Main은 extra_dirs를 허용하지 않음. 기존 요청의 directory에 선택적 sessionId를 추가해 해당 Work 세션의 저장 extraDirs 정확 일치만 열기 허용 |
| TaskTileContent/WorkTaskProgress | selectedTaskKey가 이미 존재. overview를 숨긴 채 mount 유지하고 같은 타일에 detail 형제를 표시. 새 router/store/범용 panel stack 없음 |

### 계약·수명

- `OpenPathRequest`의 선택적 sessionId는 directory 요청에서만 사용한다. scoped 요청은 Work 세션·저장 extraDirs·실제 디렉터리를 검증하며 요청자가 임의 경로 목록을 보내지 못한다. 기존 unscoped cwd/reveal 호출은 유지한다.
- 기존 permission:setMode 응답은 적용한 `NormalizedPermissionMode`로 정밀화한다. live 모델로 강등됐으면 renderer도 반영하며 늦은 응답이 새 선택/다른 세션을 덮지 못하게 한다. idle은 다음 send에서 최종 해소 모델을 검사한다.
- `TurnRequest`에는 Main이 계산한 계획 승인 목표만 전달한다. SDK의 정규화 모드·계획 내용·자동 연속 요청은 유지하고 전송/후속 경로에 같은 값을 승계한다.
- 실제 모델명이 불명확한 별칭을 최신 Claude라고 추정하지 않는다. 커스텀 provider라도 명시된 실제 Claude 식별자는 모델 기준으로 판단한다. 외부 제품의 계정/서버별 추가 제한을 앱이 우회하지 않는다.
- 상세 전환은 overview 내부 picker·출력 구독·접힘 상태를 유지한다. 상세 진입/복귀 시 키보드 초점과 스크롤을 해당 화면에 맞추며 확대/케밥 수명은 기존 타일을 사용한다.
- 추가 파일 열기는 기존 OS 포트를 사용한다. 사용자 파일 내용 읽기·뷰어·모델 권한 쓰기를 도입하지 않는다.

외부 사실은 [Claude Code permission modes](https://code.claude.com/docs/en/permission-modes)와 설치 SDK 타입을 대조한다. 문서의 지원 모델은 Sonnet/Opus 4.6 이상 사례이며, 이번 >4.5 경계는 사용자가 지정한 Composer 선택 정책이다.

## 6. Delta V nodes / pairs

| Pair | 노드 ↔ oracle | provenance / requiredness | production path / EP |
|---|---|---|---|
| VP-R4-01 | R-R4-01 ↔ AT-R4-01 (AC1/2/3) | CHANGED / REQUIRED | kind/model→Composer Git/menu, EP1/2 |
| VP-R4-02 | R-R4-02 ↔ AT-R4-02 (AC5/6/7) | CHANGED / REQUIRED | toggle/context/task click→화면/OS, EP3/4/5 |
| VP-R4-03 | SD-R4-01 ↔ ST-R4-01 (AC4) | CHANGED / REQUIRED | model/mode/load→send/live/approval→UI/SDK, EP2 |
| VP-R4-04 | SD-R4-02 ↔ ST-R4-02 | CHANGED / REQUIRED | 상세→뒤로/삭제/cache·open 실패/다른 세션, EP4/5 |
| VP-R4-05 | AR-R4-01 ↔ IT-R4-01 | CHANGED / REQUIRED | shared policy→renderer/Main/adapter, EP1/2 |
| VP-R4-06 | AR-R4-02 ↔ IT-R4-02 | CHANGED / REQUIRED | 요청 타입/schema/preload/API→handler/DB/OS, EP4 |
| VP-R4-07 | MD-R4-01 ↔ UT-R4-01 | CHANGED / REQUIRED | version/model/kind 정착·옵션/라벨·승인 목표, EP2 |
| VP-R4-08 | MD-R4-02 ↔ UT-R4-02 | CHANGED / REQUIRED | toggle Hero 순서·선택 상세/Context UI, EP3/4/5 |
| VP-R4-09 | ΔV3 VP-R3-01/02/04/09 | INHERITED / REGRESSION | Coding 계획·Work 타일 선택·입력/범위, EP1/2/5 |
| VP-R4-10 | ΔV3 VP-R3-03/06/10 | INHERITED / REGRESSION | 질문/초안·게시/폴더 저장·계획 댓글/승인, EP2/4/5 |

선택 적대 증거는 **토글/Hero 상하 슬롯 swap 1건**이다. DOM에 두 내용이 남는 것만으로 순서를 증명하지 않고 실제 순서 단언이 역교환을 검출하는지 확인한다. 나머지는 실제 값·클릭·IPC 결과이며 새 mutation을 선택하지 않는다.

## 10. 강제 지점과 gate

| EP | 전수 대상 | 실패 의미 |
|---|---|---|
| EP1 | Composer gitRow, GitRow/useGitSnapshot, 두 랜딩/ChatTile 공용 Composer | Work 숨긴 Git 조회 지속, Coding Git 또는 입력 유실 |
| EP2 | shared version/coerce/승인 목표, 메뉴/칩, reducer kind/model/mode/load, store model/mode/live 응답, Main send/coordinator, runtime 읽기포트, TurnRequest/후속, 승인 renderer/Main/adapter | unsupported auto 실행·칩 불일치·Work 수동이 편집수락·stale 응답/승인 불일치 |
| EP3 | AgentModeToggle, agentPresentation, NewChatLandingPage/ProjectLandingPage, i18n ko/en | 순서/문구/활성색·잠금·동일 입력 인스턴스 회귀 |
| EP4 | TaskContextContent, fileApi, OpenPathRequest/schema/IPC/preload, files handler/DB 경로/OS 호출, 에러 UI | extraDirs 열기 실패, 다른 세션/임의 경로 허용, 오류 은폐/칩 삭제 |
| EP5 | TaskTileContent, WorkTaskProgress, TaskDetail, TileSection/Output/Context lifetime, selectedTaskKey/delete/load/cache, RightPanel chrome | inline 상세 잔존, 숨긴 overview 가시/포커스, 복귀 시 상태/구독 유실 |
| EP6 | plan 메타·ΔV3 대체 표기·ΔV4·INDEX·impl-r4·trailer, 현재 IPC/권한/rendering 문서 | 상태·범위·작성 주체/공개 계약 불일치 |

구현자는 각 EP의 실제 호출/분기 지점을 다시 세고 명시한 목록과 대조한다. 운영 gate는 영향 Vitest(설치 Electron ABI 유지), typecheck node/web/test, lint, production build, 실제 컴포넌트/CSS의 native 인수, inventory/prose/link, diff와 trailer 파싱이다. DB/디렉터리는 임시 실제 자원, OS 열기는 주입 포트로 관측하고 모델 실행을 새로 수행한 것으로 세지 않는다.

## 11. READY 대조

D-024→AC1, D-025→AC2/4, D-026/027→AC3/4, D-028/032→AC5, D-029→AC6, D-030/031→AC7/8을 대조했다. 기존 사용자 요청 중 대체되지 않은 r3 회귀는 VP-R4-09/10에 연결했다. Git 생성·실제 모델 권한·Context 허용 범위·상세 수명은 코드 조사로 닫았으며, 새 패키지·DB migration·별도 플랫폼 결정은 없다.
