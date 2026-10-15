# Plan — OpenCode 세션 우측 패널

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex / 2026-10-15 |
| 상태 | READY |
| V mode / revision | Baseline V1 + Delta V2 |
| 기준 V | none — 0262의 완료 구현 위에 별도 기능 단위로 추가 |
| 매핑 | PR #502, 0262 후속 |

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
| D-01 | OpenCode는 기본 요약 카드, Claude는 기존 타일 renderer | 사용자 | ACTIVE |
| D-02 | 요약 → 활성/완료 하위 에이전트 목록 → 상세 대화, 뒤로 이동은 동일 패널 | 사용자 첨부 | ACTIVE |
| D-03 | 백그라운드 프로세스는 세션 셸 호출과 수신 로그의 읽기 전용 표시 | 사용자 답변 | ACTIVE |
| D-04 | PR 항목 없음. 소스는 Work 컨텍스트의 폴더·첨부·참조 자료와 기존 추가/열기 기능 | 사용자 답변 | ACTIVE |
| D-05 | transcript 배경, Claude 동작, 기존 diff·계획·artifact viewer 접근 유지 | 기존 합의 및 회귀 계약 | ACTIVE |
| D-06 | SDK 의존 수집은 opencode/v1, 공통 이력·상태 프로토콜 재사용 | 기존 합의 | ACTIVE |

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

## [구현자 기입]

설계 리뷰·강제 지점 전수·V-pair 자기확인·수정 잠금·Product/UX 파생 검토·잠재 문제·명시적 차이·구현 보고·Review Signals: 구현 후 기입.

## [검증자 기입] 파생 이슈

없음.
