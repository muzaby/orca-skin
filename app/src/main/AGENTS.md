# `src/main/` — Main 프로세스 레이어 가이드 (코딩 에이전트용)

Electron **main 프로세스**(SDK 호출·IPC·DB·보안이 모이는 곳)의 모듈 구조 규칙. renderer 4-layer 처럼 **하향 의존만 허용**하고, 추가로 **feature 수직 슬라이스끼리 교차 import 를 금지**한다 — `eslint-plugin-boundaries` + `import/no-cycle` 로 빌드 시 강제(`app/eslint.config.mjs` 의 `src/main/**`·`src/shared/**` 블록). 위반은 `npm run lint` error. (구조 재편 정본: handoff 0062 — 아키텍처 스펙 "feature 수직 슬라이스 + adapters 한정 ports&adapters + 얇은 infra + app composition root".)

> 정본 우선: 채널 계약은 [`../../../docs/IPC_CONTRACT.md`](../../../docs/IPC_CONTRACT.md), 범용 정규화 계층은 [`../../../docs/arch/backend/provider-runtime.md`](../../../docs/arch/backend/provider-runtime.md). 본 문서는 *레이어·슬라이스 방향* 규칙만 담는다.

## 레이어 DAG (하향 의존만)

```
app        →  전부                                     (컴포지션 루트 — 부팅 배선·핸들러 등록·턴 셋업)
features   →  같은 feature · contracts · adapters · infra · shared   (수직 슬라이스 — 교차 feature 금지)
contracts  →  contracts · adapters · infra · shared    (main 내부 타입 계약 — 구현 최소)
adapters   →  adapters · adapter-impl · infra · shared  (SessionAdapter 포트 & 구현)
infra      →  infra · shared                           (얇은 인프라 — DB·bus·config·ipc 헬퍼)
shared     →  shared                                   (순수 타입/상수/zod — src/shared/, 런타임 의존 0)
```

**누구도 app 을 의존하지 않는다.** feature 는 다른 feature 를 **직접 import 하지 않는다** — 필요하면 (a) 공유 타입을 `contracts/` 로 올리거나 (b) 구조적 포트 타입으로 결합을 끊거나 (c) 컴포지션 루트(app)가 주입한다.

## 레이어 ↔ 디렉토리 매핑

| 레이어 | 디렉토리 | 책임 | 의존 허용 |
|---|---|---|---|
| **shared** | `src/shared/` (`ipc.ts`·`protocol.ts`·`permission-mode.ts`) | 순수 타입·상수·zod 스키마. 런타임 의존 0. | shared |
| **infra** | `src/main/infra/` (`bus`·`db`·`config`·`ipc`·`errors`·`vars`·`settings-store`) | DB 싱글턴·TypedBus·orca.json/secret·IPC 프리미티브(`ipc/handle`·`ipc/send`·`ipc/dto`)·에러 정규화. feature/어댑터 비의존. | infra · shared |
| **adapters** | `src/main/adapters/` | `SessionAdapter` 포트(`types`·`turn`·`provider-config`·`mcp-config`·`hooks`·`risky-tools`·`descriptor`) + 구현(claude·mock) + 어댑터 오케스트레이션. | adapters · adapter-impl · infra · shared |
| **contracts** | `src/main/contracts/` (`turn`·`bus-events`·`ports`·`session-state`) | 여러 feature 가 공유하는 **턴/버스/런타임 타입 계약**. `TurnContext`·`OrcaBusEvents`·`RuntimeLiveTurn` 등. 구현 최소. | contracts · adapters · infra · shared |
| **features** | `src/main/features/<slice>/` (`chat`·`sessions`·`approvals`·`usage`·`history`·`providers`·`extensions`·`orchestration`) | 수직 슬라이스 — 턴 오케스트레이션·세션 런타임 거버넌스·승인·사용량·영속·provider·확장·대화 연속성(fork/handoff). | **같은 slice** · contracts · adapters · infra · shared |
| **app (컴포지션 루트)** | `src/main/app/` (`bootstrap`·`chat-turn`·`context`·`handlers/`) + `src/main/index.ts` | 부팅 배선(`Bootstrap`)·턴 셋업(`registerChatHandlers`)·도메인 핸들러 등록·`RouterContext` 조립·window/shutdown. 구체 엔진명 리터럴 허용(1회성 배선). | 전부 |

> `boundaries/elements` 분류 순서는 specific→catch-all(`adapter-impl` 이 `adapters` 보다 먼저). `src/main` 최상위는 `{app, contracts, adapters, features, infra}` + `index.ts`·`env.d.ts` 만 — 새 디렉토리는 이 중 하나에 속하게 둔다(어디에도 안 맞으면 boundaries "no element" error).
> `features/orchestration/` = Conversation Continuity(0051 §A.4) 첫 서비스(fork/handoff) — **순수 로직만**(handoff 자동 메시지 템플릿 `buildHandoffMessage` · 도착 물질화 `materializeContinuityArrival`). 실행 배선(어댑터 `forkSession` 호출·send/persist 훅)은 컴포지션 루트(`app/chat-turn`·`app/handlers/session`)와 `features/history` 가 소유한다.

## feature 수직 슬라이스 (핵심 규칙)

- **slice 끼리 직접 import 금지.** `features/chat` 가 `features/sessions` 를 import 하면 lint error.
- **교차가 필요할 때 3가지 해소책**:
  1. 공유 *타입* → `contracts/` 로 승격(예: `TurnContext`·`OrcaBusEvents`).
  2. 구조적 *포트* 로 결합 절단 — 소비 측이 필요한 메서드만 인라인 인터페이스로 받는다(예: chat coordinator 의 `registry: { promote(...) }`, approvals 의 `SessionLookup`). 구현 클래스가 구조적으로 만족한다.
  3. 컴포지션 루트(app) 가 concrete 를 **주입**한다(예: `TurnCoordinator` deps).
- 같은 slice 내부는 상대경로(`./x`)로, contracts/adapters/infra/shared 는 `../../contracts/x` 식으로 참조한다.

## 단일 턴 이벤트 파이프라인 (infra/bus)

어댑터 스트림 + 합성 이벤트는 `bus.emit('turn.event')` 단일 팬아웃으로 흐른다(스펙 §4.2). **구독 등록 순서 = 불변식의 SSOT, `app/bootstrap.ts` 한 곳이 소유**한다:

```
usage(집계) → history(영속) → title(제목) → relay(renderer 중계)
```

- `usage`·`history` 는 **critical**(throw = 턴 실패 전파), `title`·`relay` 는 **격리**(구독자 throw 가 파이프라인을 안 죽임).
- 순서 근거: usage 가 history 의 `currentAssistantMessageId` reset *전* 에 그 id 를 읽고, title 이 relay 전에 트리거돼야 한다. 순서 회귀 테스트가 `features/chat/turn-coordinator.test.ts` 에 고정돼 있다.
- 버스를 타면 안 되는 forward-only 이벤트(합성 error·turn.retrying·message.committed)는 coordinator 가 `forward` sink 직접 호출을 유지한다(history 가 무조건 persist 하므로 없던 파트 영속 방지 — user 커밋은 `commitUserMessage` 단일 경로, 0067).

## 두 가지 강제 규칙

1. **`boundaries/dependencies`** — 위 DAG 하향 방향 + feature 같은-slice 만 허용(상위/교차 참조 error). v6 object 문법(`from:{type}`·`allow:{to:{type, captured}}`).
2. **`import/no-cycle`** — 같은 레이어 내부 순환까지 빌드 에러로 차단. (TS 파서를 `import/parsers` 로 등록해야 의존 `.ts` 를 따라간다 — config 참고.)

## 작업 규칙

- **상위/교차를 참조하고 싶으면 의존을 뒤집어라.** 콜백/구조적 포트/주입으로 방향을 하향·슬라이스-내부로 유지한다(위 3가지 해소책).
- **구체 provider/engine 리터럴**(`'claude'` 등)은 `adapters`·`features/extensions`(배포 레지스트리)·컴포지션 루트(`app/bootstrap.ts`·`index.ts`) 안에만. 코어·오케스트레이션은 백엔드 중립(handoff 0016).
- **네이밍**: 컴포지션 루트=`Bootstrap`, 영속=`HistoryWriter`(features/history), 사용량=`UsageTracker`(features/usage), 승인 broker=`ApprovalBroker`(features/approvals), 턴 상태=`TurnContext`(contracts). `SessionAdapter`·`NormalizedEvent`·`adapters/` 이름은 유지(사용자 확정).
- 모듈이 4책임 이상으로 비대해지면 slice 내부에서 응집 단위로 분해한다. 외부 import 가 많으면 배럴 re-export 로 무회귀 분해.
