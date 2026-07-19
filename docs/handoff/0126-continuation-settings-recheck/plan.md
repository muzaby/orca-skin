# Plan — 0126-continuation-settings-recheck

## 메타

| 항목 | 값 |
|---|---|
| slug | `0126-continuation-settings-recheck` |
| 작성자 | Claude Code |
| 일자 | 2026-07-19 |
| 매핑 | Phase 4 (버그수정 — 비기능 = Claude 직접 구현) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "provider 경계 내외의 상황에서 steer, queue 메시지 입력 시 어떻게 동작하는지 검토하라 — provider 내/외 사례에서 steer·queue 사례를 정확히 가정하여 검토해야 한다" (환경: bedrock + 폐쇄망 2 provider, 각 settings.json 에 base URL/token) | 라이브 세션 요청 (2026-07-19, 0125 후속) |
| 추론 의도 | 검토 결과 갭 2건 확인 — ① 자동 연속 턴(턴 종료 후 held 잔여 소비)이 provider settings 재해석 없이 원 턴의 stale blob 으로 respawn ② busy send 의 provider 경계 가드가 렌더러 전용(main 백스톱 부재). 검토 승인과 함께 수정까지 진행 (추론 — 검토 plan 의 권고 수정을 사용자가 승인) | 검토 plan 승인 (라이브 세션) |

## Context (왜)

0125 는 *유휴 send* 경로에 settings 내용 변경 판정을 넣었지만, **자동 연속 턴**(0067 AC7 — 턴 종료 시 held 잔여를 사용자 개입 없이 잇는 루프)은 `contRequest = { ...request }` 스프레드로 원 턴 해석본을 그대로 재사용한다. 특히 채널-사망 분기는 `takeForRespawn` 으로 **새로 스폰하면서도 stale settings 를 주입** — busy 턴 중 토큰이 로테이션된 경우(폐쇄망 운영 시나리오) 연속 턴이 만료 토큰으로 respawn 해 실패한다. 또한 busy send 의 provider 경계 가드(0119)는 렌더러 2곳뿐이라, 레이스로 main 에 도달한 cross-provider busy send 는 `reserveOnBusySession` 이 payload `providerKey` 를 읽지 않고 드랍해 **선택과 다른 provider 로 무경고 실행**된다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 자동 연속 루프는 `contRequest = { ...request, … }` — 원 턴의 `providerSettings`/`env`/`model` 재사용, `resolveTurnProvider`·0125 판정·`teardownChannel` 재실행 없음 | 코드 `app/src/main/app/chat-turn.ts:697-733` (계승 스프레드 :715-716) |
| 채널-사망 분기(`takeForRespawn`)는 새 스폰인데 stale blob 주입 — 0125 가 유휴 경로에 넣은 판정(`chat-turn.ts:486-496`)의 누락 대칭 | 코드 `app/src/main/app/chat-turn.ts:705-709,715-724` |
| held 페이로드는 `{text, 첨부}` 만 — provider/model 미보유(큐는 provider-무지). 연속 턴의 provider 는 원 턴 계승이 의미상 옳다("선택은 다음 사용자 send 부터", 0119) | 코드 `app/src/main/features/chat/pending-message-queue.ts:8-19`, `chat-turn.ts:745-763`(`makeContinuationTurn` 이 `prev.providerKey` 복사) |
| `reserveOnBusySession` 은 `canSteer` 만 검사 — payload `providerKey` 미참조(드랍), 경계 검사 없음. 0119 가드는 렌더러 2곳(`Composer.submit`·`chatStore.send`)뿐 | 코드 `app/src/main/app/chat-turn.ts:213-271,303-306`, `app/src/renderer/src/features/chat/lib/steerGate.ts:5-16` |
| 진행 턴의 provider 는 `turn.providerKey`(턴 생성 시 `resolved.providerKey` 로 설정)로 main 이 이미 보유 — 백스톱 비교 입력 완비 | 코드 `app/src/main/app/chat-turn.ts:424`, `contracts/turn.ts:14` |
| 재사용 프리미티브 완비: `providerSettingsChangedSinceSpawn`(0125)·`SessionRuntime.spawnedProviderSettings`(0125)·`teardownChannel`(0118)·`crossesProviderBoundary`(0118)·`takeForRespawn`(0067) — 신규 구조물 불요 | 코드 `features/providers/provider-boundary.ts:6-27`, `features/sessions/session-runtime.ts:122,314` |
| `resolveTurnProvider` 재호출 비용 = provider 열거 캐시 + settings mtime 캐시(미변경 시 stat 1회) — 연속 턴당 수용 가능 | 코드 `features/providers/provider-settings.ts:75-81,104-115` |
| main 측 admission 거부의 기존 관례: `sendChatEvent(error)` + `provider_connection_error`/retryable (새-채팅 race 가드·handoff mid-turn 가드 동형) | 코드 `app/src/main/app/chat-turn.ts:308-318,352-362` |

## 인수 기준 (Acceptance Criteria)

1. **연속 턴 settings 재해석**: 자동 연속 루프 각 반복이 `resolveTurnProvider` 를 **원 턴 providerKey 고정**으로 재호출하고, `contRequest.providerSettings` 에 신선한 해석본을 싣는다(해석 실패 시 원본 유지 — 보수적).
2. **연속 턴 respawn 판정**: 채널 생존 + spawn 주입본 대비 내용 변경이면 `teardownChannel()` — 기존 채널-사망 분기(`takeForRespawn` 이월)로 자연 진입해 신선한 blob 으로 respawn 된다.
3. **의미론 불변**: 연속 턴의 provider(경계)·model 은 원 턴 계승 그대로 — 경계 재판정·모델 갱신을 하지 않는다(0119 "선택은 다음 사용자 send 부터" 보존). `crossesProviderBoundary` 를 연속 루프에서 호출하지 않는 것으로 확인.
4. **busy send 백스톱**: `reserveOnBusySession` 이 payload `providerKey` 를 받아 진행 턴 `turn.providerKey` 와 `crossesProviderBoundary` 로 비교 — 경계면 held 미적재 + error 이벤트 회신(기존 admission 거부 관례 동형). null(미지정) 은 보수적 허용(기존 동작 불변).
5. **기존 경로 무회귀**: 유휴 send 의 0118/0125 판정·게이트 flush(steer)·취소 경로 코드 불변, 기존 테스트 전체 green.
6. **게이트**: `cd app && npm run lint && npm run typecheck` green + vitest 전체 green (electron egress 베이스라인 1파일 로드 실패 분리 보고).

## 범위 / 비범위

- **범위**: `chat-turn.ts` 연속 루프 재판정 + `reserveOnBusySession` 백스톱 + `runtime-ipc.md` §1.3 한 줄.
- **비범위**:
  - 검토 §비고 I-4(경계 respawn 시 이월 프렐류드가 새 provider 로 처리되는 의미론) — 유실 방지 우선 설계 유지, 코드 변경 없음(설계 확인 사항).
  - 연속 턴의 모델/경계 갱신 — 의미론 변경이라 비범위(AC#3 이 불변을 요구).
  - 렌더러 변경 — 0119 가드 유지, 백스톱 거부 시 기존 error 이벤트 표시 경로 재사용.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 재사용: `resolveTurnProvider`·`providerSettingsChangedSinceSpawn`·`spawnedProviderSettings`·`teardownChannel`·`crossesProviderBoundary`·`takeForRespawn` — 전부 기존.
- 전제: 연속 루프 시점의 `activeTurn.providerKey` 는 원 턴 해석 키(:424 설정, `makeContinuationTurn` 계승) — 키 고정 재해석의 입력으로 유효.
- **신규 의존성**: 없음.

## 설계

- **수정 1 (연속 턴, 갭 1)** — 루프 서두(pending 확인 후, `channelAlive` 분기 전):
  1. `contResolved = await resolveTurnProvider(ctx, { adapter, sessionId, providerKey: activeTurn.providerKey, modelFamily: null })` — 키 고정이라 경계를 넘지 않고 settings 만 신선화.
  2. `runtime.channelAlive && providerSettingsChangedSinceSpawn(runtime.spawnedProviderSettings, contResolved.providerSettings)` → `runtime.teardownChannel()` — 0125 유휴 경로와 동일 패턴, 직후의 `channelAlive` 분기가 자연히 `takeForRespawn` 콜드 패스로 전환.
  3. `contRequest` 에 `...(contResolved.providerSettings ? { providerSettings: contResolved.providerSettings } : {})` override — respawn 이 신선한 blob 으로 스폰. 해석 실패(undefined)면 원본 유지(보수적, 0125 null 의미론). `model` 은 `...request` 의 원 모델 유지.
- **수정 2 (busy 백스톱, 갭 2)** — `reserveOnBusySession` 파라미터 타입에 `providerKey?: string | null` 추가(호출부는 이미 `parsed.data` 전체 전달). `canSteer` 검사 통과 직후 `crossesProviderBoundary(turn.providerKey, data.providerKey ?? null)` → 참이면 `provider_connection_error`(retryable) error 이벤트 회신 후 return(held 미적재). null 보수적 false 는 함수 자체가 보장.
- 레이어: 전부 컴포지션 루트(`app/chat-turn.ts`) 내 배선 — 경계 변화 없음, IPC/DB/렌더러 무변경.
- **왜 백스톱을 거부(reject)로 하는가**: 조용히 원 provider 로 실행(현행)은 사용자 선택과 불일치를 은폐한다. 렌더러 가드 정상 시 도달 불가한 경로라 거부가 안전하고, 거부 시 draft 는 렌더러 send 성공 시에만 지워지므로 IPC-후 거부에도 error 표시로 드러난다.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **연속 턴 respawn**: 사용자 관점 변화는 연속 응답의 스폰 지연뿐(resume 무손실). 재판정 비용은 mtime 캐시로 미변경 시 stat 1회.
- **연속 루프 중 해석 실패**: `contResolved.providerSettings` undefined → 판정 no-op + 원본 blob 유지 — 이중 열화 없음(0125 동일).
- **연속 루프 다회전**: 매 반복 재해석 — 반복 사이 파일이 또 바뀌어도 각 반복이 최신을 본다.
- **백스톱 발동 시**: held 미적재이므로 message.queued 미발행 — 렌더러는 error 이벤트만 표시. 정상 경로에선 렌더러 가드(0119)가 먼저 막아 도달하지 않는다.
- **mock/oneshot 어댑터**: 연속 루프 자체가 held 잔여(steer 지원) 전제라 실질 claude 한정 — mock 은 `canSteer` 게이트에서 이미 배제.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 연속 루프에 await 재해석 추가 — 루프 지연 | mtime 캐시 히트 시 stat 1회 수준. 연속 턴 자체가 스폰/모델 왕복 대비 저빈도 |
| 재해석이 원 턴과 다른 provider 를 해석할 가능성(세션 provider_key 변동) | providerKey 를 `activeTurn.providerKey` 로 **고정** 전달 — 폴백 경로(세션 키/기본 provider)는 원 키가 entries 에서 사라진 경우(삭제)만 타며, 그 경우도 settings 비교는 null-보수적 |
| 백스톱 오탐(정상 same-provider 예약 거부) | `crossesProviderBoundary` 는 결정론적 전체 키 비교 + null 보수적 false — 렌더러가 providerKey 를 안 실은 기존 흐름은 동작 불변 |
| chat-turn 배선은 단위 테스트 불가(electron import) | 판정/비교는 전부 기존 테스트된 순수 함수 재사용 — 배선 검증은 실기 항목으로 명시(0118/0125 선례) |

- 되돌리기 어려운 결정: 없음.
- 단독 결정 금지 항목: 없음.

## 영향 받는 파일

- `app/src/main/app/chat-turn.ts` — 연속 루프 재판정 + `reserveOnBusySession` 백스톱
- `docs/arch/backend/runtime-ipc.md` — §1.3 한 줄
- `docs/handoff/INDEX.md` · `docs/PHASES.md` · 본 plan/verify

## 참고 문서

- `@docs/handoff/0125-settings-change-respawn/` (유휴 경로 settings 판정 — 본 작업이 연속 턴으로 확장)
- `@docs/handoff/0118-provider-boundary-respawn/` · `@docs/handoff/0119-busy-steer-provider-gate/` (경계 respawn·steer 가드 원 설계)
- `@docs/handoff/0067-long-lived-session-queue/` (자동 연속 턴·pending queue 원 설계)
- `docs/arch/backend/runtime-ipc.md` §1.3-1.4
- IPC 변경: 없음 (`IPC_CONTRACT.md` 무영향 — 채널·페이로드 스키마 불변, `providerKey` 는 기존 send 페이로드 필드)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: 없음(기존 순수 함수 재사용 — provider-boundary/session-runtime 기존 스위트가 판정·기록을 커버). 배선은 실기 항목.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 검토 요청 원문 인용, 수정 진행은 검토 plan 승인 근거로 표기.
- [x] 자료조사 — 전 발견에 `파일:라인` 레퍼런스.
- [x] 인수 기준 — 번호 6건, 검증 가능.
- [x] 의존 기술 — 전부 기존 프리미티브, 신규 의존성 0.
- [x] 파생 UX — respawn 지연·해석 실패·다회전·백스톱 발동·mock 엣지 전개.
- [x] 리스크 — 루프 비용·재해석 드리프트·오탐·테스트 불가 배선과 완화책 기록.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 재해석 키 고정(의미론 보존)·teardown 후 기존 분기 자연 전환·백스톱 거부 관례(admission 거부 동형) 모두 설계대로 구현. 설계 §설계 의 배치(재판정을 `channelAlive` 분기 *앞*)가 핵심 — teardown 이 곧바로 `takeForRespawn` 분기를 활성화한다.
- 이견 / 우려: 없음.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 백스톱의 `turn` null-내로잉 — `!turn?.live?.canSteer` early-return 이후라 TS 가 `turn` 을 non-null 로 좁혀 추가 가드 불요 | ✅ 확인만(코드 변화 없음) | 구현 세부 |

## [구현자 기입] 구현 체크리스트

- [x] 연속 루프 재해석(`resolveTurnProvider` 키 고정) + 0125 판정 + teardown
- [x] `contRequest` 신선 blob override(해석 실패 시 원본 유지)
- [x] `reserveOnBusySession` providerKey 파라미터 + `crossesProviderBoundary` 백스톱 거부
- [x] `runtime-ipc.md` §1.3 한 줄
- [x] 게이트 (lint/typecheck/vitest 전체)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/app/chat-turn.ts` · `docs/arch/backend/runtime-ipc.md` |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `./node_modules/.bin/vitest run` + `node --test scripts/*.test.mjs` |
| 게이트 결과 | lint ✅ 에러 0(기존 warning 1) / typecheck 3분할 ✅ / vitest ✅ **1009/1009**(`chat-turn.continuity` 1파일 로드 실패 = electron egress 베이스라인) / scripts ✅ 25 pass |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `9abeadd` |
