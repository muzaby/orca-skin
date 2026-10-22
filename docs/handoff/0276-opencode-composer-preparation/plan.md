# OpenCode 첫 입력 전 컴포저 준비

## 메타

| 항목 | 값 |
|---|---|
| slug | 0276-opencode-composer-preparation |
| 작성자 | Codex — 사용자 구현 지시에 따라 설계/구현 연속 수행 |
| 일자 | 2026-10-21 |
| 상태 | READY |
| 구현 상태 | IMPL_DONE — 독립 verify 대기 |
| V mode / 기준 / revision | Baseline V + ΔV1 + ΔV2 / V1@95da0b0f / V1 + ΔV1 + ΔV2 |

# Part I — Product & UX Contract

## 1. 목표

첫 메시지를 보내기 전에 작업폴더의 native 에이전트를 선택할 수 있다. 에이전트 표시가 모델·MCP·명령 목록 완료를 기다리지 않으며, 준비한 instance를 첫 제출에서 재사용한다.

## 2. 요구 출처

사용자: “재조회, 병목, 오픈코드 데스크톱 시퀀스 미준수 등에 대해 충분히 고려하여 구현하라”. 사용자가 공유한 분석의 완료 기준은 해당 directory의 `GET /agent` 응답이다.

현재 표시 계약: [0281 ΔV1](../0281-opencode-menu-cache/plan.md)이 고정 새로고침·기본 에이전트 행·스피너 전면 금지의 이전 표현을 대체한다. 기존 V1+ΔV1+ΔV2@256ddd24의 관련 UI AC/선택 행 증거는 0281 VP1·VP3·DV1-P1–P3으로 이관하고 준비·캐시·수명 증거는 유지한다.

## 3. Decision Ledger

| ID | 결정 | 출처·이유 | 상태 |
|---|---|---|---|
| D1 | OpenCode 선택과 작업폴더 확정 시 준비. 앱 전체 선기동 없음 | 이번 승인·기존 다중 하네스 요구 | ACTIVE |
| D2 | `/agent`의 visible primary/all 결과가 정본. 이름 추정·별도 등록 없음 | 사용자 분석 | ACTIVE |
| D3 | agent/provider 독립 완료. 조회 앞에 config/SSE/session/MCP/command 대기 추가 금지 | Desktop v1.17.19 bootstrapDirectory 및 사용자 분석 | ACTIVE |
| D4 | 폴더·서버 세대별 캐시와 single-flight. 메뉴 재개방·복수 컨트롤·첫 제출에서 재사용 | 재조회·병목 고려 요구 | ACTIVE |
| D5 | 준비 화면과 세션은 directory 사용권을 공유. 마지막 사용권 정리·전체 종료 시 서버 종료 유지 | 0275 사용자 결정 | ACTIVE |
| D6 | 오류·취소·늦은 응답 격리. 성공한 빈 목록만 선택을 정리하며 실패를 빈 성공으로 변환하지 않음 | 승인한 제안·기존 선택 계약 | ACTIVE |
| D7 | 재시도는 읽기 재검증이며 plugin 재설치·instance 강제 dispose를 하지 않음 | native 캐시/활성 세션 보호 | ACTIVE |
| D8 | 선택한 agent만 준비되면 제출. 모델 variant를 명시한 경우에만 해당 모델 목록도 검증 | 대기 최소화, native 제출 의미 유지 | ACTIVE |

갱신 메모: D1–D8 신규, 0275 수명 결정 보존. ACTIVE 결정 ↔ AC 대조: D1/AC1, D2/AC2, D3/AC3, D4/AC4, D5/AC5, D6/AC6, D7/AC7, D8/AC8 충돌 0.

## 4. 비판적 검토

현재 UI는 sessionId가 있어야 runtime 목록을 읽는다. catalog 내부 agent/provider Promise.all과 바깥 nativeResources Promise.all이 있으므로 내부 분리만으로는 해결되지 않는다. native 초기화 비용 자체는 남으며 새 폴더별 plugin setup 비용을 제거했다고 주장하지 않는다.

## 5. 흐름·상태

```text
OpenCode + directory → 화면 소유 준비 lease → agent/provider 각각 비동기 조회
  agent 완료 → 즉시 선택 가능
  provider 완료 → variant 갱신
첫 전송 → 동일 profile/directory lease 추가 → native session/message
화면 이탈 → 준비 lease 해제 → 기존 session lease 보존
```

| 상태/이벤트 | 결과 |
|---|---|
| 최초 loading | 입력 작성 가능. 0281 D5에 따라 에이전트 제목 우측만 회전 스피너, 안내 문구 없음 |
| agent만 성공 | 에이전트 선택 가능, 모델 지연과 독립 |
| 실패/timeout | 안내 없이 같은 세대의 성공 결과 보존. 팝업 새로고침은 0281 D1로 제거 |
| 성공한 빈 결과 | 무효 선택 정리, agent 미지정 의미 유지. 기본 에이전트 메뉴 행은 0281 D6으로 제거 |
| directory/provider/session 변경 | 새 scope를 읽으며 이전 결과를 적용하지 않음 |
| native instance 종료 | 이전 결과를 authoritative로 사용하지 않음. 새 scope/세대 준비 정책 유지, popup refresh 없음 |
| retry | 중복 클릭 합류, 성공 부분 보존, 무한 자동 재시도 없음 |
| close/renderer gone/app quit | 진행 중 준비·요청 취소 및 소유 lease 반납 |

키보드/테마: 기존 OpenCodeSelect·Popover·MenuItem 재사용. 팝업 새로고침·기본 에이전트 행은 제거하며, 로딩 중 에이전트 제목 우측 회전 스피너만 표시한다. 상세 표현 정본은 0281 ΔV1이다.

## 6. 범위

컴포저 준비·목록·선택 전달·캐시·정리·계약·검증. native plugin 코드, MCP 연결 정책, 다른 하네스 동작, 자동 plugin hot reload, 새 패키지는 비범위다. 작업폴더 변경으로 실제 실행 cwd가 달라지면 그 새 scope를 준비하며 다른 폴더의 캐시를 강제로 재사용하지 않는다.

## 7. Requirements / Acceptance

| R / AT / AC | 동작 기준 | 직접 검증 / production path |
|---|---|---|
| R1 / AT1 / AC1 | 세션 없는 OpenCode composer에서 native 목록 표시 | Controls integration: draft → IPC → resolver → adapter → UI |
| R2 / AT2 / AC2 | hidden/subagent 제외, plugin이 바꾼 이름·설명·모델·variant 반영 | composer catalog SDK 응답 fixture → 표시/선택 |
| R3 / AT3 / AC3 | 느린 provider/config/MCP/command/SSE가 agent 응답 반영을 막지 않음 | 지연된 독립 endpoint와 SDK HTTP 순서·renderer 상태 단언 |
| R4 / AT4 / AC4 | 동일 scope 중복 호출·메뉴 재개방·첫 제출은 진행 요청/캐시 재사용 | session-context + renderer state + adapter submit에서 HTTP 횟수 |
| R5 / AT5 / AC5 | 준비→첫 제출 재사용, A 유지 중 B 준비, 최종 owner 정리 | 실제 SDK 사용 adapter/context lifecycle 통합 |
| R6 / AT6 / AC6 | scope 전환/해제 후 늦은 결과 폐기, 오류가 성공 빈 목록이 되지 않음 | handler·state 지연/취소/빈 목록 테스트 |
| R7 / AT7 / AC7 | 내부 재조회 합류·회복과 강제 instance 재시작 금지는 유지. popup 수동 액션은 SUPERSEDED → 0281 D1 | 명시 refresh·실패 후 retry·세대 종료 테스트 |
| R8 / AT8 / AC8 | agent 명시 제출은 agent만, variant 명시는 모델 검증도 대기 | channel prompt/command 요청 body와 지연 provider 테스트 |
| R9 / AT9 / AC9 | 실제 턴과 동일 settings/env/cwd로 준비, 타 창 owner 접근 차단 | main resolver/handler integration, 구별되는 env/provider/project/session 값 |
| R10 / AT10 / AC10 | 표현 부분 SUPERSEDED → 0281 AC1·4–6. 독립 준비·선택·초점 회귀는 유지 | Controls interaction, 실제 renderer 두 테마 및 오류 상태 시각 점검 |

## 7-A. Baseline V

모든 노드는 NEW, 기준 V 없음. 아래 AC는 요구 노드 R1–R10의 직접 oracle이며 하위 pair와 경계를 연결한다. 적대 변이는 선택하지 않음 — 지연된 응답·구별 입력·해제/재진입 결과를 직접 단언한다.

| pair | 좌↔우 / 레벨 | requiredness | path / §10 | 직접 oracle 좌표(구현할 테스트) |
|---|---|---|---|---|
| VP1 | R1–R10↔AT1–AT10 / R | REQUIRED | UI → IPC → lease → native → UI / EP1–EP5 | 아래 UT/IT/ST + Controls.integration.test.ts: draft agents before provider; Controls.interaction.test.ts: retry/keyboard |
| VP2 | SD1↔ST1 / SD | REQUIRED | draft owner → server/directory → turn → release / EP2,EP3 | composer-preparation.test.ts: prepare/submit/release; session-context.test.ts: cross directory and last release |
| VP3 | AR1↔IT1 / AR | REQUIRED | bootstrap → handlers → turn config resolver → adapter / EP1,EP2 | composer-catalog.test.ts(main): configured draft and saved session; composer-catalog.test.ts(handler): window isolation/cancel |
| VP4 | AR2↔IT2 / AR | REQUIRED | preload → renderer API → state → Controls / EP1,EP4 | preload/index.test.ts: composer channels; Controls integration: draft transport and independent rendering |
| VP5 | MD1↔UT1 / MD | REQUIRED | SDK agent/provider → scoped cache → consumers / EP3 | session-context.test.ts: no prerequisites, coalescing, failed retry, cold timeout; composer-catalog.test.ts: filtering |
| VP6 | MD2↔UT2 / MD | REQUIRED | UI scope → request flight → ready/error/dispose / EP4 | composerCatalogState.test.ts: two subscribers/retry/late result/release |
| VP7 | AR3↔IT3 / AR | REQUIRED | selected agent/variant → channel → prompt/command / EP5 | channel tests: provider stalled but agent prompt submits; invalid options and slash regression |

운영 gate: app lint/typecheck(3구성), 관련 비DB Vitest, build(Electron ABI 유지), document inventory/links, git diff/trailer.

# Part II — Technical Design

## 8. 조사

| 대상 | 관측 |
|---|---|
| Controls.tsx useComposerCatalog | sessionId-only nativeResources 조회, agent/variant 두 소비처 |
| composer-catalog.ts | agent/provider Promise.all, 공유 2.5초 timeout |
| session-context.ts | directory WeakMap, composer 앞 ready(config.get), single composerFlight |
| channel.ts | initial catalog와 nativeResources 내부 조합, 선택 agent/variant가 같은 catalog 대기 |
| Desktop v1.17.19 packages/app/src/context/global-sync/bootstrap.ts | loadAgentsQuery 완료 시 agent setStore, providers/config 등은 별도 병렬 작업 |
| 0275 instance-lifecycle | 마지막 ref에서 dispose event까지 유지, untouched lease는 bootstrap 없이 해제 |

## 9. AS-IS → TO-BE

AS-IS: session → nativeResources → config 준비 → agent+provider → 전체 결과 → Controls.
TO-BE: visible composer → 전용 읽기/해제 IPC → 창·owner별 lease → directory별 agent/model 캐시 → 부분별 응답 → Controls. 상태 패널은 기존 nativeResources 경로를 유지하되 composer를 불필요하게 refresh하지 않는다.

| 축 | 변경 |
|---|---|
| 소유권 | adapter optional prepareComposer 포트, main 준비 owner manager, renderer 구독 owner |
| 데이터 | agent/model 독립 성공·실패·flight; 안전한 DTO만 전달 |
| 오류 | 최초 준비 예산 120초, 성공 후 재조회 15초. caller 취소가 다른 owner의 shared HTTP를 취소하지 않음 |
| 정리 | 마지막 renderer 구독 해제, 창 reload/crash/destroy, app shutdown; pending acquisition도 결국 반납 |
| 실제 제출 | 캐시된 agent/model을 필요한 부분만 검증, 기본 제출에 metadata barrier 없음 |

## 10. 계약 / 타입 / 강제 지점

| EP / pair | 계약·SSOT | 언제 강제: 고정 자리 목록 | 검색 / 직접 oracle | 실패 의미 |
|---|---|---|---|---|
| EP1 / VP3,4 | typed query/release/invalidation, composer-catalog DTO | shared schema; preload invoke/subscribe; renderer API; handler registration(4) | rg composerCatalog app/src; protocol/preload/handler integration | schema 우회·응답 오배선 |
| EP2 / VP2,3 | 실행 설정과 owner scope | bootstrap registration/shutdown; app resolver; owner ensure/read/release; window lifecycle(4) | rg 'prepareComposer|composerCatalog' app/src/main; main composer tests | 잘못된 cwd/env, pending lease 누수, 타 창 조작 |
| EP3 / VP2,5 | native directory generation cache | adapter prepareComposer; context agent/model read; scope abort/release(3) | rg 'composer|agents|models' app/src/main/adapters/opencode/v1; SDK context/adapter tests | 이중 초기화·교차 폴더 결과·타 요청 취소 |
| EP4 / VP1,4,6 | 구독 상태와 UI | state subscribe/read/retry/dispose; hook scope; agent control; variant control(4) | rg 'ComposerCatalog|composerCatalog' app/src/renderer/src; state/Controls integration | 늦은 응답·오류 시 선택 제거·모델 대기로 agent 미표시 |
| EP5 / VP7 | 선택 옵션 native 전달 | channel submit agent; submit variant; initial metadata; nativeResources metadata(4) | rg 'composer|harnessAgent|modelVariant' channel.ts; adapter/channel tests | agent만 골라도 provider 완료 대기·메뉴 재조회 폭증 |

고정 자리 합계 4+4+3+4+4=19. 각 자리는 모듈 내부의 응집된 강제 책임이며 구현 보고에서 내부 분기 및 관측 테스트를 기입한다. 선택 mutation 없음; 새 구조적 proxy oracle을 추가하면 별도 민감도 검증이 필요하다.

## 11. 구현 설계

- `shared/composer-catalog.ts`, protocol/ipc: 요청 scope, 목록 part, generation, invalidated DTO. 임의 설정/인증/URL은 renderer로 노출하지 않는다.
- `adapters/common/types.ts`: optional prepareComposer({cwd,env,providerSettings}) → lease. OpenCode만 구현.
- `opencode/v1/composer-catalog.ts`, `session-context.ts`: 독립 agent/model 조회·cache·single-flight, 별도 config 선행 없음. instance 종료 signal과 generation 전달.
- `app/composer-catalog.ts`, `app/handlers/composer-catalog.ts`: 실제 resolveTurnProvider 재사용, session DB scope 재검증. 창/owner 수명 관리. Electron 바깥 순수 manager로 취소 테스트.
- `bootstrap.ts`: 등록 반환 cleanup을 shutdown에 연결. query/release/event preload 및 renderer API 배선.
- renderer `composerCatalogState.ts`, `useComposerCatalog.ts`: 동일 scope 두 컨트롤 공유, 마지막 subscriber 해제는 다음 task로 합쳐 StrictMode 재구독 보존. 요청 part별 갱신·재시도. generation 종료는 오류로 표시하며 무한 자동 재연결하지 않는다.
- `Controls.tsx`: 첫 입력 전 준비 결과 소비, 목록별 loading/error/retry. 기존 keyboard/Popover 재사용.

## 12. 기존 소비처

상태 패널의 nativeResources DTO는 호환 유지. 정적 engine catalog는 서버를 시작하지 않는다. ordinary prompt와 slash command의 SDK 의미·SSE event ownership·history 보존은 기존 회귀 테스트로 확인한다.

## 13. 수명·오류

owner는 renderer가 생성한 임의 ID와 sender ID로 격리한다. 최초 query는 acquisition을 동기 등록한 뒤 await하고 part 요청이 합류한다. 마지막 해제·창 종료는 waiter를 취소하며 acquisition이 늦게 완료돼도 lease를 반납한다. 첫 native 요청 전에 취소되면 touched=false 정리를 유지한다.

native signal 종료는 renderer에 owner invalidation을 통지한다. 재시도는 죽은 lease만 재확보하며 살아 있는 다른 폴더를 종료하지 않는다. 조회 오류는 token/원문 서버 응답을 노출하지 않는 고정 문구로 전달한다. 저장소/DB migration 없음.

## 14. 성능

활성 directory 세대당 최초 agent·provider 각 한 flight, 성공 결과는 lease 수명 동안 유지. 재개방·재렌더·turn에서는 캐시 읽기, 명시 refresh만 HTTP 재검증. 서로 다른 directory는 독립적으로 진행하며 compatible server/module import 공유는 0275를 유지한다.

## 15. 문서

IPC_CONTRACT, backend adapters, frontend component catalog, generated inventory를 현재 동작과 동기화한다. 외부 API/새 패키지 없음.

## 16. READY 점검

사용자 승인 범위 안의 구현 선택이며 추가 제품 결정 없음. R/SD/AR/MD 모두 pair를 갖고, EP1–EP5와 각 oracle 경로가 연결된다. Desktop 참조는 로컬 checkout의 v1.17.19 태그를 읽었으며 HEAD와 혼동하지 않는다.

## [구현자 기입]

### ΔV1 설계 보완 — 명시 재조회와 실행 설정

사용자의 재조회 고려 요구를 조사하는 중, 살아 있는 준비 owner가 갱신된 실행 설정을 읽지 않는 경로를 확인했다. D9(내부 refresh 계약만 ACTIVE, popup 액션은 0281 D1로 SUPERSEDED): 명시 refresh에서 실제 턴 resolver를 다시 사용하고 새 lease를 확보한 뒤 이전 lease를 반납한다. compatible profile이면 같은 instance이며 강제 dispose·config patch는 하지 않는다.

AC9를 최신 설정 재해석까지 확장한다. R9/AR1/SD1/MD2는 CHANGED, VP1/VP2/VP3/VP6 REQUIRED이며 나머지는 V1 유지다. EP2 owner ensure/read/release 자리의 직접 oracle을 `handlers/composer-catalog.test.ts: refresh re-resolves and keeps old owner until replacement is ready`로 추가한다. 기존 §13의 “죽은 lease만 재확보”는 이 행이 대체하며, 자동 재연결 없음은 유지한다.

교체 실패는 이전 lease를 유지하며 해당 refresh를 실패로 표시한다. 진행 중 acquisition/refresh 합류·취소, 늦은 replacement 반납, 이전 profile 정리 대기로 새 목록 표시를 막지 않는 동작을 같은 oracle에서 검증한다. ACTIVE 결정 ↔ AC 대조: D9/AC9 및 D5/AC5와 충돌 0.

### ΔV2 설계 보완 — 상태 안내 제거

D10(SUPERSEDED — 고정 새로고침은 0281 D1, 스피너 전면 금지는 0281 D5가 대체; 아래는 당시 결정): 사용자의 후속 지시로 팝업의 모든 로딩·오류 상태 문구와 스피너를 제거한다. 기존 목록 보존·오류/빈 목록 구분은 내부 상태로 유지하고, 상태와 무관한 고정 새로고침 메뉴로만 재조회한다. R10/AT10/AC10 및 AR2/MD2는 CHANGED, VP1/VP4/VP6 REQUIRED, 나머지는 기존 V 유지다. EP4 agent/variant control 자리의 oracle은 loading/error/ready에서 안내·스피너 부재와 새로고침/키보드 동작을 직접 단언한다. 이전 §11의 loading/error/retry 표시는 이 결정이 대체한다.

### 설계 리뷰
구현 완료. 내부 agent/provider 분리만으로 기존 sessionId-only UI의 첫 입력 전 선택을 해결할 수 없으므로 전용 준비 IPC와 화면 owner를 연결했다. 설정 재해석 누락은 ΔV1로, 사용자 상태 안내 금지는 ΔV2로 먼저 확정했다. native 의존성 초기화와 module import/instance 수명 규칙은 기존 결정을 보존한다.
### 강제 지점 전수와 V-pair 자기확인

| 고정 자리 | 이번 턴의 직접 관측 | 자기결과 / 남긴 곳 |
|---|---|---|
| EP1 schema | handler `validates directory and owner...`: 잘못된 owner/상대 경로에서 prepare 0회 | ✅ / 없음 |
| EP1 preload | preload invoke 두 채널과 invalidated event 구독·해제 단언 | ✅ / 없음 |
| EP1 renderer API | Module.integration에서 실제 sessionApi를 거친 draft scope·part 수신 | ✅ / 없음 |
| EP1 handler registration | main composer test `wires the public handler...`: 실제 resolver와 adapter 도달 | ✅ / 없음 |
| EP2 bootstrap registration/shutdown | 등록·종료 배선 소스 확인, main wrapper의 cleanup 검증, bootstrap.shutdown의 composer→registry 종료 순서 | ✅ / 없음 |
| EP2 app resolver | main composer tests: draft/saved cwd·서로 다른 provider/env, await 중 변경/취소 차단 | ✅ / 없음 |
| EP2 owner ensure/read/release | handler tests: acquisition 합류·refresh 교체·실패 복원·늦은 lease 반납 | ✅ / 없음 |
| EP2 window lifecycle | handler tests: 창별 owner 격리, navigation/crash/shutdown 해제 | ✅ / 없음 |
| EP3 adapter prepareComposer | adapter.startup: preview→선택 agent 첫 입력, provider 보류에도 완료 | ✅ / 없음 |
| EP3 context agent/model | session-context: agent 선반영·cache/refresh 횟수·provider 부분 실패 회복 | ✅ / 없음 |
| EP3 scope abort/release | composer-cache: caller 취소 후 shared 요청 유지, native abort에서 취소. 실제 CLI 최종 서버 exit | ✅ / 없음 |
| EP4 state subscribe/read/retry/dispose | state tests: 두 구독/재마운트 합류, 실패 보존/빈 성공, 폐기 응답·이전 세대 이벤트 무시 | ✅ / 없음 |
| EP4 hook scope | Module.integration: sessionId=null·draft cwd/project/provider로 요청, 재마운트 요청 증분 0 | ✅ / 없음 |
| EP4 agent control | Controls interaction: 선택/초점/새로고침, loading/error/ready에서 동일 메뉴와 안내 부재 | ✅ / 없음 |
| EP4 variant control | Controls interaction: variant/default 전달·빈 성공 제거, Module.integration에서 독립 모델 반영 | ✅ / 없음 |
| EP5 submit agent | startup provider-stalled 선택 agent prompt body, persistent plugin agent 전달 | ✅ / 없음 |
| EP5 submit variant | persistent `passes a live plugin agent...`: 재조회 뒤 제거된 variant 제외, native slash body 회귀 | ✅ / 없음 |
| EP5 initial metadata | startup/persistent: 기본 prompt와 agent-only prompt가 불필요한 목록 완료를 기다리지 않음 | ✅ / 없음 |
| EP5 nativeResources metadata | persistent native resources 호출과 context cache 검사: metadata 재읽기 강제 refresh 없음 | ✅ / 없음 |

| 유효 pair | oracle 실행 / 결과 | 남긴 곳 |
|---|---|---|
| VP1 | 아래 AC 자기결과 및 실제 CLI/UI 관측 통과 | 없음 |
| VP2 | adapter.startup·session-context·instance-lifecycle, 실제 A idle→B와 최종 서버 exit 통과 | 없음 |
| VP3 | main resolver/handler·preload·bootstrap shutdown 통과 | 없음 |
| VP4 | preload·Module.integration·Controls interaction 및 실제 두 테마 관측 통과 | 없음 |
| VP5 | composer-cache·composer-catalog·session-context 통과 | 없음 |
| VP6 | composerCatalogState·Module.integration 통과 | 없음 |
| VP7 | adapter.startup·adapter.persistent·adapter.test 통과 | 없음 |

고정 자리 19개 각각 위 표에 기입했다. 문서에 적은 oracle 이름 중 설계 당시 예정명이던 `composer-preparation.test.ts`, `Controls.integration.test.ts`, `channel tests`의 실제 위치는 각각 `adapter.startup.test.ts`, `Module.integration.test.ts`, `adapter.startup/adapter.persistent.test.ts`다. 새 구조적 proxy oracle은 없다.
### 이번 라운드 수정의 잠금
선택 증거 0 · 인용 변이 0 · 새 proxy oracle 0 = 0행. 직접 행동 oracle 사용.
### Product/UX 파생 검토
조회 성공 전에는 저장된 선택을 실패 때문에 삭제하지 않는다. 성공한 빈 목록만 선택을 정리한다. 팝업에는 상태 문구/스피너가 없고 고정 새로고침만 있으며 키보드 접근과 anchor 초점 복귀를 유지한다. 실제 밝은/어두운 테마·오류 화면을 확인했다. 새 제품 결정은 사용자 지시를 반영한 ΔV2에 기록했다.
### 놓친 잠재 문제 + 대응
살아 있는 owner의 명시 조회가 이전 실행 설정을 붙잡는 문제를 ΔV1로 보완했다. 교체 전 해제는 초기화 재수행을 유발하므로 새 lease부터 확보하고, 이전 profile dispose는 새 목록을 막지 않게 했다. 이전 generation의 지연된 invalidated 이벤트가 새 결과를 지우는 경합을 retired 집합 검사와 state 테스트로 막았다. 초기 native 의존성 설치는 실제로 지연을 유발했으며 120초 초기 예산과 15초 성공 후 재검증 예산을 구분한다. 사용자 plugin 내부의 외부 요청·MCP 비용은 이 변경으로 없어지지 않는다.
### 구현 보고

| AC | 직접 관측 | 자기결과 |
|---|---|---|
| AC1 | Module.integration에서 sessionId=null인 draft의 plugin-review 선택 가능 | ✅ |
| AC2 | composer-catalog 필터 테스트, 실제 CLI의 config hook이 만든 Atlas-A/B 수신 | ✅ |
| AC3 | context 독립 endpoint 시험, CLI provider 보류 중 A 목록/첫 입력 완료 | ✅ |
| AC4 | state 재마운트 query 2회 유지, native cache/동시 refresh에서 agent HTTP 증분 1 | ✅ |
| AC5 | CLI spawn/import/SSE 각각 1회, A 유지 B 준비, 최종 native exit | ✅ |
| AC6 | handler late acquisition 반납, state late/retired 무시, 실패 보존·빈 성공 제거 | ✅ |
| AC7 | handler refresh 교체 실패 시 이전 lease 보존, UI 고정 새로고침으로 회복 | ✅ |
| AC8 | startup agent-only prompt 완료, persistent 일반/slash 선택 body 단언 | ✅ |
| AC9 | production resolver의 구별 env/provider/cwd와 refresh 재해석, 타 창 격리 | ✅ |
| AC10 | loading/error/ready 동일 메뉴·안내/스피너 부재, 실제 두 테마·키보드 검증 | ✅ |

검산: ✅ 10 · ⚠️ 0 · ❌ 0 = AC 10. 독립 verify 판정이 아닌 구현자 자기결과다. 세부 실행 결과·gate·실측 제한은 [실행 보고](execution-report.md)에 기록했다. 상태 사본은 INDEX의 `impl/IMPL_DONE`, 다음 Claude 및 구현 trailer의 `implemented`, `Criteria-Met: 10/10`, `Verified-By: pending`으로 확인한다.
### Review Signals
r1, 사용자 요구 변경 ΔV2를 포함한 최초 구현 라운드. 외부 verify 반복은 없다. 기존 0275 수명 불변식을 이어받으며 이번 변경은 첫 입력 전 owner와 독립 metadata 경로다. 반복 환경 제약은 Node/Electron SQLite ABI 차이와 외부 참고 checkout의 문서 링크 오류다. SQLite는 Electron Node 모드로 실행해 통과했고 링크는 외부 checkout 제외 결과를 별도 기록했다. 최초 UI 캡처의 hidden-window repaint 문제는 offscreen 렌더링으로 해결해 최종 이미지를 직접 확인했다.


## [검증자 기입] 파생 이슈 — verify r1 (2026-10-22)

판정 정본은 [verify.md](verify.md) — **FAIL**. 고장 ID는 그 문서 §4 고장 이력이다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | Q2 prepare가 draft `providerKey`를 버려도 green | EP2 resolver · AC9 · VP3 | 기본값과 다른 providerKey의 draft 준비 resolve 단언 | BLOCKING | open |
| D2 | Q8 retired 세대 결과 폐기 삭제 green | EP4 state · AC6 · VP6 | 같은 epoch에서 새 세대 뒤 옛 세대 part 응답 무시 단언 | BLOCKING | open |
| N1 | N6b configuration 단계 래핑 미잠금 | 0280 D1 | 0280 r2에서 함께 닫음 | NON_BLOCKING | open |
| N2 | ΔV1·ΔV2 설계 본문이 `[구현자 기입]` 표제 아래 | repository operation | 이후 Delta V는 Part I/II 절로 | NON_BLOCKING | open |
