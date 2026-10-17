# OpenCode 실행 패키지·호환성 실측

2026-10-14 KST. 호스트 CLI 업데이트 이후 확인한 결과이며, 배포 정책 승인을 대신하지 않는다.

| 대상 | 관측 | 의미 |
|---|---|---|
| 설치된 `@opencode-ai/sdk@1.18.27` | package dependencies는 `cross-spawn`; `dist/server.js`가 PATH의 `opencode`를 실행 | CLI 실행 파일을 포함하지 않는다 |
| `opencode-ai@1.18.27` | npm optionalDependencies에 같은 버전의 플랫폼별 CLI 패키지 | SDK와 별도로 고정 버전 CLI 동봉 가능 |
| `@opencode/cli@2.0.28` | 플랫폼별 `@opencode/cli-*` optionalDependencies | 호스트의 최신 CLI 패키지 계열 |
| `@opencode/sdk@2.0.28` | core/server/client/plugin/schema 의존성 | 새 임베디드 SDK. 기존 클라이언트 패키지의 버전만 바꾸는 작업과 다르다 |

최신 [공식 임베디드 SDK 문서](https://dev.opencode.ai/v2/docs/build/sdk/)는 `OpenCode.create()`로 서버를 내부 실행하고 HTTP listener 없이 라우팅한다고 설명한다. Electron·Windows에서 이 패키지의 실제 실행 호환성은 아직 검증하지 않았다. CLI 동봉 방식과 임베디드 SDK 방식은 별도 선택이다.

## 실제 프로세스 검증

사용자 OpenCode 앱이나 세션에 연결하지 않았다. Orca 서버 관리 코드가 loopback 임의 포트에 만든 child와 별도 XDG 데이터만 사용하고 finally에서 종료했다.

| 실행 파일 | 호출 경로 | 결과 |
|---|---|---|
| 호스트 `@opencode/cli`의 `opencode.exe` | `--version` → `serve` → `/global/health` | `opencode v2.0.28`; legacy health 경로가 HTML을 반환해 비호환 확인 |
| 공식 npm `opencode-windows-x64@1.18.27`의 실행 파일 | 같은 Orca server pool → SDK catalog | `1.18.27`; loopback health 성공, 모델 목록과 `build`·`plan` 조회 성공 |
| 같은 1.18.27 실행 파일 | 실제 `OpenCodeAdapter.sendMessage` → 로컬 OpenAI 호환 응답 fixture | `session.updated → input.echo → message.delta → message.completed → telemetry → turn.ended`; 오류 없음 |
| 사용자가 되돌린 호스트 실행 파일 | `opencode --version` → 새 격리 데이터 → 같은 health/catalog/실제 도구 fixture | `1.19.0`; 모델·에이전트 조회, `read` 도구, 텍스트, telemetry, turn 종료 성공 |

로컬 fixture는 별도 Node HTTP 서버이며 합성 응답만 돌려준다. 실제 모델 API·사용자 인증·과금 요청은 사용하지 않았다. CLI 내부 제목 생성도 같은 로컬 모델로 향했다.

비호환 health 응답은 JSON 파싱 예외 대신 CLI·SDK API 불일치 안내를 반환하도록 수정했다. HTML 응답 후 owned child 종료를 `opencode-server.test.ts`가 직접 단언한다.

도구 fixture는 임시 `fixture.txt`만 읽었다. `tool.call.started`의 `toolName=Read`, `providerTool.name=read`와 `tool.call.completed`를 확인했다. 1.18.27·1.19.0 모두 동일 결과이며 외부 모델 요청은 없었다.

## 현재 배포 방식

사용자는 동봉 질문에 호스트 CLI를 **1.19.0으로 되돌렸음**을 답했다. 기존 승인 설계대로 호스트 CLI를 Orca가 자동 관리하며 신규 패키지·동봉 정책은 도입하지 않는다. package.json·lockfile·electron-builder는 변경하지 않았다.

2.x CLI와 새 임베디드 SDK는 이번 지원 범위가 아니다. 사용자가 나중에 선택하면 API·실행 격리·lifecycle·배포 검증을 포함해 설계를 갱신해야 한다. 2.x로 생성된 임시 데이터로 1.x를 실행하면 서버가 시작 중 종료되어, 버전 호환성 검증은 새 데이터 디렉터리에서 수행했다.

## Electron main 로딩

`@opencode-ai/sdk/v2/client`의 `v2`는 SDK 내부 export 경로이며 npm 패키지 버전은 `1.18.27`이다. 이 export는 `import` 조건만 제공하므로 CommonJS main에 외부 의존성으로 남기면 `ERR_PACKAGE_PATH_NOT_EXPORTED`가 발생한다. `electron.vite.config.ts`의 main `build.externalizeDeps.exclude`로 SDK를 번들에 포함하며, 패키지 재설치나 CLI 버전 변경은 필요하지 않다.

2026-10-14 실제 `npm run dev`에서 SDK 로딩 이후 `boot.sequence.completed`·`app.start.completed`를 확인했다. 함께 발견한 로컬 `better-sqlite3` ABI 127/140 불일치는 설치된 `@electron/rebuild`의 `--force --only better-sqlite3 --version 39.8.10`으로 복구했고, Electron의 메모리 DB 조회로 ABI 140을 확인했다.

## 입력 접수와 실제 런타임 검증

`SessionRuntime`이 입력을 submitted로 바꾼 뒤 OpenCode 어댑터가 `canSubmitInitial`을 다시 호출해 전송 없이 끝나는 결함을 수정했다. 입력 접수는 공통 런타임이 소유하고 어댑터는 접수된 입력을 HTTP로 전송한다. `opencode-runtime.test.ts`는 실제 PendingMessageQueue·buildTurnRequest·SessionRuntime·OpenCodeAdapter·SDK를 연결해 이 경계를 검증한다.

CLI 1.19.0 + 실제 SessionRuntime + 로컬 OpenAI 호환 합성 모델로 첫 턴과 후속 턴을 확인했다. 두 턴 모두 commit 1회, `session.updated → input.echo → message.delta → message.completed → telemetry → turn.ended`를 관측했다. 저장소 내부 임시 폴더에서 실행한 앞선 검증은 저장소 탐색 중 45초 제한에 도달했으므로, 저장소 밖 격리된 임시 작업 폴더에서 재검증했고 사용자 인증·외부 모델 요청은 사용하지 않았다.

## SDK export와 제품 v2의 구분 및 제거 결과

2026-10-14 사용자 요청으로 SDK import와 새 제품 API를 다시 대조했다. [공식 v1.19.0 앱 소스](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/app/src/utils/server.ts)는 `@opencode-ai/sdk/v2/client`를 import하여 기존 client를 만든다. 이 `/v2`는 flat-parameter SDK export 이름이며 CLI 2.x 전용이라는 뜻이 아니다.

별도 `client.v2`는 `/api/session/:id/prompt`, `/api/event`를 호출한다. 이 native API 계열은 1.x 이행기 SDK에도 들어 있었고 현재 [제품 v2 API](https://dev.opencode.ai/v2/docs/api)로 이어졌다. 현행 v2의 [네트워크 client](https://dev.opencode.ai/v2/docs/build/client/)는 `@opencode/client`, [embedded SDK](https://dev.opencode.ai/v2/docs/build/sdk/)는 `@opencode/sdk`로 제공된다. 같은 `v2` 표기만으로 이 셋을 같은 버전이라고 판정할 수 없다.

Orca에서는 native API 비교 테스트와 fixture를 제거했고, 실제 전송 경로는 계속 `/session`, `/event`, `/session/:id/prompt_async`다. `@opencode/cli` 자동 탐색과 prefix 없는 시작 로그 지원도 제거했다. 지정/PATH 실행 파일이 2.x 또는 판독 불가 버전을 출력하면 `serve` 전에 1.x 필요 오류로 끝난다. 설치 조회는 실제 버전 정보를 계속 반환한다.

SDK 패키지는 1.18.27을 유지한다. 외부 패키지 내부에 포함된 미사용 native API 정의를 수정하거나 숨기지 않았으며, 제거 범위는 Orca 코드의 API 호출·테스트·CLI 지원이다. 과거 0214 연구는 조사 당시 근거로 남긴다.

현재 실행 파일의 `--version`을 다시 실행해 1.19.0을 확인했다. 변경 후 실제 pool/version probe→CLI 1.19.0→SessionRuntime→로컬 합성 모델에서 첫 턴·후속 턴의 입력 접수와 응답·종료를 재확인했다. 두 턴 각각 commit 1회, 마지막 이벤트 turn.ended, 응답 본문 일치이며 외부 모델 API 요청은 없다.

## Native 메시지 ID 검증 (2026-10-15 r1.14)

기존 `msg_`+UUID는 native ID 형식과 다르다. [공식 앱 1.18.5](https://github.com/anomalyco/opencode/blob/v1.18.5/packages/app/src/utils/id.ts)와 [1.19.0 생성기](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/id/id.ts)의 시간·counter·base62 형식을 v1 helper에 반영했다. ID는 SDK 요청·parent 필터·activity generation에 같은 값으로 전달한다.

사용자가 보고한 `<` 기반 종료는 [1.18.5 prompt](https://github.com/anomalyco/opencode/blob/v1.18.5/packages/opencode/src/session/prompt.ts)에서 확인했다. 현재 조회한 [1.19.0 prompt](https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/session/prompt.ts)는 parentID equality를 사용한다. 같은 공식 ID 생성 형식을 적용하되 종료 조건 차이와 사용자의 실행 환경을 구분한다.

| 실행 | 직접 관측 |
|---|---|
| 호스트 실행 파일 | `opencode-ai/bin/opencode.exe --version` → 1.19.0 |
| 기존 UUID 코드, 실제 CLI 1.19.0 | 새 세션1턴·재개2턴 모두 본문1회씩, stop→turn.ended. UUID가 assistant보다 커도 정상. 해당 binary에서 반복 결함은 재현되지 않음 |
| 수정 코드, 실제 CLI 1.19.0 | 새 세션2턴·기존 UUID 이력 세션 재개2턴 모두 본문1회/완료1회씩. parentID가 새 native ID와 일치, 기존 기록 유지 |
| legacy 조건 transport 회귀 | 실제 SDK body를 native assistant ID와 비교하는 bounded fixture. UUID 변이에서 본문 생성 시도2회로 assertion 실패, 원본 복원 후 연속2턴 각1회 통과 |

실제 CLI 관측은 제목용 aux 모델과 본문용 body 모델을 분리하고 외부 API·사용자 인증 없이 loopback provider로 수행했다. 소유한 테스트 프로세스는 모두 종료했다. `.tmp/0262-id-order-smoke.ts`와 `0262-id-order-s9FPJC/{red,red-resume,green-resume}.json`, `0262-id-order-mXbfWD/green-fresh.json`에 로컬 증거를 보관한다. 1.19.0 결과를 실패→성공 재현으로 표현하지 않으며, 사용자가 관측한 실행 파일·버전은 확인 요청 상태다. 원본과 같은 생성 규칙이므로 서로 다른 프로세스의 동일ms 순서나 시스템 시계 변경까지 새로 보장하지 않는다.
