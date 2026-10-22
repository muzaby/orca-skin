# Plan — 0274-opencode-desktop-startup

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex / 2026-10-21 |
| 상태 / 라운드 | IMPL_DONE / r1 |
| V mode | Delta V |
| 기준 V | 0273 V1 @ `9ae4d5f3` (공유 브랜치, git cat-file=commit 확인) |
| 이번 / 유효 V | ΔV4 / 0273 V1 + ΔV2 + ΔV3 + ΔV4 |
| 브랜치 | codex-harness-entry-menu |

# Part I — Product & UX Contract

## 1. Context / 목표

변경한다. Desktop1.17.19의 서버 연결→전역 이벤트 구독→프로젝트 준비→첫 세션/명령 제출 규칙을 Orca의 다중 하네스·설정별 소유 서버 환경에 맞춘다.
출처는 사용자의 “Desktop의 부팅시퀀스 + 첫 세션까지 … 똑같이 혹은 유사하게 환경에 맞춰 … SDK로 간접 제어 … 레퍼런스 … 실행 규칙 준수”라는 후속 지시다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 |
|---|---|
| 명시 | Desktop을 부팅~첫 세션의 실행 규칙 정본으로 참조 |
| 승계 | CLI1.17.19, 앱 실행 후 첫 /스킬, 원격 환경이라는 조건 |
| 해석 | 필요한 준비·공유·제출 순서와 native 명령 dispatch를 동일한 의미로 구성 |
| 환경 적응 | Orca는 엔진·프로젝트가 확정된 첫 SDK 연결에서 해당 native server를 준비. 모든 설정의 CLI를 앱 부팅 시 무조건 띄우지는 않음 |

## 3. Decision Ledger

0273 D01~05의 사용자 결과·오류 안전성·미제출 보호를 승계한다. 변경은 SDK `/event`의 세션별 구독을 server별 `/global/event`로 옮기고 directory bootstrap을 공유하는 것이다.

| ID | 결정 / 이유 | 상태 |
|---|---|---|
| D06 | 서버 인증 generation별 SDK client·global SSE를 공유, directory별 준비 데이터를 보관 | ACTIVE |
| D07 | global SSE의 첫 server.connected 확인 후 프로젝트 config 준비. commands/catalog는 같은 준비와 병렬 진행, session 준비 후 첫 입력 제출 | ACTIVE |
| D08 | 일반 입력은 command 목록을 기다리지 않고, /명령은 성공한 동일 instance 목록으로 native dispatch | ACTIVE |
| D09 | 한 채널 close는 자기 구독/lease만 해제. 마지막 client owner 또는 adapter close가 공유 작업을 정리 | ACTIVE |
| D10 | 다른 cwd/config/env 서버의 격리와 native 설정/저장 권위 유지 | ACTIVE |
| D11 | Desktop의 자동 read reconnect는 Orca의 prompt 재제출로 옮기지 않음. 이벤트 단절은 현재 채널을 명시 실패시키고 사용자가 재시도 | ACTIVE |
| D12 | global/project/config/command 준비 실패를 고정 문장으로 전달하고 비밀 원문은 전달하지 않음 | ACTIVE |

ACTIVE 결정 ↔ AC 대조: D06→AC7·9, D07→AC7·8, D08→AC8, D09→AC9·10, D10→AC9·11, D11·12→AC10·11, 충돌 0. 제품 설정·schema 선택 미해결 없음.

## 4. 요구 비판적 검토

| 판정 | 근거 |
|---|---|
| Desktop도 모든 목록을 직렬로 기다리지 않음 | v1.17.19 `global-sync/bootstrap.ts:232–291` partial 상태 후 independent 작업 병렬 |
| native 명령은 준비 목록으로 판별 | 같은 태그 `prompt-input/submit.ts:70–84` |
| server별 global stream이 참조 구조 | `server-sdk.tsx`의 단일 start/run과 global.event |
| Orca의 데이터와 native 프로젝트 상태를 혼동하지 않음 | Orca project/메시지 DB는 기존 앱이 소유. 사용하지 않는 Desktop UI 조회를 기계적으로 복제하지 않음 |
| 실제1.17.19 global SSE도 검증 필요 | 0273의 /event 실측만으로 새 /global/event 전송을 통과로 보지 않음 |

## 5. 동작 / 사용자 흐름

```text
Orca 부팅: 기존 engine/settings/권한 배선
 → 선택 engine+cwd의 SDK 연결: 소유 server acquire/health
 → 공유 global SSE 연결·server.connected
 → directory config/bootstrap 준비
 → agent/provider·command 목록을 공유 flight로 병렬 준비
 → native session 생성/이어보기
 → 일반 prompt 또는 목록에 일치하는 /native command 한 번 제출
 → warm 채널 유지, 닫힘은 자기 구독만 해제
```

| 이벤트 | 결과 |
|---|---|
| 같은 서버의 두 번째 세션 | 기존 global SSE·준비 flight 재사용, 자신의 연결 준비 신호 수신 |
| 다른 directory 이벤트 | 해당 directory의 구독에만 전달; 각 채널의 기존 session/child 소유 필터 유지 |
| 프로젝트 준비가 느림 | global SSE 연결 timeout으로 오표시하지 않음; 프로젝트 단계에서 대기/실패 |
| 명령 준비가 느림 | 일반 메시지는 진행, /명령만 해당 준비를 기다림 |
| 한 구독 중단 | 다른 세션·준비·event pump 유지 |
| native instance disposed | 해당 directory 준비 cache 폐기·해당 구독 실패, 다른 directory 유지 |
| stream 실패/정상 EOF/닫힘 | 0273의 안전한 원인 유지. 자동 prompt 재전송 없음 |

## 6. 범위 / 비범위

범위: server별 SDK context와 global stream, directory별 config/commands/composer single-flight, channel 시작 순서, 참조 시퀀스 문서·SDK/CLI 실측.
비범위: cross-directory process 공유, idle server 보존 정책, native plugin/MCP 활성 변경, 새 UI/IPC, Desktop의 VCS·탭·프로젝트 목록 UI 복제, v2 서비스 도입. 기존 owner/LRU/native 저장 계약은 유지한다.

## 7. Requirements / Acceptance — R ↔ AT

0273 AC1~5는 회귀다. AC6(원격/실측 구분)는 연구 기록을 유지하며 별도 재현 결과를 아래 AC12에 더한다.

| R / AT | AC | 관측 가능한 기준 / 검증 |
|---|---|---|
| R7 / AT7 | AC7 | 실제 adapter→주입 fetch에서 global stream 확인이 프로젝트 config/session/prompt보다 먼저, config 준비가 session/prompt보다 먼저. native/Desktop 대응표 |
| R8 / AT8 | AC8 | 같은 server/directory의 준비가 합쳐지며 느린 명령은 일반 입력을 막지 않고 /명령은 목록 준비 후 정확히 한 번 제출 |
| R9 / AT9 | AC9 | 다수 채널이 server당 global stream을 공유하고 directory·인증 generation을 격리, 한 close 뒤 다른 입력/승인 계속 진행 |
| R10 / AT10 | AC10 | 실패/취소/마지막 해제/instance disposal 후 cache·구독을 정리하고 새 연결에서 명시 재시도, 자동 prompt 재전송 없음 |
| R11 / AT11 | AC11 | 0273 AC1~5의 느린 명령·안전 오류·미제출·취소·명시 재시도와 기존 history/complete/native resources 유지 |
| R12 / AT12 | AC12 | 실제1.17.19의 /global/event와 첫 session/command 목록 시퀀스를 검증하고 사용자 환경 자체의 원인 미확정 범위를 구분 |

## 7-A. ΔV2 / Trace Matrix

| Node | 레벨 / provenance | 변경 |
|---|---|---|
| 0273 R1~R5 / AT1~AT5 | R/AT INHERITED | 사용자 결과 회귀 |
| 0273 SD1 / ST1 | SD/ST INHERITED | 취소·실패→명시 재시도 유지 |
| 0273 AR1 / IT1 | AR/IT SUPERSEDED → AR2/IT2 | callback 운반 위치가 공유 context로 이동. AC1~5와 직접 SDK 실패 oracle을 VP07·08에 이관, 선택 변이 없음 |
| 0273 MD1 / UT1 | MD/UT INHERITED | 안전 오류/default read 의미 유지 |
| R7~R12 / AT7~AT12 | R/AT NEW | §7 |
| SD2 / ST2 | SD/ST NEW | 준비 단계·공유 수명·폐기/재시도 |
| AR2 / IT2 | AR/IT NEW | adapter→context→SDK/global stream/directory bootstrap→channel |
| MD2 / UT2 | MD/UT NEW | refcount, queue, routing, cache/flight, generation fence |

| Pair | left ↔ right | requiredness | path / 직접 oracle | §10 |
|---|---|---|---|---|
| VP01·02·04 (0273) | 승계 R/SD/MD ↔ AT/ST/UT | REGRESSION | 변경된 실제 SDK fixture의 느린 명령·취소·오류·재시도, errors 반환, 기존 persistent/native/history/complete | EP01·02의 이동 지점은 EP03~05 |
| VP05 | R7~R12 ↔ AT7~AT12 | REQUIRED | adapter.sendMessage→실제 SDK fetch→순서/단일 제출/서로 다른 dir/body 출력. `adapter.startup.test.ts` 신규 행동 테스트 | EP03~05 |
| VP06 | SD2 ↔ ST2 | REQUIRED | 두 세션 join→하나 close→나머지 진행→마지막 release→새 세션, 실패/dispose→새 context | 동일 startup 테스트, `session-context.test.ts` 상태 전이 | EP03~05 |
| VP07 | AR2 ↔ IT2 | REQUIRED | adapter의 server identity/lease→context→SDK의 headers/directory→channel의 event/commands/composer | 신규 startup 테스트에서 서로 다른 auth/dir/id, 실제 body/signal/frame | EP03~05 |
| VP08 | MD2 ↔ UT2 | REQUIRED | context의 refcount·flight·routing·bounded queue와 safe error | context 테스트의 동시 구독·늦은 응답·마지막 해제·overflow, 0273 errors 회귀 | EP03~05 |

선택 적대 증거 없음. 실제 SDK로 조립한 경로·출력·상태 전이를 직접 관측한다.

| 운영 gate | 명령 |
|---|---|
| subtree | 관련 Vitest, npm run lint/typecheck, ABI 보존 build |
| repository | boundary·inventory·test-budgets·문서 링크·diff check |
| 운영 | 실제 Electron transport의 다중 채널과 CLI1.17.19 global 이벤트 실측 |
| message-bus | 설계와 구현 commit 분리, trailer parse, 이 plan·INDEX 상태 대조 |

# Part II — Technical Design

## 8. Research

고정 참조: v1.17.19 `dc927a7ff071741537cb0bdac7e09b5667ed568d`. SDK는 실제 설치1.18.27의 `/v2/client` export만 사용한다.
`global.event`도 SDK client.sse.get을 사용하므로 configured fetch 전달을 실제 계약 테스트로 확인한다. root SDK로 돌아가지 않는다.

## 9. AS-IS → TO-BE

| 축 | AS-IS | TO-BE |
|---|---|---|
| server/client | acquire마다 새 SDK client | 같은 url+auth fingerprint의 refcount context, 개별 server release 권한 유지 |
| event | session.create 뒤 directory SSE | global SSE 먼저 준비, server별 단일 stream, directory 구독 라우팅 |
| bootstrap | 각 채널의 agent/provider·command 조회 | directory config barrier와 command/composer cache·flight 공유 |
| command | submit 때 권위 목록 조회 | 준비 작업을 먼저 시작하고 slash만 기다림, native inventory refresh 성공은 cache 반영 |
| 실패 | 채널별 callback | 공유 stream은 해당 context를 실패시키고 새 acquire가 교체 context 사용. 기존 generation의 늦은 완료는 무효 |

Orca의 host boot는 registry/settings/권한 배선을 유지한다. 선택된 engine/cwd가 확정된 시점에 native 준비를 시작하는 것이 Desktop의 단일 로컬 server와 다른 적응 지점이다.

## 10. 강제 지점

| EP / pair | 계약 | 자리 목록 / 분모 | 검색 / 실패 의미 |
|---|---|---|---|
| EP03 / VP05~08 | server identity·공유 소유권 | adapter client의 context acquire·복합 release·adapter close, context의 url/auth key·refcount·replacement fence(6) | `rg -n 'contexts|release|references|fingerprint|entries' adapter.ts session-context.ts`의 해당 소비 / 다른 context 종료·중복 stream |
| EP04 / VP05~08 | SDK global stream·라우팅·정리 | context의 SDK global.event·onSseError·connected barrier·dir routing·subscriber queue/wake·last unsubscribe·instance disposed(7), channel의 공유 event 소비(1) | `rg -n 'global.event|onSseError|connected|directory|subscribe|disposed|iterator' session-context.ts channel.ts` / 누락·유출·포화·단절 원인 소실 |
| EP05 / VP05~08 | directory 준비→첫 제출 | context의 config ready·command cache/flight·composer cache/flight·inventory 반영·closed fence(5), channel의 ready/parallel start·slash 준비 소비·native refresh 반영(3) | `rg -n 'prepare|commands|composer|config.get|remember|closed' session-context.ts channel.ts` / 중복 준비·준비 전 제출·늦은 cache 오염 |

자리 분모는 EP03 6 + EP04 8 + EP05 8 = 22. 이전 EP01/02는 사용자 의미를 유지하고 위 경계로 이동한다. 실패 의미는 신규 startup/context 테스트와 0273의 실제 SDK frame으로 직접 판정한다.

## 11. 구현 설계

| 파일 | 책임 |
|---|---|
| `app/src/main/adapters/opencode/v1/session-context.ts` 신규 | server 세대별 SDK client·global event pump·directory 준비 캐시·개별 lease |
| `…/adapter.ts` | acquire 후 context 임대, release/close 조립. complete/history도 기존 SDK client 의미 유지 |
| `…/channel.ts` | SDK context 연결→global ready→project ready→병렬 준비→session→첫 제출. 직접 SSE 구독 제거 |
| `…/composer-catalog.ts`, `…/errors.ts` | shared read 취소와 프로젝트 준비 안전 오류 |
| `…/session-context.test.ts`, `…/adapter.startup.test.ts` 신규 | 실제 SDK+주입 transport, 단위 수명/라우팅과 adapter 전체 시작/다중 채널 출력 |
| 기존 adapter/persistent/history tests | global envelope와 config bootstrap을 실제 경로로 제공. 기존 의미 단언 삭제 없음 |
| `docs/arch/backend/adapters.md`·참조 보고서 | 현재 시작 구조와 Desktop 대응·남은 차이 |

## 12. End-to-end 영향

shared context의 Event는 기존 activity mapper와 SessionRuntime으로 전달된다. session/owned child의 소유권은 기존 mapper에 남고 broker는 directory 경계를 강제한다. IPC·renderer·DB schema 변경 없음.

## 13. Lifecycle / 오류 / 정리

service-owned AbortController는 같은 server 작업을 공유한다. caller signal은 자기 대기를 끝내고 자기 lease를 해제하며 마지막 lease가 shared SDK 작업을 취소한다.
stream 실패와 instance 폐기는 실패 범위에 따라 cache/subscriber를 무효화한다. 이전 entry의 finally는 교체 entry를 제거하지 않는다.
구독 queue에는 유한 상한을 두고 초과는 해당 구독의 명시 오류로 처리한다. 이벤트를 조용히 버리거나 prompt를 재제출하지 않는다.
새 저장소 없음. plan/INDEX 상태 사본은 함께 갱신한다.

## 14. 성능 / 상한

server당 global SSE 하나, directory 준비는 동일 flight 공유다. 일반 입력은 느린 command 목록을 기다리지 않는다. 마지막 lease 해제 시 기존 server owner 정책에 따라 정리하며 추가 idle 보존은 도입하지 않는다.

## 15. READY self-review

READY. 사용자 지시를 Desktop과 의미가 대응하는 초기화·구독·명령 제출 규칙으로 고정했다. 고정 버전·기준 commit 확인, AC7~12와 승계 회귀, 강제 지점22자리와 직접 SDK oracle을 대조했다.

## ΔV3 — warm 제출 거절의 callback fence 보완

변경한다. 공유 pump의 비동기 전달에서 기존 `retires a rejected warm submission…` 테스트가 실패했다. HTTP 거절 뒤 pending buffer를 풀기 전에 늦은 callback을 무효화할 강제 지점이 ΔV2 목록에 빠져 있었다.

| node / pair | requiredness | 계약 / production path | 직접 oracle / 강제 지점 |
|---|---|---|---|
| MD3↔UT3 / VP09 | REQUIRED | warm submit의 HTTP 거절→channel close→submitting buffer 해제 | `adapter.persistent.test.ts:retires a rejected warm submission before another adapter input can be accepted` |

EP06: `channel.ts:submit`의 warm HTTP catch에서 close를 finally의 `submitting=undefined`보다 먼저 수행(1자리). 검색 `rg -n 'catch|close\(|submitting = undefined' channel.ts`의 submit 경계. 실패 의미는 거절된 입력의 늦은 telemetry/turn.ended가 다음 frame에 도달하는 것이다.
기존 R11/VP01·VP07·VP08에 대한 회귀이며 사용자 결과·AC는 바꾸지 않는다. 유효 강제 지점 분모는 기존22+EP06 1=23이며 MD3는 위 직접 oracle로 판정한다.

## ΔV4 — 조사 요구의 추적 이관 명시

보완한다. 기준 V의 R6/AT6(원격 환경과 CLI 조사 기록)는 이번 R12/AT12(Desktop 시퀀스와 실제1.17.19 검증)로 SUPERSEDED한다. 기존 기록·evidence는 보존하고 0273 VP01의 해당 AC를 이번 VP05의 R12/AT12에 이관한다.
새 사용자 결과·코드·강제 지점 변경은 없다. 유효 인수 분모는 승계 AC1~5와 새 AC7~12의 총11이며 강제 지점은 ΔV3의23자리를 유지한다.

## [구현자 기입] 설계 리뷰

변경한다. 고정한 Desktop1.17.19의 global stream·directory bootstrap·native dispatch 의미를 실제 SDK 경로에 구현했다. 상세 대응표와 남은 환경 차이는 [desktop-sequence.md](desktop-sequence.md)에 있다.

ΔV3의 warm 제출 callback fence와 ΔV4의 연구 추적 이관은 구현과 분리한 설계 커밋으로 먼저 고정했다. ACTIVE D06~12와 충돌하는 추가 제품 결정·의존성·공개 계약 변경은 없다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

아래 oracle 약칭은 모두 `app/src/main/adapters/opencode/v1/` 아래의 실제 실행 좌표다. 파일 내부 함수 직접 호출 대신 실제 adapter→context→설치 SDK→주입 fetch의 요청·frame을 확인하는 A/P 좌표와 context 수명의 C 좌표를 구분했다.

| 좌표 | 파일:테스트명 |
|---|---|
| A1 | `adapter.startup.test.ts:connects global events before project readiness and submits a normal first prompt while commands are still loading` |
| A2 | `adapter.startup.test.ts:shares one subscription and bootstrap for many first sessions and preserves the remaining owner after close` |
| A3 | `adapter.startup.test.ts:closes the shared event transport on adapter shutdown while channel owners still exist` |
| A4 | `adapter.startup.test.ts:waits for directory command readiness on the first slash input without creating a second query` |
| A5 | `adapter.startup.test.ts:reports project preparation failure distinctly and allows an explicit new attempt` |
| A6 | `adapter.startup.test.ts:uses refreshed native inventory for the next slash input without another command query` |
| C1 | `session-context.test.ts:shares directory preparation while a caller leaves without cancelling another owner` |
| C2 | `session-context.test.ts:shares one global subscription and routes directory and authenticated server generations separately` |
| C3 | `session-context.test.ts:retires a failed stream without letting the old lease delete a replacement context` |
| C4 | `session-context.test.ts:disposes one directory and rejects its late inventory while another directory continues` |
| C5 | `session-context.test.ts:cancels shared SDK work on the last release and ignores a late command result after inventory refresh` |
| C6 | `session-context.test.ts:fails an overflowing subscriber explicitly instead of silently dropping events` |
| C7 | `session-context.test.ts:requires the server handshake instead of treating an arbitrary first event as ready` |
| C8 | `session-context.test.ts:rejects a late SDK result after the final owner closes even when the transport ignores abort` |
| C9 | `session-context.test.ts:does not start directory work for an already cancelled caller` |
| P1 | `adapter.persistent.test.ts:waits beyond the menu deadline for native command dispatch without submitting twice` |
| P2 | `adapter.persistent.test.ts:cancels command preparation at the SDK request before any command is accepted` |
| P3 | `adapter.persistent.test.ts:retries explicitly after an SDK SSE HTTP failure without replaying the failed input` |
| P4 | `adapter.persistent.test.ts:preserves a safe stream failure after the initial connection without resubmitting` |
| P5 | `adapter.persistent.test.ts:retires a rejected warm submission before another adapter input can be accepted` |
| P6 | `adapter.persistent.test.ts:exposes native resources from the live channel client and its directory without mutations` |

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP05~08 | EP03.acquire | adapter context acquire | 1/1 | A2:8개 첫 frame 완료, global/config 각1회 | 같은 server+cwd 8개→생성 session8개 | 없음 |
| VP05~08 | EP03.release | adapter 복합 release | 1/1 | A2:한 close 후 나머지 warm 입력 성공, 최종 release8회 | 개별 lease와 server owner→다른 채널 보존 | 없음 |
| VP05~08 | EP03.close | adapter close | 1/1 | A3:살아 있는 owner2개 종료, stream 닫힘 | close 전 warm owner 존재→실패 frame 후 추가 POST 없음 | 없음 |
| VP05~08 | EP03.identity | context url/auth key | 1/1 | C2:다른 URL·다른 auth는 stream3개, 같은 URL/auth·다른 directory는 공유 | `owned.test`/`other-owned.test`, `Basic one`/`Basic other`, `one`/`two`/`private` 출력 | 없음 |
| VP05~08 | EP03.refs | context refcount | 1/1 | C1·C5:하나 해제 뒤 요청 signal 유지, 마지막 해제는 abort | owner2→1→0과 SDK Request.signal | 없음 |
| VP05~08 | EP03.replacement | context replacement fence | 1/1 | C3:실패한 old lease 해제 후 새 context의 event 수신 | SSE503 뒤 교체, `replacement` sessionID 관측 | 없음 |
| VP05~08 | EP04.global | SDK global.event | 1/1 | A2:실제 SDK `/global/event` 요청1, frame8개 완료 | adapter가 주입한 fetch와 인증 header, 경로 관측 | 없음 |
| VP05~08 | EP04.error | SDK onSseError | 1/1 | P3·P4:HTTP503/응답 중 오류가 안전한 frame에 남음 | status/전송 실패 원인, 원문 비밀 제외 | 없음 |
| VP05~08 | EP04.handshake | connected barrier | 1/1 | C7·A1:임의 첫 event는 실패, 정상 handshake 후 config | `session.idle` 첫 event/`server.connected` 구별 | 없음 |
| VP05~08 | EP04.route | directory routing | 1/1 | C2·A2:각 directory event, 같은 session/message ID인 foreign text 제외 | `C:/one`/`C:/two`, `Foreign secret`/정상 reply | 없음 |
| VP05~08 | EP04.queue | subscriber queue/wake | 1/1 | C6:overflow는 명시 오류, C2:대기 구독자에게 event 전달 | 작은 queue 상한+연속 입력/대기 상태 | 없음 |
| VP05~08 | EP04.unsubscribe | last unsubscribe | 1/1 | A2:adapter.close 전 마지막 channel close가 stream 종료 | 8개 구독→0, 남은 구독 때는 미종료 | 없음 |
| VP05~08 | EP04.disposed | instance disposed | 1/1 | C4:해당 directory 실패·새 준비, 다른 directory 계속 수신 | dispose `C:/one` 대 `C:/two`, 늦은 old inventory | 없음 |
| VP05~08 | EP04.consume | channel 공유 event 소비 | 1/1 | A1·A2:normal/slash 및 warm followup의 실제 frame 완료 | native messageID/sessionID→해당 Orca frame | 없음 |
| VP05~08 | EP05.config | context config ready | 1/1 | A1·A5:config gate 전 session/POST 없음, 실패 후 명시 재시도 | 지연 config/HTTP503/정상 config | 없음 |
| VP05~08 | EP05.commands | command cache/flight | 1/1 | C1·A4:동시 command1회, cache 재호출도1회 | command gate→`native:one`/`native:review` 인자 | 없음 |
| VP05~08 | EP05.composer | composer cache/flight | 1/1 | C1:동시/후속 조회는 agent/provider 각1회, 강제 refresh 뒤 각2회 | `build` cache→`fresh` 갱신 결과, A2 실제 조립 | 없음 |
| VP05~08 | EP05.inventory | inventory 반영 | 1/1 | C5:늦은 command read보다 최신 inventory 유지 | `new`와 늦은 `old` 구별 | 없음 |
| VP05~08 | EP05.closed | context closed fence | 1/1 | C8·C9·C4:마지막 해제 즉시 대기 종료, 취소 호출 무조회, 폐기 후 late 무효 | 무시하는 fake transport·이미 abort된 caller·old state token | 없음 |
| VP05~08 | EP05.parallel | channel ready/parallel start | 1/1 | A1:global→config 완료→session, command 미완료 중 normal prompt 완료 | 지연 command와 독립적인 config/agent/provider | 없음 |
| VP05~08 | EP05.slash | channel slash 준비 소비 | 1/1 | A4·P1:목록 준비 뒤 command 정확히1회, 일반 prompt 미제출 | `/native:review exact args` body·대기 전후 frame | 없음 |
| VP05~08 | EP05.refresh | channel native refresh 반영 | 1/1 | A6·P6:live inventory 갱신 뒤 새 slash dispatch, 추가 목록 조회 없음 | `native:review`→`native:fresh next args`, POST body | 없음 |
| VP09 | EP06.warm | warm HTTP catch→close→buffer 해제 | 1/1 | P5:거절 후 늦은 telemetry/turn.ended·재수락 차단 | 첫 성공 입력/거절된 warm 입력/다음 입력의 구별 | 없음 |

§10의 네 검색식을 이번 턴에 재실행하여 interface 선언·호출 소비·정리 분기를 대조했다. 설계 자리 집합 `{EP03.acquire,release,close,identity,refs,replacement; EP04.global,error,handshake,route,queue,unsubscribe,disposed,consume; EP05.config,commands,composer,inventory,closed,parallel,slash,refresh; EP06.warm}`와 위 관측 집합의 양방향 차집합은 비어 있다. 합계는 EP03 6 + EP04 8 + EP05 8 + EP06 1 = 23/23이다.

§10 밖 추가 규범 자리는 발견하지 않았다. 직전 verify 고장 이력은 없으며 구현자 자기확인으로만 보고한다.

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP01 (0273) | REGRESSION | SELF_PASS | P1~4·native-resources/tests의 menu deadline, R6은 VP05/R12로 이관 | 해당 없음 — 직접 SDK 요청·frame |
| VP02 (0273) | REGRESSION | SELF_PASS | P1·P2·P3, 준비→실패→명시 재시도 | 해당 없음 — 직접 상태 전이 |
| VP04 (0273) | REGRESSION | SELF_PASS | `errors.test.ts`, `native-resources.test.ts`:safe message·signal·budget 반환 | 해당 없음 — 직접 반환값 |
| VP05 | REQUIRED | SELF_PASS | A1~6·P1~4, 실제 Electron/CLI 결과는 AC12의 운영 증거 | 해당 없음 — 직접 입력·출력 |
| VP06 | REQUIRED | SELF_PASS | A2·A3·A5·C3~5·C8, 공유 수명·교체·폐기 | 해당 없음 — 직접 상태 전이 |
| VP07 | REQUIRED | SELF_PASS | A1~6·C2·P3·P4, adapter→context→SDK 요청·frame | 해당 없음 — 실제 SDK transport seam |
| VP08 | REQUIRED | SELF_PASS | C1~9·`errors.test.ts`, flight/refcount/라우팅/오류 | 해당 없음 — 직접 대기·요청·출력 |
| VP09 | REQUIRED | SELF_PASS | P5, warm 거절 뒤 callback과 재수락 차단 | 해당 없음 — 기존 직접 회귀 |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 해당 없음 | 선택 증거·인용 변이·새 구조적 proxy 없음 | 해당 없음 | A/P/C의 직접 SDK 행동 oracle | 해당 없음 — 직접 oracle |

분모 검산: 선택 증거0 · 인용 변이0 · 새 구조적 oracle0 = 요구 표 행0(위 행은 해당 없음 표기). 새 테스트는 비어 있는 event를 세는 배선 스냅샷이 아니라 구별되는 body/dir/auth/frame·취소·실패 결과를 관측한다.

ΔV2 구현 중 P5가 실제로 red였고 warm HTTP catch에서 먼저 close한 뒤 green으로 회복했다. 0273에서 red를 관측한 구 menu budget 결함의 P1은 이번 실행에서도 통과했으며 해당 테스트를 삭제·대체하지 않았다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 프로젝트/이벤트 오류→channel error event, A5·P3·P4 실제 frame 관측 | 기존 SessionRuntime 오류 소비 경로 유지 |
| seam 재배치 후 정리 코드의 스코프 | adapter release를 await connect 이후 보관, run finally가 해제. A2·A3 release/transport 확인 | 별도 저장소 없음 |
| 실패 경로가 Part I의 어느 행인가 | 프로젝트 준비·instance disposed·stream 실패/닫힘 행. A5·C4·P3·P4 관측 | 새 제품 상태 추가 없음 |
| 실패가 무반응처럼 보이는가 | 준비 실패는 미제출과 안전한 error frame, A5·P1/P2 회귀 | 새 spinner/UI는 비범위 |
| 늦은 응답이 화면을 되돌리는가 | C4·C5·C8·P5에서 폐기한 데이터·callback 무효 | native 자격증명·내용을 오류에 넣지 않음 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | SDK global envelope에는 legacy Event 이외의 sync schema가 있음 | 선조치: properties guard로 기존 mapper 입력을 한정 | 실제 SDK 타입 검사 통과, native1.17.19 stream 검증 |
| 2 | pump의 비동기 hop이 warm 거절 뒤 callback을 늦게 전달 | 설계 보완 ΔV3 후 선조치: close-before-finally | P5 red→green, VP09 추가 |
| 3 | caller가 떠나도 공유 준비는 다른 owner에 필요 | 선조치: caller 대기만 취소, 마지막 owner가 service signal 취소 | C1·C5·C8·C9 |
| 4 | disposed directory의 늦은 inventory가 새 instance를 오염시킬 수 있음 | 선조치: lease가 state token 보관, revision과 dispose signal 확인 | C4·C5 |
| 5 | 실제 타 환경의 retry SSE 실패 원인은 원격 로그 없이 미확정 | 보고만: CLI1.17.19 재현과 사용자 환경 결론 구분 | [Desktop 보고서](desktop-sequence.md)의 timeout/실측 절 |
| 6 | cold history→전송 중 server 반복 시작, 프로젝트별 process/MCP 초기화 | 보고만: 소유 서버 정책·다른 cwd 격리는 유지, 별도 개선 경계 | 보고서의 환경 차이 표 |
| 7 | 처음 lint에서 테스트 fixture 반환 타입4곳 누락 | 선조치: 반환 타입 명시 | 최종 full lint error0·기존 warning2 |

### 설계 대비 명시적 차이

없음. `config.get`을 native bootstrap barrier로 사용하고 Desktop의 모든 UI 조회를 복제하지 않는 것은 D07·D10의 환경 적응이다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 별도 대체물 없음. 이번 cache는 owner 종료/instance disposal 시 무효 | AC10·EP05.closed, C4·C8 |
| 공유 | 설계대로 server/directory owner가 공유. 한 owner 종료로 전체 취소 금지 | AC9·EP03.refs, C1·A2 |
| 재진입 | 실패 후 새 context가 old lease의 늦은 release에 지워질 수 있음 | AC10·EP03.replacement, C3 |
| 다른 무효화 축 | auth generation·directory disposal·fresh inventory가 각기 다름 | AC9~11·EP04.route/disposed·EP05.inventory, C2·C4·C5 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | adapter/channel/composer/errors, 신규 session-context와 startup/context tests, 기존 SDK adapter/persistent fixture. 문서 INDEX·arch·보고서·evidence |
| 실행 명령 | `vitest run src/main/adapters/opencode/v1 src/main/features/sessions/session-runtime src/main/features/sessions/supervisor.test.ts --exclude '**/native-cursor.test.ts' --reporter=dot` |
| 타입·린트 | `npm run typecheck`(node/web/test), 최종 node/test 재확인. `npm run lint`, 최종 OpenCode subtree eslint 재확인 |
| 빌드·repository | `node scripts/ensure-sqlite-abi.mjs electron`→`electron-vite build`, harness-boundary·check-doc-inventory·check-test-budgets, diff/link 검사 |
| 관측한 게이트 산출 | 관련25파일/295케이스 통과, URL 격리 보강 후 context9개 재확인. 타입3구성 통과, lint error0·기존 TanStack Virtual 경고2. main/preload/renderer 빌드 성공 |
| 환경 기인 제한 | `native-cursor.test.ts`7개는 기존 better-sqlite3 Electron140/Node127 ABI 차이로 제외. ABI를 Node로 전환하지 않았고 Electron ABI 확인은 already ok |
| 도구 변경분 | full lint가 포맷한 무관한 `chat-turn.execution-config.test.ts`만 원복. 최종 status에 해당 파일 없음 |
| repository 관측 | boundary 위반 없음, inventory 생성 후 tracked diff 없음, test-budgets의 real-git suite16개 정상. 변경 문서5개의 상대 링크271개 존재, diff check 통과 |
| 운영 관측 | 실제 Electron39.8.10에서 첫 세션8개+warm 후속1개, global/config/command/agent/provider 각각1회. CLI1.17.19의 global ready2,580ms→project3,540ms→session3,785ms→commands7,427ms |
| probe 정리 | 격리 XDG·userData, LLM prompt 없음. CLI 세션 삭제7,459ms, 소유 child tree/제어 HTTP 서버 종료. 사용자 CLI·native 설정/DB 미변경 |
| V-pair 자기확인 | SELF_PASS8 / SELF_BLOCKED0. 독립 검증 미실시 |
| 강제 지점 전수 | EP03 6 + EP04 8 + EP05 8 + EP06 1 = 23/23, 위 자리별 좌표 |
| AC 자기보고 | 11/11, 아래 AC별 이번 턴 관측 |
| 합계 검산 | ✅11 · ⚠️0 · ❌0 = 총11. 0273의 AC6은 ΔV4에 따라 AC12로 이관되어 이전6과 직접 합산하지 않음 |
| 블로커 / 역질문 | 현재 구현 블로커 없음. 타 환경 retry 실패 원인은 미확정으로 구분 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

| 유효 AC | 자기보고 | 이번 턴 재현 관측 |
|---|---|---|
| AC1 (0273) | ✅ | P1:2.7초 command 준비 후 native command1회·인자 유지 |
| AC2 (0273) | ✅ | P2·persistent 준비 실패 테스트:SDK signal abort·미제출 |
| AC3 (0273) | ✅ | P3·P4·errors 테스트:HTTP/timeout/EOF 안전 분류·원문 비밀 제외 |
| AC4 (0273) | ✅ | P3:실패 뒤 명시 재시도에서만 새 stream·제출 |
| AC5 (0273) | ✅ | native-resources/persistent/history/complete/server/runtime 관련 실행 집합295개 통과, DB 전용7개 환경 제외 |
| AC7 | ✅ | A1:global→config→session/prompt, 고정 Desktop source 대응표 |
| AC8 | ✅ | A1·A4:느린 목록 중 일반 prompt 완료, slash는 준비 뒤 한 번 dispatch |
| AC9 | ✅ | A2·C2:8채널 stream1개, auth·directory 격리, 한 close 후 나머지 계속 진행 |
| AC10 | ✅ | A3·A5·C3~5·C8:shutdown/disposal/failure/last release→정리·명시 새 시도 |
| AC11 | ✅ | P1~6·native/history/complete 회귀, P5 warm 거절 callback 차단 |
| AC12 | ✅ | [CLI 결과](evidence/cli117-context-result.json)·[Electron 결과](evidence/pooled-electron-result.json), 사용자 환경 원인 미확정 범위 명시 |

## [구현자 기입] Review Signals — 사실만

- 0273과 같은 축: 첫 native slash 준비와 이벤트 실패의 미제출·명시 재시도 계약을 이번 공유 context에서도 유지한다. P1~4를 다시 실행했다.
- 초기 설계는 warm HTTP 거절의 buffer 해제보다 늦은 callback fence를 명시하지 않았다. 기존 P5가 red로 드러내 ΔV3/VP09로 설계를 먼저 보완했다.
- 반복 환경 한계: better-sqlite3의 Electron/Node ABI 차이7개. 사용 중인 Electron ABI를 보존하고 별도로 기록했다.
- 현재 라운드·impl 턴: `r1` / `r1.1`. plan 메타와 INDEX는 `impl/IMPL_DONE`·다음 Claude로 대조하고, trailer parse는 구현 커밋 직후 확인한다.

## [검증자 기입] 파생 이슈 — verify r1 (2026-10-22)

판정 정본은 [verify.md](verify.md) — **FAIL**. 고장 ID는 그 문서 §4 고장 이력이다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | E11 warm 거절 catch의 `close()` 삭제 green — P5가 fence에 둔감 | EP06 · AC11 · VP09 | 거절과 `submitting` 해제 사이 늦은 callback 주입 단언, 또는 호출자 close로 동치 근거 제시 | BLOCKING | open |
