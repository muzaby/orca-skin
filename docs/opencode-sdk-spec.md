# OpenCode SDK 사양과 배포 코드 분석

## 1. 조사 기준과 채택 상태

**분석·설치 버전은 @opencode-ai/sdk 1.18.27이다.** 2026-09-03 KST 설치 직전 npm의
version/dist-tags.latest를 조회한 뒤 app dependencies에 범위 연산자 없이 고정했다.
package.json, package-lock.json, 설치본 package.json과 npm ls 결과가 같은 버전이다.
이 날짜 이후의 latest를 뜻하지 않는다.

SDK는 설치됐지만 Orca의 OpenCode adapter, CLI/server, 인증·모델 연결은 구현하거나 실행하지
않았다. Backend와 활성 registry는 Claude를 유지한다. 레이어별 전환 제안은
[Orca 마이그레이션 연구 가이드](etc/study/opencode/orca-migration-guide.md)에 있으며,
현재 구조의 정본은 [backend overview](arch/backend/overview.md)와 코드다.

| 증거 수준 | 이 문서에서 뜻하는 것 |
| --- | --- |
| 배포 타입 | 설치된 dist의 .d.ts가 선언한 shape·주석. 서버가 실제 준수한다는 보장은 아님 |
| 배포 구현 | 설치된 .js의 요청 직렬화·오류·SSE·프로세스 처리 |
| fixture 관측 | 실제 공개 SDK에 메모리 내 HTTP/SSE를 주입한 결과. 서버·Electron 실기 아님 |
| 원문 | 공식 sdk/server 문서의 버전 고정 사본. 배포 코드와 다르면 차이를 명시 |
| 후속 검증 | 실제 지원 server, Electron net.fetch, 인증, 취소·복원, 모델 동작에 필요한 검증 |

설치 재현 명령은 app 디렉토리에서 다음과 같다. CI/재현에는 lockfile을 사용하는 npm ci가 기준이다.

~~~powershell
npm.cmd view @opencode-ai/sdk version dist-tags.latest dist.integrity dist.tarball --json
npm.cmd install --save-exact @opencode-ai/sdk@1.18.27
npm.cmd ls @opencode-ai/sdk --depth=0
~~~

배포 tarball은 [npm 1.18.27](https://registry.npmjs.org/@opencode-ai/sdk/-/sdk-1.18.27.tgz)이며
lockfile integrity는 다음 값이다.

~~~text
sha512-VTfAB9SWaGiMtI2L9rf2xl+0fTYDMHB2pHYKCquWG5OIX3rHvth9oM915d9Z38IuPZUZkmdNMVz2iAdxG4IR+A==
~~~

직접 전이 의존성은 cross-spawn 7.0.6이다. 패키지는 ESM이며 CLI 바이너리를 제공하지 않는다.
원문·태그·SHA256·MIT 라이선스는 [원문 미러 INDEX](spec/opencode/INDEX.md)에 별도로 보존한다.

## 2. 패키지 구조와 API 표면

설치본의 exports는 root, /client, /server, /v2, /v2/client, /v2/gen/client, /v2/server,
/v2/types다. 소스 저장소의 src 기반 package manifest와 배포본의 dist 기반 exports를
혼동하지 않는다. 아래에서 SDK는 @opencode-ai/sdk를 줄여 쓴 것이다.

| 표면 | public import | 호출 모양 | endpoint / event |
| --- | --- | --- | --- |
| root legacy | SDK 또는 SDK/client | client.session.prompt({ path: { id }, body: { parts } }) | /session/{id}/message, /event의 type/properties |
| v2 import의 legacy | SDK/v2 또는 SDK/v2/client | client.session.prompt({ sessionID, parts }) | 같은 legacy /session/{sessionID}/message, /event의 type/properties |
| v2 import의 native | SDK/v2 또는 SDK/v2/client의 **client.v2** | client.v2.session.prompt({ sessionID, prompt: { text } }) | /api/session/{sessionID}/prompt, /api/event의 type/data |

**root client에는 client.v2가 없다.** /v2 import만으로 native endpoint를 사용하는 것도
아니다. 같은 패키지 버전이어도 root와 v2 generated code는 별도이며, v2 client는 legacy와
native namespace를 함께 노출한다.

| 설치본 경로 — app/node_modules/@opencode-ai/sdk/ 기준 | 역할 |
| --- | --- |
| dist/index.js, dist/v2/index.js | createOpencode: server와 client를 함께 생성 |
| dist/client.js, dist/v2/client.js | client factory, directory/workspace 처리, 오류 interceptor |
| dist/gen/sdk.gen.js + types.gen.d.ts | root 메서드의 endpoint·직렬화 및 타입 |
| dist/v2/gen/sdk.gen.js + types.gen.d.ts | v2 import의 legacy/native 메서드와 타입 |
| dist/gen/client/client.gen.js, dist/v2/gen/client/client.gen.js | REST 요청·응답 envelope·HTTP 오류 |
| dist/gen/core/serverSentEvents.gen.js, dist/v2/gen/core/serverSentEvents.gen.js | 실제 SSE parser·retry·fetch 선택 |
| dist/server.js, dist/v2/server.js, dist/process.js | 외부 opencode 실행·시작 대기·종료 |
| dist/error-interceptor.js | throwOnError일 때 HTTP 오류를 Error/cause로 변환 |

동일 태그의 [SDK 소스 디렉토리](https://github.com/anomalyco/opencode/tree/v1.18.27/packages/sdk/js/src)는
상류 참고점이다. 이 문서의 세부 계약 판정은 npm에 **실제로 배포된 파일**을 우선한다.

## 3. 호출·응답·오류 계약

### 3.1 표면별 요청

아래는 [실행 가능한 계약 테스트](../app/src/main/adapters/opencode-sdk.test.ts)의 호출
형태를 축약한 것이다. 테스트는 fake fetch를 사용한다. 실제 앱에 baseUrl만 넣어 실행하라는
예제가 아니며, Electron에서는 §6의 transport 검증이 선행돼야 한다.

~~~ts
import { createOpencodeClient as createRootClient } from '@opencode-ai/sdk'
import { createOpencodeClient as createV2Client } from '@opencode-ai/sdk/v2'

// fetch 인수는 테스트의 메모리 전용 transport다.
const root = createRootClient({ baseUrl, fetch: fixtureFetch })
await root.session.prompt({
  path: { id: 'session-1' },
  body: { agent: 'build', parts: [{ type: 'text', text: 'Hello' }] }
})

const v2 = createV2Client({ baseUrl, fetch: fixtureFetch })
await v2.session.prompt({
  sessionID: 'session-1',
  agent: 'build',
  parts: [{ type: 'text', text: 'Hello' }]
})
await v2.v2.session.prompt({
  sessionID: 'session-1',
  id: 'input-1',
  prompt: { text: 'Hello' },
  delivery: 'queue',
  resume: false
})
~~~

세 호출은 서로 대체 가능한 함수 시그니처가 아니다. native의 V2SessionPromptData.body는
prompt를 필수로 선언하지만 generated flattened 메서드는 prompt?로 더 느슨하다. 호출자는
wire 타입에 맞춰 prompt를 제공해야 한다.

예제의 resume: false는 입장 수락 직렬화를 관측하기 위한 값이다. d.ts는 이 값이 false이면
agent-loop 실행을 예약하지 않는다고 설명한다. 모델 실행 예제로 복사하지 않는다.

| 작업 | legacy 계약 | native 계약·주의점 |
| --- | --- | --- |
| 생성 | session.create: title, parentID 등 legacy 옵션 | client.v2.session.create: id/agent/model/location 등 native 옵션 |
| prompt | body parts 입력, AssistantMessage + Part[] 응답 선언 | PromptInput 입력, SessionInputAdmitted 응답. 생성된 답변 완료와 입장 수락은 다름 |
| history | session.messages: info/parts 중심 | client.v2.session.messages의 SessionMessage, history의 durable event page |
| 취소 | session.abort | client.v2.session.interrupt: 현재 프로세스의 실행 중인 세션 중단; idle이면 no-op이라는 d.ts 설명 |
| 되돌리기 | session.revert/unrevert, fork 존재 | native revert의 stage/commit 등 별도 계약. legacy와 함수명만 매칭하지 않음 |

native prompt의 HTTP 성공 body는 { data: SessionInputAdmitted }다. 기본 SDK 결과는
{ data: HTTP body, request, response }이므로 **result.data.data**가 admitted 객체다.
responseStyle: 'data'는 SDK 바깥 envelope만 없애고 HTTP body의 data는 유지한다.
admittedSeq, id, sessionID, prompt, delivery, timeCreated 등을 답변 message ID/완료로
해석하지 않는다. 근거: V2SessionPromptResponses, SessionInputAdmitted.

### 3.2 오류와 비어 있는 성공 응답

| 설정/상황 | 배포 구현의 결과 | 소비자 책임 |
| --- | --- | --- |
| 기본 fields, HTTP 성공 | { data, request, response } | error 분기를 확인한 뒤 data 사용 |
| 기본 fields, HTTP 실패 | { error, request, response } | try/catch만으로 HTTP 실패를 처리하지 않음 |
| responseStyle: 'data', throwOnError: false, HTTP 실패 | undefined | 빈 성공 값과 혼동하지 않음 |
| throwOnError: true, HTTP 실패 | factory의 wrapClientError가 Error로 변환 | message만 저장하지 말고 cause의 body/status를 내부에서 분류·redact |
| root fetch reject | REST fetch 바깥 catch가 없어 reject 전파 | 네트워크/Abort 예외를 별도로 처리 |
| v2 fetch reject | throwOnError false면 error 필드 + response: undefined, data style이면 undefined | HTTP status가 항상 있다고 가정하지 않음 |
| response interceptor·JSON parse/validator 예외 | throwOnError false라도 reject 가능 | fields 방식도 최상위 예외 경계 필요 |
| JSON 204 또는 Content-Length: 0 | {} (fields면 data: {}) | 선언이 void라고 런타임 undefined를 강제 가정하지 않음 |

v2는 200 JSON 빈 body도 {}로 처리한다. root와 v2의 비어 있는 body 처리 구현을 동일하다고
일반화하지 않는다. responseStyle 같은 factory 옵션과 generated 메서드의 정적 반환 제네릭이
항상 함께 좁혀지는 것도 아니므로 타입과 관측을 따로 확인한다.

throwOnError의 Error.message는 body.data.message, body.message, body.name 등의 순서로
선택하고, cause는 { body: 원래 오류, status: HTTP status }를 갖는다. 기본 false일 때
파싱된 오류 body를 반드시 Error 인스턴스라고 가정해서는 안 된다.

HTTP 오류 타입과 assistant의 모델 실행 오류도 다르다. root의 BadRequestError/NotFoundError,
native의 _tag 기반 InvalidRequestError 등은 API 실패다. legacy AssistantMessage.error의
ProviderAuthError/UnknownError/MessageOutputLengthError/MessageAbortedError/ApiError는
메시지 결과의 오류다. native AssistantMessage에 대응하는 SessionMessageAssistant는
SessionErrorUnknown을 갖는다. ApiError의 wire name은 APIError다.

## 4. message / part / tool 타입

### 4.1 legacy Message와 Part

root Message는 role: 'user'인 UserMessage 또는 role: 'assistant'인 AssistantMessage다.
메시지 목록/단일 응답은 info와 parts를 분리한다. Part의 id, messageID, sessionID와
ToolPart.callID는 서로 다른 식별 축이다.

| 타입 | 주요 필드 | Orca 변환에서 주의할 점 |
| --- | --- | --- |
| UserMessage | id/sessionID, time.created, agent, model { providerID, modelID }, optional summary/system/tools | 모델 식별자를 Claude model 문자열로 단순 축약하지 않음 |
| AssistantMessage | id/sessionID, parentID, providerID/modelID, mode, path, time, cost, tokens, finish?, error? | parentID와 Orca pending ID 구분; finish/완료 시간/오류를 함께 해석 |
| TextPart | type=text, text, synthetic?/ignored?, time? | snapshot과 append delta 구분 |
| ReasoningPart | type=reasoning, text, time, metadata? | 사용자 text와 분리; 표시·보존 정책 별도 |
| FilePart | type=file, mime, url, filename?, source? | URL/path 권한·첨부 보존; 무조건 로컬 파일로 가정하지 않음 |
| ToolPart | type=tool, callID, tool, state, metadata? | part ID와 call ID를 섞지 않고 상태 upsert |
| StepStartPart / StepFinishPart | step-start / step-finish; finish는 reason, cost, tokens 등 | step 종료가 전체 turn 종료는 아님 |
| SnapshotPart / PatchPart | snapshot / patch | 텍스트가 아닌 작업 공간 변경 정보 |
| AgentPart / subtask variant (v2: SubtaskPart) | agent / subtask | root subtask는 Part 안의 inline 타입이며 별도 SubtaskPart export가 아님 |
| RetryPart / CompactionPart | retry / compaction | 재시도·컨텍스트 압축 의미를 독립 처리 |

위 표는 root/v2 legacy Part union의 type variant를 모두 다룬다. 개별 optional 필드와
v2에서 추가된 필드는 각 설치본 Part/Message 선언이 정본이다. 예를 들어 v2 legacy는
StructuredOutputError/ContextOverflowError/ContentFilterError 같은 오류와 구조화 출력
계약을 추가하지만 root에 그대로 존재한다고 가정하면 안 된다.

| legacy ToolState.status | 데이터 |
| --- | --- |
| pending | input 객체 + raw 문자열 |
| running | input 객체, title?/metadata?, time.start |
| completed | input, output 문자열, title, metadata, time.start/end, attachments? |
| error | input, error 문자열, metadata?, time.start/end |

usage는 input/output/reasoning/cache.read/cache.write와 cost를 보존한다. message와 step의
수치를 각각 더해 이중 계상하지 말고 후속 mapper에서 누적/증분·완료 기준을 고정해야 한다.

### 4.2 native SessionMessage

native SessionMessage는 role이 아니라 **type**으로 구분한다. legacy Message/Part를
그대로 캐스팅할 수 없다. id/time/metadata와 type별 payload를 갖는다.

| type | 내용 |
| --- | --- |
| agent-switched | agent 전환 |
| model-switched | ModelRef 전환 |
| user | text, files?, agents? |
| synthetic | sessionID, text |
| system | text |
| shell | callID, command, output, 완료 시간? |
| assistant | agent/model, content[], snapshot?, finish?, cost?, tokens?, error? |
| compaction | reason(auto/manual), summary, recent |

assistant의 content 항목은 text, reasoning, tool이다. text/reasoning은 별도 id를 가지며
reasoning에는 providerMetadata/time이 있을 수 있다. tool content는 id/name/provider?,
time 및 state를 갖는다.

| native tool state | legacy와 다른 점 |
| --- | --- |
| pending | input이 **문자열**이다 |
| running | input 객체, structured, content[] |
| completed | input, content[], structured, attachments?/outputPaths?/result? |
| error | input, content[], structured, error: SessionErrorUnknown, result? |

native content[]는 LlmToolContent로 선언되므로 completed.output 문자열을 요구하는 legacy
mapper를 재사용할 수 없다. raw 객체를 stringify하여 본문으로 던지는 것도 손실·민감정보
노출 가능성이 있다. 미지원 content의 보존/거절/capability 제외 정책을 먼저 정해야 한다.
근거: dist/v2/gen/types.gen.d.ts의 SessionMessage union과 SessionMessageAssistant.

## 5. 이벤트 계약, 순서와 복구

### 5.1 envelope를 먼저 분리한다

| 스트림 | decoded data shape | 주요 차이 |
| --- | --- | --- |
| root /event | Event = { type, properties } union | message.part.updated에 part와 optional delta |
| v2 legacy /event | Event = { id, type, properties, ... } union | message.part.delta 등의 확장; root의 타입과 별개 |
| native /api/event | V2Event = { id, type, data, metadata?, durable?, location? } union | durable는 { aggregateID, seq, version }; 모든 이벤트에 존재하지 않음 |

native stream에도 message.part.* 및 session.status/idle 같은 호환 이벤트가 들어갈 수 있다.
type/data라는 envelope가 곧 모든 항목이 session.next.*라는 뜻은 아니다. server.connected,
catalog/provider/project/file/PTY 등에는 일반 대화의 sessionID가 없거나 의미가 다를 수 있다.
전역 이벤트를 무조건 활성 Orca session에 붙이면 안 된다.

| 관심 이벤트 계열 | 변환 시 확인할 계약 |
| --- | --- |
| message.updated/removed, message.part.updated/removed/delta | info/part snapshot과 field/delta를 분리; root updated.delta와 v2 별도 delta 혼용 금지 |
| session.created/updated/deleted/status/idle/error/compacted/diff | 생명주기·상태·오류이며 전체 turn terminal 규칙은 별도 |
| session.next.prompted/prompt.admitted/context.updated/synthetic | 입력 입장·context 변화와 assistant 응답을 구분 |
| session.next.text.started/delta/ended, reasoning.started/delta/ended | data.sessionID/assistantMessageID/textID 또는 reasoningID 등 실제 식별자를 사용 |
| session.next.tool.input.started/delta/ended, tool.called/progress/success/failed | 부분 JSON input과 실행 lifecycle, 실패 payload를 구분 |
| session.next.step.started/ended/failed, retried, compaction.*, shell.*, revert.* | step/압축/셸/되돌리기 결과를 turn 완료로 일괄 취급하지 않음 |
| permission.* / question.* | 요청별 상관 ID, 답변·거절·취소 경로 (§7) |
| server/global, integration/catalog, project/workspace/worktree, file/reference, MCP/LSP/VCS, PTY/TUI 등 | adapter capability와 session scope에 따라 처리; 모르는 이벤트를 성공으로 변환하지 않음 |

목록의 전수 타입 정본은 각각 Event/V2Event union이다. 이 표는 소비 책임별 분류이며 새
타입 추가를 조용히 drop해도 된다는 뜻이 아니다.

### 5.2 durable replay와 Orca history는 별개다

v2 client의 native session 메서드가 다음을 선언한다.

| 메서드 | 경로 | d.ts가 선언한 의미 |
| --- | --- | --- |
| client.v2.session.history({ sessionID, after?, limit? }) | /api/session/{sessionID}/history | after(number) aggregate seq 뒤의 유한 durable event page; 다음 page는 새 event를 볼 수 있음 |
| client.v2.session.events({ sessionID, after? }) | /api/session/{sessionID}/event | after(string) aggregate seq 뒤 replay 후 새 durable event 구독 |
| client.v2.event.subscribe(...) | /api/event | 전역 native event stream; 세션별 durable cursor와 동치가 아님 |

이는 **배포 타입/주석 확인**이며 실제 server의 보존 기간·누락 복구·순서·restart 동작을
검증한 결과가 아니다. SSE Last-Event-ID와 durable.aggregateID/seq 및 history.after는
다른 계층의 cursor다. 임의로 서로 대입하지 않는다.

Orca 후속 adapter는 backend/session/message/content ID, frame token, durable sequence로
중복·늦은 이벤트를 격리하고 gap이면 resync해야 한다. snapshot은 overwrite, delta는 append로
분리하며 replay된 사용량/도구 완료를 다시 계상하지 않는다. UI 기록의 SSOT는 Orca DB로
유지하고 OpenCode history는 transport 복구 근거로 다루는 것이 이번 연구의 권고다.

## 6. SSE와 Electron 네트워크 제약

**1.18.27 root SSE는 configured fetch를 우회한다.** root REST에는 fetch가 주입되지만
dist/gen/core/serverSentEvents.gen.js는 fetch(url, options)를 직접 호출하고 request
interceptor도 거치지 않는다. 실제 SDK fixture로 이 차이를 관측했다. 따라서 root client에
netFetch를 지정했다는 이유만으로 Orca의 Chromium 단일 네트워크 정책을 충족한다고 말할 수 없다.

v2 SSE는 options.fetch ?? globalThis.fetch를 선택하고 onRequest를 통해 request interceptor를
적용한다. v2 legacy/native 양쪽을 fake injected fetch로 관측했다. 이 경로가 후속 transport
검증의 우선 후보이며 **Electron 호환성 확인 또는 native API 채택 결정은 아니다.**

| 동작 | 설치 JS에서 확인한 한계 |
| --- | --- |
| 시작 | subscribe 결과의 stream은 lazy async generator; 소비 시 fetch 시작 |
| parse | data를 JSON.parse 시도하고 실패하면 문자열. TypeScript union은 런타임 validator가 아님 |
| event/id/retry | onSseEvent에 전달; iterator는 decoded data를 yield |
| retry | catch에서 onSseError 호출; 기본 지연 3000ms, 지수 backoff cap 30000ms, max attempts는 기본 미지정 |
| retry 한도 | 한도 도달 시 throw가 아니라 iterator 종료. onSseError와 terminal 상태를 함께 확인 |
| 정상 EOF | 재연결 없이 종료. EOF를 모델 turn 성공으로 간주하지 않음 |
| abort | reader cancel/다음 loop의 signal 확인. error backoff 도중에는 즉시 반환을 보장하지 않음 |
| 정리 | finally에서 abort listener 해제·reader lock 해제; SDK stream close와 서버 session interrupt는 별개 |
| 줄바꿈 | v2는 CRLF/CR을 LF로 정규화, root는 LF delimiter 중심 구현 |

오류 retry 때 Last-Event-ID를 다시 보내는 것은 클라이언트 동작일 뿐 서버의 replay 보장이
아니다. 연결 끊김·중복·순서 역전·외부 abort·정상 EOF를 별개 fixture로 후속 검증해야 한다.

directory 설정은 x-opencode-directory를 만들며 GET/HEAD에서 query로 이동한다. v2는
experimental_workspaceID도 처리하고 native /api/ 요청에 location[directory] /
location[workspace] query를 추가한다. root SSE는 이 interceptor 경계도 동일하지 않다.

v2 REST response interceptor는 content-type이 정확히 text/html이면 지원되지 않는 server
요청이라는 Error를 던진다. 이것은 완전한 버전 협상/호환성 검사가 아니고 SSE의 HTTP
response 처리 전체를 대신하지도 않는다. 앱→OpenCode server의 fetch를 주입하더라도
**OpenCode server→model provider의 통신은 별도 프로세스/정책 경계**다.

## 7. permission과 question

승인 요청과 사용자 질문은 별도 API다. reply 성공의 boolean과 승인 선택 enum도 다르다.

| 표면 | 요청/응답 계약 |
| --- | --- |
| root permission | permission.updated의 id/type/pattern/sessionID/messageID/callID/title/metadata/time; client.postSessionIdPermissionsPermissionId({ path: { id, permissionID }, body: { response } }) |
| v2 legacy permission | permission.asked/replied, client.permission.reply({ requestID, reply, ... }) |
| native permission | permission.v2.asked/replied 및 PermissionV2Request/PermissionV2Reply; action/resources/save/metadata/source 등 보존 |
| v2 question | question.asked/replied/rejected 및 question.v2.*; 질문 순서에 대응하는 answers 배열 사용 |

root response, v2 legacy reply, PermissionV2Reply는 once / always / reject를 표현한다.
body: true/false라는 예전 추측은 틀렸다. PermissionV2Request의 save 관련 정보와 saved
permission API가 존재하지만 이를 Claude default/acceptEdits/bypassPermissions/plan과
자동 동치로 만들지는 않는다. always의 범위·저장·철회와 기존 vault/permission mode의
매핑은 후속 제품 결정이다.

question의 answers는 질문 순서별 선택 문자열 배열, 즉 string[][]다. Orca에는 이미
permission.requested의 action.kind = ask_question 및 AskResult 경로가 있으므로 재사용을
검토할 수 있다. 그러나 Orca의 question-keyed Record와 배열은 동일하지 않다. 중복 질문
문자열, 순서, multiple/custom 답변, reject/cancel, 늦은 reply를 검증해야 한다.
tool 권한 reject를 session interrupt와 동일하게 처리하면 안 된다.

정확한 호출의 request scope/session scope와 옵션은 선택한 v2 generated class에서
확인해야 한다. native의 전역 request API와 session-scoped API를 한 요청에 혼용하지 않는다.

1.18.27의 native 공개 경로는 다음과 같다. 아래는 배포 타입 확인이며 이 작업의 fixture가
permission/question 서버 동작을 실행한 것은 아니다.

| native 경로 | 인수·범위 |
| --- | --- |
| client.v2.permission.request.list | location?으로 pending 목록 조회; 이 request namespace에 reply는 없음 |
| client.v2.session.permission.list/get/create/reply | sessionID로 소유권 지정; reply는 requestID와 reply enum, message? 사용 |
| client.v2.permission.saved.list/remove | projectID? 목록, id 삭제; 별도 add 메서드 없음 |
| client.v2.question.request.list | location?으로 pending 목록 조회 |
| client.v2.session.question.list/reply/reject | sessionID/requestID 사용; reply는 questionV2Reply: { answers: string[][] } |

generated session.permission.reply의 reply? 역시 wire body에서는 필수이므로 생략하지 않는다.
legacy client.question.reply의 flat answers와 native questionV2Reply wrapper를 구분한다.

## 8. 설정·모델·인증·MCP·프로세스

| 관심사 | 확인한 사실 | 후속 Orca 책임 |
| --- | --- | --- |
| provider/model | legacy provider/config API와 native model/provider/integration namespace가 별도 | ProviderId/ModelRef/catalog를 분리하고 capability 검증 |
| provider credential | root auth.set({ path: { id }, body: { type: 'api', key } }) 같은 타입 존재 | 저장 위치·server 전달·vault·redaction 결정; API 존재가 인증 정책 승인은 아님 |
| server 인증 | 공식 server 문서의 OPENCODE_SERVER_PASSWORD 및 optional OPENCODE_SERVER_USERNAME | provider API key와 별개인 server 인증 경계·endpoint 신뢰 검증 |
| config | config.get/update, createOpencode의 inline config, OPENCODE_CONFIG_CONTENT 전달 | 디스크 파일만 가능하다고 가정하지 않음; 비밀의 plaintext 기록을 기본값으로 삼지 않음 |
| permission | config/rule/reply/saved 관련 API 존재 | Claude mode와 의미·범위·상속이 같은지 검증 |
| extensions/MCP | legacy mcp namespace, native integration/skill 등 존재 | Claude plugin directory/skill deploy 포맷을 그대로 재사용하지 않음 |
| filesystem/PTY | file/fs·PTY API가 별도 존재 | server가 보는 workspace와 앱이 보는 경로, remote 파일·terminal 권한 경계 구분 |

createOpencodeClient는 연결용 client만 만든다. createOpencode/createOpencodeServer는
cross-spawn으로 외부 opencode serve를 실행한다. helper 기본 hostname은 127.0.0.1,
port는 4096, 시작 대기 timeout은 5000ms다. env에 OPENCODE_CONFIG_CONTENT를 전달하고
stdout의 server listening URL을 파싱한다. 시작 실패/timeout/abort와 close는 프로세스
정리 경로를 갖지만 Windows 패키징·자식 트리 종료는 실기 확인하지 않았다.

createOpencode helper는 생성한 client에 server URL을 넘기며 Orca의 netFetch를 자동으로
연결하지 않는다. 서버 ownership·배포 방식·자격증명·shutdown 정책을 정하기 전에는 앱 boot에
직접 넣지 않는다. CLI 바이너리는 npm SDK 설치로 생기지 않으며 이번 작업에서 설치/실행하지 않았다.

## 9. 공식 문서와 배포본의 차이

[공식 SDK 페이지](https://opencode.ai/docs/sdk/) 및 [버전 고정 원문](spec/opencode/sdk.mdx)은
입문 자료다. 다음은 1.18.27 배포본과 대조한 차이이며 원문을 편집해서 지우지 않았다.

| 원문에서 오해하기 쉬운 점 | 배포 기준 정정 |
| --- | --- |
| root import 뒤 global.health() | root에는 없음. /v2 import의 legacy global.health와 구분 |
| root nested prompt 예제의 body.format | root SessionPromptData에는 없음. v2 legacy의 format/OutputFormat은 존재 |
| try/catch만으로 session.get HTTP 실패 처리 | default throwOnError=false는 error 필드를 반환. 네트워크 예외와 HTTP 오류 구분 |
| prompt의 noReply이면 UserMessage라는 설명 | root SessionPromptResponses의 선언은 AssistantMessage + Part[]. 실제 noReply 서버 응답은 이번에 미검증 |
| custom fetch를 지정하면 모든 요청에 적용된다는 기대 | root SSE는 예외 (§6); v2 주입 경로를 따로 확인 |
| /v2 import와 native API를 같은 것으로 해석 | client.session과 client.v2.session은 endpoint·입출력·이벤트가 다름 |

Orca의 예전 문서에 있던 session.send, payload: true/false, ChatEvent 기반 adapter 예제는
현재 SDK/Orca 타입의 근거로 삼지 않는다. 관련 현재 문서는 실제 계약 링크와 설치≠활성
표기로 정렬했다.

## 10. 검증 범위와 다음 구현의 진입 조건

[opencode-sdk.test.ts](../app/src/main/adapters/opencode-sdk.test.ts)는 실제 공개 import의
root/v2 legacy/native 요청 직렬화, HTTP 성공·오류 envelope, throwOnError, 유한 SSE parser,
주입 fetch 경계와 root SSE의 우회 한계를 검사한다. 전역 network guard를 사용해 외부
server/model 요청을 차단한다. package typecheck도 이 테스트를 검사한다.

fixture 통과는 서버 상호운용, 권한 저장, durable replay, 취소의 모델 중단, Electron proxy/TLS,
CLI 설치·Windows 종료·패키징의 통과가 아니다. 그 범위는 이번 작업에서 실행하지 않았다.

후속 plan은 다음을 결정·검증한 뒤 adapter를 등록해야 한다.

1. API 표면과 지원 server version을 고정하고 health/협상 실패를 처리한다.
2. netFetch 주입과 SSE 요청의 directory/workspace/auth/signal 전달을 Electron에서 검증한다.
3. message/part/native content의 exhaustive mapper와 unsupported 정책을 확정한다.
4. ID binding, durable cursor, snapshot/delta, usage 중복, reconnect/cancel/late event를 잠근다.
5. permission/question, config/catalog, credentials/MCP를 Orca 경계별로 설계한다.
6. OQ7/OQ10와 server 소유·배포 정책을 사용자 결정으로 닫고 Claude 회귀·rollback을 검증한다.

SDK를 올릴 때는 manifest/lock/설치본 버전, exports, generated 타입의 discriminant,
HTTP/SSE 구현, 원문 미러와 fixture를 함께 대조한다. 버전명만 바꾸고 이 문서의 한계가
해결됐다고 간주하지 않는다.
