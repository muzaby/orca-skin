# Plan — 0118-provider-boundary-respawn

## 메타

| 항목 | 값 |
|---|---|
| slug | `0118-provider-boundary-respawn` |
| 작성자 | Claude Code |
| 일자 | 2026-07-16 |
| 매핑 | Phase 4 (버그수정 — 비기능 = Claude 직접 구현) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "provider 경계를 넘어 모델을 변경할 시(보내기 버튼 클릭) 세션을 재시작하도록 구조를 변경하여야 한다" — 세션을 안 닫는 구현이라 기존 subprocess 의 환경변수가 갱신되지 않아 provider 변경 후 채팅이 이어지지 않는 버그 | 라이브 세션 요청 (2026-07-16) |
| 추론 의도 | "세션 재시작" = 대화(DB/렌더러) 유지 + **subprocess 채널만** 재시작. DB 가 SSOT 이고 SDK `resume` 이 컨텍스트를 잇는 기존 구조상, 사용자가 원하는 것은 대화 연속성을 잃지 않는 채널 respawn 이다 (추론) | root `AGENTS.md` "SSOT 는 DB", `adapters/claude.ts` resume 경로 |
| 추론 의도 | 같은 provider 안의 모델 변경은 현행 라이브 `setModel` 경로가 정상 동작하므로 재시작 대상이 아니다 (추론 — "provider 경계를 넘어" 라는 조건에서) | `session-runtime.ts` `setModel`, `claude.ts` pushTurn |

## Context (왜)

Orca 는 세션당 장수명 subprocess("채널")를 하나 열고 턴을 넘어 재사용한다(0067). 후속 턴은 `pushTurn` 으로 이어붙는데, 이 경로는 `text/model/permissionMode` 만 전달하고 **`env`/`providerSettings` 는 spawn 시점에만 주입**된다(spawn-바운드). 0010 시절의 "매 턴 sendMessage 재스폰 → provider env 자연 적용" 가정이 0067 의 persistent 채널 도입으로 깨졌다 — 사용자가 턴 재시작 시 provider 경계를 넘는 모델로 변경해도 살아있는 채널의 provider env(API base/키)가 낡은 채로 남아 채팅이 이어지지 않는다.

`claude.ts` 는 이미 "providerSettings 변경은 respawn 경계(호출자 소관)" 로 선언하고 있으나, 호출자(chat-turn)에 그 판정이 존재하지 않는다. 본 작업이 그 빠진 판정을 채운다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| provider env/settings 는 spawn 에서만 주입: `...adaptSettings(req.providerSettings?.settings)` + `...adaptEnv(env)`, respawn 시 `resume: req.forkFrom ?? sessionId` 로 대화 연속 | 코드 `app/src/main/adapters/claude.ts:330,361-362` |
| `TurnContinuation`(pushTurn 계약)은 env/providerSettings 를 의도적으로 제외 — "스폰-바인딩 옵션은 여기 없다(변경 시 respawn 경계 — 0067 설계)" | 코드 `app/src/main/adapters/turn.ts:86-97` |
| "effort/providerSettings/extensions 변경은 respawn 경계(호출자 소관)" — 판정 책임은 호출자에 있으나 미구현 | 코드 `app/src/main/adapters/claude.ts:445-447` |
| `SessionRuntime.runAttempt`: 채널 생존 시 `pushTurn` 재사용(stale-env 경로), 아니면 `adapter.sendMessage` 스폰(콜드 패스). `teardownChannel()` 이 채널 강제 해체 프리미티브(상태머신 불변) — 기존엔 private | 코드 `app/src/main/features/sessions/session-runtime.ts:139-183,292-303` |
| 채널 사망 후 다음 send = respawn 콜드 패스는 기존 검증된 경로 (테스트 고정) | 코드 `app/src/main/features/sessions/session-runtime.test.ts` "채널 스트림이 에러로 죽으면 … 다음 send 는 respawn" |
| `resolveTurnProvider` 가 턴 시작 시 이전 키(`meta.provider_key` — 세션 마지막 사용 provider, 0010 영속)와 새 키(`resolved.providerKey`)를 둘 다 보유 — 경계 판정의 자연 지점 | 코드 `app/src/main/app/chat-turn.ts:108-150` |
| 채널 사망 시 미소비 메시지 이월은 `channelAlive` 판정 후 `takeForRespawn` 프렐류드로 이미 구현 — teardown 을 이 판정 *앞* 에 두면 이월이 자연 동작 | 코드 `app/src/main/app/chat-turn.ts:474-482`, `docs/arch/backend/runtime-ipc.md §1.3` |
| 런타임 풀은 sessionId 로만 키잉(provider-blind) — 풀/수퍼바이저에 provider 어휘를 넣으면 0016(provider-neutral core) 위반 | 코드 `app/src/main/features/sessions/{supervisor.ts:114-119,runtime-pool.ts}`, `docs/handoff/0016-provider-neutral-core/` |
| busy 세션의 `chat:send` 는 `reserveOnBusySession` 예약으로 조기 반환 — `resolveTurnProvider` 에 도달하지 않음(경계 판정 불가 지점) | 코드 `app/src/main/app/chat-turn.ts:298-301` |
| 0010 설계 가정 "env 주입은 매 턴 sendMessage 에서 일어나므로 provider·모델 변경이 턴 단위로 자연 적용" — 0067 persistent 채널로 드리프트(본 버그의 기원) | `@docs/handoff/0010-agent-model-select/plan.md:20`, `@docs/handoff/0067-long-lived-session-queue/` |

## 인수 기준 (Acceptance Criteria)

1. **경계 respawn**: 유휴 세션에서 provider 키가 바뀐 send 는 살아있는 채널을 teardown 하고, 그 턴이 spawn(resume) 콜드 패스로 새 `env`/`providerSettings` 를 주입받는다 (단위 테스트: teardown 후 다음 send 가 `adapter.sendMessage` 재호출 + 새 env 전달).
2. **동일 provider 무 teardown**: providerKey 가 같으면 채널을 재사용한다(모델 변경은 기존 `setModel`/pushTurn 라이브 경로 유지) — 판정 함수가 false 를 반환.
3. **보수적 no-op**: 이전 키 null/undefined(레거시 세션·미영속), 해석 실패(resolved null)는 경계 아님 — 판정 함수가 false 를 반환.
4. **새 세션/fork/handoff 무영향**: `sessionId == null` 경로는 판정을 타지 않는다(어차피 fresh spawn). 판정 호출부가 `parsed.data.sessionId` 가드를 포함.
5. **teardown 위생**: `teardownChannel()` 은 상태머신을 건드리지 않고(`state` 유지), unframed 백로그를 비워 respawn 후 프레임에 유출되지 않는다 (단위 테스트).
6. **busy 세션 비범위 문서화**: 진행 턴 중 provider 변경은 held 예약 경로로 빠져 이번 판정 대상이 아님을 본 plan 파생 UX 에 명시.
7. **게이트**: `cd app && npm run lint && npm run typecheck` green + 신규/영향 vitest 스위트 green (DB 로드 스위트의 ABI 환경 실패는 알려진 베이스라인으로 분리 보고).

## 범위 / 비범위

- **범위**: chat:send 시점의 provider 경계 판정(순수 함수) + 살아있는 채널 teardown + `teardownChannel` public 승격 + 단위 테스트 + `runtime-ipc.md` 한 줄.
- **비범위**:
  - busy 세션(진행 턴) 중 provider 변경 — held/steer 경로에 provider 재해석을 넣는 별개 기능 (후속 필요 시 새 핸드오프).
  - 렌더러 변경 — 이미 매 턴 `providerKey` 를 보내므로 불필요.
  - 어댑터 경계(backend) 변경 — 기존 adapter-mismatch 가드(0010→0014) 유지.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈 재사용: `SessionRuntime.teardownChannel()`(채널 해체), SDK `resume`(claude.ts spawn 경로), `pendingMessages.takeForRespawn`(이월), `resolveTurnProvider`(키 해석).
- 전제: `sessions.provider_key` 는 user 메시지 커밋 시 영속(0010/0067 echo 경로) — 살아있는 채널이 있는 세션은 커밋된 턴이 있으므로 실질 non-null.
- **신규 의존성**: 없음.

## 설계

- **판정은 컴포지션 루트에서, 프리미티브는 sessions 슬라이스에서.** provider 어휘는 `features/providers` + `app/`(컴포지션 루트)에만 둔다(0016).
  - `features/providers/provider-boundary.ts` (신규): 순수 판정 `crossesProviderBoundary(previousKey, resolvedKey)` — providerKey(`${adapter}-${provider}`) 전체 비교, null 은 보수적 false. `provider-settings.ts` 배럴에 re-export(기존 chat-turn import 경로 관례).
  - `features/sessions/session-runtime.ts`: `teardownChannel()` private → public (이름·구현 유지 — 이미 provider-중립 어휘고 "respawn 경계" 주석 보유). 주석에 spawn-바운드 옵션 변경 경계가 호출자 선언임을 명시.
  - `app/chat-turn.ts` `handleChatSend`: `acquireRuntime` 직후(프렐류드 `channelAlive` 판정 **앞**)에
    `sessionId && crossesProviderBoundary(sessionMeta?.provider_key, resolved.providerKey) && runtime.channelAlive → runtime.teardownChannel()`.
    teardown 이 `channelAlive=false` 를 만들므로 기존 `takeForRespawn` 이월(미소비 flushed + held 프렐류드)이 코드 추가 없이 동작한다.
- **왜 풀/수퍼바이저 provider-aware 화가 아닌가**: 세션 레이어에 provider 어휘가 유입(0016 위반)되고, 컴포지션 루트가 이미 모든 입력(이전 키·새 키·runtime)을 가진 결정을 중복 분산시킨다.
- **왜 전체 키 비교인가**: provider 디렉토리(`sources/settings/<adapter>/<provider>/`)마다 독립 settings/env 이므로 키가 다르면 곧 env 경계다. provider 세그먼트 파싱은 이득 없이 키 포맷 의존만 추가.
- 레이어 경계: `app → features/providers·features/sessions` 하향 의존만. feature 교차 import 없음(providers 판정을 chat-turn 이 조합).

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **대화 연속성**: respawn 은 SDK `resume: sessionId` 로 컨텍스트를 잇고 메시지 출처는 DB — 사용자 관점 "재시작" 은 첫 응답 지연(스폰 비용) 외 비가시.
- **busy 세션(동시성)**: 진행 턴 중 send 는 held 예약 — 그 메시지는 진행 턴의 provider 로 처리되고, provider 변경은 다음 유휴 send 부터 적용(비범위, AC#6).
- **미소비 메시지**: teardown 으로 CLI 큐 잔존분이 소멸해도 `takeForRespawn` 이 flushed 미소비분+held 를 프렐류드로 재주입(기존 채널-사망 이월 경로 재사용).
- **레거시 세션**(provider_key null): 판정 false → 기존 동작 유지. 살아있는 채널이 있는 세션은 커밋 이력이 있어 실질 도달 불가.
- **연속 경계 왕복**(A→B→A): 매번 respawn — 정확성 우선, 스폰 비용은 수용(무손실).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| `provider_key` 는 echo 커밋 게이트 — 커밋 전 턴 실패 시 DB 키가 실제 spawn env 보다 한 턴 지연 가능 | 그 경로에선 채널이 거의 항상 죽어 있어(에러→teardown) 콜드 패스 진입; 최악은 불필요 respawn 1회(무손실) 또는 이중 열화 시퀀스에서 respawn 누락 1회. 스폰 키 별도 추적(Map)은 희귀 엣지 대비 과잉 상태로 기각 |
| teardown 이 unframed(CLI 자동 픽업) 백로그를 드랍 | 의도된 동작 — 소속 불명 이벤트의 신 채널 유출 방지. 메시지 자체는 pendingMessages 이월이 보전 (AC#5 테스트) |
| 불필요 respawn (판정 오탐) | 전체 키 비교는 결정론적이고, respawn 은 resume 으로 무손실 — 오탐 비용이 낮은 방향으로 설계 |

- 되돌리기 어려운 결정: 없음 (모두 가역적 코드 변경).
- 단독 결정 금지 항목: 없음 (Open Question 무관).

## 영향 받는 파일

- `app/src/main/features/providers/provider-boundary.ts` (신규) + `provider-boundary.test.ts` (신규)
- `app/src/main/features/providers/provider-settings.ts` (배럴 re-export 1줄)
- `app/src/main/features/sessions/session-runtime.ts` (`teardownChannel` public 승격 + 주석)
- `app/src/main/features/sessions/session-runtime.test.ts` (respawn 테스트 2건)
- `app/src/main/app/chat-turn.ts` (import + 경계 판정 호출부)
- `docs/arch/backend/runtime-ipc.md` (§1.3 한 줄)
- `docs/handoff/INDEX.md` · 본 plan/verify

## 참고 문서

- `docs/arch/backend/runtime-ipc.md` §1.3~1.4 (장수명 채널·콜드 패스·이월)
- `docs/handoff/0067-long-lived-session-queue/` (persistent 채널 도입 — 본 버그의 구조적 기원)
- `docs/handoff/0010-agent-model-select/` (턴 단위 provider 전환의 원 설계 가정 — 본 작업이 persistent 시대에 맞게 보완)
- `docs/handoff/0016-provider-neutral-core/` (sessions 레이어 provider-중립 제약)
- IPC 변경: 없음 (`IPC_CONTRACT.md` 무영향 — 채널·페이로드 불변)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: 순수 판정 함수(`provider-boundary.test.ts`) + SessionRuntime respawn 계약(`session-runtime.test.ts` 2건) — 모두 비-DB(ABI 중립).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청 인용으로 남겼고, "채널만 재시작(대화 유지)"·"동일 provider 제외"는 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 `파일:라인`/`@docs` 레퍼런스를 붙였다.
- [x] 인수 기준 — 번호 7건, 자료조사 근거, 단위 테스트/게이트로 검증 가능.
- [x] 의존 기술 — 재사용 모듈·전제 식별, 신규 의존성 없음.
- [x] 파생 UX — 연속성/동시성(busy)/이월/레거시/왕복 엣지를 펼쳤다.
- [x] 리스크 — commit-gate 지연·unframed 드랍·오탐 트레이드오프와 완화책을 적었다.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 판정 위치(컴포지션 루트)·프리미티브 public 승격·전체 키 비교·이월 재사용 모두 기존 계약("respawn 경계 = 호출자 소관")을 채우는 최소 변경으로 타당.
- 이견 / 우려 → 조정 1건: 설계 초안은 판정 함수를 `chat-turn.ts` 에 export 하려 했으나, chat-turn 모듈은 import 시점에 `electron`(ipcMain)을 끌어와 **비-DB vitest 에서 직접 import 이 불가**하다(기존 chat-turn 테스트들도 모듈을 직접 import 하지 않음). 순수 판정을 `features/providers/provider-boundary.ts` 로 분리하고 배럴 re-export — 테스트 가능성 + provider 어휘 위치(providers 슬라이스) 모두 개선되는 조정이라 선조치(✅).

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 판정 함수를 chat-turn 에 두면 단위 테스트가 electron import 에 막힘 | ✅ `features/providers/provider-boundary.ts` 로 분리 + 배럴 re-export (동작 동일) | 구현 세부 — 설계 의도(컴포지션 루트가 판정을 *호출*) 불변 |

## [구현자 기입] 구현 체크리스트

- [x] `teardownChannel` public 승격 + 주석
- [x] `crossesProviderBoundary` 순수 함수 + 배럴 re-export
- [x] chat-turn 경계 판정 호출부 (acquireRuntime 직후·프렐류드 판정 앞)
- [x] 테스트 3건 (판정 4케이스 + respawn 2건)
- [x] `runtime-ipc.md` §1.3 한 줄
- [x] 게이트 (lint/typecheck/영향 스위트)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `provider-boundary.ts`(신규)·`provider-boundary.test.ts`(신규)·`provider-settings.ts`·`session-runtime.ts`·`session-runtime.test.ts`·`chat-turn.ts`·`runtime-ipc.md` |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `./node_modules/.bin/vitest run <영향 스위트>` |
| 게이트 결과 | (verify.md 에 기록) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (커밋 후 INDEX 에 기재) |
