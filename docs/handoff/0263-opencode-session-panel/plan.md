# Plan — OpenCode 세션 우측 패널

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex / 2026-10-15 |
| 상태 | IMPL_DONE — Delta V3 구현·자기확인 완료, 독립 verify 대기 |
| V mode / revision | Baseline V1 + Delta V2 + Delta V3 |
| 기준 V | none — 0262의 완료 구현 위에 별도 기능 단위로 추가 |
| 매핑 | PR #502, 0262 후속 |

현재 규범은 V1에 V2와 [Delta V3](#delta-v3--작업-요약과-기존-타일-동작-복원)를 순서대로 적용한다. 아래 V1/V2 본문과 구현 보고는 기준선 이력이며, V3가 명시적으로 대체한 화면 전환·헤더·빈 그룹 규칙은 구현 목표로 다시 사용하지 않는다.

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
| D-05 | transcript 배경, Claude 동작, 기존 diff·계획·artifact viewer 접근 유지 | 기존 합의 및 회귀 계약 | ACTIVE |
| D-06 | SDK 의존 수집은 opencode/v1, 공통 이력·상태 프로토콜 재사용 | 기존 합의 | ACTIVE |
| D-07 | OpenCode 기본 요약은 `작업` 타일로 표시하고 타이틀의 타일 표시 메뉴에서 열고 닫는다 | 2026-10-15 추가 요구 | ACTIVE; D-01 대체 |
| D-08 | 요약의 패널 진입 항목은 기존 타일 패널을 열며, 다른 열린 타일과 작업 요약을 교체하지 않는다 | 같은 요구 “depth 변경이 아니라 타일패널이 열려야 함” | ACTIVE; D-02 대체 |
| D-09 | 기본 고정 항목은 변경 사항 하나. 하위 에이전트·백그라운드 프로세스·소스 그룹은 실제 하위 항목이 있을 때 노출 | 같은 요구 “그 하위 항목이 추가될때 활성화” | ACTIVE |
| D-10 | 요약 케밥의 계획 팝업을 제거하고 아이콘은 미트볼로 변경 | 같은 요구 두 항목 | SUPERSEDED → D-13; 후속 사용자 답변 |
| D-11 | OpenCode 타이틀의 타일 표시 목록에서 검토·세션·작업 범주명을 제거하고 평면 목록을 사용 | 같은 요구 | ACTIVE; 0262의 OpenCode 범주 표시 계약만 대체 |
| D-12 | 0263에서 추가한 상세 wrapper 헤더를 제거하고 기존 타일 헤더를 복원. 변경 사항의 닫기는 기존 Git 컨텍스트 헤더에 배치 | 같은 요구 “클로드 변경사항 패널 참고” | ACTIVE |
| D-13 | 작업 요약 상단의 팝업과 버튼을 모두 제거하며 미트볼 대체 버튼도 두지 않는다 | OQ-01 사용자 답변 “버튼도 제거” | ACTIVE; D-10 대체 |

갱신 메모: D-01~06 추가. ACTIVE 결정 ↔ AC 대조: 충돌 0. 0262의 AC가 이미 25건을 넘으므로 독립 패널 기능을 분리한다.

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
