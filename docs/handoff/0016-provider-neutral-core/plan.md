# Plan — 0016-provider-neutral-core

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). **구조 견고화 1/3** — 디자인 리뷰(스탭1·2)의 후속 구현.
> 스탭2 **문제 1 (Provider 중립 누수)** 의 채택안 **1-B "코어 완전중립"** 을 구현한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0016-provider-neutral-core` |
| 작성자 | Claude Code |
| 일자 | 2026-06-13 |
| 매핑 | PHASES "구조 견고화(provider 중립)" 행 (디자인 리뷰 스탭3) |
| 상태 | READY (다음=Codex — 사용자 지시로 구현은 Codex) |

## Context (왜)

0010~0015 리팩토링의 *목적 자체*가 "백엔드 중립"(claude-code 는 어댑터 하나, opencode 예정 — `ProviderId = 'claude-code' | 'opencode'`)이었다. 설계는 "provider 고유 코드는 어댑터 안에 가둔다"고 한다. 그런데 실제로는 **코어(오케스트레이터·persist)와 렌더러가 provider 를 박아 넣는다**:

- `NormalizedEvent` 의 **모든 variant** 가 `provider: ProviderId` 를 들고 다닌다(`app/src/shared/ipc.ts:198-270`). 단일 활성 백엔드 환경에선 세션이 곧 provider 라 사실상 중복 정보다.
- `ipc/chat/send.ts` 가 error 이벤트를 만들 때마다 `provider: 'claude-code'` 리터럴(10회), `persist.ts:74,91` 이 `backend/provider: 'claude-code'`, 렌더러 `chatStore.ts:195` 가 `lastBackend: 'claude-code'` (주석에 `// opencode 가 들어오면 lastBackend 도 갱신해야 한다 (OQ7)` 라는 **문서화된 미래 파손 지점** 명시).
- 비-테스트 소스에 `'claude-code'` 리터럴이 다수(`send.ts` 10·`persist.ts` 2·`router.ts` 3·`chatStore.ts` 1 등).

**비유**: 봉투(`NormalizedEvent`)는 "어느 우체국에서 왔는지 무관"하게 만들었다는데, 봉투 제작 라인 3곳(send/persist/renderer)이 전부 "클로드 우체국" 도장을 미리 찍는다. opencode 우체국을 열면 라인을 다 고쳐야 하고, 한 곳이라도 빠지면 잘못된 도장이 찍힌다.

**채택안(1-B 코어 완전중립)**: 이벤트에서 `provider` 필드를 제거해 **코어를 진짜 중립**으로 만들고, "어느 백엔드인지"는 **세션↔어댑터 바인딩**(세션 row 의 `backend`/`provider_key`, 0010)에서 파생한다. 구체 provider 리터럴은 **어댑터 계층(+probe/mock/단일 주입 seam)** 밖에서 사라진다.

### 검토 후 기각한 대안 (스탭2)

| 대안 | 기각 사유 |
|---|---|
| 1-A 자기식별 어댑터(리터럴→`adapter.id`만) | 누수는 줄지만 `provider` 필드가 여전히 전 이벤트에 흐름 — 사용자 채택 아님 |
| 1-C ask 합성 어댑터 격리 | 본 핸드오프 비범위(별도 — 사용자 미채택). 단 §비범위에 후속 anchor 로 남김 |

## 인수 기준 (Acceptance Criteria)

1. `provider: ProviderId` 필드를 **모든 `NormalizedEvent` variant** 에서 제거한다(`app/src/shared/ipc.ts:198-270`). 코어·렌더러 어디서도 `ev.provider` 를 읽지 않는다(컴파일 에러로 강제됨).
2. 어댑터 매퍼 `adapters/claude-map.ts`(`claudeToNormalized`)가 normalized 이벤트에 `provider` 를 더 이상 세팅하지 않는다(필드 제거 정합).
3. 오케스트레이터의 provider 리터럴 제거: `ipc/chat/send.ts` 의 error 이벤트 생성부와 `makeClassifiedError(...)` 호출이 `'claude-code'` 리터럴을 쓰지 않는다 — 활성 어댑터 식별자(`adapter.id` / `ctx.registry.getActive().id`)를 단일 출처로 사용한다. `ClassifiedError.provider`(ipc.ts:409) 는 유지하되 값의 출처가 어댑터(=`claudeErrorClassifier` 가 자기 id) 또는 활성 `adapter.id` 다.
4. `ipc/chat/persist.ts` 의 `db.insertSession({ backend })` 가 리터럴 대신 **턴 어댑터 id** 를 쓴다(턴에 `adapterId` 를 보관하거나 `turn.titleAdapter.id` 재사용). persist 가 합성하는 `tool.call.completed` 이벤트의 provider 필드도 1번에 따라 제거.
5. 렌더러 `features/chat/store/chatStore.ts` 가 `lastBackend: 'claude-code'` 리터럴을 제거한다 — 활성 세션의 backend(세션 메타/backend store 의 활성 백엔드)에서 파생하거나 `lastBackend` 갱신을 backend store 책임으로 옮긴다. OQ7 landmine 주석 제거.
6. **불변식**: 구체 provider 문자열 리터럴(`'claude-code'`/`'opencode'`)은 비-테스트 소스에서 `adapters/**` · `capabilities/**`(probe) · `adapters/mock*`(dev) **밖에 등장하지 않는다**. (`router.ts` 의 부팅 배선 리터럴은 컴포지션 루트로서 허용 — §설계 참조.) verify 가 `rg "'claude-code'|'opencode'"` 로 대조.
7. `docs/IPC_CONTRACT.md` §4 의 `NormalizedEvent` variant 정의에서 `provider` 필드 제거를 동기화한다(§6 변경 절차). 채널 수 변동 없음(36 유지).
8. 게이트 통과(lint/typecheck/test/build) + 테스트 갱신: `claude-map.test.ts`(provider 미설정), `chatStore.test.ts`(provider 미의존 라우팅), provider 를 읽던 다른 단위 테스트.

## 범위 / 비범위

- **범위**: 인수 1~8. `shared/ipc.ts`(타입) + main 오케스트레이션(`send`/`persist`/`context`/`router` 배선) + 어댑터 매퍼 + 렌더러 chatStore + IPC_CONTRACT.
- **비범위**: **1-C(ask 합성 어댑터 격리, 스탭1 C4) — 미채택, 후속 anchor**. opencode 어댑터 구현, 세션 `backend`/`provider_key` 스키마 변경(이미 존재), permission/모델 흐름 변경.

## 설계

- **세션이 곧 provider**: 세션은 0010 에서 어댑터에 잠긴다(`session.backend` 컬럼 + `provider_key`). 렌더러는 세션→provider 매핑을 `chatReducer` 의 `SET_MODEL`(adapter/providerKey) + 세션 row 로 이미 갖는다 — 이벤트의 provider 는 불필요.
- **단일 주입 seam(필요 시)**: 만약 특정 소비자가 와이어에서 provider 를 꼭 받아야 하면, `ipc/context.ts` 의 `sendChatEvent` **한 곳에서** 활성 `adapter.id` 로 부착한다(이벤트 생성부 분산 금지). 본 핸드오프의 1차 목표는 *필드 제거 + 세션 파생* 이므로 seam 은 폴백.
- **컴포지션 루트 예외**: `ipc/router.ts` 의 부팅 배선(`loadClaudeProviderSettings` 주입, `deploy('claude-code')`, status 로깅)은 컴포지션 루트라 구체 엔진명이 허용된다 — 다만 **반복되는 provider 태깅이 아니라 1회성 배선**이어야 한다(6번 불변식의 명시 예외로 verify 가 인지).
- **재사용**: `AdapterRegistry.getActive()`(`adapters/registry.ts`), `SessionAdapter.id`(`adapters/types.ts`), 세션 row `backend`/`provider_key`(`db` queries), `chatReducer` 의 adapter 상태.
- 레이어 경계: 변경은 main + shared(타입) + renderer chatStore. renderer 는 기존 store/selector 패턴 유지(state.md §1.3).

## 영향 받는 파일

- `app/src/shared/ipc.ts` — `NormalizedEvent` variant 들에서 `provider` 제거(ClassifiedError.provider 출처 정리)
- `app/src/main/adapters/claude-map.ts` (+`claude-map.test.ts`) — provider 미설정
- `app/src/main/ipc/chat/send.ts` · `persist.ts` · `context.ts` — 리터럴 제거 · `adapter.id` 출처화
- `app/src/main/ipc/chat/turn-registry.ts` — 필요 시 `adapterId` 보관 필드 추가
- `app/src/renderer/src/features/chat/store/chatStore.ts` (+`chatStore.test.ts`) — `lastBackend` 파생화 · OQ7 주석 제거
- `docs/IPC_CONTRACT.md` (§4) · `docs/PHASES.md` · `docs/handoff/INDEX.md`

## 참고 문서

- `docs/arch/backend/provider-runtime.md` (NormalizedEvent 정본 타입) · `docs/GLOSSARY.md`(Backend/SessionAdapter, "Provider" 금지어)
- `docs/IPC_CONTRACT.md` §4(변경 동시 갱신 — §6 절차)
- 스탭1·2 진단: 본 핸드오프 디자인 리뷰(A3·C4)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test` + `npm run build`.
- 회귀 기준선 375 passed. 신규/갱신 테스트: 인수 8 참조.

## 위험

| 위험 | 완화 |
|---|---|
| 와이어 계약 변경(provider 제거) — 다수 소비자 | 컴파일러가 모든 `ev.provider` 사용처를 에러로 노출 → 전수 처리. grep 보강 |
| 멀티 윈도우/멀티세션에서 provider 식별 | 세션↔어댑터 바인딩(0010)에서 파생 — 세션 단위가 provider 의 올바른 스코프 |
| dev MockAdapter(`id:'claude-code'`) | 어댑터 계층이라 6번 불변식에 포함되지 않음 |
| 누수 잔존 | verify 가 `rg "'claude-code'\|'opencode'"` 비-테스트 소스 0 대조(router 배선 예외 명시) |

---

## [Codex 기입] 구현 체크리스트

- [ ] 인수 1~2 (타입·매퍼 provider 제거)
- [ ] 인수 3~5 (오케스트레이터·persist·renderer 리터럴 제거 / 파생화)
- [ ] 인수 6 (리터럴 불변식 — grep 0)
- [ ] 인수 7 (IPC_CONTRACT §4)
- [ ] 인수 8 (게이트 + 테스트)

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` / `build` |
| 게이트 결과 | lint ☐ / typecheck ☐ / test ☐ (N passed) / build ☐ |
| 블로커 / 역질문 | (없으면 "없음") |
| 대상 커밋 | `<hash>` |
