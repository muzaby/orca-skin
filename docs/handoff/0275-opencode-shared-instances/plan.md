# Plan — 0275-opencode-shared-instances

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex / 2026-10-21 |
| 상태 / 라운드 | IMPL_DONE / r2 (FAIL 대응 완료·독립 검증 대기) |
| V mode / 기준 | Delta V / 0274 유효 V @ `7b6111f6` |
| 이번 / 유효 V | ΔV6 / 0273 V1 + 0274 ΔV2~4 + 이번 ΔV5~6 |
| 브랜치 | ccr-a053656f-pny3g5 |

# Part I — Product & UX Contract

## 1. 목표 / 출처

변경한다. 호환되는 OpenCode 실행 설정·환경은 작업폴더가 달라도 소유 server를 공유한다. 같은 directory instance는 여러 세션/작업이 참조하고, 마지막 참조의 native 정리가 완료되면 회수하며 모든 소유자가 사라지면 server를 종료한다.

사용자는 “다른 작업폴더 진입을 opencode desktop처럼 … 인스턴스까지만 해제 … 모든 인스턴스 해제시 서버도 정리”를 제안했다. 검토 지시 후 module import 재사용·Desktop 비용 차이를 확인했고, 이번 “구현하라”로 적용을 승인했다. Orca는 여러 엔진을 지원하므로 첫 OpenCode 사용 시 준비한다.

## 2. Decision Ledger

| ID | 결정 / 이유 | 상태 |
|---|---|---|
| 0274 D06~09·11~12 | 공유 event·병렬 준비·slash native dispatch·개별 소유권·안전 오류·명시 재시도 | INHERITED ACTIVE |
| 0274 D10 | cwd까지 process를 격리 | SUPERSEDED → D13 |
| D13 | executable identity·실효 config/env가 같은 profile은 stable host cwd의 server 공유, directory는 SDK 요청에 명시 | ACTIVE |
| D14 | 세션/보조 작업의 SDK lease를 directory ref로 센다. 응답 idle·탭 전환 자체로 해제하지 않는다 | ACTIVE |
| D15 | 마지막 directory ref는 native dispose를 요청하고 disposed event까지 기다린다. 진행 중 정리/획득도 server owner로 유지 | ACTIVE |
| D16 | 해제 중 같은 directory 재획득은 완료 뒤 새 scope로 연결. 이전 event/result가 새 scope를 오염시키지 않음 | ACTIVE |
| D17 | 정리 실패는 해당 server를 새 획득 대상에서 retire하되 기존 다른 directory는 유지. 새 acquire는 새 process, prompt replay 없음 | ACTIVE |
| D18 | 아직 native 요청을 하지 않은 lease는 dispose로 bootstrap하지 않는다. native session DB는 보존 | ACTIVE |
| D19 | 상대 경로 환경의 의미는 요청 cwd 기준으로 절대화해 profile 분리. plugin은 native directory/worktree를 사용, process.cwd는 host 기준 | ACTIVE |
| D20 | 일반 마지막 해제는 정리 완료 뒤 server 반환. 앱 종료는 기존 강제 close를 최종 fallback으로 유지 | ACTIVE |

ACTIVE 대조: D13·19→AC13·18, D14→AC14·17, D15→AC15, D16·17→AC16·19, D18→AC17·21, D20→AC17. 충돌0. TTL·새 설정/UI·의존성 추가 없음.

## 3. 흐름 / 상태

```text
첫 OpenCode 사용 → 호환 profile server acquire / global SSE
 → directory scope acquire → native config/plugin 준비 → metadata 병렬 → session/prompt
같은 directory 새 session → scope ref 증가 / 준비 재사용
다른 directory → 같은 server, 독립 native bootstrap·plugin setup·MCP
session/작업 실제 종료 → ref 감소
 → 마지막 directory ref: abort metadata → native dispose → disposed event → scope 회수
 → 남은 획득/정리/lease가 없으면 server 종료
```

| 상태 / 이벤트 | 사용자 결과 |
|---|---|
| A 하나 close, 같은 cwd A2 존재 | A2 계속 진행, native A dispose 없음 |
| A 마지막 close, B 존재 | A hook/MCP만 정리, B event/입력 보존 |
| A disposing 중 새 A | 정리 완료 대기 후 새 준비, stale callback 무효 |
| 정리 timeout/stream 실패 | 안전한 실패·generation retire, 다른 live directory는 정리 실패만으로 kill하지 않음 |
| 모두 해제 | 마지막 native cleanup 뒤 소유 process 종료 |
| 취소 전 native 미사용 | native bootstrap 없이 lease 반납 |
| 다시 OpenCode 사용 | 새 process 공통 비용 재발생. native 대화 이력 보존 |

## 4. 범위 / 비범위

범위는 native profile key/host cwd, directory ref/disposal actor, SDK directory·취소 경계, channel/complete/recover/history의 반납과 실제 CLI 검증이다. Desktop처럼 directory별 plugin setup·MCP는 유지하며 공통 module cache만 process 수명 동안 재사용한다.
비범위는 앱 부팅 시 모든 엔진 prewarm, 임의 plugin의 process.cwd를 폴더별로 바꾸기, TTL·UI 탭 정책, 부분 MCP 도구 집합으로 먼저 모델 실행, renderer/IPC/DB schema 변경이다.

## 5. 인수 기준

0274의 유효 AC1~5·7~12 총11개는 회귀다. 아래9개를 더한 유효 분모는20이다.

| R / AT | AC | 관측 가능한 기준 / production path |
|---|---|---|
| R13 / AT13 | AC13 | 실제 server pool→adapter→SDK에서 호환 A/B가 process/global stream 공유, 다른 config/env/executable은 격리 |
| R14 / AT14 | AC14 | 같은 directory 여러 owner 중 하나 반납은 나머지를 보존, 마지막만 native dispose. 중복 release 멱등 |
| R15 / AT15 | AC15 | HTTP dispose ack 뒤에도 server 보존, matching disposed event 뒤 정리. 마지막 전체 owner가 끝나면 process 종료 |
| R16 / AT16 | AC16 | disposing 중 재진입·늦은 native 결과·이전 generation 해제가 새 scope/server를 오염시키지 않음 |
| R17 / AT17 | AC17 | 미사용 취소는 dispose/초기화 없음, 모든 SDK 소비처 반납·app close 처리, native session 저장 보존 |
| R18 / AT18 | AC18 | SDK directory/workspace 요청 경계·stable cwd·상대 환경 경로·db path 의미 보존 |
| R19 / AT19 | AC19 | A 정리 실패 시 B 유지, 새 acquire는 새 server. 오류 안전성·명시 재시도·무자동 replay 유지 |
| R20 / AT20 | AC20 | 다중 directory/세션의 텍스트·승인·native 자원·병렬 준비 격리와 기존 warm 경로 유지 |
| R21 / AT21 | AC21 | 실제 CLI1.17.19/Electron에서 module import 재사용, directory별 setup/MCP·dispose와 server 종료 관측 |

## 6. V / Trace Matrix

| node / pair | provenance / requiredness | 경로 / 직접 oracle |
|---|---|---|
| 0273 R1~5/AT1~5, SD1/ST1, MD1/UT1 | INHERITED / VP01·02·04 REGRESSION | persistent·errors·native-resources의 실제 SDK frame/signal/budget |
| 0274 R7~12/AT7~12 | INHERITED / VP05 REGRESSION | startup의 config/stream 순서·normal/slash·회귀·실측 |
| 0274 MD3/UT3 | INHERITED / VP09 REGRESSION | persistent의 rejected warm submission callback fence |
| 0274 SD2/ST2, AR2/IT2, MD2/UT2 | SUPERSEDED → SD3/ST3·AR3/IT3·MD4/UT4 | 이전 VP06~08의 lifecycle·auth/dir·queue/cache AC는 VP11~13으로 이관, 선택 변이 없음 |
| R13~21/AT13~21 / VP10 | NEW / REQUIRED | owned server pool→adapter client/channel→SDK→실제 요청·frame·process 정리 |
| SD3/ST3 / VP11 | NEW / REQUIRED | acquire→ready→last ref→disposing→disposed→server release, 실패/재진입/종료 |
| AR3/IT3 / VP12 | NEW / REQUIRED | profile→pool connection retire→context SDK/instances→adapter 각 소비처 |
| MD4/UT4 / VP13 | NEW / REQUIRED | profile identity, instance refs·native touched·waiter·abort·generation fence |

총 REGRESSION5 + REQUIRED4 =9 pair다. 직접 행동 oracle이며 선택 적대 증거와 새 structural proxy는 없다.

# Part II — Technical Design

## 7. 조사 / 기존 결정

`server.ts`의 cwd key와 마지막 owner kill, `session-context.ts`의 server별 broker와 metadata, adapter의 channel/complete/recover/history client 소비4곳을 조사했다. CLI1.17.19의 `/instance/dispose` 응답은 native teardown보다 먼저 오고 global `server.instance.disposed`는 hook 정리 뒤 발생하는 것을 이전 격리 실측에서 확인했다.
API middleware는 미생성 directory도 load하므로 touched tracking이 필요하다. 정본 근거와 절충은 [검토 보고서](../../etc/study/opencode/cross-directory-idle-delay.md)에 있다.

## 8. 모듈 / 계약

| 파일 | 변경 |
|---|---|
| `server-profile.ts` 신규 | config/native env·상대 path 환경을 정규화, stable host cwd와 profile fingerprint 입력 제공 |
| `server.ts` | cwd 제외 profile 공유, executable stat identity 반영, retire는 map에서만 제거하고 기존 owner 유지. db path도 동일 profile/env 사용 |
| `implementation.ts` | 소유 connection에 optional `retire()` 포트 추가. 외부 연결 attach 금지는 유지 |
| `instance-lifecycle.ts` 신규 | directory scope·refs·nativeTouched·closing/disposed·SDK client·dispose completion actor |
| `session-context.ts` | server SDK/global pump 유지, scoped SDK는 directory별로 생성. metadata는 scope별 WeakMap, global event를 actor로 전달 |
| `adapter.ts`·`channel.ts` | async acquire/release 조립, channel finally와 complete/recover/history finally의 반납 완료 대기 |
| 관련 tests / docs | native protocol fixture와 행동 테스트, 현재 arch·실측 evidence·plan 보고 |

`OpenCodeClientLease.release(): Promise<void>`, context pool acquire도 Promise로 바꾼다. context는 acquire 예약을 await 전에 소유하며 native dispose 완료까지 raw server release를 미룬다.

profile의 host cwd는 기존 기본값과 같은 `nativeWorkingDirectory()`다. cwd 상대 해석이 필요한 `OPENCODE_CONFIG`, `OPENCODE_CONFIG_DIR`, `OPENCODE_MODELS_PATH`, `OPENCODE_DB`, XDG의 DATA/CONFIG/STATE/CACHE_HOME, NPM_CONFIG_USERCONFIG, NODE_EXTRA_CA_CERTS는 기존 요청 cwd 기준 절대화 후 fingerprint/child/db-path에 동일 전달한다. inline config의 native directory 기준 해석은 변경하지 않는다.

## 9. actor / 오류

directory scope는 canonical key·원래 절대 directory·AbortController·scoped SDK·refs·nativeTouched·disposed·closing Promise를 가진다. scoped fetch는 directory 경계를 확인하고 native 요청 전에 touched를 표시하며 scope 취소를 실제 Request에 합성한다.
마지막 ref는 scope metadata를 취소하고, touched일 때만 service-owned signal로 global 연결 확인→dispose RPC→matching event를 기다린다. disposal 예산은30초, caller 취소 signal과 분리한다.
external disposed event는 해당 scope를 무효화하며 old scope의 release는 새 native instance를 다시 dispose하지 않는다. 실패는 server `retire()`로 새 획득만 분리하고 기존 B를 보존한다. app shutdown은 모든 actor/waiter를 취소하고 기존 process-tree 종료 fallback을 사용한다.

## 10. 강제 지점 — 고정 분모23

아래 source 검색은 `server-profile.ts server.ts implementation.ts instance-lifecycle.ts session-context.ts adapter.ts channel.ts` 전체를 대상으로 한다.

| EP / pair | 자리 목록 / 분모 | 검색 / 직접 oracle 좌표 계획 |
|---|---|---|
| EP07 / VP10·12·13 | profile/env key·stable spawn cwd·server retire generation·db path profile·scoped SDK directory(5) | `rg -n 'profile|environment|cwd|retire|directory' …`; server:`shares a profile across directories…`, `separates relative path environments…`; database-path의 실효 env, context scoped request tests |
| EP08 / VP10~13 | context acquire 예약·directory acquire/refs·idempotent release·nativeTouched fetch·scope abort/late fence·adapter composite release(6) | `rg -n 'acquire|references|release|touched|signal' …`; lifecycle/context/startup의 다중 owner·미사용 취소·늦은 응답과 adapter 전체 조립 |
| EP09 / VP10~13 | cleanup global 연결·dispose RPC 예산·disposed completion event·closing 재진입 barrier·failure retire·scope/cache identity 삭제·최종 server 반납 순서·shutdown 취소(8) | `rg -n 'dispose|closing|connected|retire|close|release' …`; lifecycle와 context의 ack/event gate·A/B 격리·실패 후 새 generation, server actor 통합 |
| EP10 / VP10~12 | channel finally·complete finally·recover finally·history finally의 release 대기(4) | `rg -n 'release|finally|connect' adapter.ts channel.ts`; persistent/startup와 adapter complete/recovery/history 실제 SDK 후 release/dispose 관측 |

합계 EP07 5 + EP08 6 + EP09 8 + EP10 4 =23. 이전 EP03~06 자리의 의무는 이번 profile/actor/소비처 경계로 이관하며 기존 frame/error/queue oracle은 회귀에 남긴다.

## 11. gate / 검증

| gate | 방법 |
|---|---|
| 단위/통합/상태/인수 | 실제 SDK+주입 fetch의 lifecycle/context/server/startup/persistent/history/complete/native-resource tests, SessionRuntime/Supervisor 회귀 |
| native DB | Electron ABI 유지. plain Node에 부적합한 native-cursor는 Electron Node 실행을 시도하고 환경 제한은 분리 |
| repository | npm typecheck3구성·lint, boundary·inventory·test-budgets·문서 link/diff |
| build | 기존 Electron ABI 확인 후 electron-vite main/preload/renderer build |
| 운영 | 실제 CLI1.17.19+Electron의 호환 A/B process/module cache·scope dispose·남은 B 진행·최종 소유 process 종료. 격리 native 환경·고정 모델 HTTP 응답 사용 |
| message bus | 설계 별도 commit, 구현 후 plan/INDEX·AC20분모·trailer parse 대조 |

## 12. READY self-review

READY. 사용자 검토 조건과 마지막 구현 지시를 대조해 기존 idle/runtime 수명은 유지하고 server/instance 경계만 변경했다. native endpoint·응답/완료 차이·미생성 bootstrap과 실제 소비처4곳, 신규9 AC 및 기존11 AC·9 pair·23자리를 고정했다.

## ΔV6 — 상대 XDG 환경의 native 의미 보존

정정한다. XDG의 상대 경로는 native xdg-basedir의 절대 경로 계약과 다르므로 임의로 절대화해 유효 설정으로 승격하지 않는다. XDG 값은 그대로 전달하고 상대 XDG가 있으면 요청 cwd를 host/fingerprint에도 남겨 보수적으로 격리한다. 나머지 지정한 native 파일 경로 환경은 요청 cwd 기준 절대화하며 `:memory:`·URL 값은 보존한다.
EP07의 profile/env 자리와 AC18에 귀속한다. AC20개·pair9개·강제 지점23개 분모는 불변이다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: D13~20의 profile 공유·directory 참조·native 완료 대기·마지막 서버 종료를 구현했다. 사용자 입력과 native 이력 소유 계약은 유지했다.
- 이견 / 현실성 문제: 없음. §9의 actor는 SDK와 metadata를 scope identity에 연결한 WeakMap으로 조립한다.
- ACTIVE Decision 충돌: 없음. 정리 실패의 보고는 기존 오류 보고 채널을 사용하며 정상 응답 결과를 정리 오류로 덮어쓰지 않는다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

테스트 좌표는 모두 `app/src/main/adapters/opencode/v1/` 아래다. 기존 A1~6·C1~9·P1~6 좌표는 [0274의 좌표 표](../0274-opencode-desktop-startup/plan.md)를 그대로 참조하며 이번 실행 집합에서 재실행했다. 아래 N 좌표는 이번 변경의 직접 행동 oracle이다.

| 좌표 | 파일:테스트명 |
|---|---|
| N1 | `server.test.ts:shares a profile across directories while separating native storage environments` |
| N2 | `server.test.ts:separates relative path environments and preserves relative XDG and special native values` |
| N3 | `server.test.ts:retires only future acquisitions and shuts down every owned generation` |
| N4 | `server.database-path.test.ts:reads the database path through the server and CLI environment of the selected engine document` |
| N5 | `adapter.instances.test.ts:sends default POST directory and workspace without allowing a foreign directory or bootstrapping unused leases` |
| N6 | `adapter.instances.test.ts:reserves the sole context during last-owner cleanup and rejects late direct SDK requests` |
| N7 | `adapter.instances.test.ts:keeps one process for A/B, waits for native completion, and fences same-directory reacquisition` |
| N8 | `instance-lifecycle.test.ts:reserves same-directory owners and never bootstraps an untouched instance to dispose it` |
| N9 | `adapter.instances.test.ts:retires failed cleanup without killing B and reports only a safe error before new generation startup` |
| N10 | `instance-lifecycle.test.ts:bounds %s and retires new acquisitions while keeping B alive` — connect/dispose/completion |
| N11 | `instance-lifecycle.test.ts:waits for both acknowledgement and the matching completion event before allowing reacquisition` |
| N12 | `instance-lifecycle.test.ts:does not let the old externally disposed owner dispose or erase a replacement` |
| N13 | `instance-lifecycle.test.ts:cancels cleanup and pending reacquisition at shutdown without waiting for an unresponsive transport` |
| N14 | `adapter.instances.test.ts:awaits directory disposal in the %s consumer finally before releasing its server` — complete/recover/history/channel |
| N15 | `session-context.test.ts:rejects acquisition after context shutdown before issuing a native request` |
| N16 | `instance-lifecycle.test.ts:enforces the default 30-second cleanup budget even when HTTP acknowledgement has arrived` |
| N17 | `server.test.ts:invalidates the version cache when the executable bytes change at the same path` |

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP10·12·13 | EP07 profile/env | profile/env key | 1/1 | N1·N2·N17: 호환 폴더 공유, 다른 env·파일 교체는 분리 | 서로 다른 XDG·상대 config·실행 파일 bytes → spawn/auth 구별 | 없음 |
| VP10·12·13 | EP07 cwd | stable spawn cwd | 1/1 | N1·N7: A/B child 1, cwd는 home | A/B 요청 cwd와 다른 host cwd → spawn options | 없음 |
| VP10·12·13 | EP07 generation | server retire generation | 1/1 | N3·N9: old B 유지, 새 server 생성, old retire가 새 map을 지우지 않음 | old/new auth·child → kill 호출 분리 | 없음 |
| VP10·12·13 | EP07 database | db path profile | 1/1 | N4: CLI `db path`와 spawn의 cwd·config 파일 경로 일치 | relative settings·XDG·provider document → 실제 CLI 인자/env | 없음 |
| VP10·12·13 | EP07 scope | scoped SDK directory | 1/1 | N5: 한국어 기본 POST 경로·workspace 유지, foreign 경로 거부 | `C:/프로젝트`·`workspace-one` → Request header/query | 없음 |
| VP10~13 | EP08 reservation | context acquire 예약 | 1/1 | N6: 마지막 old 정리 중 새 acquire가 같은 server/context 유지 | sole A → releasing/renewed → child kill 0, 새 config 성공 | 없음 |
| VP10~13 | EP08 refs | directory acquire/refs | 1/1 | N7·N8: A1/A2 한 반환은 dispose 없음 | 같은 normalized A, 다른 B → 참조·요청 결과 | 없음 |
| VP10~13 | EP08 release | idempotent release | 1/1 | N7: 동일 Promise, dispose 중복 없음 | 같은 lease release 2회 → dispose 1회 | 없음 |
| VP10~13 | EP08 touched | nativeTouched fetch | 1/1 | N5·P2: 미사용·이미 취소된 SDK는 dispose 없음, native 요청 중 취소는 dispose | foreign/aborted/native read → request 목록 | 없음 |
| VP10~13 | EP08 abort | scope abort/late fence | 1/1 | C8·N6: abort 무시 transport의 늦은 결과 거부, old SDK 차단 | late inventory·old abort request → 오류, 새 scope 유지 | 없음 |
| VP10~13 | EP08 composite | adapter composite release | 1/1 | N7·N9: native 완료 또는 실패 처리 뒤 raw lease 반환 | ack만 온 A → child 유지; 완료 event → kill | 없음 |
| VP10~13 | EP09 connection | cleanup global 연결 | 1/1 | N14: history/complete도 global handshake 후 dispose | stream 없던 일시 작업 → global 1개와 native 요청 | 없음 |
| VP10~13 | EP09 budget | dispose RPC 예산 | 1/1 | N10·N16: 각 단계 timeout·signal abort, 기본 29,999ms 유지/30,000ms retire | 단계별 무응답 → 안전 실패·B 유지 | 없음 |
| VP10~13 | EP09 completion | disposed completion event | 1/1 | N7·N11: HTTP ack와 unrelated event로는 반환하지 않음 | 다른 directory event와 matching event → 반환 순서 | 없음 |
| VP10~13 | EP09 barrier | closing 재진입 barrier | 1/1 | N6·N7·N11: 완료 뒤 새 scope 준비 | old closing → 새 acquire 대기·재준비 | 없음 |
| VP10~13 | EP09 failure | failure retire | 1/1 | N9·N10: B 읽기 성공, 새 A만 다른 server/auth | dispose 500·비밀 body → 안전 보고, new generation | 없음 |
| VP10~13 | EP09 cache | scope/cache identity 삭제 | 1/1 | C4·C5·N12: old inventory/release가 replacement를 훼손하지 않음 | old/new command 이름 → 새 목록 유지 | 없음 |
| VP10~13 | EP09 order | 최종 server 반납 순서 | 1/1 | N7·N14: 마지막 completion 이후 child kill 1회 | A/B 각각 event → 모든 owner 이후 종료 | 없음 |
| VP10~13 | EP09 shutdown | shutdown 취소 | 1/1 | N3·N13·N15·A3: retired 포함 종료, pending acquire 취소, 종료 후 새 획득 거부 | live/retired/pending/closed → kill·signal·요청 0 | 없음 |
| VP10~12 | EP10 channel | channel finally | 1/1 | N14 channel: frame 뒤 close가 native 완료 대기 | 실제 SDK frame→iterator return→dispose→kill | 없음 |
| VP10~12 | EP10 complete | complete finally | 1/1 | N14 complete: 응답 `complete`, 임시 session만 DELETE, disposal 후 resolve | prompt/title 작업 → 결과·요청·kill | 없음 |
| VP10~12 | EP10 recover | recover finally | 1/1 | N14 recover: 새 ID 유지, native 완료 후 resolve | `s1`→freshStart false, DELETE 없음 | 없음 |
| VP10~12 | EP10 history | history finally | 1/1 | N14 history: snapshot ready, native 완료 후 resolve | 실제 SDK session/messages→snapshot, DELETE 없음 | 없음 |

검색은 §10의 source 전체에서 `profile|environment|cwd|retire|directory`, `acquire|references|release|touched|signal`, `dispose|closing|connected|retire|close|release`, 소비처 `release|finally|connect`로 수행했다. 결과를 lease 획득·사용·반환의 계약 운반 edge와 대조했다. 정규식 hit 자체는 지점 수로 세지 않았다. 고정23자리에서 빠진 분류와 source의 미분류 계약 edge 양쪽 차집합은 빈 집합이다. EP07 5/5 + EP08 6/6 + EP09 8/8 + EP10 4/4 =23/23.

- §10 밖에서 본 운반 자리: 없음. `cleanupAbort` 예외는 기존 소유 turn 중단을 보존하는 EP08 scope 경계이며, 앱 종료 후 획득 차단은 EP09 shutdown에 포함한다.
- 직전 verify 고장 이력: 이번 handoff의 첫 구현으로 없음.
- N14 history는 DB 경로 조회만 stub한다. native history SDK·directory·lease 정리는 production 조립을 실행하고 DB path 자체는 N4가 별도로 검증한다.

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP01 | REGRESSION | SELF_PASS | P1~4·errors·native-resources 실제 SDK 요청/오류 | not selected — 직접 oracle |
| VP02 | REGRESSION | SELF_PASS | persistent의 취소·명시 retry·stream failure, A3 | not selected — 직접 oracle |
| VP04 | REGRESSION | SELF_PASS | native-resources budget/signal·errors 안전 분류 | not selected — 직접 oracle |
| VP05 | REGRESSION | SELF_PASS | A1~6·P1~4와 이번 실제 CLI 실행 | not selected — 직접 oracle |
| VP09 | REGRESSION | SELF_PASS | P5·P6 warm command rejection/callback fence | not selected — 직접 oracle |
| VP10 | REQUIRED | SELF_PASS | N1~17·C1~9·N14 각 소비처, 실제 CLI 결과 | not selected — 직접 oracle |
| VP11 | REQUIRED | SELF_PASS | N6~16·A3·C4/C8의 상태 전이 | not selected — 직접 oracle |
| VP12 | REQUIRED | SELF_PASS | N1~7·N9·N14·C2의 production pool/adapter/SDK 조립 | not selected — 직접 oracle |
| VP13 | REQUIRED | SELF_PASS | N2·N8·N10~13·N16·N17의 값·취소·수명 결과 | not selected — 직접 oracle |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 해당 없음 | 선택된 적대 증거·인용 변이·새 structural proxy 없음 | 최초 | native Request·frame·signal·child 종료의 직접 행동 oracle | 해당 없음 — 직접 oracle |

분모 검산: 선택 증거0 · 인용 변이0 · 새 구조/전수/배선 oracle0 = 의무 표 행0. 위 행은 해당 없음 표시다. 덮개 회귀: 해당 없음. 기존 동작 oracle을 제거하지 않았고 fixture는 새 native 정리 프로토콜을 추가했다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 문구·상태의 소비자 | 정리 실패는 기존 `reportError`의 안전 문구로 전달 | 비밀 body/경로 제외, N9 |
| 재배치 후 정리 변수 스코프 | acquire 예약·release Promise를 lease가 소유 | N6·N14에서 완료 대기 확인 |
| 새 실패 경로의 Part I 상태 | §3 정리 timeout/stream 실패 행 | retire 후 새 획득, 기존 B 보존 |
| 실패가 무반응으로 보이는가 | 정상 프레임/이력 결과는 유지, 정리 오류 별도 보고 | N9·P3/P4의 오류/명시 재시도 |
| 늦은 응답이 화면을 되돌리는가 | scope abort·identity fence로 차단 | C4/C5/C8·N6 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | retired entry를 pool map에서만 제거하면 앱 종료의 process 회수 목록에서 빠짐 | 선조치: owned entry 집합을 별도 유지 | N3·N9의 모든 child kill 1회 |
| 2 | 모든 scoped 요청을 취소하면 stream 실패 뒤 소유 prompt abort도 막힘 | 선조치: 아직 소유한 session abort만 cleanup 요청으로 허용 | `adapter.test.ts:surfaces a disconnected stream and aborts only that session without resending the prompt`, N6 old release 후 요청 차단 |
| 3 | cleanup 오류가 finally에서 throw하면 정상 응답 결과·channel 종료를 가릴 수 있음 | 선조치: 안전 보고 후 raw lease 반환 | N9·N14 |
| 4 | SDK default POST directory header는 URI encoding을 사용 | 선조치: query 우선, header decode 후 scope 검증 | N5 한국어 경로·workspace |
| 5 | 종료 후 늦은 acquire가 새 context를 만들 수 있음 | 선조치: context pool closed fence | N15·A3 |
| 6 | 병렬 검사에서 timeout oracle 1개가 20초 상한에 걸림 | 선조치: actor가 deadline controller/timer를 직접 보유하고 finally에서 clear | N10·N16 및 전체 관련 실행 집합 재통과 |
| 7 | Windows의 `C:settings.json`은 URL이 아니라 drive 상대 파일 경로 | 선조치: URI 판정에서 drive 상대를 분리하고 요청 cwd로 해석 | N2의 drive 상대/절대 경로가 같은 server를 공유 |

### 설계 대비 명시적 차이

제품 동작·Decision·AC 차이는 없다. scope의 SDK/metadata는 scope identity WeakMap에 보관하고 deadline timer는 actor가 직접 소유한다. 해제 의미와 30초 예산은 §9를 따른다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 / 관측 |
|---|---|---|
| 만료 | timer를 clear하지 않으면 완료 후 callback 잔존 | AC19·EP09 budget, N10/N16 |
| 공유 | context 전체 취소가 다른 directory를 종료할 수 있음 | AC14/19·EP08/09, N7/N9 |
| 재진입 | 이전 scope 완료가 새 metadata를 지울 수 있음 | AC16·EP09 cache/barrier, C4/C5·N6/N12 |
| 다른 무효화 축 | 앱 shutdown 이후 획득·old SDK 호출 | AC17·EP08/09, N6/N13/N15 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | OpenCode v1 profile/instance actor·server/context·adapter/channel·관련 tests, 현재 architecture, 실행 증거 |
| 실행 명령 | `vitest run src/main/adapters/opencode/v1 src/main/features/sessions/session-runtime src/main/features/sessions/supervisor.test.ts --exclude '**/native-cursor.test.ts'`; Electron Node 모드의 native-cursor; lifecycle 추가 oracle; typecheck node/web/test·lint·electron-vite build |
| 관측한 게이트 산출 | 비DB 27파일312케이스 통과 후 lifecycle 8개 재실행 통과(신규1 포함, 고유313). Electron DB7개 통과. 타입 오류0, lint 오류0/기존 경고2, build 성공 |
| 운영 gate | SQLite Electron ABI 유지, inventory 산출물/수치 검사·test budgets 통과. 전체 링크 검사의 외부 checkout 오류10은 별도 기록, 해당 두 checkout 제외 오류0 |
| V-pair 자기확인 | SELF_PASS9 / SELF_BLOCKED0 |
| 강제 지점 전수 | 23/23, 자리별 직접 oracle은 위 표 |
| AC 자기보고 | 20/20 — 아래 표 |
| 합계 검산 | ✅20 · ⚠️0 · ❌0 = 총20. 승계11+신규9, AC6은 이전 ΔV에서 AC12로 이관 |
| 블로커 / 역질문 | 없음. 사용자 실제 환경에서의 지연 개선율은 미측정이며 native MCP/plugin의 directory 비용은 유지 |
| 대상 커밋 | (r1 구현 — 좌표는 INDEX) |

| AC | 자기 판정 | 이번 턴의 관측 |
|---|---|---|
| AC1 | ✅ | P1: 느린 목록 후 command 정확히1회·인자 유지 |
| AC2 | ✅ | P2: 준비 취소 signal abort·command/prompt 미제출, native cleanup만 수행 |
| AC3 | ✅ | errors·P3/P4·N9: 안전 오류, 비밀 response 제외 |
| AC4 | ✅ | P3/P4·A5: 명시 재시도에서만 새 제출 |
| AC5 | ✅ | OpenCode/runtime 회귀 및 Electron native cursor7개 통과 |
| AC7 | ✅ | A1: global handshake→project 준비→session/prompt |
| AC8 | ✅ | A1/A4: 일반 입력은 목록 대기 없음, slash는 준비 후1회 |
| AC9 | ✅ | A2·C2·N7: 다수 채널 global 공유·directory/auth 격리·남은 owner 유지 |
| AC10 | ✅ | A3·C3~5/C8·N6/N13/N15: shutdown/disposal/late callback fence |
| AC11 | ✅ | P1~6·native resources/history/complete 회귀 통과 |
| AC12 | ✅ | CLI1.17.19/Electron으로 실제 global/session/command 시퀀스 재확인, 사용자 원인 미확정 범위 유지 |
| AC13 | ✅ | N1/N7/N17·실측: 호환 A/B server/SSE/import 각각1, 다른 env/executable 분리 |
| AC14 | ✅ | N7/N8: 같은 A 첫 반환 dispose0, 마지막 반환만 dispose, 중복 release 멱등 |
| AC15 | ✅ | N7/N11/N14·실측: HTTP ack 뒤 hook/event 대기, 최종 종료 순서 |
| AC16 | ✅ | N6/N7/N12·C4/C5/C8: 재진입 대기·old result/release 차단 |
| AC17 | ✅ | N5/N13/N14/N15·실측: 미사용 bootstrap0, 소비처 정리, native session 이력 유지 |
| AC18 | ✅ | N2/N4/N5: 상대 경로·XDG·DB profile·한글 POST directory/workspace 유지 |
| AC19 | ✅ | N9/N10/N16: A 실패 시 B 유지·새 서버·안전 보고·30초 예산 |
| AC20 | ✅ | A2·persistent·N7: 다중 owner 텍스트/승인/목록·병렬 준비 회귀 |
| AC21 | ✅ | [실행 보고서](execution-report.md): module import1, directory setup/MCP3, dispose hook 뒤 반환·서버 종료 |

## [구현자 기입] Review Signals — 사실만

- 이전과 같은 축: native 시작·SSE·취소 경계는 0274의 확장이고, process 공유/directory 정리는 이번 승인 범위다.
- 기존 plan의 방지 규칙: §9·EP08~10에 완료 대기·참조·실패 회수가 명시되어 있어 위 경쟁 조건을 같은 구현에서 보완했다.
- 환경 한계: 전체 링크 scanner가 로컬 외부 참고 checkout까지 방문해 기존 링크10건을 보고한다. heavy 검사와 겹친 최초 native 운영 probe는 시작 timeout, 최종 재실측은 성공했다. SQLite는 ABI 변경 없이 Electron에서 검증했다.
- 현재 라운드·impl 턴: r1. 독립 verify 결과를 선점하지 않는다.

## [검증자 기입] 파생 이슈 — verify r1 (2026-10-22)

판정 정본은 [verify.md](verify.md) — **FAIL**. 고장 ID는 그 문서 §4 고장 이력이다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | L15 context `references++`를 await 뒤로 옮겨도 green, 보고 좌표 N6 부재 | EP08 reservation · AC16 · VP12 | 마지막 owner 정리 중 같은 directory 재획득이 같은 context로 성공함을 단언 | BLOCKING | open |
| D2 | E11 warm 거절 catch의 `close()` 삭제 green — 0274 D1 이관 수령 | 0274 MD3/UT3 → VP09 REGRESSION · AC11 | 거절과 `submitting` 해제 사이 늦은 callback 주입 단언, 또는 호출자 close로 동치 근거 제시 | BLOCKING | open |
| N1 | L8 shutdown entry abort는 상위 controller abort와 동치 | EP09 shutdown | 유지 가능 | NON_BLOCKING | open |

## [구현자 기입] r2 설계 리뷰

D1·D2의 production 동작은 이미 계약과 일치한다. 이번 변경은 마지막 owner의 정리와 새 획득이 겹치는 N6, warm HTTP 거절 직후 callback이 도착하는 직접 oracle을 추가한다. ACTIVE Decision·AC·V·§10은 변경하지 않았다.

불변식은 두 가지다. 진행 중 획득은 await 전부터 context를 소유한다. 거절된 제출은 buffer를 풀기 전에 event 발신을 차단한다. B owner가 남는 기존 시험은 첫 불변식을 가렸고, 외부 pushTurn catch 이후만 본 시험은 두 번째 불변식의 microtask 간격을 가렸다.

## [구현자 기입] r2 강제 지점 전수와 V-pair 자기확인

N1–N17·A1–A6·C1–C9·P1–P4는 위 좌표 표를 사용한다. 누락됐던 N6을 실제 `adapter.instances.test.ts`에 추가했다. W1은 `channel.warm-fence.test.ts:fences a rejected warm prompt before a queued event can escape the submission buffer`다. W1은 production channel·activity를 실행하고 SDK client/iterator 포트를 주입한다. 실제 SDK transport 구간은 기존 persistent/startup tests가 맡는다.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP10·12·13 | EP07 | profile/env·spawn cwd·retire·db profile·SDK directory 5자리 | 5/5 | N1–N5·N17 | A/B 환경·directory·auth·한글 POST·DB 경로를 서로 구별 | 없음 |
| VP10–13 | EP08 | 예약·refs·멱등 release·touched·abort·composite 6자리 | 6/6 | N6–N9·C8 | sole A 정리 중 새 A 준비 성공, generation 교체·child 1·kill 0·stream 1, old SDK 요청 증분 0 | 없음 |
| VP10–13 | EP09 | 연결·예산·completion·barrier·retire·cache·반납·shutdown 8자리 | 8/8 | N7·N9–N16·C4·C5·A3 | matching event 전/후 반납 구별, B 유지, 새 generation·30초·종료 후 획득 차단 | 없음 |
| VP10–12 | EP10 | channel·complete·recover·history 4자리 | 4/4 | N14 네 소비처 | disposal 완료 전 미정착, 완료 후 결과·최종 child 종료 | 없음 |
| VP09 | 0274 이관 warm fence | 제출 catch에서 buffer 해제 전 close | 1/1 | W1 | 거절 continuation 뒤·외부 catch 앞에 late session.error 주입, 다음 batch done=true | 없음 |

§10 source 전체 검색 342행을 기존 23자리와 대조했다. `implementation.ts`는 실제 상위 경로를 사용했다. r2 production diff는 없으며 새 계약 운반 edge는 없다. N6의 실행 구간은 실제 pool→context→instance actor→SDK이고 W1의 실행 구간은 channel이다. 이관된 warm fence 1자리는 기존 23자리와 별도 표기한다.

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP01·02·04 | REGRESSION | SELF_PASS | persistent·errors·native-resources의 frame/signal/budget | not selected — 직접 oracle |
| VP05 | REGRESSION | SELF_PASS | startup A1–A6·persistent, 기존 native 실행 증거 파일 유지 | native 재실측은 아래 AC12 한계 |
| VP09 | REGRESSION | SELF_PASS | W1·persistent rejected warm submission | 인용 E11 1 red, 원복 green |
| VP10 | REQUIRED | SELF_BLOCKED | N1–N17 | AC21 실제 CLI 재실행 없음 |
| VP11·12·13 | REQUIRED | SELF_PASS | N1–N17·C1–C9·actor tests | 인용 L15 1 red, 원복 green |

## [구현자 기입] r2 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| context references++를 instances.acquire await 뒤로 이동 | D1·L15 | 못 잡음 | N6 1 failed: 새 획득이 OpenCode 연결 종료로 실패 | 원복 adapter.instances 8/8 green |
| warm submit catch의 close 제거 | D2·0274 E11 | 못 잡음 | W1 1 failed: done=false·sequence 3 error frame 유출 | 원복 W1 1/1 green |

선택 증거 0 · 인용 변이 2 · 새 proxy oracle 0 = 의무 표 2행. 격리 copy에서 변이했고 원본 production은 건드리지 않았다. 기존 oracle을 제거·교체하지 않았다. L8의 `for (...entries) controller.abort(reason)` 제거는 lifecycle/context/instances 3파일30케이스 green으로 동치를 재확인했다. `ServerContext.close`가 먼저 상위 controller를 abort하고 모든 scoped 요청이 그 signal을 합성한다. 방어 중복은 유지한다.

## [구현자 기입] r2 Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 마지막 owner 교체가 입력 실패로 보이는가 | N6에서 context 유지·새 준비 성공 관측 | production 변경 없음 |
| 실패한 warm 입력의 늦은 오류가 다음 frame에 나타나는가 | W1에서 다음 batch 없음, 추가 제출 stream_closed | 기존 실패 표시/명시 retry 유지 |
| 새 문구·상태·화면 변화 | 없음, 테스트만 변경 | 시각 변경 없음 |

## [구현자 기입] r2 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 기존 N6 좌표는 문서에만 존재했다 | 같은 이름의 실제 조립 테스트 추가 | 파일 검색·L15 1 red·원복8/8 |
| 2 | 외부 catch도 close하므로 내부 fence가 불필요해 보인다 | promise microtask 순서를 구별하여 내부 fence 필요성을 관측 | E11 제거 시 late error frame 도달 |
| 3 | 두 owner 시험은 sole context 예약 누락을 가린다 | B 없이 old/new A만 사용 | N6의 child/stream·SDK 관측 |

설계 대비 메커니즘 차이 없음. 만료·공유·재진입·다른 무효화 축은 기존 production을 유지하며 각각 N10/N16·N7/N9·N6/N12·N13/N15로 확인한다. 새 저장소·부작용·조기 반환은 없다.

## [구현자 기입] r2 구현 보고

| 항목 | 관측 |
|---|---|
| 변경 | `adapter.instances.test.ts` N6 추가, `channel.warm-fence.test.ts` W1 추가 |
| 집중 gate | 원복 묶음 5파일25/25 green(다른 handoff 포함), L8 동치 3파일30/30 green |
| 관련 회귀/통합 gate | OpenCode·history·composer·preload·SessionRuntime 49파일493/493 green; [공통 운영 gate](../0281-opencode-menu-cache/evidence/verify-fail-validation.md) |
| V 자기확인 | SELF_PASS 8 · SELF_BLOCKED 1(VP10 실제 CLI 재실측) |
| 강제 지점 | §10 23/23 + 이관 warm fence 1/1, D1·D2 구현자 재확인 완료 |
| AC 자기보고 | 새 실패 항목 AC11·AC16 직접 oracle 회복. AC12·AC21의 실제 CLI 재실측은 기존 evidence 유지·이번 턴 미실행 |
| 블로커/역질문 | 코드/테스트 잔여 없음. native 실측은 미실행으로 남김 |
| 대상 커밋 | (r2 구현 — 좌표는 INDEX) |

| AC | 이번 턴의 관측 |
|---|---|
| AC1·2·3·4·5 | ✅ persistent command/취소/안전 오류·명시 retry, history/native cursor 회귀 |
| AC7·8·9·10 | ✅ startup/context의 순서·일반/slash·다중 owner·shutdown |
| AC11 | ✅ W1 warm fence·persistent 회귀, E11 red |
| AC12 | ⚠️ 기존 CLI 시퀀스 증거 유지, 실제 CLI 이번 턴 미실행 |
| AC13·14·15 | ✅ N1–N3·N7·N8·N11·N17의 profile/ref/completion |
| AC16 | ✅ N6 sole owner 예약·N12 replacement, L15 red |
| AC17·18·19·20 | ✅ N2·N4·N5·N9·N10·N13–N16·persistent의 소비처/경로/retire/격리 |
| AC21 | ⚠️ 기존 실측 artifact 유지, 실제 CLI1.17.19/Electron 재실행 없음 |

검산: ✅ 18 · ⚠️ 2 · ❌ 0 = 총 20. D1·D2 수정 완료와 native 운영 미실행을 구분한다.

## [구현자 기입] r2 Review Signals

- r2, verify 1회 뒤 첫 재구현. 프로덕션 결함 추가 발견 없이 oracle의 두 경쟁 조건 공백을 보완했다.
- AC16·EP08이 await 전 예약을, VP09가 warm 거절 fence를 이미 요구했다. 기존 다른 owner·외부 catch만 보는 입력으로 차이가 사라졌다.
- 환경: Node ABI127에서 DB를 실행했고 ABI를 전환하지 않았다. 변이는 격리 copy·threads pool을 사용했다. 실제 CLI 재실측은 이번 테스트 보완 범위에서 수행하지 않았다.
