# `src/main/` — Main 프로세스 레이어 가이드 (코딩 에이전트용)

Electron **main 프로세스**(SDK 호출·IPC·DB·보안이 모이는 곳)의 모듈 구조 규칙. renderer 4-layer 처럼 **하향 의존만 허용**하고, 추가로 **feature 수직 슬라이스끼리 교차 import 를 금지**한다 — `eslint-plugin-boundaries` + `import/no-cycle` 로 빌드 시 강제(`app/eslint.config.mjs` 의 `src/main/**`·`src/shared/**` 블록). 위반은 `npm run lint` error. (구조 재편 정본: handoff 0062 — 아키텍처 스펙 "feature 수직 슬라이스 + adapters 한정 ports&adapters + 얇은 infra + app composition root".)

> 정본 우선: 채널 계약은 [`../../../docs/IPC_CONTRACT.md`](../../../docs/IPC_CONTRACT.md), 범용 정규화 계층은 [`../../../docs/arch/backend/provider-runtime.md`](../../../docs/arch/backend/provider-runtime.md). 본 문서는 _레이어·슬라이스 방향_ 규칙만 담는다.

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

| 레이어                  | 디렉토리                                                                                                                                                                       | 책임                                                                                                                                                                                                                                                                                          | 의존 허용                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **shared**              | `src/shared/` (`ipc.ts`·`protocol.ts`·`permission-mode.ts`·`update-restart.ts`·`obj.ts`·`path-basename.ts`·`usage/`·`time/`)                                                   | 순수 타입·상수·zod 스키마 + 순수 유틸(사용량 한도 파생 `usage/limits.ts`·업데이트 재시작 게이트 `update-restart.ts`). 런타임 의존 0.                                                                                                                                                          | shared                                                 |
| **infra**               | `src/main/infra/` (`bus`·`db`·`config`·`auth`·`log`·`ipc`·`errors`·`vars`·`settings-store`·`settings-migration`·`cron`)                                                                     | DB 싱글턴(마이그레이션 16종)·TypedBus·orca.json/secret·IPC 프리미티브(`ipc/handle`·`ipc/send`·`ipc/dto`)·에러 정규화·croner 래퍼(`cron.ts`)·중앙 로깅(`log/` — LogManager·JSONL file-transport·redact·suppress, 0123/0124)·인증 인프라(`auth/` — credential vault·browser session store·authenticated fetch·binding records/store·session policy·**`net-fetch.ts`/`net-request.ts`**). feature/어댑터 비의존.                                                                                                                                              | infra · shared                                         |
| **adapters**            | `src/main/adapters/`                                                                                                                                                           | `SessionAdapter` 포트(`types`·`turn`·`provider-config`·`mcp-config`·`hooks`·`risky-tools`·`descriptor`) + 구현(`claude.ts`·`mock.ts` — flat 파일, 엔진별 하위 폴더 아님) + 어댑터 오케스트레이션 + `claude-settings.ts`(`~/.claude/settings.json` 읽기, 0090).                                | adapters · adapter-impl · infra · shared               |
| **contracts**           | `src/main/contracts/` 8모듈 (`turn`·`bus-events`·`ports`·`session-state` + **진입점** `auth-method`(인증 방식이 채우는 3함수)·`internal-api`(**다른 모듈이 인증을 쓰는 API** — 소비 슬라이스는 `Pick<InternalApi, …>` 으로 좁혀 받고 구현은 컴포지션 루트가 주입한다. 손으로 다시 선언하면 `contracts/internal-api.test.ts` 가 잡는다) + `connector`·`usage-report`·`usage-source`)                                                                                                            | 여러 feature 가 공유하는 **턴/버스/런타임 타입 계약**. `TurnContext`·`OrcaBusEvents`·`RuntimeLiveTurn` 등. 구현 최소. **0178 에서 계약 동결(additive-optional-only)·`apiVersion` ABI 정책을 폐기했다** — 형태 강제는 등록 배열의 `satisfies` 로 컴파일 타임에 하고, 런타임 검증은 타입으로 표현할 수 없는 것(중복 id·origin 형태)만 남는다(`features/auth-platform/registry.ts` 헤더).                                                                                                                                                                         | contracts · adapters · infra · shared                  |
| **features**            | `src/main/features/<slice>/` (`chat`·`sessions`·`approvals`·`usage`·`history`·`providers`·`extensions`·`orchestration`·`scheduler`·`auth-platform`·`connectors`)                                      | 수직 슬라이스 — 턴 오케스트레이션·세션 런타임 거버넌스·승인·사용량·영속·provider(정적 사용량 provider 는 `features/providers/static/modules/` opt-in 레지스트리)·확장(MCP·skill·deploy·번들 시딩)·대화 연속성(fork/handoff)·주기 실행(croner, 0091)·인증(내장 방식 `methods/` + registry·transaction·레코드 스토어 + `login`(lifecycle)/`api`(`InternalApi` 구현)/`broker`(조립·복원) 3분해, 회사 대상은 `features/auth-platform/modules/` opt-in 레지스트리)·대상 실행(인증된 내장 도구 — raw credential 미접근).                                          | **같은 slice** · contracts · adapters · infra · shared |
| **app (컴포지션 루트)** | `src/main/app/` (`bootstrap`·**`chat-turn/`**(14모듈, 아래 §chat-turn 분해)·`chat-turn-continuation`·`context`·`boot-report`·`builtin-resources`·`updater`·`updater-feed`·`auth-restore`·`usage-source`(PluginHost→`UsageSourcePort` 어댑터, 0176)·`handlers/` **14종** `{auth,boot,cost,engine,files,log,mcp,misc,plugins,project,session,settings,skills,update}`) + `src/main/index.ts` | 부팅 배선(`Bootstrap`)·턴 셋업(`registerChatHandlers`)·자동 연속 턴(`chat-turn-continuation.ts`, 0126)·도메인 핸들러 등록·`RouterContext` 조립·window/shutdown·자동 업데이트(`updater.ts`+`updater-feed.ts`, 0084~0086·0133)·인증 복원(`auth-restore.ts`, 0170)·부팅 진단(`boot-report.ts`, 0077)·번들 리소스 해석(`builtin-resources.ts`, 0078). 구체 엔진명 리터럴 허용(1회성 배선). | 전부                                                   |

> `boundaries/elements` 분류 순서는 specific→catch-all(`adapter-impl` 이 `adapters` 보다 먼저). `src/main` 최상위는 `{app, contracts, adapters, features, infra}` + `index.ts`·`env.d.ts` 만 — 새 디렉토리는 이 중 하나에 속하게 둔다(어디에도 안 맞으면 boundaries "no element" error). 현재 `adapters/` 는 flat 파일 구조라 `adapter-impl`(folder capture) 요소에 매칭되는 대상이 없다 — 엔진별 하위 폴더가 생기면 다시 활성화되는 예비 규칙.
> `features/orchestration/` = Conversation Continuity(0051 §A.4) 첫 서비스(fork/handoff) — **순수 로직만**(handoff 자동 메시지 템플릿 `buildHandoffMessage` · 도착 물질화 `materializeContinuityArrival`). 실행 배선(어댑터 `forkSession` 호출·send/persist 훅)은 컴포지션 루트(`app/chat-turn`·`app/handlers/session`)와 `features/history` 가 소유한다.

## `app/chat-turn/` 분해 (0179)

`chat:send` 한 요청이 지나는 길은 길다 — 검증·lease·continuity·turn 조립·respawn·큐 적재·
승인 배선·요청 조립·턴-후 루프·정리 2단. 0179 이전에는 이 전부가 `registerChatHandlers`
(1,166줄) 안의 `handleChatSend`(892줄) **한 클로저**에 있어 어떤 단계도 따로 부를 수 없었다.

| 모듈 | 성격 | 책임 |
|---|---|---|
| `index.ts` | 배럴·배선 | `registerChatHandlers` — IPC 5종 등록 + 턴-공통 헬퍼(버스 방출·태스크 정착). **`'./chat-turn'` import 가 그대로 해석된다** |
| `send.ts` | 순서 | `handleChatSend` — 이름 붙은 12단계 시퀀스 + renderer 발신 + 정리 |
| `admission.ts` | **순수** | 진입 게이트 3종·lease 키 파생·continuity 검증·busy 예약 판정 |
| `turn-context.ts` | **순수** | `TurnContext` 조립·cwd 해석·연속 턴 계승 |
| `continuation.ts` | **순수** | listen/flush 연속 턴 `TurnRequest` 조립 |
| `resolve-turn.ts` | I/O | continuity 검증 + provider·env·세션 메타·실제 텍스트 해석 |
| `runtime-entry.ts` | I/O | 런타임 확보·체인 활성화·respawn 판정 |
| `enqueue.ts` | 상태 | 프렐류드/본 배치 적재 + `message.queued` |
| `turn-request.ts` | 조립 | 게이트 콜백 6종 + 중단 영수증 화해 |
| `approval.ts` | 배선 | `requestApproval` 클로저 |
| `post-turn.ts` | 실행 | `coordinator.run` + 자동 연속 턴 루프(listen/flush/break) |
| `busy-reserve.ts` | 상태 | busy 세션 send → held 예약 |
| `turn-setup.ts`·`deps.ts` | 조각·타입 | provider 해석·env 조립·소유권 발신 / 의존 묶음 2층 |

**작업 규칙 3가지** (깨지면 회귀가 조용히 난다 — 각 파일 헤더에 근거가 있다):

1. **판정과 발신을 섞지 마라.** `admission.ts`·`turn-context.ts`·`continuation.ts` 는 부작용이
   없어야 한다 — 그래야 규칙을 IPC 없이 단위 테스트할 수 있다(`*.test.ts` 25건).
2. **`activeTurn`·`initialBatches` 는 게터로 넘긴다.** 자동 연속 턴과 finally 정리가 함께 보는
   가변 상태다. 값으로 캡처하면 연속 턴에서 콜백이 옛 턴을 본다(0067 AC7·0166 D7).
3. **첨부 정규화는 busy 판정보다 앞** (0152 AC1) — 판정↔적재 사이에 `await` 를 넣지 마라.

## feature 수직 슬라이스 (핵심 규칙)

- **slice 끼리 직접 import 금지.** `features/chat` 가 `features/sessions` 를 import 하면 lint error.
- **교차가 필요할 때 3가지 해소책**:
  1. 공유 _타입_ → `contracts/` 로 승격(예: `TurnContext`·`OrcaBusEvents`).
  2. 구조적 _포트_ 로 결합 절단 — 소비 측이 필요한 메서드만 인라인 인터페이스로 받는다(예: chat coordinator 의 `registry: { promote(...) }`, approvals 의 `SessionLookup`). 구현 클래스가 구조적으로 만족한다.
  3. 컴포지션 루트(app) 가 concrete 를 **주입**한다(예: `TurnCoordinator` deps).
- 같은 slice 내부는 상대경로(`./x`)로, contracts/adapters/infra/shared 는 `../../contracts/x` 식으로 참조한다.

## 단일 턴 이벤트 파이프라인 (infra/bus)

어댑터 스트림 + 합성 이벤트는 `bus.emit('turn.event')` 단일 팬아웃으로 흐른다(스펙 §4.2). **구독 등록 순서 = 불변식의 SSOT, `app/bootstrap.ts` 한 곳이 소유**한다:

```
usage(집계) → history(영속) → title(제목) → relay(renderer 중계)
```

- `usage`·`history` 는 **critical**(throw = 턴 실패 전파), `title`·`relay` 는 **격리**(구독자 throw 가 파이프라인을 안 죽임).
- 순서 근거: usage 가 history 의 `currentAssistantMessageId` reset _전_ 에 그 id 를 읽고, title 이 relay 전에 트리거돼야 한다. 순서 회귀 테스트가 `features/chat/turn-coordinator.test.ts` 에 고정돼 있다.
- 버스를 타면 안 되는 forward-only 이벤트(합성 error·turn.retrying·message.committed)는 coordinator 가 `forward` sink 직접 호출을 유지한다(history 가 무조건 persist 하므로 없던 파트 영속 방지 — user 커밋은 `commitUserMessage` 단일 경로, 0067).
- **주기 실행 경로(0091)**: `features/scheduler`(croner) 는 job action 을 직접 구현하지 않는다 — 컴포지션 루트(`app/bootstrap.ts`)가 action(현재 사용량 recompute→broadcast)을 주입해 교차 feature 를 회피한다. `shutdown()` 은 `closeDb` 앞에 `Scheduler.stopAll()`.

## 원격 요청은 Chromium 스택으로만 (0173 / 0174)

> 근거·모듈 인벤토리 정본은 [`../../../docs/arch/backend/security.md`](../../../docs/arch/backend/security.md) §1.8·§1.9. 여기엔 *작업 규칙* 만 둔다.

main 프로세스는 **Node 전역 `fetch` 를 쓰지 않는다.** Node(undici) 스택은 OS 프록시·PAC 와 OS 인증서
저장소를 보지 않아, 사내 프록시 뒤의 사설 CA 서버로 나가지 못한다 — *브라우저로는 열리는데 앱만
안 되는* 증상이 여기서 나온다.

- **전역 `fetch(` 를 부를 수 있는 파일은 `infra/auth/net-fetch.ts` 하나뿐이다.** 그 밖에서
  전역 `fetch(` 를 쓰면 가드가 실패시킨다(메서드 호출 `ses.fetch(`·`ctx.fetch(`·
  `this.deps.fetchImpl(` 은 대상이 아니다).
- **Chromium 스택을 직접 무는 파일은 3개다** — `net-fetch.ts`(`net.fetch`) ·
  `net-request.ts`(`net.request`) · `browser-session-store.ts`(`net.request` 를 세션 cookie jar 로 —
  `probe`/`send` 둘 다 여기 산다). 셋 다
  `electron` 을 import 하므로 **테스트가 직접 import 하면 즉시 죽는다**(P29 — `vitest.config.ts`
  에 electron alias 없음). 판정·변환은 순수 모듈(`net-response.ts`)로 떼고 여기서는 배선만 한다.
- 소비자는 `typeof fetch` 포트로 **주입받는다**(`BrokerDeps.fetchImpl` · `createSender(fetchImpl)` ·
  `ExternalUsageService.fetchImpl`). **기본값을 두지 않는다** — 기본값은 곧 조용한 Node 스택 복귀다.
- 브라우저 세션(cookie jar)이 필요한 요청은 `BrowserSessionStore.send`/`probe` 를 쓴다 —
  `sendOnce(..., {session, credentials:'include'})` 라 세션 쿠키·통합 인증이 실린다(0178).
- 위반은 `infra/auth/no-node-fetch.test.ts` 가 **테스트로 잡는다**.
- **`redirect:'manual'` 은 Electron 에서 의미가 다르다 (0174).** 웹 fetch 는 3xx 를 돌려주지만
  Electron 은 **요청을 취소한다**(`followRedirect()` 를 동기 호출해야만 이어진다). 3xx 를 직접
  받아야 하면 `net.fetch` 가 아니라 **`infra/auth/net-request.ts` 의 `sendOnce`**(`net.request` 의
  `'redirect'` 이벤트로 3xx 재구성)를 쓴다 — `netFetch` 는 manual 요청을 그리로 우회한다.
  리다이렉트 **추종은 호출자가** 한다(홉마다 정책을 검사해야 하므로).

## 두 가지 강제 규칙

1. **`boundaries/dependencies`** — 위 DAG 하향 방향 + feature 같은-slice 만 허용(상위/교차 참조 error). v6 object 문법(`from:{type}`·`allow:{to:{type, captured}}`).
2. **`import/no-cycle`** — 같은 레이어 내부 순환까지 빌드 에러로 차단. (TS 파서를 `import/parsers` 로 등록해야 의존 `.ts` 를 따라간다 — config 참고.)

## 작업 규칙

- **상위/교차를 참조하고 싶으면 의존을 뒤집어라.** 콜백/구조적 포트/주입으로 방향을 하향·슬라이스-내부로 유지한다(위 3가지 해소책).
- **구체 provider/engine 리터럴**(`'claude'` 등)은 `adapters`·`features/extensions`(배포 레지스트리)·`features/providers/static/modules/`(정적 사용량 provider opt-in 레지스트리)·`features/auth-platform/{methods,modules}/`(내장 인증 방식 + opt-in 대상 레지스트리)·컴포지션 루트(`app/bootstrap.ts`·`index.ts`) 안에만. 코어·오케스트레이션은 백엔드 중립(handoff 0016).
- **네이밍**: 컴포지션 루트=`Bootstrap`, 영속=`HistoryWriter`(features/history), 사용량=`UsageTracker`(features/usage), 승인 broker=`ApprovalBroker`(features/approvals), 턴 상태=`TurnContext`(contracts). `SessionAdapter`·`NormalizedEvent`·`adapters/` 이름은 유지(사용자 확정).
- 모듈이 4책임 이상으로 비대해지면 slice 내부에서 응집 단위로 분해한다. 외부 import 가 많으면 배럴 re-export 로 무회귀 분해.
