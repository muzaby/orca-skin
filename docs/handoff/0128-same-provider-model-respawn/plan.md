# Plan — 0128-same-provider-model-respawn

## 메타

| 항목 | 값 |
|---|---|
| slug | `0128-same-provider-model-respawn` (구 `0128-turn-completed-model`) |
| 작성자 | Claude Code |
| 일자 | 2026-07-20 |
| 매핑 | PHASES 행 (승격 예정) |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "모델 변경(sonnet→haiku) 후 답변은 haiku 인데 로그는 sonnet. 검토하라" | 라이브 세션 요청 |
| 명시 요구 | 실기 3회 로그 제공 + "사용량은 반영, 로그만 그런 듯" | 라이브 세션 |
| 명시 요구 (방향) | 진단 결과 제시 후 "**respawn 기능 수정**" 선택 | 라이브 세션 AskUserQuestion |
| 추론 의도 | 사용자가 haiku 로 바꾸면 **실제로 haiku 로 생성**되길 원한다(로그 정합은 부수 결과) | 진단으로 확증 |

## Context (왜)

사용자가 대화 중 같은 provider 안에서 모델을 sonnet→haiku 로 바꿨다. UI·답변 문구는 haiku 로 보이나, **실제 추론은 sonnet 으로 계속 생성**된다. 진단 로그가 이를 확증했다(아래). 로그의 sonnet 은 오히려 진실이었고, 진짜 결함은 **같은 provider 모델 변경이 실제 생성 모델을 바꾸지 못하는 것**이다.

## 자료조사 (Research)

> **설계 전환(pivot)**: 최초 가설(로그/telemetry 오기록)은 실기 데이터로 반증됐다. 아래는 확정 근거.

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 진단 로그: "haiku 전환" 턴의 `message.model = claude-sonnet-5`(실제 생성 모델) | 라이브 세션 `claude.turn.model.debug` (turnModel=sonnet) |
| 진단: `result.modelUsage` 키 = `[haiku, sonnet]` **다중키 누적** (최초 "단일키" 가정 반증) | 라이브 세션 telemetry payload |
| 비용 증거: "haiku 턴"에 **sonnet 누적만 증가**(0.049658→0.073860), **haiku 불변**(0.000594) = 이 턴은 sonnet 과금 | 라이브 세션 telemetry 2턴 대조 |
| fresh spawn 은 `options.model` 을 지킨다(turn 1 sonnet 스폰→sonnet 생성) | 라이브 세션 turn 1 (`engine.spawn.started` + sonnet) |
| 라이브 `pushTurn` 은 `setModel` 을 prompt push **전에 await** 하는데도 생성이 안 바뀜 = 순서 문제 아님 | `app/src/main/adapters/claude.ts:453-461` |
| respawn(teardownChannel)은 **provider 경계(0118)·settings 변경(0125)** 에서만 발동, **같은 provider 모델 변경은 미발동** | `app/src/main/app/chat-turn.ts:518-528` |
| respawn 후 다음 send 는 spawn(resume) 콜드 패스 = 새 `options.model` 주입 + 이월(takeForRespawn) 배선 재사용 | `app/src/main/app/chat-turn.ts:513-538` · `session-runtime.ts:184-205` |
| 연속 턴(0067 AC7)은 원 턴 model 계승(0119/0126 — "선택은 다음 사용자 send 부터") → 모델 respawn 대상 아님 | `app/src/main/app/chat-turn.ts:728-752` |
| spawn-바운드 기록 수명 패턴(0125 `spawnedProviderSettings`): 콜드 스폰 기록·pushTurn 불변·teardown/사망 해제 | `session-runtime.ts:100-124,197-198,318,344` |

## 인수 기준 (Acceptance Criteria)

1. `SessionRuntime` 이 spawn 시점 model 을 기록(`spawnedModel` getter) — 콜드 스폰에서 `req.model` 기록, `teardownChannel()`·스트림 사망(`finishPump`)에서 해제, pushTurn 후속 턴은 기록 불변.
2. `chat-turn` 의 **메인 턴** respawn 조건에 `resolved.model !== runtime.spawnedModel` 추가 → 같은 provider 라도 모델이 스폰 시점과 다르면 `teardownChannel()`.
3. **연속 턴(0067 AC7)** respawn 조건은 무변경 — 원 턴 model 계승(0119/0126) 유지.
4. 기존 respawn 트리거(provider 경계·settings 변경)·이월(takeForRespawn) 배선 무회귀.
5. 신규 단위 테스트 3종(spawnedModel 수명) 통과.
6. 게이트: lint 0 error · typecheck(변경 파일) 0 · 레이어 경계 0 · 신규 의존성 0 · IPC/DB 무변경.

## 범위 / 비범위

- **범위**: 같은 provider 모델 변경 시 채널 respawn(콜드 spawn 이 새 model 로 생성). `SessionRuntime.spawnedModel` 기록 + `chat-turn` 메인 턴 조건 1줄.
- **비범위**:
  - 라이브 `/model`(setModel) 자체를 실제 전환되게 고치기 — SDK/CLI 스트리밍 세션 동작(범위 밖, respawn 로 우회).
  - 연속 턴 중 모델 전환(0119/0126 의도 유지 — 다음 사용자 send 부터).
  - 로그/telemetry.model·비용 원장 라벨 정정(최초 접근) — 폐기. respawn 되면 자연 정합.

## 의존 기술 / 전제

- 기존 respawn 아키텍처(0118 teardownChannel·takeForRespawn 이월) 재사용. 신규 의존성 0.
- 전제: fresh spawn(resume 콜드 패스)이 `options.model` 을 실제 생성에 반영한다(turn 1 실측). 라이브 setModel 은 못 바꾼다(실측).

## 설계

- **재사용**: `spawnedProviderSettings`(0125) 수명 패턴을 그대로 복제 — 필드 `spawnedModelValue` + getter `spawnedModel`, 3지점(spawn set / finishPump·teardownChannel clear).
- **변경 1** — `session-runtime.ts`: `spawnedModelValue` 필드 + `get spawnedModel()` + spawn(`runAttempt`)에서 `this.spawnedModelValue = req.model`, `finishPump`·`teardownChannel` 에서 `= undefined`.
- **변경 2** — `chat-turn.ts:518` 메인 턴 respawn 조건에 `resolved.model !== runtime.spawnedModel` OR 절 추가(주석 0128).
- 레이어: `features/sessions`(수직 슬라이스) + `app`(컴포지션 루트) — 하향 의존 유지.

## 파생 UX / 엣지케이스

- 첫 턴(channelAlive=false): 조건 short-circuit → 어차피 fresh spawn. 무영향.
- 모델 미지정(SDK 기본): resolved.model·spawnedModel 둘 다 undefined → `!==` false → respawn 안 함. 정상.
- respawn 은 warm 채널을 버리고 resume 콜드 패스 — 대화 컨텍스트는 `--resume` 로 보존(0118 동일). 비용은 한 번의 재-resume.
- 연속 턴: 모델 조건 미적용(원 턴 model 계승) — 사용자가 명시 변경한 다음 send 부터 적용.

## 리스크 / 트레이드오프

| 리스크 | 완화 |
|---|---|
| 모델 바꿀 때마다 warm 채널 상실(resume 비용) | 모델 변경은 저빈도. 정확성 > warm. 0118(provider)·0125(settings) 와 동일 트레이드오프 |
| resolved.model 표현(별칭 'haiku' vs 풀네임)이 턴마다 다르면 오탐 respawn | 양쪽 다 `resolveTurnProvider`→`modelNameForFamily` 단일 경로 산출이라 동일 표현. 스폰본과 동종 비교 |

- 되돌리기 어려운 결정: 없음(조건 1줄 + 기록 필드).

## 영향 받는 파일

- `app/src/main/features/sessions/session-runtime.ts` (spawnedModel 기록)
- `app/src/main/app/chat-turn.ts` (메인 턴 respawn 조건)
- `app/src/main/features/sessions/session-runtime.test.ts` (신규 3종)

## 게이트

- ABI 중립: `cd app && npm run lint && npm run typecheck`.
- 비-DB 스위트: `./node_modules/.bin/vitest run sessions/session-runtime`.
- 신규 테스트 3종: 콜드 스폰 기록+pushTurn 불변 / teardown 해제+respawn 재기록 / finishPump 해제.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 + 방향 선택(respawn) 인용.
- [x] 자료조사 — 진단 데이터·코드 라인 레퍼런스, pivot 근거 명시.
- [x] 인수 기준 — 번호·검증 가능·연속 턴 무변경 명시.
- [x] 의존 기술 — 기존 respawn 재사용, 신규 의존성 0.
- [x] 파생 UX — 첫 턴/기본 모델/연속 턴/컨텍스트 보존 엣지.
- [x] 리스크 — warm 상실·표현 오탐 완화.

---

## [구현자 기입] 구현 보고 (Claude, 비기능)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `session-runtime.ts`(+field/getter/3지점) · `chat-turn.ts`(+1 OR절) · `session-runtime.test.ts`(+3 테스트) |
| 실행 명령 | `./node_modules/.bin/vitest run sessions/session-runtime` · `npm run lint` · `npm run typecheck` |
| 게이트 결과 | lint ✅ 0 error / session-runtime 테스트 ✅ **22/22**(+3) / 변경 파일 typecheck ✅ 0 error |
| 게이트 caveat | `typecheck:node` baseline red 1건 `claude.ts:465`(SDK `interrupt()` 타입 드리프트, `package-lock.json` 세션 시작 시 `M`) — 본 변경 무관(claude.ts diff 0). |
| 폐기분 | 최초 접근(claude-map.ts telemetry.model 정정·재귀속·진단 로그·테스트)은 **전량 revert**(git checkout HEAD). 로그는 원래 정확했음. |
| 블로커 | 없음 |
| 대상 커밋 | (커밋 대기) |

### 설계대로 구현
- 변경 1·2 plan 그대로. 연속 턴 조건(chat-turn.ts:744-752)은 손대지 않음(AC3).
- spawnedModel 수명은 0125 패턴 복제 — 테스트도 0125 블록 미러.

### 실기 검증 포인트(사람)
- 모델 변경 턴에 **`engine.spawn.started`/`engine.spawn.completed` 가 새로 뜬다**(warm 재사용 아님 = respawn 증거).
- 그 턴 생성/비용/`chat.turn.completed` model 이 전부 **haiku** 로 정합.