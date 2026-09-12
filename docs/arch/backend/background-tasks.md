# 백그라운드 작업 상태와 출력

작성: Codex

## 수신과 상태

`ClaudeBackgroundMapper`는 SDK 메시지를 원본 `provider.message`와 해석된 `BackgroundEvent`로 나눈다. `SessionRuntime`은 이 경로를 일반 턴 프레임과 draining 판정보다 먼저 소비한다. 메인 result·턴 취소·listen 종료는 작업의 종료 증거가 아니다. 프로세스 종료는 연결 상태에 기록한다.

`HistoryWriter.persistProviderEvent`는 원본과 작업 이벤트를 전용 DB journal에 먼저 커밋한다. 세션 init보다 먼저 온 이벤트는 세션 행 생성까지 보관한다. 원본은 일반 transcript·FTS·wire log·renderer 채널로 전달하지 않는다. 새 프로세스는 별도 generation을 갖고, 재로드된 journal은 과거 이력으로 복원한다.

`BackgroundTaskTracker`의 상태 정본은 shared의 순수 reducer다. taskId, toolUseId, agentId는 서로 다른 식별자다. 명시적 연결이 없는 Agent 실행 영수증은 호출에 남으며 임의 taskId를 만들지 않는다. 최신 전체 snapshot은 첫 수신부터 live 집합을 교체하고 snapshot에만 있는 작업도 표시한다. 집합에서 빠진 사실은 terminal 상태를 만들지 않는다. 비동기 작업의 대기 여부와 비ambient live 개수는 별도로 계산한다.

task patch의 누락 필드는 기존 값을 유지하고 false·0·빈 문자열은 값으로 반영한다. 종료 뒤 도착한 메타와 출력 참조도 보존하며, 늦은 running 갱신은 종료 상태를 되살리지 않는다. 상충하는 종료 증거는 별도 이력으로 남는다.

## 제어

`BackgroundController`는 세션·generation·taskId를 검증한 후 실제 `stopTask`를 호출한다. 요청·ACK·오류·종료 미확인을 작업 종료와 분리한다. 전체 중단은 새 입력을 잠시 보류하고 최신 live 집합을 제한된 횟수만 다시 확인한 뒤 남은 대상과 현재성 미확인을 반환한다.

SDK 요청 응답과 ACK 이후 종료 확인은 각각 제한 시간을 가지며, 시간이 지나면 재시도 가능한 미확인 상태가 된다. 전체 중단의 확인에는 같은 세대의 새 snapshot만 사용한다. taskId가 아직 없는 비동기 호출도 남은 작업으로 취급한다.

메인 응답 취소는 백그라운드 수신을 보존한다. 연결을 폐기하는 세션 전체 중단은 별도 동작이다. `reinitialize()`는 연결을 재동기화 상태로 바꾸며, 이후 snapshot을 받아야 live 현재성이 회복된다.

승인·질문은 SDK의 requestId·toolUseId·agentId·generation을 보존한다. 같은 query의 요청 재전달은 같은 Promise를 재사용한다. 메인 중지 후에도 SDK signal이 살아 있는 하위 승인 UI는 유지하며, Ask 답변의 부모 연결은 DB 재로드에서 복원한다. host MCP 도구는 개별 요청 signal과 채널 수명을 함께 따르고 형제 호출의 취소로 중단되지 않는다.

Code의 foreground 셸 단건 전환은 `BackgroundController.promote`가 현재 세대·연결·등록된 실행 중 local_bash와 toolUseId를 검증한 뒤 runtime의 `backgroundTask`로 전달한다. Bash와 PowerShell은 같은 SDK 단건 전환 경로를 사용한다. 빈 ID·중복 요청은 거부하고 SDK false/예외·응답 제한을 오류로 전달한다. 성공 응답 뒤에도 runtime identity와 generation을 확인하며 기존 호출의 phase를 유지한 채 background mode만 기록한다. 명령을 다시 실행하거나 임의 taskId를 만들지 않는다.

공유 상태의 `backgroundObserved`는 snapshot 포함·isBackgrounded:true·확인된 background/remote mode에서 누적하고 완료나 snapshot 제외로 지우지 않는다. 명시적 background 요청 인자는 표시 근거와 관측 사실을 구분한다. Explorer 호출 모델은 실제 child assistant의 message.model에서 기록하고 journal replay로 복원한다.

## 출력

Renderer는 경로 대신 기록된 outputId를 요청한다. main이 세션 cwd·명시적인 추가 디렉토리·앱 전용 임시 디렉토리 아래의 실제 파일 경로를 검증한다. `canReadOutputFile:false`는 직접 읽기를 거부하고 URI는 자동으로 가져오지 않는다. 심볼릭 링크·정션으로 허용 루트를 벗어나거나 디렉토리를 파일로 읽는 요청도 거부한다.

Claude query의 `CLAUDE_CODE_TMPDIR`는 앱 임시 루트로 고정하며 `options.env`와 명시 settings.env에서 같은 값을 사용한다. Windows SDK 내부 출력도 그 아래 `claude`에 생성된다. 부모 프로세스의 TEMP/TMP/TMPDIR는 바꾸지 않는다. 같은 파일의 다른 출력 참조가 도착해도 기존 읽기 거부는 유지한다.

현재 파일은 페이지당 최대 64KiB를 읽으며 파일 교체와 축소를 cursor로 구분한다. 완료 출력은 `<userData>/background-outputs`에 최대 16MiB를 확보하고 확보 바이트의 SHA-256·크기·시각·부분 여부를 기록한다. 스냅샷 실패는 작업의 성공/실패를 변경하지 않는다. 세션 삭제는 journal과 보존 파일을 정리한다.

UTF-8 문자가 페이지 끝이나 성장 중인 파일 끝에서 잘리면 남은 바이트가 도착할 때까지 보류한다. 파일을 확보한 뒤 DB 참조 기록에 실패하면 그 보존 파일만 정리하고 확보 실패를 표시한다.

우측 패널의 카드·선택 상세와 원본 출력 보존은 분리한다. Code 카드에는 실행 결과를 붙이지 않고 셸 상세는 ToolCard 본문만 표시한다. 원본 출력은 읽기 API와 보존 상태에 남으며 표시한 텍스트를 실행하지 않는다. 원본 형식과 상세 계약은 [`shared/background-task.ts`](../../../app/src/shared/background-task.ts)와 [`IPC 계약`](../../IPC_CONTRACT.md)을 따른다.
