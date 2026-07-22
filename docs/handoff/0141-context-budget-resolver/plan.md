# Plan — 0141-context-budget-resolver

> 재설계 프로그램 "Context Budget" 의 **핵심 수정(Phase 1+2 통합)**. 비기능(버그수정) = Claude 직접 plan→impl→verify.
> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0141-context-budget-resolver` |
| 작성자 | Claude Code |
| 일자 | 2026-07-22 |
| 매핑 | PHASES "현재 작업 중" · PR #282 |
| 상태 | IMPL_DONE |

## 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "다음은 완벽한 예제코드다. 실측: `query.options.model` 에 `sonnet` **또는** `global.anthropic.claude-sonnet-5` 입력 모두 출력(modelUsage 키·message.model)은 `global.anthropic.claude-sonnet-5`. **이를 기준하여 리팩토링하라.**" + "진단은 건너뛰겠다" | 라이브 세션 (2026-07-22) |
| 함의(사용자 실측) | 입력측 모델(alias/spawnedModel) ≠ SDK 출력 modelUsage 키(해석 ID). **입력 문자열 매칭은 원천 불가.** | 라이브 세션 |

## Context (왜)

컨텍스트 도넛 분모 200k 붕괴 3연속(0134→0139→현재). 0139 는 top-level `contextWindow` 승격을 **`ctx.mainModel`(assistant `message.model`) ↔ `modelUsage` 키 정확 매칭**에 걸었다. 사용자 실측이 그 전제를 깼다: **modelUsage 키는 해석된 ID 이고 입력 모델(alias)과 다를 수 있다** → 매칭 실패 시 미승격 → renderer `contextWindowFor(undefined)`=200k 붕괴. 레퍼런스 예제는 애초에 **입력 모델을 안 보고 `modelUsage[key].contextWindow` 를 직독**한다. 이를 기준으로, 입력 매칭을 전면 폐기하고 **modelUsage 실사용량 최대 엔트리(argmax)**로 primary 를 골라 그 `contextWindow` 를 승격한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 0139 승격이 `modelUsage[mainModel]` 정확 매칭 의존 → 실패 시 미승격 | `app/src/main/adapters/claude-map.ts` (구 `primary` 분기) |
| 미승격 시 renderer 가 모델명 잃고 200k default | `contextWindow.ts:23,35-43` |
| 복원 경로는 이미 argmax(input_tokens) `primaryModel` 로 강건 판정 | `app/src/main/features/usage/usage-map.ts:41` |
| SDK modelUsage 키 = 해석 ID(입력 alias 무관) | 사용자 실측(2026-07-22) · `@docs/handoff/0140-context-budget-diagnostics/plan.md` |
| 레퍼런스 예제 = `modelUsage[key].contextWindow` 직독 | 사용자 제공 코드 |

## 인수 기준 (Acceptance Criteria)

1. `normalizeResultTelemetry` 에서 `mainModel` 파라미터·`ctx.mainModel` 캡처·`MapContext.mainModel` 필드를 **제거**한다.
2. 신규 순수 헬퍼 `primaryModelKey(modelUsage)` = `(input+cacheRead+cacheCreation)` 최대 엔트리 키(전부 0 이면 첫 키). 다중 모델 turn 의 primary 선택에 쓴다(단일 모델은 그 모델).
3. primary 확정 시 `out.model`+(window 존재 시)`out.contextWindow` 승격. primary 는 항상 실제 modelUsage 키.
4. **Bedrock 해석 키**(`global.anthropic.claude-sonnet-5`)로 된 다중 모델 turn 에서 argmax 가 대용량 모델을 골라 `contextWindow===1_000_000` 을 승격한다(입력 매칭 무관).
5. 누적 haiku 잔류(사용량 0) turn → sonnet-5(대용량) 승격(200k 고착 방지). 이번 턴 haiku 우세 → 200k 추종.
6. Phase 0 임시 `[PHASE0-DIAG]` 로그 2곳(claude.ts·chat-turn.ts) + 미사용 `getLogger` import 제거.
7. renderer `contextWindowOf` 무변경(top-level 이 항상 채워져 200k default 트랩 자연 소멸). 테스트 갱신.
8. 게이트: lint 0 error + typecheck 3분할 0 + 순수 vitest green.

## 범위 / 비범위

- **범위**: AC1~8. `claude-map.ts`(+test) · `claude.ts`·`chat-turn.ts`(diag 제거) · `contextWindow.test.ts`(주석).
- **비범위(후속)**:
  - **Phase 3 (contextWindow DB 영속)**: 미완 — 복원 경로는 여전히 `contextWindowFor` 휴리스틱 폴백(argmax primaryModel 로 모델은 강건, window 는 휴리스틱). `WINDOW_1M_MARKERS` 존치.
  - **Phase 4 (제목 haiku 격리)**: modelUsage 오염원 차단 — argmax 로 도넛은 이미 면역이라 후속.
  - **세션 런타임 예산 캐싱/봉인**: 실측으로 spawnedModel(입력) 매칭이 무의미해져, 분모 산출은 telemetry(modelUsage) argmax 가 SSOT. 런타임 캐싱은 Phase 3 영속과 함께 검토.

## 설계

- `primaryModelKey` 순수 헬퍼(claude-map 내부, adapters→features import 금지라 로컬 인라인 — 복원 경로 `usage-map:41` 와 동형 로직).
- `primary = models.length===1 ? models[0] : primaryModelKey(modelUsage)`.
- 분자(`lastAssistantUsage`) 무변경 — last-request 컨텍스트가 멀티스텝 과대집계를 피하는 의도된 설계(0002/0065). 분모만 교정.
- 레이어: adapters 내부 — 경계 무영향. 순수 매퍼 유지(SDK 값 import 없음).

## 파생 UX / 엣지케이스

- **모델 전환**: respawn(`chat-turn.ts:554`)이 서브프로세스를 새로 띄워 modelUsage 누적이 리셋 → argmax 가 새 모델 추종. respawn 전 잔류가 남아도 이번 턴 대용량 모델이 argmax 라 자연 추종.
- **서브에이전트가 메인보다 대용량**(드묾): argmax 가 서브에이전트 모델을 고를 수 있음 — 복원 경로 `primaryModel` 도 동일 특성이라 기존 수용 동작과 일관. 범위 밖.

## 리스크 / 트레이드오프

| 리스크 | 완화 |
|---|---|
| argmax 가 세션 중 모델 전환을 누적-우세로 지연 | respawn 이 누적 리셋 → 자연 추종. 잔류 사용량 0 이라 argmax 는 이번 턴 대용량 따라감 |
| 복원 경로 window 는 아직 휴리스틱 | Phase 3 영속으로 해소(비범위 명시) |

- 되돌리기 어려운 결정: 없음(순수 로직 교체).

## 영향 받는 파일

- `app/src/main/adapters/claude-map.ts` (+ `claude-map.test.ts`)
- `app/src/main/adapters/claude.ts` · `app/src/main/app/chat-turn.ts` (diag 제거)
- `app/src/renderer/src/features/chat/lib/contextWindow.test.ts` (주석)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 위 4(+2 test) |
| 실행 명령 | `npm run lint` → `npm run typecheck` → `./node_modules/.bin/vitest run src/main/adapters src/renderer/src/features/chat/lib` (+ usage/chat/renderer 확장) |
| 게이트 결과 | lint ✅ 0 error(1 pre-existing warning) / typecheck ✅ 3분할 0 / vitest ✅ **378/378** (adapters+chat lib) + **373/373** (usage+chat+renderer) |
| 대상 커밋 | (커밋 후 기재) |
| 블로커 | 없음 |
