# Plan — 0142-one-million-context-suffix

> 비기능(버그수정) = Claude 직접 plan→impl→verify. 정본 규칙 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0142-one-million-context-suffix` |
| 작성자 | Claude Code |
| 일자 | 2026-07-22 |
| 매핑 | PHASES "현재 작업 중" · PR #282 |
| 상태 | IMPL_DONE |

## 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "settings.json 의 opus model 에 `global.anthropic.claude-opus-4-8[1m]` 설정했는데 1m 이 query 에 적용 안 된다. completed 턴 종료 메시지에서 확인. 테스트 코드에서는 1m 실측 확인." | 라이브 세션 (2026-07-22) |

## Context (왜)

Claude Code CLI 는 **model 문자열의 `[1m]` 접미사**를 1M 컨텍스트 베타로 번역한다(raw Messages API 의 `context-1m-2025-08-07` 헤더에 대응하는 CLI 표면). Orca 의 파서 `stripOneMillion`(`claude-model-parser.ts:37`)은 `[1m]` 을 **떼어내** `oneMillionContext` 불린으로만 저장하고, `modelNameForFamily`(`model-resolve.ts:17`)는 **떼어낸** model 을 반환한다. 그 값이 `resolveTurnProvider`→`options.model` 로 SDK query 에 넘어가므로 **`[1m]` 이 실행 경로에 도달하지 못해 1M 이 안 켜진다.** `oneMillionContext` 는 모델 피커 UI(`AgentModelView`)에만 쓰였다. 파서가 `[1m]` 을 인지하도록 설계됐으나 재부착 배선이 누락된 버그.

## 자료조사 (Research)

| 발견 | 레퍼런스 |
|---|---|
| `stripOneMillion` 이 `[1m]` 을 떼고 oneMillionContext 저장 | `claude-model-parser.ts:37-43,64-67` |
| `modelNameForFamily` 가 떼어낸 model 반환(재부착 없음) | `model-resolve.ts:17-29`(수정 전) |
| 그 값이 SDK query options.model 로 감 | `chat-turn.ts:143`(resolved.model) → `claude.ts:406`(`...(model ? { model } : {})`) |
| `[1m]` = Claude Code CLI 의 1M 베타 트리거(model 문자열 접미사) | claude-api 스킬(`[1m]` 마커 트리거) + 사용자 실측 |
| modelUsage 키는 해석 ID(입력 `[1m]` 무관) — 0141 argmax 도넛 무영향 | 0141 · 사용자 실측 |

## 인수 기준 (Acceptance Criteria)

1. `modelNameForFamily` 가 선택 모델의 `oneMillionContext===true` 면 반환 문자열에 `[1m]` 을 재부착한다(`${base}[1m]`). false 면 무변경.
2. `oneMillionContext` 는 model 이 non-null 일 때만 true(파서 불변식)이므로, `[1m]` 은 항상 실제 model 문자열 뒤에 붙는다(bare alias 에 안 붙음).
3. 표시/매칭 경로 무영향(파서 stripped 값 유지) — SDK query 실행 경로에서만 접미사 부활.
4. 게이트: lint 0 error + typecheck 3분할 0 + 순수 vitest green(신규 테스트 포함).

## 범위 / 비범위

- **범위**: `model-resolve.ts` `modelNameForFamily` + `provider-settings.test.ts` 테스트.
- **비범위**: 도넛 분모(0141 argmax 로 별도 해결) · resolveTitleModel 의 [1m](제목은 1-shot, 무해) · settings UI.

## 설계

- `const base = selected.model ?? selected.alias; return selected.oneMillionContext ? \`${base}[1m]\` : base`.
- respawn 판정(`spawnedModel` 비교)은 resolved.model 이 결정론적(`...[1m]`)이라 정합 유지.
- 레이어: features/providers 내부 순수 함수 — 경계 무영향.

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/features/providers/model-resolve.ts` · `app/src/main/features/providers/provider-settings.test.ts` |
| 게이트 결과 | lint ✅ 0 error(1 pre-existing warning) / typecheck ✅ 3분할 0 / vitest ✅ providers **39/39**(신규 [1m] 케이스 포함) |
| 대상 커밋 | `b8c07fa` |
| 블로커 | 없음. **사람 실기 대기**: `global.anthropic.claude-opus-4-8[1m]` 설정으로 대화 → completed 턴 종료 메시지에서 1M 반영 확인. |

## [검증] 요구 충족

| AC | 결과 | 증거 |
|---|---|---|
| 1 | ✅ | `model-resolve.ts` `oneMillionContext ? \`${base}[1m]\` : base` |
| 2 | ✅ | 파서 불변식(`claude-model-parser.ts:64` model=null→oneMillion=false) + 테스트 |
| 3 | ✅ | 파서/표시 경로 무변경, `modelNameForFamily`(실행 경로)만 수정 |
| 4 | ✅ | lint/typecheck/vitest 39/39 |

**Next-Action: none** (PASS* — 사람 실기·PR 머지 대기).
