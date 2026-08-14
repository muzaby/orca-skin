# Plan — 0189 소비 방향 역전 (경량화 Phase B) · **DRAFT stub**

> ⚠️ **아직 설계되지 않았다.** 이 문서는 [`0188`](../0188-providers-slice-split/plan.md) 이 명시적으로
> 이월한 결정과 진입 조건을 보존하는 stub 이다. Phase A 구현이 끝난 뒤 `handoff-plan` 으로
> 본문을 작성하고 상태를 `READY` 로 올린다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0189-auth-runtime-inversion` |
| 작성자 | Claude Code |
| 일자 | 2026-08-14 (stub) |
| 매핑 | 「인증·Harness·Plugin 경량화 리팩터링 제안」 **Phase B** |
| 선행 | `0188-providers-slice-split` (Phase A) |
| 후속 | `0190-provider-compat-teardown` (Phase C) |
| 구현 주체 | Claude (비기능 리팩터링) |
| 상태 | **DRAFT** |

## 범위 (제안서 Phase B)

- `AuthRuntime` · `BoundAuth` · 별도 `AuthSecretReader` 를 세우고 `ProviderApi.materialize()` 를 제거.
- `contracts/provider.ts` → `contracts/auth.ts` 개명 + `Provider.llm`/`tools` 슬롯 정리 (0188 D-007 이월).
- `app/deployment/harness-runtime.ts` — 기존 settings key 에 **optional `RuntimeConfigAugmenter`** 만
  연결. 새 ModelProvider definition 배열·catalog 를 만들지 않는다.
- `HarnessRuntimeConfigService` — cache · generation fence · `sourceRevision` · single-flight ·
  expiry · selective invalidation.
- Harness별 spawn preparation 이 `PreparedHarnessConfig` 와 `runtimeConfigFingerprint` 를 만든다.
- UsageFetcher · Confluence 가 bound request 를 직접 받도록 Bootstrap 변경.
- 카탈로그 DTO 를 `ConnectionViewSource` 조립으로 만들되 기존 wire 필드를 전부 보존.

## 0188 이 이월한 결정 (설계 시 반드시 소비할 것)

| # | 이월 항목 | 근거 |
|---|---|---|
| B-1 | **`contracts/provider.ts` 개명은 여기서** — Phase A 는 파일도 심볼도 건드리지 않았다 | 0188 D-007 |
| B-2 | **`app/provider-compat/platform.ts` · `service-tools.ts` 삭제** — `AuthRuntime` + connection view 조립 + Plugin별 visibility helper 로 분해 | 0188 §11 ② |
| B-3 | **respawn 판정은 대체지 병존이 아니다** — `providerSettingsChanged` 를 `runtimeConfigFingerprintChanged` 로 **교체**하고 `providerBoundaryChanged`·`modelChanged`·`runtimeToolsRevisionChanged` 는 유지한다 (`features/sessions/respawn-policy.ts:10-19`). 둘을 병존시키면 같은 조건을 두 곳에서 판정한다 | 사용자 리뷰 |
| B-4 | **`credentialRevision` 을 공개 `AuthSnapshot` 필드로 두지 않는다** — 필요한 generation 은 `HarnessRuntimeConfigService` 내부 정합성 상태이지 GUI/IPC 계약이 아니다. 제안서가 요구한 필드지만 소비자가 없다 | 사용자 리뷰 · SKILL "enforcement point 없는 선언은 미완성" |
| B-5 | **동기 → 비동기 파급 전수 확인** — `materialize`·`llmEnvFor`·`buildTurnEnv` 는 현재 동기(`auth/api.ts:244` · `llm/index.ts:35` · `app/chat-turn/turn-setup.ts:86`). MCP resolver 는 동기 계약(`features/extensions/mcp/resolver.ts:34-47`)이므로 `AuthSecretReader.read` 는 **동기여야 한다** | 0188 §4 ⓔ |
| B-6 | **continuation 이 env 를 다시 만들어야 한다** — 현재 `buildListenRequest` 는 `env` 를 아예 싣지 않고 `buildFlushRequest` 만 base 를 spread 해 원본 env 를 물려받는다 (`app/chat-turn/continuation.ts:25-42`·`:48-75`) | 제안서 · 실측 |
| B-7 | **이미 충족된 3건을 다시 만들지 말 것** — gate 의 `verified` 요구(`features/gate/index.ts`), tool server identity 캐시, title/chat 동일 snapshot(`turn-context.ts:104-107`) | 0188 §4 ⓐ |
| B-8 | Usage `providerKeys` 정본 전환(선언 → ModelProvider settings entry)은 **명시적 계약 변경**으로 다룬다. 0188 은 배선을 유지만 했다 | 0188 D-005 |

## 진입 조건

- 0188 이 `verify/PASS`.
- `options.settings.env` ↔ `options.env` 우선순위 **characterization test** 확보 — `npm ci` 이후에만
  실측 가능하다. 제안서 §settings와 env 전달의 결정표는 이 실측 결과에 따라 분기한다.

## 비범위

호환층 제거·문서 정본 재작성·ADR-006 은 `0190`.
