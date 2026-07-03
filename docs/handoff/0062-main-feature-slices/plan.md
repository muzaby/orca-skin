# Plan — 0062-main-feature-slices

> main 프로세스를 아키텍처 스펙(feature 수직 슬라이스 + adapters 한정 ports&adapters + 얇은 infra + app composition root)에 맞춰 재구성한다. 비기능 리팩토링 → Claude 가 plan→impl→verify 직접 수행.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0062-main-feature-slices` |
| 작성자 | Claude Code |
| 일자 | 2026-07-03 |
| 매핑 | PHASES "4-layer main 재구성" / PR (요청 시) |
| 상태 | DRAFT → READY |
| 구현 주체 | Claude (비기능) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | ① `app/src/main` 을 첨부 스펙 규격에 맞춰 재배치·재구성 ② 레거시·미사용 코드 과감히 제거 ③ 의도가 변질·모호해진 네이밍 과감히 변경. "수석엔지니어 실무 관점에서 검토" | 라이브 세션 요청 + 첨부 `orca — Main Process Architecture Spec v0.1` |
| 명시 결정(질의응답) | ① infra/bus 도입 포함 ② `SessionAdapter`·`NormalizedEvent`·`adapters/` 3종 이름 유지 ③ 미사용 코드(opencode 대비 포함) 전부 제거, mock 은 dev 도구로 유지 | 라이브 세션 AskUserQuestion 응답 |
| 추론 의도 | IPC 계약(CHANNELS/zod)·renderer 소비 타입은 무변경(스펙이 "renderer 범위 외"라 명시, 계약 파괴는 요구에 없음) — *추론* | 스펙 §2 "renderer 본 문서 범위 외" + TRD §5 "RPC 라이브러리 금지" |

## Context (왜)

기능 구현이 대부분 끝난 시점에서, main 프로세스를 스펙의 수직 슬라이스로 정렬한다. 현 구조는 handoff 0017 의 L0→L1→L2→L3 레이어링으로 위생(순환 0, dead 파일 0)은 양호하나, 도메인 17개 디렉토리가 **L1 한 바구니에 평면으로** 뭉쳐 있어 "기능 경계"가 코드가 아닌 디렉토리명에만 존재한다. `ipc/chat/send.ts`(612 LoC)와 `ipc/router.ts`(`IpcRouter`)가 모든 기능을 조립하는 God-object 허브다. 스펙의 4계층(app / adapters / features / infra)으로 재배치해 (a) 기능 슬라이스 자기완결화 (b) 엔진 경계를 ports&adapters 로 명확화 (c) 단일 이벤트 파이프라인(infra/bus)로 소비자(history/usage/relay) 분리 (d) 미사용 코드·모호한 이름 정리를 달성한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| main 4책임 = 엔진 어댑터 오케스트레이션·세션 수명주기·IPC 게이트웨이·영속화. features↔features 직접 import 금지, 이벤트 버스 또는 bootstrap 주입만 허용 | 첨부 스펙 §1, §3.1 |
| 단일 파이프라인: 어댑터→NormalizedEvent→infra/bus→{renderer 중계, history 저장, usage 집계, approvals}. 각 소비자는 버스 구독자로만 존재 | 첨부 스펙 §4.2, §7 |
| 현행 이벤트 순서 불변식: 이벤트당 persist → (session.updated면 title) → forward → (session.updated면 promote); telemetry 시 usage 적재가 `currentAssistantMessageId` reset **전** | `app/src/main/lifecycle/turn-coordinator.ts:159-213`, `app/src/main/ipc/chat/persist.ts:230-279` |
| `TurnContext`(현 `InflightTurn`)는 coordinator·persist(mutate)·usage(read)·supervisor·approvals 가 공유하는 가변 턴 상태 | `app/src/main/lifecycle/turn-context.ts`, `persist.ts` |
| adapters 가 domain 타입 8종 소비(extensions/types.TurnRequest·settings.ResolvedProviderSettings·mcp/schema.OrcaMcpConfig·files.Extracted*·runtime-events.isRiskyTool 등) → 새 규칙에서 features→adapters(포트) 허용이므로 포트로 상향 이동해 결합 해소 | `claude-adapt.ts:20,23`·`claude.ts:25,30`·`claude-settings.ts:13` |
| extensions↔lifecycle 타입 상호참조(`extensions/types.ts:17→steer-queue`, `lifecycle/{ports,session-runtime,turn-coordinator}→extensions/types`), 전부 `import type` → 런타임 순환 없음 | grep import 그래프 |
| 데드코드: 빈 `POLICY_REGISTRY`(prompts/registry.ts)+연쇄, `platformHints`, `OneShotSessionRuntime` 별칭, `toOpencodeConfig`/`OpencodeMcp*`, `CapabilityProbe`/`RevertManager`, `installer`(24LoC), 무회귀 배럴 | grep 소비처 0 확인 |
| IPC = Electron 기본 ipcMain/ipcRenderer, 별도 RPC 라이브러리 금지. `shared/ipc.ts::CHANNELS` 가 preload·main 단일 계약점 | `docs/TRD.md §5`, `app/src/main/ipc/registry.ts` |
| eslint boundaries + import/no-cycle 로 main 레이어 강제(`eslint.config.mjs:99-144`). vitest include `src/**/*.test.ts`(위치 무관), main 진입점 `src/main/index.ts` 고정(`electron.vite.config.ts` `main: {}`) | `app/eslint.config.mjs`, `app/vitest.config.ts`, `app/electron.vite.config.ts` |

## 인수 기준 (Acceptance Criteria)

1. `src/main` 최상위 = `index.ts`·`env.d.ts`·`app/`·`contracts/`·`adapters/`·`features/`·`infra/` 만 — 구 디렉토리 17종·`ipc/`·`installer/` 잔존 0.
2. `infra/bus` 의 TypedBus 존재, 외부 신규 의존 0. 단위 테스트가 (a) 등록순 동기 실행 (b) critical throw 전파+후속 중단 (c) non-critical 격리 고정.
3. TurnCoordinator·settle 경로가 persist/forward sink 직접 호출 없이 `bus.emit('turn.event')` 사용, bootstrap 의 구독 등록 순서 usage→history→title→relay 명시·주석화.
4. turn_usage/turn_model_usage 적재가 features/usage 구독자로 이동, HistoryWriter 에 usage/cost 참조 0.
5. permission.requested/resolved 가 버스 경유로 renderer 도달, 채널명·페이로드 현행 동일(renderer diff 0).
6. 포트 타입(`TurnRequest`·`TurnExtensions`·`SteerFlushBatch`·`Extracted*`·`ResolvedProviderSettings`·`OrcaMcpConfig`)이 adapters 포트 파일에 있고, adapters 하위 import 가 adapters·infra·shared 밖을 안 가리킴.
7. features 간 직접 import 0 — 신규 boundaries rules 로 강제, 위반 샘플로 error 발화 1회 수동 확인.
8. eslint elements 신 형태(main-root/app/adapter-impl/adapters/features(capture)/contracts/infra/shared) 교체 + `import/no-cycle` 유지.
9. 제거 목록 심볼 전부 `grep -r` 0: `OneShotSessionRuntime`·`toOpencodeConfig`·`OpencodeMcp`·`POLICY_REGISTRY`·`buildAppend`·`loadPolicies`·`getPlatformHint`·`RevertManager`·`CapabilityProbe`·`Installer`·`InflightTurn`.
10. mock 어댑터·시나리오·debug IPC DEV 게이트 존치, 동작 무변경.
11. `src/shared`·`src/preload`·`src/renderer` diff 0 (CHANNELS·DTO·zod 계약 무변경).
12. 순서 회귀 테스트 존재: 단일 턴 스트림 [usage 적재→parts 영속→relay] 및 session.updated 의 [persist→title→forward→promote].
13. will-quit 경로가 [진행 턴 settle(aborted)→controller.abort→idle 런타임 close→closeDb] 순서 유지.
14. `cd app && npm run lint && npm run typecheck && npm test` green — 기존 테스트 전수 통과(데드코드 테스트 감소분 목록화 + 신규 bus/순서 테스트 추가).
15. `npm run build` 성공 (electron-vite main/preload/renderer 3-config 산출).
16. `src/main/AGENTS.md` 재작성(새 DAG·매핑·bus 규약·구독 순서) + `app/AGENTS.md` main 경로 표 갱신.

## 범위 / 비범위

- **범위**: `app/src/main` 디렉토리 재배치, infra/bus 도입, 데드코드 제거, 네이밍 정리, eslint boundaries·AGENTS.md 갱신.
- **비범위**: DbQueries 의 feature 별 repo 분해(스펙 §6 "쿼리는 feature repo" — 후속 핸드오프 후보). electron-trpc 도입(TRD RPC 금지). 코드에 없는 스펙 feature(auth/automation/workspace/subagents 독립 슬라이스) 신설. renderer 코드 변경.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 기존 모듈: `lifecycle/turn-coordinator.ts`·`ipc/chat/{send,persist,approvals}.ts`·`ipc/router.ts`·`adapters/types.ts`·`eslint.config.mjs`.
- 전제: vitest include 가 위치 무관 glob(`src/**/*.test.ts`), main 진입점 경로 불변, better-sqlite3 native·DB 스키마 무변경(마이그레이션 추가 없음).
- **신규 의존성**: 없음 (TypedBus 는 Node 표준으로 자체 구현, mitt 등 미도입).

## 설계

접근: 스펙 4계층(app/adapters/features/infra) + **`contracts/` 추가**(main 내부 타입 전용 계약 — `TurnContext`·bus 이벤트 맵의 유일한 합법 거처). 아래 순서로 커밋 단위 분할(각 단계 게이트 green, bisect 가능):

1. **infra/bus** — TypedBus(자체 Map, 동기·등록순, `on(k,fn,{critical})`→해제함수, critical throw 전파/기본 격리). persist 에서 usage 적재 추출 → usage 구독자, title/relay 구독자화, coordinator·settle 을 `bus.emit('turn.event')` 로. **디렉토리 이동과 분리**(구 위치에서 의미 전환 먼저).
2. **adapters 경계 정리** — 포트 타입 상향 이동(extensions/types→adapters/turn.ts 등), runtime-errors→infra/errors+adapters/claude, capabilities/prompts→adapters/claude(+데드 삭제), mcp 3분할, config→infra/config, settings/store→infra.
3. **코어 분해** — contracts/ 신설, lifecycle→features/{sessions,chat}, ipc/chat→features/{chat,history,approvals}, send.ts 분해(chat.ipc+turn-setup), router.ts→app/bootstrap.ts, index.ts 슬림화. **eslint 블록 교체 동봉**.
4. **핸들러 재배치 + RouterContext 해체** — handlers/*→각 feature ipc, installer 병합, per-feature deps 전환.
5. **AGENTS.md 재작성 + 잔여 데드 제거**.

재사용: `adapters/types.ts`(포트 정본)·`lifecycle/ports.ts`(중복 포트 → 해체 후 SessionAdapter 직접 참조)·`ipc/registry.ts`(handle 헬퍼 → infra/ipc)·`ipc/context.ts`(send 헬퍼 → infra/ipc).

레이어 경계: 새 boundaries elements(main-root/app/adapter-impl/adapters/features(capture feature)/contracts/infra/shared). features→[동일 feature, contracts, adapters(포트), infra, shared]; adapter-impl→[동일 engine, adapters, infra, shared]; app→전부.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 동시성/멀티세션: 버스는 동기·단일 인스턴스라 세션 간 순서 간섭 없음(이벤트에 sessionId 포함, 소비자가 turn 참조로 스코핑).
- 에러: critical 구독자(usage/history) throw = 턴 실패로 전파(현행 유지). non-critical(title/relay) throw = 로그 후 계속(파이프라인 생존). settle 내부 emit 은 try/catch(critical 재귀 방지).
- 빈 상태/유실: 구독 등록은 첫 IPC 핸들러 등록 전 완료 → 유실 창 없음.
- 그 외(로딩/테마/a11y): renderer 무변경이라 N/A.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 버스 전환 시 이벤트 순서 역전(usage 가 reset 후 null 읽기, relay 가 persist 앞섬) | 등록 순서 bootstrap 한 곳 고정 + 순서 회귀 테스트(AC12) + TypedBus 등록순 계약 테스트 |
| persist 예외 의미 변화(격리가 "persist throw=턴 실패"를 삼킴) | critical 플래그로 throw 전파 유지, settle 내부 emit try/catch |
| requestApproval 클로저 이동 회귀(controller/wc/turn 캡처, AbortSignal.any) | 버스 전환(①)과 분리해 코어 분해(③)에서 이동, send.runtime-resilience.test 로 커버 |
| 채널 등록 누락(handlers 재배치) | CHANNELS 전수 vs register 호출 grep 대조(④·verify) |
| electron-vite 빌드 영향 | main 진입점 불변(`main: {}`), `.sql?raw` 는 db 이동 없음, verify 에서 `npm run build` |
| better-sqlite3 ABI(0019 환경 제약) | native·스키마 무변경, node_modules 재설치 회피(rebuild 만) |

- 되돌리기 어려운 결정: 없음(순수 이동+주입 재배선, 로직 보존).
- **단독 결정 금지 항목(Open Question)**: 없음(스펙·질의응답으로 확정). DbQueries repo 분해는 비범위로 명시(후속).

## 영향 받는 파일

- `app/src/main/**` 전체 재배치(96 prod + 58 test 파일).
- `app/eslint.config.mjs` (99-144 boundaries 블록 교체).
- `app/src/main/AGENTS.md` 재작성, `app/AGENTS.md` main 경로 표 갱신.
- 무변경(diff 0): `app/src/shared/**`, `app/src/preload/**`, `app/src/renderer/**`.

## 참고 문서

- 첨부 `orca — Main Process Architecture Spec v0.1` (§1~§9, 부록 A)
- `docs/TRD.md §5`(IPC), `docs/arch/backend/`(adapters·provider-runtime·persistence)
- `app/src/main/AGENTS.md`(현 레이어 DAG, handoff 0017)
- IPC 무변경이므로 `docs/IPC_CONTRACT.md` 갱신 불필요(계약 diff 0).

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test` (각 커밋). 최종 `npm run build`.
- 신규 테스트: TypedBus 단위(등록순/critical/격리), 순서 회귀(usage→history→relay, session.updated 순서).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구(스펙+3확정)를 출처로 인용, 추론(IPC 무변경)은 추론 표기.
- [x] 자료조사 — 모든 발견에 레퍼런스(스펙 §·`파일:라인`) 부착.
- [x] 인수 기준 — 16개 번호, 자료조사 근거, 검증 가능(grep/테스트/게이트).
- [x] 의존 기술 — 전제 식별, 신규 의존성 0 명시.
- [x] 파생 UX — 동시성/에러/유실 엣지 전개, renderer 무변경분 N/A.
- [x] 리스크 — 버스 순서·예외 의미 등 고유 리스크 + 완화, Open Question 0.

---

> **[구현자 기입]** 이하는 구현 턴(Claude 비기능)에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

## [구현자 기입] 구현 체크리스트

## [구현자 기입] 구현 보고
