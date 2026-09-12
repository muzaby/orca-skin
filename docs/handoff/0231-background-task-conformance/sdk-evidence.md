# SDK 실행 증거

작성자: **Codex**. 실행일: 2026-09-12. 구현 자기검증이며 독립 handoff verify 판정은 아니다.

## 실행 환경과 재현

- Windows x64, 설치 SDK `0.3.267`, 동봉 native CLI `2.1.267`.
- `app`에서 `node scripts/smoke-background-sdk.mjs` 실행. 로컬 HTTP 모델 fixture가 고정된 도구 호출을 반환하고 실제 SDK와 CLI가 셸·Agent를 실행한다. 외부 모델 요청은 없다.
- 지속형 async 입력, `perTaskStopAffordance`, `agentProgressSummaries`, PowerShell 활성화, 앱 `CLAUDE_CODE_TMPDIR`를 사용한다. fixture만 `bypassPermissions`를 사용하며 앱 승인 정책은 변경하지 않는다.
- Vite로 실제 `BackgroundOutputStore` 모듈을 로드하여 SDK output_file 읽기·완료 snapshot·재읽기를 함께 검증한다. 앱 query 옵션과 workspace guard의 실제 배선은 `claude.extra-dirs.test.ts`·`claude.executable-option.test.ts`가 별도로 검증한다.
- 개인정보 경로를 `<APP_TEMP>`로 바꾼 선택 이벤트와 결과: [sdk-evidence.json](sdk-evidence.json). `<APP_TEMP>`는 Windows OS 임시 디렉토리의 `orcinus-orca` 하위 폴더다.

## 실제 관측

| 실행 | SDK 근거 | main 출력 reader | 완료 보존 |
|---|---|---|---|
| Bash 명시 background | 실제 taskId, main result 뒤 completed 통지 | available, 앱 tmp 아래 파일 | 42바이트, 원본과 같은 내용 |
| Bash 개별 중단 | stopTask ACK 뒤 stopped 통지 | available | 10바이트 |
| PowerShell background | 실제 taskId, main result 뒤 completed 통지 | available, 한글 보존 | 56바이트, 원본과 같은 한글 |
| Agent 기본 실행 | async background 시작과 completed 통지 | available, 빈 출력도 정상 읽기 | 0바이트, 빈 파일 SHA-256 |

각 파일의 실제 경로가 `<APP_TEMP>/claude/.../tasks` 아래인지 확인했다. 원본·main reader·snapshot 재읽기가 일치했고 snapshot은 모두 partial=false였다. 새 경로를 강제하기 전 실기에서는 `Temp/claude`로 출력되어 접근 정책 밖이었다. 이 실측을 근거로 0230 V2를 별도 설계 커밋하고 query env와 settings.env를 함께 고쳤다.

init 목록에는 Task·Bash·PowerShell·Workflow·Skill·TaskOutput·TaskStop이 있었다. 모델에 노출된 Agent 호출은 실제 실행됐으며 init의 Task 이름과 구분하여 보존한다. Monitor는 이 fixture의 init에 없었다. Workflow·Skill이 노출된 사실을 실행 검증으로 세지 않는다.

## 구현 검증과 배포 검증의 경계

승인 재전달·취소·하위 질문, snapshot/replay·generation, 원격 잔여, Workflow 오류·MCP 메타/리소스는 실제 앱 모듈의 선언 기반 fixture로 검사한다. MCP는 실제 SDK server와 client의 in-memory transport를 통해 요청별 취소를 검사한다.

이 로그는 외부 서비스·원격 Worker·Monitor WebSocket·persistent 서비스·분리 Skill의 배포 수명을 입증하지 않는다. Windows 설치 패키지의 전체 UI 조작, foreground 하위 Agent와 background 하위 Agent가 만든 셸의 모든 소유권 조합도 별도 실기 대상이다. 실행 자료가 없는 항목을 미지원 또는 실제 실행 통과로 바꾸지 않는다.

## 추가 실기 — 셸 소유자 수명·단발 입력·Workflow 오류

추가 작성자: **Codex**. 기록일: 2026-09-13. 아래 관측은 앞의 기본 실행 증거에 추가되며, 위 미검증 경계 중 이 표가 직접 실행한 소유자·단발 조합만 해소한다. 선택 이벤트·시각·도구 반환·생산 reducer 판정은 [sdk-lifecycle-evidence.json](sdk-lifecycle-evidence.json)에 보존했다.

재현은 `app`에서 `node scripts/smoke-background-sdk.mjs --mode=lifetime` 또는 `--mode=workflow`다. `--case=background-agent-interrupt`처럼 단일 사례도 선택할 수 있다. 기본 `basic` 모드는 기존 실행을 유지한다. 모델 응답은 모두 loopback HTTP fixture이며 외부 모델 요청은 없다. 실제 SDK/CLI가 실행하는 Bash는 시작 파일을 만든 뒤 8초 대기하고 완료 파일을 쓰며, 각 실행이 소유한 Query만 닫는다. 전역 프로세스 종료는 사용하지 않았다.

### AC3 — Bash 소유자별 직접 관측

| Bash 호출 주체 | 메인 `interrupt()` | 실행 중 `Query.close()` | 유한 단일 입력 종료 |
|---|---|---|---|
| 메인 | Bash `completed`, 완료 파일 존재 | 시작 확인 후 닫힘, 이후 완료 파일 없음 | Bash `stopped`, 완료 파일 없음 |
| foreground Agent | Bash `stopped`, 완료 파일 없음 | 시작 확인 후 닫힘, 이후 완료 파일 없음 | Agent `completed`, Bash `stopped`, 완료 파일 없음 |
| background Agent | 활성 메인은 `error_during_execution`으로 끝나고 Agent·Bash는 각각 `completed`, 완료 파일 존재 | 시작 확인 후 닫힘, 이후 완료 파일 없음 | Agent `completed`, Bash `stopped`, 완료 파일 없음 |

`interrupt`와 `close`는 `task_started.task_type=local_bash`를 받은 뒤 시작 파일을 확인하고, 완료 파일이 아직 없을 때만 적용한다. 메인·foreground·background 구분은 fixture가 보낸 Agent의 `run_in_background` 옵션과 `fixture_main_Agent` / `fixture_child_Bash` 도구 ID에 근거한다. 셸 종료 판정은 해당 `task_started.task_id`와 같은 ID의 `task_notification.status`를 사용하며 Agent 종료 통지를 셸 종료로 세지 않는다. 완료 여부는 관측된 시작 파일과 별도의 완료 파일을 사용한다. CLI를 닫은 사례는 연결이 종료되어 SDK terminal을 받지 못하므로 `stopped`를 추정해 기입하지 않았다.

background Agent 사례에서는 loopback의 메인 모델 응답을 최대 15초 보류했다. `main-response-held` 관측 뒤 시작 파일을 확인하고 `interrupt()`를 호출했으며 첫 main result는 그 뒤에 발생했다. 따라서 idle query 호출만으로 메인 중단 계약을 판정한 결과가 아니다. 메인이 중단되어도 background Agent가 만든 Bash는 완료됐고 실제 생산 mapper/reducer의 최종 `pending`은 false였다.

### AC23 — 단발 입력과 노출 도구의 실행 결과

| 직접 실행한 조건 | 관측 |
|---|---|
| 유한 async 입력 + 메인 Bash | main result 뒤 남은 Bash가 `stopped`로 정리됨 |
| 유한 async 입력 + foreground/background Agent | Agent의 `completed` 통지까지 관측됐으며 그 Agent가 남긴 Bash는 `stopped`로 정리됨 |
| 유한 async 입력 + Workflow | 내부 `agent()`의 loopback 응답을 3초 지연해도 Workflow `completed` 통지 뒤 result/스트림 종료까지 유지됨 |
| Workflow 시작 컴파일 오류 | 실제 반환은 `status=async_launched`와 `taskId`·`runId`·`error`를 동시에 포함. 생산 mapper/reducer는 call을 `failed`, `awaitingTask=false`로 만들고 task를 생성하지 않았으며 `pending=false` |

Workflow 시작 오류는 모듈 문법으로는 유효한 두 번째 `export`를 사용해 CLI의 두 번째 컴파일 단계에서 재현했다. 초기 입력 파서가 반환하는 단순 문자열 오류와 구분했다. 정상 단발 Workflow의 `output_file`은 `<APP_TEMP>/claude/.../tasks` 아래였으며 생산 output reader·완료 snapshot·재읽기가 일치했다. Monitor는 실제 init 목록에 없었고 실행 통과로 세지 않았다. 외부 모델·원격 Worker·Monitor·분리 Skill·설치 UI의 배포 동작은 이 추가 실기로 검증되지 않았다.

선택 증거는 `<APP_TEMP>/sdk-smoke-VVkFQs/result.json`에서 background Agent interrupt를 제외한 사례, 활성 메인 턴을 보장한 `<APP_TEMP>/sdk-smoke-BL66of/result.json`, Workflow의 `<APP_TEMP>/sdk-smoke-Qf1dHJ/result.json`이다. `VVkFQs`의 background Agent interrupt는 예비 fixture가 Agent 통지에서 일찍 스트림을 닫았으므로 제외했다. `BL66of`는 Bash 자체의 terminal까지 읽은 정정 증거다. 원본은 앱 임시 디렉토리에 남기고 저장소 복사본의 개인정보 경로는 `<APP_TEMP>`로 치환했다. 경로를 평탄화한 SDK 디렉토리 키도 `<APP_TEMP_KEY>`로 치환했다.
