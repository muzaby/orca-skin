# 0224 실행 fixture

작성: **Codex**. 앱 생산 코드를 계측하거나 사용자 Orca DB/config를 수정하지 않는다. 결과는 각 실행이 출력하는 임시 경로에 남는다. 대표 결과는 [evidence](../evidence/)에 보존했다.

## 실제 랜딩 UI

`app`에서 먼저 `npm run build`를 실행한다. `ELECTRON_RUN_AS_NODE`가 없는 환경에서 다음 fixture를 Electron으로 실행한다.

```powershell
./node_modules/electron/dist/electron.exe ../docs/handoff/0224-work-agent-layer/fixtures/work-native.cjs
```

격리한 config와 DB, 숨은 production 창에서 좌우 선택·초안/textarea 보존·Enter/Space·테마·좁은 창을 확인한다. Enter는 keyDown→char→keyUp 전체 입력열을 보낸다. `report.json`의 `errors`와 checks를 확인한다. 종료 코드만으로 판정하지 않는다.

`--live`는 **실제 Claude 호출**을 추가하며 호스트의 표준 Claude 인증 저장소를 참조한다. 최초 자동 승인 거부 후 사용자 명시 승인을 받아 실행했다. 전송 데이터는 실제 고객 정보가 없는 가상 회의 메모이고 파일 작성·게시를 요청한다. 최초 fixture는 게시 part·세션 종류와 SDK usage를 기록한다. 이때 캡처는 종료 직후 paint일 수 있으므로 최종 화면은 아래 재시작 fixture에서 확인한다.

`work-live-inspect.cjs <최초 root>`를 **별도 Electron 프로세스**로 실행하면 실제 게시 bytes/SHA-256·DB 연결·세션 로드·트랜스크립트/출력 UI를 확인한다. `--compare`를 추가하면 같은 가상 메모 한 문장 요약(Work)과 합성 `2 + 3` 답변(Coding)을 실제로 동시에 요청한다. 실제 모델 시험 승인 범위에서만 실행한다. 사용자 데이터를 전송하거나 파일 도구 응답을 mock하지 않는다. 기록된 root의 DB/config를 유지해야 하며, 최종 `reopen-report.json`·`compare-report.json`의 checks/errors를 확인한다.

## Coding 렌더 비교

저장소 루트에서 준비한다.

```powershell
node docs/handoff/0224-work-agent-layer/fixtures/coding-react-benchmark.mjs
```

준비 출력의 `run` 배열(실행파일·runner·cache)을 사용한다. Electron runner의 마지막 인자는 paired round 수이며 기본값은 5다. 다른 무거운 검사를 끝낸 후 실행한다. Windows background 실행은 `Start-Process -WindowStyle Hidden -Wait -PassThru`와 stdout/stderr 파일을 사용했다.

baseline은 git archive로 cache에 읽고 current는 working tree에서 읽는다. 원본 파일은 수정하지 않으며 cache bundle의 세 render 함수 진입에만 동일 카운터를 주입한다. manifest의 HEAD는 working tree 변경을 포함하지 않으므로 생산 파일 SHA256도 보존한다.

production profiling React와 실제 transcript 구성요소를 쓴다. 전체 앱의 IPC·SDK·paint/FPS·virtual viewport를 측정하는 fixture는 아니다. `result-*.json`의 errors, samples, 렌더 수, DOM 보존, median/p95를 함께 확인한다. A/B 창 사이에 마지막 창이 사라져도 시험 프로세스를 유지한다.

## 회귀 시험

순수 시험은 직접 Vitest로 실행한다. Electron ABI가 설치된 SQLite 시험은 `ELECTRON_RUN_AS_NODE=1`에서 Electron으로 Vitest를 실행한다. `npm test`의 pretest로 ABI를 교체하지 않는다. 홈/temp sandbox 제한이 생기는 fixture는 workspace cache에 격리한 `USERPROFILE`, `TEMP`, `TMP`를 사용한다.

[파일별 결과](../evidence/regression.json)는 전체 Node 수집 후 각 실패 파일의 최종 재실행을 교체한 결과다. [질문 IPC 결과](../evidence/question-ipc.json)는 후속 신규 시험이며 회귀 집계에 한 번 포함했다. 해당 집계의 기존 live suite skip은 그대로 보존한다. 이후 실제 production 앱으로 수행한 AC15 증거는 [실제 생성·게시](../evidence/live-run.json)·[동시 실행](../evidence/live-concurrent.json)·[재시작](../evidence/live-reopen.json)이며 mock/건너뛴 시험을 통과로 바꾼 것이 아니다.

## Work DOM 수명

루트에서 `node docs/handoff/0224-work-agent-layer/fixtures/work-react-lifetime.mjs`로 준비한 후 출력된 Electron runner/cache를 실행한다. [결과](../evidence/work-dom-lifetime.json)의 success·errors·samples를 함께 확인한다.

실제 Exchange/WorkActivity/ToolCard와 useScrollAnchor, production CSS를 사용한다. 카드 클릭 후 스크롤을 바닥에서 떼어 놓고 tail 20회 갱신·원래 도구의 늦은 결과에서 펼침·DOM·스크롤 위치를 확인한다. Windows 숨은 창은 rAF가 정지할 수 있어 Chromium offscreen으로 실행한다. JS rAF나 scroll hook을 mock하지 않으며 renderer sandbox/contextIsolation은 유지한다. 합성 도구 이름·결과는 표시만 하고 실행하지 않는다. virtualizer·앱 전체 라우팅·SDK·paint/FPS 시험은 아니다.
