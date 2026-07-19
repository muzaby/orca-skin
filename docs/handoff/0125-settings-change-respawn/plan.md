# Plan — 0125-settings-change-respawn

## 메타

| 항목 | 값 |
|---|---|
| slug | `0125-settings-change-respawn` |
| 작성자 | Claude Code |
| 일자 | 2026-07-19 |
| 매핑 | Phase 4 (버그수정 — 비기능 = Claude 직접 구현) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "3개 provider(bedrock + 폐쇄망 2) 를 각각의 settings.json(api base url + auth token)으로 운영 중 — 세션이 지속되는 상태에서 api base url 및 auth token 이 동적으로 변경 가능한지 검토하라" | 라이브 세션 버그리포트 (2026-07-19) |
| 추론 의도 | 검토 결과 provider *간* 전환은 0118 respawn 으로 이미 동작하나, **같은 provider 의 settings.json 을 제자리 수정**(토큰 로테이션·base URL 교체)한 경우 살아있는 채널에 미반영되는 갭이 확인됨 — 사용자 환경(폐쇄망 토큰 로테이션)에서 실질 버그이므로 수정한다 (추론 — 검토 요청의 자연 귀결) | 본 plan 자료조사 |
| 추론 의도 | 버그개요의 "모델 변경이 다음 턴에만 된다고 답변" 증상은 세션 내 에이전트(LLM)의 자기 모델 보고로 추정 — spawn 시점 system prompt 에 고정되어 신뢰 불가. 실제 적용 여부 판정은 `turn_model_usage` 원장/wire log 가 정본 (추론 — 코드상 해당 문구는 busy 경계 placeholder 뿐) | `app/src/renderer/src/shared/i18n/resources/ko.ts:538`, `app/src/main/adapters/claude.ts:449` |

## Context (왜)

0118 은 provider *경계*(providerKey 변경)를 넘는 send 에서 채널을 respawn 해 새 env 를 주입하도록 고쳤다. 그러나 경계 판정이 **providerKey 문자열만 비교**하므로, 같은 provider 의 `sources/settings/<adapter>/<provider>/settings.json` 을 제자리에서 수정(예: `ANTHROPIC_AUTH_TOKEN` 로테이션, `ANTHROPIC_BASE_URL` 교체)하면 — `ProviderSettingsService.resolve()` 가 mtime 변화로 새 blob 을 읽어내도 — 살아있는 채널은 teardown 되지 않고 **spawn 때 주입된 낡은 토큰/URL 로 계속 동작**한다. env/providerSettings 는 spawn-바운드(`pushTurn` 미전달)라 채널 respawn 없이는 적용 경로가 없다. 폐쇄망 토큰 만료/로테이션 운영에서 세션이 낡은 토큰으로 인증 실패를 맞고 원인 파악이 어렵다. 현재 워크어라운드는 앱 재시작 또는 provider 왕복 전환뿐.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| settings blob 은 spawn 에서만 주입(`adaptSettings` → `options.settings` 인라인 JSON string), `pushTurn` 은 model/permissionMode/본문만 전달 | 코드 `app/src/main/adapters/claude-adapt.ts:82`, `app/src/main/adapters/claude.ts:444-456`, `app/src/main/adapters/turn.ts:86-97` |
| settings 파일은 매 chat:send 마다 mtime 스테일 체크 후 재해석 — 캐시 히트 시 **동일 객체 참조** 반환, mtime 변화 시 재파싱(새 객체) | 코드 `app/src/main/features/providers/provider-settings.ts:104-120` |
| 0118 경계 판정은 providerKey 전체 문자열 비교만 — settings 내용 변화는 판정 밖 | 코드 `app/src/main/features/providers/provider-boundary.ts:5-10` |
| respawn 프리미티브(`teardownChannel`)·이월(`takeForRespawn` 프렐류드)·콜드 패스(spawn+`resume`)는 0118 이 이미 배선 — 판정 조건만 확장하면 재사용 가능 | 코드 `app/src/main/app/chat-turn.ts:480-499`, `app/src/main/features/sessions/session-runtime.ts:311-331` |
| `SessionRuntime.runAttempt` 스폰 경로가 `req`(TurnRequest, `providerSettings` 포함)를 보유 — spawn 시점 주입본 기록의 자연 지점. sessions 레이어는 adapters 타입 import 허용 | 코드 `app/src/main/features/sessions/session-runtime.ts:173-193`, `app/src/main/AGENTS.md` 레이어 DAG |
| sessions 레이어는 provider-중립(0016) — 판정(내용 비교)은 features/providers 순수 함수 + 호출은 컴포지션 루트, sessions 는 불투명 blob 기록만 | `@docs/handoff/0016-provider-neutral-core/`, `@docs/handoff/0118-provider-boundary-respawn/plan.md` 설계 §"판정은 컴포지션 루트에서" |
| busy 세션 send 는 held 예약으로 조기 반환 — 경계/지문 판정 지점(resolveTurnProvider 이후)에 도달하지 않음. 0118 과 동일 비범위 | 코드 `app/src/main/app/chat-turn.ts:298-301`(0118 plan 인용), `@docs/handoff/0119-busy-steer-provider-gate/` |
| fs.watch 는 의도적 미도입(부팅 1회 스캔 + mtime-on-read) — 본 수정도 send 시점 판정으로 충분, watch 불요 | 코드 `app/src/main/app/bootstrap.ts:83` |
| engine CRUD/deploy 후 `invalidateAll()` 로 캐시 전체 무효화 — 재해석 시 내용이 같으면 JSON 직렬화도 동일하므로 내용 비교는 불필요 respawn 을 만들지 않는다(참조 비교만이면 만들었을 것) | 코드 `app/src/main/features/providers/provider-settings.ts:83-88`, `app/src/main/app/handlers/engine.ts:34` |

## 인수 기준 (Acceptance Criteria)

1. **동일 provider settings 변경 respawn**: 유휴 세션에서 providerKey 는 같지만 spawn 시점과 settings blob **내용**이 달라진 send 는 살아있는 채널을 teardown 하고, 그 턴이 spawn(resume) 콜드 패스로 새 providerSettings 를 주입받는다 (단위 테스트: 판정 함수 true + chat-turn 조건 확장).
2. **내용 동일 무 teardown**: settings 내용이 같으면(동일 참조 또는 재파싱된 동일 내용 객체) 채널을 재사용한다 — 판정 함수가 false 를 반환 (참조 fast-path 포함).
3. **보수적 no-op**: spawn 기록 부재(스폰 전·teardown 후·oneshot)·이번 턴 해석 실패/무설정(undefined)은 변경 아님 — 판정 함수가 false 를 반환 (0118 null 의미론과 동일).
4. **spawn 지문 기록 수명**: `SessionRuntime` 이 콜드 스폰 시 주입한 `providerSettings` 를 기록하고, `pushTurn` 재사용은 기록을 바꾸지 않으며, `teardownChannel()`/채널 사망(finishPump) 시 기록을 비운다 (단위 테스트).
5. **0118 경계 판정 무회귀**: providerKey 가 다른 경우의 기존 respawn 동작·테스트가 그대로 통과한다 (`provider-boundary.test.ts`·`session-runtime.test.ts` 기존 케이스 green).
6. **레이어 준수**: 내용 판정은 `features/providers` 순수 함수, 기록은 `features/sessions` 불투명 필드, 조합은 컴포지션 루트(`app/chat-turn.ts`) — feature 교차 import 0 (lint boundaries green).
7. **게이트**: `cd app && npm run lint && npm run typecheck` green + 신규/영향 vitest 스위트 green (DB 로드 스위트의 ABI 환경 실패는 알려진 베이스라인으로 분리 보고).

## 범위 / 비범위

- **범위**: spawn 시점 providerSettings 기록(SessionRuntime) + 내용 변경 판정 순수 함수(features/providers) + chat-turn respawn 조건 확장 + 단위 테스트 + `runtime-ipc.md` §1.3 한 줄.
- **비범위**:
  - busy 세션(진행 턴) 중 settings 변경 — 0118/0119 와 동일하게 턴 경계(다음 유휴 send) 적용.
  - fs.watch 도입 — mtime-on-send 정책 유지 (bootstrap.ts:83 의도 보존).
  - orca.json 앱 전역 env(`buildTurnEnv`) 변경 감지 — provider settings 와 별개 축, 필요 시 후속 핸드오프.
  - 버그개요의 "모델 자기 보고" 증상 — 코드 결함 아님(에이전트 자기 보고는 spawn-바운드 system prompt). 실기 판정 절차만 verify 에 기록.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈 재사용: `SessionRuntime.teardownChannel()`(0118 public 승격), `crossesProviderBoundary`(0118), `takeForRespawn` 이월, `ProviderSettingsService.resolve` mtime 캐시, SDK `resume`.
- 전제: resolve 캐시가 미변경 파일에 동일 객체 참조를 돌려준다(`provider-settings.ts:109-115`) — 상시 경로 비용은 참조 비교 1회. 내용 비교(JSON.stringify)는 blob 이 바뀐 턴에만 발생하며 settings.json 은 소형(KB 단위).
- `JSON.parse` 는 동일 파일 내용에 동일 키 순서를 재현하므로 `JSON.stringify` 내용 비교는 결정론적. 키 순서만 바꾼 편집은 내용 변경으로 오탐되지만 respawn 은 resume 무손실이라 비용이 낮다(0118 "오탐 비용 낮은 방향" 결정과 동일).
- **신규 의존성**: 없음.

## 설계

- **기록은 sessions(불투명), 판정은 providers(순수), 조합은 컴포지션 루트** — 0118 구조 그대로 확장, 0016 중립 유지.
  - `features/sessions/session-runtime.ts`: private `spawnedSettings?: ResolvedProviderSettings` + public getter `spawnedProviderSettings`. 콜드 스폰 성공 직후(`this.live = spawned` 시점) `req.providerSettings` 를 기록, `teardownChannel()`/`finishPump()` 에서 해제. sessions 는 blob 을 **해석하지 않는다**(불투명 기록만 — 0016).
  - `features/providers/provider-boundary.ts` (확장): 순수 판정 `providerSettingsChangedSinceSpawn(spawned, resolved)` — 어느 한쪽 null/undefined 는 보수적 false, 동일 참조 fast-path, 그 외 `JSON.stringify(settings)` 내용 비교. `provider-settings.ts` 배럴에 re-export.
  - `app/chat-turn.ts`: 0118 조건을 `crossesProviderBoundary(...) || providerSettingsChangedSinceSpawn(runtime.spawnedProviderSettings, resolved.providerSettings)` 로 확장 — teardown → `channelAlive=false` → 기존 `takeForRespawn` 프렐류드 이월이 코드 추가 없이 동작.
- **왜 지문(해시/mtime)이 아니라 blob 기록·내용 비교인가**: (a) mtime 은 deploy 재기록·touch 오탐이 있고 resolve 계약(`ResolvedProviderSettings`)에 노출되어 있지 않다 — 계약 확장 없이 기존 blob 로 판정 가능. (b) 해시 사전 계산은 매 스폰 비용인 반면, 참조 fast-path 는 미변경 상시 경로를 O(1)로 만든다. (c) invalidateAll 후 재파싱된 동일 내용도 false 로 정확 판정(불필요 respawn 없음).
- **왜 판정을 resolve 서비스에 넣지 않는가**: resolve 는 "현재 파일 상태" 만 아는 계층 — "채널이 무엇으로 스폰됐는가" 는 런타임 수명 상태다. 스폰 상태의 소유자는 SessionRuntime 이고, 두 상태의 조합 판정은 이미 모든 입력을 가진 컴포지션 루트가 한다(0118 동일 논거).
- 레이어 경계: `app → features/{providers,sessions}` 하향, `features/sessions → adapters`(타입) 하향 — 교차 import 없음.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **대화 연속성**: respawn 은 SDK `resume` 무손실 — 사용자 관점 변화는 다음 응답의 스폰 지연뿐(0118 동일).
- **토큰 로테이션(본 버그 시나리오)**: 세션 유지 중 settings.json 의 토큰/URL 수정 → 다음 유휴 send 에서 자동 respawn + 새 값 적용. 앱 재시작/provider 왕복 불요.
- **busy 중 수정**: 진행 턴은 낡은 env 로 완주(중단 없음), 다음 유휴 send 부터 적용 — 비범위 명시.
- **해석 실패 창**: settings 재해석 실패(undefined) 턴은 보수적 재사용(채널 유지) — 다음 성공 해석 턴에서 내용 비교가 재개된다. spawn 기록을 실패로 덮지 않으므로 이중 열화 없음.
- **oneshot/mock 어댑터**: 매 턴 fresh spawn 이라 기록은 무해하게 갱신되고 판정은 channelAlive=false 로 도달하지 않는다.
- **연속 편집**(파일을 여러 번 수정): 매 유휴 send 가 최신 내용으로 1회 respawn — 왕복 오버헤드 없음.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| JSON.stringify 비교 비용(스폰 blob vs 해석 blob) | 상시 경로는 캐시 동일 참조 fast-path 로 0 비용 — stringify 는 blob 객체가 실제로 갈린 턴(파일 재파싱·invalidateAll 직후)에만 발생, settings.json 은 KB 단위 |
| 키 순서만 바꾼 편집의 오탐 respawn | resume 무손실이라 비용 낮음(0118 동일 결정). 정렬-직렬화 도입은 상시 비용 > 이득으로 기각 |
| spawn 기록과 실주입의 불일치 가능성(스폰 실패 후 기록 잔존 등) | 기록은 `sendMessage` 성공 후에만 갱신, teardown/채널 사망 시 해제 — channelAlive=true 인 동안만 판정에 쓰이므로 불일치 창 없음 |
| 렌더러 0119 steer 게이트는 providerKey 경계만 알고 settings 내용 변경은 모름 | busy 중 settings 편집은 UI 조작이 아닌 파일 편집이라 steer 게이트 대상 아님 — held 메시지는 다음 유휴 send 의 이월 경로에서 새 env 로 처리됨 |

- 되돌리기 어려운 결정: 없음 (모두 가역적 코드 변경).
- 단독 결정 금지 항목: 없음 (Open Question 무관, 신규 의존성 없음).

## 영향 받는 파일

- `app/src/main/features/providers/provider-boundary.ts` (+`provider-boundary.test.ts`) — 내용 판정 추가
- `app/src/main/features/providers/provider-settings.ts` (배럴 re-export 1줄)
- `app/src/main/features/sessions/session-runtime.ts` (+`session-runtime.test.ts`) — spawn 기록 필드
- `app/src/main/app/chat-turn.ts` (respawn 조건 확장)
- `docs/arch/backend/runtime-ipc.md` (§1.3 한 줄)
- `docs/handoff/INDEX.md` · 본 plan/verify

## 참고 문서

- `@docs/handoff/0118-provider-boundary-respawn/` (본 작업이 확장하는 경계 respawn 원 설계)
- `@docs/handoff/0016-provider-neutral-core/` (sessions 레이어 provider-중립 제약)
- `docs/arch/backend/runtime-ipc.md` §1.3 (장수명 채널·콜드 패스·이월)
- `docs/TRD.md` §6.8 (provider settings 트리·주입 2층)
- IPC 변경: 없음 (`IPC_CONTRACT.md` 무영향 — 채널·페이로드 불변)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: 순수 판정(`provider-boundary.test.ts` 4케이스+) + SessionRuntime spawn 기록 수명(`session-runtime.test.ts` 2건) — 모두 비-DB(ABI 중립).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구(버그리포트 검토 요청)를 인용했고, 갭 수정 결정·증상 해석은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 `파일:라인`/`@docs` 레퍼런스를 붙였다.
- [x] 인수 기준 — 번호 7건, 자료조사 근거, 단위 테스트/게이트로 검증 가능.
- [x] 의존 기술 — 재사용 모듈·캐시 참조 전제 식별, 신규 의존성 없음.
- [x] 파생 UX — 연속성/로테이션/busy/해석 실패/oneshot/연속 편집 엣지를 펼쳤다.
- [x] 리스크 — 비교 비용·오탐·기록 불일치·0119 게이트 상호작용과 완화책을 적었다.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 기록(sessions 불투명)·판정(providers 순수)·조합(컴포지션 루트) 3분할, blob 내용 비교 + 참조 fast-path, 0118 조건 확장 방식 모두 최소 변경으로 타당. 설계 그대로 구현했다.
- 이견 / 우려: 없음. 설계 §"왜 지문이 아니라 blob 기록인가" 의 (c)(invalidateAll 후 동일 내용 무 respawn)는 테스트로 고정했다(provider-boundary.test.ts "재파싱된 동일 내용" 케이스).

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 0118 조건은 `sessionId && crosses && channelAlive` 순서였는데 판정 2종 확장 시 `channelAlive` 를 괄호 밖 공통 가드로 승격해야 settings 판정도 죽은 채널에서 불필요하게 돌지 않는다 | ✅ `sessionId && channelAlive && (crosses ‖ settingsChanged)` 로 재배열(동작 동일·판정 비용 절감) | 구현 세부 — 설계 의도 불변 |

## [구현자 기입] 구현 체크리스트

- [x] `providerSettingsChangedSinceSpawn` 순수 함수 + 배럴 re-export
- [x] `SessionRuntime` spawn 기록(`spawnedProviderSettings` getter, 스폰 갱신·teardown/finishPump 해제)
- [x] chat-turn respawn 조건 확장 (0118 조건 ‖ 0125 판정)
- [x] 테스트 7건 (판정 4케이스 + 기록 수명 3건)
- [x] `runtime-ipc.md` §1.3 한 줄
- [x] 게이트 (lint/typecheck/vitest 전체)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `provider-boundary.ts`·`provider-boundary.test.ts`·`provider-settings.ts`·`session-runtime.ts`·`session-runtime.test.ts`·`chat-turn.ts`·`runtime-ipc.md` |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm rebuild better-sqlite3`(Node ABI 소스 컴파일) 후 `./node_modules/.bin/vitest run` + `node --test scripts/*.test.mjs` |
| 게이트 결과 | lint ✅ 에러 0(기존 warning 1) / typecheck 3분할 ✅ / vitest ✅ **1009/1009**(파일 130/131 — `chat-turn.continuity` 1파일 로드 실패는 electron 바이너리 egress 베이스라인, 0124 동일) / scripts ✅ 25 pass |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (커밋 후 INDEX 에 기재) |
