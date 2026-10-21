# Plan — 0275-opencode-shared-instances

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex / 2026-10-21 |
| 상태 / 라운드 | READY / r1 |
| V mode / 기준 | Delta V / 0274 유효 V @ `7b6111f6` |
| 이번 / 유효 V | ΔV5 / 0273 V1 + 0274 ΔV2~4 + 이번 ΔV5 |
| 브랜치 | codex-harness-entry-menu |

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

## [구현자 기입] 구현 보고

구현 전.

## [검증자 기입] 파생 이슈

없음.
