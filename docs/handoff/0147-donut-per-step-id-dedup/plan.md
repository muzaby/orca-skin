# Plan — 0147-donut-per-step-id-dedup

## 메타

| 항목 | 값 |
|---|---|
| slug | `0147-donut-per-step-id-dedup` |
| 작성자 | Claude Code |
| 일자 | 2026-07-23 |
| 매핑 | PHASES / PR (요청 시) |
| 상태 | DRAFT → READY → IMPL_DONE → verify |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | ① 컨텍스트 도넛 패널이 렌더링되지 않는 버그를 고쳐라. ② **"last assistant 로 추적하지 말라 — 멀티스텝에서는 동일 `id` 의 usage 가 반복되니 `id` 로 중복 제거하라."** | 라이브 세션 요청 + 첨부 가이드 `code.claude.com/docs/ko/agent-sdk/cost-tracking#track-per-step-and-per-model-usage` |
| 추론 의도 | 컨텍스트(윈도우 점유)는 **시점 스냅샷**이라 스텝 합산이 아니라 "마지막 distinct 스텝"을 취한다(합산은 물리적 오류·>100% 유발). *추론* — 사용자는 dedup 을 지시했고 합산은 지시하지 않음. | 업로드 가이드 §1 "컨텍스트는 누적이 아니다" |

## Context (왜)

도넛/UsagePanel 은 `lastTelemetry` 가 truthy 일 때만 렌더한다(`Composer.tsx:334`·`364`). `lastTelemetry` 는 `contextTokens(telemetry) > 0` 게이트를 통과할 때만 세팅된다(`chatReducer.ts:448`). 매퍼가 `result` telemetry 의 컨텍스트 3종을 마지막 assistant usage 스냅샷으로 덮는데(`claude-map.ts`), 이 스냅샷이 **전부 0** 이면 telemetry 컨텍스트가 0 → 게이트 스킵 → `lastTelemetry` 미설정 → **도넛 미렌더**.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 병렬 도구 스텝은 **동일 message `id`** 의 assistant 를 여러 개 내고 같은 usage 를 공유. 일부 메시지가 0/부분 usage. **`id` 로 중복 제거**하라. | 외부 `code.claude.com/docs/ko/agent-sdk/cost-tracking#track-per-step-and-per-model-usage` |
| 현행 캡처는 매 assistant 메시지로 스냅샷을 덮음(id-dedup·child 가드 없음). | `app/src/main/adapters/claude-map.ts:281-295`(수정 전) |
| 서브에이전트 child 는 `parent_tool_use_id` 로 식별. child usage 는 격리 컨텍스트(가이드 §서브에이전트: top-level usage 는 서브에이전트 제외). | `claude-map.ts:262`(readParentToolRunId) · 가이드 표 |
| `ctx` 는 `events(req)` 당 1회 생성 = 턴 스코프 → dedup Set 이 턴마다 리셋. | `app/src/main/adapters/claude.ts:281` |
| 도넛 분모(contextWindow)는 이미 `result.modelUsage[primary]` 에서 옴(last-assistant 아님). 이번 수정은 **분자**만. | `app/src/renderer/src/features/chat/lib/contextWindow.ts:35-43`(0141) |
| child 스냅샷 가드는 0139 에서 "비범위"로 연기된 항목. | `docs/handoff/INDEX.md:23` (0139 비고 "분자 스냅샷 child 가드") |

## 인수 기준 (Acceptance Criteria)

1. 컨텍스트 스냅샷 캡처가 **per-step id 중복 제거**를 한다: distinct `message.id` 의 **첫 양(+)-컨텍스트 판독만** 캡처하고 같은 id 의 뒤따르는 0/중복 usage 는 스킵한다.
2. **서브에이전트 child**(`parent_tool_use_id` 有)의 usage 는 스냅샷을 오염시키지 않는다.
3. 컨텍스트 3종(input+cacheRead+cacheCreation)이 **전부 0/부재**인 판독은 스냅샷을 갱신하지 않아 실측 `result.usage` 를 0 으로 덮지 않는다(도넛 미렌더 방지).
4. `lastStepUsage` = 그 턴 **마지막 distinct 메인 스텝**의 컨텍스트(스텝 합산 아님).
5. 필드명 `lastAssistantUsage` → `lastStepUsage` 리네임(“last assistant” 오해 제거). 기존 override/compact-delete/테스트 참조 동반 수정.
6. 게이트 통과: lint 0 error / typecheck 3분할 0 / `claude-map.test.ts` 그린(신규 4 케이스 포함).

## 범위 / 비범위

- **범위**: `claude-map.ts` 매퍼의 컨텍스트 스냅샷 캡처 로직 + 테스트.
- **비범위**: reducer 게이트(`contextTokens>0` 유지 — 올바른 방어)·override 사이트(무변경)·비용 누적(이미 정상)·컨텍스트 스텝 합산(물리적 오류라 미채택).

## 의존 기술 / 전제

- 기존 유틸 재사용: `assignNums`(num 가드 대입)·`readParentToolRunId`(child 판정). 신규 의존성 **없음**.
- 전제: `message.message.id` 존재(SDK BetaMessage). 부재 시 `stepId===undefined` → dedup 없이 현행 동작(무회귀).

## 설계

`claude-map.ts` assistant 처리부:
- `MapContext.lastAssistantUsage` → `lastStepUsage` 리네임 + `capturedStepIds?: Set<string>`(지연 초기화, 턴 스코프) 추가.
- 캡처 조건에 `parentToolRunId === undefined`(child 제외) + `(stepId === undefined || !capturedStepIds.has(stepId))`(id-dedup) 추가.
- 스냅샷 후 `contextSignal = input+cacheRead+cacheCreation > 0` 일 때만 `lastStepUsage` 세팅 + `capturedStepIds.add(stepId)`.
- 마지막 distinct 스텝이 이기도록 새 id 마다 덮어씀. override(435)·reducer(448) 무변경.

## 파생 UX / 엣지케이스

- 멀티스텝/병렬 도구 턴: 동일 id 반복 → 첫 판독 유지(도넛 안정).
- 서브에이전트 턴: child usage 무시 → 도넛이 메인 컨텍스트 추종.
- compact/handoff 경계: 기존 가드 유지(무회귀).
- `message.id` 부재(구 mock/테스트): 현행 동작 폴백.

## 리스크 / 트레이드오프

| 리스크 | 완화책 / 결정 |
|---|---|
| 컨텍스트를 "마지막 distinct 스텝"으로 정의(가이드 per-step 예제는 합산) | 컨텍스트=시점 점유라 합산은 오류(가이드 §1). plan 에 가정 명시, 사용자 확인 완료(합산 미지시). |
| `message.id` 부재 시 dedup 무력 | 폴백=현행 동작(무회귀). 실 SDK 는 항상 id 제공. |

---

## [구현자 기입] (Claude 직접 구현)

### 변경 파일
- `app/src/main/adapters/claude-map.ts` — `MapContext` 리네임(`lastStepUsage`)+`capturedStepIds` 추가, 캡처 블록에 child 가드·id-dedup·contextSignal 가드, compact-delete/override 참조 갱신.
- `app/src/main/adapters/claude-map.test.ts` — 리네임 참조 2건 갱신 + 신규 4 케이스(동일 id 뒤 0 usage / distinct 스텝 진행 / child 무오염 / 전부-0 메인).

### 실행 명령 · 게이트 결과
- `./node_modules/.bin/vitest run src/main/adapters/claude-map.test.ts` → **58 passed** (54 기존 + 4 신규).
- `npm run lint` → **0 error** (1 pre-existing warning: TanStack Virtual, 무관).
- `npm run typecheck` → node/web/test **3분할 0 error**.
- 설치: egress 차단으로 electron ABI postinstall 실패(베이스라인) — 순수 vitest·lint·typecheck 는 정상. DB/electron 실기는 CI/사람 몫.

### 설계 리뷰 / 놓친 잠재 문제
- 없음. override·reducer 무변경으로 폭발 반경 최소. `contextSignal` 가드는 child/dedup 과 독립적인 belt-and-suspenders.
