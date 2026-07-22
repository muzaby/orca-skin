# Plan — 0140-context-budget-diagnostics

> 재설계 프로그램 "세션 런타임 소유 Context Budget" 의 **Phase 0(진단)**.
> 흐름: **의도 → 조사 → 설계 → 리스크**. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0140-context-budget-diagnostics` |
| 작성자 | Claude Code |
| 일자 | 2026-07-22 |
| 매핑 | PHASES "현재 작업 중" — 재설계 Phase 0/5 |
| 상태 | READY (비기능 = Claude 직접 plan→impl→verify) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "sonnet5(`global.anthropic.claude-sonnet-5`) 컨텍스트 도넛이 분모 200k/사용량 259k = 불가능 비율. SDK 는 이 환경에서 1M 실측 확인. 재설계하라 + **세션(런타임) 레벨에서 재설계**" | 라이브 세션 (2026-07-22) |
| 명시 제약 | "Phase 0 진단 없이 폴백부터 넣는 재실수 금지 — 왜 매치가 실패하는지 실데이터로 확정하라" | 라이브 세션 |
| 추론 의도 | 진단은 임시(회수 후 제거). R2 실패지점(키 형태 불일치/mainModel 오염/미포착)만 가리면 됨 | (근거) 사용자 "왜 매치 실패하는가" 질의 |

## Context (왜)

컨텍스트 도넛 분모 버그가 3연속(0134→0139→현재)이다. 재설계 전략은 예산 산출 소유를 **`SessionRuntime`**(모델 수명 소유자)로 올리는 것인데, Phase 1 리졸버의 **정규화 매칭 규칙**을 짜려면 실환경에서 **`spawnedModel`(=req.model) ↔ `result.modelUsage` 키 ↔ observed `message.model`** 세 문자열이 실제로 어떻게 다른지 봐야 한다. 정적 코드로는 확정 불가(라이브 세션에서 확인). 이 핸드오프는 **오직 진단 로그만** 심고 사용자 실행으로 데이터를 회수한다 — 동작 변경 0.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 권위 모델은 런타임이 이미 소유 — spawn 시 `req.model` 기록 | `app/src/main/features/sessions/session-runtime.ts:231` (`spawnedModelValue = req.model`) |
| 현행 분모 승격은 `message.model`↔`modelUsage` 정확 키 매칭 (실패 시 미승격) | `app/src/main/adapters/claude-map.ts:575-585` |
| result `modelUsage[key].contextWindow` = SDK 실측(1M 확인) | `claude-map.ts:427-437` · 사용자 레퍼런스 실측 |
| `oneMillionContext` = `[1m]` 설정 파생(권위, 미사용 by 도넛) | `app/src/main/features/providers/claude-model-parser.ts:39` · `model-resolve.ts:61` |
| 어댑터 events() 루프가 raw SDKMessage(assistant.model·result.modelUsage) 접근 지점 | `app/src/main/adapters/claude.ts:429-453` |
| 로깅 = electron-free `getLogger()`(레지스트리), dev debug 레벨 | `app/src/main/infra/log/registry.ts` |

## 인수 기준 (Acceptance Criteria)

1. 한 실 턴에서 **단일 상관 로그**(`engine.contextbudget.diag`, debug)로 다음을 방출한다: `sessionId` · `reqModel`(=spawnedModel 후보) · `observedMainModel`(마지막 non-child `message.model`) · `modelUsage`(각 키의 `{ model, contextWindow }` 배열) · 현행 계산 분모(참고). 순수 매퍼(claude-map)의 electron-free/테스트 불변성을 깨지 않도록 **어댑터(claude.ts) events() 루프**에서 방출한다.
2. `oneMillionContext` 상관 로그(`providers.contextbudget.diag`, debug)로 `sessionId` · 해석 `model` · `oneMillionContext` 를 방출한다(`resolveTurnProvider`).
3. 로그는 `// [PHASE0-DIAG]` 마커로 감싸 **Phase 2 에서 일괄 제거** 가능하게 한다. dev 게이트(debug 레벨은 prod info 카탈로그 미포함).
4. 동작 변경 0 — NormalizedEvent/telemetry/도넛/영속 무변경. 게이트 lint/typecheck/순수 vitest green(회귀 0).
5. 사용자 실행 안내: 실 Bedrock `global.anthropic.claude-sonnet-5` 로 대화 1턴 → 로그(JSONL 또는 dev 콘솔) 회수 → 본 plan "파생 이슈"에 실데이터 기록.

## 범위 / 비범위

- **범위**: AC1~5. 임시 진단 로그 2곳 + 마커. 핸드오프/PHASES.
- **비범위**: 리졸버(Phase 1) · 런타임 배선/삭제(Phase 2) · 영속(Phase 3) · 제목 격리(Phase 4). 어떤 수정도 이 핸드오프에서 하지 않는다(진단 전용).

## 의존 기술 / 전제

- 의존: 기존 `getLogger()`(infra/log), 어댑터 events() 루프, `resolveTurnProvider`. **신규 의존성 0.**
- 전제: dev 빌드에서 로그 스위치 ON 시 debug 가 콘솔 미러/JSONL 로 회수 가능(0124).

## 설계

- **claude.ts events() 루프**: `for await (const msg of handle)` 안, `msg.type==='result'` 일 때 `// [PHASE0-DIAG]` 블록 — `req.model`(closure), `ctx.mainModel`, `r.modelUsage` 각 키의 contextWindow 를 추출해 `getLogger().child('engine').debug('engine.contextbudget.diag', {...})`. assistant 관측은 `ctx.mainModel` 재사용(claude-map 이 이미 캡처).
- **resolveTurnProvider(chat-turn.ts)**: 선택 모델의 `oneMillionContext` 를 찾아(`selected.models` 에서 `modelNameForFamily` 대상) `// [PHASE0-DIAG]` debug 로그.
- 재사용: `getLogger`·`ctx.mainModel`·기존 modelUsage 좁히기 타입. 레이어: adapters·app 내부 — 경계 무영향, 순수 매퍼 불변.

## 리스크 / 트레이드오프

| 리스크 | 완화책 |
|---|---|
| 진단이 prod 로그 카탈로그 오염 | debug 레벨(prod info 미포함) + `[PHASE0-DIAG]` 마커로 Phase 2 제거 |
| claude.ts 에서 req.model 이 undefined(SDK 기본) | 그 자체가 데이터 — 로그가 undefined 로 남아 미포착 케이스 판별 |

- 되돌리기 어려운 결정: 없음(임시·additive).
- 단독 결정 금지 항목: 없음.

## 영향 받는 파일

- `app/src/main/adapters/claude.ts` (events() 진단 블록)
- `app/src/main/app/chat-turn.ts` (`resolveTurnProvider` 진단)

## 게이트

- `cd app && npm run lint && npm run typecheck` + 순수 vitest(회귀 0). 동작 무변경이라 신규 테스트 없음.

---

> **[구현자 기입]** 이하 구현 턴에서 채운다.

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/adapters/claude.ts`(events() 루프 `[PHASE0-DIAG]` result 진단 + `getLogger` import) · `app/src/main/app/chat-turn.ts`(`resolveTurnProvider` `[PHASE0-DIAG]` oneMillionContext 진단) |
| 실행 명령 | `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` → `npm run lint` → `npm run typecheck` → `./node_modules/.bin/vitest run src/main/adapters src/renderer/src/features/chat/lib` |
| 게이트 결과 | lint ✅ 0 error(1 pre-existing warning = TanStack Virtual, 무관) / typecheck ✅ 3분할 0 / vitest ✅ **378/378**(adapters+chat lib 순수 스위트, 진단 additive 무회귀). DB 로드 스위트는 미실행(진단 무관). |
| 대상 커밋 | (커밋 후 기재) |
| 블로커 | 없음. **사용자 실데이터 대기**(AC5) — dev 로그 스위치 ON + Bedrock sonnet-5 1턴. |

## [검증자 기입 — 사용자 실데이터] R2 실패지점 확정

> 사용자가 실 Bedrock sonnet-5 턴 로그를 회수해 붙이면, 여기서 키 형태 불일치 / mainModel 오염 / 미포착 중 무엇인지 확정하고 Phase 1 리졸버 규칙을 못박는다.

| 관측 필드 | 값 (사용자 로그) |
|---|---|
| reqModel(spawnedModel) | |
| observedMainModel | |
| modelUsage 키+windows | |
| oneMillionContext | |
| 결론(실패지점) | |
