# 진단 — SDK background 작업 스펙 대조

작성자: **Codex**. 일자: 2026-09-12. 변경 전 감사와 보완 구현을 함께 기록한다. 기존 구현은 snapshot·종료 판정·승인 수명·출력·영속에서 첨부와 차이가 있었다. 아래 최초 감사는 그대로 보존하며 보완 결과와 실제 실행 범위는 문서 후반에 구분한다.

대상은 사용자 첨부 `C:/Users/rlaeo/Downloads/claude-agent-sdk-background-task-spec.md`다. SHA256은 [plan §2](plan.md)에 고정했고, 현재 보완 계약은 [plan.md](plan.md)가 정본이다.

## 확인한 결함

| 발견 | 판정 | 확인 내용 | 변경 전 코드 근거 | AC |
|---|---|---|---|---|
| F-01 | P1 부정확 | 라이브 집합과 edge tracker 혼합; 첫 snapshot 무시·snapshot-only 누락·제외를 failed로 확정 | chat/background-tasks.ts:95–104; turn-coordinator.ts:443–474 | 1·4·5 |
| F-02 | P1 부정확 | watchdog의 stopped 합성·중단 경합 성공 결과 강등 | stop-subagent.ts:89–102; subagent-settlement.ts:101–118; turn-coordinator.ts:502 | 5·8·9 |
| F-03 | P1 누락 | task 메타 transient; raw·세대·종료 근거 영속 없음 | history/writer.ts:439–467; shared/ipc.ts:628–674 | 6·14·24 |
| F-04 | P1 누락 | 일반 셸·snapshot-only 카드 부재, foreground Agent도 background 타일 | renderer lib/parts.ts:315–337; SubAgentTileContent.tsx:125 | 1·3·4·19…22 |
| F-05 | P1 부정확 | nested 상세 root-only 검색; child 복사에서 구조화 메타 소실 | InlineSubagentDetail.tsx:29–31; parts.ts:29–53,318 | 2·12 |
| F-06 | P2 누락 | Agent content[] 결과 fallback 미표시 | SubAgentTileContent.tsx:59–71 | 2 |
| F-07 | P1 누락 | task 출력 참조·증분 read·보존·접근 실패 전용 서비스 없음 | app/src에서 readTaskOutput/output_file/rawOutputPath/persistedOutputPath 소비 검색 | 15·16·21 |
| F-08 | P1 누락 | 승인 새 UUID·SDK 요청/agent/tool ID 부족·Ask 동시 귀속 FIFO | chat-turn/approval.ts:48–55,98–107; approvals/broker.ts:64 | 11·12 |
| F-09 | P1 부정확 | draining/unframed 상태에서 task/raw가 coordinator 관측에 도달하지 못함 | sessions/session-runtime.ts routeBatch; post-turn.ts:84–117 | 7·9·14 |
| F-10 | P2 부분 | 재시작 stale 실행 표시는 막지만 실제 근거 없이 중단 합성 | renderer parts.ts:137–163; runtime-entry.ts:101–109 | 14·22·24 |
| F-11 | 유지 | 직접 child main 분리·progress 교체·중단 실패 UI·listen·TaskXXX 분리 존재 | parts.ts:61–65,248–266; chatStore.ts:320–337,1103–1111 | 7·8·12·17·18 |
| F-12 | 정책 확정 | Bash disallowed를 사용자 두 셸 사용 결정으로 변경 | claude.ts 옵션·사용자 후속 응답 | 3 |

약어: chat 파일은 `app/src/main/features/chat/`, history는 `app/src/main/features/history/`, chat-turn은 `app/src/main/app/chat-turn/`, renderer 파일은 `app/src/renderer/src/features/chat/` 아래다. 줄 번호는 수정 전 감사 좌표다.

## 첨부 수용 기준 전체 매핑

필수 구현은 모두 아래 AC에 귀속한다. 조건부는 실제 도구 제공 시 적용하며, 제공되지 않는 증거와 단지 실기를 하지 않은 상태를 구분한다.

| AC | 기준 ID 전수 | 변경 전 판정 | 변경 전 검증 상태 |
|---|---|---|---|
| AC1 실행 모드와 ID | AGENT-DEFAULT, AGENT-FOREGROUND, AGENT-FORCED, AGENT-LAUNCH | 누락 또는 부정확 | 직접 oracle 신설/수정 필요 |
| AC2 완료·재호출 결과 | AGENT-COMPLETE, AGENT-PARTIAL, AGENT-RESUMED | 누락 또는 부정확 | 직접 oracle 신설/수정 필요 |
| AC3 셸 | BASH-EXPLICIT, BASH-TIMEOUT, BASH-TIMEOUT-EXCEPTION, BASH-STDERR, BASH-LIFETIME, POWERSHELL-BACKGROUND, POWERSHELL-ENCODING | 누락 또는 부정확 | 선언·fixture·실기 분리; 실제 배포 미검증 |
| AC4 라이브 집합 | START-AFTER-SNAPSHOT, SNAPSHOT-DISAPPEAR, TERMINAL-STILL-LIVE | 누락 또는 부정확 | 직접 oracle 신설/수정 필요 |
| AC5 종료와 patch | END-BEFORE-START, STOP-WITHOUT-NOTIFICATION, TERMINAL-CONFLICT, PATCH-ABSENCE | 누락 또는 부정확 | 직접 oracle 신설/수정 필요 |
| AC6 중복·미지 프로토콜 | DUPLICATE-EVENT, UNKNOWN-SCHEMA, MALFORMED-KNOWN | 누락 또는 부정확 | 직접 oracle 신설/수정 필요 |
| AC7 메인 결과 이후 수신 | MAIN-RESULT-EARLY, IDLECLOSE-PENDING | 부분 구현; 보완 필요 | 직접 oracle 신설/수정 필요 |
| AC8 개별 중단 | STOP-TASK, STOP-RACE, STOP-FAILURE | 누락 또는 부정확 | 직접 oracle 신설/수정 필요 |
| AC9 메인·전체 중단 | STOP-MAIN-ONLY, STOP-DEFAULT, STOP-ALL-RACE | 누락 또는 부정확 | 직접 oracle 신설/수정 필요 |
| AC10 입력 대응·큐 | INTERRUPT-QUEUE, QUEUE-UNKNOWN, INPUT-MERGE | 부분 구현; 보완 필요 | 직접 oracle 신설/수정 필요 |
| AC11 승인·질문 | PERMISSION-BACKGROUND, PERMISSION-REDELIVERY, PERMISSION-CANCEL, PERMISSION-DENY, QUESTION-BACKGROUND | 부분 구현; 보완 필요 | 직접 oracle 신설/수정 필요 |
| AC12 하위 대화 | AGENT-NESTED, TRANSCRIPT-ROUTING | 부분 구현; 보완 필요 | 직접 oracle 신설/수정 필요 |
| AC13 재시도·생존 | RETRY-HEARTBEAT | 부분 구현; 보완 필요 | 직접 oracle 신설/수정 필요 |
| AC14 연결·새 프로세스 | RECONNECT-LIVE, RESTART-PROCESS, REPLAY-HISTORY | 부분 구현; 보완 필요 | 직접 oracle 신설/수정 필요 |
| AC15 출력 읽기 | OUTPUT-PARTIAL, OUTPUT-UNAVAILABLE, OUTPUT-MODIFIED | 누락 또는 부정확 | 직접 oracle 신설/수정 필요 |
| AC16 출력 안전 | OUTPUT-SAFETY | 누락 또는 부정확 | 직접 oracle 신설/수정 필요 |
| AC17 사용량 | USAGE-SNAPSHOT | 부분 구현; 보완 필요 | 직접 oracle 신설/수정 필요 |
| AC18 체크리스트 회귀 | TASKLIST-SEPARATION | 기존 분리 구현 있음 | 직접 oracle 신설/수정 필요 |
| AC19 Monitor | MONITOR-COMMAND, MONITOR-WEBSOCKET, MONITOR-PERSISTENT | 조건부 해석/제어 불완전 | 선언·fixture·실기 분리; 실제 배포 미검증 |
| AC20 Workflow | WORKFLOW-START-ERROR, WORKFLOW-CHILDREN, WORKFLOW-STOP, WORKFLOW-RESUME | 조건부 해석/제어 불완전 | 선언·fixture·실기 분리; 실제 배포 미검증 |
| AC21 Skill·MCP | SKILL-DETACHED, MCP-AUTO-BACKGROUND, MCP-RESOURCES, MCP-META | 조건부 해석/제어 불완전 | 선언·fixture·실기 분리; 실제 배포 미검증 |
| AC22 원격·ambient·구형 제어 | REMOTE-AGENT, REMOTE-DISCONNECT, AMBIENT-TASK, LEGACY-TASKOUTPUT, CANCEL-QUEUED | 조건부 해석/제어 불완전 | 선언·fixture·실기 분리; 실제 배포 미검증 |
| AC23 배포 지원 판정 | ONE-SHOT-EXIT | 조건부 해석/제어 불완전 | 선언·fixture·실기 분리; 실제 배포 미검증 |
| AC24 호환 영속·개인정보 | REPLAY-HISTORY, DUPLICATE-EVENT, OUTPUT-MODIFIED | 부분 구현; 보완 필요 | 선언·fixture·실기 분리; 실제 배포 미검증 |

REPLAY-HISTORY·DUPLICATE-EVENT·OUTPUT-MODIFIED는 상태/영속 또는 출력/보존 경계를 함께 검증하므로 복수 AC에 의도적으로 배정했다.

## 실제 확인한 증거

- 비 DB Vitest: `background-tasks.test.ts`, `stop-subagent.test.ts`, `subagent-settlement.test.ts`, `parts.stale-async.test.ts`의 **4파일·41테스트 통과**.
- 기존 watchdog/snapshot 테스트에는 첨부와 충돌하는 상태 확정이 기대값으로 들어 있다. 통과를 새 스펙 충족으로 승계하지 않는다.
- SDK 0.3.267 설치 선언·공식 릴리스는 adapter 조사에서 확인한다. 첨부 선택 필드를 실제 선언의 필수값으로 임의 승격하지 않는다.
- Windows 셸 수명·인코딩·프로세스 트리 정리와 실제 원격/Monitor/Workflow/MCP 로그는 이번 읽기 전용 감사에서 수집하지 않았다.

## 미검증과 가용하지 않음의 구분

| 상태 | 인정하는 증거 | 보고 규칙 |
|---|---|---|
| 프로토콜 구현 | 배포 선언과 semantic fixture | 구현 자기검증 |
| 실제 실행 검증 | 민감정보 제거 SDK 원본·제어 요청/응답·배포 프로필 | 실제 검증 |
| 가용하지 않음 | init 도구/capability·배포 정책에서 경로 부재 확인 | 조건부만 해당 없음 가능 |
| 미검증 | 노출되나 실행 자료 없음 | 통과/미지원으로 바꾸지 않음 |
| 모르는 스키마 | raw·진단 보존, 다른 메시지 정상 처리 | 보존과 의미 해석 지원을 구분 |

원본 보존만으로 기능의 완전한 지원을 선언하지 않는다. 필수 구현이 남으면 부분 완료이며 실기만 남아도 배포 지원 완료라고 표현하지 않는다.

## 보완 구현 결과

| 감사 항목 | 적용한 변경 | 실행 근거 |
|---|---|---|
| F-01·F-04 | generation/taskId 정본, 첫 snapshot 전체 교체, 모든 종류와 시작 확인 중 호출의 카드 | shared reducer·backgroundPresentation·카드 SSR 테스트 |
| F-02·F-10 | 종료 근거와 live/stop/연결 분리, ACK 무응답과 종료 미확인을 별도 표시, 전경 도구만 정착 | controller·settle·coordinator·session-runtime 테스트 |
| F-03 | 원본/정규화 event journal, 세션 삭제 CASCADE, 과거 재생과 현재 세대 분리 | 실제 SQLite migration/query/writer/reload 통합 |
| F-05·F-06 | 하위 부모 링크와 구조화 결과·메타·content 보존 | mapper metadata·parts·InlineSubagentDetail·writer Ask roundtrip |
| F-07 | main 소유 출력 참조, 실제 경로 검사, 증분 UTF-8 읽기, 파일 교체/잘림, 완료 snapshot/해시 | 실제 파일·정션·16MiB 상한·DB 기록 실패 회귀 및 실제 SDK 출력 reader |
| F-08 | SDK 요청 identity와 query 수명 중복 처리, child 승인 수명 유지, 질문 toolUseId 귀속 | canUseTool·approval identity·child 승인 reducer·SQLite 재로드 |
| F-09 | pump가 provider 이벤트를 frame/draining 전에 독점 관측, retire 정리 보장 | runtime·post-turn·실제 send 배선 및 선택된 삭제 변이 |
| F-11 | 기존 체크리스트·일반 산출물·수신/입력/usage 회귀 유지 | 기존 기능 suite와 전체 회귀 gate |
| F-12 | Bash 제한 해제, PowerShell 함께 사용, SDK 임시 출력도 앱 루트로 고정 | query 옵션·guard 및 Windows native CLI 두 셸 실기 |

개별 중단 ACK의 무응답, UTF-8의 성장 중 EOF, 이전 세대 출력 확보, 같은 파일의 읽기 거부 별칭, snapshot 저장 후 DB 실패, 하위 승인 UI 소실도 구현 중 발견하여 같은 계약 안에서 보완했다. Workflow 시작 오류와 MCP 동일 URI 중복은 별도 검토에서 재현하여 상태/표시 회귀로 잠근다.

첨부의 수용 ID 집합과 매핑 집합의 실제 차집합은 0이었다(69 대 69). 문서 복사본에서 AGENT-DEFAULT를 제거하는 진단 검사는 누락 ID 한 개를 검출했다. 이 숫자는 기준의 귀속 확인이며 실제 실행 통과 개수가 아니다.

구현·V-pair·최종 운영 gate는 [plan의 구현자 보고](plan.md), Windows SDK/CLI의 실행 범위와 출력 증거는 [SDK 실행 증거](sdk-evidence.md)를 따른다. 원격·Monitor·Workflow·Skill/MCP의 선언 기반 처리와 외부 배포 수명 검증을 합산하여 완전 지원으로 보고하지 않는다.
