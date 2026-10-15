# Plan — OpenCode 세션 우측 패널

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex / 2026-10-16 |
| 상태 | READY — Delta V5 설계, 구현 대기; V4 구현 이력 보존 |
| V mode / revision | Baseline V1 + Delta V2 + Delta V3 + Delta V4 + Delta V5 |
| 기준 V | Delta V5는 V1~V4 @ `940bd44edc5625f79b377b885cbe559b1d66fdb6` 상속 |
| 매핑 | PR #502, 0262 후속 |

현재 규범은 V1에 V2~[Delta V5](#delta-v5--패널-외곽행-여백활성-셸작업-메뉴)를 순서대로 적용한다. V5는 외곽·행 여백·활성 셸 요약과 타이틀 메뉴를 변경하며, V4의 상위 상세 표시·닫기 복귀와 기존 헤더는 유지한다. 구 본문과 구현 보고는 기준선 이력이며 과거의 전체 타일 메뉴 접근 보장은 V5의 작업 전용 메뉴로 대체한다.

# Part I — Product & UX Contract

## 1. 목표

OpenCode 세션의 우측에 요약 카드를 기본 표시한다. 하위 에이전트와 셸 실행을 누르면 같은 패널 안에서 목록과 상세를 탐색한다. Claude의 기존 타일 화면은 유지한다.

## 2. 사용자 요구 출처

| 출처 | 원문 / 의미 |
|---|---|
| 현재 대화 첨부 1~4 | “orca transcript 우측패널에서 확장하되 우측패널에 대한 렌더링도 claude와 opencode로 구분하라” |
| 추가 첨부 5~6 | “우측 패널에 백그라운드 프로세스도 표시되고 있음. 클릭시 패널이 전환되는 결과도 참고하라” |
| 사용자 답변 | “풀리퀘스트는 제공 x. 소스는 워크모드의 우측 패널에서 컨텍스트 기능과 같다” |
| 사용자 답변 | “세션의 셸 실행과 수신 로그를 표시” |
| 이전 합의 | OpenCode 전용 스타일, transcript 배경 유지, OpenCode 1.x 구현 격리 |

첨부는 Codex 화면의 구성·전환 참고다. 화면 속 프로젝트명·명령·오류·PR은 테스트 데이터나 실행 지시가 아니다.

## 3. Decision Ledger

| ID | 결정 | 출처 | 상태 |
|---|---|---|---|
| D-01 | OpenCode는 기본 요약 카드, Claude는 기존 타일 renderer | 사용자 | SUPERSEDED → D-07; 기본 요약은 유지하며 OpenCode도 타일로 관리 |
| D-02 | 요약 → 활성/완료 하위 에이전트 목록 → 상세 대화, 뒤로 이동은 동일 패널 | 사용자 첨부 | SUPERSEDED → D-08; 요약을 교체하는 depth 전환 폐기 |
| D-03 | 백그라운드 프로세스는 세션 셸 호출과 수신 로그의 읽기 전용 표시 | 사용자 답변 | ACTIVE |
| D-04 | PR 항목 없음. 소스는 Work 컨텍스트의 폴더·첨부·참조 자료와 기존 추가/열기 기능 | 사용자 답변 | ACTIVE |
| D-05 | transcript 배경, Claude 동작, 기존 diff·계획·artifact viewer 접근 유지 | 기존 합의 및 회귀 계약 | SUPERSEDED → D-19; 메뉴 직접 접근 보장만 후속 요구로 축소 |
| D-06 | SDK 의존 수집은 opencode/v1, 공통 이력·상태 프로토콜 재사용 | 기존 합의 | ACTIVE |
| D-07 | OpenCode 기본 요약은 `작업` 타일로 표시하고 타이틀의 타일 표시 메뉴에서 열고 닫는다 | 2026-10-15 추가 요구 | ACTIVE; D-01 대체 |
| D-08 | 요약의 패널 진입 항목은 기존 타일 패널을 열며, 다른 열린 타일과 작업 요약을 교체하지 않는다 | 같은 요구 “depth 변경이 아니라 타일패널이 열려야 함” | SUPERSEDED → D-14; 병렬 타일 추가 해석 정정 |
| D-09 | 기본 고정 항목은 변경 사항 하나. 하위 에이전트·백그라운드 프로세스·소스 그룹은 실제 하위 항목이 있을 때 노출 | 같은 요구 “그 하위 항목이 추가될때 활성화” | SUPERSEDED → D-16; 프로세스 요약의 활성 조건만 축소 |
| D-10 | 요약 케밥의 계획 팝업을 제거하고 아이콘은 미트볼로 변경 | 같은 요구 두 항목 | SUPERSEDED → D-13; 후속 사용자 답변 |
| D-11 | OpenCode 타이틀의 타일 표시 목록에서 검토·세션·작업 범주명을 제거하고 평면 목록을 사용 | 같은 요구 | SUPERSEDED → D-18; 평면 목록 유지, 항목은 작업만 |
| D-12 | 0263에서 추가한 상세 wrapper 헤더를 제거하고 기존 타일 헤더를 복원. 변경 사항의 닫기는 기존 Git 컨텍스트 헤더에 배치 | 같은 요구 “클로드 변경사항 패널 참고” | ACTIVE |
| D-13 | 작업 요약 상단의 팝업과 버튼을 모두 제거하며 미트볼 대체 버튼도 두지 않는다 | OQ-01 사용자 답변 “버튼도 제거” | ACTIVE; D-10 대체 |
| D-14 | 요약의 항목은 Work 출력물처럼 기존 패널 위에 상세 패널을 연다. 닫으면 기존 패널과 상태로 돌아온다 | 사용자 “하위에 추가되는 형태가 아니다…해당 패널 위에 새 패널…종료 시 다시 기존 패널” | ACTIVE; D-08 대체 |
| D-15 | OpenCode 요약·상세 외곽의 모서리와 테두리 두께를 Orca 기존 계획·Work 작업 보조 패널과 통일 | 2026-10-16 “border의 모양 및 굵기…다른 우측 보조 패널(계획, 작업 등)에 따른다” | ACTIVE |
| D-16 | 변경 사항만 고정. agent·source는 기존 자료 조건, process는 활성 셸이 있을 때만 그룹 노출하고 완료 항목은 요약에서 제거 | 같은 요구 “활성 중인 것만 표시한다. 완료되면 항목을 비울 것” | ACTIVE; D-09 대체 |
| D-17 | OpenCode 우측 패널의 클릭 행에 좌우 안쪽 여백을 늘려 호버 배경과 내용 사이 간격 확보 | 같은 요구 “호버시 텍스트 옆에 마진이 없는게 표시되어 미관상 별로임” | ACTIVE |
| D-18 | OpenCode transcript 타이틀 케밥의 타일 표시 목록에는 작업만 노출. 범주 제목 없이 기존 체크·토글 유지 | 같은 요구 “'작업' 외 타일은 노출하지말것” | ACTIVE; D-11 대체 |
| D-19 | Claude GUI·transcript 배경·기존 타일 지원/저장 상태·요약 상세·artifact 접근 유지. OpenCode 계획/빈 소스의 타이틀 단독 진입 보장은 제거 | D-18과 기존 보존 계약의 범위 대조 | ACTIVE; D-05 대체 |

갱신 메모: V5에서 D-05/09/11을 D-19/16/18로 대체하고 D-15/17을 추가했다. 나머지 ACTIVE 결정은 유지하며 아래 V5의 AC·pair와 대조한 결과 충돌 0이다. 0262는 하네스/Claude 회귀, 0264는 구조 분리의 정본으로 유지한다.

## 4. 비판적 검토

| 대상 / 조사 | 관측 | 의미 |
|---|---|---|
| OpenCode rightPanel.ts | visibleIds는 plan·diff, initialTile null | 기본 요약·하위 작업 없음 |
| 공통 RightPanel.tsx | 다중 열 타일·artifact viewer 조립 | 얇은 하네스 dispatcher로 바꾸고 기존 구현은 Claude 경로로 이동 |
| OpenCode v1/map.ts | root session 외 이벤트 무시 | 하위 대화 수집을 추가해야 함 |
| taskContext.ts / TaskContextContent.tsx | 폴더·참조 셀렉터, 안전한 열기와 추가 훅 존재 | 소스 기능 재사용, 독립 자료 저장소 불필요 |
| v1.19 task.ts | task metadata.sessionId/model 제공, 자식 prompt 전에 metadata 발신 | 임의 세션 열거 없이 소유 child만 연결 가능 |

소스: [OpenCode v1.19 task](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/tool/task.ts). 별도 프로세스 시작·종료·PTY 관리, PR 관리는 범위 밖이다.

## 5. 동작과 상태

| 이벤트 | 결과 |
|---|---|
| OpenCode 대화 진입 | 작업 폴더 제목, 변경 사항, 하위 에이전트, 백그라운드 프로세스, 소스 요약 카드 |
| 하위 에이전트 클릭 | 활성/완료 그룹, 이름·상태·시간 목록 |
| 에이전트 클릭 | 뒤로 버튼·이름·확인된 모델, OpenCode 도구/텍스트와 결과·오류 |
| 셸 실행 클릭 | 실행 명령·상태·수신 로그를 preformatted 본문으로 표시, 업데이트 시 수신 로그 갱신 |
| 소스 + / 모두 보기 | 기존 추가 폴더 picker / 전체 컨텍스트 목록 |
| 변경 사항 / 계획 진입 | 기존 내용 기능을 단일 패널 내에 표시, 뒤로는 요약 |
| 세션 변경 | 선택·확장 초기화, 다른 세션의 결과를 섞지 않음 |
| 빈 목록 / 출력 없음 | 명시적 빈 상태, 가짜 성공/로그를 만들지 않음 |
| 종료 / 중단 후 재진입 | 저장된 호출·결과·child parts 복원. 완료 결과가 없으면 미완료 상태 |

카드는 둥근 모서리·구분선·가벼운 아이콘·말줄임을 사용한다. 상세는 독립 스크롤이며 뒤로 버튼과 키보드 포커스를 제공한다. 밝은/어두운 테마의 시맨틱 토큰을 사용하고 긴 명령·로그가 가로 레이아웃을 밀지 않는다.

## 6. 범위

일반 OpenCode task와 Bash의 세션 내 관측을 지원한다. 이미 끝난 과거 세션에서 수집하지 않았던 child 이력을 외부 서버에서 역수입하지 않는다. 실험적 비동기 task의 부모 턴 종료 후 상시 구독 및 별도 프로세스 제어는 추가하지 않는다.

## 7. Requirements / Acceptance

| R / AC | 동작 기준 | 직접 oracle / 도달 경로 |
|---|---|---|
| R-01 / AC1 | OpenCode 세션 기본 요약, Claude 기존 renderer, PR 없음 | RightPanel.render.test: dispatcher 및 summary 렌더 |
| R-02 / AC2 | 요약→agent 목록→detail→뒤로; 다른 세션 선택 누출 없음 | Panel.render.test: 클릭/세션 변경과 표시 본문 |
| R-03 / AC3 | task의 소유 child 텍스트·도구 수집, 원본 root와 분리, 다른 session 제외 | activity.test + adapter.test: SSE→batch→parts/reducer→projection |
| R-04 / AC4 | 셸 실행 명령·상태·수신 로그, 완료/실패/빈 로그 표시 | activity.test + model.test + Panel.render.test |
| R-05 / AC5 | Work 컨텍스트와 같은 폴더/참조/추가/열기 기능 | 기존 TaskContextContent.render 및 source 회귀 + OpenCode Sources 렌더 |
| R-06 / AC6 | diff·계획·artifact 접근, 밝고 어두운 테마 및 긴 내용 | 패널 진입 렌더 테스트 + Computer Use 시각 확인 |
| R-07 / AC7 | 기존 Claude 패널·OpenCode transcript 배경·v1 경계 유지 | 기존 panel/harness 테스트, lint 및 Computer Use |

## 7-A. Baseline V

| Node | 레벨 | 계약 | provenance |
|---|---|---|---|
| R-01~07 | R | 위 AC1~7 | NEW |
| SD-01 | SD | 요약/목록/상세, 세션 격리·재진입 | NEW |
| AR-01 | AR | SDK→adapter batches→history/relay→renderer parts·background store | NEW |
| AR-02 | AR | 하네스 dispatcher→독립 renderer→공통 diff/컨텍스트 기능 | NEW |
| MD-01 | MD | child 소유권·중복 제거·부모 종료 격리 | NEW |
| MD-02 | MD | 셸·agent 투영, 결과 우선·로그 상한·상태 의미 | NEW |

| Pair | requiredness | start → edges → end / 강제 지점 | oracle |
|---|---|---|---|
| VP-01 R-01~07↔AT-01~07 | REQUIRED | 실제 dispatcher→OpenCode panel→각 클릭 화면, Claude 회귀 | Panel.render.test 및 Computer Use, AC별 좌표 위 표 |
| VP-02 SD-01↔ST-01 | REQUIRED | activeKey→선택 상태→목록/상세/복귀 (3자리) | Panel.render.test: navigate and reset on session change |
| VP-03 AR-01↔IT-01 | REQUIRED | SSE→batch, batch→공통 parts, parts→panel projection (3자리) | adapter.test: child and shell events; activity.integration.test: reducer/projection |
| VP-04 AR-02↔IT-02 | REQUIRED | dispatcher→renderer, renderer→diff/plan/context (2자리) | RightPanel.render.test 및 Panel.render.test |
| VP-05 MD-01↔UT-01 | REQUIRED | 소유권 판정→child 정규화→root 이벤트 격리 (3자리) | activity.test: unrelated, duplicate, child idle/error, resume |
| VP-06 MD-02↔UT-02 | REQUIRED | parts/background calls→목록/로그 모델 (1자리) | model.test: running/completed/error/empty/stale |

직접 행동 oracle을 사용한다. 별도 구조 proxy나 mutation을 요구하지 않는다. 운영 gate는 V의 제품 범위와 별도다.

# Part II — Technical Design

## 8. AS-IS → TO-BE

| 축 | AS-IS | TO-BE / 책임 |
|---|---|---|
| renderer | 공통 RightPanel이 하네스별 색상만 선택 | 공통 dispatcher, claude/rightpanel 기존 조립, opencode/rightpanel 독립 화면 |
| 기본 표시 | OpenCode 타일 없음 | 생성된 OpenCode 세션은 기본 요약. 기존 tile 액션은 diff/plan/subagent 상세로 연결 |
| child | root 외 SSE 무시 | v1 activity 수집기가 task metadata로 자식 등록, parentToolRunId로 공통 이력 기록 |
| 셸 로그 | 완료 tool_result만 표시 | 진행 metadata 출력은 기존 background.call journal로 기록, 완료 결과가 정본 |
| 소스 | Work 컨텍스트 전용 시각 | 동일 셀렉터·picker·안전 열기 seam 재사용, OpenCode 목록 스타일 |

## 9. 데이터 / lifecycle

v1 activity 수집기는 root mapper를 소유한다. 현재 prompt가 받아들인 task metadata의 sessionId만 child mapper에 등록하며 child tool ID는 session namespace로 격리한다. child message/도구 이벤트는 root sessionId와 부모 toolRunId로 내보내고 child idle·telemetry·오류가 root 턴을 끝내지 않도록 한다.

진행 중 Bash의 metadata.output은 background.call progress의 result로 전달한다. generation은 prompt identity, sequence는 해당 수집기의 증가값이며 중복 snapshot은 제거한다. 저장/relay는 기존 providerEvents 경로를 사용하고 UI는 최종 tool_result를 우선한다.

로그 snapshot은 마지막 64 KiB 문자로 제한하고 잘림을 명시한다. 추가 외부 조회·폴링·의존성·DB migration은 없다. 부모 턴 수명 동안만 child와 로그를 관측하며 승인 요청도 확인된 child 소유권만 통과시킨다.

선택 화면은 discriminated union으로 두고 activeKey remount로 세션을 격리한다. 크기 조정·artifact viewer는 기존 기능을 재사용한다. 소스 열기는 세션 identity와 main 파일 권한 검사를 유지하며 추가 폴더의 busy/취소/오류 동작을 그대로 사용한다.

## 10. 강제 지점 / 검증 설계

| 계약 | 언제 강제 / 자리 | 파일 / oracle | 실패 의미 |
|---|---|---|---|
| child 격리 | task 등록, child 정규화, root 종료 (3) | v1/activity.ts + activity.test | 다른 세션 혼합 또는 부모 턴 조기 종료 |
| 수집 배선 | SSE→batch, batch→parts, parts→모델 (3) | adapter.test + activity.integration.test | producer만 있고 소비 불가 |
| UI 선택 | 진입, 클릭, 세션 변경 (3) | Panel.render.test | 상세 미표시/선택 누출 |
| renderer/기능 | dispatcher, 상세 기능 배치 (2) | RightPanel.render.test + Panel.render.test | 하네스 UI 혼합/기능 접근 소실 |
| 셸 의미 | parts/background→목록/로그 (1) | model.test | 진행 snapshot이 완료 결과 덮음/빈 출력 성공 추정 |
| 소스 의미 | 기존 context selector/picker/open seam | 기존 context 테스트 + Sources.render.test | 기능 drift/안전 열기 우회 |

운영 gate: 읽기 전용 ESLint, typecheck, 관련 순수 Vitest, 문서 inventory·오류 처리 inventory·테스트 budget guard, renderer build. Electron ABI를 유지하며 native DB 테스트는 CI에 위임한다. Computer Use가 앱 창에 연결되지 않으면 실제 컴포넌트 브라우저 검증과 실앱 미검증을 구분한다.

## 11. 구현 순서 / 문서

1. 설계 별도 커밋 → v1 activity 수집 및 테스트.
2. 하네스 renderer 분리 → summary/list/detail/context → 렌더·투영 테스트.
3. 현재 architecture/IPC provider event 의미 문서 갱신 → gate/시각 검증 → 구현 보고·push.

교차 대조: D-01/AC1/AR-02, D-02/AC2~3/SD-01, D-03/AC4/MD-02, D-04/AC5, D-05~06/AC6~7 일치. 참조된 production 경로는 코드 조사로 존재 확인. 위 테스트 신규 좌표는 구현 시 실제 이름으로 보고한다.

## Delta V2 — 컨텍스트 Main 경계 보완

판정: READY. D-04와 AC5를 유지한다. 코드 조사에서 `agentSessionPolicy.code`가 폴더 추가와 컨텍스트 열기를 막는 것이 확인되었다. V1의 selector/picker 재사용만으로는 OpenCode의 기능 도달이 닫히지 않는다. 추가 IPC나 권한 우회 없이 하네스·모드 조합 정책을 공통으로 판정한다.

| Node / provenance | 계약 |
|---|---|
| R-05 / INHERITED | Work와 같은 소스 추가·열기 |
| AR-03 / NEW | picker→renderer action→Main 세션 정책→경로 검증→DB 또는 shell |
| MD-03 / NEW | OpenCode Code와 Claude Work 허용, Claude Code 기존 거부; busy·비동기 후 재검사·경로 범위 유지 |

| Pair | requiredness | 경로·강제 지점 | 직접 oracle |
|---|---|---|---|
| VP-07 AR-03↔IT-03 | REQUIRED | renderer 추가·동기화·중복 판정, Main 추가 전/후, 폴더/첨부 범위 판정과 기존 경로 검사 (7자리) | chatStore.sessionDirectory.test의 OpenCode 추가; session-directory.test의 OpenCode 저장·busy; files.contextDirectory.test의 폴더/파일 케이스의 OpenCode 열기·범위 거부 |
| VP-08 MD-03↔UT-03 | REQUIRED | backend+agentKind→공통 정책 (1자리) | agent-session-policy.test의 조합·directory identity |
| VP-01의 AC5, VP-04 | REGRESSION | Sources→공통 훅→동일 컨텍스트 의미 | Panel.render.test와 기존 context 테스트 |

§10 추가: 컨텍스트 허용 조합은 renderer 추가 액션·동기화·중복 판정과 Main 추가의 await 전/후, 파일/폴더 열기에서 동일 정책을 사용한다. Main 파일 검증의 비동기 후 호출도 같은 resolver를 재실행한다. `sessionAddDirectory`의 기존 `not-work` 오류 값은 비허용 조합의 호환 오류로 유지한다. DB에서 읽은 extraDirs는 기존 다음 턴 입력 경로를 따른다. v1 adapter는 이 경로 목록을 system context에 JSON 문자열 목록으로 넣어 모델이 참조할 수 있게 한다. VP-07의 SDK 입력 자리를 추가하며 adapter.test의 system 본문 단언으로 닫는다(전체 8자리). OpenCode의 경로 접근 승인은 기존 native permission 설정을 그대로 따른다.

V1 UI oracle 좌표 정정: 존재하지 않는 `RightPanel.render.test` 이름은 신규 `harnesses/opencode/rightpanel/Panel.render.test.ts`의 실제 dispatcher 렌더로 대체한다. VP-02의 클릭·복귀·세션 초기화는 실제 컴포넌트를 띄운 Computer Use로 관측하고, 모델 계산은 `model.test.ts`에 남긴다. SSR은 상태 전환을 실행하지 못하므로 클릭을 검증했다고 보고하지 않는다. 제품 동작·강제 지점 분모는 유지한다. 선택 적대 증거 없음 — 직접 입력과 표시 결과를 확인한다.

갱신 self-review: D-01~06 충돌 없음. AC5의 정상 추가/열기와 기존 거부 조합을 함께 검증한다. 저장 포맷·의존성 변경 없음. V1 VP-01~06 중 위 oracle 좌표만 supersede하고 나머지 계약은 상속한다.

## Delta V3 — 작업 요약과 기존 타일 동작 복원

판정: READY. 사용자의 2026-10-15 추가 요구와 후속 “버튼도 제거” 결정을 반영하며 이번 턴은 설계 문서만 변경한다. 이전 구현의 자기검증을 이 델타의 완료 증거로 승계하지 않는다.

기준선: `0263 V1+V2 @ 73681f8007c2ad9de2f89196095154558f7767c2` — `git cat-file -t`의 `commit`, `origin/codex-opencode-harness`의 동일 해시를 확인했다. 실패 verify가 아닌 사용자 요구 변경이므로 라운드는 1을 유지한다. 사용자 메시지 버블 색상은 [0262 ΔV8](../0262-opencode-harness/plan.md)에 귀속한다.

### Product / UX — 요구 매핑과 해석

| 사용자 추가 요구 | 이번 계약 / 귀속 |
|---|---|
| “사용자 메시지 버블… Claude transcript…똑같이 변경” | 0262 ΔV8; 여기서는 canvas 배경 유지 D-05를 상속 |
| “기본적으로 노출하는 메뉴는 변경사항 1개” | D-09 / AC8: 변경 사항만 고정, 데이터가 없는 그룹은 제목·빈 문구·구분선을 함께 숨김 |
| “케밥버튼 클릭시 팝업되는 메뉴를 제거” | D-13 / AC9: 요약의 계획 팝업과 버튼 제거, 계획은 기존 타이틀 타일 메뉴로 접근 |
| “타일표시에서 검토, 세션, 작업 등의 그룹명을…제거…기존 우측패널을 '작업'으로” | D-07/11 / AC1′·AC10: 범주 제목 없는 타일 목록, 작업 항목은 요약 타일 토글 |
| 변경 사항에 추가된 헤더 제거·닫기 복원 | D-12 / AC11: GitContextBar와 닫기를 기존 하나의 타일 헤더에 배치 |
| “케밥버튼을 미트볼버튼으로 변경” → 후속 “버튼도 제거” | D-10 SUPERSEDED → D-13 / AC9: 세로점·가로점 버튼 모두 제공하지 않음 |
| “depth 변경이 아니라 타일패널…뒤로가기 등의 새 헤더…모두 복구” | D-08/12 / AC2′·AC6′·AC11: 공통 타일 열기/닫기/확대 경로, 추가 wrapper 폐기 |

해석 범위: OpenCode에만 적용한다(D-004/0262). `기본`은 작업 요약 본문을 뜻하며 타이틀의 타일 선택 목록을 변경 사항 하나로 제한하지 않는다. cwd는 세션 작업 위치이므로 요약 소스 그룹을 활성화하는 새 자료로 세지 않고, 전체 소스 내용에는 유지한다.

| 상태 / 행동 | 사용자에게 보이는 결과 |
|---|---|
| 생성된 세션 최초 진입, 기록·첨부·추가 폴더 없음 | 작업 타일 안에 변경 사항만 표시. 하위 그룹과 빈 목록 문구 없음 |
| task·shell·명시적 추가 자료가 도착 | 해당 그룹만 나타나며 수신 상태·항목을 표시. 마지막 항목이 사라지면 그 그룹만 숨김 |
| 변경 사항·하위 에이전트·셸·소스 모두 보기 클릭 | 해당 타일을 열고 화면 밖이면 reveal. 작업 타일과 다른 타일의 내용/선택 유지 |
| 같은 종류의 다른 항목 클릭 | 기존 해당 타일의 선택만 변경. 타일 복제나 요약 depth 교체 없음 |
| 소스 그룹이 숨겨진 상태에서 첫 참조 폴더 추가 | 타이틀의 `소스` 타일 → 기존 + picker → 선택 성공 시 요약 그룹 표시. 취소/실패는 기존 상태 유지 |
| 타일 닫기·재열기 / 세션 전환 | 닫은 타일만 제거, 체크 상태 동기화. 열린 세션을 다시 갱신해도 닫기를 되돌리지 않음; 다른 세션의 선택을 사용하지 않음 |
| 하위 에이전트 타일 안의 목록·상세 | 원래 타일의 선택/목록 복귀 의미 유지. 요약으로 돌아가는 새 상위 헤더는 없음 |

소스의 파일·URL 열기 및 +는 기존 컨텍스트 동작을 유지한다. `타일 열기`로 바꾸는 대상은 기존에 요약 전체를 교체하던 패널 진입이며, 파일 열기를 별도의 복제 파일 뷰어로 바꾸지 않는다. PR 미제공, 로그 수집 범위·상한, child 소유권, Claude 패널은 유지한다.

OQ-01 해결: 사용자가 “버튼도 제거”를 선택했다. 요약의 계획 팝업·세로점 버튼을 제거하고 미트볼도 추가하지 않는다(D-13). transcript 타이틀의 기존 케밥과 diff의 원래 설정 메뉴는 제거 대상이 아니다.

### Acceptance Criteria — 기존 기준의 대체와 추가

| R / AC / provenance | 행동 기준 | 직접 oracle / production 경로 |
|---|---|---|
| R-01 / AC1′ CHANGED | OpenCode 세션의 기본 작업 요약이 실제 타일로 열리고 메뉴로 닫기·다시 열기 가능. Claude와 PR 미제공 유지 | `chatReducer.harness.test.ts` 초기/닫기 상태, `Panel.render.test.ts` 초기 표시, CUA-V3-01 실제 메뉴·닫기/재열기 |
| R-02 / AC2′ CHANGED | 요약 클릭은 대상 타일을 추가·reveal하고 다른 타일을 유지. 같은 타일 재선택/항목 변경과 세션 전환 안전 | `chatStore.panelTiles.test.ts` 신규 선택/타일/reveal 결과, CUA-V3-02/04 병렬 타일·항목 재선택·세션 분리 |
| R-06 / AC6′ CHANGED | plan/diff/artifact 기능과 테마·긴 로그 접근 유지, 타일 원래 제어로 확대·축소·닫기 | `RightPanelTile.actions.test.ts` 확장, CUA-V3-03/05 실제 헤더·뷰어·두 테마 |
| R-08 / AC8 NEW | cwd만 있는 상태는 변경 사항만 표시. agent/process/명시적 context 각각 0→1→0에서 해당 그룹만 나타나고 사라짐 | `model.test.ts`/`Panel.render.test.ts` 확장: task·shell·extraDirs·첨부·URL 독립 fixture와 결과 DOM |
| R-09 / AC9 NEW | 요약 상단에는 작업 위치와 본문만 있고 메뉴 버튼·계획 팝업이 없다. 계획은 타이틀 메뉴로 계속 열 수 있다 | 실제 summary DOM에서 버튼/팝업 미노출, 타이틀의 계획 클릭→plan 타일 표시 |
| R-10 / AC10 NEW | OpenCode의 타일 표시 목록은 범주 제목 없이 실제 타일 라벨·체크 상태를 표시하며 `작업`은 요약을 가리킴 | `rightPanelTiles.harness.test.ts` 정의/정책, CUA-V3-01 실제 열린 Popover 라벨·체크·클릭→타일과 Claude 회귀 |
| R-11 / AC11 NEW | diff의 Git 컨텍스트 헤더에 닫기·기존 확대가 있고 추가 back/title/expand 행은 없음. 다른 타일도 기존 헤더 하나 사용 | `rightPanelTiles.render.test.ts` 실제 헤더 구조, CUA-V3-03 헤더 안의 닫기/확대 클릭 결과 |

AC1/2/6은 위 prime 행이 대체하고 AC3/4/5/7은 유지한다. AC4/5의 패널 진입 oracle은 depth가 아닌 타일 조립 테스트로 옮긴다. 이번 유효 AC는 기존 7개와 신규 4개이며 이 턴에서는 구현 충족을 보고하지 않는다.

### 조사 / AS-IS → TO-BE

| 대상 / 검색 | AS-IS 관측 | TO-BE 책임 |
|---|---|---|
| `Panel.tsx`: `setView`, `header`, `setMenu` | 로컬 view로 summary를 대체하고 wrapper 헤더·계획 팝업 추가 | summary를 `task` 내용으로 분리. 외부 depth/menu 상태를 제거하고 공통 타일 호스트 사용 |
| `rightPanelTiles.ts`, OpenCode `rightPanel.ts` | plan/subagent/task/diff 정의; OpenCode의 taskTarget=plan, initialTile=null | OpenCode taskTarget/initialTile=task. process/source 타일은 OpenCode 정책에서만 허용 |
| `ChatTitleBar.tsx`: `rightPanelGroups` | 범주 제목과 각 타일 체크 목록 | OpenCode는 정의의 평면 목록, Claude 표시 정책은 그대로 |
| `tileRegistry.ts`, `RightPanelColumn.tsx`, `RightPanelTile.tsx` | registry는 하네스 입력 없이 공통 content 결정; diff 헤더가 GitContextBar+닫기를 조립 | registry에 backend를 전달해 전용 content 선택. 공통 열/타일/원래 헤더 기능 재사용 |
| `Sources.tsx`→`useTaskContext` | cwd도 directories에 포함, 생성된 세션의 폴더 추가는 Sources +가 담당 | 그룹 활성은 extraDirs/수집 자료로 계산. 메뉴의 source 타일은 빈 상태에도 열 수 있어 첫 폴더 추가 보존 |
| `chatReducer.ts`: `initialTile`, `activateTile`, `OPEN_SUBAGENT_TASK`; store `panelReveal` | 초기화·명시 열기·닫기/선택이 이미 세션별 상태 | 기존 수명 재사용, process 선택만 세션별로 추가. shell/child 데이터 프로토콜 변경 없음 |

타일 계약: `plan/subagent/task/diff/process/source`를 전체 정의로 삼고 Claude의 허용 집합은 현재 정책을 유지한다. OpenCode `task`는 요약, `process`는 선택된 세션 셸 실행과 로그, `source`는 전체 컨텍스트다. 새 ID는 renderer 세션 UI 상태이며 DB/IPC/native API 계약을 추가하지 않는다.

공통 타일 layout/chrome을 하네스 중립 조립으로 재사용하고 content/header registry만 backend로 선택한다. OpenCode가 Claude 전용 디렉터리를 import하는 방식은 사용하지 않는다. 기존 native subagent 목록 복귀는 타일 헤더 내용으로 유지할 수 있으나 0263의 요약 복귀용 wrapper는 제거한다.

닫기는 해당 타일의 선택만 정리하고 다른 타일·다른 세션의 상태를 보존한다. root 세션 첫 진입은 task를 열되 사용자 닫기 후 reload/후속 턴에서 강제 재개방하지 않는다. artifact viewer의 origin 포커스·가로 스크롤·숨겨진 타일 상태 보존은 기존 공통 경로를 그대로 사용한다.

### V registry / supersede와 회귀

| Node | provenance / 계약 |
|---|---|
| R-01/02/06, AT-01/02/06 | CHANGED — 위 AC1′/2′/6′ |
| R-08~11, AT-08~11 | NEW — 조건부 그룹·팝업/버튼 제거·평면 메뉴·헤더 |
| SD-01 / ST-01 | CHANGED — 로컬 depth 대신 타일 열기/선택/닫기/세션 격리 |
| AR-02 / IT-02 | CHANGED — dispatcher→하네스 registry→공통 열/타일→전용 본문 |
| MD-04 / UT-04 | NEW — 요약 그룹 유무와 하네스별 tile target/initial/visible 계산 |
| R-03/04/05/07, MD-01/02, AR-01/03, MD-03 | INHERITED — 수집·투영·컨텍스트·Claude/버전 경계 |

| Pair | requiredness | 경로 / §10 자리 | 직접 oracle |
|---|---|---|---|
| VP-09 R-01/02/06/08~11↔AT-01/02/06/08~11 | REQUIRED | 요약/타이틀→열기→타일 본문·헤더, EP-09~15 | 위 AC의 순수/SSR 테스트와 CUA-V3-01~06 |
| VP-10 SD-01↔ST-01 | REQUIRED | 최초 진입/명시 클릭→세션 상태→병렬 타일/닫기/재진입, EP-10/11/13 | `chatReducer.harness.test.ts` 초기/캐시/후속 턴, `chatStore.panelTiles.test.ts` 상태 결과, CUA-V3-01/02/04/05 실제 UI |
| VP-11 AR-02↔IT-02 | REQUIRED | dispatcher→backend registry→column→tile header/body, EP-11/12 | `Panel.render.test.ts`, `rightPanelTiles.render.test.ts`, `RightPanelTile.actions.test.ts` 확장과 CUA-V3-02/03 |
| VP-12 MD-04↔UT-04 | REQUIRED | messages/context→그룹 유무; backend→초기/지원/타깃, EP-09/10 | `model.test.ts` 신규 각 자료 독립 전이; `rightPanelTiles.harness.test.ts` 신규 task/process/source 정책 |
| VP-01의 R-03/04/05/07 | REGRESSION | 수집된 child/로그·소스·Claude를 새 타일에서 표시, EP-11/12/14 | `activity.integration.test.ts`, `model.test.ts`, `Panel.render.test.ts`, `Sources.render.test.ts` 신규 실제 hook+본문 |
| VP-03/05/06/07/08 | REGRESSION | 기존 수집·로그·컨텍스트 경계; V1/V2 자리 상속 | 기존 `activity.test.ts`, `adapter.test.ts`, `activity.integration.test.ts`, `model.test.ts`, `chatStore.sessionDirectory.test.ts`, `session-directory.test.ts`, `files.contextDirectory.test.ts`, `agent-session-policy.test.ts` |

VP-01의 AC1/2/6 증거는 VP-09로, VP-02는 VP-10으로, VP-04는 VP-11로 이관한다. old SD-01/AR-02 중 외부 depth 전환·복귀 헤더만 SUPERSEDED이며 데이터·기능 계약은 유지한다. 선택 적대 증거는 기존과 동일하게 없음; 상태 결과·실제 DOM과 사용자 조작을 직접 관측한다.

0262의 VP-10/19·EP-10 중 OpenCode 메뉴 범주/기존 task→plan 타깃 부분은 이 V3가 대체한다. 0262의 하네스별 지원 제한과 Claude 회귀 계약은 유지하며, 이번 메뉴·타일 기준의 정본은 여기 한 곳이다.

### 실행 가능한 oracle — Node 테스트와 실제 Chromium 조작 분리

현재 Vitest 환경은 Node이며 DOM runner 의존성은 없다. V2처럼 Vitest는 실제 reducer/store의 상태 결과·순수 투영·정적 렌더를 검증하고, 클릭→store→화면과 포커스는 아래 명명된 Computer Use 절차로 검증한다. 모든 절차는 구현 에이전트가 실행하며 순수 상태 계산을 사용자 실기에 맡기지 않는다.

`chatStore.panelTiles.test.ts`는 기존 `chatStore.testHarness.ts`의 `installChatStoreHarness()`로 세션을 준비하고 실제 chatActions에 진입해 세션별 columns/selected/reveal을 관측하는 신규 Node 테스트다. SSR은 별도 fixture로 초기 렌더만 확인한다. Zustand SSR는 getInitialState를 읽으므로 setState 뒤 SSR을 호출한 것을 실제 구독/전환 증거로 보고하지 않는다.

| 증거 ID | 실제 진입점·조작 | 필수 관측 |
|---|---|---|
| CUA-V3-01 | OpenCode 세션의 실제 ChatTitleBar→Popover에서 작업/계획/소스 선택, Claude 세션으로 전환 | 범주명 제거, 작업 체크/닫기/재열기, plan/source 접근, Claude 기존 메뉴 |
| CUA-V3-02 | 작업 요약의 변경 사항·agent·shell 클릭, transcript Task 카드 클릭 | 작업과 대상 타일 동시 존재, 같은 항목 재클릭 중복 없음, 다른 선택은 자기 타일만 갱신 |
| CUA-V3-03 | 열린 diff/plan/subagent/process/source의 실제 헤더 조작 | diff 컨텍스트+닫기 한 행, wrapper 없음, 닫기/확대/복사/원래 agent 목록 복귀 |
| CUA-V3-04 | 세션 A에서 선택·확대→B→A, 닫기 뒤 후속 턴/같은 세션 갱신 | 선택·확대 누출 없음, 닫기 유지, 다른 타일 내용/선택 보존 |
| CUA-V3-05 | 두 테마·좁은 폭, 긴 셸 로그·열/행 조절, artifact 열기/닫기 | 스크롤·리사이즈·원래 타일 상태/포커스 복원, 중복 헤더 없음 |
| CUA-V3-06 | cwd만→각 agent/shell/extraDir/첨부/URL 추가·제거, 빈 source 타일 + 취소 | 그룹별 0→1→0, 첫 폴더 picker 도달·취소 보존, 요약 메뉴 버튼 없음 |

실행 환경은 기존 `npm run dev`의 Electron/Vite다. 실앱에 필요한 기록이 없으면 renderer root에 임시 `__oc_panel_v3_preview.html/.tsx`를 두고 실제 ChatTitleBar/RightPanel/ToolCard와 세션 store를 mount하며 native API만 fixture로 대체한다. 같은 Vite의 preview URL을 Computer Use로 조작하고 이 파일은 제거하거나 `.tmp`로 옮겨 커밋에서 제외한다.

증거는 `.tmp/0263-v3-visual-evidence.md`에 ID별 화면/DOM·접근성 출력·테마·실앱/fixture 구분과 함께 기록한다. CI는 기존 Vitest 및 정적 gate를 실행하고 Chromium 클릭 증거는 로컬 구현 gate다. Computer Use가 불가하면 해당 CUA pair를 미완료로 남기며 SSR로 대체 완료 처리하지 않는다.

### §10 증분 강제 지점

아래는 UI 선택·renderer/기능의 구 자리 행을 대체한다. 기본 경로 검색은 `rg 'rightPanelTileDefinitions|rightPanelPolicy|rightPanelTarget|initialTile|panelReveal|OPEN_SUBAGENT_TASK|tileById' app/src/renderer/src/features/chat`이며, 구현 시 새 ID의 모든 소비처를 같은 술어로 다시 확인한다.

| 자리 / 수 | 강제 내용 | 자리별 직접 oracle / 실패 의미 |
|---|---|---|
| EP-09a/b/c/d, 4 | agents→그룹, processes→그룹, context의 implicit cwd 제외→그룹, 그룹 값→summary DOM | `model.test.ts` a/b/c의 독립 0→1→0 입력; `Panel.render.test.ts` d의 실제 렌더. 빈 그룹 노출/자료 누락 검출 |
| EP-10a/b/c/d/e, 5 | 정의/지원; task target; BEGIN_TURN 초기화; LOAD_SESSION/캐시; column 필터 | `rightPanelTiles.harness.test.ts` a/b/e; `chatReducer.harness.test.ts` c/d. task가 plan으로 열림·닫기 유실·Claude 신규 타일 노출 검출 |
| EP-11a/b/c/d/e/f, 6 | summary 클릭; 타이틀 클릭; transcript Task 클릭; store reveal; reducer 선택·활성; registry→column→본문 | CUA-V3-02 a/c/d/e/f, CUA-V3-01 b/d/e/f. Node `chatStore.panelTiles.test.ts`는 d/e 상태만 관측; 이벤트·구독 배선 증거로 확대하지 않음 |
| EP-12a/b/c/d, 4 | registry header→tile; GitContextBar+닫기; 타일별 확대; plan 복사/agent 목록 복귀 | `rightPanelTiles.render.test.ts` a/b 구조, `RightPanelTile.actions.test.ts` 직접 action 결과와 CUA-V3-03 a/b/c/d 실제 조작 |
| EP-13a/b/c, 3 | process 선택의 세션 귀속; close 시 자기 선택 정리; artifact/확대/리사이즈 수명 | `chatStore.panelTiles.test.ts` a/b 상태, CUA-V3-04 a/b/c와 CUA-V3-05 c. 기존 viewport 테스트도 회귀 |
| EP-14a/b, 2 | source 메뉴 진입→빈 전체 소스; 전체 소스 +→공통 picker/open hook | CUA-V3-01 a, CUA-V3-06 a/b. `Sources.render.test.ts` 신규 초기 렌더와 기존 directory/context 테스트는 내용·하위 기능 회귀 |
| EP-15a/b, 2 | summary 계획 팝업/버튼 제거; 타이틀 메뉴의 plan 접근 보존 | `Panel.render.test.ts`의 실제 요약 상단 DOM a, CUA-V3-06 a, CUA-V3-01 b. 버튼만 가리거나 계획 접근까지 제거하는 회귀 검출 |

자리 분모는 `4+5+6+4+3+2+2=26`이며 수집·Main 컨텍스트 기존 회귀 자리는 V1/V2를 상속한다. 실제 Chromium 절차는 React/Popover/registry/store를 실행하며 native/file API만 fixture로 대체한다. Node 테스트와 실제 UI 조작 증거를 합쳐도 각각의 실행 구간 밖 자리까지 자동 통과로 세지 않는다.

### 운영 gate / 문서 갱신 / self-review

이번 설계 산출 gate는 상대 링크·Decision↔AC↔V 대조·`git diff --check`와 INDEX 상태 일치다. 구현 시에는 renderer 가이드의 ESLint/typecheck, 관련 Vitest, renderer build, 문서 inventory와 원격 CI, 두 테마 Computer Use를 적용한다. 기존 native DB 회귀는 Electron RUN_AS_NODE 또는 CI로 실행해 설치 ABI를 보존한다.

구현 후 `docs/arch/frontend/rendering.md`의 depth 전환 서술과 `state.md`의 타일 상태 설명을 실제 코드에 맞춰 갱신한다. 이번에는 현재 코드의 architecture를 미래형으로 바꾸지 않는다. SDK/IPC/DB 변경은 없으며 다운로드 소스는 계속 커밋 제외다.

대조: D-07↔AC1′/10, D-08↔AC2′, D-09↔AC8, D-13↔AC9, D-11↔AC10, D-12↔AC6′/11은 방향이 일치한다. D-03~06은 AC3~7과 기존 회귀 pair로 유지한다. D-10은 후속 사용자 답변으로 대체됐고 OPEN 결정은 없다.

## [구현자 기입]

### 설계 리뷰

r1 구현 및 CI 보완. V1의 컨텍스트 재사용에서 Work 전용 정책을 발견해 Delta V2를 별도 설계 커밋으로 보완했다. D-01~06과 AC1~7의 사용자 결과는 유지한다. 독립 verify는 수행하지 않았다.

### 강제 지점 전수와 V-pair 자기확인

| Pair / 자기 상태 | 닫은 지점 / 분모 | 이번 관측 |
|---|---|---|
| VP-01 SELF_PASS | AC1~7 / 7 | 아래 AC별 관측표 |
| VP-02 SELF_PASS | 진입·클릭·세션 변경 / 3 | Computer Use: 요약→목록→상세, 확대→다른 세션에서 요약·0건·360px 복원, 소스 뒤로 후 모두 보기 포커스 |
| VP-03 SELF_PASS | SSE→batch→parts→projection / 3 | adapter.test의 owned child SSE, activity.integration.test의 실제 reducer 결과 `Found source`는 child에만 있고 셸 `tests running` 표시 |
| VP-04 SELF_PASS | dispatcher·기능 배치 / 2 | Panel.render.test: OpenCode summary/Claude plan; 실앱에서 변경 사항·계획 진입 |
| VP-05 SELF_PASS | 등록·child 정규화·종료 / 3 | activity.test: unrelated·duplicate·old prompt·child idle/error·resume·root finish flush; root turn.ended 1개 |
| VP-06 SELF_PASS | 투영 / 1 | model.test: live→최종 빈/null 출력, nested shell 실패와 65,536자 상한 |
| VP-07 SELF_PASS | renderer action·sync·dedup, Main 추가 전/후, 폴더·첨부 범위, SDK 입력 / 8 | sessionDirectory OpenCode canonical 동기화·대소문자 중복, Main busy/저장·범위 밖 거부, adapter system 경로 목록 |
| VP-08 SELF_PASS | 공통 정책 / 1 | agent-session-policy.test: Claude Code 거부, Claude Work/OpenCode Code 허용 |

컨텍스트 정책 소비처는 `rg sessionContextPolicy app/src`로 Main 4자리·renderer 3자리를 확인했다. 구 직접 조회 `agentSessionPolicy[`의 정의 파일 외 차집합은 0줄이다. SDK 입력은 `adapter.ts`의 system 구성에서 별도 확인했다.

### 이번 라운드 수정의 잠금

별도 적대 변이는 선택하지 않았다. 명시 입력→관측 출력의 직접 oracle을 사용한다. SSE·reducer·projection은 실제 함수 사이의 값과 화면 본문을 단언하며 호출 존재만 세지 않는다.

선택 증거 0 · 인용 변이 0 · 새 구조 proxy/전수 배선 oracle 0 = 잠금 표 행 0. 위 정책 검색은 수정 위치 감사이며 행동 테스트의 대체물이 아니다.

### Product/UX 파생 검토

| 관측 | 조치 / 결과 |
|---|---|
| 요약 카드가 pane 전체 높이를 차지함 | 내용 높이로 수정, 실앱과 preview에서 확인 |
| 셸 상태가 ‘에이전트 완료’로 표시됨 | 프로세스 전용 상태 문구, 화면에서 ‘완료’ 확인 |
| 뒤로 복귀 시 기존 DOM 소멸로 초점 소실 | stable focus key로 복원, 소스의 모두 보기 버튼에 포커스 확인 |
| 모델 미관측 시 에이전트 종류를 모델처럼 표시할 수 있음 | 수신된 model 값만 표시 |
| viewer 전환 시 상세 DOM이 소멸함 | 패널을 숨김·inert로 유지하고 계획 복사 액션도 재사용 |

### 놓친 잠재 문제 + 대응

| 축 | 대응 / 제한 |
|---|---|
| 자식 종료가 부모보다 늦음 | root 정상 종료에서 child 텍스트를 flush; activity.test로 중복 종료 없음 확인 |
| context 허용 정책의 분산 | 공통 sessionContextPolicy를 Main/renderer에 적용, SQLite 실제 경계 테스트 통과 |
| 과거 child·부모 종료 후 비동기 task | 수신하지 않은 기록 역수입과 상시 구독은 설계 범위 밖; 가짜 기록을 합성하지 않음 |
| 로그 상한 | journal과 표시에서 후미 상한·잘림 문구; 최종 결과가 진행 snapshot보다 우선 |
| CI의 기존 하네스 테스트 기대값 | CI #749에서 OpenCode 하위 에이전트를 미지원으로 기대한 1건 실패. 진입 3경로의 지원·선택과 작업→계획 전환을 단언하도록 갱신; Claude Work의 미지원 패널 차단 테스트 유지 |

명시적 차이: V2의 UI oracle 정정 외 계약 대체 없음. 만료 캐시 없음; 공유 상태는 기존 세션별 store/journal; 재진입은 activeKey로 선택 초기화; 다른 무효화는 기존 picker busy·세션 identity 검사와 파일 경로 재검사를 유지한다.

### 구현 보고

| AC | 자기 결과 | 관측 |
|---|---|---|
| AC1 | ✅ | 실제 dispatcher SSR: OpenCode 요약·PR 없음, Claude plan; 실앱 OpenCode 요약과 Claude Work 기존 패널 |
| AC2 | ✅ | Computer Use: 목록·상세·뒤로·확대·세션 변경 초기화·포커스 복귀 |
| AC3 | ✅ | SSE adapter 및 collector→실제 reducer→투영 테스트, child 텍스트와 namespace 도구 |
| AC4 | ✅ | 진행/완료/실패/빈 출력 테스트; preview npm run dev 로그에서 #30까지 독립 스크롤 |
| AC5 | ✅ | 공통 hook·selector 재사용, Main SQLite와 renderer 추가·열기 테스트; 실앱 폴더 선택창 열기·취소 |
| AC6 | ✅ | preview light/dark의 Read/Edit·diff; 실앱 변경 사항·계획·복사; 공통 artifact viewer 조립 유지 |
| AC7 | ✅ | 실앱 Claude Work 진행/출력/컨텍스트 보존; transcript bg-bg 유지; 하네스·v1 lint 경계 통과 |

✅ 7 · ⚠️ 0 · ❌ 0 = 총 7. 이번 AC의 자기확인이며 0262의 사용자 최종 시각 인수나 독립 verify를 대체하지 않는다.

| Gate | 관측한 산출 |
|---|---|
| 관련 Vitest | 24파일/403케이스 통과. 이후 child 종료 보완은 5파일/22케이스, 컨텍스트 중복·투영은 2파일/19케이스 통과 |
| SQLite 경계 | Electron을 RUN_AS_NODE로 실행하여 2파일/73케이스 통과; 설치 ABI 변경 없음 |
| 추가 context/렌더 | 3파일/12케이스 통과 |
| Typecheck | node·web·test 완료, 오류 0 |
| ESLint | 전체 읽기 전용 오류 0, 기존 useTranscriptVirtualizer 경고 1. 후속 수정 파일 검사 오류/경고 0 |
| Build | main·preload·renderer 완료. 기존 SubAgentTileContent 정적/동적 중복 import 경고 |
| 문서 | generated/prose 통과. 원본 링크 guard는 사용자 다운로드 `.tmp/opencode-dev`의 외부 문서 링크 5건 실패; `.tmp`·첨부를 제외한 저장소 링크 차집합은 빈 배열 |
| 운영 | migration sync/append-only 및 test-budget 통과, git diff --check 오류 0 |
| CI #749 후속 수정 | reducer·패널 28파일/264케이스 통과, 수정 파일 ESLint·Prettier 통과. Electron Vitest의 worker 종료 timeout 경고 2건이 있었으나 테스트와 프로세스 종료 코드는 성공 |

Computer Use 증거: 실행 중인 Orca에서 기본 요약, 빈 목록, 변경 사항, 계획의 OpenCode 문구, 폴더 picker 취소, Claude Work 회귀를 확인했다. child·셸 데이터가 없는 기존 세션 대신 실제 컴포넌트 preview의 고정 데이터로 상세·로그·테마·세션 초기화를 확인했다. 새 실모델 호출은 하지 않았다. 로컬 캡처는 `.tmp/0263-orca-panel.png`, `.tmp/0263-panel-summary.png`이며 임시 preview와 다운로드 소스는 커밋에서 제외했다.

### Review Signals

- r1, verify 이전 최초 구현. 기존 같은 불변식의 재검증 라운드가 아니다.
- V1은 Work context의 UI 재사용을 명시했지만 Main 허용 조합을 누락했다. 조사 후 V2로 보완했다.
- 네이티브 창 연결은 이번에는 성공했다. CI #749는 migration·문서·test-budget·lint·typecheck 통과 후 기존 하네스 기대값 1건에서 실패했다. 해당 회귀 테스트를 갱신하고 별도 Windows 환경에서 전체 CI를 재실행한다.
- 다음 주체는 Claude 독립 검증자다. PR #502는 draft 상태를 유지한다.

## [검증자 기입] 파생 이슈

없음.

## [구현자 기입] Delta V3 — r1.3

### 설계 리뷰

D-07~13과 AC1′/2′/6′/8~11을 구현했다. 요약은 실제 `task` 타일이며, 항목 진입은 공통 타일 store·layout·reveal을 사용한다. 하네스 중립 `TilePanel`을 추출하고 registry에 backend를 전달하여 Claude/OpenCode 본문을 분리했다. 요약의 팝업과 버튼은 함께 제거했다. 새로운 SDK·IPC·의존성·영속 포맷은 없다.

### 강제 지점 전수와 V-pair 자기확인

| 자리 / 수 | 직접 oracle와 관측 |
|---|---|
| EP-09a/b/c/d / 4 | model의 Task/Bash·context 독립 0→1→0, 실제 Sources/Panel SSR; CUA-06에서 cwd-only 변경 사항만, 자료 추가 시 해당 그룹만 등장 |
| EP-10a/b/c/d/e / 5 | rightPanelTiles.harness의 지원·task 타깃·열 필터, reducer.harness의 BEGIN_TURN/LOAD_SESSION; 실제 loadSession 갱신·후속 턴·A→B→A 뒤 닫기 보존 |
| EP-11a/b/c/d/e/f / 6 | CUA-01/02 요약·타이틀·transcript Task 클릭→reveal→실제 타일. store.panelTiles는 활성·선택·reveal 상태를 별도 단언 |
| EP-12a/b/c/d / 4 | Panel.render/native rightPanel 회귀와 CUA-03: diff Git 헤더+닫기 1행, 확대→닫기, plan 복사·확대, agent 원래 목록 복귀 |
| EP-13a/b/c / 3 | reducer/store의 process 세션 선택·3종 닫기 경로; CUA-02/04/05의 선택 교체·세션 격리·artifact 복귀·행/열 리사이즈 |
| EP-14a/b / 2 | 실제 Sources hook SSR와 CUA-01/06: 빈 source 메뉴 진입, cwd·+ 유지, fixture picker 취소 뒤 상태 유지 |
| EP-15a/b / 2 | 실제 summary title에 버튼 없음; CUA-01/03 타이틀 메뉴에서 계획 열기·본문 접근 |

등록된 UI 자리 26개를 위 행별로 확인했다. `rightPanelTileDefinitions|rightPanelPolicy|rightPanelTarget|initialTile|panelReveal|OPEN_SUBAGENT_TASK|OPEN_PROCESS_TOOL|tileById` 검색 결과를 정책·reducer/store·title·layout·registry·column 소비처로 대조했다.

| Pair | 자기 결과 / 근거 |
|---|---|
| VP-09·10·11·12 REQUIRED | SELF_PASS — 위 EP-09~15, 관련 Node 104파일/919케이스, CUA-V3-01~06 |
| VP-01의 R-03/04/05/07 REGRESSION | SELF_PASS — activity.integration·model·Panel·Sources 실제 투영/본문; CUA의 child Read/Edit 및 diff·셸 수신 로그 |
| VP-03/05/06/07/08 REGRESSION | SELF_PASS — OpenCode activity/adapter·session directory·policy 포함 Node 회귀, SQLite 2파일/73케이스 |

### 이번 라운드 수정의 잠금

직접 상태·렌더 결과와 실제 클릭을 관측했다. 테스트의 DOM header/타일 개수는 실제 출력 계약을 읽으며 소스 텍스트 검색으로 클릭 동작을 대신하지 않는다. 선택 증거 0 · 인용 변이 0 · 새 구조 proxy/전수 배선 oracle 0 = 잠금 표 행 0.

### Product/UX 파생 검토

| 관측 | 대응 / 재측정 |
|---|---|
| 긴 task 요약이 두 행의 경계에서 잘림 | OpenCode 요약 pane에 해당 행 기준 max-height를 적용. 높이400/내용1102/scrollTop701.6으로 마지막 셸 행 도달 |
| 계획 본문의 안내에 Claude 문구 잔존 | 하네스별 planSelectHintKey 추가. 2하네스×2언어 실제 렌더, CUA에서 OpenCode 문구 확인 |
| 빈 소스 그룹을 숨기면 첫 폴더 진입 유실 가능 | 타이틀 source 타일은 항상 지원. full context는 cwd·+를 유지하고 picker 취소 후 변동 없음 |
| process를 닫았다 열 때 이전 상세가 남을 가능성 | toggle/deactivate/remove에서 자기 선택만 정리. 재열기 UI는 명령 목록, agent 상세는 유지 |

### 놓친 잠재 문제 + 대응

| 축 | 조사 / 대응 |
|---|---|
| 공통 shell 이설의 Claude 영향 | Claude alias가 같은 공통 shell을 사용하되 registry/chrome 정책은 그대로. 전체 rightpanel 회귀와 CUA Claude Code 범주 메뉴 확인 |
| 새 선택 상태의 공유·재진입 | selectedProcessToolId는 ChatState에 저장. 같은 세션 cache/load는 보존, 다른 세션에는 전달하지 않음; 관련 store/reducer 직접 관측 |
| 확대와 artifact | activeKey별 확대 판정, 닫기에서 확대 해제. artifact는 overview를 hidden/inert로 보존하고 복귀 시 origin focus 확인 |
| 실제 기록이 없는 시각 상태 | plan의 허용 방식대로 실제 컴포넌트 preview에 고정 데이터를 주입. 수신하지 않은 실모델 결과로 주장하지 않음 |

명시 설계 차이 없음. 새 캐시/만료 없음; 공유 상태는 기존 세션 store, 재진입은 해당 세션 identity, 무효화는 타일 닫기와 기존 캐시 제거다. 기존 source의 권한/busy/늦은 응답 검사와 API 1.x 경계는 변경하지 않았다.

### 구현 보고

| AC | 자기 결과 | 관측 |
|---|---|---|
| AC1′ | ✅ | 실제 task 기본 요약·하네스 registry, Claude 메뉴·본문 회귀 |
| AC2′ | ✅ | 요약과 대상 타일 공존, 같은 종류 선택 교체, Task 카드 중복 없음, 닫기/세션 상태 보존 |
| AC3 | ✅ | OpenCode adapter/activity·실제 reducer projection 회귀 |
| AC4 | ✅ | process 수신 로그·완료·실패·상한 자동 회귀, CUA 긴 로그 마지막 행 도달 |
| AC5 | ✅ | Work context hook·실제 source 렌더·SQLite 경계·source + 취소 |
| AC6′ | ✅ | CUA 계획·diff·child 카드·artifact 열기/닫기, 기존 타일 헤더 |
| AC7 | ✅ | Claude policy/registry/menu 회귀, 공통 transcript canvas·버전 경계 유지 |
| AC8 | ✅ | cwd-only 변경 사항만, agent/shell/extraDir/첨부/URL 각각 0→1→0 |
| AC9 | ✅ | summary title 버튼·팝업 제거, 계획은 타이틀 메뉴로 접근 |
| AC10 | ✅ | OpenCode 평면 메뉴, 작업 체크/닫기/재열기·동일 세션 갱신과 후속 턴 보존 |
| AC11 | ✅ | diff GitContextBar+close 한 행, 추가 wrapper 없음, 원래 확대/복사/목록 복귀 |

✅11 · ⚠️0 · ❌0 = 총11. 0262 AC11 사용자 최종 시각 인수와 독립 verify는 이 자기확인과 별개다.

| Gate | 이번 관측 |
|---|---|
| 관련 Node Vitest | 104파일/919케이스 통과. 별도 오류 registry 2파일/301케이스 통과 |
| SQLite | Electron RUN_AS_NODE 단독 2파일/73케이스 통과; 설치 ABI 변경 없음 |
| 작은 추가 회귀 | 버블8파일/45케이스, 계획3파일/21케이스, model/Sources/Panel3파일/18케이스 통과(큰 묶음과 중복 합산하지 않음) |
| 타입/린트 | node/web/test 통과, 마지막 코드의 web 재통과. 변경파일30개 읽기 전용 ESLint 오류/경고0. 전체 lint의 기존 useTranscriptVirtualizer 경고1 유지 |
| 빌드/스크립트 | electron-vite main/preload/renderer 완료, 기존 SubAgentTileContent 정적/동적 import 경고. scripts138케이스 통과 |
| 운영 문서 | migration sync/append-only, test-budget, generated/prose 통과. .tmp·첨부 제외한 기존 checkLinks 결과 [] |
| 원본 링크 guard 제한 | 사용자 다운로드 `.tmp/opencode-dev` 안의 상대링크5건만 실패. 다운로드 자료는 수정·커밋하지 않음 |
| 전체 로컬 실행 제한 | 전체 Electron Vitest는 worker 종료 timeout으로 중단. 별도 attachments/confluence/git-safety 실패는 sandbox 밖 홈경로 mkdir/lstat EPERM으로 분리. 전체 성공으로 보고하지 않음 |
| 원격 전체 CI | 최종 제품 코드 `14d5fea0`의 [CI #752](https://github.com/muzaby/orca-skin/actions/runs/38691356449) success. Windows Vitest 697파일/6941케이스 통과·1파일/1케이스 skip, scripts 138/138 통과. migration·문서·test-budget·lint·typecheck 모두 성공 |

Computer Use는 Vite의 실제 renderer 컴포넌트·세션 store에서 수행했다. 개발 Electron은 창을 노출하지 않아 native 창 검증으로 보고하지 않는다. CUA 증거와 제한은 `.tmp/0263-v3-visual-evidence.md`, 캡처는 `.tmp/0263-v3-panel-light.png`·`0263-v3-panel-dark.png`다. 임시 preview는 `.tmp`로 이동했고 새 실모델 호출은 하지 않았다.

### Review Signals

r1.3은 사용자 Delta V3를 반영한 추가 구현 턴이다. 이전 depth 보고의 성공을 새 타일 조립의 증거로 재사용하지 않았다. 긴 요약 잘림과 계획 힌트의 하네스 누락을 실제 UI에서 찾아 수정했다. 로컬 전체 테스트의 권한·프로세스 경합은 별도로 기록하고 최종 제품 코드의 Windows CI에서 전체 gate 성공을 확인했다. 이후 변경은 이 결과를 기록한 문서뿐이다. 다음 주체는 Claude 독립 검증자다.


## Delta V4 — 요약 위에 상세 패널 열기

판정: READY. 기준선은 `V1+V2+V3 @ 48d9651a`이며 공유 원격 추적 ref와 `git cat-file -t`를 확인했다. 사용자가 전환 의도를 명시적으로 정정했으므로 별도 순서 질의 없이 설계 정정 후 구현하며 독립 verify 대기는 유지한다.

### Product / UX 계약

사용자 원문: “사용자 경험은 depth 가 추가되는거지만 실제로는 해당 패널 위에 새 패널을 여는 것. 새로 열린 패널 종료 시 다시 기존 패널로 …”. 기존 D-08의 ‘타일을 아래에 추가’ 해석을 D-14로 대체한다. D-03~07·09·11~13은 유지한다.

| 행동 | 결과 |
|---|---|
| 요약의 변경 사항·하위 에이전트·셸 행·소스 모두 보기 | 기존 타일 목록을 바꾸지 않고 그 위에 해당 상세 패널 표시. 뒤의 패널은 숨김·inert로 유지 |
| 상세의 기존 닫기 또는 Escape | 상세만 닫고 원래 타일·스크롤·선택 상태를 보여주며 연결된 원래 진입 버튼에 포커스 복귀 |
| agent 목록→상세→목록, process 선택 | 상위 상세 안에서만 선택 갱신. 뒤에 이미 열린 같은 종류 타일의 선택은 보존 |
| 상세 중 artifact 열기→닫기 | artifact가 최상단이고 닫으면 상세로, 상세 닫으면 원래 타일로 복귀 |
| 세션 변경 | 임시 상세를 해제하고 다른 세션에 선택/확대/포커스를 전달하지 않음. 기존 세션 타일 캐시는 유지 |
| 타이틀 메뉴·transcript Task 카드 | 기존 직접 타일 열기/선택 경로 유지. 요약 진입과 구분 |

명시적 타일 활성화가 상세 중 발생하면 상세를 해제해 요청한 타일을 보여준다. 상세 안에 열린 popup의 Escape가 먼저 처리되도록 하고, 다음 Escape로 상세를 닫는다. 포커스 복귀는 각 층의 origin을 분리해 현재 표시되는 층으로만 수행한다.

추가 wrapper 제목/뒤로 버튼을 만들지 않고 기존 diff GitContextBar·타일 헤더와 닫기를 재사용한다. 원래 agent 목록 복귀 버튼은 유지한다. 소스 파일·URL 열기, picker, 로그 수집·권한·SDK·DB는 변경하지 않는다.

| AC / provenance | 사용자 결과 | 직접 oracle |
|---|---|---|
| AC2″ / R-02 CHANGED | 요약의 네 진입 종류가 기존 패널 위에 열리고 아래 타일 수·배치·선택을 바꾸지 않으며 닫으면 복귀 | OpenCode `Panel`/navigation 상태·본문 테스트, CUA-V4-01/02 |
| AC6″ / R-06 CHANGED | 상세와 artifact를 순서대로 닫으면 직전 화면으로 복귀. 확대·리사이즈·포커스·긴 내용 접근 유지 | 공통 host 렌더·close 테스트, CUA-V4-02/03 |
| AC11′ / R-11 CHANGED | 추가 wrapper 없이 기존 헤더의 닫기가 상위 상세만 닫음. 뒤에 같은 종류 타일이 있어도 제거하지 않음 | `RightPanelTile.actions.test.ts`, CUA-V4-01/02 |

AC2′/6′/11은 위 행으로 대체한다. AC1′·3~5·7~10은 상속하고 유효 AC 총수는 11을 유지한다.

### 조사와 기술 설계

| 현재 코드 / 조사 | 변경 책임 |
|---|---|
| `tiles.tsx`: summary 네 진입이 chatActions의 activate/open을 호출 | OpenCode navigation Context로 상위 상세를 열고 원래 DOM origin 전달 |
| `TilePanel.tsx`: artifact 시 overview를 mounted hidden/inert로 유지 | 같은 호스트에 범용 detail slot 추가. artifact > detail > 기존 타일 우선순위, 숨겨진 각 층 DOM 유지 |
| `RightPanelTile.tsx`: close는 항상 removeRightPanelTile | 선택적 onClose override 추가. 기본 직접 타일 close 유지, 상세는 override만 호출 |
| `RightPanel.tsx`: OpenCode 컴포넌트에 activeKey key 부여 | 전용 Panel이 로컬 discriminated selection/폭/확대를 소유, 세션 remount에서 정리 |
| `OpenCodeAgentContent/Header`, `OpenCodeProcessContent` | detail Context 안에서는 로컬 선택을 읽고 변경, 일반 타일에서는 기존 ChatState/action 사용 |

공통 호스트는 하네스별 상세 데이터나 native API를 모른다. OpenCode Panel→공통 TilePanel/RightPanelTile→기존 registry 방향으로 조립하되 navigation Context는 별도 파일로 분리해 registry→tiles→Panel 순환을 막는다. artifact store에 가짜 ArtifactRef를 넣지 않고 기존 실제 artifact lifecycle을 그대로 유지한다.

상세 선택은 `diff | subagent(selectedId) | process(selectedId) | source` union이며 임시 UI 상태다. 열린 상세에서 artifact가 표시될 때 상세를 unmount하지 않는다. 상세의 확대/폭은 뒤 타일의 확대/폭과 분리하고 닫기 후에 원래 값으로 돌아간다.

### Delta V와 §10

| Node | provenance / 계약 |
|---|---|
| R-02/06/11, AT-02/06/11 | CHANGED — 위 AC2″/6″/11′ |
| SD-01 / ST-01 | CHANGED — 상위 상세·복귀·세션 격리·중첩 artifact 수명 |
| AR-02 / IT-02 | CHANGED — 요약 Context→OpenCode Panel→공통 host/detail slot→registry 본문/기존 헤더 |
| MD-05 / UT-05 | NEW — 상세 선택/닫기·agent/process 내부 선택이 원래 타일 상태와 분리 |

| Pair | requiredness / 경로 | 강제 지점·oracle |
|---|---|---|
| VP-13 R-02/06/11↔AT-02/06/11 | REQUIRED — 요약 클릭→실제 상세→닫기 복귀 | EP-16~19; CUA-V4-01~03 |
| VP-14 SD-01↔ST-01 | REQUIRED — open→선택/확대→artifact→close→세션 변경 | EP-17/18/19; navigation/host 테스트 + CUA-V4-02/03 |
| VP-15 AR-02↔IT-02 | REQUIRED — Context→Panel→TilePanel→RightPanelTile/registry | EP-16/17/18; `Panel.render.test.ts`/새 host 렌더 테스트와 CUA-V4-01 |
| VP-16 MD-05↔UT-05 | REQUIRED — 상세 local 상태의 open/select/close | EP-17a/18a; 새 navigation 테스트의 실제 reducer 입력→선택 결과 |
| VP-09/10/11 나머지, VP-12 | REGRESSION — 초기 task·타이틀·Task 카드·기존 타일/그룹/Claude | 기존 policy/reducer/store/Panel/Sources/RightPanel 테스트, CUA-V4-04 |

V3 VP-09의 R-02/06/11은 VP-13, VP-10의 summary 상세 수명은 VP-14, VP-11의 summary renderer edge는 VP-15로 이관한다. 나머지 직접 타일 경로는 회귀로 유지한다. 선택된 mutation은 기존/이번 모두 없음: 실제 상태 결과·렌더·클릭/포커스를 관측한다.

| 자리 / 수 | 강제 위치 | 직접 oracle / 실패 의미 |
|---|---|---|
| EP-16a/b/c/d / 4 | summary diff·agent·process·source 각각의 click→navigation | CUA-V4-01 네 버튼 실제 클릭→해당 본문; 아래 타일 추가 또는 다른 종류 표시 검출 |
| EP-17a/b/c / 3 | Panel 선택→Context, detail slot→host 숨김/표시, registry→본문/헤더 | navigation 단위·`Panel.render.test.ts`/host 렌더·CUA-V4-01/02; 원래 DOM 소멸/잘못된 선택/중복 헤더 검출 |
| EP-18a/b/c / 3 | 상세 agent/process 선택, 기존 닫기→override, close→원래 DOM/포커스 | navigation 단위·`RightPanelTile.actions.test.ts`·CUA-V4-02; 뒤 타일 선택/배치 손상·포커스 소실 검출 |
| EP-19a/b/c / 3 | artifact 우선/복귀, activeKey remount, 확대/폭/스크롤 보존 | artifact 기존 테스트·host 렌더 및 CUA-V4-03; 숨겨진 화면 상호작용·다른 세션 누출·폭/스크롤 유실 검출 |

증분 자리 분모는 4+3+3+3=13. V3 EP-11a의 summary activate는 EP-16으로, EP-11d/e/f 중 summary path는 EP-17로, EP-12/13의 상세 close/lifecycle은 EP-18/19로 대체한다. 기존 직접 타일 경로와 데이터/컨텍스트 경계는 상속하며 API/Main 변경이 없어 native DB 재실행은 원격 CI로 확인한다.

### 실제 조작과 운영 gate

- CUA-V4-01: summary 네 진입 각각 열기/닫기. 표시되는 상세 하나, 숨겨진 원래 타일 DOM 동일, 헤더 하나, 원래 columns 불변.
- CUA-V4-02: agent 목록/상세/목록, 긴 process 상세, 같은 종류의 원래 타일이 열린 상태에서 상세 닫기. 원래 선택·스크롤·origin focus 보존.
- CUA-V4-03: 상세 확대/축소·가로 크기 조절, 상세 중 artifact 열기/닫기/상세 닫기, A→B→A. 두 테마와 작은 화면에서 확인.
- CUA-V4-04: 타이틀 메뉴 직접 diff/plan/source 토글·transcript Task 카드·Claude Code/Work와 기존 artifact 경로 회귀.

현재 앱 창에 연결할 수 없으면 V3와 같이 실제 renderer/store preview와 native API fixture를 사용하고 증거 범위를 구분한다. 새 실모델 호출은 사용자의 생략 결정을 유지한다. 읽기 전용 ESLint·typecheck·관련 Node Vitest·renderer build·문서 inventory·원격 CI를 수행하며 임시 자료는 커밋하지 않는다.

READY 대조: D-14↔AC2″/6″, D-12↔AC11′ 일치. D-07/11의 직접 타일 메뉴와 D-09/13의 그룹·버튼 제거는 변경 없음. 새로운 의존성/공개 계약/저장 포맷/OPEN 결정 없음. 구현 후 architecture rendering/state를 현재 동작으로 갱신한다.

## [구현자 기입] Delta V4 — r1.4

### 설계 리뷰

D-14를 구현했다. 요약 클릭은 OpenCode 로컬 상세 상태를 열며, 공통 `TilePanel`이 기존 타일 위에 표시한다. artifact > 상세 > 기존 타일 순서로 숨김·inert를 적용하고 각 층의 DOM과 origin을 보존한다. 기존 타일 헤더의 닫기는 상세에서만 override하며 타이틀 메뉴·transcript Task 카드의 직접 타일 경로는 유지한다.

### 강제 지점 전수와 V-pair 자기확인

| 자리 / 수 | 직접 oracle와 관측 |
|---|---|
| EP-16a/b/c/d / 4 | CUA에서 변경 사항·agent 요약·셸 행·소스 모두 보기를 각각 클릭. 본문 전환 중 뒤의 columns는 불변, 닫기 뒤 원래 요약 표시 |
| EP-17a/b/c / 3 | navigation reducer·실제 registry 본문/헤더·host 렌더 테스트. CUA에서는 숨겨진 overview와 표시된 detail 하나를 관측 |
| EP-18a/b/c / 3 | base agent=task/process=shell 상태에서 상세의 Engine settings/두 번째 셸을 선택해도 base 선택 불변. 닫기 뒤 원래 진입 버튼 focus, summary scrollTop 848→848 |
| EP-19a/b/c / 3 | 상세 로그 scrollTop 440.8→artifact→440.8, A→B→A에서 상세 해제. 폭560→580, 확대/축소와 두 테마·좁은 화면 표시 확인 |

증분 자리 13개를 각 행의 상태·렌더·클릭 결과로 확인했다. 기존 직접 타일과 source 데이터 경계는 관련 회귀 테스트로 유지 여부를 확인했다.

| Pair | 자기 결과 / 근거 |
|---|---|
| VP-13 REQUIRED | SELF_PASS — CUA-V4-01~03의 네 진입·닫기·복귀, 중복 wrapper 없이 기존 닫기 사용 |
| VP-14 REQUIRED | SELF_PASS — navigation/host lifecycle 테스트, 실제 artifact 중첩·세션 전환·스크롤·포커스 복귀 |
| VP-15 REQUIRED | SELF_PASS — registry Content/Header의 local/base 선택 분리와 common host 렌더, 실제 summary 클릭 |
| VP-16 REQUIRED | SELF_PASS — navigation 7케이스: open/select/close/resize/expand와 종류 불일치 입력 |
| VP-09/10/11 나머지·VP-12 REGRESSION | SELF_PASS — 관련 57파일/499케이스, CUA 직접 타일·Task 카드·Claude Code/Work artifact 회귀 |

### 이번 라운드 수정의 잠금

해당 없음 — 직접 상태·렌더·클릭 oracle을 사용했다. 선택 증거 0 · 인용 변이 0 · 새 구조 proxy/전수 배선 oracle 0 = 잠금 표 행 0. SSR은 mounted 세 층의 구성을 확인하고 실제 스크롤/포커스는 CUA로 별도 확인했다.

### Product/UX 파생 검토

| 관측 / 위험 | 대응과 재측정 |
|---|---|
| 상세와 뒤 타일이 같은 선택을 공유할 수 있음 | detail Context의 선택만 갱신. base task/shell을 유지한 채 Engine settings/두 번째 셸 상세를 열고 닫음 |
| 상세를 닫은 후 이전 reveal이 가로 위치를 덮을 수 있음 | 이미 적용한 reveal을 구분. 표시 중 viewport 위치만 저장하고 상세 복귀 시 원래 위치 복원 |
| Escape가 diff 팝업과 상세를 동시에 닫을 수 있음 | 표시된 popup의 처리를 우선. 실제 첫 Escape는 메뉴만, 다음 Escape는 상세를 닫음 |
| 공통 host 변경이 Work 산출물 경로에 영향 | 실제 Work 출력 영역의 카드→뷰어→닫기에서 원래 작업 패널과 카드 focus 복원 |

### 놓친 잠재 문제 + 대응

| 축 | 조사 / 대응 |
|---|---|
| 세션 수명 | activeKey로 OpenCode Panel remount, detail origin/선택/확대 초기화. CUA A→B→A에서 detail 수0 |
| 공유 | detail 선택은 Context, base 선택은 기존 ChatState. artifact도 실제 store를 사용하며 가짜 참조를 만들지 않음 |
| 재진입 | request key는 새 진입에서 증가하고 같은 상세 내부 선택에서 유지. agent 목록 복귀와 artifact 로그 스크롤 유지 확인 |
| 무효화 | 명시적인 panelReveal은 상세를 닫고 직접 타일 표시. 닫기 override가 뒤 타일 remove를 호출하지 않음 |
| 만료 | 새 캐시·서버 상태·만료 정책 없음. 로컬 UI 수명만 변경 |

설계 대비 명시적 차이와 미해결 PLAN_GAP 없음. 새 SDK·IPC·DB·의존성·영속 포맷 변경 없음.

### 구현 보고

| AC | 자기 결과 | 관측 |
|---|---|---|
| AC1′ | ✅ | task 기본 요약과 하네스 registry 회귀, Claude 메뉴 범주 유지 |
| AC2″ | ✅ | 네 summary 진입의 상위 표시, columns/선택 불변, 닫기 복귀 |
| AC3 | ✅ | model/activity projection과 subagent 본문 회귀 |
| AC4 | ✅ | process 상태/로그 회귀 및 실제 긴 로그 스크롤 |
| AC5 | ✅ | source hook/본문 회귀, 실제 full source 진입 |
| AC6″ | ✅ | artifact 중첩 복귀·상세 폭560→580·확대/축소 |
| AC7 | ✅ | Claude Code 메뉴 및 Work 출력물 뷰어 복귀 |
| AC8 | ✅ | 조건부 그룹 model/Panel/Sources 회귀 |
| AC9 | ✅ | 요약 버튼·팝업 제거 렌더 회귀 |
| AC10 | ✅ | 직접 타일 메뉴·transcript Task 카드 및 세션별 store 회귀 |
| AC11′ | ✅ | 기존 diff Git 헤더의 닫기, detail close override, 뒤 타일 보존 |

✅11 · ⚠️0 · ❌0 = 총11. 사용자 최종 시각 인수(0262 AC11)와 Claude 독립 verify는 별도 대기다.

| Gate | 이번 관측 |
|---|---|
| 관련 Node Vitest | 57파일/499케이스 통과. navigation·registry·host·store·reducer·artifact·sidePaneResize 포함 |
| Typecheck | node/web/test 통과 |
| ESLint | 최종 전체 읽기 전용 검사 오류0, 기존 useTranscriptVirtualizer 경고1 |
| Build | main/preload/renderer 완료. 기존 SubAgentTileContent 정적/동적 import 경고 유지 |
| 문서/운영 | generated/prose·migration sync/append-only·test-budget 통과. 다운로드·첨부 제외 checkLinks 결과 [] |
| 원본 링크 guard 제한 | 사용자 다운로드 `.tmp/opencode-dev`의 상대링크5건만 실패. 해당 자료는 수정·커밋하지 않음 |
| 원격 CI | 이번 제품 코드 `fbc15aba`의 [Windows CI #754](https://github.com/muzaby/orca-skin/actions/runs/38695989992) success. Vitest 699파일/6966케이스 통과·1파일/1케이스 skip, scripts138/138 통과. migration·문서·test-budget·lint·typecheck 모두 성공 |

CUA는 실제 ChatTitleBar·TranscriptView·RightPanel·store에 고정 데이터를 넣은 renderer preview에서 수행했다. native API는 fixture이며 새 실모델 호출은 하지 않았다. 로컬 증거는 `.tmp/0263-v4-visual-evidence.md`, 캡처는 `0263-v4-summary.jpg`·`0263-v4-detail.jpg`·`0263-v4-dark-detail.jpg`다. 임시 preview와 다운로드 소스는 커밋하지 않는다.

### Review Signals

r1.4는 사용자가 전환 의도를 정정한 Delta V4 구현 턴이다. 앞선 ‘독립 타일 추가’ 성공을 이번 상위 상세 동작의 증거로 재사용하지 않았다. 공통 host의 스크롤·포커스 및 기존 타일과의 선택 분리를 이번 기준으로 확인했다. 다음 주체는 Claude 독립 검증자다.

## Delta V5 — 패널 외곽·행 여백·활성 셸·작업 메뉴

판정: READY, 이번 턴은 요구 배분과 설계만 수행한다. 기준은 `0263 V1~V4 @ 940bd44edc5625f79b377b885cbe559b1d66fdb6`이며 `git cat-file -t`의 `commit`과 공유 원격 추적 ref의 동일 해시를 확인했다. 사용자 요구 변경이므로 라운드 1을 유지하고 V4의 구현 보고를 V5 완료 증거로 재사용하지 않는다.

### Product / UX — 귀속과 사용자 결과

| 사용자 요구 | 귀속 / 결정 | 완료 후 결과 |
|---|---|---|
| “우측 패널의 모양(border의 모양 및 굵기 포인트)…다른 우측 보조 패널(계획, 작업 등)에 따른다” | 0263 / D-15 | OpenCode 작업 요약·상세 외곽의 모서리와 선 두께가 Orca 기존 계획·Work 작업 패널과 같음 |
| “백그라운드 프로세스 현황 표시는 활성 중인 것만…완료되면 항목을 비울 것” | 0263 / D-16 | 실행 중 셸만 요약에 나타나고 종료된 행은 즉시 사라짐. 마지막 활성 실행이 끝나면 그룹 제목·구분선도 사라짐 |
| “항목에서 좌우 마진을 조금 더…호버시 텍스트 옆에 마진이 없는게 표시되어 미관상 별로임” | 0263 / D-17 | 호버 배경 안쪽에서 아이콘·텍스트가 양끝에 붙지 않음. 긴 이름은 여백을 침범하지 않고 말줄임 |
| “타일 표시 중 '작업' 외 타일은 노출하지말것” | 0263 / D-18 | OpenCode 타이틀 케밥의 타일 표시에는 작업 체크 항목 하나만 존재하고 닫기·다시 열기 가능 |

적용은 OpenCode 전용이다. 메뉴·패널의 정본은 이미 0263 V3가 소유하므로 [0262](../0262-opencode-harness/plan.md)에는 중복 델타를 만들지 않으며, 그 ΔV9의 Claude Code/Work 메뉴 보존을 회귀로 연결한다. [0264](../0264-harness-module-isolation/plan.md)의 하네스/공통 디렉터리 경계는 유지하고 구조 분리 작업의 완료 상태를 변경하지 않는다.

| 상태 / 행동 | 표시·보존 계약 |
|---|---|
| 실행 전, 완료 이력만 존재 | 변경 사항 고정 항목 유지. 프로세스 그룹은 숨김; agent/source 그룹의 기존 조건은 그대로 |
| 여러 셸 실행 중 하나 종료 | 그 행만 제거하고 나머지 활성 행 유지. 재실행은 새 실행 ID로 나타남 |
| 셸 상세를 연 채 성공·실패·중단·거부·취소 | 요약 행은 제거하되 열린 상세는 유지하고 최종 상태·수신 로그를 표시. 전체 이력·transcript 기록을 삭제하지 않음 |
| 종료로 진입 행이 사라진 후 상세 닫기/Escape | 원래 작업 요약·배치·스크롤로 복귀. 원래 버튼이 있으면 그 버튼, 사라졌으면 요약의 변경 사항 버튼에 포커스 |
| 타일 표시 메뉴 열기 | 작업만 체크/토글 가능. 계획·백그라운드 작업·변경 사항·프로세스·소스 항목과 범주 제목은 없음 |
| 기존 여러 타일이 저장된 세션 진입 | 저장된 배치·선택·개별 닫기와 기존 직접 활성화는 보존. 메뉴 비노출 때문에 지원 타일/상세를 차단하거나 저장 상태를 삭제하지 않음 |
| 자료 없는 세션에서 소스 이용 | 타이틀의 빈 소스 진입은 제거. 기존 파일 첨부 전송 또는 Read/WebFetch/WebSearch 자료가 생기면 소스 그룹→+ / 모두 보기 경로 사용 |

새 메뉴나 대체 계획 진입점은 추가하지 않는다. 소스 그룹은 초안의 첨부 선택만으로 나타나지 않으며 전송된 첨부·수집 자료·추가 폴더라는 기존 조건을 유지한다. 외곽의 색·배경·그림자, transcript/composer, 기존 헤더와 요약 메뉴 버튼 제거 계약은 변경하지 않는다.

### Acceptance / supersede

| R / AC / provenance | 사용자 관측 기준 | 직접 oracle / 도달 경로 |
|---|---|---|
| R-06 / AC6‴ CHANGED | 상세·artifact 순서대로 닫기와 원래 배치/스크롤 보존. 종료로 원래 행이 사라져도 안전하게 닫히고 변경 사항 버튼으로 포커스 복귀 | 아래 T-V5-04, CUA-V5-03; summary→detail→terminal update→close |
| R-08 / AC8′ CHANGED | 기본 변경 사항만 고정, agent/source 기존 조건 유지. process는 활성 0→1→일부 종료→0에서 행·그룹이 정확히 갱신됨 | T-V5-01/02, CUA-V5-02; parts/background→model→summary |
| R-09 / AC9′ CHANGED | 요약의 팝업·케밥·미트볼 버튼 없음. 계획의 타이틀 메뉴 접근 보장은 제거 | 기존 summary 렌더 및 T-V5-03, CUA-V5-04 |
| R-10 / AC10′ CHANGED | OpenCode 타일 메뉴에 작업만 표시하고 체크·토글 정상. Claude Code/Work 목록·순서·배지와 케밥의 다른 액션 유지 | T-V5-03/05, CUA-V5-04; ChatTile→ChatTitleBar→menu→store |
| R-12 / AC12 NEW | OpenCode 요약·일반/상위 상세 패널의 모서리와 테두리 두께가 기존 Orca 계획·Work 작업 패널과 같음 | CUA-V5-01의 실제 computed style·스크린샷 비교; appearance→공통 RightPanelTile |
| R-13 / AC13 NEW | 변경 사항·셸·source 행, agent 요약/목록 버튼, URL 행의 호버 배경 안쪽 좌우 간격 확보. 좁은 폭·긴 이름에서도 overflow 없음 | CUA-V5-01의 실제 hover/치수·좁은 폭; PanelRow/agent summary·list/source link |

V4 AC6″, V3 AC8~10은 위 행으로 대체하며 AC1′·2″·3~5·7·11′은 유지한다. 유효 AC는 13개다. AC4의 완료·실패·빈 로그와 AC5의 컨텍스트 추가/열기는 상세에서 유지하며 요약 활성 조건과 혼동하지 않는다.

명시 폐기 범위: V3 AC9·EP-15b의 계획 메뉴 접근, EP-14a의 빈 소스 메뉴 진입, CUA-V3-01/06 및 CUA-V4-04의 OpenCode plan/diff/source 메뉴 토글만 대체한다. 해당 위치는 새 메뉴 음성 단언으로 이동하며 EP-14b의 picker/open, V4 요약 상세 네 진입은 유지한다. D-19는 D-05의 GUI/기능 보존을 승계하면서 위 메뉴 접근 예외를 명시한다.

### 조사 / 기술 설계

아래 경로는 `app/src/renderer/src/features/chat/` 기준이며 `styles/tokens.css`만 renderer `src/` 기준이다. 조사한 생산 경로는 0264 이후 실제 이동된 파일을 사용하며 과거 테스트 경로를 그대로 복사하지 않는다.

| 대상 / 관측 | TO-BE / 책임 |
|---|---|
| `harnesses/opencode/rightPanel.ts`: overview 22px, 일반 tile 10px. `claude/rightPanel.ts`: `rounded-r6 border` | OpenCode tile의 외곽을 기존 `rounded-r6 border`로 통일. 동일해진 overview override는 생략하고 common의 fallback 사용; 전용 색·그림자 유지 |
| `styles/tokens.css`: r6는 0.75rem, 공통 tile는 단일 `border` | 기존 토큰 재사용, 새로운 radius/선 굵기 토큰·CSS 없음. Claude 구현 import나 별도 외곽 추상화 추가 없음 |
| `opencode/rightpanel/chrome.tsx` PanelRow, `tiles.tsx` agent button, `Sources.tsx` web anchor, `AgentViews.tsx` 목록 button: 세로 패딩만 존재 | 네 행 렌더 자리에 `px-2` 수준의 안쪽 간격 적용. 기존 summary `px-6`을 늘려 해결하지 않음; 공통 PanelRow 소비 행에도 일관 적용 |
| `model.ts`: 전체 셸 기록을 `describeTool(call).outcome`으로 정규화; 요약/상세가 같은 processes 사용 | 순수 active selector는 `status === 'running'`만 선택해 요약에 사용. 전체 model과 상세의 선택 조회는 유지 |
| `lib/parts.ts`: outcome = running/completed/failed/rejected/aborted/cancelled/not_executed | running만 포함. 미수신 결과와 async-launched는 기존 running 판정 유지; 나머지는 모두 제외. session inflight/OS PID로 활성 추정 금지 |
| `lib/rightPanelTiles.ts`: 지원 목록이 메뉴·target·columns에 함께 사용됨 | `RightPanelAgentPolicy`에 선택적 `menuIds` 추가, 생략 시 기존 visibleIds. 새 메뉴 selector만 적용하고 기존 지원/target/columns selector는 유지 |
| `ChatTitleBar.tsx`: `rightPanelTileDefinitionsForAgent` 직접 소비 | 메뉴 전용 selector로 교체. OpenCode 정책에 `menuIds: ['task']`, Claude 정책 기본값 유지; 공통 UI에 backend 분기 복제하지 않음 |
| `common/rightpanel/TilePanel.tsx`: detached origin을 거르지만 대체 포커스 없음 | OpenCode가 안정적인 변경 사항 버튼을 fallback origin으로 전달. common detail host는 선택적 DOM 참조만 받고 하네스별 DOM 마커/정책을 모름 |

`rightPanelTileDefinitionsForAgent`의 생산 소비처는 타이틀과 공통 `components/rightpanel/tileRegistry.ts`다. 새 selector는 타이틀만 사용하며 registry의 기존 목록은 유지한다. `visibleIds`와 `rightPanelTarget`을 축소하거나 전역 suspended 목록을 바꾸어 메뉴를 숨기는 구현은 금지한다.

변경 사항 버튼은 OpenCode summary가 안정적인 fallback으로 식별하고, navigation 상태→Panel의 detail config→공통 host로 전달한다. host는 원래 origin을 우선하고, 닫힌 상세·inert/hidden·다른 세션·분리된 DOM에는 포커스하지 않는다. fallback을 전달하지 않는 Claude/artifact 기존 경로는 그대로 유지한다.

Main·SDK·IPC·DB·저널 수집/보존·dependencies는 변경하지 않는다. 이번 활성 필터는 렌더 투영이며 완료 이력을 지우거나 프로세스 상세를 자동 닫지 않는다. 로그 상한과 완료 결과 우선 규칙은 기존 MD-02를 그대로 따른다.

### Delta V / 직접 oracle

| Node | provenance / 계약 |
|---|---|
| R-06/08/09/10, AT-06/08/09/10 | CHANGED — 위 AC6‴/8′/9′/10′ |
| R-12/13, AT-12/13 | NEW — 외곽 일치·행 안쪽 여백 |
| SD-01 / ST-01 | CHANGED — 실행 종료 중 요약 제거·상세 유지·복귀 포커스 |
| AR-02 / IT-02 | CHANGED — 메뉴 노출 정책 분리, 하네스가 주입한 외곽·fallback과 공통 host |
| MD-04 / UT-04 | CHANGED — 활성 프로세스/메뉴 투영, 기존 지원·agent/source 조건 유지 |
| R-01/02/04/05/07/11, MD-02/05 | INHERITED — 작업 토글·상세·로그·소스·Claude·헤더/선택 수명 |

아래 T-V5 항목은 구현 시 추가/확장할 테스트 좌표이며 이번 턴 실행 결과가 아니다. SSR은 정적 출력만, Node 콜백 테스트는 실행한 콜백만 검증하며 실제 클릭/구독/포커스는 CUA에서 닫는다.

| ID | 테스트 파일:케이스 / 직접 단언 |
|---|---|
| T-V5-01 | `harnesses/opencode/rightpanel/model.test.ts`: 신규 `selects only running processes without removing terminal history` — 모든 outcome과 async-launched, 동시 실행·종료·재실행 입력에서 active IDs/전체 이력/최종 로그를 함께 단언 |
| T-V5-02 | `harnesses/opencode/rightpanel/Panel.render.test.ts`: 신규 `shows only active shell rows while keeping terminal detail readable` — 혼합 상태의 summary와 선택된 terminal detail 출력, 마지막 활성 종료 시 그룹·구분선 제거 |
| T-V5-03 | `components/ChatTitleBar.render.test.ts`: 기존 `$backend $kind의 기존 순서·지원 항목과 타일 표시 제목을 보존한다`, `모든 항목이 자신의 타일을 토글하고 현재 선택을 표시한다` 확장 — OpenCode 작업 하나/Claude 기존 목록, 실제 MenuItem 체크·toggle 인수; 신규 다른 케밥 액션 유지 단언 |
| T-V5-04 | `harnesses/opencode/rightpanel/navigation.test.ts` 및 `harnesses/common/rightpanel/TilePanel.detail.test.ts`: 신규 `restores fallback focus only after a removed detail origin` — fallback 전달·연결/hidden/inert/세션 조건, 닫기 후 focus 대상. 실제 DOM 효과는 CUA-V5-03으로 보완 |
| T-V5-05 | `lib/rightPanelTiles.harness.test.ts`: 신규 `limits only the OpenCode menu while retaining every supported target` — menu는 task, target/columns는 기존 지원 집합; 기존 `retains Claude Code and Work panel sets` 유지 |

| Pair | requiredness / start→edges→end | 자리 / 직접 oracle |
|---|---|---|
| VP-17 R-06/08/09/10/12/13↔AT-06/08/09/10/12/13 | REQUIRED — 세션→요약/hover/타이틀→표시·클릭·상세/복귀 | EP-20~23의 15자리; T-V5-01~05와 CUA-V5-01~04 |
| VP-18 SD-01↔ST-01 | REQUIRED — 실행 데이터 갱신→요약 제거/상세 유지→닫기→원래 화면·포커스 | EP-21b/c·23a/b/c의 5자리; T-V5-02/04, CUA-V5-02/03 |
| VP-19 AR-02↔IT-02 | REQUIRED — appearance/메뉴 정책→common tile/ChatTitleBar, OpenCode origin→detail config→host | EP-20a·22a/b/c·23a/b/c의 7자리; T-V5-03/04/05, CUA-V5-01/03/04 |
| VP-20 MD-04↔UT-04 | REQUIRED — 전체 상태→active selector, 지원 정책→메뉴 전용 selector | EP-21a·22a의 2자리; T-V5-01/05 |
| VP-06 MD-02↔UT-02 | REGRESSION — 전체 셸 기록→진행/최종 출력·실패·상한 | 기존 `model.test.ts: shows received progress, then lets terminal results replace it`, `includes child shell calls, bounds long output and preserves failures` |
| VP-01의 R-04/05/07, VP-12의 agent/source 조건 | REGRESSION — 로그·컨텍스트·Claude와 독립 그룹 조건 | 기존 `model.test.ts: never counts the implicit working directory as an added source`, `Sources.render.test.ts: hides cwd-only summary sources but keeps the full directory and add control reachable`, CUA-V5-02/04 |
| VP-09의 R-01, VP-13의 R-02/11, VP-14~16의 변경되지 않은 경로 | REGRESSION — 작업 토글·요약 상세·artifact·세션 격리·기존 헤더/선택 | 기존 `Panel.render`, navigation, `TilePanel.detail`, store/reducer 테스트 및 CUA-V5-03/04 |

V3 VP-09의 R-08~10 및 V4 VP-13의 R-06은 VP-17로, VP-12의 활성/메뉴 계산은 VP-20으로 이관한다. V4 VP-14/15 중 이번 종료·포커스·정책 edge는 VP-18/19로 대체하고 나머지는 회귀로 유지한다. 기존/이번 선택 mutation은 0개이며 실제 입력→출력과 DOM 조작을 직접 관측한다.

### §10 증분 강제 지점 / 운영 gate

| 자리 / 수 | 강제 내용 | 자리별 oracle / 실패 의미 |
|---|---|---|
| EP-20a/b/c/d/e / 5 | a appearance→요약·일반/상위 tile 외곽; b PanelRow; c agent 요약 버튼; d source URL 행; e agent 목록 행 | CUA-V5-01 a/b/c/d/e. a는 기존 보조 패널과 computed radius/각 변 border-width 비교; b/c/d/e는 호버 배경 양끝의 padding·실제 긴 내용/말줄임 관측 |
| EP-21a/b/c / 3 | a model→active 투영; b active 목록→그룹 조건/행 렌더; c 전체 기록→열린 상세 결과 | T-V5-01 a, T-V5-02 b/c 정적 출력, CUA-V5-02/03 b/c 실제 store 갱신. 완료 이력 삭제·남은 활성 누락·상세 unavailable 회귀 검출 |
| EP-22a/b/c/d / 4 | a 하네스 menu 정책→selector; b selector→실제 메뉴; c 작업 체크/클릭→store 토글; d 기존 다른 메뉴/Claude 항목 | T-V5-05 a, T-V5-03 b/c/d, CUA-V5-04 b/c/d. 지원 타일까지 축소하거나 숨긴 항목이 메뉴에 남는 회귀 검출 |
| EP-23a/b/c / 3 | a OpenCode origin→안정적 fallback 식별/선택 상태; b 선택 상태→detail config; c common host close→유효 origin/fallback 포커스 | T-V5-04 a/b/c의 실행 구간, CUA-V5-03 전체. detached/hidden/다른 세션 focus·스크롤 손상 검출 |
| DOC-V5a/b / 2 | a plan 메타 READY; b INDEX plan/READY·다음 Codex·동일 라운드 | `git diff -- docs/handoff/0263-opencode-session-panel/plan.md docs/handoff/INDEX.md` 양쪽 대조. 한쪽만 IMPL_DONE이면 실패 |

제품 자리 분모는 `5+3+4+3=15`, 문서 상태 사본은 별도 2자리다. V3 EP-09b/d의 process 조건, EP-11b의 메뉴 선택은 EP-21/22로 대체한다. EP-14a/15b는 위 명시 폐기 범위대로 대체하고 기존 source 기능·summary 네 진입·host 수명은 회귀로 닫는다.

| CUA ID | 실제 조작 / 필수 관측 |
|---|---|
| CUA-V5-01 | 밝고 어두운 테마에서 OpenCode 요약·계획/상세와 Claude 계획·Work 작업 외곽 비교. 변경 사항·셸·소스 파일·URL·agent 요약/목록 버튼을 hover하고 기본/좁은 폭에서 양쪽 간격·말줄임 확인 |
| CUA-V5-02 | 실제 reducer/store를 사용하는 세션에 여러 셸 진행→일부 성공/실패→모든 terminal→새 실행을 공급. 행 단위 제거, 마지막 그룹 숨김, 독립 agent/source 그룹 보존 |
| CUA-V5-03 | 활성 셸 행 클릭→상위 상세에서 종료 결과 수신→닫기/Escape. 최종 로그 유지·원래 배치/스크롤·fallback 포커스; artifact 중첩·연결된 origin·세션 전환 회귀 |
| CUA-V5-04 | OpenCode 타이틀 케밥→작업 체크/닫기/재열기, 다른 tile 항목 부재. 기존 저장 타일·요약의 네 상세 진입·자료 생성 후 source 추가/열기, Claude Code/Work 메뉴·배지·다른 케밥 액션 보존 |

구현 gate는 읽기 전용 ESLint·typecheck, 위 신규 및 영향받은 기존 순수 Vitest, renderer build, 문서 inventory·오류 처리 inventory·test-budget, 원격 CI와 위 CUA다. 기존 `chatReducer.harness`, `chatStore.panelTiles`, `rightPanelTiles.harness`, `Panel.render`, `Sources.render`, `TilePanel.detail`을 회귀 집합에 포함한다. native ABI는 뒤집지 않으며 Main/DB 실동작 회귀는 기존 CI에 위임한다.

실앱 연결이 불가능하면 실제 ChatTitleBar·RightPanel·store를 mount한 renderer fixture를 사용하고 native API 대체와 실앱 미검증을 구분한다. 실모델 도구 검증 생략 결정은 유지하며 임시 fixture·다운로드·첨부는 커밋하지 않는다. 구현 시 현재 architecture의 메뉴/요약 서술을 코드와 함께 갱신하고 이번 계획 턴에서는 미래 상태로 수정하지 않는다.

### READY self-review

대조 결과: D-15↔AC12, D-16↔AC8′, D-17↔AC13, D-18↔AC9′/10′, D-19↔AC4/5/7 및 메뉴 예외가 일치한다. D-03/04/06/07/12/13/14는 기존 AC·회귀 pair로 유지하며 ACTIVE 결정 충돌 0, OPEN 결정 0이다. 계획/빈 소스 메뉴 접근의 과거 보장과 완료 상세 기록 보존을 각각 명시 대체/유지해 반대 방향 단언이 남지 않도록 했다.

신규·변경 R/SD/AR/MD는 모두 VP-17~20의 같은 레벨 REQUIRED pair와 §10 자리를 가진다. 새 테스트는 T-V5로 계획 좌표임을 표시했고 인용한 기존 케이스·정책/소비 경로는 현재 파일에서 확인했다. 이전 V4 self-pass·원격 CI는 기준선 증거이며 이번 제품 변경의 완료 판정이 아니다.

설계 산출 gate: `git diff --check` 통과, `checkLinks`에서 사용자 다운로드 `.tmp`와 `.codex-remote-attachments` 제외 결과 0건, `scanProse` 위반 0건. plan/INDEX 모두 plan/READY·다음 Codex·라운드 1을 대조했다. 변경 파일은 이 plan과 INDEX뿐이며 앱 코드·첨부·현재 architecture는 변경하지 않았다.
