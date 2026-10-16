# OpenCode 1.19 시스템 피드 조사

2026-10-16. 공통 제품 계약은 [0232 ΔV3](../0232-background-transcript-ux/plan.md)다. 이 문서는 소스와 실행 증거이며 구현 완료 보고가 아니다.

## 결론

`<system-reminder>`는 독립 이벤트 타입이 아니라 모델 입력의 텍스트다. 저장된 사용자 텍스트 파트로 수신되는 경우와 모델 요청에만 삽입되는 경우가 모두 있다. 서버가 이미 모델에 전달한 피드를 Orca가 다시 보내면 중복 입력이 된다. 실제 background 완료는 `<system-reminder>` 대신 `<task …>`를 사용했으며, 서버가 부모를 자동 재개했다.

## 공식 소스와 설치본

| 근거 | 확인한 책임 |
|---|---|
| [v1.19.0 session/reminders.ts](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/session/reminders.ts) | 기본 plan/build 전환은 메모리의 사용자 parts에 synthetic text 추가. experimental plan은 updatePart로 저장·발행 |
| [v1.19.0 session/prompt.ts](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/session/prompt.ts) | reminder 적용 뒤 모델 입력 변환·호출. 일반 prompt는 자체 loop로 이어짐 |
| [v1.19.0 session/compaction.ts](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/session/compaction.ts) | 자동 압축 뒤 synthetic user text와 `compaction_continue` 메타를 만들고 서버 loop 계속 실행 |
| [v1.19.0 tool/task.ts](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/tool/task.ts) | 실험 background 완료 후 synthetic task 결과를 부모 `prompt`에 전달 |

호스트 실행 파일의 `--version`은 1.19.0이었다. 사용자가 내려받은 `.tmp/opencode-dev`는 2.0.29이므로 이번 실행 프로토콜의 근거로 사용하지 않았다. SDK의 `/v2/client` export와 제품 2.x 구분은 [기존 호환성 기록](runtime-compatibility.md)을 따른다.

## 실제 CLI와 loopback 합성 모델

사용자 서버와 별개인 임시 서버·작업 폴더·XDG 데이터 및 메모리 응답 모델을 사용했다. 실제 모델 API와 사용자 인증을 사용하지 않았다. 아래 횟수는 해당 테스트의 관측치이며 제품 인벤토리가 아니다.

| 시나리오 | 직접 관측 |
|---|---|
| 기본 plan → build | 두 요청 각각 모델 호출 1회. 모델 user content에 reminder가 있지만 reminder 자체의 synthetic part 저장·SSE는 없음 |
| experimental plan → build | 모델 전달과 함께 `message.part.updated`의 `type: text`, `synthetic: true` reminder 수신 |
| synthetic 입력 + `noReply: true` | 저장되지만 모델 호출 증가 0회. 저장 이벤트가 곧 새 입력 요구라는 가정은 성립하지 않음 |
| 일반 synthetic prompt | 모델 호출 증가 1회. 서버가 직접 소비함 |
| 자동 압축 | `role: user`의 synthetic text, `metadata.compaction_continue: true`와 서버 후속 모델 호출 관측 |
| background task | 클라이언트 prompt 1회. 부모 첫 idle 이후 synthetic `<task … state="completed">` 사용자 입력과 후속 assistant, 다음 idle 관측 |

background 테스트는 실험 기능을 명시적으로 켠 별도 서버에서 수행했다. 모델 호출은 부모 도구 요청·child·부모 첫 응답·완료 후 부모 응답을 합쳐 4회였고, 첫 prompt가 반환할 때는 3회였다. 후속 응답을 얻기 위한 클라이언트의 추가 prompt는 없었다. `message.updated.properties`에는 `info`와 `sessionID`가 모두 있었다.

[공식 runtime flag](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/effect/runtime-flags.ts)에 따르면 background는 전역 experimental 또는 전용 flag가 활성화하지 않으면 꺼져 있다. Orca가 명시적으로 켜는 코드는 없지만 `server.ts`가 부모·요청 환경을 전달하므로 현재 실행 앱의 실제 활성 상태는 이번 실측으로 단정하지 않는다. 이번 검증이 제품의 해당 기능을 켠 것은 아니다. 실제 모델의 도구 선택 품질이나 전체 Orca UI를 검증한 결과로 확대하지 않는다.

로컬 원본은 `.tmp/0265-reminder-probe-i62jAs/{default,experimental-plan,summary}.json` 및 `.tmp/0265-reminder-probe-MeyES6/{background,summary}.json`이다. 전체 모델 prompt가 포함된 원본과 내려받은 소스는 커밋하지 않는다.

[본문을 제외한 관측 요약](system-feed-evidence.json)에 호출 횟수·event shape·marker·검증 조건을 보존했다. 테스트 SSE·소유 서버·합성 모델 서버를 정리했고, 시작 시각 재검사에서 검증 시작 이후 생성된 OpenCode 프로세스 잔존은 0개였다. 기존 사용자 프로세스는 변경하지 않았다.

## Orca 코드와의 차이

`adapters/opencode/v1/map.ts`는 user 메시지 ID를 인식하지만 user part를 normalized 입력으로 발행하지 않는다. `adapter.ts`는 부모의 첫 idle에서 구독을 닫는다. 따라서 위 background 실측의 첫 idle 이후 이벤트는 현재 adapter 수명에서 수신할 수 없다. 실제 제품의 모든 세션에서 이 현상이 발생했다고 주장하지 않으며, native 실측과 코드 경계로 확인한 누락 경로다.

필요한 설계는 native provenance→공통 입력 속성, 이미 소비된 입력의 기록, 서버가 시작한 후속 응답의 수신 수명이다. 태그 검색→무조건 prompt 재송신은 채택하지 않는다. 취소·세션 전환·재연결·중복 ID·혼합 사용자/synthetic part를 READY 기준에 포함한다.
