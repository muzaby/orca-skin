# OpenCode SDK → Orca 마이그레이션 연구 가이드

> **연구 메모이며 현재 제품 계약이 아니다.** 2026-09-03에 설치된
> **@opencode-ai/sdk 1.18.27** 배포본과 현 Orca 코드를 대조한 결과다. 이 문서는
> OpenCode adapter의 등록·server 실행·CLI 설치·IPC/DB 변경을 승인하거나 수행하지 않는다.
> 현재 앱의 Backend는 여전히 Claude 하나이고 production 실행 경로도 Claude뿐이다.
> SDK 공개 표면의 상세 근거는 [OpenCode SDK 사양](../../../opencode-sdk-spec.md)을 우선한다.

## 범위

현재 동작은 [backend overview](../../../arch/backend/overview.md),
[adapter 경계](../../../arch/backend/adapters.md),
[provider runtime](../../../arch/backend/provider-runtime.md),
[IPC 계약](../../../IPC_CONTRACT.md), 그리고 코드가 정본이다. OpenCode의 구현 내부를
분석한 기존 연구는 [00-index](00-index.md)에 모여 있으며, 그것을 SDK wire 계약으로
해석해서는 안 된다.

이 문서는 후속 설계에서 Orca의 provider-neutral adapter/event/persistence 경계를 유지할
수 있는지, native session/message/part/event를 손실 없이 투영할 수 있는지, local 또는
remote OpenCode server의 소유·인증·배포를 어떤 제품 정책으로 둘지를 좁힌다.

## 현재 Orca의 경계

| 레이어 | 현재 사실 | 후속 adapter에서 보존할 것 | 변경 전 회귀 gate |
| --- | --- | --- | --- |
| composition / registry | AdapterRegistry는 ClaudeAdapter만 생성·활성화한다. | active backend 선택과 describe 기반 capability 노출을 registry 밖으로 새지 않게 한다. | Claude registry/backend:list 동일, OpenCode import가 renderer/shared로 전파되지 않음 |
| adapter | SessionAdapter.sendMessage가 LiveTurn의 normalized batch를 돌려주며 pushTurn은 선택 capability다. | SDK raw 타입은 opencode adapter 안에서 끝내고 LiveTurn의 close/interrupt 수명 계약을 지킨다. | mapper fixture, SessionRuntime persistent·oneshot 회귀 |
| runtime / coordinator | SessionRuntime은 persistent pushTurn 채널과 turn-scoped 소비를 구분하고 TurnCoordinator가 turn.event를 fan-out한다. | 늦은 native event가 다음 Orca turn/frame에 붙지 않고 terminal을 한 번만 낸다. | cancel·retry·late event·새 session 승격 |
| DB / history | HistoryWriter가 session.updated와 normalized event를 Orca DB에 투영하며 UI 복원은 DB를 읽는다. | OpenCode server history를 UI SSOT로 승격하지 않는다. external resume binding은 별도 transport 정보다. | restart 복원, 동일 event 재전달 idempotency |
| IPC / preload / renderer | shared NormalizedEvent를 preload가 relay하고 chat store가 sessionId별로 coalesce한다. | SDK event/type를 shared IPC에 노출하지 않고 새 variant는 main·history·renderer를 함께 설계한다. | delta/terminal/session promotion fixture |
| auth / network | main 원격 요청은 Chromium net.fetch/net.request 경계에 묶이고 provider auth는 Orca vault·browser session 흐름을 쓴다. | SDK transport가 그 경계를 우회하지 않게 한다. server→model egress 정책은 별도다. | Node global fetch 금지, auth 실패·재로그인·redaction |
| settings / catalog | harness settings, Claude model parser, ~/.claude seed와 plugin deploy가 Claude 포맷에 구체화돼 있다. | OpenCode 설정·model·permission rule을 Claude 설정에 억지로 변환하지 않는다. | provider별 catalog/setting fixture, Claude scaffold 유지 |
| extensions / MCP | TurnExtensions 입력은 generic이지만 현재 plugin root·skill·MCP deploy는 Claude convention이다. | OpenCode server-side config/MCP/skill ownership을 독립 adapter/loader에서 정한다. | extension 실패가 Claude turn에 영향 없음 |

근거의 핵심 위치는 app/src/main/adapters/types.ts의 LiveTurn/SessionAdapter,
app/src/main/features/sessions/session-runtime.ts,
app/src/main/features/chat/turn-coordinator.ts,
app/src/main/features/history/writer.ts, app/src/main/app/bootstrap.ts,
app/src/shared/ipc.ts, app/src/preload/index.ts,
app/src/renderer/src/features/chat/store/chatStore.ts다.

## SDK 표면 선택: root/legacy, /v2 legacy, /v2 native

1.18.27의 root export와 /v2 export는 별개 generated surface다. root client에는 v2 getter가
없고, v2 client에만 client.v2 getter가 있다. 따라서 root의 기존 API, /v2 import의 기존
API, /v2 import의 native API를 같은 버전이라도 서로 다른 transport·event 계약으로 다룬다.

| 후보 | 이점 | 피해야 할 혼동·위험 | 연구 단계 권고 |
| --- | --- | --- | --- |
| root import legacy (SDK, SDK/client) | 기존 session/message/part 모델과 문서 예제가 있을 수 있다. | root SSE 구현은 주입 fetch와 request interceptor를 사용하지 않고 global fetch를 직접 호출한다. Orca main의 Chromium transport 정책과 바로 합쳐지지 않는다. | non-streaming shape 비교에는 쓸 수 있으나 stream transport 후보로 채택하지 않는다. |
| /v2 import legacy (SDK/v2, SDK/v2/client의 client.session/event) | root와 분리된 v2 package import로 legacy API를 직접 대조할 수 있다. | import path가 v2라고 native session API가 되는 것은 아니다. legacy idle/part/event 의미를 native와 한 mapper에서 섞으면 terminal·ID 의미가 흐려진다. | 필요한 legacy API가 명시된 경우에만 별도 fixture로 검증한다. |
| /v2 import native (SDK/v2, SDK/v2/client의 client.v2.session/event) | durable sequence·history·resync, session-scoped question/permission, native event 구분을 제공한다. | server 호환성·배포 방식·auth 적합성을 증명하지 않는다. import path·생성 client·fixture 혼용은 upgrade 평가를 어렵게 한다. | native stream adapter의 우선 검토 후보다. fake transport contract와 지원 server version을 먼저 잠근다. |

native v2 SSE 타입은 options.fetch, onRequest, onSseEvent, onSseError를 제공한다. 반면 root
generated SSE는 이 transport 주입 경계를 동등하게 지키지 않는다. 이것은 **native v2 채택
결정이 아니라**, Electron transport 안전성 때문에 그것을 우선 검증해야 한다는 근거다.
SDK 설치만으로 local server나 model provider에 연결할 권한은 생기지 않는다.

## message / part / event 투영 초안

아래는 mapper 설계용 표다. OpenCode ID를 Orca ID로 단순 문자열 복사한다고 확정하지
않았으며 실제 event fixture와 DB migration 설계가 그 결정을 닫아야 한다.

| OpenCode v2 관측 대상 | Orca 투영 | ID·중복 규칙 | 미해결/회귀 gate |
| --- | --- | --- | --- |
| session create/update | session.updated와 Orca session row 생성·갱신 | Orca DB primary ID와 native sessionID의 동치 여부를 먼저 증명한다. 불가하면 provider/session binding을 별도 보관한다. | 다른 backend session을 active adapter로 resume하지 않음; fork/restore 격리 |
| user/assistant message | queued/echo/committed 및 assistant part projection | native message ID는 backend+native session 범위에서만 식별하고 Orca pending UUID와 혼동하지 않는다. admission 수락과 실제 소비 증거도 구분한다. | 턴 시작 입력은 response-start에서 user row를 첫 assistant part보다 먼저 commit하는 현행 계약 유지; mid-turn steer는 별도 소비/echo 증거 검증; reconnect 중복 없음 |
| text part와 session.next.text.delta | message.delta, 완료 시 text part 및 message.completed | native data.sessionID/assistantMessageID/textID와 optional durable seq를 구분한다. durable가 없으면 event.id 기반 중복 방지와 별도 resync 정책을 검증한다. snapshot을 delta처럼 덧붙이지 않는다. | duplicate SSE, 동일 snapshot, 순서 역전 |
| reasoning part/delta | message.reasoning/message.reasoning.delta | reasoning ID를 text ID와 분리하며 raw SDK 객체를 IPC에 흘리지 않는다. | 표시 정책과 history replay 일치 |
| tool part의 pending/running/completed/error, input delta | tool.call.started/tool.call.completed 및 history part | callID와 part ID는 별개일 수 있다. lifecycle key를 고정하고 result upsert를 idempotent하게 한다. | 시작 없이 완료·중복 완료·부분 input delta |
| assistant tokens/cost, step-finish | telemetry/usage ledger의 terminal sample | 누적 snapshot과 turn total을 혼합해 이중 계상하지 않고 usage finalizer를 명시한다. | replay·retry·abort에서 usage 한 번 |
| permission.v2.asked/replied | permission.requested/resolved와 Orca approval broker | PermissionV2Request의 action/resources/save/metadata/source와 native request ID를 보존한다. reply는 once/always/reject enum이며 tool approval boolean과 혼동하지 않는다. | deny·timeout·late reply·세션 교차 reply 차단 |
| question.v2.asked/replied/rejected | 기존 permission.requested(action.kind=ask_question)와 AskResult 경로를 재사용 후보로 둔다. | 질문은 tool permission이 아니다. OpenCode의 질문 순서형 answers 배열을 Orca의 question-keyed Record로 변환할 때 중복 질문 키·custom 답변을 검증한다. | answer order·duplicate key·cancel·resume 재표시 |
| native session error/assistant finish·legacy session idle | telemetry/error/turn.aborted를 포함하는 원본 batch를 유지하고 frame 종료는 한 번만 전이 | 현행 실패 batch는 telemetry와 error를 함께 포함할 수 있다. turn.retrying은 비terminal이다. native와 legacy의 종료 신호를 같다고 가정하지 않으며 network EOF도 성공 terminal이 아니다. | batch 전체 전달, abort confirmation과 local stream abort 분리, error 뒤 late event, retry 뒤 old terminal |
| native system/shell/agent-switched/model-switched/synthetic/compaction SessionMessage | existing message/part로 투영할지 adapter capability 밖으로 둘지 명시한다. | assistant text/reasoning/tool만이 native SessionMessage가 아니다. system/shell/synthetic 내용을 user/assistant text로 위장하지 않는다. | 각 type별 보존·drop·unsupported oracle |
| PTY created/updated/exited 및 terminal I/O | tool output 축소 또는 별도 terminal capability | PTY ID와 tool call ID가 같다고 가정하지 않는다. interactive input은 renderer 권한 경계도 필요하다. | terminal owner, resize/input, session dispose |

NormalizedEvent에는 terminal-PTY variant가 없다. question은 이미 permission.requested의
ask_question action과 ApprovalBroker/AskResult 경로가 있으므로 재사용 가능성을 먼저
검증한다. 다만 mapper가 없는 native event를 조용히 성공으로 바꾸지 말고, capability에서
제외하거나 shared IPC·history·renderer를 함께 확장하는 별도 제품 결정을 거쳐야 한다.

## streaming, resync, cancel의 안전 규칙

OpenCode native v2의 session.events/history 설명은 1.18.27 배포 d.ts 주석과 타입에서만
확인했다. 즉 events는 aggregate sequence 뒤 durable event replay 후 새 event를 계속
구독하고 history는 그 뒤 유한 page를 읽는다고 선언하지만, 실제 server 관측은 아직 하지
않았다. 어느 경우에도 Orca에 자동 복원을 제공하지 않으므로 adapter가 다음을 책임진다.

1. 한 Orca runtime/frame에 native subscription owner를 하나만 둔다. reconnect와 history
   resync가 같은 durable sequence를 전달해도 cursor/dedupe가 history와 renderer에 한 번만 반영한다.
2. snapshot/message.part.updated는 overwrite projection, delta는 cursor 검증 뒤 append
   projection으로 분리한다. unknown gap·다른 session·다른 message는 resync 대상으로 보내고 임의 merge하지 않는다.
3. cancel은 SDK request signal의 stream 중단, native session interrupt/abort 수락, 모델
   turn의 실제 terminal event를 별개로 기록한다. stream 중단만으로 성공 telemetry를 만들지 않는다.
4. SessionRuntime의 draining/close/frame 경계를 유지한다. cancel 뒤 old stream event는
   frame token과 native session binding을 통과할 때만 소비한다.

현 Orca는 새 session의 native ID가 renderer/DB sessionId가 되는 흐름이다. OpenCode
session ID를 그대로 쓸지, Orca stable ID와 native binding을 분리할지는 되돌리기 어려운
DB/restore 결정이다. adapter 등록 전에 fixture와 schema 설계로 isolation·fork·삭제·백업
복원을 검증해야 한다.

## 안전한 rollout과 rollback

| 단계 | 허용 범위 | 다음 단계 진입 gate | rollback |
| --- | --- | --- | --- |
| 0. 증거 고정 | 설치본 타입/JS, fake HTTP/SSE fixture, 이 연구 문서 | public export·root/v2 transport 차이·오류/stream 한계 기록 | dependency 연구만 남기고 production 경로는 Claude |
| 1. mapper 격리 | adapter-local native→normalized pure mapper와 ID/dedupe state | text/tool/usage/permission/terminal fixture, unknown event reject | registry 미등록, mapper 제거 가능 |
| 2. one-shot adapter | SessionAdapter 뒤 생성·prompt·완료·abort을 flag 아래서 시험 | DB/history/renderer fixture, Claude 회귀 | flag off, 생성된 session은 backend binding으로 원래 adapter에만 route |
| 3. persistent/resync | v2 subscription, durable cursor, reconnect/cancel lifecycle | duplicate SSE·gap resync·late terminal·restart tests | subscription close, last safe checkpoint로 복귀 |
| 4. 제품 surface | provider 선택, settings/catalog, auth/permissions/questions, extensions | OQ7/OQ10와 배포 정책의 사용자 결정, security/UX acceptance | default Claude 유지, OpenCode record와 credential을 독립 disable |

rollback은 DB row나 external OpenCode session을 파괴하는 동의어가 아니다. server-side
delete API는 영구 삭제 의미이므로 flag rollback에 호출하지 않는다. schema가 필요하면
forward-only binding을 먼저 추가하고 기존 Claude row의 backend/resume 값을 일괄 재해석하지 않는다.

## 아직 결정되지 않은 정책

- **OQ7 — provider/backend 선택:** Claude와 OpenCode가 함께 가능한 경우의 기본값·전환·기존
  session resume routing은 PRD Open Question으로 남는다. registry에 둘을 넣는다고 해결되지 않는다.
- **OQ10 — raw tool mapping:** OpenCode tool/PTY/extension event를 Orca history와 UI에 어느
  수준으로 보존할지는 미정이다. raw payload 저장 또는 노출을 이 연구가 승인하지 않는다.
- **server 배포 정책:** local child process인지, 사용자가 관리하는 loopback server인지, remote
  server인지, 시작/health check/종료/업데이트의 소유자가 누구인지 결정되지 않았다. URL allowlist,
  인증 전달, server→model egress, workspace filesystem 권한, log redaction을 security review로 분리한다.

이 세 항목은 adapter 구현으로 선점하지 않는다. 현재 provider auth와 Claude
settings/extension 흐름이 OpenCode에도 그대로 적용된다는 보장은 없다.

## 권장 test seam

- opencode mapper unit: version-pinned v2 event JSON으로 NormalizedEvent 순서·ID·unknown handling을 검사한다.
- SDK transport contract: fake fetch/SSE로 v2 fetch/interceptor 전달과 root SSE global-fetch
  우회 위험을 분리 관측한다. 실제 server 실행은 범위 밖이다.
- session-runtime/turn-coordinator fixture: persistent stream, duplicate/replay, gap, cancel,
  retry, late event를 기존 Claude fixture와 독립적으로 심는다.
- history writer와 renderer chat-store fixture: text snapshot/delta, tool upsert, usage
  idempotency, permission/question/terminal surface를 동일 normalized input으로 대조한다.
- auth/settings/extensions test: OpenCode config가 Claude seed·plugin deploy를 오염시키지 않고,
  Chromium network/redaction 규칙을 지키는지 검사한다.

SDK type export의 존재와 production server 상호운용은 다르다. 후속 구현은 선택한 SDK
표면·지원 server version·정책 결정을 plan의 명시적 acceptance criteria로 승격한 뒤 진행한다.
