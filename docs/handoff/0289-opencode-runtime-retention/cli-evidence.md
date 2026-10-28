# 0289 실제 CLI 전후 관측

2026-10-28 Windows에서 같은 격리 시나리오를 각각 1회 실행했다. CLI 1.19.0, SDK 1.18.27. 변경 전은 V1 설계 HEAD의 app/src archive, 변경 후는 r1 작업 트리다. 공유 브랜치 commit 좌표는 INDEX에서 검증자가 기입한다.

실행기: `app/scripts/smoke-opencode-retention.mjs`. 실제 OpenCodeServerPool·adapter·context·bridge·공유 준비 service·OpenCodeWarmup을 사용한다. OS CLI는 실제 프로세스이며 model은 loopback streaming fixture다. 내장 application MCP, 외부 stdio MCP와 HTTP MCP를 사용하고 HOME/XDG/native config는 임시 디렉터리로 격리했다. 외부 모델 API나 사용자의 실제 native 설정을 사용하지 않았다.

**범위:** main 조립에서 landing/navigation의 acquire/release를 수행했다. 실제 Electron renderer 창 전환·메뉴 체감·타 PC는 측정하지 않았다. 따라서 AC22/H1 전체 완료로 세지 않는다. 시간은 환경 기록이며 성능 SLA가 아니다.

## 단계별 누적 관측

HTTP는 Orca→CLI fetch 횟수다. 외부 MCP의 initialize 요청은 HTTP 연결 열에서 별도 센다. instance는 논리 acquire 횟수와 구별되는 고유 ID 수다. 변경 전에는 새 instance/bridge trace가 없으므로 해당 수치는 미계측(—)이다.

| 단계 | 전 UTC | 후 UTC | spawn 전→후 | exit 전→후 | CLI HTTP 전→후 | MCP status 전→후 | HTTP MCP 연결 전→후 | 후 instance / bridge |
|---|---|---|---:|---:|---:|---:|---:|---:|
| boot | 02:49:33.715Z | 02:47:31.937Z | 0→1 | 0→0 | 0→8 | 0→2 | 0→1 | 1 / 1 |
| landing | 02:49:45.960Z | 02:47:32.042Z | 1→1 | 0→0 | 6→8 | 1→2 | 1→1 | 1 / 1 |
| navigation-return | 02:49:55.933Z | 02:47:32.152Z | 2→1 | 1→0 | 12→8 | 2→2 | 2→1 | 1 / 1 |
| first-send | 02:50:12.390Z | 02:47:35.454Z | 3→1 | 2→0 | 20→13 | 2→2 | 3→1 | 1 / 1 |
| second-send | 02:50:12.782Z | 02:47:36.013Z | 3→1 | 2→0 | 21→14 | 2→2 | 3→1 | 1 / 1 |
| idle-toggle | 02:50:12.876Z | 02:47:37.201Z | 3→1 | 2→0 | 21→20 | 2→4 | 3→2 | 1 / 1 |
| busy-toggle | 02:50:13.173Z | 02:47:38.069Z | 3→1 | 2→0 | 22→27 | 2→6 | 3→3 | 1 / 1 |
| idle-expiry | 02:51:44.408Z | 02:49:09.198Z | 3→1 | 3→0 | 23→28 | 2→6 | 3→3 | 1 / 1 |
| return-after-expiry | 02:51:52.267Z | 02:49:20.691Z | 4→2 | 3→1 | 29→36 | 3→8 | 4→4 | 2 / 2 |
| quit | 02:51:53.701Z | 02:49:22.129Z | 4→2 | 4→2 | 29→36 | 3→8 | 4→4 | 2 / 2 |

부팅 단계의 모델 요청·session 요청은 0이다. agents/provider/MCP 준비를 병렬 호출하고, 이후 두 send까지 동일 instance/bridge/process를 유지했다. 두 실행 모두 마지막 owner를 해제하고 91초 기다린 뒤 다시 준비했다. 후속 실행은 만료 후 새 process/instance/bridge로 넘어갔고 quit 뒤 spawn=exit=2였다. 변경 전은 spawn=exit=4였다.

idle 토글과 busy 중 토글은 같은 순서로 수행했다. 변경 후는 busy 모델 응답을 붙잡은 동안 connect/disconnect 증가가 0임을 단언한 뒤 응답을 풀고 최신 연결 선택을 적용했다. 변경 전은 live reconcile API가 없으므로 같은 저장 선택의 즉시 연결 변화가 없다. 새 동작의 connect/disconnect·확인 status 때문에 총 CLI HTTP는 29→36으로 늘었다. 요청 총량 감소로 보고하지 않는다.

변경 후 bridge open/close는 각각 2/2다. `/instance/dispose` 요청은 전4/후1이었다. 후의 마지막 idle context는 quit의 전체 종료 경로로 정리된다. dispose 요청·실제 프로세스 exit·논리 instance attach를 같은 사건으로 세지 않았다.

첫 측정의 quit 고정 2초 검사에서 종료를 아직 관측하지 못해 실패했다. 실행기를 bounded exit/signal 관측으로 바꾼 위 재실행은 두 실행 모두 exit 0이다. production 종료 정책·timeout은 이 결과를 맞추기 위해 바꾸지 않았다.

## 재현

app에서 `node scripts/smoke-opencode-retention.mjs`를 실행한다. `ORCA_SMOKE_REPORT`로 결과 파일을 지정할 수 있다. 변경 전은 V1 설계 코드의 app/src를 별도 폴더에 풀고 같은 node_modules를 연결한 뒤 `ORCA_SMOKE_SOURCE`를 그 app 폴더로 지정하여 `--baseline`으로 실행한다. 기존 앱이나 CLI를 종료하지 않는다.

원본 로컬 산출: `work/0289-cli-after-final.json`, `work/0289-cli-before-final.json`와 같은 이름의 log. 이 문서가 공유 브랜치에 남기는 측정 요약이며 로컬 work 파일은 커밋하지 않는다. 사건 로그에는 opaque ID·경로 종류·상태만 기록하며 설정/인증 원문을 남기지 않는다.

## 행동 gate 집계

파일별 최신 실행 결과를 모으면 **862파일, 8,125 pass / 0 fail / 2 skipped**다. 여러 실행의 파일별 교체 집계이며 전체 suite를 한 번에 green으로 실행했다는 뜻이 아니다. 첫 전체 실행(860파일)의 7,685 pass / 345 fail / 88 pending 이후 수정·분리 실행을 반영했다. 이름이 바뀐 이전 assertion은 중복 합산하지 않는다.

- SQLite: Electron Node 모드 43파일/410 pass, 추가 targeted 3파일/50 pass. 이 수치는 위 집계에 포함하며 별도로 더하지 않는다.
- 마지막 실제 CLI: Electron Node 모드 `managed-mcp.cli.integration.test.ts` 1/1 pass, exit 0. 내장 mail도 실제 SQLite를 사용한다. 실제 승인 reject/200과 호출 증가 0, 허용 도구 출력, 승인 중단 및 소유 child 종료를 단언했다.
- 마지막 SSE 정리 보강: session-context/project-resource-sync 2파일/24 pass. 기존 테스트 이름을 유지하고 모든 SSE stream 취소를 추가 단언했다.
- 제외: 기존 `artifact-sdk-live.test.ts`, `harnesses/opencode/native-storage.integration.test.ts` 각 1건은 해당 통합 환경 조건으로 skipped다.

CLI 재실행 중 Windows 임시 폴더 정리 EBUSY 1회와 기존 시험의 두 관측 경합도 기록했다. turn.aborted에서 iterator를 종료하면 아직 응답 중인 interrupt까지 취소하므로 실제 지속 runtime처럼 소비를 유지하도록 바꿨다. 마지막 model 요청을 읽던 단언은 해당 턴의 role=tool 출력으로 바꾸고, 거절 시 model에 출력이 없을 수 있으므로 실제 permission reply와 미실행을 직접 본다. 마지막 실행은 정리까지 통과했다.
