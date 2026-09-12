# Plan — background-task-conformance

## 메타

| 항목 | 값 |
|---|---|
| slug | 0231-background-task-conformance |
| 작성자 | **Codex** — 사용자 명시 지시 |
| 일자 | 2026-09-12 |
| 상태 | IMPL_DONE |
| V mode / 기준 V | Baseline V / none |
| 이번 V revision / 유효 V | V1 / V1 |
| 매핑 | [첨부 원문](source-spec.md) 전체 대조·보완 구현, [진단](diagnosis.md) |
| 분리 작업 | 일반 출력 TEMP 정책은 0230; 이 문서는 SDK background 작업 수명·출력만 소유 |

# Part I — Product & UX Contract

## 1. Context / 목표

현재 Agent 호출 결과에 기대는 상태로는 일반 셸 작업·snapshot-only 작업이 빠지고 중단 요청을 실제 종료로 오표시한다. 작업 실행·라이브 목록·결과·연결을 분리하여 사용자가 현재 작업을 찾아 중단하고 출력과 과거 결과를 확인할 수 있게 한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 첨부 스펙과 구현을 비교하고 부족한 구현을 보완 | 현재 사용자 요청 |
| 명시 요구 | 핸드오프 작성자는 Codex | 현재 사용자 후속 지시 |
| 명시 결정 | “Bash도 활성화하여 두 셸 모두 사용” | Bash 기존 비활성 정책 질의에 대한 사용자 응답 |
| 구현 해석 | 기존 레이어·대화·산출물 동작을 유지하며 background 전용 관측/저장 경로를 추가 | 진단의 책임 경계 |
| 대상 자료 | `claude-agent-sdk-background-task-spec.md`, SHA256 `71289B306470F0555B515B77D6479D9A0C46D94C629CF60BF986D7BFCF9921C7` | 사용자 첨부, 2026-09-10 작성본 |

첨부는 목표 스펙이다. 그 안의 미검증 SDK 사실은 설치 선언·실제 메시지로 확인하며 구현 완료 보고로 승계하지 않는다.

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-01 | 전체 필수 수용 기준을 구현 범위에 포함 | 부분 개선만으로 완료 선언하지 않음 | 사용자 요청·첨부 §3 | ACTIVE | — |
| D-02 | Codex가 설계·구현 작성 | 작성자 허위 표기 방지 | 사용자 지시 | ACTIVE | 기존 역할 기본값에 대한 이번 작업 예외 |
| D-03 | SDK를 0.3.267로 고정하고 번들 CLI 사용 | 배포 선언과 실행 바이너리 일치 | 첨부 기준·부모 SDK 조사 | ACTIVE | — |
| D-04 | Bash와 PowerShell 둘 다 사용, WebSearch의 기존 제한 유지 | 셸 정책만 사용자 결정으로 변경 | 사용자 후속 응답 | ACTIVE | 기존 Bash disallowed 정책 대체 |
| D-05 | taskId·agentId·toolUseId·runId와 실행 세대 분리 | 우연히 같은 ID·문구로 연결 금지 | 첨부 식별자·상태 규칙 | ACTIVE | 구 toolUseId 단일 tracker 대체 |
| D-06 | ACK·timeout·snapshot 제외로 종료를 합성하지 않음 | 실행 사실과 요청 상태 분리 | 첨부 STOP·SNAPSHOT 기준 | ACTIVE | 구 watchdog/snapshot 합성 정착 대체 |
| D-07 | raw 원본은 앱 DB 한정, renderer/일반 로그/내보내기에서 제외 | 재해석과 민감 데이터 경계 동시 보장 | 첨부 보존·안전 요구 | ACTIVE | — |
| D-08 | 작업별 출력은 참조 ID·세대 검증 후 64KiB 이하 증분 읽기 | 임의 파일 읽기·대용량 반복 읽기 방지 | 첨부 출력 요구를 구체화한 구현 판단 | ACTIVE | — |
| D-09 | 조건부 기능은 가용성·선언 검증·실기 결과를 별도 기록 | 노출되나 미시험인 기능을 미지원으로 숨기지 않음 | 첨부 지원 완료 판정 | ACTIVE | — |
| D-10 | 상태 이벤트는 pump에서 독점 전달, transcript는 기존 버스 유지 | main 취소/draining에도 작업 관측 보존 | 코드 조사로 확인한 구현 선택 | ACTIVE | 구 coordinator 독점 관측 대체 |

갱신 메모: D-04는 사용자 응답으로 확정했다. ACTIVE D-01…D-10 ↔ AC1…AC24 대조 충돌 0; 필수 구현을 사람 실기로 대체하는 AC 없음.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 원인을 겨냥하는가 | 타당 | edge tracker와 snapshot의 혼합, [진단 F-01](diagnosis.md) |
| 이미 충족된 부분 | 보존 | 직접 하위 라우팅·중단 실패 UI·listen 턴·체크리스트 분리 |
| 작은 해법 | 개별 if 수정으로 불충분 | taskId 없는 호출과 toolUseId 없는 작업이 모두 존재 |
| 충돌하는 기존 동작 | 명시 대체 | watchdog의 stopped·snapshot 제외의 failed·중단 후 성공 강등 |
| 사용자에게 올릴 결정 | 없음 | Bash 정책 응답 확보; 신규 의존성 없음 |

## 5. 동작 / 사용자 흐름

```text
실제 호출/작업 관측 → 시작 확인·실행 상태·라이브 소속 표시
  → 완료/실패/중단 근거 + 결과/출력 상태 표시
  ↘ 개별 중단 요청 → ACK → 종료 확인 / 확인 불가·요청 오류
  ↘ 연결 공백 → 재동기화 / 새 실행 세대 + 과거 이력
```

| 사건 | 사용자 결과 |
|---|---|
| snapshot이 먼저 도착 | 도구 연결 없이도 작업 카드 생성, 후속 연결은 같은 카드 보강 |
| 종료 후 live 잔존 | “완료 · 실행 목록 동기화 중” 등 두 축 표시 |
| live 제외·종료 근거 없음 | “실행 목록에서 제외됨 · 종료 사유 미확인” |
| stop ACK만 존재 | “종료 확인 중”; 확인 제한 초과는 “종료 확인 불가” |
| 두 종료 근거 충돌 | 먼저 확보한 결과 보존 + 상태 불일치 표시 |
| 출력 삭제·권한 없음·원격 | 작업 결과 유지 + 출력 접근 상태 표시 |
| 새 프로세스·과거 재생 | 과거 결과를 남기고 현재 live를 초기화 |
| 중첩·합성 입력 | 부모 호출·출처 표식을 유지, main/사람 발화와 구분 |

동시 세션과 형제 작업은 명시 ID로 격리한다. 카드는 기존 Tailwind 시맨틱 토큰·버튼·키보드 접근과 두 테마를 사용하며 오류/제한 상태를 화면에서 읽을 수 있게 한다.

## 6. 범위 / 비범위

범위는 첨부 필수 기준과 가용 조건부 경로의 프로토콜/상태/제어/출력/이력 처리다. 실제 실기는 별도 증거 단계이며 미실행을 구현 성공으로 세지 않는다.

비범위는 Browser SSE/Remote Control 전송 전체, 팀/예약 편집기, 미확인 pause/resume API 신설이다. 기존 일반 산출물 TEMP 정책은 0230과 회귀 검증으로 연결하며 background 출력 권한을 넓히는 근거로 쓰지 않는다.

## 7. Requirements / Acceptance — R ↔ AT

| R | AT / AC | 동작 기준 | 검증 수단 — 직접 oracle | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-1 | AT-1 / AC1 | 입력 기본값이 아니라 실제 반환·시작·snapshot으로 실행 모드를 표시한다. agentId·taskId·toolUseId를 별도 보존하고 taskId 없는 런치도 시작 확인 중으로 남긴다. | 기본/false/강제 background·다른 ID·늦은 연결에서 별도 호출과 작업의 값 단언 | Agent 호출→mapper→call/task reducer→카드 |
| R-2 | AT-2 / AC2 | completed의 content·통계·실제 모델·worktree 원본을 보존한다. 실행 완료를 요구 완수로 단정하지 않고 새 호출이 이전 결과를 지우지 않는다. | content[]·maxTurns 텍스트·재호출 결과를 각각 확인 | 구조화 결과→저장→Agent 상세 |
| R-3 | AT-3 / AC3 | Bash와 PowerShell을 함께 활성화하고 원래 이름을 보존한다. 실제 task ID·timeout·stdout/stderr로 해석하며 셸 소유자·수명·인코딩은 배포 로그로 검증한다. | Bash 자동 전환·성공 stderr fixture, 두 셸 Windows 실기 | SDK 옵션·셸 결과→task→중단/출력 |
| R-4 | AT-4 / AC4 | 첫 snapshot부터 taskId 전체 집합을 교체한다. 시작보다 먼저 온 작업도 한 카드이며 소속과 종료는 별도다. 사라진 작업은 종료 사유 미확인이다. | snapshot-only·제외·종료 후 잔존의 소속/배지/종료 값 단언 | snapshot→reducer→tracker/activity→카드 |
| R-5 | AT-5 / AC5 | killed/completed/failed patch만으로 종료를 확인한다. 늦은 시작·진행은 재활성화하지 않고 다른 종료 근거는 충돌로 남긴다. false·0·빈 문자열은 유지한다. | 종료 역전·모순 종료·부분 patch 값 직접 단언 | task event→canonical reducer→wait/UI |
| R-6 | AT-6 / AC6 | 동일 UUID+payload는 멱등, 같은 UUID의 수정 payload는 보강한다. 알려지지 않거나 잘못된 필드는 원본·진단으로 보존하고 다른 작업 처리를 계속한다. | 중복 통지/출력 1회·수정 payload 반영·bad schema 뒤 정상 task 수신 | SDK 봉투→journal→정규화→reducer |
| R-7 | AT-7 / AC7 | 메인 result 뒤에도 시작 확인·라이브 작업·승인·stop 확인·대기 입력·자동 턴·재동기화가 있으면 소비를 유지한다. | result 뒤 task/승인/자동 응답 도착과 close 미발생 단언 | pump→runtime→post-turn→후속 응답 |
| R-8 | AT-8 / AC8 | 실제 taskId+세대로 대상만 중단한다. 요청·ACK·종료 확인을 구분하고 제한시간 후 확인 불가를 표시한다. 실패·늦은 ACK가 기존 결과를 덮지 않는다. | 형제 task 잔존·ACK/no event·완료 경합·throw 후 오류 단언 | 카드→preload→validated stop→task/stop event→카드 |
| R-9 | AT-9 / AC9 | 메인 응답 중지는 유지 대상 background 실행을 관찰한다. 전체 중단은 입력을 차단하고 최신 snapshot을 제한 횟수 재확인해 잔여·미확인을 표시한다. | 중단 중 새 task·missing snapshot·원격 잔여를 성공으로 오표시하지 않음 | Composer/전체 중단→interrupt/stop→snapshot→잔여 UI |
| R-10 | AT-10 / AC10 | still_queued 입력을 재전송하지 않는다. capability/응답 부재는 unknown이며 UUID 배열·턴 중 변경을 처리한다. | 병합·대응 변경·모르는 UUID·undefined 영수증에서 입력 소유권 단언 | 입력 UUID→SDK response/receipt→pendingMessages |
| R-11 | AT-11 / AC11 | SDK requestId·toolUseID·agentID로 승인·질문을 귀속한다. 재전달은 같은 요청이며 취소 후 응답은 실행되지 않는다. 한 도구 거부를 전체 실패로 만들지 않는다. | 동일 요청 재전달/역순 질문/작업 취소/늦은 승인/deny 범위 단언 | canUseTool→broker→UI→SDK 응답 |
| R-12 | AT-12 / AC12 | 중첩 부모를 늦게 알아도 하위 대화·도구·메타를 연결하며 main 텍스트와 분리한다. 사람·도구 반환·자동 입력의 출처를 구분한다. | 2단계 부모·순서 역전·합성 입력·형제 메타 맞바뀜 없는 렌더 단언 | parent ID/origin→history→중첩 상세 |
| R-13 | AT-13 / AC13 | heartbeat가 retry/승인 대기를 해제하지 않는다. 연결 생존과 의미 있는 진척을 별도 표시한다. | retry→heartbeat 반복 뒤 retry 유지 및 elapsed 표시 단언 | tool_progress→call/task→상태 UI |
| R-14 | AT-14 / AC14 | 같은 프로세스 재연결은 재동기화로, 새 CLI는 새 세대로 표시한다. 새 세대 live는 비고 과거 이벤트는 현재 실행/연결을 바꾸지 않는다. | 옛 generation task·worker 종료 재생과 새 live 공존 단언 | spawn/reinitialize/replay→connection/snapshot→DB/UI |
| R-15 | AT-15 / AC15 | 원래 필드별 출력 참조와 완료 시 확보한 snapshot을 보존한다. 증분 출력·접근 실패·교체/잘림·완료 후 수정 상태는 작업 종료와 구분한다. | 증가·삭제·권한·truncate·replace·완료 snapshot/current file 차이 단언 | 출력 참조→validated read→증분 viewer |
| R-16 | AT-16 / AC16 | main 소유 참조 중 허용 루트의 실제 경로만 읽는다. canReadOutputFile:false·URI·루트 이탈은 직접 읽지 않고 콘텐츠를 실행/자동 전송하지 않는다. | symlink·Windows 경계·악성 HTML/ANSI·false read spy 0 및 허용 파일 내용 단언 | renderer outputId→main 권한/realpath→bounded read→text |
| R-17 | AT-17 / AC17 | task progress와 최종 통계는 각각 snapshot이다. 메인 턴 usage와 query 누적 modelUsage를 구분하고 새 프로세스의 기준을 재설정한다. | 두 progress+두 누적 result+restart에서 과금/표시의 정확한 값 단언 | SDK stats→reducer/usage→저장/UI |
| R-18 | AT-18 / AC18 | TaskXXX 체크리스트 수정은 background 개수·중단 대상에 영향을 주지 않는다. | 같은 문자열 ID의 체크리스트·실행을 각각 수정/중단하여 형제 불변 | TaskXXX 결과→기존 taskBoard / canonical background 분리 |
| R-19 | AT-19 / AC19 | 제공되는 Monitor의 원래 종류·stdout/WebSocket 진행·timeout·persistent·출력·중단을 해석한다. CLI 종료 후 서비스 존속으로 추정하지 않는다. | 선언 기반 fixture와 가용 환경별 실제 동작 결과를 분리 | Monitor 반환/이벤트→canonical state→UI |
| R-20 | AT-20 / AC20 | async_launched+error는 시작 실패다. taskId/runId/내부 agent·blocked·재실행 결과를 분리하고 중단 후 잔여를 확인한다. | start error·자식 완료·run 재사용·stop 잔여 fixture 및 실제 가용 로그 | Workflow 결과/내부 이벤트→call/task graph→UI |
| R-21 | AT-21 / AC21 | 분리 Skill/MCP를 명시 연결로 추적하고 resourceLinks/resource_links/_meta를 호출에 보존한다. 임의 텍스트를 task 이벤트로 해석하지 않는다. | 없는 taskId 생성 없음·중복 링크 1회·하위 _meta 보존 단언 | Skill/MCP 봉투→call/task/output refs→저장/UI |
| R-22 | AT-22 / AC22 | remote/ambient를 기록하고 배지 필터와 수명을 분리한다. 원격 미확인을 성공/중단으로 확정하지 않는다. TaskOutput은 일반 결과 호환이며 미확인 큐취소 API를 만들지 않는다. | 원격 로컬종료·ambient-only·TaskOutput 일반 결과·capability 없음 제한 표시 | 원격/ambient/legacy 입력→state→UI/control |
| R-23 | AT-23 / AC23 | SDK 0.3.267 선언·실제 CLI 버전/경로·지속/단발·Windows/제공 경로를 기록한다. 실제 로그 없는 항목은 미검증이며 노출 기능을 미지원으로 위장하지 않는다. | npm 선언/typecheck·init 기록·실기 결과 표, 필수/조건부 차집합 | bundle/SDK init→profile evidence→진단 |
| R-24 | AT-24 / AC24 | 기존 대화·일반 산출물·세션 격리를 보존하고 작업 이력만 추가한다. raw는 제한된 앱 DB에만 보존하며 renderer/일반 로그/내보내기로 노출하지 않는다. | 이전 DB 업그레이드·중복 저장·새 프로세스 복원·비밀 raw 노출 금지·0230 회귀 | bus→HistoryWriter transaction→reload / sanitized relay |

수용 ID 전체 배정은 [diagnosis.md](diagnosis.md)의 대조표가 갖는다. 각 AC의 합성 fixture 검증과 실제 배포 검증을 별도 칸에 기록한다; 선언만으로 실제 실행 PASS를 만들지 않는다.

## 7-A. V / Trace Matrix

Baseline V1은 제품 결과·수명·저장/IPC·순수 상태를 모두 변경하므로 R↔AT, SD↔ST, AR↔IT, MD↔UT를 포함한다. 기존 V를 통째로 승계하지 않으며 회귀 노드는 현재 코드 경로를 명시한다.

### Node registry

| Node | 레벨 | 계약 | provenance | 근거 |
|---|---|---|---|---|
| R-1 / AT-1 | R / AT | §7 AC1: 실행 모드와 ID | NEW | 첨부 AGENT-DEFAULT, AGENT-FOREGROUND, AGENT-FORCED, AGENT-LAUNCH |
| R-2 / AT-2 | R / AT | §7 AC2: 완료·재호출 결과 | NEW | 첨부 AGENT-COMPLETE, AGENT-PARTIAL, AGENT-RESUMED |
| R-3 / AT-3 | R / AT | §7 AC3: 셸 | NEW | 첨부 BASH-EXPLICIT, BASH-TIMEOUT, BASH-TIMEOUT-EXCEPTION, BASH-STDERR, BASH-LIFETIME, POWERSHELL-BACKGROUND, POWERSHELL-ENCODING |
| R-4 / AT-4 | R / AT | §7 AC4: 라이브 집합 | NEW | 첨부 START-AFTER-SNAPSHOT, SNAPSHOT-DISAPPEAR, TERMINAL-STILL-LIVE |
| R-5 / AT-5 | R / AT | §7 AC5: 종료와 patch | NEW | 첨부 END-BEFORE-START, STOP-WITHOUT-NOTIFICATION, TERMINAL-CONFLICT, PATCH-ABSENCE |
| R-6 / AT-6 | R / AT | §7 AC6: 중복·미지 프로토콜 | NEW | 첨부 DUPLICATE-EVENT, UNKNOWN-SCHEMA, MALFORMED-KNOWN |
| R-7 / AT-7 | R / AT | §7 AC7: 메인 결과 이후 수신 | NEW | 첨부 MAIN-RESULT-EARLY, IDLECLOSE-PENDING |
| R-8 / AT-8 | R / AT | §7 AC8: 개별 중단 | NEW | 첨부 STOP-TASK, STOP-RACE, STOP-FAILURE |
| R-9 / AT-9 | R / AT | §7 AC9: 메인·전체 중단 | NEW | 첨부 STOP-MAIN-ONLY, STOP-DEFAULT, STOP-ALL-RACE |
| R-10 / AT-10 | R / AT | §7 AC10: 입력 대응·큐 | NEW | 첨부 INTERRUPT-QUEUE, QUEUE-UNKNOWN, INPUT-MERGE |
| R-11 / AT-11 | R / AT | §7 AC11: 승인·질문 | NEW | 첨부 PERMISSION-BACKGROUND, PERMISSION-REDELIVERY, PERMISSION-CANCEL, PERMISSION-DENY, QUESTION-BACKGROUND |
| R-12 / AT-12 | R / AT | §7 AC12: 하위 대화 | NEW | 첨부 AGENT-NESTED, TRANSCRIPT-ROUTING |
| R-13 / AT-13 | R / AT | §7 AC13: 재시도·생존 | NEW | 첨부 RETRY-HEARTBEAT |
| R-14 / AT-14 | R / AT | §7 AC14: 연결·새 프로세스 | NEW | 첨부 RECONNECT-LIVE, RESTART-PROCESS, REPLAY-HISTORY |
| R-15 / AT-15 | R / AT | §7 AC15: 출력 읽기 | NEW | 첨부 OUTPUT-PARTIAL, OUTPUT-UNAVAILABLE, OUTPUT-MODIFIED |
| R-16 / AT-16 | R / AT | §7 AC16: 출력 안전 | NEW | 첨부 OUTPUT-SAFETY |
| R-17 / AT-17 | R / AT | §7 AC17: 사용량 | NEW | 첨부 USAGE-SNAPSHOT |
| R-18 / AT-18 | R / AT | §7 AC18: 체크리스트 회귀 | NEW | 첨부 TASKLIST-SEPARATION |
| R-19 / AT-19 | R / AT | §7 AC19: Monitor | NEW | 첨부 MONITOR-COMMAND, MONITOR-WEBSOCKET, MONITOR-PERSISTENT |
| R-20 / AT-20 | R / AT | §7 AC20: Workflow | NEW | 첨부 WORKFLOW-START-ERROR, WORKFLOW-CHILDREN, WORKFLOW-STOP, WORKFLOW-RESUME |
| R-21 / AT-21 | R / AT | §7 AC21: Skill·MCP | NEW | 첨부 SKILL-DETACHED, MCP-AUTO-BACKGROUND, MCP-RESOURCES, MCP-META |
| R-22 / AT-22 | R / AT | §7 AC22: 원격·ambient·구형 제어 | NEW | 첨부 REMOTE-AGENT, REMOTE-DISCONNECT, AMBIENT-TASK, LEGACY-TASKOUTPUT, CANCEL-QUEUED |
| R-23 / AT-23 | R / AT | §7 AC23: 배포 지원 판정 | NEW | 첨부 ONE-SHOT-EXIT |
| R-24 / AT-24 | R / AT | §7 AC24: 호환 영속·개인정보 | NEW | 첨부 REPLAY-HISTORY, DUPLICATE-EVENT, OUTPUT-MODIFIED |
| SD-1 / ST-1 | SD / ST | main result·취소·재시작 뒤 관측 수명 (§13) | NEW | AC7·9·14 |
| SD-2 / ST-2 | SD / ST | 제어·출력·재로드 사용자 경로 (§9) | NEW | AC8·15·16·24 |
| AR-1 / IT-1 | AR / IT | pump 독점 callback·journal·relay (§10) | NEW | D-10 |
| AR-2 / IT-2 | AR / IT | 영속·세대·IPC main 권위 (§10) | NEW | D-05·07·08 |
| AR-3 / IT-3 | AR / IT | 승인·입력·모델 사용량 경계 | NEW | AC10·11·17 |
| MD-1 / UT-1 | MD / UT | 별도 call/task/live 집합·멱등·종료 근거 reducer | NEW | AC1·4·5·6 |
| MD-2 / UT-2 | MD / UT | 출력 경로·증분 cursor·렌더 제한 | NEW | AC15·16 |
| R-REG / AT-REG | R / AT | 기존 main/직접 child 대화·체크리스트·일반 산출물 | INHERITED | 현재 parts/taskBoard/artifacts; 0230 변경 후 함께 재검증 |

### Pair registry

| Pair | left ↔ right | requiredness | production path | 직접 oracle | 선택적 적대 증거 | §10 강제 지점 |
|---|---|---|---|---|---|---|
| VP-R1 | R-1 ↔ AT-1 | REQUIRED | Agent 호출→mapper→call/task reducer→카드 | 기본/false/강제 background·다른 ID·늦은 연결에서 별도 호출과 작업의 값 단언 | not selected — 상태·값 직접 관측 | EP-01,EP-02,EP-03,EP-11 |
| VP-R2 | R-2 ↔ AT-2 | REQUIRED | 구조화 결과→저장→Agent 상세 | content[]·maxTurns 텍스트·재호출 결과를 각각 확인 | not selected — 상태·값 직접 관측 | EP-01,EP-02,EP-07,EP-11 |
| VP-R3 | R-3 ↔ AT-3 | REQUIRED | SDK 옵션·셸 결과→task→중단/출력 | Bash 자동 전환·성공 stderr fixture, 두 셸 Windows 실기 | not selected — 상태·값 직접 관측 | EP-01,EP-02,EP-09,EP-12 |
| VP-R4 | R-4 ↔ AT-4 | REQUIRED | snapshot→reducer→tracker/activity→카드 | snapshot-only·제외·종료 후 잔존의 소속/배지/종료 값 단언 | not selected — 상태·값 직접 관측 | EP-01,EP-03,EP-04,EP-11 |
| VP-R5 | R-5 ↔ AT-5 | REQUIRED | task event→canonical reducer→wait/UI | 종료 역전·모순 종료·부분 patch 값 직접 단언 | not selected — 상태·값 직접 관측 | EP-02,EP-03,EP-05,EP-11 |
| VP-R6 | R-6 ↔ AT-6 | REQUIRED | SDK 봉투→journal→정규화→reducer | 중복 통지/출력 1회·수정 payload 반영·bad schema 뒤 정상 task 수신 | not selected — 상태·값 직접 관측 | EP-01,EP-02,EP-07 |
| VP-R7 | R-7 ↔ AT-7 | REQUIRED | pump→runtime→post-turn→후속 응답 | result 뒤 task/승인/자동 응답 도착과 close 미발생 단언 | not selected — 상태·값 직접 관측 | EP-04,EP-06,EP-08 |
| VP-R8 | R-8 ↔ AT-8 | REQUIRED | 카드→preload→validated stop→task/stop event→카드 | 형제 task 잔존·ACK/no event·완료 경합·throw 후 오류 단언 | not selected — 상태·값 직접 관측 | EP-03,EP-05,EP-09,EP-11 |
| VP-R9 | R-9 ↔ AT-9 | REQUIRED | Composer/전체 중단→interrupt/stop→snapshot→잔여 UI | 중단 중 새 task·missing snapshot·원격 잔여를 성공으로 오표시하지 않음 | not selected — 상태·값 직접 관측 | EP-05,EP-06,EP-09,EP-11 |
| VP-R10 | R-10 ↔ AT-10 | REQUIRED | 입력 UUID→SDK response/receipt→pendingMessages | 병합·대응 변경·모르는 UUID·undefined 영수증에서 입력 소유권 단언 | not selected — 상태·값 직접 관측 | EP-01,EP-06 |
| VP-R11 | R-11 ↔ AT-11 | REQUIRED | canUseTool→broker→UI→SDK 응답 | 동일 요청 재전달/역순 질문/작업 취소/늦은 승인/deny 범위 단언 | not selected — 상태·값 직접 관측 | EP-08,EP-11 |
| VP-R12 | R-12 ↔ AT-12 | REQUIRED | parent ID/origin→history→중첩 상세 | 2단계 부모·순서 역전·합성 입력·형제 메타 맞바뀜 없는 렌더 단언 | not selected — 상태·값 직접 관측 | EP-01,EP-02,EP-07,EP-11 |
| VP-R13 | R-13 ↔ AT-13 | REQUIRED | tool_progress→call/task→상태 UI | retry→heartbeat 반복 뒤 retry 유지 및 elapsed 표시 단언 | not selected — 상태·값 직접 관측 | EP-01,EP-02,EP-06,EP-11 |
| VP-R14 | R-14 ↔ AT-14 | REQUIRED | spawn/reinitialize/replay→connection/snapshot→DB/UI | 옛 generation task·worker 종료 재생과 새 live 공존 단언 | not selected — 상태·값 직접 관측 | EP-01,EP-02,EP-06,EP-07 |
| VP-R15 | R-15 ↔ AT-15 | REQUIRED | 출력 참조→validated read→증분 viewer | 증가·삭제·권한·truncate·replace·완료 snapshot/current file 차이 단언 | not selected — 상태·값 직접 관측 | EP-07,EP-09,EP-10,EP-11 |
| VP-R16 | R-16 ↔ AT-16 | REQUIRED | renderer outputId→main 권한/realpath→bounded read→text | symlink·Windows 경계·악성 HTML/ANSI·false read spy 0 및 허용 파일 내용 단언 | not selected — 상태·값 직접 관측 | EP-09,EP-10,EP-11 |
| VP-R17 | R-17 ↔ AT-17 | REQUIRED | SDK stats→reducer/usage→저장/UI | 두 progress+두 누적 result+restart에서 과금/표시의 정확한 값 단언 | not selected — 상태·값 직접 관측 | EP-01,EP-02,EP-07,EP-12 |
| VP-R18 | R-18 ↔ AT-18 | REQUIRED | TaskXXX 결과→기존 taskBoard / canonical background 분리 | 같은 문자열 ID의 체크리스트·실행을 각각 수정/중단하여 형제 불변 | not selected — 상태·값 직접 관측 | EP-03,EP-11 |
| VP-R19 | R-19 ↔ AT-19 | REQUIRED | Monitor 반환/이벤트→canonical state→UI | 선언 기반 fixture와 가용 환경별 실제 동작 결과를 분리 | not selected — 상태·값 직접 관측 | EP-01,EP-02,EP-06,EP-10 |
| VP-R20 | R-20 ↔ AT-20 | REQUIRED | Workflow 결과/내부 이벤트→call/task graph→UI | start error·자식 완료·run 재사용·stop 잔여 fixture 및 실제 가용 로그 | not selected — 상태·값 직접 관측 | EP-01,EP-02,EP-05,EP-11 |
| VP-R21 | R-21 ↔ AT-21 | REQUIRED | Skill/MCP 봉투→call/task/output refs→저장/UI | 없는 taskId 생성 없음·중복 링크 1회·하위 _meta 보존 단언 | not selected — 상태·값 직접 관측 | EP-01,EP-02,EP-07,EP-10 |
| VP-R22 | R-22 ↔ AT-22 | REQUIRED | 원격/ambient/legacy 입력→state→UI/control | 원격 로컬종료·ambient-only·TaskOutput 일반 결과·capability 없음 제한 표시 | not selected — 상태·값 직접 관측 | EP-01,EP-02,EP-05,EP-06,EP-11 |
| VP-R23 | R-23 ↔ AT-23 | REQUIRED | bundle/SDK init→profile evidence→진단 | npm 선언/typecheck·init 기록·실기 결과 표, 필수/조건부 차집합 | not selected — 상태·값 직접 관측 | EP-01,EP-07,EP-12 |
| VP-R24 | R-24 ↔ AT-24 | REQUIRED | bus→HistoryWriter transaction→reload / sanitized relay | 이전 DB 업그레이드·중복 저장·새 프로세스 복원·비밀 raw 노출 금지·0230 회귀 | not selected — 상태·값 직접 관측 | EP-07,EP-09,EP-10,EP-12 |
| VP-S1 | SD-1 ↔ ST-1 | REQUIRED | query→routeBatch→callback→tracker→post-turn | main 취소 후 task 완료/승인 도착, 세대 전환 후 old replay 무해 | not selected — 실제 pump fixture | EP-01,EP-03,EP-04,EP-06,EP-08 |
| VP-S2 | SD-2 ↔ ST-2 | REQUIRED | 카드→IPC→DB/SDK/fs→reload→카드 | stop ACK·오류·partial output·reload 상태값 | not selected — 결과 직접 관측 | EP-05,EP-07,EP-09,EP-10,EP-11 |
| VP-A1 | AR-1 ↔ IT-1 | REQUIRED | map→routeBatch→onProviderEvent→journal/state/relay | draining/unframed/취소 중에도 DB 1회, renderer raw 0 | required — callback 소거·raw relay 유출 변이 | EP-01,EP-06,EP-07,EP-12 |
| VP-A2 | AR-2 ↔ IT-2 | REQUIRED | 신규 migration→HistoryWriter→state IPC→stop/read | 이전 DB 업그레이드·세션/세대/참조 바꿔치기 거부·정상 읽기 | not selected — 실제 SQLite/fs 행동 | EP-07,EP-09,EP-10 |
| VP-A3 | AR-3 ↔ IT-3 | REQUIRED | SDK callback/receipt/stats→기존 서비스→UI | 동일 승인 재전달·UUID 변경·누적 stats 정확 값 | not selected — 경계 실제 payload | EP-01,EP-06,EP-08,EP-12 |
| VP-M1 | MD-1 ↔ UT-1 | REQUIRED | canonical event→shared reducer→record/live/call | 순서 역전·중복·충돌·false/0·generation 상태 단언 | not selected — 순수 직접 oracle | EP-02,EP-03 |
| VP-M2 | MD-2 ↔ UT-2 | REQUIRED | outputId→policy→bounded reader→viewer | symlink/false read 금지·허용 내용·truncate 식별 | not selected — 실제 임시 파일 행동 | EP-10,EP-11 |
| VP-REG | R-REG ↔ AT-REG | REGRESSION | 일반/child/TaskXXX/ordinary output→기존 UI | 기존 동작과 새 task 상태의 형제 분리 | not selected — 실제 렌더·파일 값 | EP-02,EP-11,EP-12 |

### 현재 변경의 운영 gate

| Gate | 이유 | 명령/증거 | 실패 범위 |
|---|---|---|---|
| 정적 | main/preload/renderer/shared 변경 | app의 typecheck, lint; lint의 autofix diff 확인 | 변경 회귀 |
| 동작 | 순수 reducer·pump·DB·출력·renderer 경계 | 관련 Vitest, 신규 DB 통합; §19 | 명시 pair |
| DB | migration 추가 | append-only guard + 이전 DB 열기 | 신규 schema 실패 |
| 문서 | IPC·현재 아키텍처 계약 | check-doc-inventory --check, 상대 링크 검사 | 변경 산출물 |
| 메시지 버스 | plan/impl 별도 커밋·INDEX | git diff --check, trailer 파싱 | 현재 커밋/보드 |
| 배포 | SDK/CLI·Windows 두 셸 | 실제 프로필 로그·미검증 목록 | 실기 미측정은 지원 완료 미선언 |

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

상세 근거는 [diagnosis.md](diagnosis.md)에 보존한다. 관련 정본은 [runtime](../../arch/backend/runtime-ipc.md), [adapters](../../arch/backend/adapters.md), [persistence](../../arch/backend/persistence.md), [renderer state](../../arch/frontend/state.md), [IPC](../../IPC_CONTRACT.md)다.

| 대상 | 검색/방법 | 관측 |
|---|---|---|
| task 관측/합성 | `rg -n 'applyLiveSet|coerceStopped|subagentTaskIds|subagent.backgroundSet' app/src` | tracker·coordinator·settle·mapper·renderer 경로 확인 |
| tracker 소비 | `rg -n 'backgroundTasks' app/src/main/app app/src/main/features/chat` | §12에 상태·수명·종료 소비처 분류 |
| 출력 경로 | `rg -n 'readTaskOutput|output_file|rawOutputPath|persistedOutputPath' app/src` | task 출력 전용 서비스 없음; 일반 artifacts와 별도 |
| 상태 영속 | writer task/ tool result switch 직접 읽음 | task 메타 transient, 부모 결과 upsert |
| DB migration | migrate.ts import/등록 확인 | 다음 파일 `0027_background_events.sql` 사용 가능 |
| 기존 테스트 | 직접 Vitest 실행 | background-tasks·stop-subagent·subagent-settlement·parts.stale-async: 4파일 41테스트 통과, 현재 오판 기대도 포함 |

인벤토리 수치는 앱 구조의 상시 사본이 아니라 이번 변경 강제 지점 집합으로만 §10에 둔다. 실제 SDK 프로필 검증은 별도 증거이며 단위 테스트 통과와 합산하지 않는다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
SDK → claude-map subagent(task→toolUse 매핑)
    → SessionRuntime frame/draining → TurnCoordinator
    → edge tracker + synthetic tool result → HistoryWriter → parts 기반 Agent 카드
```

snapshot 미매핑 항목은 사라지고 draining 중 프레임은 버려진다. stop timeout·snapshot 제외·채널 사망의 합성 결과가 SDK 결과와 같은 transcript 권위를 가진다.

### TO-BE

```text
SDK → mapper ProviderMessageBatch.providerEvents (canonical + provider.message)
    → SessionRuntime live-token 검사 → onProviderEvent (frame/draining 이전, 독점 소비)
    → HistoryWriter append → BackgroundTaskTracker.observe → sanitized relay/state IPC
    → shared reducer 기반 renderer 작업 상태·카드·출력

기존 transcript event → 기존 frame/coordinator/bus → 기존 history/renderer
```

| 축 | AS-IS | TO-BE | 연결 |
|---|---|---|---|
| 소유권 | coordinator만 관측 | pump callback이 task/journal 소유 | AR-1, EP-06 |
| 상태 | toolUseId Map·결과 덮기 | generation/taskId record + calls + live Set | MD-1, EP-02·03 |
| 영속 | 부모 tool_result | 추가 event 테이블 재생 + 기존 transcript | AR-2, EP-07 |
| 종료 | watchdog/제외로 추정 | terminalEvidence·stop·membership 별도 | SD-2, EP-05 |
| UI | root Agent parts만 | canonical 모든 종류 + 명시 연결 child 상세 | R-1…R-24, EP-11 |

## 10. 계약 / 타입 / 강제 지점

`ProviderMessageBatch.providerEvents?: (BackgroundEvent | ProviderMessageEvent)[]`는 기존 `events: NormalizedEvent[]`와 별도 lane이다. provider.message는 NormalizedEvent에 추가하지 않으며 runtime은 이 lane을 callback에만 전달한다.

계약 파일은 `app/src/shared/background-task.ts`다. 아래 이름과 필드를 mapper·main·renderer가 공유하고 이 파일은 runtime 의존 없는 순수 타입/reducer만 갖는다.

```ts
type BackgroundEventSource = {
  generation: string; sequence: number; receivedAt: number
  replay: boolean; uuid?: string
}
type BackgroundOutputRef = {
  id: string; field: string; value: string
  kind: 'file' | 'uri' | 'directory'; canRead?: boolean
}
type BackgroundEvent =
  | { type: 'background.task'; sessionId: string; source: BackgroundEventSource
      taskId: string; toolUseId?: string
      phase: 'started' | 'progress' | 'updated' | 'notification'
      patch: BackgroundTaskPatch }
  | { type: 'background.snapshot'; sessionId: string; source: BackgroundEventSource
      tasks: BackgroundTaskIdentity[] }
  | { type: 'background.call'; sessionId: string; source: BackgroundEventSource
      toolUseId: string; toolName?: string; parentToolUseId?: string
      phase: 'started' | 'progress' | 'returned'
      input?: unknown; result?: unknown; structuredOutput?: unknown; meta?: unknown
      patch?: BackgroundCallPatch }
  | { type: 'background.connection'; sessionId: string; source: BackgroundEventSource
      state: 'connected' | 'resynchronizing' | 'disconnected' | 'terminated'
      sdkVersion?: string; cliVersion?: string; cliPath?: string; reason?: string }
type ProviderMessageEvent = {
  type: 'provider.message'; sessionId: string
  source: BackgroundEventSource; raw: unknown
}
```

`BackgroundTaskIdentity`는 taskId 필수, taskType/description/ambient 선택이다. `BackgroundTaskPatch`는 taskType/description/status/isBackgrounded/ambient/spawnDepth/subagentType/endTime/totalPausedMs/error/summary/lastToolName/totalTokens/toolUses/durationMs/usage/outputFile/resourceLinks/outputRefs/agentId/parentToolUseId/parentAgentId를 선택 필드로 갖는다.

`BackgroundCallPatch`는 agentId/taskId/runId/mode/status/outputRefs/outputFile/canReadOutputFile/retry/heartbeat/elapsedTimeSeconds/summary/usage를 선택 필드로 갖는다. mode는 foreground/background/remote이며 알려지지 않은 필드는 raw journal에 남긴다; patch 누락은 무변경, false/0/빈 문자열은 값, 비정상 null은 삭제가 아니다.

`BackgroundSessionState`는 current generation/connection/liveKnown/liveTaskIds, 세대별 tasks/calls, dedupe metadata를 갖는다. `BackgroundTaskRecord`는 원래 taskId·명시 toolUseId, 최신 상세, terminalEvidence 배열, liveMembership(included/excluded/unknown), stop(requested/acknowledged/failed/unconfirmed + 시간/오류)를 분리한다.

`applyBackgroundEvent(state,event)`는 순수 reducer다. 호출 키는 generation+toolUseId, 작업 키는 generation+taskId이며 충돌 없는 인코딩 함수를 공유한다; Agent agentId를 작업 키로 쓰지 않는다. 동일 UUID+동일 payload만 중복이고 다른 payload는 보강한다; replay는 과거 이력에만 반영하며 현재 connection/live를 바꾸지 않는다.

`BackgroundTaskTracker`는 `observe(event)`, `getState(sessionId)`, `hasPending(sessionId)`, `count(sessionId)`, `subscribe`를 소유한다. count는 최신 live snapshot의 non-ambient 집합이고 hasPending은 live/미확인 런치/승인/stop/재동기화 보류를 포함한다; 기존 legacy edge helper는 canonical을 덮지 않는다.

호스트 제어도 별도 이벤트다. `background.control {sessionId,source,taskId,state:'requested'|'acknowledged'|'failed'|'unconfirmed',error?}`는 stop 보조 상태만 갱신한다. `background.output {sessionId,source,taskId,outputId,snapshot:{id,capturedAt,size,sha256,partial}|undefined,error?}`는 확보된 출력만 보강하며 task terminal을 바꾸지 않는다. 호스트 source는 독립 UUID를 사용하고 SDK 원본 메시지로 가장하지 않는다.

| EP | 계약/SSOT | 강제 지점 전수 — 함수/파일 | 수 | 실패 의미 |
|---|---|---|---:|---|
| EP-01 | SDK 실제 선언→source/canonical | claude.ts query 옵션/세대; claude-map.ts system; assistant/user; tool_progress; SDK init/종료 | 5 | 봉투·가용성·단위·종류·ID 손실 |
| EP-02 | shared reducer·projection | background-task.ts call; task; snapshot; connection; dedupe; renderer parts child projection | 6 | ID 혼합·상태 역행·중복·child 데이터 손실 |
| EP-03 | main canonical tracker | background-tasks.ts observe; getState; count; hasPending; 세대 초기화/retire | 5 | snapshot 누락·거짓 배지·닫힘 오판 |
| EP-04 | 활성/수신 여부 | session-activity-projector.compute; chat-turn/post-turn 판정; continuation 수신 구성 | 3 | 실행 누락·후속 턴 유실 |
| EP-05 | 종료 근거와 제어 | stop-subagent 개별 요청; settleTaskSubset; settleTrackedTasks; coerceStoppedToolCompletion; coordinator legacy settlement | 5 | ACK/timeout/제외/중단 요청으로 실제 결과 덮기 |
| EP-06 | pump 수명 | session-runtime routeBatch; channel retire/teardown; turn-request callback; send 최초 callback; continuation callback; interrupt receipt/input UUID 처리 | 6 | draining 유실·이중 소비·세대 역전·큐 재전송 |
| EP-07 | append·재생·권위 | migration0027/migrate 등록; background-task-queries; HistoryWriter.recordProviderEvent; getState 복원; sanitized relay; 세션 삭제 CASCADE | 6 | raw 손실/유출·중복 영속·옛 실행 부활 |
| EP-08 | 승인/질문 수명 | claude permission callback; approval requester; broker register/resolve; Ask 답변 매칭 | 4 | 요청 중복·형제 귀속 오류·늦은 승인 |
| EP-09 | renderer 입력 신뢰 경계 | shared IPC/protocol schemas; preload; chat background handlers; stop task+generation lookup; output ref lookup | 5 | 임의 대상 제어/파일 읽기 |
| EP-10 | task 출력 | output policy resolve/realpath; bounded reader; cursor replacement/truncate; completion snapshot/해시; canRead/URI 거부 | 5 | 무단 읽기·무한/중복 출력·원본/보존 혼동 |
| EP-11 | 사용자 상태 | chatStore ingest/load; canonical 카드 목록; 카드 상세/중첩; stop/wait/전체중단; output viewer; i18n 상태 문구 | 6 | 종류 누락·오표시·오류 무음·접근성 회귀 |
| EP-12 | 기존 소비/운영 | usage cumulative baseline; bootstrap 등록/종료; 기존 TaskXXX; 일반 artifacts/0230; IPC/arch 문서 | 5 | 사용량 이중 합산·기존 기능/규칙 회귀 |

강제 지점 분모는 **61**이다(5+6+5+3+5+6+6+4+5+5+6+5). 이는 호출 횟수 주장이 아니라 위에서 열거한 책임 지점이며 구현자는 각 하위 지점까지 재열거한다. source raw는 `provider.message`만 소유하며 canonical renderer event에 raw를 복제하지 않는다.

### IPC/영속의 구체 계약

- `chatBackgroundEvent`: sanitized canonical 이벤트 전용 구독 채널; preload subscription→chatStore가 소유 세션에 적용한다.
- `chatStopAllBackgroundTasks({sessionId,generation})`: 입력 수락 제어·bounded stop/recheck 후 residual/unknown 반환.
- `chatBackgroundState({sessionId})`: DB 재생과 현재 main tracker를 합성한 sanitized `BackgroundSessionState`; raw/seenEvents 제외.
- `chatStopBackgroundTask({sessionId,generation,taskId})`: main-owned record·현재 세대·연결 검증 후 SDK stopTask; stop 결과를 상태 이벤트로 알림.
- `chatReadBackgroundOutput({sessionId,generation,taskId,outputId,offset,maxBytes})`: 정수 offset≥0, maxBytes 1…65536. renderer는 경로를 전달하지 않는다.
- 전체 중단은 현재 main 입력 수락을 제어하고 snapshot을 최대 3회 재확인한다. 각 재확인은 2초 한도이며 새로운 작업·snapshot 미수신을 residual/unknown으로 반환한다; 무조건 성공 Promise로 표현하지 않는다.
- `background_task_events`는 session FK CASCADE, generation, sequence, received_at, event_key, payload_json을 append한다. 동등 중복은 idempotent key로 억제하되 수정 payload는 별도 row다; raw와 canonical source 구분이 key에 포함된다.
- 신규 DB는 `0027_background_events.sql`, `background-task-queries.ts`로 추가한다. 기존 migration은 수정하지 않는다.
- `HistoryWriter.recordProviderEvent`는 assistant message를 만들지 않는다. 최초 provider lane이 session.updated보다 빠를 수 있으므로 세션 row가 없으면 generation/session별로 버퍼링한 뒤 session 생성 시 순서대로 commit한다. DB 실패는 state/relay 전에 전파하여 메모리만 앞서 나가지 않게 한다.
- 출력 응답은 text·offset/nextOffset·파일 identity/size·상태(partial/available/missing/denied/remote/changed/truncated)를 갖는다. 완료 시 확보 snapshot과 현재 파일은 별도이며 snapshot 저장 실패도 작업 terminal을 바꾸지 않는다.
- 출력 요청에는 `view?: 'current'|'snapshot'`, `cursor?: {identity:string,size:number,mtimeMs:number}`를 추가한다. 응답은 `{status,text?,offset,nextOffset,size?,cursor?,eof?,view,error?}`다. cursor는 파일 교체·같은 크기 덮어쓰기·잘림 검출 보조이며 접근 권한은 main의 record/ref 검증이 결정한다.
- 완료 출력 snapshot은 허용된 로컬 파일을 최대 16MiB까지 스트리밍 확보한다. 초과하면 `partial:true`와 실제 확보 크기·확보 바이트의 sha256을 기록하며 전체 파일 hash로 주장하지 않는다. `userData/background-outputs`에 안전한 임의 파일명으로 저장하고 IPC는 이 저장 경로를 받지 않는다.

`message.reasoning.parentToolRunId`를 추가해 하위 생각도 같은 라우팅 규칙을 쓴다. telemetry의 `userMessageUuid/userMessageUuids/queuedTurnCount`를 선택 필드로 보존하고 하위 assistant는 메인 context usage 갱신에서 제외한다.

승인 requestId는 SDK 전달값을 세대와 함께 멱등 키로 쓰고 toolUseID/agentID를 보존한다. Ask 답변은 toolUseId로 연결하여 FIFO를 제거한다; perTaskStop 유지 대상 child 승인은 main controller abort가 아니라 SDK request signal 취소를 따른다.

legacy `subagent.backgroundSet` 생산·coordinator 소비를 제거한다. legacy `subagent.task`는 명시 task→toolUse 연결이 있는 transcript projection만 유지하며 completed/failed patch도 종료를 투영한다.

## 11. 구현 설계

| 소유 | 변경 파일/영역 | 작업 | seam |
|---|---|---|---|
| adapter 담당 | adapters/claude*.ts, adapters/turn.ts, sessions/session-runtime.ts, package/lock | SDK 고정·canonical/journal·callback·세대·옵션·큐 | 실제 mapper+pump fixture |
| state/UI 담당 | shared/background-task.ts, chat/background-tasks.ts, coordinator/settle/stop, renderer chat | reducer·추적·거짓 합성 제거·모든 종류 카드·중첩·출력 UI | pure reducer + renderer |
| 부모 통합 | HistoryWriter/DB, chat-turn callback/handlers, permissions, output service, preload/protocol | 영속·승인·실제 제어·안전 read·배선 | DB/fs/IPC integration |
| 부모 통합 | docs IPC/arch/INDEX, 별도0230 | 현재 계약·일반 TEMP 회귀·커밋 | doc gate |

Electron import 없는 shared reducer와 output policy 모듈을 둔다. DB/fs/API는 주입 포트로 분리하고 실제 파일/SQLite 통합 oracle로 순수 테스트의 적용 시점을 확인한다.

## 12. End-to-end 영향

| 기존 소비처 | 변경 영향 | 회귀 AC |
|---|---|---|
| activity projector / post-turn / continuation | count와 종료 보류를 분리 | AC4·7·9 |
| bootstrap shutdown / send finally / runtime-entry | clear는 세대 종료이며 결과 실패 합성 아님 | AC14·24 |
| coordinator / settle / stop-subagent | legacy transcript projection 유지, canonical 권위 우회 제거 | AC5·8 |
| history writer / session load / renderer cache | 추가 상태 조회와 세대별 이력, 기존 message는 유지 | AC12·24 |
| TaskBoard / subagent 상세 / 일반 artifact | 명시 연결만 활용, 체크리스트와 출력 권한 별개 | AC12·18·24 |
| usage tracker / approvals / pending messages | canonical 상태와 기존 회계·입력 경계 연결 | AC10·11·17 |

## 13. Lifecycle / 오류 / 정리

query마다 random generation을 생성한다. 살아 있는 channel token을 확인한 pump가 callback을 먼저 수행하고 canonical/raw를 frame으로 보내지 않는다; retire/teardown은 token 무효화 전에 해당 세대 종료를 동기 기록한다.

result는 메인 턴만 마감한다. 새 프로세스는 live를 비우고 이전 terminal/출력을 보존하며, 연결 공백은 unknown으로 두고 reinitialize 이후 별도 snapshot이 와야 liveKnown을 회복한다.

stop timeout은 unconfirmed이고 retry 가능하다. 완료와 stop 경합은 실제 terminalEvidence를 보존하며 전체 stop의 재확인 상한 뒤에도 residual을 숨기지 않는다.

다중 저장소: journal DB commit→state→relay 순서다. 출력 파일 read→snapshot 파일 원자적 rename→DB 참조 순서를 사용하고 마지막 DB 실패 시 고아 snapshot만 정리한다; terminal event는 파일 접근 실패와 독립 영속된다.

문서 상태 사본은 plan과 INDEX다. 부모가 두 파일을 같은 설계 커밋에 맞추고 본 에이전트는 INDEX를 편집하지 않는다.

## 14. 성능 / 상한 / 최적화

출력은 요청당 최대 65536 byte이며 UI는 한 작업에 동시 요청 1개, 이전 cursor가 같은 파일일 때만 이어붙인다. poll은 표시 중인 실행 출력에만 제한하고 EOF를 완료 조건으로 쓰지 않는다.

raw 원본은 DB에서만 읽고 일반 상태 IPC로 싣지 않는다. dedupe 인덱스는 세대별로 관리하며 같은 UUID의 수정 payload를 제거하는 최적화를 금지한다; 대형 raw는 잘라 저장하지 않고 UI 전달만 제한한다.

## 15. 외부 구현 포트 / 문서 계약

`TurnRequest.onProviderEvent(event: BackgroundEvent | ProviderMessageEvent)`는 현재 delegate이며 schedule callback과 같은 pump 소유 경로다. provider event 실패는 세션 관측 실패로 표시하고 임의 성공 복구하지 않는다.

문서 예시를 실제 exported 타입에 대입하여 typecheck한다. SDK Options·Query control은 설치된 0.3.267 선언으로 확인하고 가짜 interrupt 인자·pause/resume/readTaskOutput 메서드를 만들지 않는다.

## 16. 기존 결정·규칙과의 관계

| 기존 규칙/동작 | 처리 |
|---|---|
| main DAG·feature 교차 import 금지 | 공유 타입/shared pure, DB infra, composition 주입으로 유지 |
| DB SSOT·migration append-only | 신규 테이블로 유지 |
| WebSearch 제한·번들 CLI | 유지; Bash만 D-04로 변경 |
| watchdog·snapshot 실패 보정·강제 aborted | 첨부 D-06으로 대체; 관련 기존 테스트 oracle 갱신 |
| 일반 출력 TEMP | 0230이 소유; 작업 출력 허용 루트로 자동 확장하지 않음 |
| 문서 저자 Claude 기본값 | D-02 사용자 지시로 Codex |

## 17. 리스크 / 트레이드오프

| 리스크 | 처리 |
|---|---|
| 구 코드가 canonical 이전에 legacy 정착 | pump 독점 전달과 canonical 소유권 확인, 과거 표시 fallback만 허용 |
| 원본에 비밀 포함 | restricted app DB 한정, 일반 로그·renderer·내보내기 배제 |
| 실제 SDK 종료 순서/Windows 수명 차이 | 배포 프로필별 실기 상태 유지, 구현 PASS와 분리 |
| 출력 경로가 임시 root 밖 | 접근 거부/명시 승인 경로만 허용, 기능 성공을 위해 권한 완화하지 않음 |
| old DB와 새 query generation | 이력 replay와 현재 live 분리, 부분 upgrade 통합 테스트 |

새 dependency는 없다. 기존 SDK 버전 갱신과 새 DB schema는 이번 스펙을 구현하기 위한 구체 변경이며 사용자 요청 범위다.

## 18. 영향 받는 파일 / 문서

§10·11의 app 경로 및 `docs/IPC_CONTRACT.md`, `docs/arch/backend/{adapters,runtime-ipc,persistence}.md`, `docs/arch/frontend/{state,rendering}.md`를 현재 구현에 맞춘다. 완성 전 아키텍처를 예정 사양으로 갱신하지 않는다.

## 19. 게이트

정본은 [app AGENTS](../../../app/AGENTS.md)·[main AGENTS](../../../app/src/main/AGENTS.md)·[renderer AGENTS](../../../app/src/renderer/AGENTS.md)다.

- `npm run typecheck`, `npm run lint`, `git diff --check`.
- 비 DB 변경은 direct Vitest로 reducer·mapper·pump·stop·parts·카드 suite를 실행한다.
- DB 기능은 Node ABI를 의도적으로 맞춰 migration/query/reload 통합을 실행한 뒤 전체 tests를 실행한다; Electron build 전 ABI 전환의 실제 실패 원인을 분리한다.
- SDK/package typecheck·문서 inventory·migration append-only scripts를 실행한다.
- 사용자 환경의 Windows 두 셸·SDK/CLI·실제 제공 경로 실기를 기록한다. 수행하지 못한 실기는 미검증이며 조건부 가용성과 구분한다.

## READY self-review

- [x] 사용자 요구·Bash 응답·Codex 작성자를 Ledger에 반영했다.
- [x] AC24개는 첨부 수용 ID 전체와 연결되고 필수 구현을 조용히 이월하지 않는다.
- [x] AS-IS/TO-BE의 상태·관측·영속·제어·UI 책임을 같은 축으로 대조했다.
- [x] R/SD/AR/MD pair와 현재 회귀·운영 gate가 있다.
- [x] source→pump→DB→state→UI 및 stop/output의 main 권위가 구체화됐다.
- [x] §10 강제 지점 61개를 열거하고 old synthetic 결과의 대체 지점을 포함했다.
- [x] 실제 runtime 미검증을 fixture PASS와 구분한다.
- [x] D-01…D-10 ↔ AC1…AC24 충돌 0이며 신규 의존성 없음.

## [구현자 기입] 설계 리뷰

작성자: **Codex**. 구현 r1, 완료 기록일 2026-09-13. 제품 계약은 유지했다. SDK taskId·호출 identity·live 집합·종료 근거·연결을 분리하는 설계에 동의한다. 실제 SDK 출력이 앱 임시 루트 밖에 생기는 문제는 0230 V2의 별도 설계 정정 후 구현했다.

기술 세부 차이: retire는 이전 source/token을 먼저 캡처하고 token을 무효화한 뒤 종료 관측을 동기 전달한다. 관측 저장 실패가 CLI close와 상태 정리를 건너뛰지 못하도록 finally로 보장한다. 동일 세대 종료 기록의 의미와 raw 비노출 계약은 유지하며 observer 예외 회귀로 확인했다. 새 제품 결정·미해결 PLAN_GAP은 없다.

## [구현자 기입] 강제 지점 전수와 V-pair 자기확인

| §10 | 닫은 지점 / 분모 | 실제 소비와 관측 | 남긴 곳 |
|---|---|---|---|
| EP-01 | 5/5 | query 옵션·세대; system; assistant/user; progress; init/retire. `claude.background`·metadata·실제 SDK 출력 검증 | 조건부 배포 실기는 아래 AC 표 |
| EP-02 | 6/6 | shared call/task/snapshot/connection/dedupe + parts child. 순서 역전·false/0·실패 receipt·SSR 직접 값 | 없음 |
| EP-03 | 5/5 | tracker observe/getState/count/hasPending/retire. snapshot-only와 pending launch, 새 세대 fixture | 없음 |
| EP-04 | 3/3 | activity projector 소비·post-turn hold·continuation. 예약/취소 수신 회귀에서 기존 배선 실행 | 없음 |
| EP-05 | 5/5 | 개별 stop·두 settlement·completion coercion·coordinator. ACK와 실제 terminal 분리, foreground만 정착 | 없음 |
| EP-06 | 6/6 | routeBatch·retire·TurnRequest·send·continuation·입력 UUID. drain 중 callback과 새 generation 보호 | 없음 |
| EP-07 | 6/6 | migration/등록·query·writer·복원·relay·CASCADE. 실제 SQLite 파일/세션/재로드, raw 전용 journal | 없음 |
| EP-08 | 4/4 | SDK callback·requester·broker·Ask 대응. query 수명 Promise, child signal과 UI, 부모 ID roundtrip | 없음 |
| EP-09 | 5/5 | shared schema·preload·handler·stop 대상·output 참조. 세대 불일치/임의 참조 거부와 정상 결과 | 없음 |
| EP-10 | 5/5 | 실제 경로·bounded read·cursor·snapshot/hash·false/URI 정책. 실제 정션/파일 교체/한글/16MiB 상한 | 없음 |
| EP-11 | 6/6 | ingest/load·목록·중첩·제어·출력·문구. Workflow 오류/후속 시작 충돌, URI 표시 1회 SSR | 설치본 시각 실기는 별도 |
| EP-12 | 5/5 | usage baseline·bootstrap 종료·TaskXXX·0230 산출물·현재 문서. 누적 통계 delta와 기존 기능 회귀 | 없음 |

분모 검산: `5+6+5+3+5+6+6+4+5+5+6+5=61`, 닫은 지점 61/61. 전수 확인은 `rg -n 'onProviderEvent|providerEvents|notifyChannelRetired' app/src/main`, `rg -n 'backgroundPending|liveMembership|settleOpenToolRuns' app/src`, `rg -n 'backgroundState|onBackgroundEvent|stopAllBackgroundTasks|readBackgroundOutput' app/src`, `rg -n 'outputRefs|canReadOutputFile|captureCompleted|persistProviderEvent' app/src/main`로 실제 producer/consumer를 대조했다. 0230 V2 EP-06은 별도 plan의 20개 지점에 포함한다.

V-pair: VP-R1~R24는 아래 동일 번호 AC 행의 자기 상태를 따른다. VP-S1·S2·A1·A2·A3·M1·M2·REG는 SELF_PASS다. 실제 runtime 요구가 남은 R-pair를 fixture 통과만으로 SELF_PASS 처리하지 않는다. 선택 적대 증거는 다음 표와 대응한다.

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 / 진단 변형 | 출처 | RED 관측 | 복원 결과 |
|---|---|---|---|
| 실제 send의 onProviderEvent callback 삭제 | VP-A1 선택 증거 | chat-turn.runtime-tools VP-A1 observe 호출 0으로 실패 | 복원 후 controller와 합친 2파일 10테스트 통과 |
| controller의 provider.message relay 차단 삭제 | VP-A1 선택 증거 | raw 비노출 테스트 publish가 1→2로 실패 | 복원 후 같은 2파일 10테스트 통과 |
| bootstrap에 tool 밖 artifacts.publish 추가 | 기존 publication gate의 event relay 오인 수정 | bootstrap.artifacts가 bootstrap.ts와 tool.ts 두 호출자를 위반으로 보고 | 복원 후 fixture 4파일 24테스트 통과 |
| 문서 사본에서 AGENT-DEFAULT 귀속 제거 | 수용 ID 차집합 확인 | 누락 집합에 AGENT-DEFAULT 한 개 | 실제 문서는 source69/mapped69/missing0 |

검산: 선택 증거 2 · 인용 변이 0 · 수정/추가 oracle 2 = 표 4행. 그 밖은 직접 SDK payload·파일·DB·렌더 상태 oracle이다. 임시 결함은 복원했고 제품 코드에 실험용 publication 호출은 남기지 않았다.

## [구현자 기입] Product/UX 파생 검토

- 시작 확인·진행·종료·live 소속·연결·stop 확인은 별도 표시된다. ACK/시간 초과를 중단 성공으로 바꾸지 않는다.
- 원본 파일 부재·권한 거부·원격 URI·잘림·교체·snapshot 확보 실패는 출력에 표시하고 완료 결과를 보존한다.
- 메인 중지 후 하위 승인은 유지하며 같은 SDK 요청은 중복 표시하지 않는다. 하위 Ask 답변은 재로드 후에도 같은 부모 아래 있다.
- 실패한 Workflow receipt에 taskId가 있어도 실행을 발명하지 않는다. 실제 시작이 뒤에 오면 실패 근거와 실제 실행을 함께 표시한다. 같은 MCP URI는 출처를 보존하고 한 번만 표시한다.
- 기존 semantic token·Button·한국어/영어 i18n을 사용했다. SSR로 상태와 안전한 텍스트 출력을 검증했으며 Windows 설치본의 시각 품질 판정은 별도다.

## [구현자 기입] 놓친 잠재 문제 + 대응

| 발견 | 대응 / 이번 관측 |
|---|---|
| SDK 출력이 부모 Temp/claude에 생성 | V2 정정 후 env/settings 강제. 실제 두 셸·Agent 파일이 앱 루트에서 reader/capture 성공 |
| ACK 응답 또는 terminal이 영원히 안 옴 | 각 15초 제한, unconfirmed·재시도. fake timer 직접 회귀 |
| 오래된 세대 출력 확보가 새 세대를 덮음 | 현재 세대만 자동 확보. historical/current 혼합 직접 회귀 |
| 같은 파일 다른 참조가 canRead:false 우회 | 연결 call과 같은 파일의 부정 정책 우선. false read spy 0 |
| snapshot 생성 후 journal 기록 실패 | 고아 snapshot 삭제, terminal 보존과 확보 오류. 실패 주입 후 삭제 관측 |
| 일반 도구까지 canonical 존재만으로 정착 제외 | 실제 background/child 집합만 보존. settle/coordinator/send 3파일 71테스트 |
| UTF-8 페이지와 성장 중 EOF | 미완성 문자 보류. 한글 재조립·append·교체·상한 직접 파일 검사 |
| retire observer 예외가 정리 누락/비밀 로그 유발 | observer 고정 오류 로그, token 무효화·finally close. runtime 회귀 |
| 실제 SDK task_started에는 status가 없음 | 선언에 맞는 mapper→reducer 통합 RED 후 started→running, 다음 snapshot 전 pending을 별도 유지하고 progress가 옛 제외 상태를 소급하지 않음 |

## [구현자 기입] 구현 보고

코드 구현과 테스트 근거를 다음과 같이 판정한다. ✅는 SELF_PASS, ⚠️는 SELF_BLOCKED(명시된 실제 배포 증거 대기)이며 독립 검증 PASS가 아니다.

| AC | 자기 상태 | 이번 실행 증거 / 남은 확인 |
|---|---|---|
| AC1 | ✅ | mapper 기본/foreground/강제/늦은 연결과 reducer call/task 분리 |
| AC2 | ✅ | 구조화 Agent content·메타·재호출 보존, 카드/하위 상세 렌더 |
| AC3 | ✅ | Windows 두 셸/한글 출력과 Bash main·foreground/background Agent의 interrupt/close/one-shot 수명 9조합 직접 관측 |
| AC4 | ✅ | 첫 snapshot-only/전체 교체/제외와 종료 후 live 잔존 직접 값 |
| AC5 | ✅ | 종료 역전·충돌·누락 patch·false/0 보존 |
| AC6 | ✅ | UUID+payload dedupe, 수정 payload, malformed 뒤 정상 수신 |
| AC7 | ✅ | runtime/post-turn main result 이후 provider event·child 승인 수신 |
| AC8 | ✅ | 실제 Bash stopTask ACK/stopped, fake timer 무응답/실패/경합 |
| AC9 | ✅ | main-only 보존, stop-all pending launch·fresh snapshot·잔여/미확인 |
| AC10 | ✅ | queued 입력/UUID 배열/수정·unknown receipt 회귀 |
| AC11 | ✅ | 같은 query Promise identity, 역순 Ask, child signal/UI/DB 부모 귀속 |
| AC12 | ✅ | 중첩 parent와 원본 content/_meta, child 델타 main 분리 |
| AC13 | ✅ | retry 유지 heartbeat 및 elapsed 0 직접 값 |
| AC14 | ✅ | reinitialize snapshot 요구·새 process generation·historical replay |
| AC15 | ✅ | 실제 SDK 파일 읽기, snapshot/current 분리·UTF-8·교체/잘림·DB 실패 |
| AC16 | ✅ | realpath/정션/형제 경계/false/URI 차단, HTML/ANSI 텍스트 표시 |
| AC17 | ✅ | 두 누적 result delta, 동일 UUID 수정 원본 보존, 새 query 기준 초기화 |
| AC18 | ✅ | TaskXXX 체크리스트 기존 경로와 canonical 작업 별도 회귀 |
| AC19 | ⚠️ | Monitor 종류/메타/진행 선언 기반 처리; 이 init에서 미노출, 실제 command/WebSocket/persistent 미검증 |
| AC20 | ⚠️ | Workflow 오류/자식/연결·실패 후 실제 시작·동일 URI 회귀; 실제 startup 오류/one-shot 완료 확인; child/stop/resume 배포 미검증 |
| AC21 | ⚠️ | Skill/MCP 원본·구조화 메타/리소스 및 SDK MCP 요청별 취소; 분리 Skill/외부 MCP 자동 background 실기 미검증 |
| AC22 | ⚠️ | remote/ambient/legacy/unknown queue fixture; 원격 worker의 실제 잔여 수명 미검증 |
| AC23 | ✅ | 설치 SDK/동봉 CLI identity, init 목록, 지속/단발 실기 범위와 미검증 구분 문서 |
| AC24 | ✅ | 실제 SQLite upgrade/journal/reload/CASCADE, raw 미전달, 기존 일반 기능 회귀 |

검산: ✅20 · ⚠️4 · ❌0 = 총24. V-pair SELF_PASS 28 · SELF_BLOCKED 4 = 총32(REQUIRED31 + REGRESSION1). 실제 배포 증거가 남은 기준은 구현 누락으로 숨기거나 지원 완료로 합산하지 않는다.

### 운영 gate

| Gate | 명령 / 관측 결과 |
|---|---|
| 최종 타입 | npm run typecheck — node/web/test 모두 exit0 |
| 최종 린트 | npm run lint — exit0, 오류0, 기존 useTranscriptVirtualizer 경고1 |
| 전체 회귀 실행 | vitest --maxWorkers=4 — 497파일 통과/2파일 실패/1skip, 4629통과/2실패/1skip. 실패 2건은 병렬 작성 중 읽힌 Workflow 신규 RED였다 |
| 수정 후 회귀 | chat/app/runtime/history/output/renderer 관련 최종 231파일·1928테스트 전부 통과. 위 실패 2파일과 실제 started→progress 통합을 포함한다 |
| 마지막 린트 정리 | 반환 타입 2곳과 부모 필드 제거의 미사용 변수 수정 후 parts 2파일·27테스트 통과 |
| 스크립트 | node --test scripts/*.test.mjs — 116테스트, 실패0 |
| Electron 빌드 | npm run prebuild로 Electron ABI 복원 후 electron-vite build — main/preload/renderer 모두 통과. 마지막 타입/린트 정리 이후 번들도 재생성 |
| 문서/DB 가드 | check-doc-inventory --check, check-migrations-appendonly, check-test-budgets — 모두 exit0. 상대 링크 유효, migration append-only 유지 |
| 실제 SDK | basic4 + 소유자 수명9 + Workflow2. SDK 출력의 production reader·snapshot와 실제 main interrupt/close/one-shot 관측은 sdk-evidence.md |
| 저장소 위생 | git diff --check 통과. 최종 커밋 후 trailer 파싱 확인 |

전체 회귀의 RED를 최종 단일 실행 PASS로 바꿔 적지 않는다. 변경 중 실패한 두 스위트와 최종 수정의 영향 범위를 재실행하여 닫았다. DB 테스트는 Node ABI에서 수행했고 종료 시 native 모듈은 Electron ABI로 복원됐다. 빌드 첫 직접 helper 호출은 npm PATH 없이 electron-builder.cmd를 찾지 못해 실패했으며, 저장소가 지정한 prebuild 경로로 실행해 해소했다.

선행 개별 검증: 타입 3구성 통과, adapters 48파일 544테스트, TEMP 10파일 80테스트, 승인/history/reducer 13파일 133테스트, controller/output 2파일 15테스트, 실제 SDK basic 4건과 production reader/capture, 스크립트 116테스트 통과. 중복 범위는 합산하지 않는다. 최종 통합 결과가 위 개별 수치를 대체한다.

### 전달과 남은 검증

다음은 handoff 독립 verify다. 위 조건부 실제 배포 증거와 Windows 설치본 시각 품질을 별도 확인한다. 설계·구현 문서 작성자는 Codex이며 이 구현 보고가 verify.md를 대체하지 않는다.

## [구현자 기입] Review Signals

- 구현 r1, 공식 verify 재구현 라운드는 아직 없다. 독립 코드 검토의 지적을 같은 구현 턴에서 반영했다.
- 반복 확인한 축은 상태 근거와 관측 수명이다. 테스트가 status가 없는 실제 SDK 시작 봉투 대신 running을 직접 넣어 놓친 사례를 mapper 통합으로 고쳤다.
- 전체 테스트를 병렬 개발 중 실행하면 RED 작성 순간의 파일을 읽을 수 있었다. 해당 실패를 제품 회귀와 구분하고 최종 수정본의 관련 suite를 다시 실행한다.
- 기본 worker 전체 실행은 Windows 부하가 커 bounded worker로 실행했다. DB 검증은 Node ABI, build는 Electron ABI로 순서를 구분한다.

## [검증자 기입] 파생 이슈

아직 독립 검증 전이다.

## 설계 정정 — 실제 SDK 출력 경로 (Codex, 2026-09-12)

0230 V2의 D-06·VP-10·EP-06을 출력 생성 경로의 선행 계약으로 적용한다. AC15·AC16의 허용 read/snapshot은 query `CLAUDE_CODE_TMPDIR`로 앱 임시 루트 아래 생성한 SDK 파일을 소비한다. 부모 Temp를 추가 허용하는 fallback은 없다. EP-01(query 옵션)과 EP-10(출력 policy)의 기존 강제 지점에서 실제 Bash·PowerShell·Agent output_file과 그 내용으로 함께 검증한다.
