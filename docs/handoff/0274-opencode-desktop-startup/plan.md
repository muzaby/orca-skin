# Plan — 0274-opencode-desktop-startup

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex / 2026-10-21 |
| 상태 / 라운드 | READY / r1 |
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

## [구현자 기입] 구현 보고

구현 전.

## [검증자 기입] 파생 이슈

없음.
